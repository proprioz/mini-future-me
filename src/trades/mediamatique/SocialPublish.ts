import { MiniGame } from '../../minigames/MiniGame.ts';
import { drawStudioView, productView } from './artwork.ts';
import { drawDesign, DEFAULT_DESIGN } from './PosterLayout.ts';
import { PALETTE as C } from '../../render/palette.ts';
import { icon, drawIcon } from '../../ui/icons.ts';
import { sound } from '../../kiosk/sound.ts';
import type { Design } from './PosterLayout.ts';
import type { IconName } from '../../ui/iconPaths.ts';

type SupportId = 'site' | 'mail' | 'poster' | 'tiktok' | 'insta' | 'youtube';

interface Support {
  id: SupportId;
  group: string;
  icon: IconName;
  name: string;
  aspect: number;
  care: string[];
  specs: [string, string][];
}

type Mockup = (g: CanvasRenderingContext2D, w: number, h: number, design: Design) => void;

const GROUPS: Record<string, string> = { web: 'Web', social: 'Réseaux sociaux', print: 'Imprimé' };

// Where the campaign goes. `aspect` is the mock-up's (device included). `care`: what to watch for in
// the picture so the poster works well on that support, shown while choosing; `specs`: the file's
// settings, each with why, shown once the format is made (the two bubbles never say the same thing). The first spec is the format,
// highlighted. The array order is the grid order.
const SUPPORTS: Support[] = [
  {
    id: 'site', group: 'web', icon: 'browser', name: 'Site web', aspect: 1.6,
    care: [
      'Seuls le titre et la photo y tiennent : les infos passent dans la page, sous la bannière.',
      'Sur un téléphone, elle se recadre : garde la bouteille et le titre loin des bords.',
    ],
    specs: [
      ['Bannière 3:1', 'Large et basse, elle tient en haut de l’écran sans cacher la page.'],
      ['1920 × 640 px', 'La largeur d’un écran d’ordinateur : nette même en grand.'],
      ['WebP léger', 'Un fichier léger s’affiche vite, même sur un téléphone.'],
    ],
  },
  {
    id: 'mail', group: 'web', icon: 'envelope-simple', name: 'Newsletter', aspect: 0.78,
    care: [
      'L’image est petite dans un e-mail : le titre doit rester lisible en petit.',
      'Certaines messageries cachent les images : la date et le lieu s’écrivent aussi dans le texte.',
    ],
    specs: [
      ['600 px de large', 'La largeur que toutes les messageries affichent sans couper.'],
      ['JPG léger', 'Un e-mail trop lourd s’ouvre lentement.'],
      ['Bouton cliquable', 'Il mène au site : c’est là qu’on veut amener le lecteur.'],
    ],
  },
  {
    id: 'poster', group: 'print', icon: 'printer', name: 'Affiche', aspect: 0.75,
    care: [
      'Peu de mots et un gros titre : on la lit en passant, en 3 secondes.',
      'Le texte à 5 mm du bord au moins : la coupe n’est jamais tout à fait droite.',
    ],
    specs: [
      ['A3', 'Assez grande pour être vue de loin dans une vitrine.'],
      ['CMJN · 300 dpi', 'Les 4 encres de l’imprimeur, et assez de points pour une image nette.'],
      ['Fonds perdus 3 mm', 'On imprime un peu plus grand puis on coupe : aucun bord blanc.'],
    ],
  },
  {
    id: 'tiktok', group: 'social', icon: 'tiktok-logo', name: 'Vidéo TikTok', aspect: 0.584,
    care: [
      'Plus haut que l’affiche : on agrandit le fond, sans jamais étirer l’image.',
      'Le bas et le côté droit restent libres : les boutons et la légende de l’appli s’y posent.',
    ],
    specs: [
      ['9:16', 'Le téléphone tenu droit : la vidéo remplit tout l’écran.'],
      ['1080 × 1920 px', 'La taille d’un écran de téléphone : net, sans fichier trop lourd.'],
      ['MP4 · 15 s', 'Une vidéo courte : on la regarde jusqu’au bout.'],
    ],
  },
  {
    id: 'insta', group: 'social', icon: 'instagram-logo', name: 'Post Instagram', aspect: 0.64,
    care: [
      'Dans le fil, l’image est petite : un gros titre et une photo simple se voient mieux.',
      'La grille du profil coupe le haut et le bas : l’essentiel reste au centre.',
    ],
    specs: [
      ['4:5', 'Un peu plus haut qu’un carré : le post prend plus de place dans le fil.'],
      ['1080 × 1350 px', 'La taille qu’Instagram affiche : plus grand, il le réduirait.'],
      ['JPG · sRGB', 'Les couleurs des écrans : l’appli les montre telles quelles.'],
    ],
  },
  {
    id: 'youtube', group: 'social', icon: 'youtube-logo', name: 'Vidéo YouTube', aspect: 1.45,
    care: [
      'L’affiche est verticale, l’écran horizontal : le titre et la photo se placent côte à côte.',
      'La miniature s’affiche en tout petit : un titre gros et bien contrasté.',
    ],
    specs: [
      ['16:9', 'Le format des écrans d’ordinateur et de télé : la vidéo les remplit.'],
      ['1920 × 1080 px', 'La Full HD : nette en plein écran.'],
      ['Vidéo MP4', 'Le format vidéo que tous les appareils savent lire.'],
    ],
  },
];

