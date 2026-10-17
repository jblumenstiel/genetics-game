// Step 2: from one meiosis to many. Predict the fraction of gametes carrying an allele, then sample.

import { h, clear, question } from '../../core/dom.js';
import { PALETTE } from '../../core/palette.js';
import { meiosis } from '../../engine/meiosis.js';
import { alleleLabel } from '../../engine/phenotype.js';
import { fraction } from '../../engine/cross.js';
import { label } from '../../render/chromosome.js';
import { creatureCard, gameteView } from './instance.js';

export class GametesStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.parent = this.inst.meiosisParent;
    this.trait = this.inst.trait;
    this.target = this.trait.alleles[1].id;
    this.counts = Object.fromEntries(this.trait.alleles.map((a) => [a.id, 0]));
    this.dots = [];
  }

  enter(container, body) {
    this.container = container;
    this.body = body;
    if (!this.mod.state.meiosisProducts) {
      this.mod.state.meiosisProducts = meiosis(this.parent.cell, this.inst.rng, { crossingOver: false }).products;
    }
    this.layer = new PIXI.Container();
    this.dotLayer = new PIXI.Container();
    container.addChild(this.layer, this.dotLayer);
    const { w, h: hgt } = this.mod.ctx.size();
    this.resize(w, hgt);
    this.renderPanel();
  }

  exit() {}

  resize(w, hgt) {
    this.w = w;
    this.h = hgt;
    this.layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const size = Math.max(70, Math.min(120, hgt * 0.2));
    const card = creatureCard(this.parent, { size });
    card.container.position.set(w * 0.2, hgt * 0.24);
    this.layer.addChild(card.container);

    const heading = label('The four products of your meiosis', 15, { fill: PALETTE.inkSoft });
    heading.anchor.set(0.5, 0);
    heading.position.set(w * 0.64, hgt * 0.08);
    this.layer.addChild(heading);

    const r = Math.max(24, Math.min(42, w * 0.045));
    this.mod.state.meiosisProducts.forEach((p, i) => {
      const g = gameteView(this.inst, p.chromosomes[0][0], r);
      g.position.set(w * 0.64 + (i - 1.5) * r * 2.5, hgt * 0.08 + 30 + r * 1.3);
      this.layer.addChild(g);
    });

    // Bins for sampled gametes, one column per allele.
    this.bins = this.trait.alleles.map((a, i) => {
      const x = w * (0.35 + i * 0.3);
      const baseY = hgt - 40;
      const t = label(`${a.label} gametes`, 15);
      t.anchor.set(0.5, 0);
      t.position.set(x, baseY + 8);
      this.layer.addChild(t);
      const line = new PIXI.Graphics().moveTo(x - 80, baseY).lineTo(x + 80, baseY).stroke({ width: 2, color: PALETTE.cellEdge });
      this.layer.addChild(line);
      return { id: a.id, x, baseY };
    });
    this.dotR = Math.max(3.5, Math.min(5.5, w * 0.008));
    this.pileTop = hgt * 0.08 + 30 + r * 2.6 + 30;
    this.cardPos = { x: card.container.x, y: card.container.y };
    this.redrawDots();
  }

  // Position of the nth dot in a bin, or null once the pile reaches the gametes row (the tally keeps counting).
  dotTarget(binIndex, n) {
    const b = this.bins[binIndex];
    const perRow = 12;
    const col = n % perRow;
    const row = Math.floor(n / perRow);
    const step = this.dotR * 2.3;
    const y = b.baseY - this.dotR - 4 - row * step;
    if (y < this.pileTop) return null;
    return { x: b.x + (col - (perRow - 1) / 2) * step, y };
  }

  redrawDots() {
    this.dotLayer.removeChildren().forEach((c) => c.destroy());
    const filled = this.trait.alleles.map(() => 0);
    for (const d of this.dots) {
      const bi = this.trait.alleles.findIndex((a) => a.id === d.allele);
      const p = this.dotTarget(bi, filled[bi]++);
      if (!p) continue;
      const g = new PIXI.Graphics().circle(0, 0, this.dotR).fill(d.color);
      g.position.set(p.x, p.y);
      this.dotLayer.addChild(g);
    }
  }

  // 100 gametes, each dot colored by the homolog it came from.
  // 'tetrads': all four products of 25 meioses (a heterozygote always gives exactly half).
  // 'random': one random product from each of 100 meioses, like one egg per meiosis (binomial wobble).
  async sample(mode) {
    const tw = this.mod.ctx.tween;
    const filled = this.trait.alleles.map((a) => this.dots.filter((d) => d.allele === a.id).length);
    const batch = [];
    const rng = this.inst.rng;
    const add = (p) => {
      const c = p.chromosomes[0][0];
      batch.push({ allele: c.segments[0].hap.alleles[this.trait.id], color: c.segments[0].hap.color });
    };
    if (mode === 'tetrads') {
      for (let i = 0; i < 25; i++) meiosis(this.parent.cell, rng, { crossingOver: false }).products.forEach(add);
    } else {
      for (let i = 0; i < 100; i++) {
        const { products } = meiosis(this.parent.cell, rng, { crossingOver: false });
        add(products[Math.floor(rng() * 4)]);
      }
    }
    this.lastMode = mode;
    this.modes = this.modes ?? new Set();
    this.modes.add(mode);
    this.sampling = true;
    this.renderPanel();
    const anims = batch.map((d, i) => {
      const bi = this.trait.alleles.findIndex((a) => a.id === d.allele);
      const p = this.dotTarget(bi, filled[bi]++);
      if (!p) return null;
      const g = new PIXI.Graphics().circle(0, 0, this.dotR).fill(d.color);
      g.position.set(this.cardPos.x, this.cardPos.y);
      g.alpha = 0;
      this.dotLayer.addChild(g);
      return tw.to(g, { x: p.x, y: p.y, alpha: 1 }, { duration: 500, delay: i * 12, ease: 'outCubic' });
    });
    await Promise.all(anims);
    this.dots.push(...batch);
    for (const d of batch) this.counts[d.allele]++;
    this.sampling = false;
    if (!this.mod.done.has('gametes')) this.mod.complete('gametes');
    this.renderPanel();
  }

  reset() {
    this.dots = [];
    for (const k of Object.keys(this.counts)) this.counts[k] = 0;
    this.redrawDots();
    this.renderPanel();
  }

  renderPanel() {
    const body = clear(this.body);
    const [x, y] = this.parent.alleles;
    const p = (Number(x === this.target) + Number(y === this.target)) / 2;
    const tl = alleleLabel(this.trait, this.target);
    body.append(
      h('h2', {}, 'From one meiosis to many gametes'),
      h('p', {}, `${this.parent.name} is ${this.parent.label}. Every gamete gets exactly one of the two copies of this gene.`),
    );

    if (!this.mod.state.answered.has('gametes:fraction')) {
      body.append(
        question({
          prompt: `What fraction of ${this.parent.name}’s gametes carry ${tl}?`,
          options: [0, 0.25, 0.5, 0.75, 1].map((v) => ({
            label: fraction(v),
            correct: v === p,
            feedback:
              v === p
                ? `Right. ${this.parent.label} has ${p === 0.5 ? 'one' : p === 1 ? 'two' : 'no'} ${tl} cop${p === 0.5 ? 'y' : 'ies'}, and each gamete gets one of the two copies at random.`
                : v === 0.25 || v === 0.75
                  ? 'Each gamete gets one of the two copies, so the answer has to be 0, 1/2 or 1.'
                  : `Count the ${tl} copies in ${this.parent.label}.`,
          })),
          onCorrect: () => {
            this.mod.state.answered.add('gametes:fraction');
            setTimeout(() => this.renderPanel(), 900);
          },
        }),
      );
      return;
    }

    body.append(h('p', { class: 'hint' }, `✓ Expected fraction carrying ${tl}: ${fraction(p)}`));
    const total = this.dots.length;
    body.append(
      h('p', {}, 'Now test it with real meioses from the engine. Dots are colored by the homolog each gamete came from. Try both ways of collecting:'),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn primary', disabled: this.sampling, onclick: () => this.sample('random') }, '1 gamete from each of 100 meioses'),
        h('button', { class: 'btn', disabled: this.sampling, onclick: () => this.sample('tetrads') }, 'All 4 products of 25 meioses'),
      ),
      h('button', { class: 'btn small', disabled: this.sampling || !total, onclick: () => this.reset() }, 'Clear'),
    );
    if (total) {
      body.append(
        h(
          'div',
          { class: 'tally' },
          this.trait.alleles.map((a) => {
            const n = this.counts[a.id];
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
        h('p', { class: 'hint' }, `${total} gametes. The dark tick marks the expected fraction.`),
        h(
          'div',
          { class: 'callout' },
          h('b', {}, this.lastMode === 'tetrads' ? 'Exactly half, every time' : 'Close to half, with wobble'),
          this.lastMode === 'tetrads'
            ? 'Collecting all four products of each meiosis gives exactly 2 of each allele per meiosis, because the homologs always split 2:2. Fungi let you collect whole tetrads like this. Animals usually keep one product per meiosis (one egg), so their counts wobble.'
            : 'Keeping one random product per meiosis is like collecting eggs, or random spores: each is a coin flip, so the observed fraction wobbles around ½, and the wobble shrinks as you collect more.',
        ),
        h(
          'div',
          { class: 'callout' },
          h('b', {}, 'Law of segregation'),
          'The two copies of a gene separate at Meiosis I, and the orientation of the pair is random, so each gamete carries one copy with probability ½.',
        ),
        h('button', { class: 'btn primary', onclick: () => this.mod.next() }, 'Continue: fertilization ▶'),
      );
    }
  }
}
