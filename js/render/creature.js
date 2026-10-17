// Procedural creatures. Everything is drawn from shapes, so creatures stay crisp at any size.
// A creature is centered on (0, 0); features come from creatureFeatures() in species/catalog.js.

import { PALETTE, shade } from '../core/palette.js';

const MOUTH = 0x5a3a36;

// Rough body geometry per body plan, used to place features inside the outline.
function geometry(body, R) {
  if (body === 'wide') return { top: -0.72 * R, bottom: 0.88 * R, cy: 0.08 * R, rx: 1.18 * R, ry: 0.8 * R, eyeY: -0.1 * R, eyeDx: 0.36 * R, earX: 0.62 * R };
  if (body === 'pear') return { top: -1.02 * R, bottom: 0.84 * R, cy: -0.05 * R, rx: 0.92 * R, ry: 0.97 * R, eyeY: -0.3 * R, eyeDx: 0.26 * R, earX: 0.3 * R };
  return { top: -0.88 * R, bottom: 0.88 * R, cy: 0, rx: R, ry: 0.88 * R, eyeY: -0.18 * R, eyeDx: 0.3 * R, earX: 0.45 * R };
}

function halfWidth(geo, y) {
  const v = (y - geo.cy) / geo.ry;
  return v >= 1 ? 0 : geo.rx * Math.sqrt(1 - v * v);
}

function bodyPath(g, body, R) {
  if (body === 'round') return g.ellipse(0, 0, R, 0.88 * R);
  if (body === 'wide') return g.ellipse(0, 0.08 * R, 1.18 * R, 0.8 * R);
  return g
    .moveTo(0, -1.02 * R)
    .bezierCurveTo(0.6 * R, -1.02 * R, 0.98 * R, 0.05 * R, 0.92 * R, 0.5 * R)
    .bezierCurveTo(0.86 * R, 0.92 * R, -0.86 * R, 0.92 * R, -0.92 * R, 0.5 * R)
    .bezierCurveTo(-0.98 * R, 0.05 * R, -0.6 * R, -1.02 * R, 0, -1.02 * R)
    .closePath();
}

const SPOTS = [
  [-0.66, 0.05, 0.12],
  [0.64, -0.05, 0.11],
  [-0.42, 0.52, 0.1],
  [0.45, 0.5, 0.1],
  [0.02, 0.64, 0.08],
  [-0.3, -0.6, 0.08],
  [0.34, -0.58, 0.07],
];

export class Creature extends PIXI.Container {
  constructor(features, { size = 120, idle = true } = {}) {
    super();
    this.size = size;
    this.idle = idle;
    this.phase = Math.random() * Math.PI * 2;
    this.blinkIn = 1200 + Math.random() * 3000;
    this.blinking = 0;
    this.shadow = new PIXI.Graphics();
    this.body = new PIXI.Container();
    this.inner = new PIXI.Container();
    this.body.addChild(this.inner);
    this.addChild(this.shadow, this.body);
    this.setFeatures(features);
    this._tick = (t) => this.update(t.deltaMS);
    PIXI.Ticker.shared.add(this._tick);
  }

  setFeatures(f) {
    this.features = f;
    this.inner.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.draw(f);
  }

