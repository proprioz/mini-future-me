// Gallery page of a `pnpm portraits` run: Claude's latest analysis, every comparison PNG with its
// verdict, the score, a filter to keep the misses, and a click to enlarge. Plain HTML next to the PNGs,
// opened from the disk.
import type { Miss } from './playwright/portraits.ts';

/** Results of a run by person (simulate.ts): `misses` null without ground truth. */
export type PortraitResults = Record<string, { misses: Miss[] | null }>;

/** Claude's latest analysis; `current` when it is about this run. */
export interface Analysis {
  text: string;
  date: Date;
  current: boolean;
}

const escape = (text: unknown) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);

/** The little Markdown of an analysis (titles, lists, bold, code) as HTML. */
function markdown(text: string) {
  const inline = (line: string) => escape(line).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
  let html = '';
  let list = 0; // depth of the open lists
  for (const line of text.split('\n')) {
    const item = line.match(/^(\s*)- (.*)/);
    const depth = item ? Math.floor(item[1].length / 2) + 1 : 0;
    for (; list > depth; list--) html += '</ul>';
    for (; list < depth; list++) html += '<ul>';
    if (item) html += `<li>${inline(item[2])}</li>`;
    else if (/^#+ /.test(line)) html += `<h3>${inline(line.replace(/^#+ /, ''))}</h3>`;
    else if (line.trim()) html += `<p>${inline(line)}</p>`;
  }
  return html + '</ul>'.repeat(list);
}

/**
 * results: { [person]: { look, misses } } (simulate.ts), files: { [person]: PNG name }, analysis:
 * { text, date, current } (Claude's latest analysis, `current` when it is about this run) or null.
 */
export function galleryHtml(results: PortraitResults, files: Record<string, string>,
  { view, date = new Date(), analysis = null }: { view: string; date?: Date; analysis?: Analysis | false | null }) {
  const people = Object.keys(files).map(Number);
  const checked = people.filter((p) => results[p].misses);
  const passed = checked.filter((p) => !results[p].misses!.length);

  const cards = people.map((person) => {
    const { misses } = results[person];
    // The PNG already shows the name and the verdict (simulate.ts).
    const state = !misses ? 'none' : misses.length ? 'miss' : 'ok';
    return `
    <figure class="card ${state}">
      <img src="${escape(files[person])}" alt="Personne ${person} : photos et perso" loading="lazy">
    </figure>`;
  }).join('');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Portraits et persos</title>
<style>
  :root { --bg: #cdeee8; --card: #fff; --ink: #1d2b4f; --muted: #5d6b85; --miss: #c0392b; --teal: #1a8f86; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; background: var(--bg); color: var(--ink); font: 15px/1.4 system-ui, sans-serif; }
  header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 20px; margin-bottom: 16px; }
  h1 { margin: 0; font-size: 22px; }
  .score { font-weight: 700; }
  .meta { color: var(--muted); font-size: 13px; }
  .filters { margin-left: auto; display: flex; gap: 6px; }
  .filters button { border: 2px solid var(--teal); background: var(--card); color: var(--teal); border-radius: 999px; padding: 4px 12px; font: inherit; font-weight: 600; cursor: pointer; }
  .filters button[aria-pressed="true"] { background: var(--teal); color: #fff; }
  main { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 560px), 1fr)); gap: 12px; }
  .analysis { background: var(--card); border-radius: 12px; padding: 12px 18px; margin-bottom: 16px; border-bottom: 4px solid #b9ddd6; }
  .analysis summary { cursor: pointer; font-weight: 700; }
  .analysis.old summary::after { content: " — passe précédente, pas encore analysée"; color: var(--miss); font-weight: 400; }
  .analysis h3 { font-size: 15px; margin: 12px 0 4px; }
  .analysis ul { margin: 4px 0; padding-left: 20px; }
  .analysis p { margin: 6px 0; }
  .analysis code { background: #eef5f3; padding: 0 4px; border-radius: 4px; }
  .card { margin: 0; background: var(--card); border-radius: 12px; padding: 8px; border-bottom: 4px solid #b9ddd6; cursor: zoom-in; }
  .card.miss { border-bottom-color: var(--miss); }
  .card img { display: block; width: 100%; height: auto; border-radius: 6px; }
  body.misses-only .card:not(.miss) { display: none; }
  dialog { border: 0; padding: 0; background: transparent; max-width: 96vw; }
  dialog::backdrop { background: rgb(29 43 79 / 0.85); }
  dialog img { display: block; max-width: 96vw; max-height: 94vh; border-radius: 10px; }
</style>
</head>
<body>
<header>
  <h1>Portraits et persos</h1>
  ${checked.length ? `<span class="score">${passed.length}/${checked.length} conformes</span>` : ''}
  <span class="meta">Vue « ${escape(view)} » · ${date.toLocaleString('fr-CH')}</span>
  <div class="filters">
    <button type="button" data-filter="all" aria-pressed="true">Toutes (${people.length})</button>
    <button type="button" data-filter="misses" aria-pressed="false">Écarts (${checked.length - passed.length})</button>
  </div>
</header>
${analysis ? `<details class="analysis${analysis.current ? '' : ' old'}" open>
  <summary>Analyse de Claude (${escape(analysis.date.toLocaleString('fr-CH'))})</summary>
  ${markdown(analysis.text)}
</details>` : ''}
<main>${cards}
</main>
<dialog><img alt=""></dialog>
<script>
  const dialog = document.querySelector('dialog');
  for (const card of document.querySelectorAll('.card')) {
    card.addEventListener('click', () => {
      dialog.querySelector('img').src = card.querySelector('img').src;
      dialog.showModal();
    });
  }
  dialog.addEventListener('click', () => dialog.close());
  for (const button of document.querySelectorAll('[data-filter]')) {
    button.addEventListener('click', () => {
      document.body.classList.toggle('misses-only', button.dataset.filter === 'misses');
      for (const other of document.querySelectorAll('[data-filter]')) other.setAttribute('aria-pressed', other === button);
    });
  }
</script>
</body>
</html>
`;
}
