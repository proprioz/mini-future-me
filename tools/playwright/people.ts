// The 20 test people of public/portraits, rebuilt by hand with the creator's options: checks that
// every feature seen on the photos can be reproduced.
// Usage from browser_evaluate: (await import("/tools/playwright/people.ts")).show(view, heading)
import './sheet.ts';
import type { ViewName } from '/src/render/CharacterStage.ts';

const BLACK = '#1f1612';
const BROWN = '#4a3426';
const CHESTNUT = '#7a4a2a';
const RED = '#b5672e';
const BLOND = '#e8c27a';
const GREY = '#8f8a85';
const WHITE = '#d9d4cf';

export const PEOPLE = [
  // 1: messy black bun, white t-shirt
  { skin: '#f1c7a5', faceShape: 'oval', eyeShape: 'almond', eyeColor: '#2b1d17', hair: BLACK, hairStyle: 'bun', outfit: 'tshirt', top: '#f7f3ee' },
  // 2: salt-and-pepper short hair, grey stubble, grey-blue eyes
  { skin: '#f1c7a5', faceShape: 'square', eyeColor: '#3f7cbf', hair: GREY, hairStyle: 'short', beard: 'stubble', beardColor: GREY, outfit: 'tshirt', top: '#2f3a56' },
  // 3: wavy shoulder-length blond hair, grey-blue eyes, cream sweater
  { skin: '#f6d0b1', faceShape: 'oval', eyeColor: '#3f7cbf', hair: BLOND, hairStyle: 'long', outfit: 'sweater', top: '#f7f3ee' },
  // 4: black hair with a fringe, black rectangular glasses, burgundy sweater
  { skin: '#f1c7a5', faceShape: 'oval', eyeShape: 'almond', eyeColor: '#2b1d17', hair: BLACK, hairStyle: 'short', glasses: 'square', glassesColor: '#2b2d42', outfit: 'sweater', top: '#b83a44' },
  // 5: long dark brown curls with copper highlights, beige sweater
  { skin: '#c98f66', faceShape: 'oval', eyeShape: 'almond', eyeColor: '#5b3a29', hair: BROWN, hairStyle: 'curlyLong', outfit: 'sweater', top: '#cdb497' },
  // 6: long straight red hair, green-grey eyes, black sweater
  { skin: '#ffe3cf', faceShape: 'oval', eyeColor: '#4f8f5a', hair: RED, hairStyle: 'long', outfit: 'sweater', top: '#2b2b2e' },
  // 7: wavy dark brown quiff, thick mustache, brown overshirt on a black t-shirt
  { skin: '#f1c7a5', faceShape: 'oval', eyeColor: '#5b3a29', hair: BROWN, hairStyle: 'short', beard: 'stubble', mustache: 'thick', beardColor: BROWN, outfit: 'jacket', top: '#7a5236' },
  // 8: mauve headscarf (not in the palette: pink), black top
  { skin: '#e2ae86', faceShape: 'round', eyeShape: 'almond', eyeColor: '#2b1d17', headwear: 'headscarf', headwearColor: '#ff9fb1', outfit: 'sweater', top: '#2b2b2e' },
  // 9: short grey hair, charcoal shirt
  { skin: '#e2ae86', faceShape: 'square', eyeShape: 'almond', eyeColor: '#2b1d17', hair: GREY, hairStyle: 'short', outfit: 'shirt', top: '#2b2b2e' },
  // 10: short dark curls, stubble, white t-shirt
  { skin: '#f1c7a5', faceShape: 'oval', eyeColor: '#5b3a29', hair: BLACK, hairStyle: 'curly', beard: 'stubble', beardColor: BLACK, outfit: 'tshirt', top: '#f7f3ee' },
  // 11: short layered grey cut with a side fringe, rectangular glasses, denim shirt
  { skin: '#f6d0b1', faceShape: 'oval', eyeColor: '#8a6a2f', hair: GREY, hairStyle: 'bob', glasses: 'square', glassesColor: '#2b2d42', outfit: 'shirt', top: '#5b7fb8' },
  // 12: messy chestnut curls, short beard, forest-green hoodie
  { skin: '#f6d0b1', faceShape: 'oval', eyeColor: '#8a6a2f', hair: CHESTNUT, hairStyle: 'curly', beard: 'short', mustache: 'thick', beardColor: CHESTNUT, outfit: 'hoodie', top: '#3f7a57' },
  // 13: navy cap, brown ponytail, heather-grey hoodie
  { skin: '#f6d0b1', faceShape: 'oval', eyeColor: '#5b3a29', hair: BROWN, hairStyle: 'ponytail', headwear: 'cap', headwearColor: '#2f3a56', outfit: 'hoodie', top: '#8e9196' },
  // 14: short grey curls, round glasses, black sweater
  { skin: '#f6d0b1', faceShape: 'round', eyeColor: '#8a6a2f', hair: GREY, hairStyle: 'curly', glasses: 'round', glassesColor: '#2b2d42', outfit: 'sweater', top: '#2b2b2e' },
  // 15: bald, short salt-and-pepper beard, black rectangular glasses
  { skin: '#e2ae86', faceShape: 'oval', eyeColor: '#5b3a29', hairStyle: 'bald', beard: 'short', mustache: 'thick', beardColor: BROWN, glasses: 'square', glassesColor: '#2b2d42', outfit: 'tshirt', top: '#2b2b2e' },
  // 16: shoulder-length locs, goatee (with its moustache), navy hoodie
  { skin: '#86563a', faceShape: 'oval', eyeShape: 'almond', eyeColor: '#2b1d17', hair: BLACK, hairStyle: 'locs', beard: 'goatee', mustache: 'thick', beardColor: BLACK, outfit: 'hoodie', top: '#2f3a56' },
  // 17: long box braids, black rectangular glasses, black sweater
  { skin: '#a8714d', faceShape: 'oval', eyeShape: 'almond', eyeColor: '#2b1d17', hair: BLACK, hairStyle: 'locs', glasses: 'square', glassesColor: '#2b2d42', outfit: 'sweater', top: '#2b2b2e' },
  // 18: navy turban (no turban in the game: beanie), long white beard, denim shirt
  { skin: '#a8714d', faceShape: 'oval', eyeColor: '#2b1d17', headwear: 'beanie', headwearColor: '#2f3a56', beard: 'short', mustache: 'thick', beardColor: WHITE, outfit: 'shirt', top: '#5b7fb8' },
  // 19: long straight dark brown hair, black top (blurry photo)
  { skin: '#e2ae86', faceShape: 'oval', eyeShape: 'almond', eyeColor: '#2b1d17', hair: BROWN, hairStyle: 'long', outfit: 'tshirt', top: '#2b2b2e' },
  // 20: very short coily hair (fade), short beard, white t-shirt (blurry photo)
  { skin: '#5e3b27', faceShape: 'square', eyeColor: '#2b1d17', hair: BLACK, hairStyle: 'buzz', beard: 'short', mustache: 'thick', beardColor: BLACK, outfit: 'tshirt', top: '#f7f3ee' },
];

export function show(view: ViewName = 'head', heading = 0.35, size = 270) {
  const ch = window.studio.creator.thumbnailer.character;
  ch.setExpression('neutral');
  ch.update = function update() {
    this.group.rotation.y = this.heading;
    this.animate(0, 0);
  };
  const bare = { glasses: 'none', headwear: 'none', beard: 'none', mustache: 'none', earrings: 'none', eyeShape: 'round', eyeColor: '#5b3a29' };
  window.sheet(PEOPLE.map((look, i) => ({ look: { ...bare, ...look }, view, heading, label: String(i + 1) })), 5, size);
  return PEOPLE.length;
}