  draw(f) {
    const R = this.size / 2;
    const geo = geometry(f.body, R);
    const color = f.bodyColor;
    const outline = shade(color, -0.38);
    const lw = Math.max(1.5, R * 0.045);

    // Squash and stretch from the feet: body pivots at its bottom.
    this.body.position.set(0, geo.bottom);
    this.inner.position.set(0, -geo.bottom);

    this.shadow.clear().ellipse(0, geo.bottom + 0.04 * R, 0.75 * geo.rx, 0.1 * R).fill({ color: PALETTE.ink, alpha: 0.08 });

    const back = new PIXI.Graphics();
    this.inner.addChild(back);

    // Tail, on the right side behind the body.
    const tailY = 0.35 * R;
    const tailX = halfWidth(geo, tailY) * 0.92;
    if (f.tail === 'curly') {
      const cx = tailX + 0.3 * R;
      const cy = tailY - 0.08 * R;
      back.moveTo(tailX, tailY);
      for (let i = 0; i <= 40; i++) {
        const a = Math.PI + (i / 40) * Math.PI * 3.2;
        const r = 0.24 * R * (1 - i / 52);
        back.lineTo(cx + Math.cos(a) * r * -1, cy + Math.sin(a) * r);
      }
      back.stroke({ width: 0.09 * R, color: shade(color, -0.12), cap: 'round', join: 'round' });
    } else if (f.tail === 'straight') {
      back.moveTo(tailX, tailY).lineTo(tailX + 0.42 * R, tailY - 0.28 * R).stroke({ width: 0.08 * R, color: shade(color, -0.12), cap: 'round' });
      back.circle(tailX + 0.44 * R, tailY - 0.3 * R, 0.08 * R).fill(shade(color, -0.25));
    }

    // Antennae: length follows the antenna dose (0 to 1).
    if (f.antennae > 0) {
      const len = R * (0.2 + 0.55 * f.antennae);
      for (const s of [-1, 1]) {
        const x0 = s * 0.16 * R;
        const y0 = geo.top + 0.08 * R;
        const x1 = s * (0.16 * R + 0.28 * len);
        const y1 = geo.top - len;
        back.moveTo(x0, y0).quadraticCurveTo(x0, y1 + len * 0.3, x1, y1).stroke({ width: 0.035 * R, color: shade(color, -0.45), cap: 'round' });
        back.circle(x1, y1, 0.075 * R).fill(PALETTE.ochre).stroke({ width: lw * 0.7, color: shade(PALETTE.ochre, -0.35) });
      }
    }

    // Ears.
    for (const s of [-1, 1]) {
      const ex = s * geo.earX;
      const ty = geo.top;
      if (f.ears === 'perky') {
        back
          .poly([ex - s * 0.2 * R, ty + 0.28 * R, ex + s * 0.08 * R, ty - 0.42 * R, ex + s * 0.3 * R, ty + 0.34 * R])
          .fill(color)
          .stroke({ width: lw, color: outline, join: 'round' });
        back.poly([ex - s * 0.08 * R, ty + 0.22 * R, ex + s * 0.07 * R, ty - 0.22 * R, ex + s * 0.18 * R, ty + 0.26 * R]).fill({ color: PALETTE.blush, alpha: 0.7 });
      } else if (f.ears === 'nub') {
        back.circle(ex, ty + 0.1 * R, 0.13 * R).fill(color).stroke({ width: lw, color: outline });
      }
    }

    // Feet or fins.
    const limbs = new PIXI.Graphics();
    if (f.body === 'pear') {
      for (const s of [-1, 1]) {
        const fin = new PIXI.Graphics().ellipse(0, 0, 0.28 * R, 0.13 * R).fill(shade(color, -0.12)).stroke({ width: lw, color: outline });
        fin.position.set(s * 0.88 * R, 0.4 * R);
        fin.rotation = s * 0.55;
        this.inner.addChild(fin);
      }
    } else {
      const fx = f.body === 'wide' ? 0.55 * R : 0.42 * R;
      for (const s of [-1, 1]) limbs.ellipse(s * fx, geo.bottom - 0.03 * R, 0.25 * R, 0.13 * R).fill(shade(color, -0.15)).stroke({ width: lw, color: outline });
    }
    this.inner.addChild(limbs);

    // Body.
    const bodyG = new PIXI.Graphics();
    bodyPath(bodyG, f.body, R).fill(color).stroke({ width: lw, color: outline });
    bodyG.ellipse(0, geo.cy + 0.45 * geo.ry, 0.5 * geo.rx, 0.3 * geo.ry).fill({ color: shade(color, 0.28), alpha: 0.55 });
    this.inner.addChild(bodyG);

    // Pattern.
    const pat = new PIXI.Graphics();
    const dark = shade(color, -0.3);
    if (f.stripes) {
      for (const v of [0.34, 0.52, 0.7]) {
        const y = geo.cy + v * geo.ry;
        const hw = halfWidth(geo, y) * 0.8;
        pat.moveTo(-hw, y - 0.07 * R).quadraticCurveTo(0, y + 0.1 * R, hw, y - 0.07 * R).stroke({ width: 0.07 * R, color: dark, alpha: 0.8, cap: 'round' });
      }
    }
    if (f.spots) {
      const list = f.stripes ? SPOTS.filter(([, v]) => v < 0.3) : SPOTS;
      for (const [u, v, r] of list) {
        const y = geo.cy + v * geo.ry;
        const x = u * geo.rx;
        if (Math.abs(x) + r * R > halfWidth(geo, y)) continue;
        pat.circle(x, y, r * R).fill({ color: dark, alpha: 0.85 });
      }
    }
    this.inner.addChild(pat);

    // Floppy ears hang over the sides of the head, in front of the body.
    if (f.ears === 'floppy') {
      for (const s of [-1, 1]) {
        const ear = new PIXI.Graphics()
          .ellipse(0, 0.3 * R, 0.17 * R, 0.36 * R)
          .fill(shade(color, -0.08))
          .stroke({ width: lw, color: outline });
        ear.ellipse(0, 0.34 * R, 0.08 * R, 0.22 * R).fill({ color: PALETTE.blush, alpha: 0.55 });
        const attachY = geo.top + 0.22 * R;
        ear.position.set(s * (halfWidth(geo, attachY) - 0.04 * R), attachY);
        ear.rotation = -s * 0.5;
        this.inner.addChild(ear);
      }
    }

    // Face.
    const face = new PIXI.Graphics();
    for (const s of [-1, 1]) face.ellipse(s * (geo.eyeDx + 0.17 * R), geo.eyeY + 0.22 * R, 0.1 * R, 0.06 * R).fill({ color: PALETTE.blush, alpha: 0.5 });
    const my = geo.eyeY + 0.24 * R;
    if (f.body === 'wide') {
      face.moveTo(-0.32 * R, my).quadraticCurveTo(0, my + 0.44 * R, 0.32 * R, my).closePath().fill(MOUTH);
      face.roundRect(-0.17 * R, my - 0.01 * R, 0.11 * R, 0.12 * R, 0.025 * R).fill(0xffffff);
      face.roundRect(0.06 * R, my - 0.01 * R, 0.11 * R, 0.12 * R, 0.025 * R).fill(0xffffff);
    } else if (f.body === 'pear') {
      face.ellipse(0, my, 0.055 * R, 0.065 * R).fill(MOUTH);
    } else {
      face.moveTo(-0.11 * R, my).quadraticCurveTo(0, my + 0.11 * R, 0.11 * R, my).stroke({ width: 0.035 * R, color: PALETTE.ink, cap: 'round' });
    }
    this.inner.addChild(face);

    this.eyes = new PIXI.Container();
    this.eyes.position.set(0, geo.eyeY);
    const eyesG = new PIXI.Graphics();
    for (const s of [-1, 1]) {
      const x = s * geo.eyeDx;
      eyesG.circle(x, 0, 0.16 * R).fill(0xffffff).stroke({ width: lw * 0.7, color: outline });
      eyesG.circle(x + 0.02 * R, 0.02 * R, 0.085 * R).fill(PALETTE.ink);
      eyesG.circle(x - 0.01 * R, -0.02 * R, 0.03 * R).fill(0xffffff);
    }
    this.eyes.addChild(eyesG);
    this.inner.addChild(this.eyes);
  }

  update(dt) {
    if (this.destroyed || !this.idle) return;
    this.phase += dt / 1000;
    const s = Math.sin(this.phase * 2.4);
    this.body.scale.set(1 - 0.012 * s, 1 + 0.025 * s);
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinking = 140;
      this.blinkIn = 2000 + Math.random() * 3500;
    }
    if (this.blinking > 0) {
      this.blinking -= dt;
      this.eyes.scale.y = 0.12;
    } else {
      this.eyes.scale.y = 1;
    }
  }

  destroy(options) {
    PIXI.Ticker.shared.remove(this._tick);
    super.destroy(options ?? { children: true });
  }
}
