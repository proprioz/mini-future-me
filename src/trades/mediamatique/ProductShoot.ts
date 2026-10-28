import { MiniGame } from '../../minigames/MiniGame.ts';
import { PRODUCT, BOTTLE, clampView, greenCanvas, greenScreenCanvas, productCanvas, drawChecker } from './artwork.ts';
import type { View } from './artwork.ts';
import { PALETTE as C } from '../../render/palette.ts';
import { sound } from '../../kiosk/sound.ts';
import { icon } from '../../ui/icons.ts';

// The viewfinder shows an 800 × 533 (3:2) window of the studio scene.
const VIEW_W = 800;
const VIEW_H = 533;
// Centre box of the viewfinder (view units): the whole bottle must end up inside it.
const BOX = { x: (VIEW_W - 340) / 2, y: (VIEW_H - 400) / 2, w: 340, h: 400 };
const SNAP = 60; // view units the bottle may stick out on release and still be pulled in
const STEP_DELAY = 700; // ms between a step done right and the next one
// Softbox power slider (0–100). The right power changes each round; one unit is 1/22 of a stop.
const LIGHT = { start: 12, min: 40, max: 75, close: 9, perStop: 22, dark: 0.12 };
// Focus ring slider (0–100): the picture gets sharper as it nears the right setting, different each round.
const FOCUS = { start: 8, min: 50, max: 92, close: 5, blurry: 40 }; // `blurry`: distance at full blur
const MAX_BLUR = 14; // px on the 1200-px canvas
const BLUR_LEVELS = 12;
// Keying: the green vanishes in a circle growing from the tap. The new backdrop comes at the retouch.
const KEY = { wipe: 0.7, end: 2200 };

type Phase = 'light' | 'frame' | 'focus' | 'key';

const LABELS: Record<Exclude<Phase, 'key'>, string> = { light: 'LUMIÈRE', frame: 'CADRAGE', focus: 'AF ●' };

/** 📷 Light the green screen set, frame the bottle, shoot it sharp, then key out the green. */
export class ProductShoot extends MiniGame {
  canvas!: HTMLCanvasElement;
  g!: CanvasRenderingContext2D;
  ui!: {
    viewfinder: HTMLElement;
    step: HTMLElement;
    text: HTMLElement;
    light: HTMLElement;
    switch: HTMLElement;
    slider: HTMLElement;
    power: HTMLInputElement;
    focus: HTMLElement;
    ring: HTMLInputElement;
    hint: HTMLElement;
    feedback: HTMLElement;
    button: HTMLElement;
    flash: HTMLElement;
  };
  view!: View;
  light!: { on: boolean; power: number; target: number };
  focus!: { value: number; target: number };
  frozen!: boolean;
  /** The green wiping away from the tap (canvas px), `t` seconds after it. */
  reveal!: { x: number; y: number; t: number } | null;
  phase!: Phase;
  blurred!: HTMLCanvasElement[];
  layers!: { checker: HTMLCanvasElement; green: HTMLCanvasElement; product: HTMLCanvasElement };
  productPixels!: ImageData;

