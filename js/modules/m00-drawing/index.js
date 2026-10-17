// Module 0: Build the cell. Students construct nuclei (chromosomes, chromatids, alleles) through fertilization,
// mitosis and meiosis for one autosomal gene with two alleles in a diploid, and the engine grades every answer.
// No creatures and no phenotypes: just named alleles.
//
// The student chooses the parents' genotypes in question a. The egg and sperm they build make the zygote that
// questions b to h follow, unless they pick a different genotype to follow.

import { h, clear } from '../../core/dom.js';
import { makeRng, pick, int } from '../../core/rng.js';
import { PALETTE } from '../../core/palette.js';
import { haplotype, diploid, chromosome, makeCell, allelesAt } from '../../engine/genome.js';
import { meiosis } from '../../engine/meiosis.js';
import { gameteDistribution, fraction } from '../../engine/cross.js';
import { nucleusFromCell, metaphaseIINuclei, gameteNuclei, evaluate, minCrossovers, parseFrequency } from '../../engine/drawing.js';
import { genotypeOptions, zygoteFromParents, IMPOSSIBLE_NOTE } from '../../engine/genotypes.js';
import { label as textLabel } from '../../render/chromosome.js';
import { CellBuilder } from '../../builder/cell-builder.js';

const LETTERS = ['A', 'B', 'D', 'E', 'G', 'H', 'R', 'T'];

function buildInstance(seed) {
  const rng = makeRng(seed);
  const L = pick(rng, LETTERS);
  const up = L;
  const low = L.toLowerCase();
  const other = pick(rng, LETTERS.filter((x) => x !== L));
  const centromere = pick(rng, [30, 40, 60, 70]);
  const pos = centromere < 50 ? int(rng, 62, 86) : int(rng, 14, 38);
  const karyotype = [{ id: '1', name: 'Chromosome 1', length: 100, centromere, loci: [{ id: L, pos }] }];

  // The parents are chosen by the engine; the student works out which zygotes they could make. Prefer pairs that
  // can make more than one zygote genotype, so the choice means something.
  const genos = [
    [up, up],
    [up, low],
    [low, low],
  ];
  const pairs = genos.flatMap((m) => genos.map((f) => [m, f]));
  const varied = pairs.filter(([m, f]) => m[0] !== m[1] || f[0] !== f[1]);
  const [mother, father] = rng() < 0.85 ? pick(rng, varied) : pick(rng, pairs);
  const egg = pick(rng, mother);
  const sperm = pick(rng, father);
  const options = genotypeOptions([up, low], other, rng);
  return { seed, L, up, low, other, karyotype, mother, father, egg, sperm, options };
}

const g = (alleles) => alleles.join('/');

class DrawingModule {
  constructor(ctx) {
    this.ctx = ctx;
    this.inst = buildInstance(ctx.seed);
    const { L, up, low, karyotype } = this.inst;
    this.alleleOrder = [up, low];
    this.parents = { mother: this.inst.mother, father: this.inst.father };
    this.zygoteChoice = null; // alleles the student picked in question a
    this.zygoteNote = null; // an option they picked that was flagged, with its reason
    this.follow = { alleles: this.sorted([this.inst.egg, this.inst.sperm]), source: 'default' };
    this.answers = {};
    this.attempts = {};
    this.done = new Set();
    this.revealed = new Set();
    this.feedback = null;
    this.listRows = null;
    this.picking = false;
    this.steps = this.makeSteps();

    this.scene = new PIXI.Container();
    ctx.root.addChild(this.scene);
    this.builder = new CellBuilder({
      app: ctx.app,
      container: this.scene,
      karyotype,
      alleles: { [L]: [up, low] },
      onChange: (nuclei) => {
        this.answers[this.step.id] = nuclei;
      },
    });
    this.lockNote = new PIXI.Container();
    this.lockNote.visible = false;
    this.scene.addChild(this.lockNote);

    this.buildPanel();
    this.go(0);
  }

