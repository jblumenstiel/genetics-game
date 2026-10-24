// Pixi pieces for Module 2: slide text, bdellbee cards with their genotypes, the placeholder for a genotype that does
// not develop, dosage bars with a threshold line, and the pictures for each mechanism of dominance.

import { PALETTE, shade } from '../../core/palette.js';
import { label } from '../../render/chromosome.js';
import { Creature } from '../../render/creature.js';

const FONT = 'Nunito, system-ui, sans-serif';
const DISPLAY = 'Fraunces, Georgia, serif';

export function text(str, size, { width = null, weight = '600', fill = PALETTE.ink, align = 'left', display = false } = {}) {
  return new PIXI.Text({
    text: str,
    style: {
      fontFamily: display ? DISPLAY : FONT,
      fontSize: size,
      fontWeight: weight,
      fill,
      wordWrap: !!width,
      wordWrapWidth: width ?? 0,
      align,
      lineHeight: Math.round(size * 1.35),
    },
    resolution: 2,
  });
}

// The term and its definition, in a card across the top of the slide. Returns the card; its height is card.h.
export function definitionCard(term, body, width, { compact = false } = {}) {
  const c = new PIXI.Container();
  const pad = compact ? 12 : 16;
  const title = text(term, compact ? 18 : 21, { weight: '600', display: true, width: width - pad * 2 });
  const def = text(body, compact ? 14 : 16, { width: width - pad * 2, fill: PALETTE.ink });
  title.position.set(pad, pad);
  def.position.set(pad, title.y + title.height + 6);
  const h = def.y + def.height + pad;
  c.addChild(new PIXI.Graphics().roundRect(0, 0, width, h, 14).fill(PALETTE.panel).stroke({ width: 1.5, color: PALETTE.line }), title, def);
  c.h = h;
  return c;
}

// A dashed outline where a bdellbee would be, for a genotype that does not develop or survive.
function placeholder(size, caption) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const rx = size * 0.46;
  const ry = size * 0.4;
  const steps = 28;
  for (let i = 0; i < steps; i += 2) {
    const a0 = (i / steps) * Math.PI * 2;
    const a1 = ((i + 1) / steps) * Math.PI * 2;
    g.moveTo(Math.cos(a0) * rx, Math.sin(a0) * ry);
    for (let k = 1; k <= 4; k++) {
      const a = a0 + ((a1 - a0) * k) / 4;
      g.lineTo(Math.cos(a) * rx, Math.sin(a) * ry);
    }
  }
  g.stroke({ width: 2, color: PALETTE.cellEdge, cap: 'round' });
  const t = text(caption, Math.max(10, size * 0.14), { width: rx * 1.7, weight: '700', fill: PALETTE.inkSoft, align: 'center' });
  t.anchor.set(0.5);
  c.addChild(g, t);
  return c;
}

// A bdellbee (or the placeholder) with its genotype and a caption underneath. card.w and card.h give its size;
// it is centered horizontally on x = 0 with its top at y = 0.
export function genotypeCard({ features = null, genotype, caption = '', size = 80, lethalText = 'No bdellbee develops', highlight = false }) {
  const c = new PIXI.Container();
  const figure = features ? new Creature(features, { size }) : placeholder(size, lethalText);
  figure.y = size * 0.55;
  const geno = label(genotype, Math.max(13, size * 0.19), { fill: PALETTE.sage, fontWeight: '800' });
  geno.anchor.set(0.5, 0);
  geno.y = size * 1.12;
  c.addChild(figure, geno);
  let bottom = geno.y + geno.height;
  if (caption) {
    const cap = text(caption, Math.max(11, size * 0.15), { width: size * 1.5, weight: '700', fill: PALETTE.inkSoft, align: 'center' });
    cap.anchor.set(0.5, 0);
    cap.y = bottom + 1;
    c.addChild(cap);
    bottom = cap.y + cap.height;
  }
  if (highlight) {
    const ring = new PIXI.Graphics().roundRect(-size * 0.8, -4, size * 1.6, bottom + 10, 14).fill({ color: PALETTE.ochre, alpha: 0.16 }).stroke({ width: 2, color: PALETTE.ochre, alpha: 0.6 });
    c.addChildAt(ring, 0);
  }
  c.w = Math.max(size * 1.6, geno.width);
  c.h = bottom;
  c.figure = figure;
  return c;
}

// Cards in a centered row, scaled down if they would not fit the width. Returns the row; row.h is its height.
export function cardRow(cards, width, gap = 18) {
  const row = new PIXI.Container();
  const total = cards.reduce((s, c) => s + c.w, 0) + gap * (cards.length - 1);
  let x = -total / 2;
  for (const c of cards) {
    c.x = x + c.w / 2;
    x += c.w + gap;
    row.addChild(c);
  }
  const k = Math.min(1, (width - 8) / total);
  row.scale.set(k);
  row.h = Math.max(...cards.map((c) => c.h)) * k;
  return row;
}

