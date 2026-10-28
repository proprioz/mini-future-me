// Contact sheet: renders a list of looks at large size in an overlay, for visual review.
// Usage from browser_evaluate: (await import("/tools/playwright/sheet.ts"), window.sheet([{ look, view, heading, label }], cols))
interface Window {
  sheet(items: {
    look: Partial<import('/src/character/Character.ts').Look>;
    view?: import('/src/render/CharacterStage.ts').ViewName;
    heading?: number;
    label?: string;
  }[], cols?: number, size?: number): void;
}

window.sheet = (items, cols = 4, size = 300) => {
  const { creator } = window.studio;
  const stage = creator.thumbnailer.stage;
  const ch = creator.thumbnailer.character;
  document.getElementById('sheet')?.remove();
  const el = document.createElement('div');
  el.id = 'sheet';
  el.style.cssText = `position:fixed;inset:0;z-index:99;background:#cdeee8;display:grid;grid-template-columns:repeat(${cols},${size}px);gap:4px;align-content:start;padding:4px`;
  stage.renderer.setPixelRatio(1);
  stage.setSize(size, size);
  for (const { look, view = 'head', heading = 0.4, label = '' } of items) {
    ch.setLook({ ...creator.look, ...look });
    ch.heading = ch.targetHeading = heading;
    ch.update(0, 0);
    stage.setView(view);
    stage.render();
    const fig = document.createElement('figure');
    fig.style.cssText = 'margin:0;position:relative;background:#ffffff';
    const img = document.createElement('img');
    img.src = stage.canvas.toDataURL();
    img.width = img.height = size;
    fig.append(img, Object.assign(document.createElement('figcaption'), { textContent: label, style: 'position:absolute;top:4px;left:8px;font:700 14px sans-serif' }));
    el.append(fig);
  }
  stage.setSize(168, 168);
  document.body.append(el);
};
