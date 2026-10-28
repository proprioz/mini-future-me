import * as THREE from 'three';
import { Character } from '../character/Character.ts';
import { applyPose } from '../character/poses.ts';
import { CharacterStage } from '../render/CharacterStage.ts';
import { PALETTE as C } from '../render/palette.ts';
import { FEET_Y, paintDecor, W, H } from './decors.ts';
import { studioDecors, studioPoses } from './unlocks.ts';
import { SCHOOL, drawSchoolQr, loadLogo } from './school.ts';
import { trade } from '../trades/current.ts';
import { GAME } from '../trades/index.ts';
import type { PosterTitle } from '../trades/types.ts';

// A4 portrait at 300 dpi: what gets printed.
export const POSTER = { width: 2480, height: 3508 };

// Layout in decor units (1000 × 1414): the school footer takes the bottom of the page, the decor and
// its frame fill the rest, moved up so that its floor stays under the character's feet.
const FOOTER = 150;
const SCENE_H = H - FOOTER;
const FEET = 1000;
const DECOR_SHIFT = FEET_Y - FEET;

// Framing of the 3D layer: the poster height covers SPAN world units.
const SPAN = 3.39;
const VIEW = { target: new THREE.Vector3(0, (FEET / H - 0.5) * SPAN - 0.08, 0), height: SPAN, width: 0, lift: 0.35 };

const DISPLAY = '"Fredoka Variable", "Nunito Variable", sans-serif';
const TEXT = '"Nunito Variable", sans-serif';

/** What the visitor chose in the poster studio: ids of the decor, title and pose, and the texts. */
export interface PosterSettings {
  decor: string;
  title: string;
  name: string;
  servedBy: string;
  pose: string;
  expression: Parameters<Character['setExpression']>[0];
  heading: number;
}

/**
 * Draws the poster: a painted decor, the character rendered in 3D (transparent background, with its
 * shadow on the floor), the title and the name card, then the school footer. The same `draw()` serves
 * the live preview and the print export, so what the visitor sees is what gets printed.
 */
export class PosterRenderer {
  stage: CharacterStage;
  character: Character;
  decor: { id: string | null; canvas: HTMLCanvasElement };
  logo: HTMLImageElement | null;
  ready: Promise<void>;

  constructor() {
    this.stage = new CharacterStage({ pedestal: false });
    this.stage.renderer.setPixelRatio(1);
    this.stage.setView(VIEW);
    // A higher sun than in the previews keeps the shadow under the feet (seen nearly edge-on, a long
    // shadow looks like a stone on the floor), and a finer map keeps it smooth at print size.
    this.stage.scene.traverse((light) => {
      if (!(light as THREE.DirectionalLight).isDirectionalLight) return;
      light.position.set(1.2, 7, 2.5);
      (light as THREE.DirectionalLight).shadow.mapSize.set(2048, 2048);
      this.stage.sunDirection = light.position.clone().normalize();
    });
    this.character = new Character();
    this.character.setBlinking(false); // a still image: never caught mid-blink
    this.stage.scene.add(this.character.group, shadowCatcher());
    this.decor = { id: null, canvas: document.createElement('canvas') };
    this.logo = null;
    this.ready = loadLogo().then((logo) => {
      this.logo = logo;
    });
  }

  /** Advances the idle animation and applies the chosen pose, expression and heading. */
  update(dt: number, time: number, { pose, expression, heading }: Pick<PosterSettings, 'pose' | 'expression' | 'heading'>): void {
    const { character } = this;
    character.setExpression(expression);
    character.targetHeading = heading;
    character.update(dt, time);
    applyPose(character, studioPoses().find((p) => p.id === pose));
  }

  /** Draws the whole poster into `canvas` (any size with the A4 ratio). */
  draw(canvas: HTMLCanvasElement, { decor, title, name, servedBy }: PosterSettings): void {
    const { width, height } = canvas;
    const g = canvas.getContext('2d')!;
    g.drawImage(this.decorCanvas(decor, width, height), 0, (-DECOR_SHIFT * height) / H);

    const { renderer } = this.stage;
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== width || size.y !== height) this.stage.setSize(width, height);
    this.stage.render();
    g.drawImage(this.stage.canvas, 0, 0);

