import { hexToRgb, rgbToHex } from '../scan/color.ts';
import { icon } from './icons.ts';

/** Hue 0-360, saturation and value 0-1. */
type Hsv = [number, number, number];

function hexToHsv(hex: string): Hsv {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const v = Math.max(r, g, b);
  const d = v - Math.min(r, g, b);
  const h = d === 0 ? 0 : v === r ? ((g - b) / d + 6) % 6 : v === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, v ? d / v : 0, v];
}

function hsvToHex([h, s, v]: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return 255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return rgbToHex([f(5), f(3), f(1)]);
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));

/**
 * A simple colour picker for a touch screen: a square (saturation × brightness) over a hue bar, both
 * dragged with a finger, and « Avancé » for typing a hex code. `onPick(hex, done)` follows the finger;
 * `done` once it is lifted, or once the code has its six digits.
 */
export class ColorPicker {
  el: HTMLDivElement;
  hsv: Hsv;
  hexInput: HTMLInputElement;

  constructor(onPick: (hex: string, done: boolean) => void) {
    this.hsv = [0, 0, 0];
    this.el = document.createElement('div');
    this.el.className = 'color-picker';
    this.el.innerHTML = `
      <div class="picker-square" data-axis="square"><span class="picker-knob"></span></div>
      <div class="picker-hue" data-axis="hue"><span class="picker-knob"></span></div>
      <div class="picker-advanced">
        <button class="picker-advanced-toggle" aria-expanded="false">${icon('code')} Avancé</button>
        <label class="picker-hex" hidden>#<input aria-label="Code hexadécimal" placeholder="1F1612" autocomplete="off"
          autocapitalize="characters" spellcheck="false"></label>
      </div>`;

    const toggle = this.el.querySelector<HTMLElement>('.picker-advanced-toggle')!;
    const hexField = this.el.querySelector<HTMLElement>('.picker-hex')!;
    this.hexInput = hexField.querySelector('input')!;
    toggle.addEventListener('click', () => {
      hexField.hidden = !hexField.hidden;
      toggle.setAttribute('aria-expanded', String(!hexField.hidden));
      if (!hexField.hidden) this.hexInput.focus();
    });
    // The « # » is already there: a pasted « # », spaces or anything else but hex digits go, in capitals.
    this.hexInput.addEventListener('focus', () => this.hexInput.select());
    this.hexInput.addEventListener('input', () => {
      const code = this.hexInput.value.replace(/[^0-9a-f]/gi, '').toUpperCase().slice(0, 6);
      if (this.hexInput.value !== code) this.hexInput.value = code;
      if (code.length < 6) return;
      const hex = `#${code.toLowerCase()}`;
      this.set(hex);
      onPick(hex, true);
    });
    this.hexInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.hexInput.blur();
    });

    for (const area of this.el.querySelectorAll<HTMLElement>('[data-axis]')) {
      const move = (e: PointerEvent) => {
        const box = area.getBoundingClientRect();
        const x = clamp((e.clientX - box.left) / box.width);
        if (area.dataset.axis === 'hue') this.hsv[0] = x * 360;
        else this.hsv = [this.hsv[0], x, 1 - clamp((e.clientY - box.top) / box.height)];
        this.draw();
        onPick(hsvToHex(this.hsv), false);
      };
      area.addEventListener('pointerdown', (e) => {
        area.setPointerCapture(e.pointerId);
        move(e);
      });
      area.addEventListener('pointermove', (e) => {
        if (area.hasPointerCapture(e.pointerId)) move(e);
      });
      area.addEventListener('lostpointercapture', () => onPick(hsvToHex(this.hsv), true));
    }
  }

  /** Starts from colour `hex`. */
  set(hex: string) {
    this.hsv = hexToHsv(hex);
    this.draw(hex);
  }

  /** Places the knobs; `hex`: the colour itself, when known exactly. */
  draw(hex = hsvToHex(this.hsv)) {
    const [h, s, v] = this.hsv;
    this.el.style.setProperty('--hue', String(h));
    this.el.style.setProperty('--picked', hex);
    const [squareKnob, hueKnob] = this.el.querySelectorAll<HTMLElement>('.picker-knob');
    squareKnob.style.left = `${s * 100}%`;
    squareKnob.style.top = `${(1 - v) * 100}%`;
    hueKnob.style.left = `${(h / 360) * 100}%`;
    // The code follows the square and the bar, except while it is being typed.
    if (document.activeElement !== this.hexInput) this.hexInput.value = hex.slice(1).toUpperCase();
  }
}
