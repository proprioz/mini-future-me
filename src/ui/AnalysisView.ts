import { CLASSES } from '../scan/masks.ts';
import { SLOTS } from './PhotoSlots.ts';
import { PALETTE } from '../render/palette.ts';
import { icon, drawIcon } from './icons.ts';
import type { MaskView, Point, Box } from '../scan/masks.ts';
import type { SlotName } from './PhotoSlots.ts';
import type { IconName } from './iconPaths.ts';
import type { Look } from '../character/Character.ts';

// Timeline of the analysis animation (ms).
const SCAN_TIME = 1100; // scan line sweeping a photo and revealing the segmentation
const FINDING_TIME = 1100; // one finding: marks drawn, then its label
const MARK_GROW = 450;

// Segmentation colours shown over the photos.
const CLASS_COLORS: Record<number, number[]> = {
  [CLASSES.hair]: [255, 101, 132],
  [CLASSES.face]: [255, 200, 61],
  [CLASSES.body]: [255, 200, 61],
  [CLASSES.clothes]: [90, 169, 255],
  [CLASSES.accessory]: [169, 139, 255],
};
const INK = PALETTE.ink;
// Scanner green-blue: reads as "machine vision" over any photo.
const ACCENT = '#3ee6cf';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** An analysed photo: scaled down, with its class mask. */
export interface AnalysedView extends MaskView {
  canvas: HTMLCanvasElement;
}

/** What a finding points at on its photo, in fractions of the photo; `on: false` draws it greyed. */
export type FindingMark = { on?: boolean } & (
  | { type: 'mask'; cls: number }
  | { type: 'box'; box: Box }
  | { type: 'line'; from: Point; to: Point }
  | { type: 'dots'; points: Point[]; big?: boolean }
);

/** One thing the scan found, replayed during the animation; `final` ones use every photo. */
export interface Finding {
  view: SlotName;
  icon: IconName;
  title: string;
  value: string;
  color?: string;
  patch?: Partial<Look>;
  final?: boolean;
  marks: FindingMark[];
}

/** What play() replays: the analysed photos and the findings. */
export interface AnalysisReplay {
  views: Partial<Record<SlotName, AnalysedView>>;
  findings: Finding[];
}

type TimedMark = FindingMark & { born: number };

interface Label {
  finding: Finding;
  born: number;
  anchor: Point;
}

interface Card {
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  view?: AnalysedView | null;
  scan: number;
  marks: TimedMark[];
  overlay?: HTMLCanvasElement | null;
  highlights: Record<number, HTMLCanvasElement>;
  backdrop: HTMLCanvasElement | null;
  label?: Label | null;
}

/** Where drawMark() draws on a card: `at` turns photo fractions into canvas pixels. */
interface MarkFrame {
  at: (point: Point) => Point;
  ox: number;
  oy: number;
  pw: number;
  ph: number;
  px: number;
  card: Card;
}