    g.save();
    g.scale(width / W, height / H);
    drawFrame(g);
    const { titles } = trade().studio;
    drawTitle(g, titles.find((t) => t.id === title) ?? titles[0]);
    drawCard(g, name.trim());
    drawFooter(g, servedBy.trim(), this.logo);
    g.restore();
  }

  /** The poster at print size (2480 × 3508 px), in a new canvas. */
  render(settings: PosterSettings): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = POSTER.width;
    canvas.height = POSTER.height;
    this.character.heading = this.character.targetHeading; // finish any turn in progress
    this.update(0, 0, settings);
    this.draw(canvas, settings);
    return canvas;
  }

  decorCanvas(id: string, width: number, height: number): HTMLCanvasElement {
    const { decor } = this;
    if (decor.id !== id || decor.canvas.width !== width || decor.canvas.height !== height) {
      Object.assign(decor.canvas, { width, height });
      const decors = studioDecors();
      paintDecor(decor.canvas, decors.find((d) => d.id === id) ?? decors[0]);
      decor.id = id;
    }
    return decor.canvas;
  }
}

/** Invisible floor that only shows the character's shadow, over the painted decor. */
function shadowCatcher(): THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial> {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ color: C.ink, opacity: 0.18 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  return floor;
}

// ------------------------------------------------------------ 2D layers (in decor units, 1000 × 1414)

function drawFrame(g: CanvasRenderingContext2D): void {
  g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  g.lineWidth = 10;
  g.beginPath();
  g.roundRect(24, 24, W - 48, SCENE_H - 48, 28);
  g.stroke();
}

/** Sets the largest font (up to `max` px) at which every line fits in `width`, and returns its size. */
function fitFont(g: CanvasRenderingContext2D, lines: string[], max: number, width: number): number {
  g.font = `600 ${max}px ${DISPLAY}`;
  const widest = Math.max(...lines.map((line) => g.measureText(line).width));
  const size = Math.min(max, (max * width) / widest);
  g.font = `600 ${size}px ${DISPLAY}`;
  return size;
}

/** Text "sticker": thick ink outline with a darker lip below, white fill. */
function stickerText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  g.lineJoin = 'round';
  g.lineWidth = size * 0.24;
  g.strokeStyle = '#0f2533';
  g.strokeText(text, x, y + size * 0.07);
  g.strokeStyle = C.ink;
  g.strokeText(text, x, y);
  g.fillStyle = '#ffffff';
  g.fillText(text, x, y);
}

function drawTitle(g: CanvasRenderingContext2D, { lines }: PosterTitle): void {
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';

  // Badge with the game's name: the job is already in the title below.
  g.font = `600 30px ${DISPLAY}`;
  const label = GAME.title.toLocaleUpperCase('fr');
  g.letterSpacing = '4px';
  const badge = g.measureText(label).width + 56;
  g.fillStyle = '#dc3f64';
  g.beginPath();
  g.roundRect(500 - badge / 2, 64 + 6, badge, 52, 26);
  g.fill();
  g.fillStyle = C.coral;
  g.beginPath();
  g.roundRect(500 - badge / 2, 64, badge, 52, 26);
  g.fill();
  g.fillStyle = '#ffffff';
  g.fillText(label, 500, 101);
  g.letterSpacing = '0px';

  const size = fitFont(g, lines, 108, 820);
  lines.forEach((line, i) => stickerText(g, line, 500, 140 + size * (0.95 + i * 0.98), size));
}

