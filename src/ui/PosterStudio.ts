import * as THREE from 'three';
import { setCreation } from '../character/poses.ts';
import { Thumbnailer } from '../render/Thumbnailer.ts';
import { fontsReady } from './fonts.ts';
import { paintDecor, W, H } from '../poster/decors.ts';
import { PosterRenderer, type PosterSettings } from '../poster/PosterRenderer.ts';
import { studioDecors, studioPoses } from '../poster/unlocks.ts';
import { saveServedBy, savedServedBy } from '../poster/school.ts';
import { ExportCard } from './ExportCard.ts';
import { skillById } from '../game/skills.ts';
import { trade } from '../trades/current.ts';
import { icon } from './icons.ts';
import type { IconName } from './iconPaths.ts';
import type { Look } from '../character/Character.ts';
import type { Expression } from '../character/FaceTexture.ts';
import type { Skill } from '../trades/types.ts';

/** The studio's choices: `pose` stays null until the visitor picks one (see `current`). */
export type StudioSettings = Omit<PosterSettings, 'pose'> & { pose: string | null };

type TabId = 'decor' | 'pose' | 'expression' | 'text';

interface Tab {
  id: TabId;
  icon: IconName;
  label: string;
}

/** An option of a list of choices; `skill`: the domain that unlocks it. */
interface Choice {
  id: string;
  label: string;
  skill?: string;
}

const THUMB_SIZE = 168;
const DRAG_TURN = 0.012; // radians per dragged pixel
const THUMBS_PER_FRAME = 2;
const NAME_LENGTH = 14;
const SERVED_BY_LENGTH = 40;

const EXPRESSIONS: { id: Expression; label: string }[] = [
  { id: 'happy', label: 'Sourire' },
  { id: 'wink', label: 'Clin d’œil' },
  { id: 'surprised', label: 'Waouh' },
  { id: 'focused', label: 'Concentré·e' },
  { id: 'neutral', label: 'Calme' },
];

const TABS: Tab[] = [
  { id: 'decor', icon: 'island', label: 'Décor' },
  { id: 'pose', icon: 'person-arms-spread', label: 'Pose' },
  { id: 'expression', icon: 'smiley', label: 'Expression' },
  { id: 'text', icon: 'text-aa', label: 'Texte' },
];

// `pose: null` until the visitor picks one: what they made in both hands when they made it. The
// decor and the title are the trade's first ones.
function defaultSettings(): Omit<StudioSettings, 'servedBy'> {
  const { studio } = trade();
  return { decor: studio.defaultDecor ?? studioDecors()[0].id, pose: null, expression: 'happy', title: studio.titles[0].id, name: '', heading: 0.3 };
}

/**
 * Full-screen "Ton affiche" studio: the A4 poster in live preview, and tabs to pick the decor, the
 * pose, the expression and the text. Each domain of the job won in the office unlocks decors or poses.
 * `open({ look, skills, made })` resolves when the visitor goes back to the office; `made` is what the
 * visitor made in the office (`trade().creation.from(results)`), which the character then holds.
 */
export class PosterStudio {
  settings: StudioSettings;
  skills: Set<string>;
  look: Look | null;
  made: object | null;
  tab: Tab;
  thumbQueue: (() => void)[];
  el: HTMLDivElement;
  previewEl: HTMLElement;
  canvas: HTMLCanvasElement;
  bodyEl: HTMLElement;
  poster: PosterRenderer;
  thumbnailer: Thumbnailer;
  exportCard: ExportCard;
  timer: THREE.Timer;
  resolve?: (() => void) | null;

