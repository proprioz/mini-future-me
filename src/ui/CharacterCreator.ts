import * as THREE from 'three';
import { Character, DEFAULT_LOOK, type Look } from '../character/Character.ts';
import { CharacterStage } from '../render/CharacterStage.ts';
import { Thumbnailer, type ThumbnailOptions } from '../render/Thumbnailer.ts';
import {
  SKIN_TONES, EYE_COLORS, LIKELY_HAIR_COLORS, LIKELY_CLOTH_COLORS, GLASSES_COLORS, METAL_COLORS,
  FACE_SHAPES, EYE_SHAPES, SKIN_MARKS, HAIR_STYLES, BEARDS, MUSTACHES, OUTFITS, HEADWEAR, GLASSES, EARRINGS, CLEAR_FRAME,
  randomLook, type Option,
} from '../character/options.ts';
import { ColorPicker } from './ColorPicker.ts';
import { icon } from './icons.ts';
import type { IconName } from './iconPaths.ts';

/** How an option's thumbnail is rendered; `bare`: without headwear and glasses. */
type Thumb = ThumbnailOptions & { bare?: boolean };

interface BaseField {
  key: keyof Look;
  label: string;
  showIf?: (look: Look) => boolean;
}

/** A field of swatches, the last one a colour picker unless `picker` is false, or of choices with a 3D thumbnail each. */
type Field = BaseField & (
  | { colors: string[]; picker?: false; choices?: undefined; thumb?: undefined }
  | { choices: Option[]; colors?: undefined; thumb?: Thumb }
);

interface Tab {
  id: string;
  icon: IconName;
  label: string;
  fields: Field[];
}

const THUMB_SIZE = 168; // px, rendered at this size and displayed smaller
const DRAG_TURN = 0.012; // radians per dragged pixel
const START_HEADING = 0.35;
const THUMBS_PER_FRAME = 2; // each one is a full WebGL render (~10 ms), so spread them out

// `thumb` fields show a 3D thumbnail per option; `bare` strips accessories that would hide the option,
// `expression` replaces the happy face (whose closed eyes would hide the eyes options).
const FACE_THUMB: Thumb = { view: 'face', heading: 0, bare: true, expression: 'neutral' };
const TABS: Tab[] = [
  {
    id: 'face', icon: 'smiley', label: 'Visage',
    fields: [
      { key: 'skin', label: 'Teint', colors: SKIN_TONES, picker: false },
      { key: 'faceShape', label: 'Forme du visage', choices: FACE_SHAPES, thumb: { view: 'portrait', heading: 0.3, bare: true } },
      { key: 'eyeShape', label: 'Forme des yeux', choices: EYE_SHAPES, thumb: FACE_THUMB },
      { key: 'eyeColor', label: 'Yeux', colors: EYE_COLORS },
      { key: 'skinMarks', label: 'Taches', choices: SKIN_MARKS, thumb: FACE_THUMB },
    ],
  },
  {
    id: 'hair', icon: 'scissors', label: 'Coiffure',
    fields: [
      { key: 'hairStyle', label: 'Coupe', choices: HAIR_STYLES, thumb: { view: 'head', heading: 0.8, bare: true } },
      { key: 'hair', label: 'Couleur', colors: LIKELY_HAIR_COLORS },
      { key: 'beard', label: 'Barbe', choices: BEARDS, thumb: { view: 'head', heading: 0.35, bare: true } },
      { key: 'mustache', label: 'Moustache', choices: MUSTACHES, thumb: { view: 'head', heading: 0.2, bare: true } },
      {
        key: 'beardColor', label: 'Couleur de la barbe', colors: LIKELY_HAIR_COLORS,
        showIf: (look) => look.beard !== 'none' || look.mustache !== 'none',
      },
    ],
  },
  {
    id: 'outfit', icon: 't-shirt', label: 'Tenue',
    fields: [
      { key: 'outfit', label: 'Style', choices: OUTFITS, thumb: { view: 'body', heading: 0.35 } },
      { key: 'top', label: 'Haut', colors: LIKELY_CLOTH_COLORS },
      { key: 'bottom', label: 'Bas', colors: LIKELY_CLOTH_COLORS },
      { key: 'shoes', label: 'Chaussures', colors: LIKELY_CLOTH_COLORS },
    ],
  },
  {
    id: 'extras', icon: 'sunglasses', label: 'Accessoires',
    fields: [
      { key: 'headwear', label: 'Sur la tête', choices: HEADWEAR, thumb: { view: 'head', heading: 0.5 } },
      { key: 'headwearColor', label: 'Couleur', colors: LIKELY_CLOTH_COLORS, showIf: (look) => look.headwear !== 'none' },
      { key: 'glasses', label: 'Lunettes', choices: GLASSES, thumb: { view: 'head', heading: 0.25 } },
      { key: 'glassesColor', label: 'Couleur des lunettes', colors: GLASSES_COLORS, showIf: (look) => look.glasses !== 'none' },
      { key: 'earrings', label: 'Boucles d’oreilles', choices: EARRINGS, thumb: { view: 'head', heading: 0.9, bare: true } },
      { key: 'earringColor', label: 'Couleur des boucles', colors: METAL_COLORS, showIf: (look) => look.earrings !== 'none' },
    ],
  },
];

