// Step C: the dihybrid Punnett square. Sperm run across the top with the father above, eggs down the left with the
// mother beside them. Each of the 16 cells is one kind of fertilization, with probability ¼ × ¼, and the cells sort
// into four phenotype classes, 9:3:3:1.

import { h, clear, question } from '../../core/dom.js';
import { shuffle } from '../../core/rng.js';
import { PALETTE, css } from '../../core/palette.js';
import { dihybridGametes, gameteLabel } from '../../engine/dihybrid.js';
import { offspringPhenotypes, fraction, integerRatio } from '../../engine/cross.js';
import { Creature } from '../../render/creature.js';
import { label } from '../../render/chromosome.js';
import { genesOf, expectedClasses, genotypeOf, lookOf, creatureCard, questionRng } from './instance.js';
import { eggView, spermView } from './views.js';

const CLASS_COLORS = [PALETTE.sage, PALETTE.ochre, PALETTE.dusk, PALETTE.clay];
const GLYPH = { 0.5: '½', 0.25: '¼', 0.75: '¾' };
const fr = (p) => GLYPH[p] ?? fraction(p);

export class CrossStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.mother = genesOf(this.inst, this.inst.mother);
    this.father = genesOf(this.inst, this.inst.father);
    this.eggs = dihybridGametes(this.mother);
    this.sperm = dihybridGametes(this.father);
    this.classes = expectedClasses(this.inst);
  }

  get answered() {
    return this.mod.state.answered;
  }

  enter(container, body) {
    this.container = container;
    this.body = body;
    const { w, h: hgt } = this.mod.ctx.size();
    this.resize(w, hgt);
    this.renderPanel();
  }

  exit() {
    this.exited = true;
  }

  // ---- the square ----

  // One cell: the zygote from egg i and sperm j.
  cellInfo(i, j) {
    const egg = this.eggs[i];
    const sperm = this.sperm[j];
    const genes = this.inst.traits.map((t, k) => [egg.alleles[k], sperm.alleles[k]]);
    return { genotype: genotypeOf(this.inst, genes), look: lookOf(this.inst, genes), p: egg.p * sperm.p, pe: egg.p, ps: sperm.p };
  }

  // Two layouts: the mother beside the eggs when there is room, or both parents above the square on a narrow
  // screen. Whichever gives the larger cells wins. Margins are in units of the cell size.
  geometry(w, hgt) {
    const n = this.eggs.length;
    const fit = (left, top) => Math.min(150, (w - 24) / (n + left), (hgt - 16) / (n + top));
    const side = { compact: false, left: 1.45, top: 1.7 };
    const above = { compact: true, left: 0.6, top: 2.25 };
    const L = fit(side.left, side.top) >= fit(above.left, above.top) ? side : above;
    const s = fit(L.left, L.top);
    const x0 = Math.max(12, (w - (L.left + n) * s) / 2) + L.left * s;
    const y0 = Math.max(8, (hgt - (L.top + n) * s) / 2) + L.top * s;
    return { ...L, s, n, x0, y0 };
  }

  resize(w, hgt) {
    this.container.removeChildren().forEach((c) => c.destroy({ children: true }));
    const G = (this.G = this.geometry(w, hgt));
    const { s, n, x0, y0 } = G;
    const layer = new PIXI.Container();
    this.container.addChild(layer);
    const roleSize = Math.max(12, s * 0.11);

    // The parents: father above the square, mother to the left (or above-left on a narrow screen).
    const size = Math.max(40, s * 0.5);
    const place = (parent, role, color, x, y) => {
      const card = creatureCard(parent, { size });
      const b = card.container.getLocalBounds();
      card.container.position.set(x, y - b.y);
      const t = label(role, roleSize, { fill: color, fontWeight: '800' });
      // Beside the creature, clear of its widest point.
      const body = card.creature.getLocalBounds();
      t.anchor.set(1, 0.5);
      t.position.set(card.container.x + body.x - 8, card.container.y);
      layer.addChild(card.container, t);
    };
    const top = y0 - G.top * s;
    place(this.inst.father, 'Father', PALETTE.dusk, x0 + (n * s) / 2 + (G.compact ? s * 0.9 : 0), top + 4);
    if (G.compact) {
      place(this.inst.mother, 'Mother', PALETTE.clay, x0 + s * 0.7, top + 4);
    } else {
      const card = creatureCard(this.inst.mother, { size });
      const b = card.container.getLocalBounds();
      card.container.position.set(x0 - G.left * s + b.width / 2 + 4, y0 + (n * s) / 2 - (b.y + b.height / 2));
      const t = label('Mother', roleSize, { fill: PALETTE.clay, fontWeight: '800' });
      t.anchor.set(0.5, 1);
      t.position.set(card.container.x, card.container.y + b.y - 2);
      layer.addChild(card.container, t);
    }

    // Sperm across the top, eggs down the left, each with its probability.
    const small = Math.max(10, s * 0.09);
    const spermY = y0 - s * 0.3;
    this.sperm.forEach((g, j) => {
      const v = spermView(gameteLabel(this.father, g.alleles), s * 0.24);
      v.position.set(x0 + s * (j + 0.5) - s * 0.12, spermY);
      const p = label(fr(g.p), small, { fill: PALETTE.inkSoft });
      p.anchor.set(0.5, 1);
      p.position.set(v.x, spermY - s * 0.15);
      layer.addChild(v, p);
    });
    const eggX = x0 - s * 0.28;
    this.eggs.forEach((g, i) => {
      const v = eggView(gameteLabel(this.mother, g.alleles), s * 0.2);
      v.position.set(eggX, y0 + s * (i + 0.5) - s * 0.06);
      const p = label(fr(g.p), small, { fill: PALETTE.inkSoft });
      p.anchor.set(0.5, 0);
      p.position.set(eggX, v.y + s * 0.21);
      layer.addChild(v, p);
    });

    // The cells, tinted by phenotype class once the ratio question is answered.
    const tint = this.answered.has('cross:ratio');
    const classIndex = new Map(this.classes.map((c, k) => [c.key, k]));
    const grid = new PIXI.Graphics();
    layer.addChild(grid);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const info = this.cellInfo(i, j);
        const color = tint ? CLASS_COLORS[classIndex.get(info.look.key) % CLASS_COLORS.length] : null;
        grid
          .roundRect(x0 + s * j + 2, y0 + s * i + 2, s - 4, s - 4, 8)
          .fill(color ? { color, alpha: 0.18 } : PALETTE.panel)
          .stroke({ width: 1.5, color: PALETTE.cellEdge });
        const c = this.cellView(info, s);
        c.position.set(x0 + s * (j + 0.5), y0 + s * (i + 0.5));
        layer.addChild(c);
      }
  }

  // A cell shows its bdellbee, its genotype and its probability, as P(B/b ; S/s) = ¼ × ¼ = 1/16.
  cellView(info, s) {
    const c = new PIXI.Container();
    const creature = new Creature(info.look.features, { size: s * 0.38 });
    creature.y = -s * 0.2;
    const g = label(info.genotype, Math.max(10, s * 0.115), { fill: PALETTE.sage, fontWeight: '800' });
    g.anchor.set(0.5, 0);
    g.y = -s * 0.02;
    if (g.width > s - 8) g.scale.set((s - 8) / g.width);
    const product = `${fr(info.pe)} × ${fr(info.ps)} = ${fr(info.p)}`;
    const p = label(`P(${info.genotype}) =\n${product}`, Math.max(9, s * 0.082), { fill: PALETTE.ink, fontWeight: '700', align: 'center' });
    // In a small cell the genotype is already written just above, so the probability can go without it.
    if (p.width > s - 8) p.text = product;
    if (p.width > s - 8) p.scale.set((s - 8) / p.width);
    p.anchor.set(0.5, 0);
    p.y = g.y + g.height;
    c.addChild(creature, g, p);
    return c;
  }

  // ---- panel ----

  ratio() {
    return integerRatio(this.classes.map((c) => c.p)).join(':');
  }

  // Per-gene phenotype probability for one class, read from the single-gene crosses.
  geneBreakdown(classKey) {
    return this.inst.traits.map((t, i) => {
      const part = classKey.split('|')[i];
      const ph = offspringPhenotypes(t, this.mother[i].alleles, this.father[i].alleles).find((x) => x.key === part);
      return { label: ph.label, p: ph.p };
    });
  }

  ask(body, key, q, then) {
    body.append(
      question({
        ...q,
        onCorrect: () => {
          this.answered.add(key);
          then?.();
          setTimeout(() => !this.exited && this.renderPanel(), 900);
        },
      }),
    );
  }

  renderPanel() {
    if (this.exited) return;
    const body = clear(this.body);
    const { mother, father } = this.inst;
    const cells = this.eggs.length * this.sperm.length;
    const pCell = this.eggs[0].p * this.sperm[0].p;
    body.append(
      h('h2', {}, 'The Punnett square'),
      h('p', {}, `${mother.name} (${mother.label}) × ${father.name} (${father.label}). Both parents are heterozygous at both genes.`),
      h(
        'p',
        {},
        `Sperm from ${father.name} run across the top and eggs from ${mother.name} down the left. Each cell is one kind of fertilization event: that egg meeting that sperm. The square is a summary of how likely each event is, not a mechanism.`,
      ),
    );

    if (!this.answered.has('cross:cells')) {
      this.ask(body, 'cross:cells', {
        prompt: `Each parent makes ${this.eggs.length} kinds of gametes, equally often. How many kinds of egg-and-sperm combinations are there, and how likely is each?`,
        options: shuffle(questionRng(this.inst, 31), [
          [this.eggs.length + this.sperm.length, 1 / (this.eggs.length + this.sperm.length)],
          [cells, pCell],
          [cells, 1 / this.eggs.length],
        ]).map(([k, p]) => ({
          label: `${k} kinds, each ${fraction(p)}`,
          correct: k === cells && p === pCell,
          feedback:
            k === cells && p === pCell
              ? `Right: ${this.eggs.length} kinds of egg × ${this.sperm.length} kinds of sperm = ${cells} combinations. Which egg and which sperm meet are independent, so each has probability ${fraction(this.eggs[0].p)} × ${fraction(this.sperm[0].p)} = ${fraction(pCell)}.`
              : k !== cells
                ? 'Every kind of egg can meet every kind of sperm, so the numbers multiply rather than add.'
                : `${fraction(1 / this.eggs.length)} is the chance of one particular egg. The sperm is a separate, independent chance, so multiply the two.`,
        })),
      });
      return;
    }
    body.append(h('p', { class: 'hint' }, `✓ ${cells} combinations, each ${fraction(this.eggs[0].p)} × ${fraction(this.sperm[0].p)} = ${fraction(pCell)}.`));

    if (!this.answered.has('cross:ratio')) {
      const correct = this.ratio();
      const options = shuffle(questionRng(this.inst, 32), [correct, '9:7', '1:1:1:1', '3:1']).map((r) => ({
        label: r,
        correct: r === correct,
        feedback:
          r === correct
            ? `Right. For each gene, ${fr(0.75)} of offspring show the dominant phenotype and ${fr(0.25)} the recessive one, and the genes assort independently, so the classes are 3×3, 3×1, 1×3 and 1×1 out of 16.`
            : r === '9:7'
              ? '9:7 is what you would see if being homozygous recessive at either gene gave the same phenotype. Here each gene colors its own part of the bdellbee, so there are four classes.'
              : r === '1:1:1:1'
                ? '1:1:1:1 is the ratio of the four kinds of gametes. In the offspring, the dominant phenotype of each gene shows in ¾ of the bdellbees.'
                : '3:1 is a single-gene ratio. This cross follows two genes, so there are four phenotype classes.',
      }));
      this.ask(
        body,
        'cross:ratio',
        { prompt: 'Sort the 16 bdellbees in the square by how they look. What is the ratio of the phenotype classes?', options },
        () => this.resize(this.mod.ctx.size().w, this.mod.ctx.size().h),
      );
      return;
    }

    this.mod.complete('cross');
    const rows = this.classes.map((c, k) => {
      const parts = this.geneBreakdown(c.key);
      return h(
        'tr',
        {},
        h('td', {}, h('span', { class: 'swatch', style: { background: css(CLASS_COLORS[k % CLASS_COLORS.length]) } }), c.label),
        h('td', {}, String(Math.round(c.p * cells))),
        h('td', {}, `${parts.map((x) => fr(x.p)).join(' × ')} = ${fraction(c.p)}`),
      );
    });
    body.append(
      h('p', { class: 'hint' }, `✓ Expected ratio ${this.ratio()}`),
      h('table', { class: 'arrangements' }, h('tr', {}, h('th', {}, 'Phenotype'), h('th', {}, `of ${cells}`), h('th', {}, 'Product rule')), rows),
      h(
        'div',
        { class: 'callout' },
        h('b', {}, 'The 9:3:3:1 ratio is two 3:1 ratios multiplied'),
        `Each gene alone gives 3:1 (${this.inst.traits.map((t) => t.name.toLowerCase()).join(' and ')}). Because the genes assort independently, the probability of a combination is the product of the single-gene probabilities.`,
      ),
      h('button', { class: 'btn primary', onclick: () => this.mod.next() }, 'Continue: breed a litter ▶'),
    );
  }
}
