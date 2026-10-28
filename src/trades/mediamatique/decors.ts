import { PALETTE as C } from '../../render/palette.ts';
import { H, W, glow, linear } from '../../poster/decors.ts';
import type { Decor } from '../../poster/decors.ts';

// The media trade's own poster decor, painted like the shared ones (poster/decors.ts).
export const STUDIO: Decor = { id: 'studio', label: 'Studio photo', draw: drawStudio };

function drawStudio(g: CanvasRenderingContext2D) {
  g.fillStyle = linear(g, 0, 0, 0, H, [[0, '#ffe08a'], [0.6, C.sun], [1, '#f2ad25']]);
  g.fillRect(0, 0, W, H);
  // The paper backdrop curves into the floor, lit from above.
  g.fillStyle = linear(g, 0, 880, 0, H, [[0, 'rgba(255, 246, 214, 0)'], [0.3, 'rgba(255, 246, 214, 0.6)'], [1, 'rgba(255, 246, 214, 0.2)']]);
  g.fillRect(0, 880, W, H - 880);
  glow(g, 500, 760, 620, 'rgba(255, 255, 255, 0.65)');
  for (const side of [-1, 1]) softbox(g, 500 + side * 405, 660, side);
}

/** A softbox on its tripod, turned towards the centre. */
function softbox(g: CanvasRenderingContext2D, x: number, y: number, side: number) {
  g.strokeStyle = C.ink;
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, 1040);
  for (const spread of [-60, 0, 60]) {
    g.moveTo(x, 1000);
    g.lineTo(x + spread, 1090 - Math.abs(spread) * 0.3);
  }
  g.stroke();

  g.save();
  g.translate(x, y);
  g.rotate(side * -0.3);
  g.fillStyle = C.ink;
  g.beginPath();
  g.roundRect(-95, -125, 190, 250, 22);
  g.fill();
  g.fillStyle = '#fffaf0';
  g.beginPath();
  g.roundRect(-80, -110, 160, 220, 14);
  g.fill();
  g.restore();
  glow(g, x - side * 40, y, 260, 'rgba(255, 255, 255, 0.5)');
}
