// Compares the perso the scan builds with the photos of each test person (public/portraits), from
// the same 4 angles: one PNG per person in .playwright-mcp/comparaisons/, a gallery page of them
// (index.html), and a summary against the ground truth of tools/playwright/portraits.ts. Each run is
// added to .playwright-mcp/portraits-historique.jsonl and compared with the previous one, person by
// person (the improvement loop of .claude/skills/portraits, logged in docs/portraits-journal.md).
//
//   pnpm portraits                 every Personne_* folder
//   pnpm portraits 3 7 21          only these people
//   pnpm portraits --vue body      whole body instead of the head (views of CharacterStage.ts)
//   pnpm portraits --taille 300    width of each picture, in pixels (200 by default)
//   pnpm portraits --voir          shows Edge instead of running it hidden
//   pnpm portraits --no-ouvrir     does not open the gallery (opened when run from a terminal)
//   pnpm portraits --galerie       only rebuilds the gallery of the last run (after Claude's analysis)
//
// Starts its own Vite server and a headless Edge (playwright-core, no browser download), so it runs
// next to `pnpm dev` and an open Playwright MCP session.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { galleryHtml, type PortraitResults } from './portraits-gallery.ts';
import type { Miss } from './playwright/portraits.ts';
import type { ViewName } from '../src/render/CharacterStage.ts';

const ROOT = resolve(import.meta.dirname, '..');
const PHOTOS = join(ROOT, 'public/portraits');
const OUT = join(ROOT, '.playwright-mcp/comparaisons');
const HISTORY = join(ROOT, '.playwright-mcp/portraits-historique.jsonl');
// Claude's latest analysis (skill portraits), shown on top of the gallery. Out of OUT, which a full run empties.
const ANALYSIS = join(ROOT, '.playwright-mcp/portraits-analyse.md');
const VIEWS = ['01_face', '02_profil_gauche', '03_profil_droit', '04_dos'];

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  allowNegative: true,
  options: {
    vue: { type: 'string', default: 'head' },
    taille: { type: 'string', default: '200' },
    voir: { type: 'boolean', default: false },
    // Not when Claude runs it (no terminal): a new tab at each run would get in the way.
    ouvrir: { type: 'boolean', default: process.stdout.isTTY },
    galerie: { type: 'boolean', default: false },
  },
});

const fileOf = (person: number | string) => `Personne_${String(person).padStart(2, '0')}.png`;

/** Writes index.html with the analysis, if any (`current` when written after these results). */
function writeGallery(results: PortraitResults, files: Record<string, string>) {
  const gallery = join(OUT, 'index.html');
  const written = existsSync(ANALYSIS) && statSync(ANALYSIS).mtime;
  const analysis = written && {
    text: readFileSync(ANALYSIS, 'utf8'),
    date: written,
    current: written > statSync(join(OUT, 'resultats.json')).mtime,
  };
  writeFileSync(gallery, galleryHtml(results, files, { view: options.vue, analysis }));
  return gallery;
}

if (options.galerie) {
  const results = JSON.parse(readFileSync(join(OUT, 'resultats.json'), 'utf8'));
  const files = Object.fromEntries(Object.keys(results).filter((p) => existsSync(join(OUT, fileOf(p)))).map((p) => [p, fileOf(p)]));
  const gallery = writeGallery(results, files);
  console.log(`Galerie : ${pathToFileURL(gallery)}`);
  if (options.ouvrir) open(gallery);
  process.exit(0);
}

// Every complete Personne_NN folder (the 4 views), or the ones asked for.
const folders = readdirSync(PHOTOS).filter((name) => /^Personne_\d+$/.test(name)).sort();
const wanted = positionals.map(Number);
const people: number[] = [];
for (const folder of folders) {
  const person = Number(folder.split('_')[1]);
  if (wanted.length && !wanted.includes(person)) continue;
  const missing = VIEWS.filter((view) => !existsSync(join(PHOTOS, folder, `${view}.jpg`)));
  if (missing.length) console.warn(`⚠ ${folder} ignorée : il manque ${missing.map((v) => `${v}.jpg`).join(', ')}`);
  else people.push(person);
}
for (const person of wanted) {
  if (!folders.includes(`Personne_${String(person).padStart(2, '0')}`)) console.warn(`⚠ Personne_${String(person).padStart(2, '0')} introuvable`);
}
if (!people.length) {
  console.error('Aucune personne à comparer : les photos de test ne sont pas dans le dépôt, voir public/portraits/README.txt.');
  process.exit(1);
}