  constructor(root: HTMLElement) {
    this.settings = { ...defaultSettings(), servedBy: savedServedBy() };
    this.skills = new Set<string>(); // ids of the domains won (skills.ts)
    this.look = null;
    this.made = null;
    this.tab = TABS[0];
    this.thumbQueue = [];

    this.el = document.createElement('div');
    this.el.className = 'creator studio';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="studio-preview">
        <canvas class="studio-poster" aria-label="Aperçu de ton affiche"></canvas>
        <div class="creator-hint">${icon('hand-swipe-right')} Fais-moi tourner</div>
      </div>
      <section class="creator-panel">
        <h1 class="creator-title">Ton affiche</h1>
        <nav class="creator-tabs" role="tablist">
          ${TABS.map((tab) => `
            <button class="creator-tab" role="tab" data-tab="${tab.id}">
              <span class="creator-tab-icon">${icon(tab.icon)}</span>${tab.label}
            </button>`).join('')}
        </nav>
        <div class="creator-body" role="tabpanel"></div>
        <footer class="creator-actions">
          <button class="btn btn-ghost" data-action="back">${icon('arrow-left')} Bureau</button>
          <button class="btn btn-primary" data-action="finish">${icon('sparkle')} Terminer</button>
        </footer>
      </section>
    `;
    root.appendChild(this.el);

    this.previewEl = this.el.querySelector<HTMLElement>('.studio-preview')!;
    this.canvas = this.el.querySelector<HTMLCanvasElement>('.studio-poster')!;
    this.bodyEl = this.el.querySelector<HTMLElement>('.creator-body')!;

    this.poster = new PosterRenderer();
    this.thumbnailer = new Thumbnailer(THUMB_SIZE);
    this.exportCard = new ExportCard(root);
    this.timer = new THREE.Timer();

    new ResizeObserver(() => this.resize()).observe(this.previewEl);
    this.bindEvents();
  }

  bindEvents() {
    this.el.querySelector('.creator-tabs')!.addEventListener('click', (e) => {
      const button = (e.target as Element).closest<HTMLElement>('[data-tab]');
      if (button) this.showTab(TABS.find((tab) => tab.id === button.dataset.tab)!);
    });
    this.bodyEl.addEventListener('click', (e) => {
      const option = (e.target as Element).closest<HTMLButtonElement>('[data-value]');
      if (option && !option.disabled) this.change({ [option.dataset.key!]: option.dataset.value });
    });
    this.bodyEl.addEventListener('input', (e) => {
      if ((e.target as HTMLInputElement).name === 'name') this.settings.name = (e.target as HTMLInputElement).value;
      if ((e.target as HTMLInputElement).name === 'servedBy') {
        this.settings.servedBy = (e.target as HTMLInputElement).value;
        saveServedBy((e.target as HTMLInputElement).value);
      }
    });
    this.el.querySelector('[data-action="back"]')!.addEventListener('click', () => this.close());
    this.el.querySelector('[data-action="finish"]')!.addEventListener('click', () => this.finish());

    // Drag (mouse or finger) on the poster to turn the character.
    let drag: { id: number; x: number } | null = null;
    this.previewEl.addEventListener('pointerdown', (e) => {
      drag = { id: e.pointerId, x: e.clientX };
      this.previewEl.setPointerCapture(e.pointerId);
      this.previewEl.classList.add('dragging');
    });
    this.previewEl.addEventListener('pointermove', (e) => {
      if (drag?.id !== e.pointerId) return;
      this.settings.heading += (e.clientX - drag.x) * DRAG_TURN;
      drag.x = e.clientX;
    });
    const endDrag = () => {
      drag = null;
      this.previewEl.classList.remove('dragging');
    };
    this.previewEl.addEventListener('pointerup', endDrag);
    this.previewEl.addEventListener('pointercancel', endDrag);
  }

  async open({ look, skills, made = null }: { look: Look; skills: Set<string>; made?: object | null }) {
    this.look = look;
    this.skills = skills;
    this.poster.character.setLook(look);
    await Promise.all([fontsReady(), this.poster.ready]);
    if (made !== this.made) {
      this.made = made;
      const { creation } = trade();
      const held = made && { mesh: () => creation.mesh(made), holds: creation.holds };
      setCreation(this.poster.character, held);
      setCreation(this.thumbnailer.character, held);
    }
    // A choice locked again (new visitor) falls back to the default one.
    if (!this.isUnlocked(studioDecors().find((d) => d.id === this.settings.decor))) this.settings.decor = defaultSettings().decor;
    if (!this.poses.some((p) => p.id === this.settings.pose)) this.settings.pose = null;
    this.showTab(this.tab);

    this.el.hidden = false;
    this.el.classList.remove('leaving');
    this.resize();
    this.timer.reset();
    this.poster.stage.renderer.setAnimationLoop((t) => this.tick(t));
    return new Promise<void>((resolve) => {
      this.resolve = resolve;
    });
  }

  close() {
    this.el.classList.add('leaving');
    setTimeout(() => {
      this.el.hidden = true;
      this.poster.stage.renderer.setAnimationLoop(null);
    }, 350);
    this.resolve?.();
    this.resolve = null;
  }

  /** The poses on offer: unlocked ones, and those that need the visitor's object only when there is one. */
  get poses() {
    return studioPoses().filter((pose) => this.isUnlocked(pose) && (!pose.needsCreation || this.made));
  }

  /** The visitor's choices, with the default pose filled in. */
  get current(): PosterSettings {
    return { ...this.settings, pose: this.settings.pose ?? (this.made ? 'proud' : 'wave') };
  }

  /** Renders the poster at print size and shows the ways to take it home. */
  async finish() {
    this.poster.stage.renderer.setAnimationLoop(null);
    const settings = this.current;
    await this.exportCard.open(() => this.poster.render(settings), settings.name.trim());
    this.timer.reset();
    this.poster.stage.renderer.setAnimationLoop((t) => this.tick(t));
  }

  /** Clears the poster choices, for the next visitor (the booth team's names stay). */
  reset() {
    this.settings = { ...defaultSettings(), servedBy: this.settings.servedBy };
    this.tab = TABS[0];
  }

  tick(timestamp: number) {
    this.timer.update(timestamp);
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const settings = this.current;
    this.poster.update(dt, this.timer.getElapsed(), settings);
    this.poster.draw(this.canvas, settings);
    for (const job of this.thumbQueue.splice(0, THUMBS_PER_FRAME)) job();
  }

  /** Fits the A4 poster in the preview area, leaving room below for the "Fais-moi tourner" hint. */
  resize() {
    const { clientWidth, clientHeight } = this.previewEl;
    if (!clientWidth || !clientHeight) return;
    const height = Math.min(clientHeight - 104, ((clientWidth - 48) * H) / W);
    const width = (height * W) / H;
    const ratio = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  isUnlocked(option: { skill?: string } | undefined) {
    return !option?.skill || this.skills.has(option.skill);
  }

  change(changes: Partial<StudioSettings>) {
    Object.assign(this.settings, changes);
    this.refreshSelection();
  }

  showTab(tab: Tab) {
    this.tab = tab;
    for (const button of this.el.querySelectorAll<HTMLElement>('.creator-tab')) {
      const active = button.dataset.tab === tab.id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    }
    this.thumbQueue = [];
    this.bodyEl.innerHTML = this[`${tab.id}Html` as const]();
    this.bodyEl.scrollTop = 0;
    this.refreshSelection();
    this.queueThumbs();
  }

  // One list per tab: the tab already names it. Locked options show the domain that unlocks them.
  decorHtml() {
    return `<div class="creator-field">${this.choicesHtml('decor', studioDecors(), 'tall')}</div>`;
  }

  poseHtml() {
    return `<div class="creator-field">${this.choicesHtml('pose', studioPoses().filter((p) => !p.needsCreation || this.made))}</div>`;
  }

  expressionHtml() {
    return `<div class="creator-field">${this.choicesHtml('expression', EXPRESSIONS)}</div>`;
  }

  textHtml() {
    return `
      <div class="creator-field">
        <h2>Ton prénom</h2>
        <input class="studio-input" name="name" maxlength="${NAME_LENGTH}" autocomplete="off" spellcheck="false"
          placeholder="Facultatif" value="${escapeAttr(this.settings.name)}">
      </div>
      <div class="creator-field">
        <h2>Titre</h2>
        <div class="studio-titles">${trade().studio.titles.map(({ id, lines }) => `
          <button class="choice studio-title" data-key="title" data-value="${id}">${lines.join('<br>')}</button>`).join('')}
        </div>
      </div>
      <div class="creator-field">
        <h2>Servi·e par</h2>
        <input class="studio-input" name="servedBy" maxlength="${SERVED_BY_LENGTH}" autocomplete="off" spellcheck="false"
          placeholder="Prénoms de l’équipe du stand" value="${escapeAttr(this.settings.servedBy)}">
      </div>`;
  }

  choicesHtml(key: string, options: Choice[], shape = '') {
    return `<div class="choices ${shape}">${options.map((option) => {
      const locked = !this.isUnlocked(option);
      const skill = (locked && skillById(option.skill!)) as Skill; // only read when locked
      return `
        <button class="choice${locked ? ' locked' : ''}" data-key="${key}" data-value="${option.id}" ${locked ? 'disabled' : ''}>
          <canvas width="${shape === 'tall' ? 120 : THUMB_SIZE}" height="${shape === 'tall' ? 170 : THUMB_SIZE}"></canvas>
          <span>${option.label}</span>
          ${locked ? `<span class="choice-lock" title="${skill.label}">${icon('lock-simple')} ${icon(skill.icon, { tint: skill.tint })}</span>` : ''}
        </button>`;
    }).join('')}</div>`;
  }

  refreshSelection() {
    for (const option of this.bodyEl.querySelectorAll<HTMLElement>('[data-value]')) {
      const selected = option.dataset.value === this.current[option.dataset.key as keyof PosterSettings];
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    }
  }

  /** Queues the thumbnails of the visible tab; `tick()` draws a few per frame. */
  queueThumbs() {
    for (const option of this.bodyEl.querySelectorAll<HTMLElement>('.choice[data-key]')) {
      const canvas = option.querySelector('canvas');
      if (!canvas) continue;
      const { key, value } = option.dataset;
      if (key === 'decor') {
        this.thumbQueue.push(() => paintDecor(canvas, studioDecors().find((d) => d.id === value)!));
      } else if (key === 'pose') {
        const pose = studioPoses().find((p) => p.id === value);
        this.thumbQueue.push(() => this.thumbnailer.draw(canvas, this.look!, { view: 'body', heading: 0.3, pose }));
      } else if (key === 'expression') {
        this.thumbQueue.push(() => this.thumbnailer.draw(canvas, this.look!, { view: 'face', heading: 0, expression: value as Expression }));
      }
    }
  }
}

function escapeAttr(text: string) {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
