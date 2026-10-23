// Pixi pieces for Module 2: eggs and sperm labeled with a gamete genotype, drawn as in Module 1.

import { PALETTE } from '../../core/palette.js';
import { label } from '../../render/chromosome.js';

// A round egg with its genotype inside.
export function eggView(text, r) {
  const c = new PIXI.Container();
  c.addChild(new PIXI.Graphics().circle(0, 0, r).fill(PALETTE.cell).stroke({ width: 2.5, color: PALETTE.clay }));
  c.addChild(fitted(text, r * 1.7, Math.max(11, r * 0.62)));
  return c;
}

// An oval head, wider than tall, with a wavy tail on the right.
export function spermView(text, r) {
  const c = new PIXI.Container();
  const rx = r * 0.86;
  const ry = r * 0.56;
  const tail = new PIXI.Graphics();
  const len = r * 1.3;
  tail.moveTo(rx - 1, 0);
  const waves = 3;
  for (let k = 0; k < waves; k++) {
    const x0 = rx + (len * k) / waves;
    const x1 = rx + (len * (k + 1)) / waves;
    const dy = (k % 2 ? -1 : 1) * r * 0.24;
    tail.quadraticCurveTo((x0 + x1) / 2, dy, x1, 0);
  }
  tail.stroke({ width: 2.5, color: PALETTE.dusk, cap: 'round' });
  c.addChild(tail, new PIXI.Graphics().ellipse(0, 0, rx, ry).fill(PALETTE.cell).stroke({ width: 2.5, color: PALETTE.dusk }));
  c.addChild(fitted(text, rx * 1.8, Math.max(11, r * 0.5)));
  return c;
}

// A centered bold label, shrunk until it fits the given width.
function fitted(text, maxWidth, size) {
  const t = label(text, size, { fontWeight: '800' });
  if (t.width > maxWidth) t.scale.set(maxWidth / t.width);
  t.anchor.set(0.5);
  return t;
}
