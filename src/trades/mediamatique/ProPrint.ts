import { MiniGame } from '../../minigames/MiniGame.ts';
import { icon } from '../../ui/icons.ts';
import { drawDesign, DEFAULT_DESIGN } from './PosterLayout.ts';
import type { Design } from './PosterLayout.ts';

type SettingKey = 'format' | 'color' | 'dpi' | 'bleed';

interface Setting {
  key: SettingKey;
  label: string;
  correct: string;
  options: { value: string; label: string; size?: string; info: string }[];
}

const SETTINGS: Setting[] = [
  {
    key: 'format', label: 'Format', correct: 'A3',
    options: [
      { value: 'A5', label: 'A5', size: '148 × 210 mm', info: 'A5 : taille d’un flyer, trop petit.' },
      { value: 'A4', label: 'A4', size: '210 × 297 mm', info: 'A4 : une feuille classique.' },
      { value: 'A3', label: 'A3', size: '297 × 420 mm', info: 'A3 : deux A4, pour une vitrine.' },
    ],
  },
  {
    key: 'color', label: 'Couleurs', correct: 'cmyk',
    options: [
      { value: 'rgb', label: 'RVB', info: 'RVB : les couleurs de l’écran, ternes sur papier.' },
      { value: 'cmyk', label: 'CMJN', info: 'CMJN : les 4 encres de l’imprimeur.' },
    ],
  },
  {
    key: 'dpi', label: 'Résolution', correct: '300',
    options: [
      { value: '72', label: '72 dpi', info: '72 dpi : on voit les pixels.' },
      { value: '150', label: '150 dpi', info: '150 dpi : un peu flou de près.' },
      { value: '300', label: '300 dpi', info: '300 dpi : net, qualité impression.' },
    ],
  },
  {
    key: 'bleed', label: 'Fonds perdus', correct: 'yes',
    options: [
      { value: 'no', label: 'Sans', info: 'Sans : un filet blanc peut rester au bord.' },
      { value: 'yes', label: '3 mm', info: '3 mm en plus, coupés ensuite : aucun bord blanc.' },
    ],
  },
];

const MISTAKES: Record<SettingKey, string> = {
  format: 'Il fallait des affiches <b>A3</b>.',
  color: 'Couleurs ternes : il fallait du <b>CMJN</b>.',
  dpi: 'Image floue : il fallait <b>300 dpi</b>.',
  bleed: 'Bords blancs : il fallait des <b>fonds perdus</b>.',
};

// Relative printed size of each format (A3 = 1): each step halves the area.
const FORMAT_SCALE: Record<string, number> = { A5: 0.5, A4: Math.SQRT1_2, A3: 1 };
const PAGE = { w: 420, h: 594 }; // A3 preview, in canvas px
const PIXELS: Record<string, number> = { 72: 0.1, 150: 0.3, 300: 1 }; // fraction of the full resolution

/** 🖨️ Set up the print job (format, CMYK, 300 dpi, bleed) for the client's A3 posters. */
export class ProPrint extends MiniGame {
  values!: Record<SettingKey, string>;
  printing!: boolean;
  canvas!: HTMLCanvasElement;
  ui!: { sheet: HTMLElement; size: HTMLElement; info: HTMLElement; button: HTMLButtonElement };
  poster!: HTMLCanvasElement;
  lowRes!: HTMLCanvasElement;
  segs!: NodeListOf<HTMLElement>;