/** White card at the bottom: first name and what the visitor discovered. */
function drawCard(g: CanvasRenderingContext2D, name: string): void {
  // Rows from the top of the card: name (optional), caption. The card keeps its bottom edge and only
  // grows as tall as its rows need.
  const rows = name ? { name: 84, caption: 130 } : { caption: 56 };
  const x = 80;
  const w = W - 160;
  const h = name ? 170 : 96;
  const y = SCENE_H - 52 - h;
  g.fillStyle = '#cfe9e4';
  g.beginPath();
  g.roundRect(x, y + 12, w, h, 44);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.roundRect(x, y, w, h, 44);
  g.fill();

  g.textAlign = 'center';
  if (name) {
    fitFont(g, [name], 64, w - 80);
    g.fillStyle = C.ink;
    g.fillText(name, 500, y + rows.name!);
  }
  g.font = `800 24px ${TEXT}`;
  g.fillStyle = C.inkSoft;
  g.fillText(trade().poster.caption, 500, y + rows.caption);
}

/**
 * White band at the bottom of the page, in two blocks between the top and the bottom of the QR code,
 * with one caption style for all the small text. Left, the visit: the booth team who guided the
 * visitor and the date. Right, the school, when one is set (school.ts): its logo, where to learn more
 * about the training and the job, and the QR code of its website. Both blocks start on the same top line and end on the same
 * baseline. Kept 25 units (5 mm) away from the paper's edge, which most printers can't reach.
 */
function drawFooter(g: CanvasRenderingContext2D, servedBy: string, logo: HTMLImageElement | null): void {
  const middle = SCENE_H + FOOTER / 2;
  g.fillStyle = '#ffffff';
  g.fillRect(0, SCENE_H, W, FOOTER);

  const qr = 100;
  const top = middle - qr / 2;
  const bottom = middle + qr / 2;
  // Two caption lines end on the bottom of the QR code (descenders included).
  const caption = `800 14px ${TEXT}`;
  const lastLine = bottom - 3;
  const firstLine = lastLine - 20;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';

  // Without a school (none set in .env.local), the visit block takes the whole width.
  let ruleX = W - 60 + 36;
  if (SCHOOL.url) {
    const qrX = W - 60 - qr;
    drawSchoolQr(g, qrX, top, qr, C.ink);

    // School block: the logo over the two caption lines, next to the QR code.
    const schoolW = 340;
    const schoolX = qrX - 28 - schoolW;
    if (logo) {
      const ratio = logo.naturalWidth / logo.naturalHeight || 6.5;
      g.drawImage(logo, schoolX, top, schoolW, schoolW / ratio);
    } else {
      g.textBaseline = 'top';
      g.font = `600 44px ${DISPLAY}`;
      g.fillStyle = C.ink;
      g.fillText(SCHOOL.name, schoolX, top, schoolW);
      g.textBaseline = 'alphabetic';
    }
    g.font = caption;
    g.fillStyle = C.inkSoft;
    g.fillText('Infos sur la formation et le métier :', schoolX, firstLine, schoolW);
    g.fillStyle = C.tealDeep;
    g.fillText(SCHOOL.site, schoolX, lastLine);
    const siteW = g.measureText(SCHOOL.site).width;
    g.fillStyle = C.inkSoft;
    g.fillText(' ou scanne le code', schoolX + siteW, lastLine, schoolW - siteW);

    // Between the blocks, a thin rule.
    ruleX = schoolX - 36;
    g.strokeStyle = '#d3e7e3';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(ruleX, top);
    g.lineTo(ruleX, bottom);
    g.stroke();
  }

  // Visit block: who served the visitor (when the booth team typed their names), and when. The
  // label sits on the top line, the date on the last caption line, the value in between.
  const visitX = 60;
  const visitW = ruleX - 36 - visitX;
  const date = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  g.font = caption;
  g.fillStyle = C.inkSoft;
  g.textBaseline = 'top';
  g.fillText(servedBy ? 'Tu as été servi·e par' : 'Affiche créée le', visitX, top, visitW);
  g.textBaseline = 'alphabetic';
  if (servedBy) g.fillText(`le ${date}`, visitX, lastLine, visitW);
  const value = servedBy || date;
  fitFont(g, [value], 40, visitW);
  g.fillStyle = C.ink;
  g.textBaseline = 'middle';
  g.fillText(value, visitX, servedBy ? middle - 2 : middle + 8);
  g.textBaseline = 'alphabetic';
}
