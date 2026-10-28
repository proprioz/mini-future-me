// Art direction "Lagon": a floating diorama in the spirit of Monument Valley, with Wes Anderson
// pastels (blush pink walls, honey parquet, teal) and chunky Nintendo-like UI.
// Teal = environment and selection, coral = actions, sunflower = rewards and light, navy = ink.
// The CSS tokens in style.css mirror these values.
export const PALETTE = {
  ink: '#1e3a4c',
  inkSoft: '#3d5a6c',
  paper: '#ffffff',
  mist: '#eff9f7',

  teal: '#1db3a6',
  tealDeep: '#1f5866',
  tealMuted: '#2a7f86',
  aqua: '#8fe3d6',
  coral: '#ff6584',
  blush: '#ff9fb2',
  sun: '#ffc83d',
  sky: '#5aa9ff',
  lilac: '#a98bff',
  leaf: '#3fae7f',
  chroma: '#3cc46c', // the photo corner's green screen

  // Room shell.
  wall: '#ffd9d6',
  wainscot: '#f6aeb6',
  trim: '#ffffff',
  wood: '#d09a63',
  parquet: ['#f0c28b', '#e8b57d', '#f4ca98', '#e3ac73'],
};

// Lighting shared by the game and the character previews: warm sun, sky-blue fill and a
// pink-violet bounce from below, so shadows stay coloured instead of grey.
export const LIGHT = {
  sky: '#eefcff',
  ground: '#c39bb3',
  sun: '#fff3e3',
};