const FLY_TIME = 700; // ms for a copy of the visual to reach its support
const FLY_GAP = 250; // ms between two copies

/** 📱 Pick where the campaign goes, then watch the one visual turn into each support's format. */
export class SocialPublish extends MiniGame {
  chosen!: Set<string>;
  diffused!: boolean;
  design!: Design;
  ui!: {
    stage: HTMLElement;
    master: HTMLCanvasElement;
    cells: HTMLElement[];
    toggles: HTMLButtonElement[];
    feedback: HTMLElement;
    button: HTMLButtonElement;
  };

  play(el: HTMLElement) {
    this.chosen = new Set<string>();
    this.diffused = false;
    // The visitor's own poster; a ready-made one if the layout order has not been played yet.
    this.design = (this.results.layout as Design | undefined) ?? DEFAULT_DESIGN;

    el.innerHTML = `
      <div class="mg-visual">
        <div class="mg-fit">
          <div class="pub-stage">
            ${SUPPORTS.map((s) => `
              <button class="pub-cell" data-id="${s.id}" style="--aspect: ${s.aspect}" aria-label="${s.name}">
                <span class="pub-device">
                  <span class="pub-ghost">${icon(s.icon)}</span>
                  <canvas></canvas>
                </span>
                <span class="pub-name">${icon(s.icon)} ${s.name}<i class="pub-why">${icon('question')}</i></span>
                <ul class="pub-specs">${s.specs.map(([spec], i) => `<li style="--i: ${i}">${spec}</li>`).join('')}</ul>
                <span class="pub-tip pub-tip-care" role="tooltip">
                  <b>${icon('eye')} À quoi veiller</b>
                  ${s.care.map((line) => `<span>${line}</span>`).join('')}
                </span>
                <span class="pub-tip pub-tip-why" role="tooltip">
                  ${s.specs.map(([spec, why]) => `<span><b>${spec}</b> ${why}</span>`).join('')}
                </span>
              </button>`).join('')}
            <div class="pub-master"><canvas></canvas></div>
          </div>
        </div>
      </div>
      <aside class="mg-side">
        <p class="mg-text">Diffuse l’annonce partout : choisis tous les supports.</p>
        ${Object.entries(GROUPS).map(([group, label]) => `
          <div class="mg-field">
            <span class="mg-field-label">${label}</span>
            ${SUPPORTS.filter((s) => s.group === group).map((s) => `
              <button class="pub-toggle" data-id="${s.id}">${icon(s.icon)} ${s.name}</button>`).join('')}
          </div>`).join('')}
        <p class="mg-feedback">${SUPPORTS.length} supports à choisir.</p>
        <div class="mg-actions"><button class="btn btn-primary" data-action="go" disabled>${icon('paper-plane-tilt')} Diffuser</button></div>
      </aside>`;

    this.ui = {
      stage: el.querySelector<HTMLElement>('.pub-stage')!,
      master: el.querySelector<HTMLCanvasElement>('.pub-master canvas')!,
      cells: [...el.querySelectorAll<HTMLElement>('.pub-cell')],
      toggles: [...el.querySelectorAll<HTMLButtonElement>('.pub-toggle')],
      feedback: el.querySelector<HTMLElement>('.mg-feedback')!,
      button: el.querySelector<HTMLButtonElement>('[data-action="go"]')!,
    };
    for (const button of [...this.ui.cells, ...this.ui.toggles]) {
      this.listen(button, 'click', () => (this.diffused ? this.explain(button) : this.toggle(button.dataset.id!)));
    }
    // With a mouse, hovering shows the bubbles: one opened by a click goes when the pointer leaves.
    for (const cell of this.ui.cells) {
      this.listen(cell, 'pointerleave', (e) => e.pointerType === 'mouse' && cell.classList.remove('open'));
    }
    // A touch anywhere else closes the open bubble.
    this.listen(el, 'click', (e) => {
      if (!(e.target as Element).closest('.pub-cell, .pub-toggle')) this.openTip(null);
    });
    this.listen(this.ui.button, 'click', () => (this.diffused ? this.end(true) : this.diffuse()));
  }