// No file watching nor reload: a file saved during the run (another session, the editor) would reload the
// page and kill it. Each run takes the code as it is when it starts.
const server = await createServer({
  root: ROOT,
  logLevel: 'error',
  server: { port: 5190, strictPort: false, forwardConsole: false, hmr: false, watch: null },
});
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: !options.voir });
try {
  // Twice the resolution, to stay sharp when enlarged in the gallery.
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  page.on('pageerror', (error) => console.error('Erreur dans la page :', error.message));
  const simulate = async () => {
    await page.goto(server.resolvedUrls!.local[0]);
    await page.waitForFunction(() => window.studio?.creator);
    return page.evaluate(
      async ([people, view, width]) => (await import('/tools/playwright/simulate.ts')).show(people, { view, cols: 1, width }),
      [people, options.vue as ViewName, Number(options.taille)] as const,
    );
  };
  // Vite reloads the page when it re-optimizes its dependencies (first run after an install): once more.
  const results = await simulate().catch((error) => {
    if (!/context was destroyed|navigation/i.test(error.message)) throw error;
    return simulate();
  });

  // Only the people of this run: the older pictures of the others stay.
  mkdirSync(OUT, { recursive: true });
  if (!wanted.length) rmSync(OUT, { recursive: true, force: true }), mkdirSync(OUT);
  const cards = page.locator('#sheet > figure');
  const files: Record<number, string> = {};
  for (const [i, person] of people.entries()) {
    files[person] = fileOf(person);
    await cards.nth(i).screenshot({ path: join(OUT, files[person]) });
  }
  writeFileSync(join(OUT, 'resultats.json'), `${JSON.stringify(results, null, 2)}\n`);
  const gallery = writeGallery(results, files);

  // Summary: one line per person, then the score.
  let checked = 0;
  let passed = 0;
  for (const person of people) {
    const { misses } = results[person];
    const name = `Personne_${String(person).padStart(2, '0')}`;
    if (!misses) console.log(`·  ${name}  pas de vérité terrain`);
    else if (!misses.length) console.log(`✓  ${name}`);
    else console.log(`✗  ${name}  ${misses.map(({ key, got, expected }) => `${key} ${got} (attendu ${expected})`).join(', ')}`);
    if (misses) checked++, passed += Number(!misses.length);
  }
  if (checked) console.log(`\n${passed}/${checked} personnes conformes à la vérité terrain.`);
  compareWithPrevious(results);
  console.log(`Galerie : ${pathToFileURL(gallery)}`);
  if (options.ouvrir) open(gallery);
} finally {
  await browser.close();
  await server.close();
}

/** Opens `file` with the default application (browser for HTML), on macOS, Windows or Linux. */
function open(file: string) {
  const [command, ...args] = ({ darwin: ['open'], win32: ['cmd', '/c', 'start', '""'] } as Partial<Record<string, string[]>>)[process.platform]
    ?? ['xdg-open'];
  spawn(command, [...args, file], { stdio: 'ignore', detached: true }).unref();
}

function describe(misses: Miss[] | null) {
  return !misses ? '·' : misses.length ? `✗ ${misses.map(({ key, got }) => `${key} ${got}`).join(', ')}` : '✓';
}

/** One line of HISTORY: the misses of every person of a run. */
interface HistoryRun {
  date: string;
  vue: string;
  origine: string;
  misses: Record<string, Miss[] | null>;
}

/** Adds this run to the history and prints what changed since the previous run of the same view. */
function compareWithPrevious(results: PortraitResults) {
  const runs = existsSync(HISTORY)
    ? readFileSync(HISTORY, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse as (line: string) => HistoryRun) : [];
  // The last run of the same view with all these people (a run of a few people is no reference for all).
  const sameView = runs.filter((run) => run.vue === options.vue);
  const previous = sameView.findLast((run) => Object.keys(results).every((person) => person in run.misses)) ?? sameView.at(-1);
  const run: HistoryRun = {
    date: new Date().toISOString(),
    vue: options.vue,
    origine: process.stdout.isTTY ? 'terminal' : 'claude',
    misses: Object.fromEntries(Object.entries(results).map(([person, { misses }]) => [person, misses])),
  };
  appendFileSync(HISTORY, `${JSON.stringify(run)}\n`);
  if (!previous) return;

  const changes = Object.keys(run.misses)
    .filter((person) => person in previous.misses && JSON.stringify(previous.misses[person]) !== JSON.stringify(run.misses[person]))
    .map((person) => `   Personne_${person.padStart(2, '0')}  ${describe(previous.misses[person])}  →  ${describe(run.misses[person])}`);
  const when = new Date(previous.date).toLocaleString('fr-CH');
  console.log(changes.length ? `\nChangements depuis la passe du ${when} :\n${changes.join('\n')}` : `\nAucun changement depuis la passe du ${when}.`);
}
