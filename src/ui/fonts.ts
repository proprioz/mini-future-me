/** Resolves once the game's two fonts are loaded: canvases with text are drawn after it. */
export function fontsReady() {
  return Promise.all([
    document.fonts.load('600 40px "Fredoka Variable"'),
    document.fonts.load('800 20px "Nunito Variable"'),
  ]);
}