  toggle(id: string) {
    if (this.diffused) return;
    if (this.chosen.has(id)) this.chosen.delete(id);
    else this.chosen.add(id);
    sound.play('tap');
    for (const button of [...this.ui.cells, ...this.ui.toggles]) {
      button.classList.toggle('selected', this.chosen.has(button.dataset.id!));
    }
    // A support just chosen shows what to watch for on it.
    this.openTip(this.chosen.has(id) ? this.ui.cells.find((cell) => cell.dataset.id === id) : null);
    const left = SUPPORTS.length - this.chosen.size;
    this.ui.feedback.textContent = left ? `Encore ${left} support${left > 1 ? 's' : ''}.` : '';
    this.ui.button.disabled = left > 0;
    this.ui.button.classList.toggle('ready', !left);
  }

  /** One visual in the middle, flying out to each chosen support, where it is redone in its format. */
  diffuse() {
    this.diffused = true;
    this.openTip(null);
    this.ui.button.disabled = true;
    this.ui.button.classList.remove('ready');
    for (const button of this.ui.toggles) button.disabled = true;
    const { stage } = this.ui;
    stage.classList.add('diffusing');

    const master = this.ui.master;
    const dpr = window.devicePixelRatio || 1;
    master.width = Math.round(master.getBoundingClientRect().width * dpr);
    master.height = Math.round(master.width * Math.SQRT2);
    drawDesign(master.getContext('2d')!, master.width, master.height, this.design);
    const picture = master.toDataURL();

    const chosen = this.ui.cells.filter((cell) => this.chosen.has(cell.dataset.id!));
    for (const cell of chosen) {
      const support = SUPPORTS.find((s) => s.id === cell.dataset.id)!;
      const canvas = cell.querySelector('canvas')!;
      canvas.width = Math.round(canvas.getBoundingClientRect().width * dpr);
      canvas.height = Math.round(canvas.width / support.aspect);
      MOCKUPS[support.id](canvas.getContext('2d')!, canvas.width, canvas.height, this.design);
    }

    sound.play('pop');
    chosen.forEach((cell, i) => this.after(400 + i * FLY_GAP, () => this.fly(picture, cell)));
    const landed = 400 + (chosen.length - 1) * FLY_GAP + FLY_TIME;
    this.after(landed - FLY_TIME, () => stage.classList.add('sent'));
    this.after(landed + 1200, () => {
      sound.play('sparkle');
      this.feedback(this.ui.feedback, `${icon('check')} Un visuel, ${chosen.length} formats prêts ! Touche-les pour savoir pourquoi.`, 'ok');
      this.ui.button.innerHTML = `Terminer ${icon('arrow-right')}`;
      this.ui.button.disabled = false;
      this.ui.button.classList.add('ready');
    });
  }

  /** Opens or closes the bubble that says why each setting of a made format (`cell`) is so. */
  explain(cell: HTMLElement) {
    if (!cell.classList.contains('rendered')) return;
    const open = !cell.classList.contains('open');
    this.openTip(open ? cell : null);
    if (open) sound.play('tap');
  }

  /**
   * Opens the bubble of `cell` and closes the others (null: closes them all). Before the diffusion it
   * says what to watch for on that support, after it why each setting is so.
   */
  openTip(cell: HTMLElement | null | undefined) {
    for (const other of this.ui.cells) other.classList.toggle('open', other === cell);
  }