// Bars of working product for each genotype (100%, 50%, 0%), with a dashed threshold line. With onDrag, the line can
// be dragged; onDrag(threshold) receives the new value between 0.05 and 0.95.
export function dosageBars({ bars, width, height, threshold = null, onDrag = null, app = null, barColor = PALETTE.sage }) {
  const c = new PIXI.Container();
  const n = bars.length;
  const axisX = 46;
  const plotW = width - axisX - 8;
  const slot = plotW / n;
  const bw = Math.min(56, slot * 0.5);
  const top = 20;
  const bottom = height - 26;
  const yOf = (v) => bottom - (bottom - top) * v;
  const g = new PIXI.Graphics();
  g.moveTo(axisX, top).lineTo(axisX, bottom).lineTo(width - 4, bottom).stroke({ width: 1.5, color: PALETTE.inkSoft });
  for (const v of [0, 0.5, 1]) {
    g.moveTo(axisX - 4, yOf(v)).lineTo(axisX, yOf(v)).stroke({ width: 1.5, color: PALETTE.inkSoft });
    const t = text(`${Math.round(v * 100)}%`, 11, { weight: '700', fill: PALETTE.inkSoft });
    t.anchor.set(1, 0.5);
    t.position.set(axisX - 6, yOf(v));
    c.addChild(t);
  }
  bars.forEach((b, i) => {
    const x = axisX + slot * (i + 0.5);
    g.roundRect(x - bw / 2, yOf(b.value), bw, Math.max(0.01, bottom - yOf(b.value)), 4).fill(b.color ?? barColor);
    const t = label(b.label, 13, { fill: PALETTE.sage, fontWeight: '800' });
    t.anchor.set(0.5, 0);
    t.position.set(x, bottom + 5);
    c.addChild(t);
  });
  c.addChildAt(g, 0);
  const caption = text('working product', 11, { weight: '700', fill: PALETTE.inkSoft });
  caption.position.set(axisX + 6, 0);
  c.addChild(caption);
  if (threshold != null) {
    const line = new PIXI.Container();
    const draw = (v) => {
      line.removeChildren().forEach((x) => x.destroy());
      const y = yOf(v);
      const dash = new PIXI.Graphics();
      for (let x = axisX; x < width - 8; x += 12) dash.moveTo(x, y).lineTo(Math.min(x + 7, width - 8), y);
      dash.stroke({ width: 2.5, color: PALETTE.clay });
      const tag = text(`needed: ${Math.round(v * 100)}%`, 12, { weight: '800', fill: shade(PALETTE.clay, -0.25) });
      tag.anchor.set(1, 1);
      tag.position.set(width - 8, y - 3);
      line.addChild(dash, tag);
      if (onDrag) {
        const knob = new PIXI.Graphics().circle(width - 10, y, 8).fill(PALETTE.clay).stroke({ width: 2, color: 0xffffff });
        line.addChild(knob);
      }
    };
    draw(threshold);
    c.addChild(line);
    if (onDrag && app) {
      // The whole plot height is the handle, so the line is easy to catch on a phone.
      const hit = new PIXI.Graphics().rect(axisX, top - 8, width - axisX, bottom - top + 16).fill({ color: 0xffffff, alpha: 0.001 });
      hit.eventMode = 'static';
      hit.cursor = 'ns-resize';
      c.addChildAt(hit, 0);
      let dragging = false;
      const toValue = (e) => {
        const p = c.toLocal(e.global);
        return Math.max(0.05, Math.min(0.95, (bottom - p.y) / (bottom - top)));
      };
      const move = (e) => {
        if (!dragging) return;
        const v = Math.round(toValue(e) * 20) / 20;
        draw(v);
        onDrag(v);
      };
      const stop = () => {
        dragging = false;
        app.stage.off('globalpointermove', move);
      };
      hit.on('pointerdown', (e) => {
        dragging = true;
        app.stage.eventMode = 'static';
        app.stage.hitArea = app.screen;
        app.stage.on('globalpointermove', move);
        move(e);
      });
      hit.on('pointerup', stop);
      hit.on('pointerupoutside', stop);
      c.stopDrag = stop;
    }
  }
  c.h = height;
  return c;
}

