import { MiniGame } from '../../minigames/MiniGame.ts';
import { drawStudioView, productView } from './artwork.ts';
import { PALETTE as C } from '../../render/palette.ts';

// Layout zones on the poster, in % of its width / height. Empty ones show as dashed guides.
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type SlotId = 'top' | 'middle' | 'bottomLeft' | 'bottomRight';
export type ElementId = 'image' | 'logo' | 'title' | 'infos';

/** The visitor's poster: where each element is, the background and the text colour. */
export interface Design {
  slots: Partial<Record<ElementId, SlotId>>;
  background: string;
  ink: string;
}

interface Rule {
  text: string;
  hint: string;
  test: (s: Design) => boolean;
}

/** A press on a tray element, which becomes a drag once it moves past TAP_SLOP. */
interface Drag {
  id: number;
  x: number;
  y: number;
  ghost: HTMLElement | null;
  dx?: number;
  dy?: number;
}

const TAP_SLOP = 8; // px: a press that moves less is a tap (pick the element, then tap its place)
const SLOTS: Record<SlotId, Box> = {
  top: { x: 8, y: 5, w: 84, h: 17 },
  middle: { x: 8, y: 25, w: 84, h: 52 },
  bottomLeft: { x: 8, y: 80, w: 40, h: 15 },
  bottomRight: { x: 52, y: 80, w: 40, h: 15 },
};

const PHOTO = { w: 420, h: 300 };
const ELEMENTS: { id: ElementId; label: string; html: string }[] = [
  { id: 'image', label: 'Photo', html: `<canvas width="${PHOTO.w}" height="${PHOTO.h}"></canvas>` },
  { id: 'logo', label: 'Logo', html: '<span class="pe-logo"><b>P</b></span>' },
  { id: 'title', label: 'Titre', html: '<span class="pe-title">PÉTILLE</span>' },
  { id: 'infos', label: 'Infos', html: '<span class="pe-infos">Dès le 1er juin<br>dans tes magasins</span>' },
];

const BACKGROUNDS = [C.sun, C.teal, C.paper, C.ink];
const INKS = [C.paper, C.ink, C.coral];
const MIN_CONTRAST = 3; // WCAG minimum for large text

const isBottom = (slot?: SlotId) => slot === 'bottomLeft' || slot === 'bottomRight';

const RULES: Rule[] = [
  {
    text: 'Titre en haut',
    hint: 'Le titre va en haut : on le lit en premier.',
    test: (s) => s.slots.title === 'top',
  },
  {
    text: 'Photo en grand',
    hint: 'La photo mérite la plus grande place.',
    test: (s) => s.slots.image === 'middle',
  },
  {
    text: 'Logo en bas',
    hint: 'Le logo va en bas, comme une signature.',
    test: (s) => isBottom(s.slots.logo),
  },
  {
    text: 'Infos sur l’affiche',
    hint: 'Il manque les infos.',
    test: (s) => Boolean(s.slots.infos),
  },
  {
    text: 'Texte lisible',
    hint: 'Le texte ne se lit pas : change une couleur.',
    test: (s) => contrastRatio(s.background, s.ink) >= MIN_CONTRAST,
  },
];

