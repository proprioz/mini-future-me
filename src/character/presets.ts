import { DEFAULT_LOOK, type Look } from './Character.ts';
import { likelyLook } from './options.ts';

// Ready-made characters, for visitors who would rather not play as themselves: famous characters of
// films, books and games, never named (only a nickname) and drawn in the game's own style. Their faces
// and haircuts are options of « Crée ton perso »; what makes each one recognisable (clothes, a hat,
// what the hand holds, the young wizard's scar) no list offers, so neither « Au hasard » nor the scan
// ever gives it, and the welcome screen shows it only on a whole famous character: a value of a look
// key missing from its list in options.ts (or `held`, which has none), drawn like any other (Character.ts, accessories.ts, FaceTexture.ts).

/** A ready-made character of the « Célèbres » tab. */
export interface Preset {
  id: string;
  label: string;
  look: Look;
}

export const PRESETS: Preset[] = [
  {
    // Lightning-bolt scar (FaceTexture.ts), black school robe with a striped scarf, the pointed hat, a wand.
    id: 'young-wizard', label: 'Le petit sorcier',
    look: {
      ...DEFAULT_LOOK, skin: '#f6d0b1', eyeColor: '#4f8f5a', skinMarks: 'scar', hair: '#1f1612', hairStyle: 'short',
      beardColor: '#1f1612', outfit: 'schoolRobe', top: '#2b2b2e', bottom: '#8e9196', shoes: '#2b2b2e', glasses: 'round', glassesColor: '#2b2d42',
      headwear: 'wizard', headwearColor: '#2b2b2e', held: 'wand',
    },
  },
  {
    // Grey robe tied with a cord, the worn pointed hat (accessories.ts), a tall staff.
    id: 'old-wizard', label: 'Le vieux sorcier',
    look: {
      ...DEFAULT_LOOK, skin: '#f1c7a5', faceShape: 'oval', eyeColor: '#2b1d17', hair: '#d9d4cf', hairStyle: 'medium',
      beard: 'short', mustache: 'thick', beardColor: '#d9d4cf', outfit: 'robe', top: '#8e9196', bottom: '#8e9196', shoes: '#7a5236',
      headwear: 'wizard', headwearColor: '#8e9196', held: 'staff',
    },
  },
  {
    // His own cap (a wrench on the badge), overalls over a red shirt, with white gloves.
    id: 'plumber', label: 'Le plombier',
    look: {
      ...DEFAULT_LOOK, skin: '#f1c7a5', faceShape: 'round', eyeColor: '#3f7cbf', hair: '#4a3426', hairStyle: 'short',
      mustache: 'thick', beardColor: '#2b1d17', outfit: 'overalls', top: '#b83a44', bottom: '#2f5fb8', shoes: '#7a5236',
      headwear: 'plumberCap', headwearColor: '#b83a44',
    },
  },
  {
    // The game's suit, in black, and a pistol.
    id: 'secret-agent', label: 'L’agent secret',
    look: {
      ...DEFAULT_LOOK, skin: '#f6d0b1', faceShape: 'square', eyeColor: '#3f7cbf', hair: '#4a3426', hairStyle: 'short',
      beardColor: '#4a3426', outfit: 'suit', top: '#2b2b2e', bottom: '#2b2b2e', shoes: '#2b2b2e',
      held: 'pistol',
    },
  },
  {
    // Teal tank top with a belt (over the game's shorts), round sunglasses, a pistol in each hand.
    id: 'adventurer', label: 'L’aventurière',
    look: {
      ...DEFAULT_LOOK, skin: '#f1c7a5', faceShape: 'oval', eyeColor: '#5b3a29', eyeShape: 'almond', hair: '#4a3426', hairStyle: 'braids',
      beardColor: '#4a3426', outfit: 'tankTop', bottomStyle: 'shorts', top: '#3a9a9a', bottom: '#7a5236', shoes: '#4a3426',
      glasses: 'sunRound', glassesColor: '#2b2d42', held: 'pistols',
    },
  },
  {
    // Red basketball jersey with the number 23 (over the game's shorts, red too).
    id: 'basketball', label: 'Le Goat',
    look: {
      ...DEFAULT_LOOK, skin: '#5e3b27', faceShape: 'oval', eyeColor: '#2b1d17', hair: '#1f1612', hairStyle: 'shaved',
      mustache: 'stubble', beardColor: '#1f1612', outfit: 'jersey', bottomStyle: 'shorts', top: '#b83a44', bottom: '#b83a44', shoes: '#f7f3ee',
    },
  },
  {
    // Full mask with a web and big white eyes, red suit with blue sides and a spider on the chest.
    id: 'superhero', label: 'Le super-héros',
    look: {
      ...DEFAULT_LOOK, skin: '#f1c7a5', eyeColor: '#5b3a29', hair: '#4a3426', hairStyle: 'short', beardColor: '#4a3426',
      outfit: 'heroSuit', top: '#b83a44', bottom: '#2f5fb8', shoes: '#b83a44', headwear: 'heroMask', headwearColor: '#b83a44',
    },
  },
];

const FAMOUS_SHARE = 0.2; // of the characters the welcome screen shows

/**
 * The next character the welcome screen shows: about one in five is a famous one (any of PRESETS, never
 * the `previous` one again), the others plausible visitors (likelyLook).
 */
export function welcomeVisitor(previous?: Look): Look {
  const famous = PRESETS.filter((p) => p.look !== previous);
  if (famous.length && Math.random() < FAMOUS_SHARE) return famous[Math.floor(Math.random() * famous.length)].look;
  return likelyLook(Math.random() < 0.5 ? 'f' : 'm');
}
