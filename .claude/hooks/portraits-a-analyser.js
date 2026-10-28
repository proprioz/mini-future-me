// UserPromptSubmit hook: when a `pnpm portraits` run has not been analysed yet (no portraits-analyse.md
// newer than resultats.json), tells Claude once, so the improvement loop of the portraits skill also follows
// the runs started from a terminal. Silent otherwise.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? resolve(import.meta.dirname, '../..');
const OUT = join(ROOT, '.playwright-mcp/comparaisons');
const RESULTS = join(OUT, 'resultats.json');
const ANALYSIS = join(ROOT, '.playwright-mcp/portraits-analyse.md');
const NOTIFIED = join(OUT, '.signale');
const HISTORY = join(ROOT, '.playwright-mcp/portraits-historique.jsonl');

const mtime = (file) => (existsSync(file) ? statSync(file).mtimeMs : 0);
const run = mtime(RESULTS);
const notified = existsSync(NOTIFIED) ? Number(readFileSync(NOTIFIED, 'utf8')) : 0;
if (!run || mtime(ANALYSIS) > run || notified === run) process.exit(0);
writeFileSync(NOTIFIED, String(run));

const runs = existsSync(HISTORY) ? readFileSync(HISTORY, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
const last = runs.at(-1);
const checked = last ? Object.values(last.misses).filter(Boolean) : [];
const score = checked.length ? `${checked.filter((m) => !m.length).length}/${checked.length} conformes` : 'score inconnu';
const who = last?.origine === 'terminal' ? "lancée par l'utilisateur dans un terminal" : 'lancée par Claude';
const date = new Date(last?.date ?? run).toLocaleString('fr-CH');

console.log(JSON.stringify({
  systemMessage: `Passe pnpm portraits du ${date} pas encore analysée (${score}).`,
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: `Une passe \`pnpm portraits\` du ${date}, ${who}, n'a pas encore été analysée (${score}). `
      + "Après avoir répondu à la demande de l'utilisateur (ou d'abord si elle porte sur les portraits), charge le skill "
      + '« portraits » et fais l\'étape « Analyser » sur cette passe : résultats dans .playwright-mcp/comparaisons/, '
      + 'historique dans .playwright-mcp/portraits-historique.jsonl, journal dans docs/portraits-journal.md.',
  },
}));
