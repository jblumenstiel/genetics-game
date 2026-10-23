// Step D: predict the offspring ratio, then breed and watch the counts converge on it.

import { h, clear } from '../../core/dom.js';
import { PALETTE } from '../../core/palette.js';
import { offspringPhenotypes, offspringGenotypes, allGenotypes, integerRatio, fractionGlyph } from '../../engine/cross.js';
import { genotypeLabel, alleleLabel } from '../../engine/phenotype.js';
import { Creature } from '../../render/creature.js';
import { label } from '../../render/chromosome.js';
import { creatureCard, breed, phenotypeClasses } from './instance.js';
import { QuestionSheet, answeredNote, sheetPointer } from './question-sheet.js';

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

  title() {
    return 'Breeding: predict, then breed';
  }

  enter(container, body) {
    this.container = container;
    this.body = body;
    this.layer = new PIXI.Container();
    this.kidLayer = new PIXI.Container();
    container.addChild(this.layer, this.kidLayer);
    this.sheet = new QuestionSheet(this.mod, () => this.resize(this.w, this.h));
    const { w, h: hgt } = this.mod.size();
    this.resize(w, hgt);
    this.renderPanel();
  }

  exit() {
    this.sheet.moveOn(this.mod.state.seen);
    this.sheet.remove();
  }

  resize(w, hgt) {
    this.w = w;
    this.h = hgt;
    this.layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const size = Math.max(60, Math.min(96, (hgt - this.sheet.space()) * 0.14));
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

  // How many offspring fit in the grid above the question sheet.
  capacity() {
    const cols = Math.max(4, Math.floor(this.w / 90));
    const rows = Math.max(1, Math.floor((this.h - this.sheet.space() - this.gridTop - 10) / Math.min(90, (this.w - 40) / cols)));
    return cols * rows;
  }

  // The most recent offspring in a grid, as many as fit.
  layoutKids(animate) {
    const max = this.capacity();
    while (this.kids.length > max) this.kids.shift().destroy();
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
    // Breeding is the student's next move, so the answered prediction leaves the main page.
    this.sheet.moveOn(this.mod.state.seen);
    let last = [];
    for (let i = 0; i < n; i++) {
      const kid = breed(this.inst, this.parents[0], this.parents[1], this.inst.rng);
      this.counts[kid.phenotype.key]++;
      last.push(kid);
    }
    last = last.slice(-this.capacity());
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
    this.layoutKids(false);
    this.renderPanel();
  }

  total() {
    return Object.values(this.counts).reduce((s, n) => s + n, 0);
  }

  gl(alleles) {
    return genotypeLabel(this.trait, alleles);
  }

  // "Bramble (D/d) makes D and d gametes, ½ each", or "only D gametes" for a homozygote.
  gametesOf(p) {
    const kinds = [...new Set(p.alleles)].map((a) => alleleLabel(this.trait, a));
    const made = kinds.length === 1 ? `only ${kinds[0]} gametes` : `${kinds.join(' and ')} gametes, ${fractionGlyph(0.5)} each`;
    return `${p.name} (${p.label}) makes ${made}`;
  }

  // Every phenotype ratio some cross of this gene can give, each wrong one answered with the crosses that give it.
  ratioOptions() {
    const genos = allGenotypes(this.trait);
    const crosses = new Map();
    genos.forEach((g1, i) =>
      genos.slice(i).forEach((g2) => {
        const text = ratioText(offspringPhenotypes(this.trait, g1, g2));
        crosses.set(text, [...(crosses.get(text) ?? []), `${this.gl(g1)} × ${this.gl(g2)}`]);
      }),
    );
    const [p1, p2] = this.parents;
    const right = ratioText(this.dist);
    const genotypes = offspringGenotypes(this.trait, p1.alleles, p2.alleles)
      .map((g) => `${this.gl(g.alleles)} ${fractionGlyph(g.p)}`)
      .join(', ');
    const list = (xs) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);
    return [...crosses.keys()].sort().map((text) => ({
      label: text,
      correct: text === right,
      feedback:
        text === right
          ? `Right. ${this.gametesOf(p1)}; ${this.gametesOf(p2)}. Combining them gives ${genotypes}, so ${right.replace(/^All /, 'all ')}.`
          : `“${text}” is the ratio from ${list(crosses.get(text))}. This cross is ${p1.label} × ${p2.label}: ${this.gametesOf(p1)}, and ${this.gametesOf(p2)}. Combine them.`,
    }));
  }

  // What fraction of offspring have one genotype, with feedback that names the genotype a wrong answer belongs to.
  genotypeQuestion() {
    const [p1, p2] = this.parents;
    const genos = offspringGenotypes(this.trait, p1.alleles, p2.alleles);
    const target = genos.find((g) => g.alleles[0] === g.alleles[1]) ?? genos[0];
    const tl = this.gl(target.alleles);
    const [x, y] = target.alleles.map((a) => alleleLabel(this.trait, a));
    const give = (p, a) => fractionGlyph(p.alleles.filter((b) => b === a).length / 2);
    const [g1, g2] = [give(p1, target.alleles[0]), give(p2, target.alleles[0])];
    const needs =
      x === y
        ? `To be ${tl}, an offspring needs ${x} from ${p1.name} (${p1.label}: probability ${g1}) and ${x} from ${p2.name} (${p2.label}: probability ${g2}). Multiply them.`
        : `To be ${tl}, an offspring needs ${x} from one parent and ${y} from the other. Work out both ways and add them.`;
    const right =
      x === y
        ? `Right: ${x} from ${p1.name} (${g1}) and ${x} from ${p2.name} (${g2}), so ${g1} × ${g2} = ${fractionGlyph(target.p)}.`
        : `Right: ${fractionGlyph(target.p)}, adding the two ways to get ${x} from one parent and ${y} from the other.`;
    const others = genos.filter((o) => o.key !== target.key).map((o) => this.gl(o.alleles));
    // A wrong fraction may be the probability of another genotype or of a phenotype; say which.
    const meaning = (v) => {
      if (v === 0) return `0 would mean no ${tl} offspring at all, but ${x === y ? `each parent can pass on ${x}` : `one parent can pass on ${x} and the other ${y}`}. `;
      if (v === 1 && others.length) return `1 would mean every offspring is ${tl}, but ${others.join(' and ')} offspring appear too. `;
      const g = genos.find((o) => o.key !== target.key && Math.abs(o.p - v) < 1e-9);
      if (g) return `${fractionGlyph(v)} is the probability of ${this.gl(g.alleles)}, not ${tl}. `;
      const ph = this.dist.find((d) => Math.abs(d.p - v) < 1e-9 && d.genotypes.length > 1);
      if (ph) return `${fractionGlyph(v)} is the probability of being ${ph.label} (${ph.genotypes.map((o) => this.gl(o.alleles)).join(' or ')}), and ${tl} is only one of those. `;
      return '';
    };
    return {
      prompt: `What proportion of the offspring of ${p1.label} × ${p2.label} do you expect to be ${tl}?`,
      options: [0, 0.25, 0.5, 0.75, 1].map((v) => {
        const correct = Math.abs(v - target.p) < 1e-9;
        return { label: fractionGlyph(v), correct, feedback: correct ? right : `${meaning(v)}${needs}` };
      }),
    };
  }

  // The panel, with the open question (if any) in the sheet on the main page.
  renderPanel() {
    this.asking = false;
    this.renderBody(clear(this.body));
    if (!this.asking) this.sheet.hide();
  }

  ask(body, key, q, onCorrect) {
    this.asking = true;
    this.sheet.show(key, { ...q, onCorrect });
    body.append(sheetPointer('Each answer you get right is recorded here.'));
  }

  // A question already got right: recorded in the panel, and still on the main page with its answer selected until
  // the student moves on.
  keep(body, key, q) {
    body.append(answeredNote(q));
    if (this.mod.state.seen.has(key)) return;
    this.asking = true;
    this.sheet.show(key, q, { answered: true });
  }

  renderBody(body) {
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

    const ratioQ = { prompt: 'Before breeding: what ratio of offspring phenotypes do you expect?', options: this.ratioOptions() };
    if (!answered.has('breed:ratio')) {
      this.ask(body, 'breed:ratio', ratioQ, () => {
        answered.add('breed:ratio');
        this.renderPanel();
      });
      return;
    }

    const total = this.total();
    this.keep(body, 'breed:ratio', ratioQ);
    body.append(
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
        this.ask(body, 'breed:genotype', this.genotypeQuestion(), () => {
          answered.add('breed:genotype');
          this.mod.complete('breed');
          this.renderPanel();
        });
      } else {
        this.keep(body, 'breed:genotype', this.genotypeQuestion());
        body.append(
          h(
            'div',
            { class: 'callout' },
            h('b', {}, 'Small samples are noisy'),
            'With 10 offspring the counts can stray far from the ratio; with hundreds they settle close. Unit E turns that into a test: is a deviation bigger than chance alone would produce?',
          ),
          h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => this.mod.next() }, 'Continue: E. Detective ▶')),
        );
      }
    } else if (total) {
      body.append(h('p', { class: 'hint' }, `Breed at least 30 to unlock the next question.`));
    }
  }
}
