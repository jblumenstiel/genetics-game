// Chromatids and cells.
//
// A ChromatidView draws one chromatid vertically, colored segment by segment by haplotype, with the pivot
// at the centromere so it can be positioned and rotated around it. Locus bands carry allele labels.

import { PALETTE, shade } from '../core/palette.js';

export const FONT = 'Nunito, system-ui, sans-serif';

export function label(text, size, opts = {}) {
  const t = new PIXI.Text({
    text,
    style: { fontFamily: FONT, fontSize: size, fontWeight: '700', fill: PALETTE.ink, ...opts },
    resolution: Math.max(2, window.devicePixelRatio || 1),
  });
  return t;
}

export class ChromatidView extends PIXI.Container {
  // loci: [{ locus, text }] bands to draw. labelSide: 1 (right) or -1 (left).
  constructor(chromatid, def, { scale, width, loci = [], labelSide = 1 } = {}) {
    super();
    this.chromatid = chromatid;
    this.def = def;
    this.w = width;
    this.labels = [];
    this.draw(scale, loci, labelSide);
  }

  draw(scale, loci, labelSide) {
    const { def, chromatid, w } = this;
    const c = def.centromere;
    const gap = w * 0.2;
    const top = -c * scale;
    const bottom = (def.length - c) * scale;
    const arms = [
      [top, -gap],
      [gap, bottom],
    ].filter(([a, b]) => b - a > 1);

    const fill = new PIXI.Graphics();
    for (const s of chromatid.segments) {
      const y0 = (s.from - c) * scale;
      const y1 = (s.to - c) * scale;
      fill.rect(-w / 2, y0, w, y1 - y0).fill(s.hap.color ?? PALETTE.dusk);
    }
    for (const { locus } of loci) {
      const y = (locus.pos - c) * scale;
      fill.rect(-w / 2, y - Math.max(1.5, w * 0.09), w, Math.max(3, w * 0.18)).fill({ color: PALETTE.ink, alpha: 0.75 });
    }
    const mask = new PIXI.Graphics();
    for (const [a, b] of arms) mask.roundRect(-w / 2, a, w, b - a, w / 2).fill(0xffffff);
    fill.mask = mask;

    const outline = new PIXI.Graphics();
    const base = chromatid.segments[0]?.hap.color ?? PALETTE.dusk;
    for (const [a, b] of arms) outline.roundRect(-w / 2, a, w, b - a, w / 2).stroke({ width: 1.5, color: shade(base, -0.4), alpha: 0.7 });
    outline.ellipse(0, 0, w * 0.32, gap * 1.1).fill({ color: shade(base, -0.45), alpha: 0.85 });

    this.addChild(mask, fill, outline);

    this.labelSide = labelSide;
    for (const { locus, text } of loci) {
      const y = (locus.pos - c) * scale;
      const t = label(text, Math.max(13, w * 1.15));
      t.anchor.set(labelSide > 0 ? 0 : 1, 0.5);
      const holder = new PIXI.Container();
      holder.position.set(labelSide * (w / 2 + 5), y);
      holder.addChild(t);
      this.addChild(holder);
      this.labels.push(holder);
    }
  }

  // Keep allele labels upright however the chromatid is rotated.
  uprightLabels() {
    const r = this.rotation + (this.parent?.rotation ?? 0);
    const s = 1 / Math.max(0.3, this.scale.x);
    for (const l of this.labels) {
      l.rotation = -r;
      l.scale.set(s);
    }
  }

  // Hide labels that point at a neighboring chromatid, so paired chromosomes only label their outer sides.
  avoidNeighbors(others) {
    const dx = Math.cos(this.rotation) * this.labelSide;
    const dy = Math.sin(this.rotation) * this.labelSide;
    const reach = this.w * 3 * this.scale.x;
    const blocked = others.some((o) => {
      if (o === this || o.alpha < 0.5) return false;
      const vx = o.x - this.x;
      const vy = o.y - this.y;
      return vx * dx + vy * dy > 0 && Math.hypot(vx, vy) < reach;
    });
    for (const l of this.labels) l.alpha = blocked ? 0 : 1;
  }
}

// Draws any number of cell membranes from plain records { x, y, rx, ry, alpha } that tweens can animate.
export class CellLayer extends PIXI.Graphics {
  constructor() {
    super();
    this.cells = [];
    this.nuclei = [];
  }

  render() {
    this.clear();
    for (const e of this.cells) {
      if (e.alpha < 0.01) continue;
      this.ellipse(e.x, e.y, e.rx, e.ry).fill({ color: PALETTE.cell, alpha: e.alpha }).stroke({ width: 3, color: PALETTE.cellEdge, alpha: e.alpha });
    }
    for (const e of this.nuclei) {
      if (e.alpha < 0.01) continue;
      this.ellipse(e.x, e.y, e.rx, e.ry).fill({ color: PALETTE.nucleus, alpha: e.alpha * 0.6 }).stroke({ width: 2, color: PALETTE.cellEdge, alpha: e.alpha * 0.7 });
    }
  }
}

// Spindle fibers from poles to kinetochores, and a dashed metaphase plate.
export class SpindleLayer extends PIXI.Graphics {
  constructor() {
    super();
    this.state = { alpha: 0 };
    this.fibers = [];
    this.poles = [];
    this.plates = [];
  }

  render() {
    this.clear();
    const a = this.state.alpha;
    if (a < 0.01) return;
    for (const p of this.plates) {
      const dx = p.x2 - p.x1;
      const dy = p.y2 - p.y1;
      const len = Math.hypot(dx, dy);
      for (let d = 0; d < len; d += 12) {
        const t0 = d / len;
        const t1 = Math.min(1, (d + 6) / len);
        this.moveTo(p.x1 + dx * t0, p.y1 + dy * t0).lineTo(p.x1 + dx * t1, p.y1 + dy * t1);
      }
      this.stroke({ width: 2, color: PALETTE.spindle, alpha: a * 0.8 });
    }
    for (const [pole, target] of this.fibers) {
      this.moveTo(pole.x, pole.y).lineTo(target.x, target.y).stroke({ width: 1.2, color: PALETTE.spindle, alpha: a * 0.7 });
    }
    for (const p of this.poles) this.circle(p.x, p.y, 5).fill({ color: PALETTE.spindle, alpha: a });
  }
}
