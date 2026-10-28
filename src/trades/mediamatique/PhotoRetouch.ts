import { MiniGame } from '../../minigames/MiniGame.ts';
import { icon } from '../../ui/icons.ts';
import { sound } from '../../kiosk/sound.ts';
import type { IconName } from '../../ui/iconPaths.ts';
import { SCENE, PRODUCT, BACKDROPS, backdropCanvas, productCanvas, setBackdrop, clampView, drawChecker } from './artwork.ts';

const MAX_ZOOM = 2;
const TARGET_ZOOM = 1.6;
// Window centre for the crop: at TARGET_ZOOM the bottle sits on the right third.
const CROP_CENTER = {
  x: PRODUCT.x - (SCENE.w / TARGET_ZOOM) * (2 / 3 - 1 / 2),
  y: PRODUCT.y - (SCENE.h / TARGET_ZOOM) * 0.05,
};
const WIN_SCORE = 90;
const TOLERANCE = 120; // slider units at which a setting scores 0 %
// A setting this close gets its check mark; with all three checked, the score is above WIN_SCORE.
const CLOSE = 10;

type Setting = 'light' | 'contrast' | 'crop';

const SLIDERS: { key: Setting; icon: IconName; label: string; min: number; max: number }[] = [
  { key: 'light', icon: 'sun', label: 'Luminosité', min: -100, max: 100 },
  { key: 'contrast', icon: 'circle-half', label: 'Contraste', min: -100, max: 100 },
  { key: 'crop', icon: 'crop', label: 'Recadrage', min: 0, max: 100 },
];

