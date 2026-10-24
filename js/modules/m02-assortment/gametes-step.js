// Step B: pick the parent's gametes from a list that mixes in look-alikes that are not haploid, apply the product
// rule, then sample real meioses from the engine to check it.

import { h, clear } from '../../core/dom.js';
import { QuestionSheet } from '../../core/question-sheet.js';
import { pick, shuffle } from '../../core/rng.js';
import { alleleLabel } from '../../engine/phenotype.js';
import { dihybridGametes, gameteChoices, gameteLabel, metaphaseIAlignments } from '../../engine/dihybrid.js';
import { fractionGlyph, integerRatio } from '../../engine/cross.js';
import { gametes, gameteAlleles, genesOf, questionRng } from './instance.js';
import { tallyBars } from './tally.js';

const NOT_HAPLOID = 'Gametes are haploid. Under normal meiosis, this is not a proper genotype for a gamete.';

// Wrong checks before "Show me" appears.
const SHOW_AFTER = 2;

export class GametesStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.parent = this.inst.mother;
    this.genes = genesOf(this.inst, this.parent);
    this.expected = dihybridGametes(this.genes);
    this.choices = shuffle(questionRng(this.inst, 21), gameteChoices(this.genes));
    // Kept on the module so picks and samples survive leaving and coming back.
    this.s = mod.state.gametes ??= { picked: [], wrong: 0, shown: false, feedback: null, counts: {}, total: 0 };
  }

  enter(container, body) {
    this.body = body;
    // The gamete picker and the product-rule question sit on the main page, under the parents.
    this.sheet = new QuestionSheet(this.mod, () => {});
    this.renderPanel();
  }

  exit() {
    this.exited = true;
    this.sheet.moveOn(this.mod.state.seen);
    this.sheet.remove();
  }

  get answered() {
    return this.mod.state.answered;
  }

  label(alleles) {
    return gameteLabel(this.genes, alleles);
  }

  // The two alleles the product-rule question asks about: the recessive one of the first gene, the dominant one of
  // the second.
  targets() {
    const [g1, g2] = this.parent.genes;
    return [g1[1], g2[0]];
  }

  // Probability that one gene's allele appears in a gamete, from the expected list.
  probAt(index, allele) {
    return this.expected.filter((g) => g.alleles[index] === allele).reduce((s, g) => s + g.p, 0);
  }

  // ---- the gamete picker ----

  toggle(text) {
    const p = this.s.picked;
    this.s.picked = p.includes(text) ? p.filter((x) => x !== text) : [...p, text];
    this.s.feedback = null;
    this.renderPanel();
  }

  // The first problem with the picks, named with the genotypes, or null when they are right.
  problem() {
    const kind = (t) => this.choices.find((c) => c.text === t).kind;
    const picked = this.s.picked;
    const real = this.choices.filter((c) => c.kind === 'gamete').map((c) => c.text);
    const { name, label } = this.parent;
    const bad = picked.find((t) => kind(t) === 'notHaploid');
    if (bad) return `${bad}: ${NOT_HAPLOID}`;
    const short = picked.find((t) => kind(t) === 'missing');
    if (short) return `${short} has no allele of the ${this.inst.traits[1].name.toLowerCase()} gene. A gamete gets one copy of every chromosome, so it carries one allele of each gene.`;
    const missing = real.filter((t) => !picked.includes(t));
    if (!missing.length) return null;
    if (!picked.length) return `Pick every kind of gamete ${name} can make.`;
    // Only the two kinds from one alignment: the student has the genes travelling together.
    const one = metaphaseIAlignments(this.genes).find((a) => a.poles.every((x) => picked.includes(this.label(x))));
    const also = one && picked.length === 2 ? ` ${picked.join(' and ')} come from one Metaphase I alignment; the other alignment is just as likely.` : '';
    return `${name} is ${label}. You picked ${picked.join(', ')}, but you are missing ${missing.join(' and ')}.${also}`;
  }

  check() {
    const problem = this.problem();
    if (!problem) {
      this.answered.add('gametes:pick');
      this.s.feedback = { kind: 'good', text: `Right. ${this.parent.label} makes ${this.s.picked.length} kinds of gametes, each with one allele of each gene.` };
    } else {
      this.s.wrong++;
      this.s.feedback = { kind: 'bad', text: problem };
    }
    this.renderPanel();
  }

  // An answer the student was shown does not count as completed.
  show() {
    this.s.shown = true;
    this.s.picked = this.choices.filter((c) => c.kind === 'gamete').map((c) => c.text);
    this.s.feedback = { kind: 'bad', text: `Here are ${this.parent.name}’s gametes: ${this.s.picked.join(', ')}. Each has one allele of each gene.` };
    this.answered.add('gametes:pick');
    this.renderPanel();
  }

  // The picker, on the main page. Once right it stays, answer selected, until the student presses Next question.
  renderPicker() {
    const { name, label } = this.parent;
    const fb = this.s.feedback;
    const done = this.answered.has('gametes:pick');
    const next = () => {
      this.mod.state.seen.add('gametes:pick');
      this.renderPanel();
    };
    this.sheet.showForm(
      h(
        'div',
        { class: 'question' },
        h('p', { class: 'prompt' }, `${name} is ${label}, a diploid with the two genes on different chromosomes. Under normal meiosis, which gamete genotypes can ${name} make? Pick all that apply.`),
        h(
          'div',
          { class: 'choices' },
          this.choices.map((c) =>
            h('button', { class: 'choice', type: 'button', 'aria-pressed': String(this.s.picked.includes(c.text)), disabled: done, onclick: () => this.toggle(c.text) }, c.text),
          ),
        ),
        fb ? h('div', { class: `feedback ${fb.kind}`, role: 'status' }, fb.text) : '',
      ),
      h(
        'div',
        { class: 'row sheet-next' },
        done
          ? h('button', { class: 'btn primary', type: 'button', onclick: next }, 'Next question ▶')
          : [
              this.s.wrong >= SHOW_AFTER ? h('button', { class: 'btn small', type: 'button', onclick: () => this.show() }, 'Show me') : '',
              h('button', { class: 'btn primary', type: 'button', disabled: !this.s.picked.length, onclick: () => this.check() }, 'Check'),
            ],
      ),
    );
  }

  // ---- sampling ----

  sample() {
    // Sampling is the student's next move, so the answered question leaves the main page.
    this.sheet.moveOn(this.mod.state.seen);
    const rng = this.inst.rng;
    for (let i = 0; i < 100; i++) {
      const key = this.label(gameteAlleles(this.inst, pick(rng, gametes(this.parent, rng))));
      this.s.counts[key] = (this.s.counts[key] ?? 0) + 1;
      this.s.total++;
    }
    if (this.s.total >= 100 && !this.s.shown) this.mod.complete('gametes');
    this.renderPanel();
  }

  reset() {
    this.s.counts = {};
    this.s.total = 0;
    this.renderPanel();
  }

  renderPanel() {
    if (this.exited) return;
    this.sheet.begin();
    this.renderBody(clear(this.body));
    this.sheet.end();
  }

  renderBody(body) {
    const [t1, t2] = this.inst.traits;
    const [a1, a2] = this.targets();
    body.append(
      h('h2', {}, 'Gametes from two genes'),
      h(
        'p',
        {},
        `Each gamete gets one allele of the ${t1.name.toLowerCase()} gene and one allele of the ${t2.name.toLowerCase()} gene. Because the genes are on different chromosomes, the allele a gamete gets for one gene does not affect the other.`,
      ),
    );

    const picked = this.answered.has('gametes:pick');
    if (picked) body.append(h('p', { class: 'hint' }, `✓ ${this.parent.name} makes ${this.expected.map((g) => this.label(g.alleles)).join(', ')}.`));
    if (!picked || !this.mod.state.seen.has('gametes:pick')) {
      this.renderPicker();
      if (!picked) body.append(h('div', { class: 'callout' }, h('b', {}, `Answer on the main page ${window.innerWidth > 860 ? '←' : '↑'}`), 'Pick every kind of gamete, then press Check.'));
      return;
    }

    const p1 = this.probAt(0, a1);
    const p2 = this.probAt(1, a2);
    const joint = p1 * p2;
    const name1 = alleleLabel(t1, a1);
    const name2 = alleleLabel(t2, a2);
    const jointQ = {
      prompt: `What fraction of ${this.parent.name}’s gametes carry both ${name1} and ${name2} (the ${this.label([a1, a2])} gamete)?`,
      options: [1 / 8, 1 / 4, 1 / 2, 1].map((v) => ({
        label: fractionGlyph(v),
        correct: Math.abs(v - joint) < 1e-9,
        feedback:
          Math.abs(v - joint) < 1e-9
            ? `Right. ${fractionGlyph(p1)} of gametes carry ${name1} and ${fractionGlyph(p2)} carry ${name2}, and the genes assort independently. Product rule: ${fractionGlyph(p1)} × ${fractionGlyph(p2)} = ${fractionGlyph(joint)}.`
            : v === 1
              ? `Not every gamete carries both. Each gamete gets just one allele of each gene, so some carry ${alleleLabel(t1, this.parent.genes[0][0])} instead of ${name1}.`
              : v > joint
                ? `${fractionGlyph(v)} is the chance for one gene alone. The gamete also has to carry the right allele of the other gene, another ${fractionGlyph(p2)}, so multiply.`
                : `That multiplies one chance too many. There are two genes, so two independent chances: ${fractionGlyph(p1)} × ${fractionGlyph(p2)}.`,
      })),
    };
    const onward = [{ label: 'Sample 100 meioses ▶', onClick: () => this.sample() }];
    if (!this.sheet.ask(body, { key: 'gametes:joint', q: jointQ, state: this.mod.state, rerender: () => this.renderPanel(), proceed: onward })) return;

    body.append(
      h('p', {}, `Now let the engine run real meioses in ${this.parent.name}. Each click collects one gamete from each of 100 meioses, and the tally should settle near the four expected fractions.`),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => this.sample() }, 'Sample 100 meioses'),
        h('button', { class: 'btn small', disabled: !this.s.total, onclick: () => this.reset() }, 'Clear'),
      ),
    );
    if (this.s.total) {
      const rows = this.expected.map((g) => {
        const key = this.label(g.alleles);
        return { label: key, n: this.s.counts[key] ?? 0, p: g.p };
      });
      body.append(
        tallyBars(rows, this.s.total),
        h('p', { class: 'hint' }, `${this.s.total} gametes. The dark tick marks the expected ${fractionGlyph(this.expected[0].p)}. Expected ratio: ${integerRatio(this.expected.map((g) => g.p)).join(' : ')}.`),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => this.mod.next() }, 'Continue: C. Punnett square ▶')),
      );
    }
  }
}
