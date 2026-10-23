// Step B: from one meiosis to many gametes. Predict the fraction carrying an allele, draw single random gametes,
// then draw them in batches until 120 stack up in one bin per allele.

import { h, clear, question } from '../../core/dom.js';
import { PALETTE } from '../../core/palette.js';
import { meiosis } from '../../engine/meiosis.js';
import { alleleLabel } from '../../engine/phenotype.js';
import { fractionGlyph } from '../../engine/cross.js';
import { label } from '../../render/chromosome.js';
import { creatureCard, gameteView } from './instance.js';

const MAX = 120;
const BATCHES = [10, 20, 30];
const PER_ROW = 12;

export class GametesStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.parent = this.inst.meiosisParent;
    this.trait = this.inst.trait;
    this.target = this.trait.alleles[1].id;
    // Kept on the module so the gametes are still there when the student comes back to this step.
    this.s = mod.state.gametes ??= { phase: 'single', singles: [], dots: [] };
  }

  title() {
    return 'Gametes: from one meiosis to many';
  }

  enter(container, body) {
    this.container = container;
    this.body = body;
    if (!this.mod.state.meiosisProducts) {
      this.mod.state.meiosisProducts = meiosis(this.parent.cell, this.inst.rng, { crossingOver: false }).products;
    }
    this.layer = new PIXI.Container();
    this.gameteLayer = new PIXI.Container();
    this.dotLayer = new PIXI.Container();
    container.addChild(this.layer, this.gameteLayer, this.dotLayer);
    // The fraction question sits on the main page as HTML, under the four products.
    this.sheet = h('div', { class: 'stage-sheet at-bottom', hidden: true });
    this.mod.ctx.stage.append(this.sheet);
    const { w, h: hgt } = this.mod.size();
    this.resize(w, hgt);
    this.renderPanel();
  }

  // Animations resolve when the module moves on; nothing may draw into the shared panel after that.
  exit() {
    this.exited = true;
    this.sheet.remove();
  }

  resize(w, hgt) {
    this.w = w;
    this.h = hgt;
    this.layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const size = Math.max(70, Math.min(120, hgt * 0.2));
    const card = creatureCard(this.parent, { size });
    card.container.position.set(w * 0.2, hgt * 0.24);
    this.layer.addChild(card.container);
    this.cardPos = { x: card.container.x, y: card.container.y };

    // The four products sit right of the card, in a row of 9.5 radii. When a row of full-size products does not fit
    // there (a phone), they form a 2 × 2 grid instead, one row per Meiosis II cell.
    const b = card.container.getLocalBounds();
    const left = card.container.x + b.x + b.width + 12;
    const right = w - 12;
    const grid = (right - left) / 9.5 < 24;
    const r = grid ? Math.max(20, Math.min(36, (right - left) / 4.6)) : Math.min(Math.max(24, Math.min(42, w * 0.045)), (right - left) / 9.5);
    this.r = r;
    const reach = grid ? 2.25 * r : 4.75 * r;
    this.rowX = Math.max(left + reach, Math.min(w * 0.64, right - reach));

    const heading = label('The four products of your meiosis', 15, { fill: PALETTE.inkSoft, wordWrap: grid, wordWrapWidth: right - left, align: 'center' });
    heading.anchor.set(0.5, 0);
    const half = heading.width / 2 + 8;
    heading.position.set(Math.max(half, Math.min(w - half, this.rowX)), hgt * 0.08);
    this.layer.addChild(heading);

    const top = heading.y + heading.height + 10 + r;
    const spots = grid
      ? [0, 1, 2, 3].map((i) => ({ x: this.rowX + ((i % 2) - 0.5) * 2.5 * r, y: top + Math.floor(i / 2) * 2.5 * r }))
      : [0, 1, 2, 3].map((i) => ({ x: this.rowX + (i - 1.5) * 2.5 * r, y: top }));
    this.mod.state.meiosisProducts.forEach((p, i) => {
      const g = gameteView(this.inst, p.chromosomes[0][0], r);
      g.position.set(spots[i].x, spots[i].y);
      this.layer.addChild(g);
    });
    // In a grid the products may end above the card's labels; the pile starts below both.
    this.pileTop = Math.max(spots[3].y + r * 1.3, grid ? card.container.y + b.y + b.height : 0) + 30;

    if (this.s.phase === 'single') this.layoutSingle(w, hgt);
    else this.layoutBins(w, hgt);
  }

  // Where a single random gamete lands, below the products row.
  layoutSingle(w, hgt) {
    this.spot = { x: this.rowX, y: this.pileTop + Math.max(60, (hgt - this.pileTop) * 0.4), r: this.r * 1.4 };
    const t = label(`Random gamete from ${this.parent.name}`, 15, { fill: PALETTE.inkSoft });
    t.anchor.set(0.5, 1);
    t.position.set(this.spot.x, this.spot.y - this.spot.r - 10);
    this.layer.addChild(t);
    this.spotLabel = t;
    t.visible = this.s.singles.length > 0;
    this.drawSingle();
  }

  // One bin per allele. Dots shrink to fit, so all 120 gametes fit in one bin when the parent is homozygous.
  layoutBins(w, hgt) {
    const half = Math.min(80, w * 0.14);
    this.bins = this.trait.alleles.map((a, i) => {
      const x = w * (0.35 + i * 0.3);
      const baseY = hgt - 40;
      const t = label(`${a.label} gametes`, 15);
      t.anchor.set(0.5, 0);
      t.position.set(x, baseY + 8);
      this.layer.addChild(t);
      const line = new PIXI.Graphics().moveTo(x - half, baseY).lineTo(x + half, baseY).stroke({ width: 2, color: PALETTE.cellEdge });
      this.layer.addChild(line);
      return { id: a.id, x, baseY };
    });
    const room = hgt - 40 - 4 - this.pileTop;
    this.dotStep = Math.min(5.5 * 2.3, (2 * half) / PER_ROW, room / Math.ceil(MAX / PER_ROW));
    this.dotR = this.dotStep / 2.3;
    this.redrawDots();
  }

  drawSingle() {
    this.gameteLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const last = this.s.singles.at(-1);
    if (!last || this.s.phase !== 'single') return null;
    const g = gameteView(this.inst, last.chromatid, this.spot.r);
    g.position.set(this.spot.x, this.spot.y);
    this.gameteLayer.addChild(g);
    return g;
  }

  dotTarget(binIndex, n) {
    const b = this.bins[binIndex];
    const col = n % PER_ROW;
    const row = Math.floor(n / PER_ROW);
    const y = b.baseY - this.dotR - 4 - row * this.dotStep;
    if (y < this.pileTop) return null;
    return { x: b.x + (col - (PER_ROW - 1) / 2) * this.dotStep, y };
  }

  redrawDots() {
    this.dotLayer.removeChildren().forEach((c) => c.destroy());
    if (this.s.phase !== 'many') return;
    const filled = this.trait.alleles.map(() => 0);
    for (const d of this.s.dots) {
      const bi = this.binOf(d.allele);
      const p = this.dotTarget(bi, filled[bi]++);
      if (!p) continue;
      const g = new PIXI.Graphics().circle(0, 0, this.dotR).fill(d.color);
      g.position.set(p.x, p.y);
      this.dotLayer.addChild(g);
    }
  }

  binOf(allele) {
    return this.trait.alleles.findIndex((a) => a.id === allele);
  }

  // One gamete: a fresh meiosis through the engine, keeping one of its four products at random.
  randomGamete() {
    const rng = this.inst.rng;
    const { products } = meiosis(this.parent.cell, rng, { crossingOver: false });
    const chromatid = products[Math.floor(rng() * 4)].chromosomes[0][0];
    const hap = chromatid.segments[0].hap;
    return { chromatid, allele: hap.alleles[this.trait.id], color: hap.color };
  }

  async pickSingle() {
    const tw = this.mod.ctx.tween;
    this.s.singles.push(this.randomGamete());
    this.busy = true;
    this.renderPanel();
    this.spotLabel.visible = true;
    const g = this.drawSingle();
    g.position.set(this.cardPos.x, this.cardPos.y);
    g.scale.set(0.3);
    g.alpha = 0;
    await Promise.all([
      tw.to(g, { x: this.spot.x, y: this.spot.y, alpha: 1 }, { duration: 650, ease: 'outCubic' }),
      tw.to(g.scale, { x: 1, y: 1 }, { duration: 650, ease: 'outBack' }),
    ]);
    if (this.exited) return;
    this.busy = false;
    this.renderPanel();
  }

  setPhase(phase) {
    this.s.phase = phase;
    this.gameteLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.resize(this.w, this.h);
    this.renderPanel();
  }

  async pickMany(n) {
    const tw = this.mod.ctx.tween;
    const filled = this.trait.alleles.map((a) => this.s.dots.filter((d) => d.allele === a.id).length);
    const batch = Array.from({ length: n }, () => {
      const { allele, color } = this.randomGamete();
      return { allele, color };
    });
    this.s.dots.push(...batch);
    this.busy = true;
    this.renderPanel();
    const anims = batch.map((d, i) => {
      const bi = this.binOf(d.allele);
      const p = this.dotTarget(bi, filled[bi]++);
      if (!p) return null;
      const g = new PIXI.Graphics().circle(0, 0, this.dotR).fill(d.color);
      g.position.set(this.cardPos.x, this.cardPos.y);
      g.alpha = 0;
      this.dotLayer.addChild(g);
      return tw.to(g, { x: p.x, y: p.y, alpha: 1 }, { duration: 500, delay: i * 25, ease: 'outCubic' });
    });
    await Promise.all(anims);
    if (this.exited) return;
    this.busy = false;
    if (this.s.dots.length >= MAX && !this.mod.done.has('gametes')) this.mod.complete('gametes');
    this.renderPanel();
  }

  resetMany() {
    this.s.dots = [];
    this.redrawDots();
    this.renderPanel();
  }

  renderPanel() {
    const body = clear(this.body);
    const [x, y] = this.parent.alleles;
    const p = (Number(x === this.target) + Number(y === this.target)) / 2;
    const tl = alleleLabel(this.trait, this.target);
    const why = `${this.parent.label} has ${p === 0.5 ? 'one' : p === 1 ? 'two' : 'no'} ${tl} cop${p === 0.5 ? 'y' : 'ies'}, and each gamete gets one of the two copies at random.`;
    body.append(
      h('h2', {}, 'From one meiosis to many gametes'),
      h('p', {}, `${this.parent.name} is ${this.parent.label}. Every gamete gets exactly one of the two copies of this gene.`),
    );

    const asking = !this.mod.state.answered.has('gametes:fraction');
    this.sheet.hidden = !asking;
    if (asking) {
      body.append(
        h('div', { class: 'callout' }, h('b', {}, `Answer on the main page ${window.innerWidth > 860 ? '←' : '↑'}`), 'Predict before making any gametes.'),
      );
      clear(this.sheet).append(
        question({
          prompt: `What fraction of ${this.parent.name}’s gametes carry ${tl}?`,
          options: [0, 0.25, 0.5, 0.75, 1].map((v) => ({
            label: fractionGlyph(v),
            correct: v === p,
            feedback:
              v === p
                ? `Right. ${why}`
                : v === 0.25 || v === 0.75
                  ? 'Each gamete gets one of the two copies, so the answer has to be 0, ½ or 1.'
                  : `Count the ${tl} copies in ${this.parent.label}.`,
          })),
          onCorrect: () => {
            this.mod.state.answered.add('gametes:fraction');
            setTimeout(() => !this.exited && this.renderPanel(), 900);
          },
        }),
      );
      return;
    }

    body.append(h('p', { class: 'hint' }, `✓ ${fractionGlyph(p)} of ${this.parent.name}’s gametes carry ${tl}. ${why}`));
    if (this.s.phase === 'single') this.renderSingle(body);
    else this.renderMany(body, p);
  }

  renderSingle(body) {
    const { name } = this.parent;
    const singles = this.s.singles;
    if (!singles.length) {
      body.append(
        h('p', {}, `Now let ${name} make a gamete. Which copy of the gene it gets is chosen at random.`),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', disabled: this.busy, onclick: () => this.pickSingle() }, `Produce a random gamete from ${name}`)),
      );
      return;
    }
    const al = (a) => alleleLabel(this.trait, a);
    // While the newest gamete is still flying in, don't give away its allele.
    const shown = this.busy ? singles.slice(0, -1) : singles;
    const counts = this.trait.alleles.map((a) => `${shown.filter((s) => s.allele === a.id).length} ${a.label}`);
    body.append(
      h(
        'div',
        { class: 'callout' },
        h('b', {}, this.busy ? `Making gamete ${singles.length}…` : `Gamete ${singles.length} carries ${al(singles.at(-1).allele)}`),
        shown.length ? `So far: ${shown.map((s) => al(s.allele)).join(', ')} (${counts.join(', ')}).` : '',
      ),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn', disabled: this.busy, onclick: () => this.pickSingle() }, 'Pick another'),
        h('button', { class: 'btn primary', disabled: this.busy, onclick: () => this.setPhase('many') }, 'Proceed to picking large numbers of gametes'),
      ),
    );
  }

  renderMany(body, p) {
    const { name } = this.parent;
    const [x, y] = this.parent.alleles;
    const dots = this.s.dots;
    const total = dots.length;
    body.append(
      h('p', {}, `Pick gametes from ${name} in batches. Each circle is one gamete, colored by the homolog it came from, and it stacks in the bin for its allele. Keep going until you have ${MAX}.`),
    );
    if (total < MAX) {
      body.append(
        h(
          'div',
          { class: 'row' },
          BATCHES.map((n) =>
            h('button', { class: n === BATCHES[0] ? 'btn primary' : 'btn', disabled: this.busy || total + n > MAX, onclick: () => this.pickMany(n) }, `Pick ${n} gametes`),
          ),
        ),
      );
    }
    if (total) {
      body.append(
        h(
          'div',
          { class: 'tally' },
          this.trait.alleles.map((a) => {
            const n = dots.filter((d) => d.allele === a.id).length;
            const exp = (Number(x === a.id) + Number(y === a.id)) / 2;
            return h(
              'div',
              { class: 'tally-row' },
              h('span', {}, `${a.label}: ${n}`),
              h('div', { class: 'tally-bar' }, h('i', { style: { width: `${(100 * n) / total}%` } }), h('em', { style: { left: `${exp * 100}%` } })),
              h('span', {}, `${((100 * n) / total).toFixed(0)}%`),
            );
          }),
        ),
        h('p', { class: 'hint' }, `${total} of ${MAX} gametes. The dark tick marks the expected fraction.`),
      );
    }
    if (total < MAX || this.busy) return;
    const het = x !== y;
    const tl = alleleLabel(this.trait, this.target);
    body.append(
      het
        ? h(
            'div',
            { class: 'callout' },
            h('b', {}, `Close to ${fractionGlyph(p)}, with wobble`),
            'Each gamete is a coin flip between the two copies, so the counts wobble around the expected fraction. The more gametes you collect, the closer the fraction gets to ½.',
          )
        : h('div', { class: 'callout' }, h('b', {}, 'No wobble'), `Both of ${name}’s copies carry ${alleleLabel(this.trait, x)}, so every gamete carries ${alleleLabel(this.trait, x)}${p ? '' : `, and none carry ${tl}`}.`),
      h(
        'div',
        { class: 'callout' },
        h('b', {}, 'Law of segregation'),
        'The two copies of a gene separate at Meiosis I, and the orientation of the pair is random, so each gamete carries one copy with probability ½.',
      ),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn', onclick: () => this.resetMany() }, `Reset Random Gametes from ${name}`),
        h('button', { class: 'btn primary', onclick: () => this.mod.next() }, 'Continue: C. Fertilization ▶'),
      ),
    );
  }
}
