// Runs PortraitAnalyzer on the test people (public/portraits) and returns compact
// measurements + decisions next to the ground truth.
// Usage from browser_evaluate: (await import('/tools/playwright/analyze.ts')).run([1, 2, 3])
import { PortraitAnalyzer, type PhotoSources } from '/src/scan/PortraitAnalyzer.ts';
import { rgbToHex, rgbToOklab, type Rgb } from '/src/scan/color.ts';
import { topColor } from '/src/scan/clothes.ts';
import type { Look } from '/src/character/Character.ts';
import { PEOPLE, VIEWS, photoUrl, type Truth } from './portraits.ts';

/** Rounded measurements of a person (see run()). */
export interface PersonAnalysis {
  truth?: Truth;
  look: Partial<Look>;
  [measure: string]: unknown;
}

let analyzer: PortraitAnalyzer | undefined;

export async function loadPerson(person: number): Promise<PhotoSources> {
  const [front, left, right, back] = await Promise.all(VIEWS.map(async (view) => {
    const img = new Image();
    img.src = photoUrl(person, view);
    await img.decode();
    return img;
  }));
  return { front, left, right, back };
}

function round(value: number): number;
function round(value: unknown): unknown;
function round(value: unknown): unknown {
  if (Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === 'number' && v > 1)) return rgbToHex(value as Rgb);
  if (Array.isArray(value)) return value.map(round);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'marks' && k !== 'p' && k !== 'pixels').map(([k, v]) => [k, round(v)]));
  }
  return typeof value === 'number' ? Math.round(value * 100) / 100 : value;
}

export async function run(people = Object.keys(PEOPLE).map(Number), { features = true } = {}) {
  analyzer ??= await PortraitAnalyzer.create();
  const out: Record<number, PersonAnalysis> = {};
  for (const person of people) {
    const result = await analyzer.analyze(await loadPerson(person));
    const f = result.features;
    out[person] = {
      truth: PEOPLE[person],
      look: round(result.look) as Partial<Look>, // a look only has strings: kept as is
      ageGender: round(f.ageGender),
      faceRaw: f.faceRaw,
      ...(features && {
        hair: round(f.hair), glasses: round(f.glasses), facialHair: round(f.facialHair),
        left: round(f.left), right: round(f.right),
        // Colour of the top before it is matched to the palette, and its OKLab lightness / chroma.
        top: (() => {
          const rgb = topColor([f.clothesFront, f.clothesBack]);
          if (!rgb) return null;
          const [L, a, b] = rgbToOklab(rgb);
          return { color: rgbToHex(rgb), L: round(L), chroma: round(Math.hypot(a, b) * 100) / 100 };
        })(),
      }),
    };
  }
  return out;
}

/** Front-only analysis of loose test photos in .playwright-mcp/faces (not committed). */
export async function runFronts(names: string[]) {
  analyzer ??= await PortraitAnalyzer.create();
  const out: Record<string, unknown> = {};
  for (const name of names) {
    const img = new Image();
    img.src = `/.playwright-mcp/faces/${name}.jpg`;
    await img.decode();
    const { look, features } = await analyzer.analyze({ front: img });
    out[name] = { look: round(look), glasses: round(features.glasses), facialHair: round(features.facialHair) };
  }
  return out;
}
