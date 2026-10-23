// Step C: fertilization, built up slowly.
//   1. One egg meets one sperm. Each gamete is its own coin flip (½ each allele), and the two flips are
//      independent, so a particular egg and sperm meet with probability ½ × ½.
//   2. The same random fertilizations land in a Punnett square: sperm across the top, eggs down the left. Each
//      cell is one kind of fertilization event, and the square is a summary of their probabilities.

import { h, clear } from '../../core/dom.js';
import { PALETTE } from '../../core/palette.js';
import { meiosis, fertilize } from '../../engine/meiosis.js';
import { allelesAt } from '../../engine/genome.js';
import { alleleLabel, genotypeLabel } from '../../engine/phenotype.js';
import { offspringGenotypes, offspringPhenotypes, fractionGlyph } from '../../engine/cross.js';
import { Creature } from '../../render/creature.js';
import { label } from '../../render/chromosome.js';
import { creatureCard } from './instance.js';
import { QuestionSheet, answeredNote, sheetPointer } from './question-sheet.js';


// The first few fertilizations come before the probability questions.
const WARMUP = 3;

export class FertilizationStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.trait = this.inst.trait;
    [this.mother, this.father] = this.inst.parents;
    // Kept on the module so the student's fertilizations survive leaving and coming back.
    // first: how far the guided first fertilization has got (0 nothing, 1 egg made, 2 sperm made, 3 fertilized).
    // cells[i][j]: how many grid fertilizations joined the mother's allele i (egg) with the father's allele j (sperm).
    this.s = mod.state.fert ??= { phase: 'one', first: 0, pending: null, history: [], cells: [[0, 0], [0, 0]], gridShown: false };
    this.gen = 0;
  }

  get answered() {
    return this.mod.state.answered;
  }

  al(id) {
    return alleleLabel(this.trait, id);
  }

  gl(alleles) {
    return genotypeLabel(this.trait, alleles);
  }

  enter(container, body) {
    this.container = container;
    this.body = body;
    this.sheet = new QuestionSheet(this.mod, () => this.relayout());
    const { w, h: hgt } = this.mod.size();
    this.resize(w, hgt);
    this.renderPanel();
    if (this.s.phase === 'grid' && !this.s.gridShown) this.revealGrid();
  }

  // Animations resolve when the module moves on; nothing may draw into the shared panel after that.
  exit() {
    this.exited = true;
    this.sheet.remove();
  }

  // The question sheet changed height. A new layout would cut short a running animation, so it waits for the end.
  relayout() {
    if (this.busy) this.relayoutLater = true;
    else this.resize(this.w, this.h);
  }

  // An animation has finished: unlock the panel, catch up on a layout the sheet asked for, and redraw.
  settle() {
    this.busy = false;
    if (this.relayoutLater) {
      this.relayoutLater = false;
      this.resize(this.w, this.h);
    }
    this.renderPanel();
  }

  // An animation started before the last resize (or exit) has nothing left to move.
  stale(gen) {
    return this.exited || gen !== this.gen;
  }

  // A gamete through the engine: a fresh meiosis in the parent, keeping one of its four products at random.
  gameteFrom(parent) {
    const rng = this.inst.rng;
    const product = meiosis(parent.cell, rng, { crossingOver: false }).products[Math.floor(rng() * 4)];
    const allele = allelesAt(product.cell, this.trait.id)[0];
    return { product, allele, index: parent.alleles.indexOf(allele) };
  }

  zygote(egg, sperm) {
    const alleles = allelesAt(fertilize(egg.product.cell, sperm.product.cell), this.trait.id);
    const phenotype = this.trait.express(alleles);
    return { alleles, label: this.gl(alleles), phenotype, features: this.inst.base.featuresFor(phenotype) };
  }

  // ---- drawing ----

  eggView(text, r) {
    const c = new PIXI.Container();
    c.addChild(new PIXI.Graphics().circle(0, 0, r).fill(PALETTE.cell).stroke({ width: 2.5, color: PALETTE.clay }));
    const t = label(text, Math.max(12, r * 0.95), { fontWeight: '800' });
    t.anchor.set(0.5);
    c.addChild(t);
    c.letter = t;
    return c;
  }

  // An oval head, wider than tall, with a wavy tail on the right.
  spermView(text, r) {
    const c = new PIXI.Container();
    const rx = r * 0.78;
    const ry = r * 0.56;
    const tail = new PIXI.Graphics();
    const len = r * 1.5;
    tail.moveTo(rx - 1, 0);
    const waves = 3;
    for (let k = 0; k < waves; k++) {
      const x0 = rx + (len * k) / waves;
      const x1 = rx + (len * (k + 1)) / waves;
      const dy = (k % 2 ? -1 : 1) * r * 0.28;
      tail.quadraticCurveTo((x0 + x1) / 2, dy, x1, 0);
    }
    tail.stroke({ width: 2.5, color: PALETTE.dusk, cap: 'round' });
    c.addChild(tail, new PIXI.Graphics().ellipse(0, 0, rx, ry).fill(PALETTE.cell).stroke({ width: 2.5, color: PALETTE.dusk }));
    const t = label(text, Math.max(11, r * 0.78), { fontWeight: '800' });
    t.anchor.set(0.5);
    c.addChild(t);
    c.letter = t;
    return c;
  }

  // A creature with its genotype under it, for a zygote or a grid cell.
  kidView(z, size) {
    const c = new PIXI.Container();
    c.addChild(new Creature(z.features, { size }));
    const t = label(z.label, Math.max(12, size * 0.26), { fill: PALETTE.sage, fontWeight: '800' });
    t.anchor.set(0.5, 0);
    t.y = size * 0.52;
    c.addChild(t);
    return c;
  }

  resize(w, hgt) {
    this.w = w;
    this.h = hgt;
    this.gen++;
    this.container.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.layer = new PIXI.Container();
    this.fx = new PIXI.Container();
    this.container.addChild(this.layer, this.fx);
    // The picture fits above the question sheet.
    const room = hgt - this.sheet.space();
    if (this.s.phase === 'one') this.layoutOne(w, room);
    else this.layoutGrid(w, room);
  }

  // ---- part 1: one egg, one sperm ----

  layoutOne(w, hgt) {
    const size = Math.max(60, Math.min(100, hgt * 0.15));
    const top = 30;
    this.parentPos = [
      { x: w * 0.18, y: top + size * 0.55 },
      { x: w * 0.82, y: top + size * 0.55 },
    ];
    let cardBottom = 0;
    [this.mother, this.father].forEach((p, i) => {
      const role = label(i === 0 ? 'Mother: makes eggs' : 'Father: makes sperm', 13, { fill: i === 0 ? PALETTE.clay : PALETTE.dusk, fontWeight: '800' });
      role.anchor.set(0.5, 1);
      // On a narrow stage the label is wider than the margin beside the card, so keep it inside the edges.
      const half = role.width / 2 + 8;
      role.position.set(Math.min(w - half, Math.max(half, this.parentPos[i].x)), top - 4 + 12);
      const card = creatureCard(p, { size });
      card.container.position.set(this.parentPos[i].x, this.parentPos[i].y + 14);
      const b = card.container.getLocalBounds();
      cardBottom = Math.max(cardBottom, card.container.y + b.y + b.height);
      this.layer.addChild(role, card.container);
    });
    this.r = Math.max(20, Math.min(36, w * 0.04));
    this.kidSize = Math.max(40, Math.min(64, hgt * 0.1));
    // Three bands from the top: the parents, egg and sperm meeting, then the zygote row. When the question sheet
    // leaves too little room for that (a phone), egg and sperm meet between the parents and the row sits under them.
    let midY = Math.min(hgt * 0.5, top + size * 2.2 + this.r * 2);
    this.rowY = hgt - 24 - this.kidSize * 0.95;
    if (this.rowY - this.kidSize * 0.62 - 20 < midY + this.r + 8) {
      midY = this.parentPos[0].y + 14;
      this.rowY = cardBottom + 24 + this.kidSize * 0.62;
    }
    this.eggSpot = { x: w * 0.4, y: midY };
    this.spermSpot = { x: w * 0.6, y: midY };
    this.meetSpot = { x: w * 0.5, y: midY };
    // If even that row would fall behind the sheet, it waits until the question closes; the panel lists the zygotes.
    this.rowShown = this.rowY + this.kidSize * 0.95 <= hgt;
    const kl = label('zygotes so far', 13, { fill: PALETTE.inkSoft });
    kl.anchor.set(0.5, 1);
    kl.position.set(w / 2, this.rowY - this.kidSize * 0.62);
    kl.visible = this.rowShown;
    this.layer.addChild(kl);
    this.kidLayer = new PIXI.Container();
    this.kidLayer.visible = this.rowShown;
    this.layer.addChild(this.kidLayer);
    this.drawRow();
    // The guided first fertilization, frozen wherever it has got to.
    const pend = this.s.pending;
    this.pendingViews = {};
    if (pend?.egg) this.pendingViews.egg = this.restingGamete('egg', pend.egg);
    if (pend?.sperm) this.pendingViews.sperm = this.restingGamete('sperm', pend.sperm);
  }

  restingGamete(which, gamete) {
    const v = which === 'egg' ? this.eggView(this.al(gamete.allele), this.r) : this.spermView(this.al(gamete.allele), this.r);
    const spot = which === 'egg' ? this.eggSpot : this.spermSpot;
    v.position.set(spot.x, spot.y);
    this.fx.addChild(v);
    return v;
  }

  // The most recent zygotes along the bottom.
  drawRow() {
    this.kidLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const n = Math.max(3, Math.min(8, Math.floor((this.w - 40) / (this.kidSize * 1.3))));
    const shown = this.s.history.slice(-n);
    shown.forEach((z, i) => {
      const k = this.kidView(z.zygote, this.kidSize);
      k.position.set(this.w / 2 + (i - (shown.length - 1) / 2) * this.kidSize * 1.3, this.rowY);
      this.kidLayer.addChild(k);
    });
  }

  // A gamete leaves its parent showing "?", and its allele shows once it arrives: the coin flip.
  async makeGamete(which, gamete, speed) {
    const gen = this.gen;
    const tw = this.mod.ctx.tween;
    const i = which === 'egg' ? 0 : 1;
    const v = which === 'egg' ? this.eggView('?', this.r) : this.spermView('?', this.r);
    const spot = which === 'egg' ? this.eggSpot : this.spermSpot;
    v.position.set(this.parentPos[i].x, this.parentPos[i].y);
    v.scale.set(0.4);
    v.alpha = 0;
    this.fx.addChild(v);
    await Promise.all([tw.to(v, { x: spot.x, y: spot.y, alpha: 1 }, { duration: 700 * speed }), tw.to(v.scale, { x: 1, y: 1 }, { duration: 700 * speed })]);
    if (this.stale(gen)) return null;
    v.letter.text = this.al(gamete.allele);
    v.scale.set(1.25);
    await tw.to(v.scale, { x: 1, y: 1 }, { duration: 300 * speed, ease: 'outBack' });
    return this.stale(gen) ? null : v;
  }

  // Egg and sperm meet, fuse, and the zygote grows into a bdellbee that joins the row.
  async fuse(egg, sperm, z, speed) {
    const gen = this.gen;
    const tw = this.mod.ctx.tween;
    const { x, y } = this.meetSpot;
    await Promise.all([tw.to(egg, { x: x - this.r * 0.35, y }, { duration: 500 * speed }), tw.to(sperm, { x: x + this.r * 0.5, y }, { duration: 500 * speed })]);
    if (this.stale(gen)) return;
    await Promise.all([tw.to(egg, { x, alpha: 0 }, { duration: 300 * speed }), tw.to(sperm, { x, alpha: 0 }, { duration: 300 * speed })]);
    if (this.stale(gen)) return;
    egg.destroy({ children: true });
    sperm.destroy({ children: true });
    const kid = this.kidView(z, this.kidSize * 1.3);
    kid.position.set(x, y);
    kid.scale.set(0.2);
    this.fx.addChild(kid);
    await tw.to(kid.scale, { x: 1, y: 1 }, { duration: 500 * speed, ease: 'outBack' });
    if (this.stale(gen)) return;
    await tw.wait(450 * speed);
    if (this.stale(gen)) return;
    await Promise.all([tw.to(kid, { y: this.rowY, alpha: 0.4 }, { duration: 450 * speed }), tw.to(kid.scale, { x: 0.77, y: 0.77 }, { duration: 450 * speed })]);
    if (this.stale(gen)) return;
    kid.destroy({ children: true });
    this.drawRow();
  }

  // The guided first fertilization, one click per event.
  async firstEgg() {
    const egg = this.gameteFrom(this.mother);
    this.s.pending = { egg };
    this.s.first = 1;
    await this.run(async () => {
      this.pendingViews.egg = await this.makeGamete('egg', egg, 1);
    });
  }

  async firstSperm() {
    const sperm = this.gameteFrom(this.father);
    this.s.pending.sperm = sperm;
    this.s.first = 2;
    await this.run(async () => {
      this.pendingViews.sperm = await this.makeGamete('sperm', sperm, 1);
    });
  }

  async firstFuse() {
    const { egg, sperm } = this.s.pending;
    const z = this.zygote(egg, sperm);
    this.s.history.push({ egg: egg.allele, sperm: sperm.allele, zygote: z });
    this.s.pending = null;
    this.s.first = 3;
    const { egg: ev, sperm: sv } = this.pendingViews;
    this.pendingViews = {};
    await this.run(() => (ev && sv ? this.fuse(ev, sv, z, 1) : this.drawRow()));
  }

  async another() {
    const egg = this.gameteFrom(this.mother);
    const sperm = this.gameteFrom(this.father);
    const z = this.zygote(egg, sperm);
    this.s.history.push({ egg: egg.allele, sperm: sperm.allele, zygote: z });
    await this.run(async () => {
      const [ev, sv] = await Promise.all([this.makeGamete('egg', egg, 0.6), this.makeGamete('sperm', sperm, 0.6)]);
      if (ev && sv) await this.fuse(ev, sv, z, 0.6);
    });
  }

  // Locks the panel while an animation runs, then redraws it.
  async run(anim) {
    this.busy = true;
    this.renderPanel();
    await anim();
    if (this.exited) return;
    this.settle();
  }

  // ---- part 2: the Punnett square ----

  gridGeometry(w, hgt) {
    const s = Math.max(70, Math.min(170, (w - 32) / 3.6, (hgt - 24) / 3.75));
    const left = 1.6 * s;
    const top = 1.75 * s;
    const x0 = Math.max(16, (w - (left + 2 * s)) / 2) + left;
    const y0 = Math.max(12, (hgt - (top + 2 * s)) / 2) + top;
    return { s, x0, y0, left, top };
  }

  layoutGrid(w, hgt) {
    const G = (this.G = this.gridGeometry(w, hgt));
    const { s, x0, y0 } = G;
    this.parts = {};
    const add = (key, obj) => {
      this.layer.addChild(obj);
      (this.parts[key] ??= []).push(obj);
      return obj;
    };

    // Father above the square, his sperm across the top.
    const size = Math.max(44, s * 0.5);
    // In a small square the parents' phenotype captions would run into the sperm row; their genotypes stay.
    const cardOpts = s < 100 ? { size, caption: '' } : { size };
    const fCard = creatureCard(this.father, cardOpts);
    const fb = fCard.container.getLocalBounds();
    fCard.container.position.set(x0 + s, y0 - G.top + 6 - fb.y);
    add('father', fCard.container);
    const fRole = label('Father', Math.max(12, s * 0.09), { fill: PALETTE.dusk, fontWeight: '800' });
    fRole.anchor.set(1, 0.5);
    fRole.position.set(fCard.container.x - size * 0.62, fCard.container.y);
    add('father', fRole);
    const spermY = y0 - s * 0.32;
    const sl = label(`Sperm from ${this.father.name}`, Math.max(12, s * 0.09), { fill: PALETTE.dusk, fontWeight: '800' });
    sl.anchor.set(0, 0.5);
    sl.position.set(x0 + 2 * s + 10, spermY);
    // No room to the right of the sperm (a phone): use the empty corner left of them, above the eggs.
    if (sl.x + sl.width > w - 4) {
      Object.assign(sl.style, { wordWrap: true, wordWrapWidth: G.left - 16, align: 'right' });
      sl.anchor.set(1, 0.5);
      sl.position.set(x0 - 12, spermY);
    }
    add('sperm', sl);
    this.spermHeads = this.father.alleles.map((a, j) => {
      const v = add('sperm', this.spermView(this.al(a), s * 0.17));
      v.position.set(x0 + s * (j + 0.5) - s * 0.14, spermY);
      const p = add('sperm', label('½', Math.max(11, s * 0.09), { fill: PALETTE.inkSoft }));
      p.anchor.set(1, 0.5);
      p.position.set(v.x - s * 0.17, spermY);
      return v;
    });

    // Mother to the left, her eggs down the left side.
    const mCard = creatureCard(this.mother, cardOpts);
    const mb = mCard.container.getLocalBounds();
    mCard.container.position.set(x0 - G.left + mb.width / 2 + 2, y0 + s - (mb.y + mb.height / 2));
    add('mother', mCard.container);
    const mRole = label('Mother', Math.max(12, s * 0.09), { fill: PALETTE.clay, fontWeight: '800' });
    mRole.anchor.set(0.5, 1);
    mRole.position.set(mCard.container.x, mCard.container.y + mb.y - 2);
    add('mother', mRole);
    const eggX = x0 - s * 0.3;
    const el = label(`Eggs from ${this.mother.name}`, Math.max(12, s * 0.09), { fill: PALETTE.clay, fontWeight: '800' });
    el.anchor.set(0.5, 1);
    el.rotation = -Math.PI / 2;
    el.position.set(eggX - s * 0.24, y0 + s);
    add('eggs', el);
    this.eggHeads = this.mother.alleles.map((a, i) => {
      const v = add('eggs', this.eggView(this.al(a), s * 0.15));
      v.position.set(eggX, y0 + s * (i + 0.5) - s * 0.06);
      const p = add('eggs', label('½', Math.max(11, s * 0.09), { fill: PALETTE.inkSoft }));
      p.anchor.set(0.5, 0);
      p.position.set(eggX, v.y + s * 0.17);
      return v;
    });

    // The square: one cell per egg × sperm pairing.
    const grid = add('grid', new PIXI.Graphics());
    this.cellViews = [0, 1].map((i) =>
      [0, 1].map((j) => {
        const cx = x0 + s * (j + 0.5);
        const cy = y0 + s * (i + 0.5);
        const c = add('grid', new PIXI.Container());
        c.position.set(cx, cy);
        return c;
      }),
    );
    this.drawCells(grid);
  }

  cellInfo(i, j) {
    const a = this.mother.alleles[i];
    const b = this.father.alleles[j];
    const alleles = [a, b];
    const phenotype = this.trait.express(alleles);
    return { alleles, label: this.gl(alleles), phenotype, features: this.inst.base.featuresFor(phenotype) };
  }

  drawCells(grid = this.parts.grid[0]) {
    const { s, x0, y0 } = this.G;
    grid.clear();
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const n = this.s.cells[i][j];
        grid.roundRect(x0 + s * j + 3, y0 + s * i + 3, s - 6, s - 6, 10).fill(n ? PALETTE.panel : PALETTE.paper).stroke({ width: 2, color: PALETTE.cellEdge });
      }
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) this.drawCell(i, j);
  }

  // A filled cell shows its bdellbee, genotype and probability; an empty one waits with a "?".
  drawCell(i, j) {
    const c = this.cellViews[i][j];
    c.removeChildren().forEach((x) => x.destroy({ children: true }));
    const { s } = this.G;
    const n = this.s.cells[i][j];
    if (!n) {
      const q = label('?', s * 0.3, { fill: PALETTE.cellEdge });
      q.anchor.set(0.5);
      c.addChild(q);
      return null;
    }
    const z = this.cellInfo(i, j);
    const creature = new Creature(z.features, { size: s * 0.36 });
    creature.y = -s * 0.2;
    const g = label(z.label, Math.max(12, s * 0.12), { fill: PALETTE.sage, fontWeight: '800' });
    g.anchor.set(0.5, 0);
    g.y = -s * 0.01;
    const p = label(`P(${z.label}) = ½ × ½ = ¼`, Math.max(10, s * 0.082), { fill: PALETTE.ink, fontWeight: '700', align: 'center' });
    // In a small cell, break after the first "=" so the product stays on one line.
    if (p.width > s - 12) p.text = `P(${z.label}) =\n½ × ½ = ¼`;
    p.anchor.set(0.5, 0);
    p.y = g.y + g.height;
    const badge = label(`×${n}`, Math.max(10, s * 0.08), { fill: PALETTE.inkSoft, fontWeight: '800' });
    badge.anchor.set(1, 0);
    badge.position.set(s / 2 - 9, -s / 2 + 7);
    c.addChild(creature, g, p, badge);
    c.creature = creature;
    return c;
  }

  // On first arrival the square assembles in order: the parents, the sperm across the top, the eggs down the
  // left, then the empty cells.
  async revealGrid() {
    const gen = this.gen;
    const tw = this.mod.ctx.tween;
    this.s.gridShown = true;
    const order = ['father', 'mother', 'sperm', 'eggs', 'grid'];
    for (const k of order) for (const o of this.parts[k]) o.alpha = 0;
    this.busy = true;
    this.renderPanel();
    for (const k of order) {
      await Promise.all(this.parts[k].map((o) => tw.to(o, { alpha: 1 }, { duration: 450 })));
      if (this.stale(gen)) break;
      await tw.wait(250);
      if (this.stale(gen)) break;
    }
    if (this.exited) return;
    this.settle();
  }

  // One random fertilization lands in its cell: the egg runs along its row, the sperm down its column.
  async gridOnce(speed) {
    const gen = this.gen;
    const tw = this.mod.ctx.tween;
    const egg = this.gameteFrom(this.mother);
    const sperm = this.gameteFrom(this.father);
    const [i, j] = [egg.index, sperm.index];
    const { s, x0, y0 } = this.G;
    const target = { x: x0 + s * (j + 0.5), y: y0 + s * (i + 0.5) };
    const ev = this.eggView(this.al(egg.allele), s * 0.15);
    const sv = this.spermView(this.al(sperm.allele), s * 0.17);
    const eh = this.eggHeads[i];
    const sh = this.spermHeads[j];
    ev.position.set(eh.x, eh.y);
    sv.position.set(sh.x, sh.y);
    this.fx.addChild(ev, sv);
    const pulse = (v) => {
      v.scale.set(1.3);
      return tw.to(v.scale, { x: 1, y: 1 }, { duration: 350 * speed, ease: 'outBack' });
    };
    await Promise.all([pulse(eh), pulse(sh)]);
    if (this.stale(gen)) return this.countCell(i, j, false);
    await Promise.all([tw.to(ev, { x: target.x - s * 0.12, y: target.y }, { duration: 600 * speed }), tw.to(sv, { x: target.x + s * 0.1, y: target.y }, { duration: 600 * speed })]);
    if (this.stale(gen)) return this.countCell(i, j, false);
    await Promise.all([tw.to(ev, { x: target.x, alpha: 0 }, { duration: 250 * speed }), tw.to(sv, { x: target.x, alpha: 0 }, { duration: 250 * speed })]);
    ev.destroy({ children: true });
    sv.destroy({ children: true });
    if (this.stale(gen)) return this.countCell(i, j, false);
    const first = this.s.cells[i][j] === 0;
    this.countCell(i, j, true);
    if (first) {
      const c = this.cellViews[i][j];
      c.scale.set(0.3);
      await tw.to(c.scale, { x: 1, y: 1 }, { duration: 450 * speed, ease: 'outBack' });
    }
  }

  countCell(i, j, draw) {
    this.s.cells[i][j]++;
    if (draw) this.drawCells();
  }

  async gridMany(n) {
    await this.run(async () => {
      const gen = this.gen;
      for (let k = 0; k < n; k++) {
        if (this.stale(gen)) {
          // The rest still happen; they just skip the animation.
          for (; k < n; k++) {
            const [e, sp] = [this.gameteFrom(this.mother), this.gameteFrom(this.father)];
            this.s.cells[e.index][sp.index]++;
          }
          break;
        }
        await this.gridOnce(n === 1 ? 1 : 0.4);
      }
      if (!this.exited) this.drawCells();
    });
  }

  gridTotal() {
    return this.s.cells.flat().reduce((t, n) => t + n, 0);
  }

  // ---- panel ----

  title() {
    return this.s.phase === 'one' ? 'Fertilization: one egg meets one sperm' : 'Fertilization: the Punnett square';
  }

  renderPanel() {
    if (this.exited) return;
    this.mod.refreshTitle();
    const body = clear(this.body);
    this.asking = false;
    if (this.s.phase === 'one') this.renderOne(body);
    else this.renderGrid(body);
    if (!this.asking) this.sheet.hide();
  }

  // A question in the sheet on the main page, or once it is answered, its prompt, answer and reason in the panel.
  ask(body, key, q, then) {
    if (this.answered.has(key)) {
      body.append(answeredNote(q));
      return true;
    }
    this.asking = true;
    this.sheet.show(key, {
      ...q,
      onCorrect: () => {
        this.answered.add(key);
        then?.();
        setTimeout(() => this.renderPanel(), 1100);
      },
    });
    body.append(sheetPointer('Each answer you get right is recorded here.'));
    return false;
  }

  renderOne(body) {
    const m = this.mother;
    const f = this.father;
    const [A, a] = this.trait.alleles.map((x) => x.id);
    const s = this.s;
    body.append(
      h('div', { class: 'stage-name' }, 'Part 1 of 2'),
      h('h2', {}, 'One egg meets one sperm'),
      h(
        'p',
        {},
        `${m.name} and ${f.name} are both ${m.label} and pigmented. ${m.name} is the mother, so her gametes are eggs. ${f.name} is the father, so his gametes are sperm. Each gamete comes from its own meiosis, so (as you saw in A) it carries ${this.al(A)} or ${this.al(a)} with probability ½.`,
      ),
    );
    const btn = (text, fn, primary = true) => h('button', { class: primary ? 'btn primary' : 'btn', disabled: this.busy, onclick: fn }, text);

    if (s.first < 3) {
      const pend = s.pending;
      if (pend?.egg && !(this.busy && s.first === 1))
        body.append(h('div', { class: 'callout' }, h('b', {}, `The egg carries ${this.al(pend.egg.allele)}`), `It had a ½ chance of carrying ${this.al(pend.egg.allele)} and a ½ chance of the other allele.`));
      if (pend?.sperm && !(this.busy && s.first === 2))
        body.append(
          h(
            'div',
            { class: 'callout' },
            h('b', {}, `The sperm carries ${this.al(pend.sperm.allele)}`),
            `Again a ½ chance. The sperm came from a different meiosis in a different bdellbee, so the egg’s allele had no effect on it. The egg and the sperm are independent events.`,
          ),
        );
      const next = [() => btn(`Make an egg from ${m.name}`, () => this.firstEgg()), () => btn(`Make a sperm from ${f.name}`, () => this.firstSperm()), () => btn('Fertilize: the sperm meets the egg', () => this.firstFuse())][s.first];
      body.append(h('div', { class: 'row' }, next()));
      return;
    }

    const hist = s.history;
    const last = hist.at(-1);
    if (!this.busy)
      body.append(
        h(
          'div',
          { class: 'callout' },
          h('b', {}, `Egg ${this.al(last.egg)} + sperm ${this.al(last.sperm)} → zygote ${last.zygote.label}`),
          `This zygote grows into a ${last.zygote.phenotype.label} bdellbee.${last.zygote.phenotype.key === 'white' ? ` It has no working copy of ${this.al(A)}, so it makes no pigment.` : ''}`,
        ),
      );
    body.append(
      h('div', { class: 'row' }, btn('Another egg and sperm', () => this.another(), hist.length < WARMUP)),
      h(
        'ol',
        { class: 'tips' },
        // While the newest zygote is still forming, don't give it away.
        (this.busy ? hist.slice(0, -1) : hist).slice(-6).map((e) => h('li', {}, `egg ${this.al(e.egg)} + sperm ${this.al(e.sperm)} → ${e.zygote.label}, ${e.zygote.phenotype.label}`)),
      ),
      h('p', { class: 'hint' }, `${hist.length} fertilization${hist.length === 1 ? '' : 's'} so far.${hist.length < WARMUP ? ` Make at least ${WARMUP}.` : ''}`),
    );
    if (hist.length < WARMUP) return;

    const aa = this.gl([a, a]);
    const done =
      this.ask(body, 'fert:independent', {
        prompt: `${m.name}’s egg carries ${this.al(a)}. Does that change the chance that ${f.name}’s sperm carries ${this.al(a)}?`,
        options: [
          { label: `No: the sperm still carries ${this.al(a)} with probability ½`, correct: true, feedback: `Right. The egg and sperm come from separate meioses in separate parents. Knowing one tells you nothing about the other: they are independent events.` },
          { label: `Yes: the sperm is now more likely to carry ${this.al(A)}`, feedback: `Nothing connects ${f.name}’s meiosis to ${m.name}’s. Look at your list: the egg’s allele does not predict the sperm’s.` },
          { label: 'Yes: egg and sperm always carry different alleles', feedback: `Look at your list. Sometimes both carry the same allele; that is how ${aa} or ${this.gl([A, A])} zygotes are made.` },
        ],
      }) &&
      this.ask(body, 'fert:product', {
        prompt: `What is the probability that an egg carries ‘${this.al(a)}’ and is fertilized by a sperm carrying ‘${this.al(a)}’?`,
        options: ['½', '¼', '¾', '1'].map((o) => ({
          label: o,
          correct: o === '¼',
          feedback:
            o === '¼'
              ? `Right. Both events must happen, and they are independent, so multiply: ½ × ½ = ¼. This is the product rule. The zygote is ${aa}, a white bdellbee.`
              : o === '½'
                ? `½ is the chance for one gamete. Both the egg and the sperm have to carry ${this.al(a)}.`
                : `Each gamete carries ${this.al(a)} with probability ½, and both must. Multiply the two independent probabilities.`,
        })),
      }) &&
      this.ask(body, 'fert:combos', {
        prompt: 'How many different egg + sperm combinations can these two parents make?',
        options: ['2', '3', '4', '8'].map((o) => ({
          label: o,
          correct: o === '4',
          feedback:
            o === '4'
              ? `Right: 2 kinds of egg × 2 kinds of sperm = 4 combinations, each with probability ½ × ½ = ¼. A Punnett square lays out exactly these four.`
              : o === '3'
                ? `There are three zygote genotypes, but ${this.gl([A, a])} can be made two ways: egg ${this.al(A)} + sperm ${this.al(a)}, or egg ${this.al(a)} + sperm ${this.al(A)}. Count those separately.`
                : 'List the eggs (2 kinds) and the sperm (2 kinds), and pair each egg with each sperm.',
        })),
      });
    if (done) {
      body.append(
        h('div', { class: 'callout' }, h('b', {}, 'Independent events multiply'), `Each fertilization joins one random egg and one random sperm. Every pairing has probability ½ × ½ = ¼.`),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', disabled: this.busy, onclick: () => this.toGrid() }, 'Organize the outcomes: the Punnett square ▶')),
      );
    }
  }

  toGrid() {
    this.s.phase = 'grid';
    this.resize(this.w, this.h);
    this.renderPanel();
    this.revealGrid();
  }

  toOne() {
    this.s.phase = 'one';
    this.resize(this.w, this.h);
    this.renderPanel();
  }

  renderGrid(body) {
    const m = this.mother;
    const f = this.father;
    const [A, a] = this.trait.alleles.map((x) => x.id);
    const total = this.gridTotal();
    const filled = this.s.cells.flat().filter((n) => n).length;
    body.append(
      h('div', { class: 'stage-name' }, 'Part 2 of 2'),
      h('h2', {}, 'The Punnett square'),
      h(
        'p',
        {},
        h('b', {}, 'Top row: '),
        `the sperm ${f.name} can make, each with probability ½. `,
        h('b', {}, 'Left column: '),
        `the eggs ${m.name} can make, each with probability ½. A fertilization picks one egg (a row) and one sperm (a column) independently, so it lands in one cell.`,
      ),
    );
    const btn = (text, fn, primary) => h('button', { class: primary ? 'btn primary' : 'btn', disabled: this.busy, onclick: fn }, text);
    body.append(
      h('div', { class: 'row' }, btn('Fertilize once', () => this.gridMany(1), filled < 4), btn('Fertilize 10 times', () => this.gridMany(10), false)),
      h('p', { class: 'hint' }, total ? `${total} fertilization${total === 1 ? '' : 's'} so far. The small number in each cell counts how many landed there.` : 'Each fertilization fills its cell the first time it happens.'),
    );
    if (filled < 4) {
      if (total) body.append(h('p', { class: 'hint' }, `Cells found: ${filled} of 4. Keep fertilizing until every cell has happened at least once.`));
      body.append(h('div', { class: 'row' }, h('button', { class: 'btn small', disabled: this.busy, onclick: () => this.toOne() }, '◀ Back to part 1')));
      return;
    }

    const het = this.gl([A, a]);
    const done =
      this.ask(body, 'fert:het', {
        prompt: `What is the probability that a zygote is ${het}?`,
        options: ['¼', '½', '¾', '1'].map((o) => ({
          label: o,
          correct: o === '½',
          feedback:
            o === '½'
              ? `Right. Two different cells give ${het} (egg ${this.al(A)} + sperm ${this.al(a)}, and egg ${this.al(a)} + sperm ${this.al(A)}). They are different ways to the same genotype, so add them: ¼ + ¼ = ½.`
              : o === '¼'
                ? `¼ is one cell. Find every cell that holds ${het}.`
                : `Count the ${het} cells; each is ¼.`,
        })),
      }) &&
      this.ask(body, 'fert:white', {
        prompt: 'What fraction of the zygotes will grow into white bdellbees?',
        options: ['0', '¼', '½', '¾'].map((o) => ({
          label: o,
          correct: o === '¼',
          feedback:
            o === '¼'
              ? `Right. Only the ${this.gl([a, a])} corner is white, and it has probability ¼. The other three cells have at least one ${this.al(A)} and are pigmented: ¾.`
              : `White needs no working copy at all. Which cells have ${this.gl([a, a])}?`,
        })),
      }) &&
      this.ask(
        body,
        'fert:punnett',
        {
          prompt: 'So what does a Punnett square represent?',
          options: [
            { label: 'The mechanism of meiosis', feedback: 'Meiosis happened inside each parent before any of this. The square starts from its outcomes, the gametes.' },
            { label: 'The mechanism of mitosis', feedback: 'Mitosis copies a cell. Nothing here is a mitotic division.' },
            { label: 'Only the gametes each parent can make', feedback: 'That is just the top row and the left column. Each cell inside is something else.' },
            {
              label: 'The probabilities of fertilization events and the zygotes they make',
              correct: true,
              feedback: 'Right. The edges are the gametes, each with probability ½. Each cell is one kind of fertilization event, with probability ½ × ½ = ¼, and the zygote it makes.',
            },
          ],
        },
        () => this.mod.complete('fertilization'),
      );
    if (!done) return;

    const dist = offspringGenotypes(this.trait, m.alleles, f.alleles);
    const obs = (key) => {
      let n = 0;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if (this.gl(this.cellInfo(i, j).alleles) === key) n += this.s.cells[i][j];
      return n;
    };
    const pheno = offspringPhenotypes(this.trait, m.alleles, f.alleles);
    body.append(
      h(
        'div',
        { class: 'callout' },
        h('b', {}, 'The square is a summary of probabilities'),
        h(
          'ul',
          { class: 'tips' },
          dist.map((d) => {
            const g = this.gl(d.alleles);
            const ways = Math.round(d.p * 4);
            return h('li', {}, `P(${g}) = ${ways > 1 ? Array(ways).fill('¼').join(' + ') + ' = ' : ''}${fractionGlyph(d.p)}. You saw ${obs(g)} of ${total}.`);
          }),
          h('li', {}, `Phenotypes: ${pheno.map((p) => `${fractionGlyph(p.p)} ${p.label}`).join(', ')}, a ${pheno.map((p) => Math.round(p.p * 4)).join(' : ')} ratio.`),
        ),
        'Multiply for independent events that must both happen (this egg and this sperm). Add for different ways of getting the same result (two cells with the same genotype).',
      ),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => this.mod.next() }, 'Continue: D. Breed ▶'), h('button', { class: 'btn small', onclick: () => this.toOne() }, '◀ Back to part 1')),
    );
  }
}