  get step() {
    return this.steps[this.index];
  }

  sorted(alleles) {
    return alleles.slice().sort((a, b) => this.alleleOrder.indexOf(a) - this.alleleOrder.indexOf(b));
  }

  // ---- the genotype being followed, and everything derived from it ----

  cellOf(alleles) {
    const { L, karyotype } = this.inst;
    return diploid(karyotype, [alleles.map((a, i) => haplotype({ [L]: a }, { color: PALETTE.hap[i] }))]);
  }

  gameteCell(allele, color) {
    const { L, karyotype } = this.inst;
    return makeCell(karyotype, [[chromosome(karyotype[0], haplotype({ [L]: allele }, { color }))]]);
  }

  // Zygote, target gamete for question e, and a meiosis for f and g. Stable for a given seed and genotype.
  derived() {
    const key = g(this.follow.alleles);
    if (this.cache?.key === key) return this.cache;
    const rng = makeRng(this.inst.seed ^ [...key].reduce((s, c) => s * 31 + c.charCodeAt(0), 7));
    const zygote = this.cellOf(this.follow.alleles);
    const target = pick(rng, this.follow.alleles);
    const result = meiosis(zygote, rng, { crossingOver: false });
    const homologs = this.follow.alleles.map((a) => ({ [this.inst.L]: a }));
    const minCross = minCrossovers({ [this.inst.L]: target }, homologs, [this.inst.L]);
    this.cache = { key, zygote, target, result, minCross };
    return this.cache;
  }

