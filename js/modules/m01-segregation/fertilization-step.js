// Step 3: fertilization. Pick one gamete from each parent; each pairing fills one box of the Punnett square.

import { h, clear, question } from '../../core/dom.js';
import { PALETTE } from '../../core/palette.js';
import { meiosis, fertilize } from '../../engine/meiosis.js';
import { allelesAt } from '../../engine/genome.js';
import { alleleLabel, genotypeLabel } from '../../engine/phenotype.js';
import { creatureFeatures } from '../../species/catalog.js';
import { Creature } from '../../render/creature.js';
import { label } from '../../render/chromosome.js';
import { creatureCard, gameteView, highlight } from './instance.js';

export class FertilizationStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.parents = this.inst.parents;
    this.filled = mod.state.punnett ?? (mod.state.punnett = new Map());
    this.events = 0;
    this.selected = [null, null];
    this.offspring = [];
    this.busy = false;
  }

  enter(container, body) {
    this.container = container;
    this.body = body;
    this.layer = new PIXI.Container();
    this.gameteLayer = new PIXI.Container();
    this.kidLayer = new PIXI.Container();
    container.addChild(this.layer, this.gameteLayer, this.kidLayer);
    this.newMeioses(false);
    const { w, h: hgt } = this.mod.ctx.size();
    this.resize(w, hgt);
    this.renderPanel();
  }

  exit() {}

  newMeioses(relayout = true) {
    this.products = this.parents.map((p) => meiosis(p.cell, this.inst.rng, { crossingOver: false }).products);
    this.used = [new Set(), new Set()];
    this.selected = [null, null];
    if (relayout) {
      this.layoutGametes();
      this.renderPanel();
    }
  }

  resize(w, hgt) {
    this.w = w;
    this.h = hgt;
    this.layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const size = Math.max(64, Math.min(104, hgt * 0.15));
    this.cardSize = size;
    this.parentX = [w * 0.2, w * 0.8];
    this.parents.forEach((p, i) => {
      const card = creatureCard(p, { size });
      card.container.position.set(this.parentX[i], size * 0.7);
      this.layer.addChild(card.container);
    });
    this.zone = { x: w / 2, y: hgt * 0.47, r: Math.max(34, Math.min(56, w * 0.05)) };
    const ring = new PIXI.Graphics();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 14) ring.arc(this.zone.x, this.zone.y, this.zone.r, a, a + Math.PI / 24).stroke({ width: 2, color: PALETTE.cellEdge });
    this.layer.addChild(ring);
    const zl = label('fertilization', 13, { fill: PALETTE.inkSoft, fontWeight: '700' });
    zl.anchor.set(0.5, 0);
    zl.position.set(this.zone.x, this.zone.y + this.zone.r + 6);
    this.layer.addChild(zl);
    const kl = label('offspring', 13, { fill: PALETTE.inkSoft, fontWeight: '700' });
    const kidSize = Math.max(44, Math.min(70, hgt * 0.1));
    kl.anchor.set(0.5, 1);
    kl.position.set(w / 2, hgt - 30 - kidSize * 1.45);
    this.layer.addChild(kl);
    this.layoutGametes();
    this.layoutKids();
  }

  layoutGametes() {
    this.gameteLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const r = Math.max(20, Math.min(32, this.w * 0.03));
    this.gametes = [[], []];
    this.products.forEach((list, pi) => {
      list.forEach((prod, gi) => {
        const chromatid = prod.chromosomes[0][0];
        const g = gameteView(this.inst, chromatid, r);
        const cols = 2;
        const gx = this.parentX[pi] + ((gi % cols) - 0.5) * r * 2.6;
        const gy = this.cardSize * 2.05 + Math.floor(gi / cols) * r * 2.5;
        g.position.set(gx, gy);
        g.home = { x: gx, y: gy };
        g.homolog = chromatid.homolog;
        g.chromatid = chromatid;
        g.product = prod;
        g.alpha = this.used[pi].has(gi) ? 0.25 : 1;
        g.eventMode = this.used[pi].has(gi) ? 'none' : 'static';
        g.cursor = 'pointer';
        g.on('pointertap', () => this.select(pi, gi));
        this.gameteLayer.addChild(g);
        this.gametes[pi].push(g);
      });
    });
  }

  layoutKids() {
    const size = Math.max(44, Math.min(70, this.h * 0.1));
    const shown = this.offspring.slice(-6);
    shown.forEach((k, i) => {
      k.position.set(this.w / 2 + (i - (shown.length - 1) / 2) * size * 1.25, this.h - 30 - size * 0.62);
    });
  }

  select(pi, gi) {
    if (this.busy) return;
    const prev = this.selected[pi];
    if (prev !== null) highlight(this.gametes[pi][prev], false);
    this.selected[pi] = prev === gi ? null : gi;
    if (this.selected[pi] !== null) highlight(this.gametes[pi][gi], true, pi === 0 ? PALETTE.clay : PALETTE.dusk);
    if (this.selected[0] !== null && this.selected[1] !== null) this.fuse();
    else this.renderPanel();
  }

  async fuse() {
    this.busy = true;
    const tw = this.mod.ctx.tween;
    const [ga, gb] = [this.gametes[0][this.selected[0]], this.gametes[1][this.selected[1]]];
    const { x, y } = this.zone;
    await Promise.all([
      tw.to(ga, { x: x - ga.radius * 0.6, y }, { duration: 650 }),
      tw.to(gb, { x: x + gb.radius * 0.6, y }, { duration: 650 }),
    ]);
    await Promise.all([tw.to(ga, { x, alpha: 0 }, { duration: 350 }), tw.to(gb, { x, alpha: 0 }, { duration: 350 })]);

    const zygote = fertilize(ga.product.cell, gb.product.cell);
    const alleles = allelesAt(zygote, this.inst.trait.id);
    const phenotype = this.inst.trait.express(alleles);
    const size = Math.max(44, Math.min(70, this.h * 0.1));
    const kid = new Creature(creatureFeatures(this.inst.species, [phenotype]), { size });
    const tag = label(genotypeLabel(this.inst.trait, alleles), Math.max(12, size * 0.22), { fill: PALETTE.sage });
    tag.anchor.set(0.5, 0);
    tag.y = size * 0.55;
    kid.addChild(tag);
    kid.position.set(x, y);
    kid.scale.set(0.2);
    this.kidLayer.addChild(kid);
    await tw.to(kid.scale, { x: 1, y: 1 }, { duration: 450, ease: 'outBack' });
    this.offspring.push(kid);
    while (this.offspring.length > 6) this.offspring.shift().destroy();
    const targets = this.offspring.slice();
    const before = targets.map((k) => ({ x: k.x, y: k.y }));
    this.layoutKids();
    const after = targets.map((k) => ({ x: k.x, y: k.y }));
    targets.forEach((k, i) => k.position.set(before[i].x, before[i].y));
    await Promise.all(targets.map((k, i) => tw.to(k, after[i], { duration: 500 })));

    this.used[0].add(this.selected[0]);
    this.used[1].add(this.selected[1]);
    this.filled.set(`${ga.homolog}-${gb.homolog}`, true);
    this.events++;
    this.selected = [null, null];
    this.layoutGametes();
    this.busy = false;
    this.renderPanel();
  }

  punnett() {
    const [pa, pb] = this.parents;
    const t = this.inst.trait;
    const al = (id) => alleleLabel(t, id);
    return h(
      'table',
      { class: 'punnett' },
      h(
        'tr',
        {},
        h('th', {}, `${pa.name} ↓ · ${pb.name} →`),
        pb.alleles.map((b) => h('th', {}, al(b), h('small', {}, 'gamete ½'))),
      ),
      pa.alleles.map((a, i) =>
        h(
          'tr',
          {},
          h('th', {}, al(a), h('small', {}, 'gamete ½')),
          pb.alleles.map((b, j) => {
            const done = this.filled.has(`${i}-${j}`);
            return h(
              'td',
              { class: done ? 'filled' : '' },
              done ? genotypeLabel(t, [a, b]) : '?',
              done ? h('small', {}, `½ × ½ = ¼ · ${t.express([a, b]).label}`) : null,
            );
          }),
        ),
      ),
    );
  }

  renderPanel() {
    const body = clear(this.body);
    const [pa, pb] = this.parents;
    body.append(
      h('h2', {}, 'Fertilization'),
      h('p', {}, `${pa.name} (${pa.label}) × ${pb.name} (${pb.label}). Each parent just ran one meiosis. Tap one gamete from each parent to fuse them.`),
      this.punnett(),
      h('p', { class: 'hint' }, `Gametes are colored by the parental homolog they carry. Each fertilization fills its box in the square. Boxes filled: ${this.filled.size} of 4.`),
    );

    const usedUp = this.used.some((s) => s.size === 4);
    body.append(h('div', { class: 'row' }, h('button', { class: usedUp ? 'btn primary' : 'btn', disabled: this.busy, onclick: () => this.newMeioses() }, 'New meiosis for both parents')));

    if (this.filled.size >= 4 || this.events >= 4 || this.mod.state.answered.has('fert:punnett')) {
      if (this.mod.state.answered.has('fert:punnett')) {
        body.append(
          h('p', { class: 'hint' }, '✓ A Punnett square shows probabilities of fertilization events and the zygote genotypes they produce.'),
          h('button', { class: 'btn primary', onclick: () => this.mod.next() }, 'Continue: predict, then breed ▶'),
        );
      } else {
        body.append(
          question({
            prompt: 'So what does a Punnett square represent?',
            options: [
              { label: 'The mechanism of meiosis', feedback: 'Meiosis happened inside each parent before any of this. The square starts from its outcomes.' },
              { label: 'The mechanism of mitosis', feedback: 'Mitosis copies a cell. Nothing here is a mitotic division.' },
              { label: 'Probabilities of meiotic outcomes and the gamete genotypes', feedback: 'That is only the edges of the square. Each box inside is something else.' },
              {
                label: 'Probabilities of fertilization events and the resulting zygote genotypes',
                correct: true,
                feedback: 'Right. The edges are gametes (each ½); each box is one fertilization event with probability ½ × ½ = ¼ and the zygote it makes.',
              },
            ],
            onCorrect: () => {
              this.mod.state.answered.add('fert:punnett');
              this.mod.complete('fertilization');
              setTimeout(() => this.renderPanel(), 1200);
            },
          }),
        );
      }
    }
  }
}