  play(el: HTMLElement) {
    el.innerHTML = `
      <div class="mg-visual">
        <div class="mg-fit">
          <div class="shoot-viewfinder">
            <canvas width="1200" height="800"></canvas>
            <div class="shoot-flash"></div>
            <div class="mg-drag-hint" aria-hidden="true" hidden>${icon('hand-pointing')}</div>
          </div>
        </div>
      </div>
      <aside class="mg-side">
        <p class="mg-step"></p>
        <p class="mg-text"></p>
        <div class="shoot-light">
          <button class="btn btn-primary shoot-switch" aria-pressed="false">${icon('lightbulb')} <span>Allumer</span></button>
          <label class="mg-slider">
            <span>${icon('sun')} Puissance</span>
            <input type="range" min="0" max="100" step="1" value="${LIGHT.start}" disabled>
          </label>
        </div>
        <label class="mg-slider shoot-focus" hidden>
          <span>${icon('target')} Mise au point</span>
          <input type="range" min="0" max="100" step="1" value="${FOCUS.start}">
        </label>
        <p class="mg-feedback"></p>
        <div class="mg-actions"><button class="btn btn-primary" data-action="next" hidden>${icon('aperture')} Déclencher</button></div>
      </aside>`;
    this.canvas = el.querySelector('canvas')!;
    this.g = this.canvas.getContext('2d')!;
    this.ui = {
      viewfinder: el.querySelector<HTMLElement>('.shoot-viewfinder')!,
      step: el.querySelector<HTMLElement>('.mg-step')!,
      text: el.querySelector<HTMLElement>('.mg-text')!,
      light: el.querySelector<HTMLElement>('.shoot-light')!,
      switch: el.querySelector<HTMLElement>('.shoot-switch')!,
      slider: el.querySelector<HTMLElement>('.mg-slider')!,
      power: el.querySelector<HTMLInputElement>('.shoot-light input')!,
      focus: el.querySelector<HTMLElement>('.shoot-focus')!,
      ring: el.querySelector<HTMLInputElement>('.shoot-focus input')!,
      hint: el.querySelector<HTMLElement>('.mg-drag-hint')!,
      feedback: el.querySelector<HTMLElement>('.mg-feedback')!,
      button: el.querySelector<HTMLElement>('[data-action="next"]')!,
      flash: el.querySelector<HTMLElement>('.shoot-flash')!,
    };

    // The bottle starts low on the left, sticking out of the centre box: dragging up and to the right,
    // as the hint shows, brings it in.
    this.view = clampView({ x: PRODUCT.x - 160, y: PRODUCT.y - 450, w: VIEW_W, h: VIEW_H });
    this.light = { on: false, power: LIGHT.start, target: Math.round(LIGHT.min + Math.random() * (LIGHT.max - LIGHT.min)) };
    this.focus = { value: FOCUS.start, target: Math.round(FOCUS.min + Math.random() * (FOCUS.max - FOCUS.min)) };
    this.frozen = false;
    this.reveal = null;

    this.setPhase('light');
    this.ui.step.textContent = '1 · Éclairage';
    this.ui.text.innerHTML = 'Allume la <b>lumière</b>, puis règle sa puissance.';
    this.listen(this.ui.switch, 'click', () => this.toggleLight());
    this.listen(this.ui.power, 'input', () => {
      this.light.power = Number(this.ui.power.value);
      this.ui.slider.classList.toggle('ok', this.lightOk());
    });
    this.listen(this.ui.power, 'change', () => this.checkLight());
    this.listen(this.ui.ring, 'input', () => this.turnRing());
    this.listen(this.ui.button, 'click', () => this.shoot());
    this.listenPointer();
    this.loop((dt) => this.tick(dt));
  }

  setPhase(phase: Phase) {
    this.phase = phase;
    this.ui.viewfinder.dataset.phase = phase;
  }

  // ------------------------------------------------------------ 1 · light

  /** Exposure error in stops: negative is too dark. */
  exposure() {
    return (this.light.power - this.light.target) / LIGHT.perStop;
  }

  lightOk() {
    return this.light.on && Math.abs(this.light.power - this.light.target) <= LIGHT.close;
  }

  /** Brightness factor of the picture: the softbox is the only light on the set. */
  brightness() {
    return this.light.on ? 2 ** (this.exposure() * 0.55) : LIGHT.dark;
  }

  toggleLight() {
    this.light.on = !this.light.on;
    sound.play('tick');
    this.ui.switch.setAttribute('aria-pressed', String(this.light.on));
    this.ui.switch.querySelector('span')!.textContent = this.light.on ? 'Éteindre' : 'Allumer';
    this.ui.power.disabled = !this.light.on;
    this.ui.slider.classList.toggle('ok', this.lightOk());
    this.checkLight();
  }

  /** After a change of the light: right exposure → framing; otherwise which way to go. */
  checkLight() {
    if (this.phase !== 'light') return;
    if (!this.light.on) {
      this.feedback(this.ui.feedback, '', '');
      return;
    }
    if (this.lightOk()) {
      this.feedback(this.ui.feedback, `${icon('check')} Bien éclairé !`, 'ok');
      sound.play('pop');
      const { power } = this.light;
      // Unless the visitor moves the slider or switches off in the meantime.
      this.after(STEP_DELAY, () => this.light.on && this.light.power === power && this.startFrame());
      return;
    }
    this.feedback(this.ui.feedback, this.exposure() < 0 ? 'Trop sombre : plus de lumière.' : 'Trop clair : moins de lumière.', 'warn');
  }

