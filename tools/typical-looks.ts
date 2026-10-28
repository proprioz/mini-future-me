// Writes docs/profils-types.md: the most likely look by gender and age group (population.ts), the
// look the face scan starts from. Usage: pnpm profils
import { writeFileSync } from 'node:fs';
import {
  FREQUENCY_KEYS, frequencies, typicalLook,
  type AgeGroup, type FrequencyKey, type Gender, type SkinGroup, type VisitorContext,
} from '../src/character/population.ts';
import { FIELDS, optionLabel } from '../src/scan/classify.ts';

const COLUMNS: { gender: Gender; age: AgeGroup; label: string }[] = [];
for (const gender of ['f', 'm'] as const) {
  for (const [age, ageLabel] of [['teen', '< 20 ans'], ['adult', '20–44 ans'], ['senior', '45 ans et +']] as const) {
    COLUMNS.push({ gender, age, label: `${gender === 'f' ? 'Femme' : 'Homme'} ${ageLabel}` });
  }
}

/** « Option (n %) » for the most likely option, and the runner-up if it is close. */
function cell(key: FrequencyKey, context: VisitorContext) {
  const entries = Object.entries(frequencies(key, context)).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const pct = (w: number) => `${Math.round((100 * w) / total)} %`;
  const [[id, w], second] = entries;
  const runnerUp = second && second[1] >= w * 0.6 ? `, puis ${optionLabel(key, second[0])} (${pct(second[1])})` : '';
  return `**${optionLabel(key, id)}** (${pct(w)})${runnerUp}`;
}

function table(skin: SkinGroup) {
  const rows = [`| | ${COLUMNS.map((c) => c.label).join(' | ')} |`, `|---|${COLUMNS.map(() => '---').join('|')}|`];
  for (const key of FREQUENCY_KEYS) {
    if (!FIELDS[key]) continue;
    rows.push(`| ${FIELDS[key][0]} | ${COLUMNS.map(({ gender, age }) => {
      const typical = typicalLook({ gender, age, skin });
      return cell(key, { gender, age, skin, hair: typical.hair, beard: typical.beard });
    }).join(' | ')} |`);
  }
  return rows.join('\n');
}

const SKINS: [SkinGroup, string][] = [['light', 'Peau claire'], ['medium', 'Peau mate'], ['dark', 'Peau foncée']];
const doc = `# Profils types

Le look le plus probable selon le genre apparent et l'âge, avec sa fréquence (et la 2ᵉ option quand elle
est proche). Le scan estime d'abord le genre apparent et l'âge, part de ce look, puis le corrige avec ce qu'il
mesure : une mesure nette l'emporte, une mesure hésitante retombe sur le plus probable.

Fichier généré par \`pnpm profils\` depuis \`src/character/population.ts\` (sources des chiffres en tête
de ce fichier) : ne pas le modifier à la main. L'estimation sert seulement de point de départ au scan.

${SKINS.map(([skin, label]) => `## ${label}\n\n${table(skin)}`).join('\n\n')}
`;
writeFileSync(new URL('../docs/profils-types.md', import.meta.url), doc);
console.log('docs/profils-types.md écrit');
