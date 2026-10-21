// Step D: predict the offspring ratio, then breed and watch the counts converge on it.

import { h, clear, question } from '../../core/dom.js';
import { PALETTE } from '../../core/palette.js';
import { offspringPhenotypes, offspringGenotypes, allGenotypes, integerRatio, fraction } from '../../engine/cross.js';
import { genotypeLabel } from '../../engine/phenotype.js';
import { Creature } from '../../render/creature.js';
import { label } from '../../render/chromosome.js';
import { creatureCard, breed, phenotypeClasses } from './instance.js';

export function ratioText(dist) {
  const ints = integerRatio(dist.map((d) => d.p));
  if (dist.length === 1) return `All ${dist[0].label}`;
  return dist.map((d, i) => `${ints[i]} ${d.label}`).join(' : ');
}

export class BreedStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.parents = this.inst.parents;
    this.trait = this.inst.trait;
    this.classes = phenotypeClasses(this.trait);
    this.dist = offspringPhenotypes(this.trait, this.parents[0].alleles, this.parents[1].alleles);
    this.counts = mod.state.breedCounts ?? (mod.state.breedCounts = Object.fromEntries(this.classes.map((c) => [c.key, 0])));
    this.kids = [];
  }

  enter(container, body) {
    this.container = container;
    this.body = body;
    this.layer = new PIXI.Container();
    this.kidLayer = new PIXI.Container();
    container.addChild(this.layer, this.kidLayer);
    const { w, h: hgt } = this.mod.ctx.size();
    this.resize(w, hgt);
    this.renderPanel();
  }

  exit() {}

  resize(w, hgt) {
    this.w = w;
    this.h = hgt;
    this.layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const size = Math.max(60, Math.min(96, hgt * 0.14));
    this.parents.forEach((p, i) => {
      const card = creatureCard(p, { size });
      card.container.position.set(w * (0.32 + i * 0.36), size * 0.7);
      this.layer.addChild(card.container);
    });
    const x = label('×', size * 0.45, { fill: PALETTE.inkSoft });
    x.anchor.set(0.5);
    x.position.set(w / 2, size * 0.7);
    this.layer.addChild(x);
    this.gridTop = size * 2.2;
    this.layoutKids(false);
  }

  // Up to 24 most recent offspring in a grid.
  layoutKids(animate) {
    const cols = Math.max(4, Math.floor(this.w / 90));
    const cell = Math.min(90, (this.w - 40) / cols);
    const size = cell * 0.62;
    this.kids.forEach((k, i) => {
      const x = 20 + cell * ((i % cols) + 0.5);
      const y = this.gridTop + cell * (Math.floor(i / cols) + 0.5);
      if (animate) this.mod.ctx.tween.to(k, { x, y }, { duration: 300 });
      else k.position.set(x, y);
      if (k.size !== size) {
        k.size = size;
        k.setFeatures(k.features);
      }
    });
  }

  breedMany(n) {
    let last = [];
    for (let i = 0; i < n; i++) {
      const kid = breed(this.inst, this.parents[0], this.parents[1], this.inst.rng);
      this.counts[kid.phenotype.key]++;
      last.push(kid);
    }
    const cols = Math.max(4, Math.floor(this.w / 90));
    const rows = Math.max(1, Math.floor((this.h - this.gridTop - 10) / Math.min(90, (this.w - 40) / cols)));
    const max = cols * rows;
    last = last.slice(-max);
    for (const k of last) {
      const c = new Creature(k.features, { size: 40, idle: n <= 10 });
      const tag = label(k.label, 12, { fill: PALETTE.sage });
      tag.anchor.set(0.5, 0);
      tag.y = 24;
      c.addChild(tag);
      c.alpha = 0;
      this.kidLayer.addChild(c);
      this.kids.push(c);
      this.mod.ctx.tween.to(c, { alpha: 1 }, { duration: 300 });
    }
    while (this.kids.length > max) this.kids.shift().destroy();
    this.layoutKids(false);
    this.renderPanel();
  }

  total() {
    return Object.values(this.counts).reduce((s, n) => s + n, 0);
  }

  ratioOptions() {
    const genos = allGenotypes(this.trait);
    const seen = new Map();
    for (const g1 of genos) for (const g2 of genos) {
      const text = ratioText(offspringPhenotypes(this.trait, g1, g2));
      seen.set(text, true);
    }
    const right = ratioText(this.dist);
    return [...seen.keys()].sort().map((text) => ({
      label: text,
      correct: text === right,
      feedback:
        text === right
          ? `Right. Build it from the gametes: each parent’s two alleles each go to half its gametes, and every combination is equally likely.`
          : `Not for this cross. Write out each parent’s gametes (½ each) and combine them.`,
    }));
  }

  genotypeQuestion() {
    const [p1, p2] = this.parents;
    const genos = offspringGenotypes(this.trait, p1.alleles, p2.alleles);
    const target = genos.find((g) => g.alleles[0] === g.alleles[1]) ?? genos[0];
    const tl = genotypeLabel(this.trait, target.alleles);
    return {
      prompt: `What proportion of the offspring of ${p1.label} × ${p2.label} do you expect to be ${tl}?`,
      options: [0, 0.25, 0.5, 0.75, 1].map((v) => ({
        label: fraction(v),
        correct: Math.abs(v - target.p) < 1e-9,
        feedback:
          Math.abs(v - target.p) < 1e-9
            ? `Right: ${fraction(target.p)}. Multiply the chance of the right gamete from each parent.`
            : `Find the probability that ${p1.name} gives the needed allele, times the probability that ${p2.name} does.`,
      })),
    };
  }

  renderPanel() {
    const body = clear(this.body);
    const [p1, p2] = this.parents;
    const answered = this.mod.state.answered;
    body.append(
      h('h2', {}, 'Predict, then breed'),
      h(
        'p',
        {},
        `${p1.name} (${p1.label}) × ${p2.name} (${p2.label}), the cross from your Punnett square. Each offspring is one fertilization: a random egg from ${p1.name} and a random sperm from ${p2.name}, landing in one cell of the square. A litter is many of these independent events.`,
      ),
    );

    if (!answered.has('breed:ratio')) {
      body.append(
        question({
          prompt: 'Before breeding: what ratio of offspring phenotypes do you expect?',
          options: this.ratioOptions(),
          onCorrect: () => {
            answered.add('breed:ratio');
            setTimeout(() => this.renderPanel(), 1000);
          },
        }),
      );
      return;
    }

    const total = this.total();
    body.append(
      h('p', { class: 'hint' }, `✓ Expected: ${ratioText(this.dist)}`),
      h(
        'div',
        { class: 'row' },
        [1, 10, 100].map((n) => h('button', { class: n === 10 ? 'btn primary' : 'btn', onclick: () => this.breedMany(n) }, `Breed ${n}`)),
      ),
    );
    if (total) {
      body.append(
        h(
          'div',
          { class: 'tally' },
          this.classes.map((c) => {
            const n = this.counts[c.key];
            const exp = this.dist.find((d) => d.key === c.key)?.p ?? 0;
            return h(
              'div',
              { class: 'tally-row' },
              h('span', {}, `${c.label}: ${n}`),
              h('div', { class: 'tally-bar' }, h('i', { style: { width: `${(100 * n) / total}%` } }), h('em', { style: { left: `${exp * 100}%` } })),
              h('span', {}, `${((100 * n) / total).toFixed(0)}%`),
            );
          }),
        ),
        h('p', { class: 'hint' }, `${total} offspring so far. Ticks mark the expected fractions. Each offspring came from two real meioses and a fertilization.`),
      );
    }

    if (total >= 30) {
      if (!answered.has('breed:genotype')) {
        body.append(
          question({
            ...this.genotypeQuestion(),
            onCorrect: () => {
              answered.add('breed:genotype');
              this.mod.complete('breed');
              setTimeout(() => this.renderPanel(), 1000);
            },
          }),
        );
      } else {
        body.append(
          h(
            'div',
            { class: 'callout' },
            h('b', {}, 'Small samples are noisy'),
            'With 10 offspring the counts can stray far from the ratio; with hundreds they settle close. Unit E turns that into a test: is a deviation bigger than chance alone would produce?',
          ),
          h('button', { class: 'btn primary', onclick: () => this.mod.next() }, 'Continue: detective ▶'),
        );
      }
    } else if (total) {
      body.append(h('p', { class: 'hint' }, `Breed at least 30 to unlock the next question.`));
    }
  }
}