  // ------------------------------------------------------------ 2 · framing

  startFrame() {
    if (this.phase !== 'light') return;
    this.setPhase('frame');
    this.ui.light.hidden = true;
    this.ui.step.textContent = '2 · Cadrage';
    this.ui.text.innerHTML = 'Glisse l’image : mets toute la <b>bouteille</b> dans le cadre.';
    this.ui.hint.hidden = false;
    this.feedback(this.ui.feedback, '', '');
  }

  listenPointer() {
    let drag: { id: number; start: { x: number; y: number }; x: number; y: number } | null = null;
    this.listen(this.canvas, 'pointerdown', (e) => {
      if (this.phase === 'focus') this.shoot();
      else if (this.phase === 'key') this.keyAt(this.canvasPoint(this.canvas, e));
      else if (this.phase === 'light' && !this.light.on) this.feedback(this.ui.feedback, 'Trop sombre : allume la lumière.', 'warn');
      if (this.phase !== 'frame') return;
      this.canvas.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, start: this.canvasPoint(this.canvas, e), x: this.view.x, y: this.view.y };
      this.ui.hint.hidden = true;
    });
    this.listen(this.canvas, 'pointermove', (e) => {
      if (drag?.id !== e.pointerId) return;
      const p = this.canvasPoint(this.canvas, e);
      const k = VIEW_W / this.canvas.width;
      // Dragging moves the picture, so the window moves the other way.
      this.view.x = drag.x - (p.x - drag.start.x) * k;
      this.view.y = drag.y - (p.y - drag.start.y) * k;
      clampView(this.view);
    });
    const release = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      drag = null;
      const { dx, dy } = this.bottleOffset();
      if (Math.hypot(dx, dy) <= SNAP) {
        this.view.x -= dx;
        this.view.y -= dy;
        clampView(this.view);
      }
      this.checkFraming();
    };
    this.listen(this.canvas, 'pointerup', release);
    this.listen(this.canvas, 'pointercancel', release);
  }

  /** How far (view units) the bottle must move right and down to sit inside the centre box. */
  bottleOffset() {
    const x = BOTTLE.x - this.view.x;
    const y = BOTTLE.y - this.view.y;
    return {
      dx: Math.max(0, BOX.x - x) - Math.max(0, x + BOTTLE.w - BOX.x - BOX.w),
      dy: Math.max(0, BOX.y - y) - Math.max(0, y + BOTTLE.h - BOX.y - BOX.h),
    };
  }

  framed() {
    const { dx, dy } = this.bottleOffset();
    return dx === 0 && dy === 0;
  }

  /** After a drag: bottle in the box → focus step; otherwise a hint. */
  checkFraming() {
    if (this.framed()) {
      this.feedback(this.ui.feedback, `${icon('check')} Dans le cadre !`, 'ok');
      sound.play('pop');
      const view = { ...this.view };
      // Unless the visitor drags it off again in the meantime.
      this.after(STEP_DELAY, () => view.x === this.view.x && view.y === this.view.y && this.startFocus());
      return;
    }
    this.feedback(this.ui.feedback, 'La bouteille dépasse encore.', 'warn');
  }

  // ------------------------------------------------------------ 3 · focus

  startFocus() {
    if (this.phase !== 'frame') return;
    this.setPhase('focus');
    this.blurred = this.renderBlurLevels();
    this.ui.step.textContent = '3 · Mise au point';
    this.ui.text.innerHTML = 'Règle la <b>mise au point</b> jusqu’à ce que l’image soit nette, puis déclenche.';
    this.ui.button.hidden = false;
    this.ui.focus.hidden = false;
    this.feedback(this.ui.feedback, '', '');
  }

  sharp() {
    return Math.abs(this.focus.value - this.focus.target) <= FOCUS.close;
  }

  turnRing() {
    this.focus.value = Number(this.ui.ring.value);
    const sharp = this.sharp();
    this.ui.focus.classList.toggle('ok', sharp);
    this.ui.button.classList.toggle('ready', sharp);
    if (sharp) this.feedback(this.ui.feedback, '', '');
  }

  /** The framed view at increasing blur, so turning the ring is just a drawImage per frame. */
  renderBlurLevels() {
    return Array.from({ length: BLUR_LEVELS }, (_, i) => this.viewLayer(greenScreenCanvas(), (i / (BLUR_LEVELS - 1)) * MAX_BLUR));
  }

  /** The framed view of a scene layer, as lit by the softbox, at the size of the viewfinder canvas. */
  viewLayer(source: CanvasImageSource, blur = 0) {
    const { width, height } = this.canvas;
    const margin = blur ? MAX_BLUR * 2 : 0; // draw past the edges so the blur doesn't fade them to transparent
    const k = width / VIEW_W;
    const layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    const g = layer.getContext('2d')!;
    g.filter = `brightness(${this.brightness()})${blur ? ` blur(${blur}px)` : ''}`;
    g.drawImage(source,
      this.view.x - margin / k, this.view.y - margin / k, VIEW_W + (margin * 2) / k, VIEW_H + (margin * 2) / k,
      -margin, -margin, width + margin * 2, height + margin * 2);
    return layer;
  }

  shoot() {
    if (this.frozen || this.phase !== 'focus') return;
    if (!this.sharp()) {
      this.feedback(this.ui.feedback, 'Encore flou : règle la mise au point.', 'warn');
      return;
    }
    this.frozen = true;
    sound.play('shutter');
    this.ui.flash.classList.remove('flash');
    void this.ui.flash.offsetWidth;
    this.ui.flash.classList.add('flash');
    this.ui.ring.disabled = true;
    this.ui.button.classList.remove('ready');
    this.feedback(this.ui.feedback, `${icon('check')} Nette !`, 'ok');
    this.after(1100, () => this.startKey());
  }

  // ------------------------------------------------------------ 4 · keying

  startKey() {
    this.setPhase('key');
    this.layers = {
      checker: this.checker(),
      green: this.viewLayer(greenCanvas()),
      product: this.viewLayer(productCanvas()),
    };
    // The alpha of the product layer tells a tap on the green from a tap on the bottle.
    const product = productCanvas();
    this.productPixels = product.getContext('2d')!.getImageData(0, 0, product.width, product.height);
    this.ui.step.textContent = '4 · Détourage';
    this.ui.text.innerHTML = `${icon('magic-wand')} Touche le <b>fond vert</b> pour l’effacer.`;
    this.ui.button.hidden = true;
    this.ui.focus.hidden = true;
    this.ui.hint.classList.add('tap');
    this.ui.hint.hidden = false;
    this.feedback(this.ui.feedback, '', '');
  }

  checker() {
    const { width, height } = this.canvas;
    const layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    drawChecker(layer.getContext('2d')!, 0, 0, width, height, 40);
    return layer;
  }

  keyAt(p: { x: number; y: number }) {
    if (this.reveal) return;
    const k = this.canvas.width / VIEW_W;
    const x = Math.floor(this.view.x + p.x / k);
    const y = Math.floor(this.view.y + p.y / k);
    const { data, width } = this.productPixels;
    if (data[(y * width + x) * 4 + 3] > 40) {
      this.feedback(this.ui.feedback, 'Ça, c’est la limonade : touche le vert !', 'warn');
      return;
    }
    sound.play('sparkle');
    this.ui.hint.hidden = true;
    this.reveal = { x: p.x, y: p.y, t: 0 };
    this.after(KEY.wipe * 1000, () => this.feedback(this.ui.feedback, `${icon('check')} Fond effacé !`, 'ok'));
    this.after(KEY.end, () => this.end(true));
  }

  // ------------------------------------------------------------ drawing

  tick(dt: number) {
    if (this.reveal) this.reveal.t += dt;
    this.draw();
  }

  draw() {
    const { g } = this;
    const { width, height } = this.canvas;
    const k = width / VIEW_W;

    if (this.phase === 'key') {
      this.drawKeyed();
      return;
    }
    if (this.phase === 'focus') {
      const off = Math.max(0, Math.abs(this.focus.value - this.focus.target) - FOCUS.close / 2);
      const level = Math.round(Math.min(1, off / FOCUS.blurry) * (BLUR_LEVELS - 1));
      g.drawImage(this.blurred[level], 0, 0);
    } else {
      g.filter = `brightness(${this.brightness()})`;
      g.drawImage(greenScreenCanvas(), this.view.x, this.view.y, VIEW_W, VIEW_H, 0, 0, width, height);
      g.filter = 'none';
    }

    // Centre box, the rest of the frame a little dimmed while framing.
    if (this.phase !== 'light') {
      const ok = this.framed();
      if (this.phase === 'frame') {
        g.fillStyle = 'rgba(30, 58, 76, 0.28)';
        g.beginPath();
        g.rect(0, 0, width, height);
        g.rect(BOX.x * k, BOX.y * k, BOX.w * k, BOX.h * k);
        g.fill('evenodd');
      }
      g.strokeStyle = ok ? C.teal : 'rgba(255, 255, 255, 0.95)';
      g.lineWidth = ok ? 8 : 5;
      g.setLineDash(ok ? [] : [24, 14]);
      g.strokeRect(BOX.x * k, BOX.y * k, BOX.w * k, BOX.h * k);
      g.setLineDash([]);
    }

    // Autofocus box on the label during the focus step.
    if (this.phase === 'focus') {
      const sharp = this.sharp();
      const x = (PRODUCT.x - this.view.x) * k;
      const y = (PRODUCT.y - this.view.y) * k;
      g.strokeStyle = sharp ? '#3ee68a' : 'rgba(255, 255, 255, 0.9)';
      g.lineWidth = 5;
      g.strokeRect(x - 90, y - 70, 180, 140);
    }

    // Camera info strip, with the exposure meter in the middle.
    g.fillStyle = 'rgba(30, 58, 76, 0.55)';
    g.fillRect(0, height - 46, width, 46);
    g.fillStyle = '#fff';
    g.font = '800 22px "Nunito Variable"';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('ISO 100   f/8   1/125 s', 24, height - 23);
    g.textAlign = 'right';
    g.fillText(LABELS[this.phase], width - 24, height - 23);
    this.drawMeter(width / 2, height - 23);
  }

  /** The camera's exposure meter: −2 … 0 … +2 stops, with a marker on the current exposure. */
  drawMeter(cx: number, cy: number) {
    const { g } = this;
    const step = 22;
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.fillText('−', cx - step * 6, cy);
    g.fillText('+', cx + step * 6, cy);
    for (let i = -8; i <= 8; i++) {
      const tall = i % 4 === 0;
      g.fillRect(cx + (i * step) / 2 - 1.5, cy - (tall ? 8 : 4), 3, tall ? 16 : 8);
    }
    const ev = this.light.on ? Math.max(-2, Math.min(2, this.exposure())) : -2;
    // Off, the marker blinks at the dark end, like a camera with no light.
    if (!this.light.on && Math.floor(performance.now() / 400) % 2) return;
    const x = cx + ev * step * 2;
    g.fillStyle = this.lightOk() ? '#3ee68a' : C.sun;
    g.beginPath();
    g.moveTo(x, cy + 4);
    g.lineTo(x - 9, cy - 12);
    g.lineTo(x + 9, cy - 12);
    g.fill();
  }

  /** The shot being keyed: the green wipes away from the tap, leaving the product on the checkerboard. */
  drawKeyed() {
    const { g } = this;
    const { width, height } = this.canvas;
    const { checker, green, product } = this.layers;
    g.drawImage(checker, 0, 0);
    const t = this.reveal?.t ?? 0;
    const wipe = Math.min(1, t / KEY.wipe);
    if (wipe < 1) {
      const { x, y } = this.reveal ?? { x: 0, y: 0 };
      const r = (1 - (1 - wipe) ** 2) * Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
      g.save();
      g.beginPath();
      g.rect(0, 0, width, height);
      if (r > 0) g.arc(x, y, r, 0, Math.PI * 2);
      g.clip('evenodd');
      g.drawImage(green, 0, 0);
      g.restore();
      if (r > 0) {
        g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        g.lineWidth = 10;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.drawImage(product, 0, 0);
  }
}