/** WCAG contrast ratio between two '#rrggbb' colours. */
function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, bl] = [0, 2, 4].map((i) => {
      const c = parseInt(hex.slice(1 + i, 3 + i), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * 🎨 Drag title, photo, logo and infos onto the poster, and pick readable colours. Once won, `result`
 * holds the visitor's poster ({ slots, background, ink }), for `drawDesign()`.
 */
export class PosterLayout extends MiniGame {
  declare result: Design;
  state!: Design;
  tray!: HTMLElement;
  poster!: HTMLElement;
  ui!: { rules: HTMLElement[]; feedback: HTMLElement };
  items!: Record<ElementId, HTMLElement>;
  swatches!: NodeListOf<HTMLElement>;
  picked!: ElementId | null;

  play(el: HTMLElement) {
    // Starts with white text on yellow: pretty, but unreadable from across the street.
    this.state = { slots: {}, background: C.sun, ink: C.paper };

    el.innerHTML = `
      <div class="mg-visual layout-visual">
        <div class="layout-tray" aria-label="Éléments à placer"></div>
        <div class="layout-stage">
          <div class="poster">
            ${Object.keys(SLOTS).map((id) => `<div class="poster-slot" data-slot="${id}"></div>`).join('')}
          </div>
        </div>
      </div>
      <aside class="mg-side">
        <p class="mg-text">Glisse chaque élément sur l’affiche.</p>
        <div class="layout-colors">
          <span>Fond</span>
          <div class="layout-swatches" data-key="background">
            ${BACKGROUNDS.map((c) => `<button class="layout-swatch" style="--c: ${c}" data-color="${c}" aria-label="Fond ${c}"></button>`).join('')}
          </div>
          <span>Texte</span>
          <div class="layout-swatches" data-key="ink">
            ${INKS.map((c) => `<button class="layout-swatch" style="--c: ${c}" data-color="${c}" aria-label="Texte ${c}"></button>`).join('')}
          </div>
        </div>
        <ul class="layout-rules">${RULES.map((r) => `<li>${r.text}</li>`).join('')}</ul>
        <p class="mg-feedback"></p>
        <div class="mg-actions"><button class="btn btn-primary" data-action="done">Envoyer</button></div>
      </aside>`;

    this.tray = el.querySelector<HTMLElement>('.layout-tray')!;
    this.poster = el.querySelector<HTMLElement>('.poster')!;
    this.ui = {
      rules: [...el.querySelectorAll<HTMLElement>('.layout-rules li')],
      feedback: el.querySelector<HTMLElement>('.mg-feedback')!,
    };
    for (const slot of this.poster.querySelectorAll<HTMLElement>('.poster-slot')) {
      Object.assign(slot.style, rect(SLOTS[slot.dataset.slot as SlotId]));
    }

    this.items = {} as Record<ElementId, HTMLElement>;
    for (const def of ELEMENTS) {
      const item = document.createElement('div');
      item.className = `poster-el pe-${def.id}-box`;
      item.dataset.el = def.id;
      item.innerHTML = `${def.html}<small class="pe-label">${def.label}</small>`;
      this.tray.appendChild(item);
      this.items[def.id] = item;
      this.listenDrag(item);
    }
    drawPhoto(this.items.image.querySelector('canvas')!);

    for (const group of el.querySelectorAll<HTMLElement>('.layout-swatches')) {
      this.listen(group, 'click', (e) => {
        const swatch = (e.target as Element).closest<HTMLElement>('.layout-swatch');
        if (!swatch) return;
        this.state[group.dataset.key as 'background' | 'ink'] = swatch.dataset.color!;
        this.update();
      });
    }
    this.swatches = el.querySelectorAll<HTMLElement>('.layout-swatch');
    this.listen(el.querySelector('[data-action="done"]')!, 'click', () => this.validate());

    // Tap-to-place, for those who find dragging hard: a tap on a picked element's destination.
    this.picked = null;
    this.listen(this.poster, 'click', (e) => {
      if (this.picked && !(e.target as Element).closest('.poster-el')) this.place(this.picked, this.slotAt(e));
    });
    this.listen(this.tray, 'click', (e) => {
      if (this.picked && !(e.target as Element).closest('.poster-el')) this.place(this.picked, null);
    });
    this.update();
  }

  listenDrag(item: HTMLElement) {
    let drag: Drag | null = null;
    this.listen(item, 'pointerdown', (e) => {
      e.preventDefault();
      item.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, ghost: null };
    });
    this.listen(item, 'pointermove', (e) => {
      if (drag?.id !== e.pointerId) return;
      if (!drag.ghost) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < TAP_SLOP) return;
        this.startGhost(item, drag);
      }
      this.moveGhost(drag, e);
      this.highlightSlot(this.slotAt(e));
    });
    const release = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      const { ghost } = drag;
      drag = null;
      if (!ghost) {
        if (e.type === 'pointerup') this.tap(item.dataset.el as ElementId);
        return;
      }
      ghost.remove();
      item.classList.remove('dragging');
      this.poster.classList.remove('show-guides');
      this.highlightSlot(null);
      this.place(item.dataset.el as ElementId, e.type === 'pointerup' ? this.slotAt(e) : this.state.slots[item.dataset.el as ElementId]);
    };
    this.listen(item, 'pointerup', release);
    this.listen(item, 'pointercancel', release);
  }

  startGhost(item: HTMLElement, drag: Drag) {
    const box = item.getBoundingClientRect();
    const ghost = item.cloneNode(true) as HTMLElement;
    ghost.classList.add('poster-ghost');
    // Clone the photo pixels too: cloneNode copies the canvas element, not its drawing.
    ghost.querySelector('canvas')?.getContext('2d')!.drawImage(item.querySelector('canvas')!, 0, 0);
    Object.assign(ghost.style, { width: `${box.width}px`, height: `${box.height}px` });
    this.el.appendChild(ghost);
    Object.assign(drag, { ghost, dx: drag.x - box.left, dy: drag.y - box.top });
    item.classList.add('dragging');
    this.poster.classList.add('show-guides');
    this.pick(null);
  }

  /** A tap on an element picks it; with another one picked, a tap on a placed element takes its place. */
  tap(id: ElementId) {
    if (this.picked && this.picked !== id && this.state.slots[id]) this.place(this.picked, this.state.slots[id]);
    else this.pick(this.picked === id ? null : id);
  }

  pick(id: ElementId | null) {
    this.picked = id;
    for (const [key, item] of Object.entries(this.items)) item.classList.toggle('picked', key === id);
    this.poster.classList.toggle('show-guides', Boolean(id));
  }

  moveGhost(drag: Drag, e: PointerEvent) {
    drag.ghost!.style.transform = `translate(${e.clientX - drag.dx!}px, ${e.clientY - drag.dy!}px)`;
  }

  /** Slot under the pointer, or the nearest one when the pointer is on the poster; null off the poster. */
  slotAt(e: { clientX: number; clientY: number }): SlotId | null {
    const box = this.poster.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 100;
    const y = ((e.clientY - box.top) / box.height) * 100;
    if (x < -4 || x > 104 || y < -4 || y > 104) return null;
    let best: SlotId | null = null;
    let bestDistance = Infinity;
    for (const [id, s] of Object.entries(SLOTS)) {
      const dx = Math.max(s.x - x, 0, x - (s.x + s.w));
      const dy = Math.max(s.y - y, 0, y - (s.y + s.h));
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        best = id as SlotId;
        bestDistance = distance;
      }
    }
    return best;
  }

  highlightSlot(id: SlotId | null) {
    for (const slot of this.poster.querySelectorAll<HTMLElement>('.poster-slot')) {
      slot.classList.toggle('hover', slot.dataset.slot === id);
    }
  }

  /** Puts element `id` in `slot` (null = back to the tray). Whatever was there swaps places with it. */
  place(id: ElementId, slot: SlotId | null | undefined) {
    const { slots } = this.state;
    const from = slots[id] ?? null;
    const other = slot && (Object.keys(slots) as ElementId[]).find((key) => slots[key] === slot && key !== id);
    if (other) {
      if (from) slots[other] = from;
      else delete slots[other];
    }
    if (slot) slots[id] = slot;
    else delete slots[id];
    this.pick(null);
    this.update();
  }

  update() {
    const { slots, background, ink } = this.state;
    for (const [id, item] of Object.entries(this.items)) {
      const slot = slots[id as ElementId];
      if (slot) {
        this.poster.appendChild(item);
        Object.assign(item.style, rect(SLOTS[slot]));
      } else {
        this.tray.appendChild(item);
        item.removeAttribute('style');
      }
    }
    for (const slot of this.poster.querySelectorAll<HTMLElement>('.poster-slot')) {
      slot.classList.toggle('filled', Object.values(slots).includes(slot.dataset.slot as SlotId));
    }
    this.poster.style.setProperty('--bg', background);
    this.poster.style.setProperty('--ink', ink);
    for (const swatch of this.swatches) {
      const key = swatch.parentElement!.dataset.key as 'background' | 'ink';
      swatch.classList.toggle('selected', this.state[key] === swatch.dataset.color);
    }
    RULES.forEach((rule, i) => this.ui.rules[i].classList.toggle('ok', rule.test(this.state)));
    this.ui.feedback.textContent = '';
  }

  validate() {
    const missing = ELEMENTS.filter((def) => !this.state.slots[def.id]);
    if (missing.length) {
      this.feedback(this.ui.feedback, `Il manque : ${missing.map((def) => def.label.toLowerCase()).join(', ')}.`, 'warn');
      return;
    }
    const broken = RULES.find((rule) => !rule.test(this.state));
    if (broken) {
      this.feedback(this.ui.feedback, broken.hint, 'warn');
      return;
    }
    const { slots, background, ink } = this.state;
    this.result = { slots: { ...slots }, background, ink };
    this.end(true);
  }
}