// Dimers in a heterozygote for a dominant negative allele: subunits paired at random, half of them mutant. Only the
// all-normal pairs (¼) work. Drawn as a fixed grid with exactly ¼ normal pairs, so the picture matches the math.
export function dimerGrid(width, { pairs = 16 } = {}) {
  const c = new PIXI.Container();
  const cols = 8;
  const rows = Math.ceil(pairs / cols);
  const cell = Math.min(36, (width - 16) / cols);
  const r = cell * 0.2;
  // Normal-normal ¼, mixed ½, mutant-mutant ¼, spread out so the pattern looks random.
  const kinds = ['nn', 'nm', 'mn', 'mm', 'nm', 'mm', 'nn', 'mn', 'mn', 'nm', 'mm', 'nn', 'mm', 'mn', 'nm', 'nn'].slice(0, pairs);
  const g = new PIXI.Graphics();
  kinds.forEach((k, i) => {
    const x = (i % cols) * cell + cell / 2 - (cols * cell) / 2;
    const y = Math.floor(i / cols) * cell * 1.1 + cell / 2;
    const works = k === 'nn';
    g.roundRect(x - cell * 0.44, y - cell * 0.34, cell * 0.88, cell * 0.68, 8).fill(works ? 0xe3ecdd : 0xf5e3d9).stroke({ width: 1.5, color: works ? PALETTE.sage : PALETTE.clay });
    [k[0], k[1]].forEach((s, j) => g.circle(x + (j ? r * 1.05 : -r * 1.05), y, r).fill(s === 'n' ? PALETTE.sage : PALETTE.clay));
  });
  c.addChild(g);
  c.h = rows * cell * 1.1 + 4;
  return c;
}

// A key for the dimer picture: normal and mutant subunits.
export function dimerKey() {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.circle(6, 8, 6).fill(PALETTE.sage).circle(6, 28, 6).fill(PALETTE.clay);
  const a = text('normal subunit', 12, { weight: '700', fill: PALETTE.inkSoft });
  const b = text('mutant subunit', 12, { weight: '700', fill: PALETTE.inkSoft });
  a.position.set(18, 0);
  b.position.set(18, 20);
  c.addChild(g, a, b);
  c.h = 38;
  return c;
}

// A switch, on or off, for gain of function: the mutant product is stuck on.
export function switchIcon(on, caption) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.roundRect(-26, -14, 52, 28, 14).fill(on ? PALETTE.ochre : 0xd9d2c5);
  g.circle(on ? 12 : -12, 0, 10).fill(0xffffff).stroke({ width: 1.5, color: PALETTE.cellEdge });
  const t = text(caption, 12, { weight: '700', fill: PALETTE.inkSoft, align: 'center', width: 120 });
  t.anchor.set(0.5, 0);
  t.y = 20;
  c.addChild(g, t);
  c.h = 20 + t.height;
  return c;
}

// Protein gel lanes: one lane per genotype, each with its bands ({ y: 0..1, strength: 0..1 }).
export function gel(lanes, width, height) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const lw = Math.min(70, (width - 20) / lanes.length - 14);
  const total = lanes.length * lw + (lanes.length - 1) * 14;
  g.roundRect(-total / 2 - 10, 0, total + 20, height - 22, 8).fill(0xe8e4f0).stroke({ width: 1.5, color: 0xb7aec9 });
  lanes.forEach((lane, i) => {
    const x = -total / 2 + i * (lw + 14);
    for (const band of lane.bands) g.roundRect(x, 8 + band.y * (height - 46), lw, 7, 3).fill({ color: 0x5b4b7a, alpha: 0.25 + 0.7 * band.strength });
    const t = label(lane.label, 13, { fill: PALETTE.sage, fontWeight: '800' });
    t.anchor.set(0.5, 0);
    t.position.set(x + lw / 2, height - 18);
    c.addChild(t);
  });
  c.addChildAt(g, 0);
  c.h = height;
  return c;
}

// A slide's button on the canvas: rounded, with a label; primary is filled.
export function canvasButton(str, { primary = false, width = 280, onTap }) {
  const c = new PIXI.Container();
  const t = text(str, 17, { width: width - 32, weight: '800', fill: primary ? 0xffffff : PALETTE.ink, align: 'center' });
  t.anchor.set(0.5);
  const h = t.height + 26;
  const bg = new PIXI.Graphics().roundRect(-width / 2, -h / 2, width, h, 16).fill(primary ? PALETTE.sage : 0xffffff).stroke({ width: 2, color: primary ? PALETTE.sage : PALETTE.cellEdge });
  c.addChild(bg, t);
  c.eventMode = 'static';
  c.cursor = 'pointer';
  c.on('pointertap', onTap);
  c.on('pointerover', () => (bg.alpha = 0.88));
  c.on('pointerout', () => (bg.alpha = 1));
  c.h = h;
  return c;
}
