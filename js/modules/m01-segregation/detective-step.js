// Step E: the reverse problem. Given two parents' phenotypes and a litter, infer the parents' genotypes.
// Hypotheses are scored by likelihood, so "possible but unlikely" answers get their own feedback.

import { h, clear, question } from '../../core/dom.js';
import { PALETTE } from '../../core/palette.js';
import { makeRng } from '../../core/rng.js';
import { allGenotypes, offspringPhenotypes, offspringGenotypes, logLikelihood, genotypeGivenPhenotype, fraction } from '../../engine/cross.js';
import { genotypeLabel, genotypeKey } from '../../engine/phenotype.js';
import { Creature } from '../../render/creature.js';
import { creatureCard, breed, makeParent } from './instance.js';
import { ratioText } from './breed-step.js';
import { pick, shuffle, int } from '../../core/rng.js';

export class DetectiveStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.trait = this.inst.trait;
    this.setup(this.inst.detective);
  }

  setup(det) {
    this.det = det;
    this.rng = makeRng(det.seed);
    this.litter = Array.from({ length: det.litterSize }, () => breed(this.inst, det.parents[0], det.parents[1], this.rng));
    this.counts = {};
    for (const k of this.litter) this.counts[k.phenotype.key] = (this.counts[k.phenotype.key] ?? 0) + 1;
    this.choice = [null, null];
    this.solved = false;
    this.message = null;
  }

  enter(container, body) {
    this.container = container;
    this.body = body;
    this.layer = new PIXI.Container();
    container.addChild(this.layer);
    const { w, h: hgt } = this.mod.ctx.size();
    this.resize(w, hgt);
    this.renderPanel();
  }

  exit() {
    this.destroyScene();
  }

  destroyScene() {
    this.layer.removeChildren().forEach((c) => c.destroy({ children: true }));
  }

  resize(w, hgt) {
    this.w = w;
    this.h = hgt;
    this.destroyScene();
    const size = Math.max(60, Math.min(96, hgt * 0.14));
    this.cards = this.det.parents.map((p, i) => {
      const card = creatureCard(p, { size, genotype: this.solved ? p.label : '?' });
      card.container.position.set(w * (0.32 + i * 0.36), size * 0.7);
      this.layer.addChild(card.container);
      return card;
    });
    const top = size * 2.25;
    const cols = Math.min(this.litter.length, Math.max(4, Math.floor((w - 40) / 84)));
    const cell = Math.min(90, (w - 40) / cols);
    const kidSize = cell * 0.6;
    this.litter.forEach((k, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, this.litter.length - row * cols);
      const c = new Creature(k.features, { size: kidSize });
      c.position.set(w / 2 + (i % cols - (inRow - 1) / 2) * cell, top + cell * (row + 0.5));
      this.layer.addChild(c);
    });
  }

  // Genotypes consistent with each parent's phenotype, and the most likely pairs given the litter.
  analysis() {
    const genos = allGenotypes(this.trait);
    const [p1, p2] = this.det.parents;
    const fits = (p) => genos.filter((g) => this.trait.express(g).key === p.phenotype.key);
    const scored = [];
    for (const a of fits(p1)) for (const b of fits(p2)) scored.push({ a, b, ll: logLikelihood(this.counts, offspringPhenotypes(this.trait, a, b)) });
    const best = Math.max(...scored.map((s) => s.ll));
    return { scored, best, top: scored.filter((s) => s.ll >= best - 1e-9) };
  }

  check() {
    const [a, b] = this.choice;
    const [p1, p2] = this.det.parents;
    const t = this.trait;
    const gl = (g) => genotypeLabel(t, g);
    for (const [g, p] of [
      [a, p1],
      [b, p2],
    ]) {
      if (t.express(g).key !== p.phenotype.key) {
        this.message = { kind: 'bad', text: `Genotype ${gl(g)} gives the ${t.express(g).label} phenotype, but ${p.name} shows ${p.phenotype.label}.` };
        return this.renderPanel();
      }
    }
    const dist = offspringPhenotypes(t, a, b);
    const ll = logLikelihood(this.counts, dist);
    if (ll === -Infinity) {
      const impossible = Object.keys(this.counts).find((k) => !dist.some((d) => d.key === k && d.p > 0));
      const name = this.litter.find((k) => k.phenotype.key === impossible).phenotype.label;
      this.message = { kind: 'bad', text: `${gl(a)} × ${gl(b)} can never produce the ${name} phenotype, but ${this.counts[impossible]} of the litter show it.` };
      return this.renderPanel();
    }
    const { top } = this.analysis();
    const isTop = top.some((s) => genotypeKey(t, s.a) === genotypeKey(t, a) && genotypeKey(t, s.b) === genotypeKey(t, b));
    if (!isTop) {
      this.message = {
        kind: 'bad',
        text: `Possible, but it fits the litter poorly. ${gl(a)} × ${gl(b)} predicts ${ratioText(dist)}. Is there a pair of genotypes that explains these counts better?`,
      };
      return this.renderPanel();
    }
    this.solved = true;
    const others = top.filter((s) => !(genotypeKey(t, s.a) === genotypeKey(t, a) && genotypeKey(t, s.b) === genotypeKey(t, b)));
    const truth = `${gl(p1.alleles)} × ${gl(p2.alleles)}`;
    let text = `That explains the litter as well as any hypothesis can. The hidden parents were ${truth}.`;
    if (others.length) {
      text += ` These fit equally well: ${others.map((s) => `${gl(s.a)} × ${gl(s.b)}`).join(', ')}. A testcross to a homozygous recessive would tell them apart.`;
    }
    this.message = { kind: 'good', text };
    this.cards.forEach((c, i) => c.setGenotype(this.det.parents[i].label));
    this.mod.complete('detective');
    this.renderPanel();
  }

  newPuzzle() {
    const rng = this.inst.rng;
    const genos = allGenotypes(this.trait);
    const [c0, c1, c2, c3] = PALETTE.hap;
    const [a, b] = [pick(rng, genos), pick(rng, genos)];
    const names = shuffle(rng, ['Pip', 'Mossy', 'Bramble', 'Tuffet', 'Wobble', 'Juniper', 'Nib', 'Puddle', 'Clover', 'Fennel']);
    this.setup({
      parents: [makeParent(this.inst.base, a, [c0, c1], names[0]), makeParent(this.inst.base, b, [c2, c3], names[1])],
      litterSize: int(rng, 9, 14),
      seed: Math.floor(rng() * 0xffffffff),
    });
    this.mod.state.answered.delete('detective:conditional');
    this.resize(this.w, this.h);
    this.renderPanel();
  }

  conditionalQuestion() {
    const t = this.trait;
    const [p1, p2] = this.det.parents;
    if (t.dominance !== 'complete') {
      return {
        prompt: 'Could you read every offspring’s genotype straight from its phenotype?',
        options: [
          { label: 'Yes', correct: true, feedback: `Yes. With ${t.dominance === 'incomplete' ? 'incomplete dominance' : 'codominance'} every genotype has its own phenotype, so there are no hidden carriers.` },
          { label: 'No', feedback: 'Look at the phenotype classes: each genotype makes a different-looking creature.' },
        ],
      };
    }
    const [D, r] = t.alleles.map((x) => x.id);
    const domPheno = t.express([D, D]);
    const p = genotypeGivenPhenotype(t, p1.alleles, p2.alleles, domPheno.key, genotypeKey(t, [D, D]));
    const DD = genotypeLabel(t, [D, D]);
    const het = genotypeLabel(t, [D, r]);
    const options = ['0', '1/4', '1/3', '1/2', '2/3', '1'];
    const unconditional = fraction(offspringGenotypes(t, p1.alleles, p2.alleles).find((g) => g.key === genotypeKey(t, [D, D]))?.p ?? 0);
    return {
      prompt: `From ${p1.label} × ${p2.label}, pick one offspring with the ${domPheno.label} phenotype at random. What is the probability it is ${DD}?`,
      options: options.map((o) => ({
        label: o,
        correct: o === fraction(p),
        feedback:
          o === fraction(p)
            ? `Right. Keep only the ${domPheno.label} part of the Punnett square, then ask what share of it is ${DD}. This is conditional probability.`
            : o === unconditional
              ? `${o} is the chance of ${DD} among all offspring. You already know this one shows ${domPheno.label}, so restrict to those.`
              : `List the ${domPheno.label} offspring genotypes from the Punnett square (${DD} and ${het}) with their probabilities, then take the ${DD} share.`,
      })),
    };
  }

  renderPanel() {
    const body = clear(this.body);
    const t = this.trait;
    const [p1, p2] = this.det.parents;
    const genos = allGenotypes(t);
    body.append(
      h('h2', {}, 'Detective: who are the parents?'),
      h('p', {}, `${p1.name} and ${p2.name} had this litter of ${this.litter.length}. You can see their phenotypes, not their genotypes.`),
      h(
        'div',
        { class: 'callout' },
        h('b', {}, 'The litter'),
        Object.entries(this.counts)
          .map(([k, n]) => `${n} ${this.litter.find((x) => x.phenotype.key === k).phenotype.label}`)
          .join(' · '),
      ),
    );

    [p1, p2].forEach((p, i) => {
      body.append(
        h(
          'div',
          { class: 'picker' },
          h('div', { class: 'picker-label' }, `${p.name} (${p.phenotype.label}) is…`),
          h(
            'div',
            { class: 'choices inline' },
            genos.map((g) =>
              h(
                'button',
                {
                  class: `choice${this.choice[i] && genotypeKey(t, this.choice[i]) === genotypeKey(t, g) ? ' right' : ''}`,
                  disabled: this.solved,
                  onclick: () => {
                    this.choice[i] = g;
                    this.message = null;
                    this.renderPanel();
                  },
                },
                genotypeLabel(t, g),
              ),
            ),
          ),
        ),
      );
    });

    if (!this.solved) {
      body.append(h('div', { class: 'row' }, h('button', { class: 'btn primary', disabled: !this.choice[0] || !this.choice[1], onclick: () => this.check() }, 'Check')));
    }
    if (this.message) body.append(h('div', { class: `feedback ${this.message.kind}` }, this.message.text));

    if (this.solved) {
      if (!this.mod.state.answered.has('detective:conditional')) {
        body.append(
          question({
            ...this.conditionalQuestion(),
            onCorrect: () => {
              this.mod.state.answered.add('detective:conditional');
              setTimeout(() => this.renderPanel(), 1200);
            },
          }),
        );
      } else {
        body.append(
          h('div', { class: 'callout' }, h('b', {}, 'Module 1 complete'), 'Try a new litter, or start a fresh instance with a different creature and trait.'),
        );
      }
      body.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => this.newPuzzle() }, 'New litter'), h('button', { class: 'btn primary', onclick: () => this.mod.ctx.newSeed() }, 'New creatures')));
    }
  }
}
