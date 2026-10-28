import { sound } from '../kiosk/sound.ts';
import { icon } from './icons.ts';
import { skillBadge, skillById, skillProgress } from '../game/skills.ts';
import { trade } from '../trades/current.ts';
import type { IconName } from './iconPaths.ts';
import type { IsoStage } from '../game/IsoStage.ts';

/** The big button at the bottom; `go`: HTML. */
export interface Mission {
  icon: IconName;
  title: string;
  go: string;
  onClick: () => void;
}

export type HudAction = 'look' | 'poster';

// Zoom factor and turn (radians) of one press on a view button.
const ZOOM_STEP = 1.35;
const TURN_STEP = Math.PI / 18;

/** DOM overlay: title, the domains won, the current mission and toast messages. */
export class Hud {
  el: HTMLDivElement;
  skillsEl: HTMLElement;
  toastEl: HTMLElement;
  toastTimer: ReturnType<typeof setTimeout> | null;
  missionEl: HTMLButtonElement;
  mission?: Mission | null;
  viewEl: HTMLElement;
  viewButtons: Record<string, HTMLButtonElement>;
  soundButton: HTMLButtonElement;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <header class="hud-bar">
        <div class="hud-group">
          <button class="hud-pill hud-button" data-action="look" hidden>${icon('user-circle')} Mon perso</button>
          <button class="hud-pill hud-button" data-action="poster" hidden>${icon('image')} Mon affiche</button>
        </div>
        <div class="hud-group">
          <div class="hud-view" hidden>
            <button class="hud-pill hud-button" data-view="turn-left" aria-label="Tourner vers la gauche">${icon('arrow-counter-clockwise')}</button>
            <button class="hud-pill hud-button" data-view="turn-right" aria-label="Tourner vers la droite">${icon('arrow-clockwise')}</button>
            <button class="hud-pill hud-button" data-view="zoom-out" aria-label="Dézoomer">${icon('magnifying-glass-minus')}</button>
            <button class="hud-pill hud-button" data-view="zoom-in" aria-label="Zoomer">${icon('magnifying-glass-plus')}</button>
          </div>
          <button class="hud-pill hud-button hud-sound" data-action="sound"></button>
          <div class="hud-pill hud-skills" role="list" aria-label="Domaines du métier"></div>
        </div>
      </header>
      <button class="hud-mission" hidden>
        <span class="hud-mission-icon"></span>
        <span class="hud-mission-text"><b></b></span>
        <span class="hud-mission-go"></span>
      </button>
      <div class="hud-pill hud-toast" role="status"></div>
    `;
    root.appendChild(this.el);

    this.skillsEl = this.el.querySelector<HTMLElement>('.hud-skills')!;
    this.skillsEl.innerHTML = trade().skills.map((skill) =>
      `<button class="hud-skill" role="listitem" data-skill="${skill.id}" title="${skill.label}">${skillBadge(skill, 0)}</button>`).join('');
    // Touching a badge names its domain: the pictogram alone does not say it.
    this.skillsEl.addEventListener('click', (e) => {
      const skill = skillById((e.target as Element).closest<HTMLElement>('[data-skill]')?.dataset.skill);
      if (skill) this.toast(`${icon(skill.icon)} ${skill.label}`);
    });
    this.toastEl = this.el.querySelector<HTMLElement>('.hud-toast')!;
    this.toastTimer = null;

    this.missionEl = this.el.querySelector<HTMLButtonElement>('.hud-mission')!;
    this.missionEl.addEventListener('click', () => this.mission?.onClick());

    this.viewEl = this.el.querySelector<HTMLElement>('.hud-view')!;
    this.viewButtons = Object.fromEntries([...this.viewEl.querySelectorAll<HTMLButtonElement>('[data-view]')].map((b) => [b.dataset.view, b]));

    this.soundButton = this.el.querySelector<HTMLButtonElement>('[data-action="sound"]')!;
    this.soundButton.addEventListener('click', () => {
      sound.setMuted(!sound.muted);
      this.updateSoundButton();
    });
    this.updateSoundButton();
  }

  updateSoundButton() {
    this.soundButton.innerHTML = icon(sound.muted ? 'speaker-slash' : 'speaker-high');
    this.soundButton.setAttribute('aria-label', sound.muted ? 'Remettre le son' : 'Couper le son');
  }

  /** Shows a button ('look' or 'poster'), which calls `onClick` when pressed. */
  onAction(action: HudAction, onClick: () => void) {
    const button = this.el.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
    button.hidden = false;
    button.addEventListener('click', onClick);
  }

  /** Shows the view buttons, which call `zoom(factor)` and `turn(angle)` (clockwise on screen). */
  onView({ zoom, turn }: { zoom: (factor: number) => void; turn: (angle: number) => void }) {
    this.viewEl.hidden = false;
    const actions: Record<string, () => void> = {
      'turn-left': () => turn(-TURN_STEP),
      'turn-right': () => turn(TURN_STEP),
      'zoom-out': () => zoom(1 / ZOOM_STEP),
      'zoom-in': () => zoom(ZOOM_STEP),
    };
    for (const [name, button] of Object.entries(this.viewButtons)) button.addEventListener('click', actions[name]);
  }

  /** Greys out the view buttons that have reached their limit (`stage`: an IsoStage). */
  setViewLimits(stage: IsoStage) {
    this.viewButtons['turn-left'].disabled = !stage.canTurn(-1);
    this.viewButtons['turn-right'].disabled = !stage.canTurn(1);
    this.viewButtons['zoom-out'].disabled = !stage.canZoomOut;
    this.viewButtons['zoom-in'].disabled = !stage.canZoomIn;
  }

  /** Same as pressing the button. */
  trigger(action: HudAction) {
    this.el.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  }

  /** Makes a button pulse, to show the next step. */
  highlight(action: HudAction, on = true) {
    this.el.querySelector(`[data-action="${action}"]`)!.classList.toggle('pulse', on);
  }

  /** The big "what to do now" button at the bottom: `{ icon, title, go (HTML), onClick }`. */
  setMission(mission: Mission | null) {
    this.mission = mission;
    this.missionEl.hidden = !mission;
    if (!mission) return;
    this.missionEl.querySelector('.hud-mission-icon')!.innerHTML = icon(mission.icon);
    this.missionEl.querySelector('b')!.textContent = mission.title;
    this.missionEl.querySelector('.hud-mission-go')!.innerHTML = mission.go;
  }

  /** Shows how far each domain is, from the ids of the tasks done: rings fill, won domains pop in. */
  setSkills(done: Set<string>) {
    for (const skill of trade().skills) {
      const button = this.skillsEl.querySelector(`[data-skill="${skill.id}"]`)!;
      const badge = button.firstElementChild as HTMLElement;
      const progress = skillProgress(skill, done);
      const won = progress === 1;
      badge.classList.toggle('new', won && !badge.classList.contains('on'));
      badge.classList.toggle('on', won);
      badge.style.setProperty('--progress', String(progress));
      const count = Math.round(progress * skill.tasks.length);
      button.setAttribute('aria-label', `${skill.label} : ${won ? 'gagné' : `${count} sur ${skill.tasks.length}`}`);
    }
  }

  /** `html`: a short message, with icons. */
  toast(html: string, duration = 2800) {
    this.toastEl.innerHTML = html;
    this.toastEl.classList.add('visible');
    clearTimeout(this.toastTimer!); // null: a no-op
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('visible'), duration);
  }
}
