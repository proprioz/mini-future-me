// Side by side: the 4 photos of each test person and the perso the scan builds from them, seen
// from the same 4 angles.
// Usage from browser_evaluate: (await import('/tools/playwright/simulate.ts')).show([1, 2, 3])
// or, for every person and a PNG per person, `pnpm portraits` (tools/compare-portraits.ts).
import { DEFAULT_LOOK, type Look } from '/src/character/Character.ts';
import type { ViewName } from '/src/render/CharacterStage.ts';
import { run } from './analyze.ts';
import { PEOPLE, VIEWS, check, photoUrl, type Miss } from './portraits.ts';

// Same order as VIEWS: face, left profile (looks to the left of the picture), right profile, back.
const HEADINGS = [0, -Math.PI / 2, Math.PI / 2, Math.PI];

/** Returns { [person]: { look, misses, measures } }, misses being null for a person without truth (portraits.ts). */
export async function show(people = Object.keys(PEOPLE).map(Number),
  { view = 'head', cols = 2, width = 150 }: { view?: ViewName; cols?: number; width?: number } = {}) {
  const W = width;
  const H = Math.round((width * 4) / 3); // the photos are 600×800
  const { creator } = window.studio;
  const stage = creator.thumbnailer.stage;
  const ch = creator.thumbnailer.character;
  ch.setExpression('neutral');

  document.getElementById('sheet')?.remove();
  const el = document.createElement('div');
  el.id = 'sheet';
  el.style.cssText = `position:fixed;inset:0;z-index:99;overflow:auto;background:#cdeee8;display:grid;grid-template-columns:repeat(${cols},max-content);gap:8px;align-content:start;padding:8px;font:13px sans-serif`;
  document.body.append(el);

  stage.renderer.setPixelRatio(window.devicePixelRatio); // sharp at 2× in pnpm portraits
  stage.setSize(W, H);
  stage.setView(view);
  const results: Record<number, { look: Partial<Look>; misses: Miss[] | null; measures: Record<string, unknown> }> = {};
  for (const person of people) {
    // The raw measurements too (glasses, facial hair, hair, profiles…): what to look at to know why a choice is wrong.
    const { truth, look, ...measures } = (await run([person]))[person];
    const misses = check(person, look);
    results[person] = { look, misses, measures };
    ch.setLook({ ...DEFAULT_LOOK, ...look });

    const card = document.createElement('figure');
    card.style.cssText = `margin:0;padding:6px;background:#fff;border-radius:10px;display:grid;grid-template-columns:repeat(4,${W}px);gap:4px`;
    const caption = document.createElement('figcaption');
    caption.style.cssText = 'grid-column:1/-1;font-weight:700';
    caption.textContent = `Personne ${person} — ${look.hairStyle ?? '?'}${look.headwear && look.headwear !== 'none' ? ` + ${look.headwear}` : ''}`
      + `${look.glasses && look.glasses !== 'none' ? `, lunettes ${look.glasses}` : ''}`
      + `${look.beard && look.beard !== 'none' ? `, barbe ${look.beard}` : ''}`
      + `${look.mustache && look.mustache !== 'none' ? `, moustache ${look.mustache}` : ''}`;
    const verdict = document.createElement('div');
    verdict.style.cssText = `grid-column:1/-1;color:${misses?.length ? '#c0392b' : '#2e7d32'}`;
    verdict.textContent = !misses ? 'Pas de vérité terrain (portraits.ts)'
      : misses.length ? misses.map(({ key, got, expected }) => `✗ ${key} : ${got} (attendu ${expected})`).join('   ')
        : '✓ conforme à la vérité terrain';
    card.append(caption, verdict);
    for (const v of VIEWS) {
      const img = new Image(W, H);
      img.src = photoUrl(person, v);
      img.style.objectFit = 'cover';
      card.append(img);
    }
    for (const heading of HEADINGS) {
      ch.heading = ch.targetHeading = heading;
      ch.update(0, 0);
      stage.render();
      const img = new Image(W, H);
      img.src = stage.canvas.toDataURL();
      img.style.background = '#f4f1ec';
      card.append(img);
    }
    el.append(card);
  }
  stage.setSize(168, 168);
  return results;
}