  /** A copy of the visual flies from the middle to the cell's support, then the support's version wipes in. */
  fly(picture: string, cell: HTMLElement) {
    const { stage } = this.ui;
    const origin = stage.getBoundingClientRect();
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: `${r.left - origin.left}px`, top: `${r.top - origin.top}px`, width: `${r.width}px`, height: `${r.height}px` };
    };
    const copy = document.createElement('img');
    copy.className = 'pub-fly';
    copy.src = picture;
    stage.appendChild(copy);
    this.cleanups.push(() => copy.remove());
    sound.play('tick');
    const flight = copy.animate([box(this.ui.master), box(cell.querySelector('canvas')!)], {
      duration: FLY_TIME, easing: 'cubic-bezier(0.5, 0, 0.3, 1)', fill: 'forwards',
    });
    flight.onfinish = () => {
      cell.classList.add('rendered');
      copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 150, fill: 'forwards' }).onfinish = () => copy.remove();
    };
  }
}

// ---------------------------------------------------------------- the visual, in each format

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[], fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** Writes `text` centred on x, shrinking the font until it fits in `maxWidth`. */
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxWidth: number, weight: number, family: string) {
  g.font = `${weight} ${size}px "${family}"`;
  const width = g.measureText(text).width;
  if (width > maxWidth) g.font = `${weight} ${size * (maxWidth / width)}px "${family}"`;
  g.fillText(text, x, y);
}

/**
 * The visitor's poster (`design`, from the layout task) redone for a frame of any shape: its background
 * and text colours, the title, and the photo in a white frame. On wide frames the title sits on the left
 * and the photo on the right, on the others the title is on top and the photo below it.
 */
function drawAd(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, design: Design, { cta = null }: { cta?: string | null } = {}) {
  const wide = w / h > 1.3;
  const margin = Math.min(w, h) * 0.06;
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = design.background;
  g.fillRect(x, y, w, h);

  g.fillStyle = design.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (wide) {
    const cx = x + w * 0.26;
    const room = w * 0.44;
    const size = Math.min(h * 0.26, w * 0.12);
    const top = cta ? y + h * 0.36 : y + h * 0.42;
    fitText(g, 'PÉTILLE', cx, top, size, room, 600, 'Fredoka Variable');
    fitText(g, 'La limonade qui pétille', cx, top + size * 0.72, size * 0.3, room, 800, 'Nunito Variable');
    if (cta) {
      const bw = size * 2.1;
      const bh = size * 0.5;
      roundRect(g, cx - bw / 2, top + size * 1.05, bw, bh, bh / 2, C.coral);
      g.fillStyle = C.paper;
      fitText(g, cta, cx, top + size * 1.05 + bh / 2, bh * 0.5, bw * 0.8, 800, 'Nunito Variable');
    }
    framedPhoto(g, x + w * 0.52, y + margin, w * 0.48 - margin, h - 2 * margin);
  } else {
    const size = w * 0.2;
    fitText(g, 'PÉTILLE', x + w / 2, y + margin + size * 0.5, size, w * 0.86, 600, 'Fredoka Variable');
    fitText(g, 'La limonade qui pétille', x + w / 2, y + margin + size * 1.1, size * 0.28, w * 0.86, 800, 'Nunito Variable');
    const top = margin + size * 1.45;
    framedPhoto(g, x + margin, y + top, w - 2 * margin, h - top - margin);
  }
  g.restore();
}

/** The campaign photo, cropped around the bottle to fill the box, in a white rounded frame. */
function framedPhoto(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const border = Math.min(w, h) * 0.025;
  const radius = Math.min(w, h) * 0.06;
  roundRect(g, x, y, w, h, radius, C.paper);
  g.save();
  g.beginPath();
  g.roundRect(x + border, y + border, w - 2 * border, h - 2 * border, radius - border);
  g.clip();
  drawStudioView(g, productView((w - 2 * border) / (h - 2 * border), 0.75), x + border, y + border, w - 2 * border, h - 2 * border);
  g.restore();
}

/** Dark fade at the bottom of a video, so the white controls read on any picture. */
function shade(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const fade = g.createLinearGradient(0, y, 0, y + h);
  fade.addColorStop(0, 'rgba(30, 58, 76, 0)');
  fade.addColorStop(1, 'rgba(30, 58, 76, 0.6)');
  g.fillStyle = fade;
  g.fillRect(x, y, w, h);
}

function card(g: CanvasRenderingContext2D, w: number, h: number, u: number) {
  roundRect(g, 0, 0, w, h, 4 * u, EDGE);
  roundRect(g, 0.6 * u, 0.6 * u, w - 1.2 * u, h - 1.2 * u, 3.5 * u, C.paper);
}