function rect({ x, y, w, h }: Box) {
  return { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` };
}

/** The campaign photo as the layout shows it (a canvas of PHOTO size). */
function drawPhoto(canvas: HTMLCanvasElement) {
  drawStudioView(canvas.getContext('2d')!, productView(canvas.width / canvas.height, 0.75), 0, 0, canvas.width, canvas.height);
}

/** A poster that follows every rule, for the tasks after this one when it has not been played yet. */
export const DEFAULT_DESIGN: Design = {
  slots: { title: 'top', image: 'middle', logo: 'bottomLeft', infos: 'bottomRight' },
  background: C.sun,
  ink: C.ink,
};

/** The visitor's poster in a new canvas, `width` px wide (A-format, like the game's). */
export function designCanvas(design: Design, width = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(width * Math.SQRT2);
  drawDesign(canvas.getContext('2d')!, canvas.width, canvas.height, design);
  return canvas;
}

/**
 * Draws the visitor's poster (`result` of the game) to fill (w, h), as the game showed it: the same
 * zones, sizes and colours as the HTML poster and its CSS (.poster, .pe-* in style.css).
 */
export function drawDesign(g: CanvasRenderingContext2D, w: number, h: number, { slots, background, ink }: Design) {
  g.fillStyle = background;
  g.fillRect(0, 0, w, h);
  for (const [id, slot] of Object.entries(slots)) {
    const box = SLOTS[slot];
    const x = (box.x / 100) * w;
    const y = (box.y / 100) * h;
    const bw = (box.w / 100) * w;
    const bh = (box.h / 100) * h;
    DRAW[id as ElementId](g, x, y, bw, bh, ink);
  }
}

const DRAW: Record<ElementId, (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ink: string) => void> = {
  // Photo with a white border, cropped to fill its zone (object-fit: cover).
  image(g, x, y, w, h) {
    const photo = document.createElement('canvas');
    Object.assign(photo, { width: PHOTO.w, height: PHOTO.h });
    drawPhoto(photo);
    const border = 0.015 * w;
    const radius = 0.032 * w;
    g.fillStyle = C.paper;
    g.beginPath();
    g.roundRect(x, y, w, h, radius);
    g.fill();
    const inner = { x: x + border, y: y + border, w: w - 2 * border, h: h - 2 * border };
    const scale = Math.max(inner.w / PHOTO.w, inner.h / PHOTO.h);
    const sw = inner.w / scale;
    const sh = inner.h / scale;
    g.save();
    g.beginPath();
    g.roundRect(inner.x, inner.y, inner.w, inner.h, Math.max(radius - border, 0));
    g.clip();
    g.drawImage(photo, (PHOTO.w - sw) / 2, (PHOTO.h - sh) / 2, sw, sh, inner.x, inner.y, inner.w, inner.h);
    g.restore();
  },
  title(g, x, y, w, h, ink) {
    g.fillStyle = ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${Math.min(0.7 * h, 0.19 * w)}px "Fredoka Variable"`;
    g.fillText('PÉTILLE', x + w / 2, y + h * 0.54);
  },
  infos(g, x, y, w, h, ink) {
    const size = Math.min(0.24 * h, 0.095 * w);
    g.fillStyle = ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 ${size}px "Nunito Variable"`;
    g.fillText('Dès le 1er juin', x + w / 2, y + h / 2 - size * 0.6);
    g.fillText('dans tes magasins', x + w / 2, y + h / 2 + size * 0.6);
  },
  logo(g, x, y, w, h) {
    const r = 0.45 * h;
    g.fillStyle = C.coral;
    g.beginPath();
    g.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = C.paper;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${0.55 * h}px "Fredoka Variable"`;
    g.fillText('P', x + w / 2, y + h * 0.53);
  },
};
