import { ICON_PATHS, type IconName } from './iconPaths.ts';
import { PALETTE } from '../render/palette.ts';

/** Paths of one pictogram (iconPaths.ts). */
export interface IconPaths { tint: string[]; line?: string[]; stroke?: string[] }

// Pictograms of the game, in place of emojis: a thick ink outline (currentColor) over a pastel fill,
// like stickers. Every `icon` field in the game is a name of ICON_PATHS (list in tools/build-icons.ts).
// The fill is `--icon-tint` (teal-ish aqua by default, set per context in style.css); some icons keep
// their own colour wherever they are, following the palette: sunflower for rewards and light, coral for love.
const LINE = 24; // width of the bold outline, in the 256 grid
const OWN_TINT: Partial<Record<IconName, string>> = {
  star: PALETTE.sun, sun: PALETTE.sun, lightbulb: PALETTE.sun, sparkle: PALETTE.sun, confetti: PALETTE.sun,
  heart: PALETTE.coral,
  x: 'transparent', check: 'transparent', // plain marks: a fill would only blur them
};

/** Inline SVG markup of the icon `name`; `tint` overrides its fill colour (null: left to the CSS). */
export function icon(name: IconName, { tint = OWN_TINT[name], label }: { tint?: string | null; label?: string } = {}) {
  const { tint: fill, line = [], stroke = [] }: IconPaths = ICON_PATHS[name];
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="icon" data-icon="${name}" viewBox="0 0 256 256" ${a11y}${tint ? ` style="--icon-tint:${tint}"` : ''}>`
    + fill.map((d) => `<path class="icon-tint" d="${d}"/>`).join('')
    + line.map((d) => `<path d="${d}"/>`).join('')
    + stroke.map((d) => `<path class="icon-stroke" d="${d}"/>`).join('')
    + '</svg>';
}

/** Standalone SVG of a logo (the trade's icon on a coral disc, like the HUD), for favicons. */
export function logoSvg(name: IconName = 'film-slate') {
  const { line } = ICON_PATHS[name] as Required<IconPaths>;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><circle cx="128" cy="128" r="128" fill="${PALETTE.coral}"/>`
    + `<g fill="#fff" transform="translate(40 36) scale(0.69)">${line.map((d) => `<path d="${d}"/>`).join('')}</g></svg>`;
}

const cache = new Map<IconName, Record<keyof IconPaths, Path2D[]>>();
const path2d = (name: IconName) => {
  if (!cache.has(name)) {
    const { tint, line = [], stroke = [] }: IconPaths = ICON_PATHS[name];
    const make = (list: string[]) => list.map((d) => new Path2D(d));
    cache.set(name, { tint: make(tint), line: make(line), stroke: make(stroke) });
  }
  return cache.get(name)!;
};

/** Draws the icon `name` on a 2D canvas, `size` px wide with its top-left corner at (x, y). */
export function drawIcon(g: CanvasRenderingContext2D, name: IconName, x: number, y: number, size: number,
  { ink = PALETTE.ink, tint = OWN_TINT[name] ?? PALETTE.aqua }: { ink?: string; tint?: string } = {}) {
  const paths = path2d(name);
  g.save();
  g.translate(x, y);
  g.scale(size / 256, size / 256);
  g.fillStyle = tint;
  for (const p of paths.tint) g.fill(p);
  g.fillStyle = ink;
  for (const p of paths.line) g.fill(p);
  g.strokeStyle = ink;
  g.lineWidth = LINE;
  g.lineCap = g.lineJoin = 'round';
  for (const p of paths.stroke) g.stroke(p);
  g.restore();
}