function text(g: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = C.ink,
  { weight = 800, family = 'Nunito Variable', align = 'left' }: { weight?: number; family?: string; align?: CanvasTextAlign } = {}) {
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.font = `${weight} ${size}px "${family}"`;
  g.fillText(value, x, y);
}

const MIST_LINE = '#dcefeb';
const EDGE = '#cfe9e4';

// Each mock-up fills a canvas of the support's aspect with the visitor's poster (`design`) in it; `u`
// is a hundredth of its width.
const MOCKUPS: Record<SupportId, Mockup> = {
  site(g, w, h, design) {
    const u = w / 100;
    card(g, w, h, u);
    roundRect(g, 0.6 * u, 0.6 * u, w - 1.2 * u, 8 * u, [3.5 * u, 3.5 * u, 0, 0], C.mist);
    [C.coral, C.sun, C.teal].forEach((color, i) => circle(g, (4.5 + i * 4) * u, 4.6 * u, 1.3 * u, color));
    roundRect(g, 18 * u, 2.3 * u, 52 * u, 4.6 * u, 2.3 * u, C.paper);
    text(g, 'petille.ch', 21 * u, 4.7 * u, 2.6 * u, C.inkSoft);
    text(g, 'Pétille', 4 * u, 11.6 * u, 3.6 * u, C.ink, { weight: 600, family: 'Fredoka Variable' });
    for (let i = 0; i < 3; i++) roundRect(g, (62 + i * 12) * u, 10.8 * u, 9 * u, 1.8 * u, 0.9 * u, MIST_LINE);
    drawAd(g, 0.6 * u, 15 * u, w - 1.2 * u, (w - 1.2 * u) / 3, design, { cta: 'Découvrir' });
    for (let i = 0; i < 3; i++) roundRect(g, (3 + i * 32) * u, 51 * u, 30 * u, 8.5 * u, 2 * u, C.mist);
  },

  mail(g, w, h, design) {
    const u = w / 100;
    card(g, w, h, u);
    circle(g, 10 * u, 10 * u, 5 * u, C.coral);
    text(g, 'P', 10 * u, 10.4 * u, 6 * u, C.paper, { weight: 600, family: 'Fredoka Variable', align: 'center' });
    text(g, 'Pétille', 18 * u, 8 * u, 4.6 * u, C.ink, { weight: 600, family: 'Fredoka Variable' });
    text(g, 'Nouveauté de juin', 18 * u, 13 * u, 3.2 * u, C.inkSoft);
    g.fillStyle = EDGE;
    g.fillRect(6 * u, 19 * u, 88 * u, 0.4 * u);
    drawAd(g, 6 * u, 23 * u, 88 * u, 44 * u, design);
    [88, 80, 56].forEach((width, i) => roundRect(g, 6 * u, (73 + i * 5) * u, width * u, 2.6 * u, 1.3 * u, MIST_LINE));
    roundRect(g, 28 * u, 92 * u, 44 * u, 10 * u, 5 * u, C.coral);
    text(g, 'Je goûte', 50 * u, 97.3 * u, 4.2 * u, C.paper, { align: 'center' });
    [44, 30].forEach((width, i) => roundRect(g, (50 - width / 2) * u, (111 + i * 5) * u, width * u, 2 * u, u, C.mist));
  },

  poster(g, w, h, design) {
    const u = w / 100;
    const sheet = { x: 9.5 * u, y: 9.3 * u, w: 81 * u, h: 114.6 * u };
    const bleed = 1.8 * u;
    g.save();
    g.beginPath();
    g.rect(sheet.x - bleed, sheet.y - bleed, sheet.w + 2 * bleed, sheet.h + 2 * bleed);
    g.clip();
    g.translate(sheet.x - bleed, sheet.y - bleed);
    drawDesign(g, sheet.w + 2 * bleed, sheet.h + 2 * bleed, design);
    g.restore();
    // Where the guillotine cuts: the bleed beyond it goes to waste.
    g.strokeStyle = C.paper;
    g.lineWidth = 0.5 * u;
    g.setLineDash([1.6 * u, 1.2 * u]);
    g.strokeRect(sheet.x, sheet.y, sheet.w, sheet.h);
    g.setLineDash([]);
    g.strokeStyle = C.ink;
    g.lineWidth = 0.4 * u;
    for (const x of [sheet.x, sheet.x + sheet.w]) {
      for (const y of [sheet.y, sheet.y + sheet.h]) {
        const dx = x === sheet.x ? -1 : 1;
        const dy = y === sheet.y ? -1 : 1;
        g.beginPath();
        g.moveTo(x, y + dy * 3 * u);
        g.lineTo(x, y + dy * 8 * u);
        g.moveTo(x + dx * 3 * u, y);
        g.lineTo(x + dx * 8 * u, y);
        g.stroke();
      }
    }
    // The four inks of the press: cyan, magenta, yellow, black.
    ['#00a0e3', '#e5007e', '#ffed00', '#1d1d1b'].forEach((ink, i) => {
      g.fillStyle = ink;
      g.fillRect(w / 2 + (i - 2) * 4.5 * u, sheet.y + sheet.h + 3.2 * u, 3.6 * u, 3.6 * u);
    });
  },

  tiktok(g, w, h, design) {
    const u = w / 100;
    const p = 4.3 * u;
    roundRect(g, 0, 0, w, h, 14 * u, C.ink);
    g.save();
    g.beginPath();
    g.roundRect(p, p, w - 2 * p, h - 2 * p, 10 * u);
    g.clip();
    drawAd(g, p, p, w - 2 * p, h - 2 * p, design);
    shade(g, p, h * 0.62, w - 2 * p, h * 0.38);
    g.restore();
    roundRect(g, w / 2 - 12 * u, p + 2.5 * u, 24 * u, 5 * u, 2.5 * u, C.ink);
    (['heart', 'chat-circle', 'paper-plane-tilt'] satisfies IconName[]).forEach((name, i) => {
      drawIcon(g, name, w - p - 15 * u, h * 0.56 + i * 15 * u, 11 * u, { ink: C.paper, tint: name === 'heart' ? C.coral : 'rgba(255, 255, 255, 0.35)' });
    });
    text(g, '@petille', p + 6 * u, h - p - 19 * u, 6 * u, C.paper);
    text(g, '#limonade #été', p + 6 * u, h - p - 11 * u, 4.6 * u, C.paper, { weight: 700 });
  },

  insta(g, w, h, design) {
    const u = w / 100;
    card(g, w, h, u);
    circle(g, 7.5 * u, 6.5 * u, 4.2 * u, C.coral);
    circle(g, 7.5 * u, 6.5 * u, 3.2 * u, C.sun);
    text(g, 'petille.limonade', 14 * u, 6.6 * u, 4 * u);
    [0, 1, 2].forEach((i) => circle(g, (86 + i * 3.4) * u, 6.6 * u, 0.9 * u, C.ink));
    drawAd(g, 0.6 * u, 13 * u, w - 1.2 * u, (w - 1.2 * u) * 1.25, design);
    (['heart', 'chat-circle', 'paper-plane-tilt'] satisfies IconName[]).forEach((name, i) => drawIcon(g, name, (4 + i * 10) * u, 139.5 * u, 7.5 * u));
    roundRect(g, 4 * u, 150 * u, 64 * u, 2.6 * u, 1.3 * u, MIST_LINE);
  },

  youtube(g, w, h, design) {
    const u = w / 100;
    const vh = 56.25 * u;
    g.save();
    g.beginPath();
    g.roundRect(0, 0, w, vh, 3 * u);
    g.clip();
    drawAd(g, 0, 0, w, vh, design);
    shade(g, 0, vh * 0.7, w, vh * 0.3);
    g.restore();
    roundRect(g, 3 * u, vh - 4 * u, w - 6 * u, 0.9 * u, 0.45 * u, 'rgba(255, 255, 255, 0.5)');
    roundRect(g, 3 * u, vh - 4 * u, 34 * u, 0.9 * u, 0.45 * u, C.coral);
    circle(g, 37 * u, vh - 3.55 * u, 1.6 * u, C.coral);
    g.fillStyle = C.paper;
    g.beginPath();
    g.moveTo(3.5 * u, vh - 11 * u);
    g.lineTo(3.5 * u, vh - 6.5 * u);
    g.lineTo(7.3 * u, vh - 8.75 * u);
    g.fill();
    text(g, '0:05 / 0:15', 10 * u, vh - 8.6 * u, 2.6 * u, C.paper);
    circle(g, 4.5 * u, vh + 7 * u, 3.6 * u, C.coral);
    text(g, 'Pétille, la limonade qui pétille', 10.5 * u, vh + 5 * u, 3.6 * u);
    text(g, 'Pétille · 1,2 k vues', 10.5 * u, vh + 9.6 * u, 2.8 * u, C.inkSoft, { weight: 700 });
  },
};