/** Coloured overlay of the classes of `view` (only `cls` if given), as a canvas the size of the view. */
function maskCanvas(view: MaskView, cls?: number) {
  const canvas = document.createElement('canvas');
  canvas.width = view.width;
  canvas.height = view.height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(view.width, view.height);
  for (let i = 0; i < view.mask.length; i++) {
    const c = view.mask[i];
    const color = (cls === undefined || c === cls) && CLASS_COLORS[c];
    if (!color) continue;
    image.data.set([...color, cls === undefined ? 130 : 190], i * 4);
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * The photo blurred and darkened over a whole `w` × `h` card ("cover"): it fills the sides the sharp
 * photo leaves when its shape differs from the card's (portrait photo, wide screen).
 */
function backdropCanvas(source: HTMLCanvasElement, w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // A bit larger than the card, so the blur doesn't fade out at the edges.
  const scale = Math.max(w / source.width, h / source.height) * 1.15;
  const sw = source.width * scale;
  const sh = source.height * scale;
  ctx.filter = `blur(${Math.round(Math.max(w, h) / 40)}px)`;
  ctx.drawImage(source, (w - sw) / 2, (h - sh) / 2, sw, sh);
  ctx.filter = 'none';
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

/**
 * Shows the analysed photos and replays what the analyzer found, one finding at a time.
 * `play()` resolves at the end; `skip()` jumps to the end at once.
 */
export class AnalysisView {
  el: HTMLDivElement;
  cards: Record<SlotName, Card>;
  running: boolean;
  views!: AnalysisReplay['views'] | null;
  skipping!: boolean;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'analysis';
    this.el.innerHTML = SLOTS.map((slot) => `
      <figure class="analysis-card" data-view="${slot.name}">
        <canvas></canvas>
        <figcaption>${icon(slot.icon)} ${slot.label}</figcaption>
      </figure>`).join('');
    root.appendChild(this.el);
    this.cards = Object.fromEntries([...this.el.querySelectorAll<HTMLElement>('.analysis-card')].map((el) => [el.dataset.view, {
      el, canvas: el.querySelector('canvas')!,
    }])) as Record<SlotName, Card>;
    this.running = false;
  }

  async play({ views, findings }: AnalysisReplay, onFinding: (finding: Finding) => void) {
    this.views = views;
    this.skipping = false;
    for (const [name, card] of Object.entries(this.cards)) {
      const view = views[name as SlotName];
      card.el.classList.toggle('empty', !view);
      card.el.classList.remove('active', 'seen');
      Object.assign(card, { view, scan: 0, marks: [], overlay: view && maskCanvas(view), highlights: {}, backdrop: null });
    }
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    for (const slot of SLOTS) {
      const card = this.cards[slot.name];
      if (!card.view) continue;
      this.focus(slot.name);
      await this.animate((t) => {
        card.scan = t;
      }, SCAN_TIME);
      for (const finding of findings.filter((f) => f.view === slot.name && !f.final)) {
        this.show(card, finding);
        onFinding(finding);
        await this.wait(FINDING_TIME);
      }
      card.el.classList.add('seen');
    }

    // Final decisions (hair style) use every photo.
    this.focus(null);
    for (const finding of findings.filter((f) => f.final)) {
      onFinding(finding);
      await this.wait(FINDING_TIME);
    }
    this.skipping = true;
    this.draw();
    this.running = false;
  }

  /** Jumps to the end of the animation (the `play()` promise then resolves quickly). */
  skip() {
    this.skipping = true;
  }

  async wait(ms: number) {
    if (!this.skipping) await sleep(ms);
  }

  async animate(step: (t: number) => void, duration: number) {
    const start = performance.now();
    while (!this.skipping) {
      const t = (performance.now() - start) / duration;
      step(Math.min(1, t));
      if (t >= 1) return;
      await sleep(16);
    }
    step(1);
  }

  focus(name: SlotName | null) {
    for (const [key, card] of Object.entries(this.cards)) card.el.classList.toggle('active', key === name);
  }

  show(card: Card, finding: Finding) {
    const born = performance.now();
    for (const mark of finding.marks) {
      if (mark.type === 'mask' && !card.highlights[mark.cls]) card.highlights[mark.cls] = maskCanvas(card.view!, mark.cls);
      card.marks.push({ ...mark, born });
    }
    // Only the latest finding keeps its label; older marks stay, faded.
    card.label = { finding, born, anchor: this.anchor(finding.marks) };
  }

  /** Where to put a finding's label: above its first box / line / points. */
  anchor(marks: FindingMark[]): Point {
    for (const mark of marks) {
      if (mark.type === 'box') return [mark.box[0], mark.box[1]];
      if (mark.type === 'line') return mark.from;
      if (mark.type === 'dots' && mark.points.length) {
        return [Math.min(...mark.points.map((p) => p[0])), Math.min(...mark.points.map((p) => p[1]))];
      }
    }
    return [0.05, 0.08];
  }

  draw() {
    const now = performance.now();
    const dpr = Math.min(window.devicePixelRatio, 2);
    // Lines and labels follow the size of the interface (rem), which grows with the screen.
    const px = (dpr * parseFloat(getComputedStyle(document.documentElement).fontSize)) / 16;
    for (const card of Object.values(this.cards)) {
      if (!card.view) continue;
      const { canvas, view } = card;
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h) continue;
      if (canvas.width !== w || canvas.height !== h) Object.assign(canvas, { width: w, height: h });
      if (card.backdrop?.width !== w || card.backdrop?.height !== h) card.backdrop = backdropCanvas(view.canvas, w, h);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(card.backdrop!, 0, 0);

      // Photo fitted inside the card ("contain"); marks use fractions of the photo.
      const scale = Math.min(w / view.width, h / view.height);
      const pw = view.width * scale;
      const ph = view.height * scale;
      const ox = (w - pw) / 2;
      const oy = (h - ph) / 2;
      const at = ([x, y]: Point): Point => [ox + x * pw, oy + y * ph];
      ctx.drawImage(view.canvas, ox, oy, pw, ph);

      // Segmentation revealed under the scan line, until the findings take over.
      const lineY = card.scan * ph;
      if (card.scan > 0 && !card.marks.length) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(ox, oy, pw, lineY);
        ctx.clip();
        ctx.globalAlpha = 0.8;
        ctx.drawImage(card.overlay!, ox, oy, pw, ph);
        ctx.restore();
        if (card.scan < 1) {
          const glow = ctx.createLinearGradient(0, oy + lineY - 30 * px, 0, oy + lineY);
          glow.addColorStop(0, 'rgba(62, 230, 207, 0)');
          glow.addColorStop(1, 'rgba(62, 230, 207, 0.6)');
          ctx.fillStyle = glow;
          ctx.fillRect(ox, oy + lineY - 30 * px, pw, 30 * px);
          ctx.fillStyle = ACCENT;
          ctx.fillRect(ox, oy + lineY - 2 * px, pw, 3 * px);
        }
      }

      for (const mark of card.marks) {
        const t = this.skipping ? 1 : ease((now - mark.born) / MARK_GROW);
        const latest = !this.skipping && card.label && mark.born === card.label.born;
        // Coloured areas only show while their finding is on screen, so the photo stays visible.
        if (mark.type === 'mask' && !latest) continue;
        ctx.globalAlpha = mark.type === 'mask' ? 0.6 : latest || this.skipping ? 1 : 0.45;
        this.drawMark(ctx, mark, t, { at, ox, oy, pw, ph, px, card });
      }
      ctx.globalAlpha = 1;
      if (card.label && !this.skipping) this.drawLabel(ctx, card.label, { at, px, w, h, now });
    }
  }

  drawMark(ctx: CanvasRenderingContext2D, mark: TimedMark, t: number, { at, ox, oy, pw, ph, px, card }: MarkFrame) {
    ctx.lineWidth = 2.5 * px;
    ctx.strokeStyle = mark.on === false ? 'rgba(255, 255, 255, 0.8)' : ACCENT;
    ctx.fillStyle = ctx.strokeStyle;
    switch (mark.type) {
      case 'mask': {
        const layer = card.highlights[mark.cls];
        ctx.save();
        ctx.globalAlpha *= t;
        ctx.drawImage(layer, ox, oy, pw, ph);
        ctx.restore();
        break;
      }
      case 'box': {
        const [x0, y0] = at([mark.box[0], mark.box[1]]);
        const [x1, y1] = at([mark.box[2], mark.box[3]]);
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const bw = (x1 - x0) * (0.6 + 0.4 * t);
        const bh = (y1 - y0) * (0.6 + 0.4 * t);
        ctx.setLineDash([6 * px, 4 * px]);
        ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
        ctx.setLineDash([]);
        break;
      }
      case 'line': {
        const [x0, y0] = at(mark.from);
        const [x1, y1] = at(mark.to);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
        ctx.stroke();
        for (const [x, y] of [[x0, y0], [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]]) {
          ctx.beginPath();
          ctx.moveTo(x - 6 * px, y);
          ctx.lineTo(x + 6 * px, y);
          ctx.stroke();
        }
        break;
      }
      case 'dots': {
        const shown = Math.ceil(mark.points.length * t);
        const r = (mark.big ? 4 : 1.6) * px;
        if (!mark.big) ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        for (const point of mark.points.slice(0, shown)) {
          const [x, y] = at(point);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          if (mark.big) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5 * px;
            ctx.stroke();
          }
        }
        break;
      }
      default:
    }
  }

  drawLabel(ctx: CanvasRenderingContext2D, { finding, born, anchor }: Label,
    { at, px, w, h, now }: { at: MarkFrame['at']; px: number; w: number; h: number; now: number }) {
    const t = ease((now - born - MARK_GROW * 0.6) / 300);
    if (t <= 0) return;
    const text = `${finding.title} : ${finding.value}`;
    ctx.font = `800 ${13 * px}px 'Nunito Variable', ui-rounded, system-ui, sans-serif`;
    const tw = ctx.measureText(text).width;
    const pad = 8 * px;
    const iconSize = 16 * px;
    const gap = 5 * px;
    const bw = iconSize + gap + tw + pad * 2;
    const bh = 26 * px;
    const [ax, ay] = at(anchor);
    const x = Math.min(w - bw - 4 * px, Math.max(4 * px, ax));
    const y = Math.min(h - bh - 4 * px, Math.max(4 * px, ay - bh - 6 * px)) + (1 - t) * 8 * px;
    ctx.globalAlpha = t;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, bh / 2);
    ctx.fill();
    drawIcon(ctx, finding.icon, x + pad, y + (bh - iconSize) / 2, iconSize, { ink: PALETTE.paper, tint: ACCENT });
    ctx.fillStyle = PALETTE.paper;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + pad + iconSize + gap, y + bh / 2);
    ctx.globalAlpha = 1;
  }

  /** Forgets the photos (they only live in memory during the analysis). */
  clear() {
    this.running = false;
    for (const card of Object.values(this.cards)) {
      if (card.backdrop) card.backdrop.width = 0;
      Object.assign(card, { view: null, overlay: null, marks: [], highlights: {}, label: null, backdrop: null });
      card.canvas.width = 0;
    }
    this.views = null;
  }
}
