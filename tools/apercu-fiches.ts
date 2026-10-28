// Rebuilds the look written in public/portraits/Personne_NN/fiche.md (what Claude saw on the photos,
// as options of the game) and renders it next to the 4 photos, from the same angles: checks that the
// game can draw what the fiche says, and how close it looks. Unlike `pnpm portraits`, there is no
// scan here: only the rendering of the options is judged (skill portraits).
//
//   pnpm apercu                every person with a fiche
//   pnpm apercu 16 25          only these people
//   pnpm apercu --vue body     whole body (outfits)
//
// PNGs in .playwright-mcp/apercu/. A fiche naming an option or a colour the game no longer has is
// reported: the fiche must be updated to the closest option.
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import type { Look } from '../src/character/Character.ts';
import type { Option } from '../src/character/options.ts';
import type { ViewName } from '../src/render/CharacterStage.ts';

const ROOT = resolve(import.meta.dirname, '..');
const PHOTOS = join(ROOT, 'public/portraits');
const OUT = join(ROOT, '.playwright-mcp/apercu');

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: { vue: { type: 'string', default: 'head' } },
});

// Row of the fiche → look keys, in the order of the backticked values on the row.
const ROWS: Record<string, (keyof Look)[]> = {
  'Forme du visage': ['faceShape'], 'Forme des yeux': ['eyeShape'], 'Couleur des yeux': ['eyeColor'], Teint: ['skin'],
  Taches: ['skinMarks'], Coiffure: ['hairStyle'], 'Couleur des cheveux': ['hair'], Barbe: ['beard'], Moustache: ['mustache'],
  'Couleur de la barbe': ['beardColor'], 'Couvre-chef': ['headwear', 'headwearColor'], Lunettes: ['glasses', 'glassesColor'],
  "Boucles d'oreilles": ['earrings', 'earringColor'], Tenue: ['outfit'], 'Couleur du haut': ['top'],
};

/** Look of a fiche: { key: value } from the backticked values of its table. */
function readFiche(file: string) {
  const look: Partial<Look> = {};
  for (const [, name, cells] of readFileSync(file, 'utf8').matchAll(/^\| ([^|]+?) \| (.+) \|$/gm)) {
    const values = [...cells.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    (ROWS[name] ?? []).forEach((key, i) => values[i] && (look[key] = values[i]));
  }
  return look;
}

const wanted = positionals.map(Number);
const people = readdirSync(PHOTOS)
  .filter((name) => /^Personne_\d+$/.test(name) && existsSync(join(PHOTOS, name, 'fiche.md')))
  .map((name) => Number(name.split('_')[1]))
  .filter((person) => !wanted.length || wanted.includes(person))
  .sort((a, b) => a - b);
if (!people.length) {
  console.error('Aucune fiche à dessiner : les portraits de test ne sont pas dans le dépôt, voir public/portraits/README.txt.');
  process.exit(1);
}
const looks = people.map((person) => readFiche(join(PHOTOS, `Personne_${String(person).padStart(2, '0')}`, 'fiche.md')));

const server = await createServer({
  root: ROOT,
  logLevel: 'error',
  server: { port: 5192, strictPort: false, forwardConsole: false, hmr: false, watch: null },
});
await server.listen();
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  page.on('pageerror', (error) => console.error('Erreur dans la page :', error.message));
  await page.goto(server.resolvedUrls!.local[0]);
  await page.waitForFunction(() => window.studio?.creator, null, { timeout: 60000 });
  const unknown = await page.evaluate(async ([people, looks, view]) => {
    const { DEFAULT_LOOK } = await import('/src/character/Character.ts');
    const O = await import('/src/character/options.ts');
    const lists: Partial<Record<string, Option[]>> = {
      faceShape: O.FACE_SHAPES, eyeShape: O.EYE_SHAPES, skinMarks: O.SKIN_MARKS, hairStyle: O.HAIR_STYLES, beard: O.BEARDS,
      mustache: O.MUSTACHES, headwear: O.HEADWEAR, glasses: O.GLASSES, earrings: O.EARRINGS, outfit: O.OUTFITS,
    };
    const colors: Partial<Record<string, string[]>> = {
      eyeColor: O.EYE_COLORS, skin: O.SKIN_TONES, hair: O.HAIR_COLORS, beardColor: O.HAIR_COLORS, top: O.CLOTH_COLORS,
      headwearColor: O.CLOTH_COLORS, glassesColor: O.GLASSES_COLORS, earringColor: O.METAL_COLORS,
    };
    const W = 200;
    const H = 267;
    const { creator } = window.studio;
    const stage = creator.thumbnailer.stage;
    const ch = creator.thumbnailer.character;
    ch.setExpression('neutral');
    const sheet = document.createElement('div');
    sheet.id = 'sheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:99;overflow:auto;background:#cdeee8;display:grid;gap:8px;align-content:start;padding:8px;font:13px sans-serif';
    document.body.append(sheet);
    stage.renderer.setPixelRatio(2);
    stage.setSize(W, H);
    stage.setView(view);
    const unknown: string[] = [];
    for (const [i, person] of people.entries()) {
      const look = looks[i];
      for (const [key, value] of Object.entries(look)) {
        const known = lists[key] ? lists[key].some((o) => o.id === value) : colors[key]?.includes(value);
        if (!known) unknown.push(`Personne_${String(person).padStart(2, '0')} : ${key} ${value}`);
      }
      ch.setLook({ ...DEFAULT_LOOK, ...look });
      const card = document.createElement('figure');
      card.style.cssText = `margin:0;padding:6px;background:#fff;display:grid;grid-template-columns:repeat(4,${W}px);gap:4px;width:max-content`;
      card.append(Object.assign(document.createElement('figcaption'), {
        textContent: `Personne ${person} — fiche.md`, style: 'grid-column:1/-1;font-weight:700',
      }));
      for (const v of ['01_face', '02_profil_gauche', '03_profil_droit', '04_dos']) {
        const img = new Image(W, H);
        img.src = `/portraits/Personne_${String(person).padStart(2, '0')}/${v}.jpg`;
        img.style.objectFit = 'cover';
        card.append(img);
      }
      for (const heading of [0, -Math.PI / 2, Math.PI / 2, Math.PI]) {
        ch.heading = ch.targetHeading = heading;
        ch.update(0, 0);
        stage.render();
        const img = new Image(W, H);
        img.src = stage.canvas.toDataURL();
        img.style.background = '#f4f1ec';
        card.append(img);
      }
      sheet.append(card);
    }
    stage.setSize(168, 168);
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    return unknown;
  }, [people, looks, options.vue as ViewName] as const);

  mkdirSync(OUT, { recursive: true });
  const cards = page.locator('#sheet > figure');
  for (const [i, person] of people.entries()) {
    await cards.nth(i).screenshot({ path: join(OUT, `Personne_${String(person).padStart(2, '0')}.png`) });
  }
  for (const line of unknown) console.warn(`⚠ option ou couleur absente du jeu, à ramener à la plus proche dans la fiche : ${line}`);
  console.log(`${people.length} aperçus dans ${OUT}`);
} finally {
  await browser.close();
  await server.close();
}