const HINTS: Record<Setting, [string, string]> = {
  light: ['Encore trop sombre.', 'Trop clair.'],
  contrast: ['Trop gris : plus de contraste.', 'Trop de contraste.'],
  crop: ['Recadre plus serré.', 'Trop zoomé.'],
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * 💻 Put the keyed-out product on a backdrop of the visitor's choice, then fix the dull, too-dark photo
 * with brightness, contrast and crop until it matches the reference. The backdrop is kept for the campaign.
 */
export class PhotoRetouch extends MiniGame {
  target!: Record<Setting, number>;
  defects!: { light: number; contrast: number };
  values!: Record<Setting, number>;
  backdrop!: string | null;
  ref!: HTMLCanvasElement;
  work!: HTMLCanvasElement;
  ui!: {
    bar: HTMLElement;
    score: HTMLElement;
    feedback: HTMLElement;
    sliders: NodeListOf<HTMLElement>;
    done: HTMLElement;
    backdrops: NodeListOf<HTMLElement>;
  };

  play(el: HTMLElement) {
    // The camera got it a bit dark and flat: each defect is a factor, each slider undoes it on a log scale.
    const darkness = rand(0.55, 0.7);
    const flatness = rand(0.55, 0.72);
    this.target = {
      light: Math.round(-100 * Math.log2(darkness)),
      contrast: Math.round(-100 * Math.log2(flatness)),
      crop: Math.round(((TARGET_ZOOM - 1) / (MAX_ZOOM - 1)) * 100),
    };
    this.defects = { light: darkness, contrast: flatness };
    this.values = { light: 0, contrast: 0, crop: 0 };
    this.backdrop = null; // fresh from the shoot: no backdrop yet

    el.innerHTML = `
      <div class="mg-visual retouch-visual">
        <figure class="retouch-ref">
          <canvas width="480" height="300"></canvas>
          <figcaption>Modèle</figcaption>
        </figure>
        <figure class="retouch-work">
          <div class="mg-fit"><canvas width="960" height="600"></canvas></div>
          <figcaption>Ta photo</figcaption>
        </figure>
      </div>
      <aside class="mg-side">
        <p class="mg-text">Choisis un <b>fond</b>, puis règle ta photo comme le <b>modèle</b>.</p>
        <div class="retouch-backdrops" role="group" aria-label="Fond">
          ${BACKDROPS.map((b) => `
            <button class="retouch-backdrop" data-id="${b.id}" aria-label="${b.label}" aria-pressed="false">
              <canvas width="160" height="100"></canvas>
            </button>`).join('')}
        </div>
        ${SLIDERS.map((s) => `
          <label class="mg-slider" data-key="${s.key}">
            <span>${icon(s.icon)} ${s.label}</span>
            <input type="range" min="${s.min}" max="${s.max}" step="1" value="0" data-key="${s.key}">
          </label>`).join('')}
        <div class="retouch-meter">
          <span>Ressemblance</span>
          <div class="retouch-bar"><span></span></div>
          <b class="retouch-score"></b>
        </div>
        <p class="mg-feedback"></p>
        <div class="mg-actions"><button class="btn btn-primary" data-action="done">Valider</button></div>
      </aside>`;

    const [ref, work] = el.querySelectorAll<HTMLCanvasElement>('.retouch-visual canvas');
    this.ref = ref;
    this.work = work;
    this.ui = {
      bar: el.querySelector<HTMLElement>('.retouch-bar span')!,
      score: el.querySelector<HTMLElement>('.retouch-score')!,
      feedback: el.querySelector<HTMLElement>('.mg-feedback')!,
      sliders: el.querySelectorAll<HTMLElement>('.mg-slider'),
      done: el.querySelector<HTMLElement>('[data-action="done"]')!,
      backdrops: el.querySelectorAll<HTMLElement>('.retouch-backdrop'),
    };
    this.renderReference();

    for (const button of this.ui.backdrops) {
      const thumb = button.querySelector('canvas')!;
      thumb.getContext('2d')!.drawImage(backdropCanvas(button.dataset.id), 0, 0, thumb.width, thumb.height);
      this.listen(button, 'click', () => this.pickBackdrop(button.dataset.id!));
    }

    for (const input of el.querySelectorAll<HTMLInputElement>('input[type="range"]')) {
      this.listen(input, 'input', () => {
        this.values[input.dataset.key as Setting] = Number(input.value);
        this.ui.feedback.textContent = '';
        this.update();
      });
    }
    this.listen(this.ui.done, 'click', () => this.validate());
    this.update();
  }

  pickBackdrop(id: string) {
    this.backdrop = id;
    sound.play('tap');
    for (const button of this.ui.backdrops) button.setAttribute('aria-pressed', String(button.dataset.id === id));
    this.ui.feedback.textContent = '';
    this.renderReference();
    this.update();
  }

  renderReference() {
    this.render(this.ref, { light: 1, contrast: 1, zoom: TARGET_ZOOM });
  }

  /**
   * Draws the photo with the given brightness / contrast factors and zoom: the product on the chosen
   * backdrop, or on the transparency checkerboard while there is none.
   */
  render(canvas: HTMLCanvasElement, { light, contrast, zoom }: { light: number; contrast: number; zoom: number }) {
    const g = canvas.getContext('2d')!;
    const w = SCENE.w / zoom;
    const h = SCENE.h / zoom;
    const view = clampView({ x: CROP_CENTER.x - w / 2, y: CROP_CENTER.y - h / 2, w, h });
    const draw = (source: CanvasImageSource) => g.drawImage(source, view.x, view.y, view.w, view.h, 0, 0, canvas.width, canvas.height);
    if (!this.backdrop) drawChecker(g, 0, 0, canvas.width, canvas.height, canvas.width / 30);
    g.filter = `brightness(${light}) contrast(${contrast})`;
    if (this.backdrop) draw(backdropCanvas(this.backdrop));
    draw(productCanvas());
    g.filter = 'none';
  }

  update() {
    const { light, contrast, crop } = this.values;
    this.render(this.work, {
      light: this.defects.light * 2 ** (light / 100),
      contrast: this.defects.contrast * 2 ** (contrast / 100),
      zoom: 1 + (crop / 100) * (MAX_ZOOM - 1),
    });
    const score = this.score();
    this.ui.bar.style.width = `${score}%`;
    this.ui.bar.classList.toggle('good', score >= WIN_SCORE);
    this.ui.score.textContent = `${score} %`;
    for (const slider of this.ui.sliders) {
      const { key } = slider.dataset;
      slider.classList.toggle('ok', Math.abs(this.values[key as Setting] - this.target[key as Setting]) <= CLOSE);
    }
    this.ui.done.classList.toggle('ready', score >= WIN_SCORE && this.backdrop !== null);
  }

  score() {
    const keys = Object.keys(this.target) as Setting[];
    const total = keys.reduce((sum, key) =>
      sum + Math.max(0, 1 - Math.abs(this.values[key] - this.target[key]) / TOLERANCE), 0);
    return Math.round((total / keys.length) * 100);
  }

  validate() {
    if (!this.backdrop) {
      this.feedback(this.ui.feedback, 'Choisis d’abord un fond.', 'warn');
      return;
    }
    const score = this.score();
    if (score >= WIN_SCORE) {
      setBackdrop(this.backdrop);
      this.end(true);
      return;
    }
    // Point at the setting that is the furthest off.
    const key = (Object.keys(this.target) as Setting[]).reduce((a, b) =>
      Math.abs(this.values[a] - this.target[a]) > Math.abs(this.values[b] - this.target[b]) ? a : b);
    const [tooLow, tooHigh] = HINTS[key];
    this.feedback(this.ui.feedback, `${score} % sur ${WIN_SCORE}. ${this.values[key] < this.target[key] ? tooLow : tooHigh}`, 'warn');
  }
}