/**
 * Full-screen "Crée ton perso" screen: live 3D preview on one side, tabs of options on the other.
 * `edit(look)` resolves with the chosen look when the visitor taps "C'est parti !".
 */
export class CharacterCreator {
  look: Look;
  tab: Tab;
  picker: ColorPicker;
  pickerKey: keyof Look | null; // field whose colour picker is open
  resolve: ((look: Look) => void) | null;
  thumbsDirty: boolean;
  thumbQueue: Parameters<Thumbnailer['draw']>[];
  el: HTMLDivElement;
  previewEl: HTMLElement;
  bodyEl: HTMLElement;
  stage: CharacterStage;
  character: Character;
  thumbnailer: Thumbnailer;
  timer: THREE.Timer;
  expressionTimer: ReturnType<typeof setTimeout> | null;

  constructor(root: HTMLElement) {
    this.look = { ...DEFAULT_LOOK };
    // The look follows the finger, the thumbnails and the smile once it is lifted.
    this.picker = new ColorPicker((color, done) => {
      if (done) this.change({ [this.pickerKey!]: color });
      else this.preview({ [this.pickerKey!]: color });
    });
    this.pickerKey = null;
    this.tab = TABS[0];
    this.resolve = null;
    this.thumbsDirty = true;
    this.thumbQueue = [];

    this.el = document.createElement('div');
    this.el.className = 'creator';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="creator-preview">
        <div class="creator-hint">${icon('hand-swipe-right')} Fais-moi tourner</div>
      </div>
      <section class="creator-panel">
        <h1 class="creator-title">Crée ton perso</h1>
        <nav class="creator-tabs" role="tablist">
          ${TABS.map((tab) => `
            <button class="creator-tab" role="tab" data-tab="${tab.id}">
              <span class="creator-tab-icon">${icon(tab.icon)}</span>${tab.label}
            </button>`).join('')}
        </nav>
        <div class="creator-body" role="tabpanel"></div>
        <footer class="creator-actions">
          <button class="btn btn-ghost" data-action="random">${icon('dice-five')} Au hasard</button>
          <button class="btn btn-primary" data-action="done">C’est parti !</button>
        </footer>
      </section>
    `;
    root.appendChild(this.el);

    this.previewEl = this.el.querySelector<HTMLElement>('.creator-preview')!;
    this.bodyEl = this.el.querySelector<HTMLElement>('.creator-body')!;

    this.stage = new CharacterStage();
    this.previewEl.prepend(this.stage.canvas);
    this.character = new Character(this.look);
    this.stage.scene.add(this.character.group);
    this.thumbnailer = new Thumbnailer(THUMB_SIZE);
    this.timer = new THREE.Timer();
    this.expressionTimer = null;

    new ResizeObserver(() => this.resize()).observe(this.previewEl);
    this.bindEvents();
  }

  bindEvents() {
    this.el.querySelector('.creator-tabs')!.addEventListener('click', (e) => {
      const button = (e.target as Element).closest<HTMLElement>('[data-tab]');
      if (button) this.showTab(TABS.find((tab) => tab.id === button.dataset.tab)!);
    });

    this.bodyEl.addEventListener('click', (e) => {
      const option = (e.target as Element).closest<HTMLElement>('[data-value]');
      if (option) {
        if (option.dataset.key === this.pickerKey) this.pickerKey = null;
        this.change({ [option.dataset.key!]: option.dataset.value });
      }
      const pickerButton = (e.target as Element).closest<HTMLElement>('[data-picker]');
      if (pickerButton) this.togglePicker(pickerButton.dataset.picker as keyof Look);
    });

    this.el.querySelector('[data-action="random"]')!.addEventListener('click', () => {
      this.change(randomLook());
      this.character.hop();
    });
    this.el.querySelector('[data-action="done"]')!.addEventListener('click', () => this.finish());

    // Drag (mouse or finger) on the preview to spin the character.
    let drag: { id: number; x: number } | null = null;
    this.previewEl.addEventListener('pointerdown', (e) => {
      drag = { id: e.pointerId, x: e.clientX };
      this.previewEl.setPointerCapture(e.pointerId);
      this.previewEl.classList.add('dragging');
    });
    this.previewEl.addEventListener('pointermove', (e) => {
      if (drag?.id !== e.pointerId) return;
      this.character.targetHeading += (e.clientX - drag.x) * DRAG_TURN;
      drag.x = e.clientX;
    });
    const endDrag = () => {
      drag = null;
      this.previewEl.classList.remove('dragging');
    };
    this.previewEl.addEventListener('pointerup', endDrag);
    this.previewEl.addEventListener('pointercancel', endDrag);
  }

  /** Opens the screen with `look` pre-selected and resolves with the final look. */
  edit(look: Partial<Look> = this.look) {
    this.look = { ...DEFAULT_LOOK, ...look };
    this.character.setLook(this.look);
    this.character.heading = this.character.targetHeading = START_HEADING;
    this.thumbsDirty = true;
    this.showTab(TABS[0]);

    this.el.hidden = false;
    this.el.classList.remove('leaving');
    this.timer.reset();
    this.stage.renderer.setAnimationLoop((t) => this.tick(t));
    return new Promise<Look>((resolve) => {
      this.resolve = resolve;
    });
  }

  finish() {
    this.character.setExpression('happy');
    this.el.classList.add('leaving');
    setTimeout(() => {
      this.el.hidden = true;
      this.stage.renderer.setAnimationLoop(null);
    }, 350);
    this.resolve?.({ ...this.look });
    this.resolve = null;
  }

  tick(timestamp: number) {
    this.timer.update(timestamp);
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.character.update(dt, this.timer.getElapsed());
    this.stage.render();
    for (const job of this.thumbQueue.splice(0, THUMBS_PER_FRAME)) this.thumbnailer.draw(...job);
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.previewEl;
    if (width && height) this.stage.setSize(width, height);
    this.stage.canvas.style.width = `${width}px`;
    this.stage.canvas.style.height = `${height}px`;
  }

  /** Shows `changes` on the character only: no thumbnails, no smile (while a colour is being picked). */
  preview(changes: Partial<Look>) {
    Object.assign(this.look, changes);
    this.character.setLook(changes);
    this.refreshFields();
  }

  change(changes: Partial<Look>) {
    this.thumbsDirty = true;
    this.preview(changes);

    // A little smile so the visitor feels the change.
    clearTimeout(this.expressionTimer!); // null: a no-op
    this.character.setExpression('happy');
    this.expressionTimer = setTimeout(() => this.character.setExpression('neutral'), 900);
  }

  showTab(tab: Tab) {
    this.tab = tab;
    for (const button of this.el.querySelectorAll<HTMLElement>('.creator-tab')) {
      const active = button.dataset.tab === tab.id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    }

    this.bodyEl.innerHTML = tab.fields.map((field) => `
      <div class="creator-field" data-field="${field.key}">
        <h2>${field.label}</h2>
        ${field.colors ? this.swatchesHtml(field) : this.choicesHtml(field)}
      </div>`).join('');
    this.bodyEl.scrollTop = 0;
    this.pickerKey = null;
    this.thumbsDirty = true;
    this.refreshFields();
  }

  swatchesHtml({ key, colors, picker }: { key: keyof Look; colors: string[]; picker?: false }) {
    return `<div class="swatches">${colors.map((color) => `
      <button class="swatch${color === CLEAR_FRAME ? ' clear' : ''}" data-key="${key}" data-value="${color}"
        style="--swatch:${color}" aria-label="${color === CLEAR_FRAME ? 'Transparentes' : color}"></button>`).join('')}
      ${picker === false ? '' : `
      <button class="swatch swatch-picker" data-picker="${key}" aria-label="Autre couleur">
        <span class="swatch-badge">${icon('palette')}</span>
      </button>`}
    </div>`;
  }

  /** Opens the colour picker of field `key` under its swatches, starting from its colour, or closes it. */
  togglePicker(key: keyof Look) {
    this.pickerKey = this.pickerKey === key ? null : key;
    if (this.pickerKey) {
      this.picker.set(this.look[key]);
      this.bodyEl.querySelector(`[data-field="${key}"]`)!.append(this.picker.el);
    }
    this.refreshFields();
  }

  choicesHtml({ key, choices }: { key: keyof Look; choices: Option[] }) {
    return `<div class="choices">${choices.map(({ id, label }) => `
      <button class="choice" data-key="${key}" data-value="${id}">
        <canvas width="${THUMB_SIZE}" height="${THUMB_SIZE}"></canvas>
        <span>${label}</span>
      </button>`).join('')}
    </div>`;
  }

  /** Updates the selected state, conditional fields and thumbnails of the visible tab. */
  refreshFields() {
    for (const field of this.tab.fields) {
      const fieldEl = this.bodyEl.querySelector<HTMLElement>(`[data-field="${field.key}"]`)!;
      fieldEl.hidden = field.showIf ? !field.showIf(this.look) : false;
      for (const option of fieldEl.querySelectorAll<HTMLElement>('[data-value]')) {
        const selected = option.dataset.value === this.look[field.key];
        option.classList.toggle('selected', selected);
        option.setAttribute('aria-pressed', String(selected));
      }
      // A colour that isn't one of the swatches (picked, scanned, « Au hasard ») shows on the picker button.
      const pickerButton = fieldEl.querySelector<HTMLElement>('[data-picker]');
      if (pickerButton) {
        const custom = !field.colors!.includes(this.look[field.key]);
        pickerButton.classList.toggle('selected', custom);
        pickerButton.setAttribute('aria-pressed', String(custom));
        pickerButton.setAttribute('aria-expanded', String(this.pickerKey === field.key));
        pickerButton.style.setProperty('--swatch', custom ? this.look[field.key] : '');
      }
    }
    this.picker.el.hidden = !this.pickerKey;
    if (this.thumbsDirty) this.renderThumbs();
  }

  /** Queues the thumbnails of the visible tab; `tick()` draws a few per frame. */
  renderThumbs() {
    this.thumbsDirty = false;
    this.thumbQueue = [];
    for (const field of this.tab.fields) {
      if (!field.thumb) continue;
      const bare = field.thumb.bare ? { headwear: 'none', glasses: 'none' } : {};
      for (const option of this.bodyEl.querySelectorAll<HTMLElement>(`[data-key="${field.key}"]`)) {
        const look = { ...this.look, ...bare, [field.key]: option.dataset.value };
        this.thumbQueue.push([option.querySelector('canvas')!, look, field.thumb]);
      }
    }
  }
}