  play(el: HTMLElement) {
    // On "Réessayer", keep the previous settings so only the mistakes need fixing.
    this.values ??= { format: 'A4', color: 'rgb', dpi: '72', bleed: 'no' };
    this.printing = false;

    el.innerHTML = `
      <div class="mg-visual print-visual">
        <div class="print-table">
          <div class="print-sheet"><canvas width="${PAGE.w}" height="${PAGE.h}"></canvas></div>
        </div>
        <div class="print-caption"><span class="print-size"></span></div>
      </div>
      <aside class="mg-side">
        ${SETTINGS.map((s) => `
          <div class="mg-field">
            <span class="mg-field-label">${s.label}</span>
            <div class="mg-seg" data-key="${s.key}">
              ${s.options.map((o) => `<button class="mg-seg-option" data-value="${o.value}">${o.label}</button>`).join('')}
            </div>
          </div>`).join('')}
        <p class="print-info"></p>
        <div class="mg-actions"><button class="btn btn-primary" data-action="print">${icon('printer')} Imprimer</button></div>
      </aside>`;

    this.canvas = el.querySelector('canvas')!;
    this.ui = {
      sheet: el.querySelector<HTMLElement>('.print-sheet')!,
      size: el.querySelector<HTMLElement>('.print-size')!,
      info: el.querySelector<HTMLElement>('.print-info')!,
      button: el.querySelector<HTMLButtonElement>('[data-action="print"]')!,
    };
    // The visitor's own poster at full resolution (a ready-made one if the layout order has not been
    // played yet), downsampled per dpi setting in draw().
    this.poster = document.createElement('canvas');
    this.poster.width = PAGE.w * 2;
    this.poster.height = PAGE.h * 2;
    drawDesign(this.poster.getContext('2d')!, this.poster.width, this.poster.height, (this.results.layout as Design | undefined) ?? DEFAULT_DESIGN);
    this.lowRes = document.createElement('canvas');

    for (const seg of el.querySelectorAll<HTMLElement>('.mg-seg')) {
      this.listen(seg, 'click', (e) => {
        const option = (e.target as Element).closest<HTMLElement>('.mg-seg-option');
        if (!option || this.printing) return;
        this.values[seg.dataset.key as SettingKey] = option.dataset.value!;
        const setting = SETTINGS.find((s) => s.key === seg.dataset.key)!;
        this.ui.info.innerHTML = setting.options.find((o) => o.value === option.dataset.value)!.info;
        this.update();
      });
    }
    this.segs = el.querySelectorAll<HTMLElement>('.mg-seg');
    this.listen(this.ui.button, 'click', () => this.print());
    this.update();
  }

  update() {
    for (const seg of this.segs) {
      for (const option of seg.children as HTMLCollectionOf<HTMLElement>) {
        option.classList.toggle('selected', this.values[seg.dataset.key as SettingKey] === option.dataset.value);
      }
    }
    const scale = FORMAT_SCALE[this.values.format];
    this.ui.sheet.style.setProperty('--scale', String(scale));
    const format = SETTINGS[0].options.find((o) => o.value === this.values.format)!;
    this.ui.size.textContent = `${format.label} · ${format.size}`;
    this.draw();
  }

  /** The poster as it would come out of the press with the current settings. */
  draw() {
    const { values, canvas } = this;
    const g = canvas.getContext('2d')!;
    const { width, height } = canvas;

    // Low resolution: shrink, then blow back up without smoothing so the pixels show.
    const k = PIXELS[values.dpi];
    let source = this.poster;
    if (k < 1) {
      this.lowRes.width = Math.round(width * k);
      this.lowRes.height = Math.round(height * k);
      this.lowRes.getContext('2d')!.drawImage(this.poster, 0, 0, this.lowRes.width, this.lowRes.height);
      source = this.lowRes;
    }
    g.imageSmoothingEnabled = values.dpi !== '72';
    // RGB colours sent to a CMYK press come out dull.
    g.filter = values.color === 'rgb' ? 'saturate(0.45) brightness(0.92) contrast(0.9)' : 'none';
    g.drawImage(source, 0, 0, width, height);
    g.filter = 'none';

    // Without bleed the cut drifts a little and leaves white slivers on two sides.
    if (values.bleed === 'no') {
      g.fillStyle = '#fff';
      g.fillRect(width - 9, 0, 9, height);
      g.fillRect(0, height - 7, width, 7);
    }
  }

  print() {
    if (this.printing) return;
    this.printing = true;
    this.ui.button.disabled = true;
    this.ui.sheet.classList.remove('printed');
    void this.ui.sheet.offsetWidth;
    this.ui.sheet.classList.add('printed');

    const wrong = SETTINGS.filter((s) => this.values[s.key] !== s.correct);
    this.after(1700, () => {
      if (!wrong.length) {
        this.end(true);
        return;
      }
      this.end(false, `<ul class="mg-list">${wrong.map((s) => `<li>${MISTAKES[s.key]}</li>`).join('')}</ul>`);
    });
  }
}