  setFollow(alleles, source, extra = {}) {
    const next = this.sorted(alleles);
    const changed = g(next) !== g(this.follow.alleles);
    this.follow = { alleles: next, source, ...extra };
    if (changed) {
      for (const id of ['b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        this.done.delete(id);
        this.revealed.delete(id);
        delete this.attempts[id];
      }
      this.listRows = null;
    }
  }

  makeSteps() {
    const d = () => this.derived();
    return [
      {
        id: 'a',
        title: 'Egg and sperm',
        prompt: () =>
          `This is a diploid organism, and gene ${this.inst.L} is autosomal (it is not on a sex chromosome). First choose a zygote genotype these parents could produce. Then build the egg and the sperm that would make it: in each, show the chromosomes, the correct number of chromatids, and the allele on every chromatid. The rest of the exercise follows the zygote you choose.`,
        start: [{ label: 'Egg' }, { label: 'Sperm' }],
        fixed: true,
      },
      {
        id: 'b',
        title: 'Zygote',
        prompt: () => 'Build the zygote nucleus immediately after fertilization: the chromosomes, the correct number of chromatids, and the allele on every chromatid.',
        start: [{ label: 'Zygote' }],
        fixed: true,
        expected: () => [nucleusFromCell(d().zygote, { label: 'Zygote' })],
      },
      {
        id: 'c',
        title: 'Mitotic metaphase',
        prompt: () => 'The zygote is in mitosis. Build its nucleus at metaphase.',
        start: [{ label: 'Zygote at metaphase' }],
        fixed: true,
        expected: () => [nucleusFromCell(d().zygote, { replicated: true })],
      },
      {
        id: 'd',
        title: 'Daughter cells',
        prompt: () => 'Mitosis has finished. Build the nuclei of the daughter cells. Add a nucleus for each daughter.',
        start: [{ label: '' }],
        maxNuclei: 4,
        expected: () => [nucleusFromCell(d().zygote), nucleusFromCell(d().zygote)],
      },
      {
        id: 'e',
        title: 'Metaphase I',
        prompt: () =>
          `One of this individual’s germline stem cells enters meiosis. It will eventually produce a gamete with genotype ${d().target}. Build the nucleus at metaphase I, and mark the minimum number of crossovers needed with an X.`,
        start: [{ label: 'Metaphase I' }],
        fixed: true,
        crossovers: true,
        minCross: () => d().minCross,
        expected: () => [nucleusFromCell(d().zygote, { replicated: true, paired: true })],
      },
      {
        id: 'f',
        title: 'Metaphase II',
        prompt: () => 'Meiosis I has finished. Build each nucleus at metaphase II.',
        start: [{ label: '' }],
        maxNuclei: 4,
        expected: () => metaphaseIINuclei(d().result),
      },
      {
        id: 'g',
        title: 'Gametes',
        prompt: () => 'Meiosis has finished. Build the nucleus of each gamete.',
        start: [{ label: '' }],
        maxNuclei: 6,
        expected: () => gameteNuclei(d().result),
      },
      {
        id: 'h',
        title: 'Gamete list',
        prompt: () => 'List every gamete genotype this individual can make and the expected frequency of each. Assume normal meiosis (no non-disjunction). No drawing needed.',
        list: true,
      },
    ];
  }

  // ---- panel ----

  buildPanel() {
    const { entry, panel } = this.ctx;
    const { L, up, low } = this.inst;
    this.stepper = h('ol', { class: 'stepper' });
    this.body = h('div', { class: 'step' });
    clear(panel).append(
      h(
        'div',
        {},
        h('div', { class: 'eyebrow' }, `Module ${entry.n} · Unit ${entry.unit.id}`),
        h('h1', {}, entry.title),
        h(
          'p',
          { class: 'meta' },
          'A diploid organism and one autosomal gene, ',
          h('b', {}, L),
          ', with two alleles, ',
          h('b', {}, up),
          ' and ',
          h('b', {}, low),
          '. Build each cell from chromosomes; the engine checks your answer.',
        ),
      ),
      this.stepper,
      this.body,
      h('div', { class: 'panel-foot' }, h('span', {}, `Seed ${this.ctx.seed}`), h('button', { class: 'btn small', onclick: () => this.ctx.newSeed() }, 'New problem')),
    );
  }

  renderStepper() {
    clear(this.stepper).append(
      ...this.steps.map((s, i) =>
        h(
          'li',
          {},
          h(
            'button',
            { class: [i === this.index ? 'current' : '', this.done.has(s.id) ? 'done' : ''].join(' ').trim(), onclick: () => this.go(i) },
            `${s.id}. ${s.title}`,
          ),
        ),
      ),
    );
  }

  go(i) {
    this.index = i;
    this.feedback = null;
    this.picking = false;
    const s = this.step;
    this.builder.fixedNuclei = !!s.fixed;
    this.builder.maxNuclei = s.maxNuclei ?? 4;
    this.builder.crossovers = !!s.crossovers;
    this.builder.root.visible = !s.list;
    if (!s.list) this.builder.setNuclei(this.answers[s.id] ?? s.start);
    this.applyLock();
    this.renderStepper();
    this.renderBody();
    this.layout();
    this.ctx.panel.scrollTop = 0;
    if (i === 0 && !this.demoSeen()) setTimeout(() => this.playDemo(), 500);
  }

  // The how-to animation plays once per browser; the panel has a button to replay it.
  demoSeen() {
    try {
      return localStorage.getItem('gorby.buildDemoSeen') === '1';
    } catch {
      return false;
    }
  }

  async playDemo() {
    if (this.step.list || this.destroyed) return;
    // The demo shows at full strength even while question a waits for a zygote choice.
    this.builder.root.alpha = 1;
    this.lockNote.visible = false;
    const finished = await this.builder.demo(this.ctx.tween);
    if (this.destroyed) return;
    this.applyLock();
    if (finished) {
      try {
        localStorage.setItem('gorby.buildDemoSeen', '1');
      } catch {
        // Private mode or blocked storage: the demo will simply play again next time.
      }
    }
  }

  resize() {
    this.layout();
  }

  layout() {
    const { w, h: hgt } = this.ctx.size();
    this.builder.setRect({ x: 12, y: 28, w: w - 24, h: hgt - 36 });
    // The panel sits to the right on wide screens and below on narrow ones.
    this.lockNote.removeChildren().forEach((c) => c.destroy());
    const wide = window.innerWidth > 860;
    const t = textLabel(wide ? 'First choose a zygote genotype in the panel →' : 'First choose a zygote genotype below ↓', 16, { fill: 0xffffff, fontWeight: '800' });
    t.anchor.set(0.5);
    this.lockNote.addChild(new PIXI.Graphics().roundRect(-t.width / 2 - 16, -t.height / 2 - 10, t.width + 32, t.height + 20, 12).fill({ color: PALETTE.ink, alpha: 0.88 }), t);
    this.lockNote.position.set(w / 2, hgt * 0.42);
  }

  // A dropdown of one-line genotypes, possible and impossible, with `currentText` selected. onPick gets the option.
  genotypeSelect(label, currentText, onPick) {
    const sel = h(
      'select',
      { class: 'choice', 'aria-label': label },
      h('option', { value: '' }, 'choose a genotype…'),
      this.inst.options.map((o, i) => h('option', { value: String(i), selected: o.text === currentText }, o.text)),
    );
    sel.addEventListener('change', () => {
      if (sel.value === '') return;
      onPick(this.inst.options[Number(sel.value)]);
    });
    return sel;
  }

  impossibleNote(option) {
    return h('div', { class: 'feedback bad' }, h('b', {}, IMPOSSIBLE_NOTE), ' ', option.reason);
  }

  // Question a: the parents are given; the student picks a zygote they could make, then builds its gametes.
  renderZygote(body) {
    const { mother, father } = this.parents;
    const note = this.zygoteNote;
    body.append(
      h('div', { class: 'callout' }, h('b', {}, `Mother: ${g(mother)}   ·   Father: ${g(father)}`), 'One line per parent: the slash separates the alleles on the two homologs.'),
      h(
        'div',
        { class: 'picker' },
        h('div', { class: 'picker-label' }, 'Zygote genotype these parents could produce'),
        this.genotypeSelect('zygote', note?.option.text ?? (this.zygoteChoice ? g(this.zygoteChoice) : null), (o) => this.pickZygote(o)),
        note ? h('div', { class: 'feedback bad' }, h('b', {}, note.title), ' ', note.reason) : null,
        this.zygoteChoice && !note ? h('div', { class: 'feedback good' }, `Possible. Now build an egg and a sperm that together make ${g(this.zygoteChoice)}.`) : null,
      ),
    );
  }

  pickZygote(option) {
    if (!option.possible) {
      this.zygoteChoice = null;
      this.zygoteNote = { option, title: IMPOSSIBLE_NOTE, reason: option.reason };
    } else {
      const fromParents = zygoteFromParents(option.alleles, this.parents.mother, this.parents.father);
      if (!fromParents.ok) {
        this.zygoteChoice = null;
        this.zygoteNote = { option, title: 'These parents cannot produce this zygote.', reason: fromParents.reason };
      } else {
        this.zygoteChoice = this.sorted(option.alleles);
        this.zygoteNote = null;
        this.setFollow(this.zygoteChoice, 'chosen-a');
      }
    }
    this.feedback = null;
    this.applyLock();
    this.renderStepper();
    this.renderBody();
  }

  // Question a's workspace stays dimmed and locked until a possible zygote is chosen.
  applyLock() {
    const locked = this.step.id === 'a' && !this.zygoteChoice;
    this.builder.disabled = locked;
    this.builder.root.alpha = locked ? 0.35 : 1;
    this.lockNote.visible = locked;
  }

  // Questions b to h show the genotype they follow, with a way to follow a different one.
  renderFollow(body) {
    const f = this.follow;
    const { mother, father } = this.parents;
    const from = {
      gametes: `from the egg (${f.egg}) and sperm (${f.sperm}) you built in question a`,
      'chosen-a': 'which you chose in question a',
      chosen: 'which you chose',
      default: `one possible offspring of the ${g(mother)} mother and ${g(father)} father; choose your own in question a`,
    }[f.source];
    const box = h('div', { class: 'callout' }, h('b', {}, `This individual: ${g(f.alleles)}`), `The zygote’s genotype, ${from}.`);
    if (!this.picking) {
      box.append(h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn small', onclick: () => ((this.picking = true), this.renderBody()) }, 'Select a different genotype from the prior one')));
    } else {
      box.append(
        h(
          'div',
          { class: 'picker', style: { marginTop: '8px' } },
          this.genotypeSelect('individual', this.followNote?.text ?? null, (o) => {
            if (o.possible) {
              this.setFollow(o.alleles, 'chosen');
              this.picking = false;
              this.followNote = null;
              this.renderStepper();
            } else {
              this.followNote = o;
            }
            this.feedback = null;
            this.renderBody();
          }),
          this.followNote ? this.impossibleNote(this.followNote) : null,
          h('button', { class: 'btn small', onclick: () => ((this.picking = false), (this.followNote = null), this.renderBody()) }, 'Cancel'),
        ),
      );
    }
    body.append(box);
  }

  renderBody() {
    const s = this.step;
    const body = clear(this.body);
    body.append(h('div', { class: 'stage-name' }, `Question ${s.id}`), h('h2', {}, s.title), h('p', {}, s.prompt()));
    if (s.id === 'a') this.renderZygote(body);
    else this.renderFollow(body);
    if (s.list) return this.renderList(body);
    this.tools = h('div', { class: 'tools' });
    body.append(this.tools);
    this.feedbackEl = h('div', { class: 'feedback' });
    body.append(
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => this.check() }, 'Check'),
        this.prevAnswer() ? h('button', { class: 'btn', onclick: () => this.copyPrevious() }, `Start from my answer to ${this.prevAnswer().id}`) : null,
        h('button', { class: 'btn small', onclick: () => this.startOver() }, 'Start over'),
      ),
      this.feedbackEl,
    );
    this.renderTools();
    this.renderFeedback();
  }

  prevAnswer() {
    for (let i = this.index - 1; i >= 0; i--) {
      const s = this.steps[i];
      if (!s.list && this.answers[s.id]) return s;
    }
    return null;
  }

  copyPrevious() {
    const prev = this.prevAnswer();
    const s = this.step;
    const nuclei = this.answers[prev.id].map((n) => ({ ...n, label: '' }));
    const fitted = s.fixed ? s.start.map((st, i) => ({ label: st.label, items: nuclei[i]?.items ?? [] })) : nuclei.slice(0, s.maxNuclei ?? 4);
    this.builder.setNuclei(fitted);
    this.answers[s.id] = this.builder.getNuclei();
  }

  // How to use the tray, as a short list next to the question.
  renderTools() {
    if (!this.tools || this.step.list) return;
    const s = this.step;
    const tips = [
      'Drag a chromosome from the tray into a nucleus: 1 chromatid, or 2 sister chromatids.',
      'Drag an allele onto each chromatid to label it (or tap a chromatid to cycle).',
      'Drag one chromosome onto its homolog to pair them; drag it away to unpair.',
      s.crossovers ? 'Drag the X onto a bivalent, at the height where the crossover happens. Tap an X to remove it.' : null,
      s.fixed ? null : 'Drag the nucleus piece up to add a cell; use × to remove one.',
      'Drag anything onto the bin to remove it.',
    ].filter(Boolean);
    clear(this.tools).append(
      h('ul', { class: 'tips' }, tips.map((t) => h('li', {}, t))),
      h('button', { class: 'btn small', onclick: () => this.playDemo() }, '▶ Watch how it works'),
    );
  }

  startOver() {
    this.builder.setNuclei(this.step.start);
    this.answers[this.step.id] = this.builder.getNuclei();
    this.feedback = null;
    this.renderFeedback();
  }

  // Question a: each gamete is graded against every gamete its parent could make, and together they must make the
  // zygote the student chose.
  checkGametes(student) {
    const { L } = this.inst;
    const { mother, father } = this.parents;
    if (!this.zygoteChoice) return { problem: { code: 'zygote' } };
    const result = {};
    for (const [label, parent, color] of [
      ['Egg', mother, PALETTE.hap[0]],
      ['Sperm', father, PALETTE.hap[1]],
    ]) {
      const nucleus = student.find((n) => n.label === label);
      const candidates = [...new Set(parent)];
      let first = null;
      let match = null;
      for (const allele of candidates) {
        const r = evaluate([nucleus], [nucleusFromCell(this.gameteCell(allele, color), { label })], { loci: [L], matchBy: 'label' });
        if (r.ok) match = allele;
        else first ??= r.problems[0];
      }
      if (!match) return { problem: first.code === 'content' ? { code: 'gamete-allele', label, parent: candidates } : first };
      result[label] = match;
    }
    if (g(this.sorted([result.Egg, result.Sperm])) !== g(this.zygoteChoice)) {
      return { problem: { code: 'gametes-zygote', egg: result.Egg, sperm: result.Sperm } };
    }
    return { egg: result.Egg, sperm: result.Sperm };
  }

  check() {
    const s = this.step;
    const student = this.builder.getNuclei();
    this.attempts[s.id] = (this.attempts[s.id] ?? 0) + 1;
    let ok;
    let problem;
    if (s.id === 'a') {
      const r = this.checkGametes(student);
      ok = !r.problem;
      problem = r.problem;
      if (ok) this.setFollow([r.egg, r.sperm], 'gametes', { egg: r.egg, sperm: r.sperm });
    } else {
      const minCross = typeof s.minCross === 'function' ? s.minCross() : null;
      const r = evaluate(student, s.expected(), { loci: [this.inst.L], matchBy: 'multiset', minCross });
      ok = r.ok;
      problem = r.problems[0];
    }
    if (ok && this.revealed.has(s.id)) {
      this.feedback = { kind: 'good', text: 'That matches the answer you were shown. Use “New problem” to try one on your own.' };
    } else if (ok) {
      this.done.add(s.id);
      this.feedback = { kind: 'good', text: this.praise(s) };
    } else {
      this.feedback = { kind: 'bad', text: this.explain(s, problem) };
    }
    this.renderStepper();
    this.renderFeedback();
  }

  // Turn a grader problem into a sentence for this question.
  explain(step, p) {
    const one = (n) => `${n} chromosome${n === 1 ? '' : 's'}`;
    switch (p.code) {
      case 'zygote':
        return 'First choose a zygote genotype these parents could produce.';
      case 'gametes-zygote':
        return `An egg carrying ${p.egg} and a sperm carrying ${p.sperm} would make the zygote ${g(this.sorted([p.egg, p.sperm]))}, but you chose ${g(this.zygoteChoice)}. Which allele must each gamete carry?`;
      case 'gamete-allele':
        return `The ${p.label.toLowerCase()} carries an allele its parent does not have. A ${p.label === 'Egg' ? 'mother' : 'father'} who is ${g(p.label === 'Egg' ? this.parents.mother : this.parents.father)} can only pass on ${p.parent.join(' or ')}.`;
      case 'nucleus-count':
        return {
          d: `Mitosis gives two daughter cells. You have ${p.got} nucle${p.got === 1 ? 'us' : 'i'}.`,
          f: `Meiosis I splits one cell into two, so there are two nuclei at metaphase II. You have ${p.got}.`,
          g: `Two meiotic divisions turn one cell into four gametes. You have ${p.got}.`,
        }[step.id] ?? `There should be ${p.expected} nuclei here.`;
      case 'chromosome-count':
        if (step.id === 'a' || step.id === 'g' || step.id === 'f')
          return `${p.label || 'Each nucleus'} is haploid: it should hold ${one(p.expected)} (one copy of this chromosome), not ${p.got}.`;
        return `${p.label || 'Each nucleus'} should hold ${one(p.expected)}, one from each parent. You have ${p.got}.`;
      case 'chromatid-count':
        return p.expected === 1
          ? 'At this stage each chromosome is a single chromatid: either it has not replicated yet, or its sisters have already separated.'
          : 'At this stage each chromosome is replicated: two sister chromatids joined at the centromere.';
      case 'needs-pairing':
        return 'At metaphase I the homologs pair up side by side as a bivalent. Drag one homolog onto the other to pair them.';
      case 'no-pairing':
        return step.id === 'c'
          ? 'Homologs do not pair in mitosis: each replicated chromosome lines up on its own.'
          : 'The homologs separated at anaphase I, so nothing is paired at metaphase II.';
      case 'unlabeled':
        return 'Every chromatid needs an allele. Drag an allele from the tray onto each chromatid.';
      case 'sisters-differ':
        return 'Sister chromatids are copies made in S phase, so they carry the same allele, unless a crossover swapped pieces.';
      case 'content':
        return {
          b: `The zygote gets one chromosome from the egg and one from the sperm. This individual is ${g(this.follow.alleles)}.`,
          c: 'Replication copies each chromosome exactly. Check the alleles on each chromosome.',
          d: 'Each daughter gets one sister chromatid of every chromosome, so both daughters match the zygote.',
          e: `The bivalent should hold the two homologs this individual inherited (${g(this.follow.alleles)}).`,
          f: 'At anaphase I the homologs separated. Which alleles end up together in each nucleus?',
          g: 'Each gamete gets one chromatid. How many gametes carry each allele?',
        }[step.id];
      case 'crossovers-extra': {
        const t = this.derived().target;
        return `No crossover is needed. With one locus, a gamete carrying ${t} simply gets a chromatid from a homolog carrying ${t}. Remove the X (tap it, or drag it to the bin).`;
      }
      case 'crossovers-missing':
        return `This gamete needs at least ${p.min} crossover${p.min === 1 ? '' : 's'}.`;
      default:
        return 'Not quite.';
    }
  }

  praise(s) {
    const [x, y] = this.follow.alleles;
    return {
      a: `Right. Each gamete is haploid: one chromosome, one chromatid. An egg carrying ${this.follow.egg} and a sperm carrying ${this.follow.sperm} make the ${g(this.follow.alleles)} zygote that questions b to h follow.`,
      b: 'Right. Fertilization restores two homologs, one from each parent, each still a single chromatid.',
      c: 'Right. Each homolog replicated into two identical sisters, and in mitosis they line up without pairing.',
      d: 'Right. Sisters separated, so each daughter is an exact copy of the zygote.',
      e: `Right. The homologs pair as a bivalent. No crossover is needed: the ${this.derived().target} gamete just takes a chromatid from its homolog.`,
      f: 'Right. The homologs went to different cells, each still carrying two sister chromatids.',
      g: x === y ? `Right. Four haploid gametes, all carrying ${x}.` : 'Right. Four haploid gametes, two carrying each allele.',
    }[s.id];
  }

  renderFeedback() {
    if (!this.feedbackEl) return;
    const s = this.step;
    const el = clear(this.feedbackEl);
    if (!this.feedback) return;
    el.className = `feedback ${this.feedback.kind}`;
    el.append(this.feedback.text);
    if (this.feedback.kind === 'bad' && (this.attempts[s.id] ?? 0) >= 2 && s.id !== 'a') {
      el.append(' ', h('button', { class: 'btn small', onclick: () => this.showAnswer() }, 'Show me'));
    }
    if (this.feedback.kind === 'good' && this.index < this.steps.length - 1) {
      el.append(h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn primary', onclick: () => this.go(this.index + 1) }, `Next: question ${this.steps[this.index + 1].id} ▶`)));
    }
  }

  showAnswer() {
    const s = this.step;
    const expected = s.expected();
    const labels = s.fixed ? s.start.map((x) => x.label) : expected.map(() => '');
    this.builder.setNuclei(expected.map((n, i) => ({ ...n, label: labels[i] ?? '' })));
    this.answers[s.id] = this.builder.getNuclei();
    this.revealed.add(s.id);
    this.feedback = { kind: 'bad', text: 'Here is one correct answer. Study it, then try the next question.' };
    this.renderFeedback();
    if (this.index < this.steps.length - 1) {
      this.feedbackEl.append(h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn', onclick: () => this.go(this.index + 1) }, `Next: question ${this.steps[this.index + 1].id} ▶`)));
    }
  }

  // Question h: a typed list of genotypes and frequencies.
  renderList(body) {
    const { up, low, L } = this.inst;
    const expected = gameteDistribution(allelesAt(this.derived().zygote, L));
    if (!this.listRows) this.listRows = [{ g: '', f: '' }];
    const rows = h('div', { class: 'picker' });
    const draw = () => {
      clear(rows);
      this.listRows.forEach((r, i) => {
        const sel = h('select', { class: 'choice', 'aria-label': `Genotype ${i + 1}` }, h('option', { value: '' }, 'genotype…'), [up, low].map((a) => h('option', { value: a, selected: r.g === a }, a)));
        sel.addEventListener('change', () => (r.g = sel.value));
        const freq = h('input', { class: 'choice', type: 'text', value: r.f, placeholder: 'frequency, e.g. 1/4', 'aria-label': `Frequency ${i + 1}` });
        freq.addEventListener('input', () => (r.f = freq.value));
        rows.append(
          h(
            'div',
            { class: 'row' },
            sel,
            freq,
            this.listRows.length > 1
              ? h(
                  'button',
                  {
                    class: 'btn small',
                    onclick: () => {
                      this.listRows.splice(i, 1);
                      draw();
                    },
                  },
                  '✕',
                )
              : null,
          ),
        );
      });
    };
    draw();
    const fb = h('div', { class: 'feedback' });
    const checkList = () => {
      const filled = this.listRows.filter((r) => r.g || r.f);
      const problems = [];
      const seen = new Set();
      for (const r of filled) {
        if (!r.g) problems.push('Pick a genotype for every row.');
        else if (seen.has(r.g)) problems.push(`${r.g} is listed twice.`);
        seen.add(r.g);
        if (parseFrequency(r.f) == null) problems.push(`Give a frequency for ${r.g || 'each row'} as a fraction, decimal or percent.`);
      }
      if (!problems.length) {
        for (const r of filled) {
          const want = expected.get(r.g) ?? 0;
          if (!want) problems.push(`This individual (${g(this.follow.alleles)}) cannot make ${r.g} gametes.`);
          else if (Math.abs(parseFrequency(r.f) - want) > 1e-6) problems.push(`The frequency of ${r.g} gametes is off. What fraction of gametes get each homolog?`);
        }
        for (const a of expected.keys()) if (!seen.has(a)) problems.push('A gamete genotype is missing from your list.');
      }
      fb.className = `feedback ${problems.length ? 'bad' : 'good'}`;
      fb.textContent = problems.length
        ? problems[0]
        : `Right: ${[up, low]
            .filter((a) => expected.has(a))
            .map((a) => `${a} ${fraction(expected.get(a))}`)
            .join(', ')}. Segregation sends each homolog to half the gametes.`;
      if (!problems.length) {
        this.done.add('h');
        this.renderStepper();
      }
    };
    body.append(
      rows,
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          {
            class: 'btn small',
            onclick: () => {
              this.listRows.push({ g: '', f: '' });
              draw();
            },
          },
          '+ Row',
        ),
        h('button', { class: 'btn primary', onclick: checkList }, 'Check'),
      ),
      fb,
    );
  }

  destroy() {
    this.destroyed = true;
    this.builder.destroy();
    this.scene.destroy({ children: true });
  }
}

export default {
  id: 'drawing',
  mount(ctx) {
    return new DrawingModule(ctx);
  },
};

export { buildInstance };
