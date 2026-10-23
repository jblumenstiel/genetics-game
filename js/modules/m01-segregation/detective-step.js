// Step E: the reverse problem. Given two parents' phenotypes and a litter, infer the parents' genotypes.
// Hypotheses are scored by likelihood, so "possible but unlikely" answers get their own feedback.

import { h, clear, question } from '../../core/dom.js';
import { PALETTE } from '../../core/palette.js';
import { makeRng } from '../../core/rng.js';
import { allGenotypes, offspringPhenotypes, offspringGenotypes, logLikelihood, genotypeGivenPhenotype, fractionGlyph } from '../../engine/cross.js';
import { genotypeLabel, genotypeKey, alleleLabel } from '../../engine/phenotype.js';
import { Creature } from '../../render/creature.js';
import { genotypeOptions, IMPOSSIBLE_NOTE } from '../../engine/genotypes.js';
import { creatureCard, breed, makeParent, LETTERS, NAMES } from './instance.js';
import { ratioText } from './breed-step.js';
import { pick, shuffle, int } from '../../core/rng.js';

// ratioText starts "All pigmented" when there is one class; inside a sentence it reads "all pigmented".
const midSentence = (ratio) => ratio.replace(/^All /, 'all ');

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
    // Each parent's genotype is chosen from possible and impossible one-line genotypes, shuffled once per puzzle.
    // Drawn after the litter, so the litter for a seed is unchanged.
    const [D, r] = this.trait.alleles.map((x) => x.id);
    this.options = genotypeOptions([D, r], pick(this.rng, LETTERS.filter((x) => x !== D)), this.rng);
    this.choice = [null, null];
    this.solved = false;
    this.message = null;
    // Wrong checks so far; "Show me" appears after two. A shown answer does not count as completed.
    this.attempts = 0;
    this.revealed = false;
  }

  title() {
    return 'Detective: who are the parents?';
  }

  enter(container, body) {
    this.container = container;
    this.body = body;
    this.layer = new PIXI.Container();
    container.addChild(this.layer);
    // The parents' genotype choices sit on the main page as HTML, under the litter.
    this.sheet = h('div', { class: 'stage-sheet at-bottom', hidden: true });
    this.mod.ctx.stage.append(this.sheet);
    const { w, h: hgt } = this.mod.size();
    this.w = w;
    this.h = hgt;
    this.render(true);
  }

  exit() {
    this.destroyScene();
    this.sheet.remove();
  }

  destroyScene() {
    this.layer.removeChildren().forEach((c) => c.destroy({ children: true }));
  }

  // Canvas height the sheet covers, with its margins.
  sheetSpace() {
    return this.sheet.hidden ? 0 : this.sheet.offsetHeight + 24;
  }

  // The sheet's height decides how much canvas is left above it, so the scene follows any change in it.
  render(relayout = false) {
    this.renderSheet();
    this.renderPanel();
    if (relayout) this.resize(this.w, this.h);
    else this.fit();
  }

  fit() {
    if (this.sheetSpace() !== this.laidOutFor) this.resize(this.w, this.h);
  }

  resize(w, hgt) {
    this.w = w;
    this.h = hgt;
    this.destroyScene();
    this.laidOutFor = this.sheetSpace();
    const room = hgt - this.laidOutFor;
    const size = Math.max(44, Math.min(96, room * 0.17));
    let top = 0;
    this.cards = this.det.parents.map((p, i) => {
      const card = creatureCard(p, { size, genotype: this.solved ? p.label : '?' });
      const b = card.container.getLocalBounds();
      card.container.position.set(w * (0.32 + i * 0.36), 6 - b.y);
      top = Math.max(top, card.container.y + b.y + b.height + 10);
      this.layer.addChild(card.container);
      return card;
    });
    // The litter fills what is left, in whichever number of columns makes each bdellbee largest (the widest on a tie).
    const n = this.litter.length;
    let cols = 1;
    let cell = 0;
    for (let c = 1; c <= n; c++) {
      const s = Math.min(90, (w - 40) / c, (room - top) / Math.ceil(n / c));
      if (s >= cell) [cols, cell] = [c, s];
    }
    cell = Math.max(20, cell);
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
    const [a, b] = this.choice.map((c) => c.alleles);
    const [p1, p2] = this.det.parents;
    const t = this.trait;
    const gl = (g) => genotypeLabel(t, g);
    for (const [g, p] of [
      [a, p1],
      [b, p2],
    ]) {
      if (t.express(g).key !== p.phenotype.key) {
        this.message = { kind: 'bad', text: `Genotype ${gl(g)} gives the ${t.express(g).label} phenotype, but ${p.name} shows ${p.phenotype.label}.` };
        return this.miss();
      }
    }
    const dist = offspringPhenotypes(t, a, b);
    const ll = logLikelihood(this.counts, dist);
    if (ll === -Infinity) {
      const impossible = Object.keys(this.counts).find((k) => !dist.some((d) => d.key === k && d.p > 0));
      const name = this.litter.find((k) => k.phenotype.key === impossible).phenotype.label;
      this.message = { kind: 'bad', text: `${gl(a)} × ${gl(b)} can never produce the ${name} phenotype, but ${this.counts[impossible]} of the litter show it.` };
      return this.miss();
    }
    const { top } = this.analysis();
    const isTop = top.some((s) => genotypeKey(t, s.a) === genotypeKey(t, a) && genotypeKey(t, s.b) === genotypeKey(t, b));
    if (!isTop) {
      this.message = {
        kind: 'bad',
        text: `Possible, but it fits the litter poorly. ${gl(a)} × ${gl(b)} predicts ${midSentence(ratioText(dist))}. Is there a pair of genotypes that explains these counts better?`,
      };
      return this.miss();
    }
    this.solved = true;
    const others = top.filter((s) => !(genotypeKey(t, s.a) === genotypeKey(t, a) && genotypeKey(t, s.b) === genotypeKey(t, b)));
    const truth = `${gl(p1.alleles)} × ${gl(p2.alleles)}`;
    const possible = this.analysis().scored.filter((s) => s.ll > -Infinity);
    let text;
    if (possible.length === 1) {
      text = `Yes: ${gl(a)} × ${gl(b)} is the only possible pair of parent genotypes. ${this.whyOnly(a, b)}`;
    } else {
      text = `That explains the litter as well as any hypothesis can. The hidden parents were ${truth}.`;
      if (others.length) {
        text += ` These fit equally well: ${others.map((s) => `${gl(s.a)} × ${gl(s.b)}`).join(', ')}. A testcross to a homozygous recessive would tell them apart.`;
      }
    }
    if (this.revealed) text += ' This matches the answer you were shown, so it does not count as completed. Pick different parents to try one on your own.';
    else this.mod.complete('detective');
    this.message = { kind: 'good', text };
    this.render();
  }

  // Why the only possible pair is forced, parent by parent: a recessive phenotype fixes a homozygote, and a
  // dominant-phenotype parent of recessive-phenotype offspring must carry the recessive allele.
  whyOnly(a, b) {
    const t = this.trait;
    const [D, r] = t.alleles.map((x) => x.id);
    const rr = genotypeLabel(t, [r, r]);
    const recessive = t.express([r, r]);
    const recessiveKids = this.counts[recessive.key] ?? 0;
    const [p1, p2] = this.det.parents;
    const carrier = (p, g) => p.phenotype.key !== recessive.key && recessiveKids && g.includes(r);
    const kids = `${recessiveKids} offspring ${recessiveKids === 1 ? 'is' : 'are'} ${recessive.label} (${rr}) and got ${alleleLabel(t, r)} from each parent`;
    if (carrier(p1, a) && carrier(p2, b)) {
      return `Both parents are ${p1.phenotype.label}, but ${kids}, so both must be ${genotypeLabel(t, [D, r])}.`;
    }
    const reasons = this.det.parents.map((p, i) => {
      const g = [a, b][i];
      if (p.phenotype.key === recessive.key) return `${p.name} is ${recessive.label}, so ${p.name} must be ${rr}.`;
      if (carrier(p, g)) return `${p.name} is ${p.phenotype.label}, but ${kids}, so ${p.name} must be ${genotypeLabel(t, [D, r])}.`;
      return null;
    });
    return reasons.every(Boolean) ? reasons.join(' ') : 'No other pair of genotypes that fits the parents’ phenotypes could produce this litter.';
  }

  miss() {
    this.attempts++;
    this.render();
  }

  // Fills in the pair that best explains the litter: the hidden parents when they fit best, else the best fit.
  showAnswer() {
    const t = this.trait;
    const gl = (g) => genotypeLabel(t, g);
    const [p1, p2] = this.det.parents;
    const { top } = this.analysis();
    const same = (x, y) => genotypeKey(t, x) === genotypeKey(t, y);
    const best = top.find((s) => same(s.a, p1.alleles) && same(s.b, p2.alleles)) ?? top[0];
    this.choice = [best.a, best.b].map((g) => this.options.find((o) => o.possible && same(o.alleles, g)));
    this.revealed = true;
    this.message = {
      kind: 'bad',
      shown: true,
      text: `Here is one correct answer: ${gl(best.a)} × ${gl(best.b)}. It predicts ${midSentence(ratioText(offspringPhenotypes(t, best.a, best.b)))}, and this litter has ${this.litterText()}. Study it, then press Check.`,
    };
    this.render();
  }

  litterText() {
    return Object.entries(this.counts)
      .map(([k, n]) => `${n} ${this.litter.find((x) => x.phenotype.key === k).phenotype.label}`)
      .join(' · ');
  }

  newPuzzle() {
    const rng = this.inst.rng;
    const genos = allGenotypes(this.trait);
    const [c0, c1, c2, c3] = PALETTE.hap;
    const [a, b] = [pick(rng, genos), pick(rng, genos)];
    const names = shuffle(rng, NAMES);
    this.setup({
      parents: [makeParent(this.inst.base, a, [c0, c1], names[0]), makeParent(this.inst.base, b, [c2, c3], names[1])],
      litterSize: int(rng, 9, 14),
      seed: Math.floor(rng() * 0xffffffff),
    });
    this.mod.state.answered.delete('detective:conditional');
    this.render(true);
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
    const gl = (g) => genotypeLabel(t, g);
    const f = fractionGlyph;
    const DD = gl([D, D]);
    const domPheno = t.express([D, D]);
    const cross = `${p1.label} × ${p2.label}`;
    const kids = offspringGenotypes(t, p1.alleles, p2.alleles);
    const dom = kids.filter((g) => t.express(g.alleles).key === domPheno.key);
    const options = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 1].map(f);
    // Neither parent carries the dominant allele, so there is no dominant-phenotype offspring to condition on.
    if (!dom.length) {
      const rr = gl([r, r]);
      const why = `Both parents are ${rr} and can only pass on ${alleleLabel(t, r)}, so every offspring is ${rr} and ${t.express([r, r]).label}.`;
      return {
        prompt: `From ${cross}, what is the probability that an offspring is ${domPheno.label}?`,
        options: options.map((o) => ({
          label: o,
          correct: o === '0',
          feedback: o === '0' ? `Right: 0. ${why}` : `Being ${domPheno.label} takes at least one ${alleleLabel(t, D)}. ${why}`,
        })),
      };
    }

    const total = dom.reduce((sum, g) => sum + g.p, 0);
    const pDD = dom.find((g) => g.key === genotypeKey(t, [D, D]))?.p ?? 0;
    const answer = f(pDD / total);
    const listed = dom.map((g) => `${gl(g.alleles)} (${f(g.p)})`).join(' and ');
    const lacking = [p1, p2].filter((p) => !p.alleles.includes(D));
    const explain =
      pDD === 0
        ? `${lacking.map((p) => `${p.name} is ${p.label}`).join(' and ')} and can only pass on ${alleleLabel(t, r)}, so no offspring is ${DD}. Every ${domPheno.label} offspring is ${dom.map((g) => gl(g.alleles)).join(' or ')}.`
        : pDD === total
          ? `Every ${domPheno.label} offspring of ${cross} is ${DD}.`
          : total === 1
            ? `Every offspring of ${cross} is ${domPheno.label}: ${listed}. So ${DD} is ${answer} of them.`
            : `${domPheno.label[0].toUpperCase()}${domPheno.label.slice(1)} offspring are ${listed}, ${f(total)} in all. ${DD} is ${f(pDD)} ÷ ${f(total)} = ${answer} of them. Keeping only the ${domPheno.label} part of the Punnett square is conditional probability.`;
    const hint = `The ${domPheno.label} offspring of ${cross} are ${listed}. What share of them is ${DD}?`;
    const wrong = (o) => {
      if (o === '0') return `${DD} offspring are possible here: each parent can pass on ${alleleLabel(t, D)}. ${hint}`;
      if (o === '1') return `Not every ${domPheno.label} offspring is ${DD}. ${hint}`;
      if (o === f(pDD)) return `${o} is the probability of ${DD} among all offspring, ${gl([r, r])} ones included. You already know this one is ${domPheno.label}. ${hint}`;
      if (o === f(total)) return `${o} is the probability of being ${domPheno.label} at all. ${hint}`;
      const other = dom.find((g) => g.key !== genotypeKey(t, [D, D]) && f(g.p / total) === o);
      if (other) return `${o} is the share of ${gl(other.alleles)} among ${domPheno.label} offspring, not ${DD}. ${hint}`;
      const anyKid = kids.find((g) => g.key !== genotypeKey(t, [D, D]) && f(g.p) === o);
      if (anyKid) return `${o} is the probability of ${gl(anyKid.alleles)} among all offspring, not ${DD}. ${hint}`;
      return hint;
    };
    return {
      prompt: `From ${cross}, pick one offspring with the ${domPheno.label} phenotype at random. What is the probability it is ${DD}?`,
      options: options.map((o) => ({ label: o, correct: o === answer, feedback: o === answer ? `Right: ${o}. ${explain}` : wrong(o) })),
    };
  }

  // One row per parent: its name and phenotype, then a dropdown of possible and impossible genotypes. An impossible
  // pick is explained under its row. Hidden once the puzzle is solved.
  renderSheet() {
    const sheet = clear(this.sheet);
    sheet.hidden = this.solved;
    if (this.solved) return;
    const bad = this.message?.kind === 'bad';
    const ready = this.choice.every((c) => c?.possible);
    sheet.append(
      h(
        'div',
        { class: 'dt-rows' },
        this.det.parents.flatMap((p, i) => {
          const sel = h(
            'select',
            { class: 'gl-field', 'aria-label': `${p.name}’s genotype` },
            h('option', { value: '' }, 'choose…'),
            this.options.map((o, k) => h('option', { value: String(k), selected: this.choice[i] === o }, o.text)),
          );
          sel.addEventListener('change', () => {
            this.choice[i] = sel.value === '' ? null : this.options[Number(sel.value)];
            this.message = null;
            this.render();
          });
          const chosen = this.choice[i];
          return [
            h('div', { class: 'dt-row' }, h('span', { class: 'dt-name' }, h('b', {}, p.name), h('small', {}, p.phenotype.label)), sel),
            chosen && !chosen.possible ? this.impossibleNote(chosen) : '',
          ];
        }),
      ),
      h(
        'div',
        { class: 'gl-actions' },
        h('span', { class: 'hint' }, this.choice.some((c) => c && !c.possible) ? 'Choose a possible genotype for each parent.' : 'Choose a genotype for each parent.'),
        h('button', { class: 'btn primary', type: 'button', disabled: !ready, onclick: () => this.check() }, 'Check'),
      ),
      h(
        'div',
        { class: `feedback${bad ? ' bad' : ''}`, role: 'status' },
        bad ? this.message.text : '',
        bad && !this.message.shown && this.attempts >= 2 ? [' ', h('button', { class: 'btn small', type: 'button', onclick: () => this.showAnswer() }, 'Show me')] : '',
      ),
    );
  }

  // On a phone the reason folds away behind "Why?", so the litter stays in view above the sheet.
  impossibleNote(option) {
    if (window.innerWidth > 480) return h('div', { class: 'feedback bad' }, h('b', {}, IMPOSSIBLE_NOTE), ' ', option.reason);
    const note = h('details', { class: 'feedback bad dt-why' }, h('summary', {}, h('b', {}, IMPOSSIBLE_NOTE), ' ', h('span', {}, 'Why?')), option.reason);
    note.addEventListener('toggle', () => this.fit());
    return note;
  }

  renderPanel() {
    const body = clear(this.body);
    const [p1, p2] = this.det.parents;
    body.append(
      h('h2', {}, 'Detective: who are the parents?'),
      h('p', {}, `${p1.name} and ${p2.name} had this litter of ${this.litter.length}. You can see their phenotypes, not their genotypes.`),
      h(
        'div',
        { class: 'callout' },
        h('b', {}, 'The litter'),
        this.litterText(),
      ),
    );

    if (!this.solved) {
      body.append(
        h(
          'div',
          { class: 'callout' },
          h('b', {}, `Choose the parents’ genotypes on the main page ${window.innerWidth > 860 ? '←' : '↑'}`),
          'Use each parent’s phenotype and the litter, then press Check.',
        ),
      );
    } else {
      body.append(h('div', { class: 'feedback good' }, this.message.text));
      // The conditional question stays on screen, its answer selected, once it is right.
      const answered = this.mod.state.answered.has('detective:conditional');
      body.append(
        question({
          ...this.conditionalQuestion(),
          answered,
          onCorrect: () => {
            this.mod.state.answered.add('detective:conditional');
            this.renderPanel();
          },
        }),
      );
      if (answered && this.revealed) {
        body.append(h('div', { class: 'callout' }, h('b', {}, 'Now solve one on your own'), 'Pick different parents for a new litter, or return to the main page.'));
      } else if (answered) {
        body.append(h('div', { class: 'callout' }, h('b', {}, 'Module 1 complete'), 'Pick different parents for a new litter, or return to the main page.'));
      }
      body.append(
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn', onclick: () => this.newPuzzle() }, 'Pick different parents'),
          h('button', { class: 'btn primary', onclick: () => (location.hash = '#/') }, 'Main page'),
        ),
      );
    }
  }
}
