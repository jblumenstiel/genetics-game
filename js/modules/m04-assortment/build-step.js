// Step E: Build the cell, for two genes on two chromosomes. It asks the same eight questions as Module 0 (a to h),
// but every cell has one chromosome per gene, so the picture shows two bivalents at metaphase I and four gametes
// that each carry one allele of each gene. The genes are on different chromosomes, so no crossover is needed for
// any gamete.

import { h, clear } from '../../core/dom.js';
import { QuestionSheet } from '../../core/question-sheet.js';
import { makeRng, pick, shuffle } from '../../core/rng.js';
import { PALETTE } from '../../core/palette.js';
import { haplotype, diploid, chromosome, makeCell } from '../../engine/genome.js';
import { meiosis } from '../../engine/meiosis.js';
import { nucleusFromCell, metaphaseIINuclei, gameteNuclei, evaluate, nucleusGenotype, parseFrequency } from '../../engine/drawing.js';
import { IMPOSSIBLE_NOTE } from '../../engine/genotypes.js';
import { dihybridGametes, gameteChoices, gameteLabel } from '../../engine/dihybrid.js';
import { fraction } from '../../engine/cross.js';
import { CellBuilder } from '../../builder/cell-builder.js';
import { genotypeOf, genesOf } from './instance.js';

const NOT_HAPLOID = 'Gametes are haploid. Under normal meiosis, this is not a proper genotype for a gamete.';
// Wrong checks before "Show me" appears.
const SHOW_AFTER = 2;
const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
// The stage names at the top of the main page (no letter), and the short names in the panel's list.
const STAGES = {
  a: 'Fertilization: egg and sperm',
  b: 'Fertilization: zygote',
  c: 'Mitosis: Metaphase',
  d: 'Mitosis: Daughter cells',
  e: 'Meiosis: Metaphase I',
  f: 'Meiosis: Metaphase II',
  g: 'Meiosis: Gametes',
  h: 'Gamete genotypes',
};
const TITLES = { a: 'Egg and sperm', b: 'Zygote', c: 'Mitosis: Metaphase', d: 'Mitosis: Daughter cells', e: 'Meiosis: Metaphase I', f: 'Meiosis: Metaphase II', g: 'Meiosis: Gametes', h: 'Gamete list' };

// The genotype of a diploid with these genes: one pair of alleles per gene, one chromosome per gene.
function cellOf(inst, genes) {
  return diploid(
    inst.karyotype,
    genes.map((pair, i) => [0, 1].map((k) => haplotype({ [inst.traits[i].id]: pair[k] }, { color: PALETTE.hap[k] }))),
  );
}

// A haploid gamete with one allele of each gene: one chromatid per chromosome.
function gameteCell(inst, alleles, color) {
  return makeCell(inst.karyotype, inst.karyotype.map((def, i) => [chromosome(def, haplotype({ [def.loci[0].id]: alleles[i] }, { color }))]));
}

// Each gene as { trait, alleles }, the form the engine's cross functions take.
const genesFor = (inst, genes) => inst.traits.map((trait, i) => ({ trait, alleles: genes[i] }));

// Genotype with each gene's alleles in dominant-first order, so "s/S" and "S/s" are the same zygote.
const sortPair = (pair) => [...pair].sort();

// The zygote genotypes these parents could make, as options for the picker (possible ones and look-alikes that are
// not), shuffled by seed so every playthrough lists them in the same order.
function zygoteOptions(inst) {
  const [t1, t2] = inst.traits;
  const [U1, l1] = t1.alleles.map((a) => a.id);
  const [U2, l2] = t2.alleles.map((a) => a.id);
  const pairs = (U, l) => [
    [U, U],
    [U, l],
    [l, l],
  ];
  const possible = pairs(U1, l1).flatMap((p1) => pairs(U2, l2).map((p2) => ({ genes: [p1, p2], possible: true, text: genotypeOf(inst, [p1, p2]) })));
  const impossible = [
    {
      text: `${U1}/${U1}/${l1} ; ${U2}/${l2}`,
      reason: `${U1}/${U1}/${l1} has three alleles on one chromosome: a trisomy, or a triploid. A normal diploid has exactly two copies of each chromosome.`,
    },
    {
      text: `${U1}/${l1}/${U1}/${l1} ; ${U2}/${l2}`,
      reason: 'Four alleles on one chromosome means four copies of it, a tetraploid, not a diploid.',
    },
    {
      text: `${U1}/${l1} ; ${U1}/${l1}`,
      reason: `Both chromosomes carry the ${t1.name.toLowerCase()} gene, and the ${t2.name.toLowerCase()} gene is missing. Each chromosome carries one of the two genes.`,
    },
    {
      text: `${U1} ; ${U2}/${l2}`,
      reason: `${U1} is a single allele. A diploid carries two alleles of each gene, one on each homolog.`,
    },
  ].map((o) => ({ ...o, possible: false }));
  return shuffle(makeRng(inst.seed + 31), [...possible, ...impossible]);
}

class BuildStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.loci = this.inst.traits.map((t) => t.id);
    this.order = this.inst.karyotype.map((d) => d.id);
    // Kept on the module so progress survives leaving the step and coming back.
    this.s = mod.state.build ??= {
      sub: 'a',
      zygote: null, // the zygote's genes, one pair per gene
      zygoteNote: null, // an option picked that was impossible, with its reason
      answers: {}, // nuclei the student built, by question
      attempts: {},
      done: new Set(),
      revealed: new Set(),
      feedback: null,
      rows: null,
      listResult: null,
    };
    this.options = zygoteOptions(this.inst);
  }

  get id() {
    return this.s.sub;
  }

  // ---- lifecycle ----

  enter(container, body) {
    this.body = body;
    this.exited = false;
    const { ctx } = this.mod;
    this.builder = new CellBuilder({
      app: ctx.app,
      container,
      karyotype: this.inst.karyotype,
      alleles: Object.fromEntries(this.inst.traits.map((t) => [t.id, t.alleles.map((a) => a.id)])),
      onChange: (nuclei) => {
        this.s.answers[this.id] = nuclei;
      },
    });
    // The egg and sperm question's zygote picker, the nucleus-count questions and the feedback sit on the main page.
    this.qsheet = new QuestionSheet(this.mod, () => this.relayout());
    this.buildBar = h('div', { class: 'build-bar', hidden: true });
    ctx.stage.append(this.buildBar);
    // Question h's gamete list sits on the main page under the stage name, as HTML.
    this.listEl = h('div', { class: 'stage-sheet', hidden: true });
    ctx.stage.append(this.listEl);
    this.renderPanel();
    this.layout(...this.size());
  }

  exit() {
    this.exited = true;
    this.qsheet.moveOn(this.mod.state.seen);
    this.qsheet.remove();
    this.builder.destroy();
    this.buildBar.remove();
    this.listEl.remove();
  }

  resize(w, hgt) {
    this.layout(w, hgt);
  }

  // The canvas lays out under the stage name and above the build bar and any question sheet over it.
  relayout() {
    if (this.builder.locked) this.layoutLater = true;
    else this.layout(...this.size());
  }

  size() {
    const { w, h: hgt } = this.mod.size();
    return [w, hgt];
  }

  layout(w, hgt) {
    const bar = this.barSpace();
    this.barLaidOut = bar;
    this.mod.ctx.stage.style.setProperty('--sheet-lift', `${bar}px`);
    this.builder.setRect({ x: 12, y: 12, w: w - 24, h: hgt - 24 - bar - this.qsheet.space() });
  }

  barSpace() {
    return this.buildBar.hidden ? 0 : this.buildBar.offsetHeight + 12;
  }

  fitBar() {
    if (this.barSpace() !== this.barLaidOut) this.relayout();
  }

  catchUpLayout() {
    if (!this.layoutLater) return;
    this.layoutLater = false;
    this.relayout();
  }

  // ---- the zygote, and everything derived from it ----

  zygoteText() {
    return this.s.zygote ? genotypeOf(this.inst, this.s.zygote) : null;
  }

  // The zygote's meiosis, with a gamete the question names. Stable for a given seed and zygote.
  derived() {
    const key = this.zygoteText();
    if (this.cache?.key === key) return this.cache;
    const rng = makeRng(this.inst.seed ^ [...key].reduce((n, c) => n * 31 + c.charCodeAt(0), 7));
    const genes = genesFor(this.inst, this.s.zygote);
    const zygote = cellOf(this.inst, this.s.zygote);
    const result = meiosis(zygote, rng, { crossingOver: false });
    const target = gameteLabel(genes, pick(rng, dihybridGametes(genes)).alleles);
    this.cache = { key, zygote, result, target };
    return this.cache;
  }

  // Picking a different zygote starts questions b to h over.
  setZygote(genes) {
    this.s.zygote = genes;
    this.s.answers = {};
    this.s.attempts = {};
    this.s.done = new Set();
    this.s.revealed = new Set();
    this.s.rows = null;
    this.s.listResult = null;
    this.mod.state.answered = new Set([...this.mod.state.answered].filter((k) => !k.startsWith('build:')));
    this.mod.state.seen = new Set([...this.mod.state.seen].filter((k) => !k.startsWith('build:')));
  }

  // Question a's canvas is dimmed and locked until a possible zygote is chosen.
  locked() {
    return this.id === 'a' && !this.s.zygote;
  }

  // ---- what each question asks ----

  // The canvas for a question: its starting nuclei, how it is graded, and any count question above it.
  spec(id) {
    // Question a comes before any zygote is chosen, so the zygote's cells are only read once there is one.
    const d = this.s.zygote ? this.derived() : null;
    const meta = { metaphase: false, arrangement: null, anaphase: null, count: null };
    switch (id) {
      case 'a':
        return { ...meta, start: [{ label: 'Egg' }, { label: 'Sperm', shape: 'sperm' }], fixed: true };
      case 'b':
        return { ...meta, start: [{ label: 'Zygote' }], fixed: true, expected: () => [nucleusFromCell(d.zygote, { label: 'Zygote' })] };
      case 'c':
        return {
          ...meta,
          metaphase: true,
          arrangement: 'plate',
          anaphase: 'sisters',
          start: [{ label: 'Zygote at metaphase' }],
          fixed: true,
          expected: () => [nucleusFromCell(d.zygote, { replicated: true })],
        };
      case 'd':
        return { ...meta, start: [{ label: 'Daughter cell 1' }, { label: 'Daughter cell 2' }], fixed: true, expected: () => [nucleusFromCell(d.zygote), nucleusFromCell(d.zygote)] };
      case 'e':
        return {
          ...meta,
          metaphase: true,
          arrangement: 'paired',
          anaphase: 'homologs',
          start: [{ label: 'Metaphase I' }],
          fixed: true,
          // The genes are unlinked, so the gamete needs no crossover: the minimum is zero.
          minCross: 0,
          expected: () => [nucleusFromCell(d.zygote, { replicated: true, paired: true })],
        };
      case 'f':
        return {
          ...meta,
          metaphase: true,
          arrangement: 'plate',
          anaphase: 'sisters',
          start: [{ label: 'Nucleus 1' }, { label: 'Nucleus 2' }],
          fixed: true,
          count: { text: 'After Meiosis I, there are how many nuclei?', options: [1, 2], answer: 2, wrong: { 1: 'Incorrect. Meiosis I divides one cell into two: the homologs went to opposite poles, so there are two nuclei.' }, right: 'Correct: two nuclei, one at each pole of the meiosis I spindle. Build each one at metaphase II.' },
          expected: () => metaphaseIINuclei(d.result),
        };
      case 'g':
        return {
          ...meta,
          start: [{ label: 'Gamete 1' }, { label: 'Gamete 2' }, { label: 'Gamete 3' }, { label: 'Gamete 4' }],
          fixed: true,
          count: { text: 'After Meiosis II, how many gametes are there?', options: [1, 2, 4], answer: 4, wrong: { 1: 'Incorrect. Meiosis has two divisions, and each one splits every cell in two, so one cell becomes more than one gamete.', 2: 'Incorrect. Two is the count after Meiosis I. Meiosis II then splits each of those two cells again.' }, right: 'Correct: Meiosis I makes two cells and Meiosis II splits each again, giving four gametes. Build each one.' },
          expected: () => gameteNuclei(d.result),
        };
      default:
        return null;
    }
  }

  prompt(id) {
    const { mother, father } = this.inst;
    const zyg = this.zygoteText();
    switch (id) {
      case 'a':
        return `This is a diploid organism, and both genes are autosomal and on different chromosomes. The parents are ${genotypeOf(this.inst, mother.genes)} (mother) and ${genotypeOf(this.inst, father.genes)} (father). Choose a zygote genotype they could produce. Then build the egg and the sperm that would make it: one chromosome of each gene, one chromatid each, with the allele on every chromatid.`;
      case 'b':
        return `Build the zygote nucleus immediately after fertilization, ${zyg}: each chromosome, the correct number of chromatids, and the allele on every chromatid.`;
      case 'c':
        return `The zygote is in mitosis. Build its nucleus at metaphase, then choose how the chromosomes line up on the metaphase plate.`;
      case 'd':
        return 'Mitosis has finished, giving two daughter cells. Build the nucleus of each daughter cell: the chromosomes, the correct number of chromatids, and the allele on every chromatid.';
      case 'e':
        return `One of this individual’s germline cells enters meiosis and will make a gamete with genotype ${this.derived().target}. The genes are on different chromosomes, so that gamete needs no crossover. Build metaphase I and choose how the chromosome pairs line up on the plate.`;
      case 'f':
        return 'Meiosis I has finished. First say how many nuclei there are, then build each nucleus at metaphase II and choose how the chromosomes line up on the metaphase plate.';
      case 'g':
        return 'Meiosis has finished. First say how many gametes there are, then build the nucleus of each gamete.';
      case 'h':
        return `List every gamete genotype this individual (${zyg}) can make and the expected frequency of each. Assume normal meiosis (no non-disjunction).`;
      default:
        return '';
    }
  }

  // ---- panel ----

  renderPanel() {
    if (this.exited) return;
    this.setStageName();
    this.qsheet.begin();
    this.renderBody();
    this.qsheet.end();
  }

  setStageName() {
    this.mod.setStage(STAGES[this.id]);
  }

  go(id) {
    if (id !== 'a' && !this.s.zygote) id = 'a';
    this.s.sub = id;
    this.s.feedback = null;
    this.buildBar.hidden = true;
    this.listEl.hidden = true;
    this.renderPanel();
    this.layout(...this.size());
    this.mod.ctx.panel.scrollTop = 0;
  }

  next() {
    const i = IDS.indexOf(this.id);
    if (i < IDS.length - 1) this.go(IDS[i + 1]);
  }

  renderBody() {
    const body = clear(this.body);
    body.append(
      h(
        'ol',
        { class: 'stepper sub' },
        IDS.map((id) =>
          h(
            'li',
            {},
            h(
              'button',
              { class: [id === this.id ? 'current' : '', this.s.done.has(id) ? 'done' : ''].join(' ').trim(), onclick: () => this.go(id) },
              `${id}. ${TITLES[id]}`,
            ),
          ),
        ),
      ),
    );
    if (this.id === 'h') return this.renderList(body);
    body.append(h('h2', {}, `${this.id}. ${TITLES[this.id]}`), h('p', {}, this.prompt(this.id)));
    if (this.id === 'a') {
      this.renderZygoteForm(body);
    } else if (this.s.zygote) {
      this.renderFollow(body);
    }
    this.renderBuild(body);
  }

  // The genotype the questions follow, and the zygote it came from.
  renderFollow(body) {
    body.append(h('div', { class: 'callout' }, h('b', {}, `This individual: ${this.zygoteText()}`), 'The zygote you chose in Question A.'));
  }

  // Question a's zygote picker, in the main page's sheet. Impossible picks are explained; the last possible one stays.
  renderZygoteForm(body) {
    const cur = this.s.zygote ? genotypeOf(this.inst, this.s.zygote) : null;
    const note = this.s.zygoteNote;
    const sel = h(
      'select',
      { class: 'gl-field', 'aria-label': 'Zygote genotype' },
      h('option', { value: '' }, 'choose a genotype…'),
      this.options.map((o, i) => h('option', { value: String(i), selected: o.text === (note?.text ?? cur) }, o.text)),
    );
    sel.addEventListener('change', () => {
      if (sel.value === '') return;
      this.pickZygote(this.options[Number(sel.value)]);
    });
    const feedback = note
      ? h('div', { class: 'feedback bad' }, h('b', {}, IMPOSSIBLE_NOTE), ' ', note.reason)
      : this.s.zygote
        ? h('div', { class: 'feedback good' }, `Possible. Now build an egg and a sperm that together make ${cur}.`)
        : '';
    this.qsheet.showForm(
      h('p', { class: 'prompt' }, 'Pick a zygote genotype these parents could produce.'),
      h('div', { class: 'dt-rows' }, h('div', { class: 'dt-row' }, h('span', { class: 'dt-name' }, h('b', {}, 'Zygote')), sel)),
      feedback,
    );
    if (!this.s.zygote) body.append(h('div', { class: 'callout' }, h('b', {}, 'Choose a zygote on the main page ←'), 'The canvas unlocks once you pick a genotype these parents could make.'));
  }

  pickZygote(option) {
    if (!option.possible) {
      this.s.zygoteNote = { text: option.text, reason: option.reason };
    } else {
      const genes = option.genes;
      const same = this.s.zygote && genotypeOf(this.inst, genes) === genotypeOf(this.inst, this.s.zygote);
      this.s.zygoteNote = null;
      if (!same) this.setZygote(genes);
    }
    this.s.feedback = null;
    this.renderPanel();
    this.layout(...this.size());
  }

  // ---- building on the canvas ----

  // The build bar goes away; the cell stays where it is.
  hideBuild() {
    this.buildBar.hidden = true;
    this.fitBar();
  }

  // Nuclei questions (f, g) are answered in the sheet first; the canvas appears when the student moves on.
  renderBuild(body) {
    const spec = this.spec(this.id);
    if (!spec) return;
    if (spec.count) {
      const key = `build:${this.id}:count`;
      const q = {
        prompt: spec.count.text,
        options: spec.count.options.map((n) => ({
          label: String(n),
          correct: n === spec.count.answer,
          feedback: n === spec.count.answer ? spec.count.right : spec.count.wrong[n],
        })),
      };
      const shown = this.qsheet.ask(body, { key, q, state: this.mod.state, rerender: () => this.renderPanel() });
      if (!shown) {
        this.builder.root.visible = false;
        return this.hideBuild();
      }
    }
    this.builder.root.visible = true;
    this.builder.metaphase = spec.metaphase;
    this.builder.fixedNuclei = spec.fixed;
    this.builder.maxNuclei = 4;
    this.builder.crossovers = false;
    // Question a waits for a zygote: the cell shows dimmed, with nothing to check yet.
    const locked = this.locked();
    this.builder.disabled = locked;
    this.builder.root.alpha = locked ? 0.35 : 1;
    const saved = this.s.answers[this.id];
    this.builder.setNuclei(saved ?? spec.start);
    if (locked) {
      body.append(h('div', { class: 'callout' }, h('b', {}, `Choose a zygote on the main page ${window.innerWidth > 860 ? '←' : '↑'}`), 'The cell unlocks once you pick a genotype these parents could make.'));
      return this.hideBuild();
    }
    body.append(
      h('div', { class: 'callout' }, h('b', {}, `Build it on the main page ${window.innerWidth > 860 ? '←' : '↑'}`), 'Then press Check under the cell.'),
    );
    if (spec.metaphase) body.append(this.arrangementNote());
    body.append(this.toolTips(spec));
    this.resultEl = h('div');
    body.append(this.resultEl);
    this.renderFeedback(spec);
  }

  arrangementNote() {
    return h(
      'div',
      { class: 'callout' },
      h('b', {}, 'Choose the arrangement in the bar above the cell'),
      h(
        'ul',
        { class: 'tips' },
        h('li', {}, h('b', {}, 'Centromeres on the plate: '), 'each chromosome lines up single file, its centromere on the plate and its sister chromatids facing opposite poles.'),
        h('li', {}, h('b', {}, 'Homologs paired across the plate: '), 'each chromosome pair lines up side by side, one homolog on each side of the plate.'),
      ),
    );
  }

  toolTips(spec) {
    const tips = [
      'Drag a chromosome from the tray into a nucleus: 1 chromatid, or 2 sister chromatids. The number beside it is the chromosome.',
      'Drag an allele onto each chromatid of the chromosome that carries its gene.',
      spec.metaphase ? 'Choose the arrangement above, or drag one chromosome onto its homolog to pair them.' : 'Drag one chromosome onto its homolog to pair them; drag it away to unpair.',
      spec.fixed ? null : 'Drag the nucleus piece up to add a cell; use × to remove one.',
      'Drag anything onto the bin to remove it.',
    ].filter(Boolean);
    return h('ul', { class: 'tips' }, tips.map((t) => h('li', {}, t)));
  }

  // The build bar along the bottom of the canvas: the feedback on the cell, and Check, Show me after two wrong checks,
  // Watch anaphase again, and the way on once right.
  renderFeedback(spec) {
    const fb = this.s.feedback;
    const id = this.id;
    const i = IDS.indexOf(id);
    const next = i < IDS.length - 1 ? `Next: Question ${IDS[i + 1].toUpperCase()} ▶` : null;
    const onward = (fb?.kind === 'good' || fb?.shown) && next;
    const button = (text, onclick, primary = false) => h('button', { class: primary ? 'btn primary' : 'btn', type: 'button', onclick }, text);
    clear(this.buildBar).append(
      h('div', { class: `feedback ${fb ? fb.kind : 'hint'}`, role: 'status' }, fb?.text ?? 'Build the cell above, then press Check.'),
      h(
        'div',
        { class: 'row' },
        fb?.kind === 'bad' && !fb.shown && (this.s.attempts[id] ?? 0) >= SHOW_AFTER && id !== 'a' ? button('Show me', () => this.showAnswer()) : '',
        fb?.kind === 'good' && spec.anaphase ? button('▶ Watch anaphase again', () => this.playAnaphase()) : '',
        button('Check', () => this.check(), !onward),
        onward ? button(next, () => this.next(), true) : '',
      ),
    );
    this.buildBar.hidden = false;
    this.fitBar();
    clear(this.resultEl).append(fb?.kind === 'good' ? h('p', { class: 'hint' }, `✓ ${fb.text}`) : '');
  }

  // An answer the student was shown does not count as completed.
  showAnswer() {
    const spec = this.spec(this.id);
    const expected = spec.expected();
    const labels = spec.fixed ? spec.start.map((x) => x.label) : expected.map(() => '');
    this.builder.setNuclei(expected.map((n, i) => ({ ...n, label: labels[i] ?? '', ...(spec.arrangement ? { arrangement: spec.arrangement } : {}) })));
    this.s.answers[this.id] = this.builder.getNuclei();
    this.s.revealed.add(this.id);
    this.s.feedback = { kind: 'bad', shown: true, text: 'Here is one correct answer. Study it, then try the next question.' };
    this.renderFeedback(spec);
  }

  async playAnaphase() {
    const spec = this.spec(this.id);
    if (!spec.anaphase) return;
    await this.builder.anaphase(this.mod.ctx.tween, spec.anaphase);
    this.catchUpLayout();
  }

  // ---- checking ----

  // Question a: each gamete must be one the parent could make, and together they must make the chosen zygote.
  checkGametes(student) {
    if (!this.s.zygote) return { problem: { code: 'zygote' } };
    const { mother, father } = this.inst;
    const result = {};
    for (const [label, parent, color] of [
      ['Egg', mother, PALETTE.hap[0]],
      ['Sperm', father, PALETTE.hap[1]],
    ]) {
      const nucleus = student.find((n) => n.label === label);
      const candidates = dihybridGametes(genesFor(this.inst, parent.genes)).map((g) => g.alleles);
      const expected = candidates.map((alleles) => nucleusFromCell(gameteCell(this.inst, alleles, color), { label }));
      // A structural mistake (wrong count of chromosomes or chromatids, unlabeled) reads the same for every gamete.
      const structural = evaluate([nucleus], [expected[0]], { loci: this.loci, matchBy: 'label' }).problems.find((p) => p.code !== 'content');
      if (structural) return { problem: structural };
      const match = candidates.find((_, i) => evaluate([nucleus], [expected[i]], { loci: this.loci, matchBy: 'label' }).ok);
      if (!match) {
        return {
          problem: {
            code: 'gamete',
            label,
            got: nucleusGenotype(nucleus, this.loci, this.order),
            expected: candidates.map((alleles) => gameteLabel(genesFor(this.inst, parent.genes), alleles)),
            parent: parent.genes.map((p) => p.join('/')).join(' ; '),
          },
        };
      }
      result[label] = match;
    }
    const combined = this.inst.traits.map((_, i) => sortPair([result.Egg[i], result.Sperm[i]]));
    if (genotypeOf(this.inst, combined) !== this.zygoteText()) {
      return { problem: { code: 'gametes-zygote', egg: gameteLabel(genesFor(this.inst, this.s.zygote), result.Egg), sperm: gameteLabel(genesFor(this.inst, this.s.zygote), result.Sperm), zygote: genotypeOf(this.inst, combined) } };
    }
    return { egg: result.Egg, sperm: result.Sperm };
  }

  check() {
    const id = this.id;
    const spec = this.spec(id);
    if (spec.count && !this.mod.state.seen.has(`build:${id}:count`)) {
      this.s.feedback = { kind: 'bad', text: `First answer the question above the cell: ${spec.count.text}` };
      return this.renderFeedback(spec);
    }
    const student = this.builder.getNuclei();
    this.s.attempts[id] = (this.s.attempts[id] ?? 0) + 1;
    let ok;
    let problem;
    if (id === 'a') {
      const r = this.checkGametes(student);
      ok = !r.problem;
      problem = r.problem;
    } else {
      const r = evaluate(student, spec.expected(), { loci: this.loci, matchBy: 'multiset', minCross: spec.minCross ?? null, arrangement: spec.arrangement });
      ok = r.ok;
      problem = r.problems[0];
    }
    if (ok && this.s.revealed.has(id)) {
      this.s.feedback = { kind: 'bad', shown: true, text: 'That matches the answer you were shown, so it does not count as completed. Pick a new zygote in Question A to start over.' };
    } else if (ok) {
      this.s.done.add(id);
      this.s.feedback = { kind: 'good', text: this.praise(id) };
    } else {
      this.s.feedback = { kind: 'bad', text: this.explain(id, problem) };
    }
    // The panel redraws to record a right answer; any animation starts after it, so it is not reset.
    this.renderPanel();
    if (ok && spec.anaphase) this.playAnaphase();
    if (ok && id === 'a') this.builder.fuseGametes(this.mod.ctx.tween).then(() => this.catchUpLayout());
  }

  // The egg and sperm question wants the picked zygote first; the other questions use the zygote.
  praise(id) {
    const z = this.zygoteText();
    return {
      a: `Right. Each gamete is haploid: one chromosome per gene, one chromatid each. An egg and a sperm together make ${z}, the zygote the other questions follow.`,
      b: 'Right. Fertilization restores two homologs of each chromosome, one from each parent, each still a single chromatid.',
      c: 'Right. Each chromosome replicated into two identical sisters, and in mitosis they line up single file on the plate without pairing.',
      d: 'Right. Sisters separated, so each daughter is an exact copy of the zygote.',
      e: 'Right. Each chromosome pair is a bivalent: the homologs pair across the plate. The two genes assort independently, so each pair can face either pole.',
      f: 'Right. The homologs went to different cells, each still carrying two sister chromatids of each chromosome.',
      g: 'Right. Four haploid gametes, each with one allele of each gene.',
    }[id];
  }

  // Turn a grader problem into a sentence for this question, naming the genotypes.
  explain(id, p) {
    const one = (n) => `${n} chromosome${n === 1 ? '' : 's'}`;
    switch (p.code) {
      case 'zygote':
        return 'First choose a zygote genotype these parents could produce, in Question A on the main page.';
      case 'gametes-zygote':
        return `An egg carrying ${p.egg} and a sperm carrying ${p.sperm} would make the zygote ${p.zygote}, but the zygote you chose is ${this.zygoteText()}. Check which allele each gamete carries.`;
      case 'gamete':
        return `The ${p.label.toLowerCase()} comes from ${p.parent}, so it carries one allele of each gene: one of ${p.expected.join(', ')}. You built ${p.got}.`;
      case 'nucleus-count':
        return {
          d: `Mitosis gives two daughter cells. You have ${p.got} nucle${p.got === 1 ? 'us' : 'i'}.`,
          f: `Meiosis I splits one cell into two, so there are two nuclei at metaphase II. You have ${p.got}.`,
          g: `Two meiotic divisions turn one cell into four gametes. You have ${p.got}.`,
        }[id] ?? `There should be ${p.expected} nuclei here.`;
      case 'chromosome-count': {
        const who = p.label || 'Each nucleus';
        const haploid = ['a', 'f', 'g'].includes(id);
        const should = haploid ? `${who} is haploid: it should hold ${one(p.expected)}, one of each chromosome` : `${who} should hold ${one(p.expected)}, one from each parent`;
        // Students often count sister chromatids as separate chromosomes. Chromosomes are counted by centromeres.
        if (p.chromatids > p.got) {
          return `${should}. You have ${p.chromatids} chromatids, but they belong to only ${one(p.got)}. Chromosomes are counted by centromeres: two strands joined at one centromere are sister chromatids of one chromosome.`;
        }
        return `${should}. You have ${p.got}.`;
      }
      case 'chromatid-count':
        return p.expected === 1
          ? 'At this stage each chromosome is a single chromatid: either it has not replicated yet, or its sisters have already separated.'
          : 'At this stage each chromosome is replicated: two sister chromatids joined at the centromere.';
      case 'not-arranged':
        return 'Choose how the chromosomes line up at metaphase, using the bar above the cell: centromeres single file on the plate, or homologs paired across the plate.';
      case 'wrong-arrangement':
        if (p.expected === 'paired') return 'At metaphase I each chromosome pair lines up side by side across the plate. Choose “Homologs paired across the plate” above the cell.';
        return 'At this stage each chromosome lines up on its own, centromere on the plate, with its sister chromatids facing opposite poles. Choose “Centromeres on the plate” above the cell.';
      case 'needs-pairing':
        return 'At metaphase I every chromosome is paired with its homolog. Choose “Homologs paired across the plate” above the cell, or drag one homolog onto the other.';
      case 'no-pairing':
        return 'Homologs do not pair here: each chromosome lines up on its own.';
      case 'unlabeled':
        return 'Every chromatid needs an allele. Drag each allele onto the chromatids of the chromosome that carries its gene.';
      case 'sisters-differ':
        return 'Sister chromatids are copies made in S phase, so they carry the same allele.';
      case 'content': {
        const list = (xs) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
        const why = {
          b: 'The zygote has one homolog of each chromosome from each parent.',
          c: 'Replication copies each chromosome exactly, so the genotype does not change.',
          d: 'Each daughter gets one sister chromatid of every chromosome, so both match the zygote.',
          e: 'Each bivalent holds the two homologs of one chromosome that the individual inherited.',
          f: 'At anaphase I the homologs separated, so each nucleus carries one homolog of each chromosome, with its two identical sisters.',
          g: 'Each gamete gets one chromatid of each chromosome.',
        }[id];
        if (p.expected.length === 1) return `This is not the right genotype. The genotype should be ${p.expected[0]}; you built ${p.got[0]}. ${why ?? ''}`;
        const noun = { d: 'daughter nuclei', f: 'metaphase II nuclei', g: 'gametes' }[id] ?? 'nuclei';
        const should = p.expected.every((x) => x === p.expected[0]) ? `Each of the ${p.expected.length} ${noun} should be ${p.expected[0]}` : `The ${p.expected.length} ${noun} should be ${list(p.expected)}`;
        return `These are not the right genotypes. ${should}; you built ${list(p.got)}. ${why ?? ''}`;
      }
      case 'crossovers-extra':
        return 'No crossover is needed. The two genes are on different chromosomes, so each gamete can get the right allele of each gene without one. Remove the X (tap it, or drag it to the bin).';
      default:
        return 'Not quite.';
    }
  }

  // ---- gamete list (question h) ----

  // The gamete picks for this zygote: its real gametes, mixed with look-alikes that are not haploid.
  listChoices() {
    const genes = genesFor(this.inst, this.s.zygote);
    return shuffle(makeRng(this.inst.seed + 41), gameteChoices(genes));
  }

  renderList(body) {
    body.append(h('h2', {}, `h. ${TITLES.h}`), h('p', {}, this.prompt('h')));
    this.listEl.hidden = false;
    this.builder.root.visible = false;
    this.hideBuild();
    const genes = genesFor(this.inst, this.s.zygote);
    const expected = new Map(dihybridGametes(genes).map((g) => [gameteLabel(genes, g.alleles), g.p]));
    const choices = this.listChoices();
    const haploid = (text) => choices.find((c) => c.text === text)?.kind === 'gamete';
    const kindOf = (text) => choices.find((c) => c.text === text)?.kind;
    this.s.rows ??= [{ g: '', f: '' }];
    const result = this.s.listResult;
    if (result?.kind === 'good') {
      body.append(h('div', { class: 'feedback good' }, result.text, h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn primary', onclick: () => (location.hash = '#/') }, 'Return to main page'))));
    } else {
      body.append(h('div', { class: 'callout' }, h('b', {}, `Build your list on the main page ${window.innerWidth > 860 ? '←' : '↑'}`), 'Add one row per gamete genotype, with its expected frequency, then press Check.'));
    }
    const fb = h('div', { class: `feedback ${result?.kind === 'bad' ? 'bad' : ''}`, role: 'status' }, result?.kind === 'bad' ? result.text : '');
    const edited = () => {
      if (this.s.listResult?.kind !== 'bad') return;
      this.s.listResult = null;
      fb.className = 'feedback';
      fb.textContent = '';
    };
    const rows = h('div', { class: 'gl-rows' });
    const draw = () => {
      clear(rows).append(
        h('div', { class: 'gl-head' }, h('span', {}, 'Genotype'), h('span', {}, 'Frequency'), h('span', {})),
        ...this.s.rows.flatMap((r, i) => {
          const sel = h('select', { class: 'gl-field', 'aria-label': `Gamete genotype ${i + 1}` }, h('option', { value: '' }, 'choose…'), choices.map((c) => h('option', { value: c.text, selected: r.g === c.text }, c.text)));
          sel.addEventListener('change', () => {
            r.g = sel.value;
            edited();
            draw();
          });
          const freq = h('input', { class: 'gl-field', type: 'text', inputmode: 'decimal', value: r.f, placeholder: 'e.g. 1/4', 'aria-label': `Frequency ${i + 1}` });
          freq.addEventListener('input', () => {
            r.f = freq.value;
            edited();
          });
          const remove =
            this.s.rows.length > 1
              ? h('button', { class: 'gl-remove', type: 'button', 'aria-label': `Remove row ${i + 1}`, onclick: () => { this.s.rows.splice(i, 1); edited(); draw(); } }, '×')
              : h('span', {});
          const note = r.g && !haploid(r.g) ? (kindOf(r.g) === 'missing' ? 'A gamete gets one allele of each gene, so it cannot lack a gene.' : NOT_HAPLOID) : null;
          return [h('div', { class: 'gl-row' }, h('span', { class: 'gl-gamete', 'aria-hidden': 'true' }, r.g || '?'), sel, freq, remove), note ? h('div', { class: 'feedback bad gl-note' }, note) : ''];
        }),
      );
    };
    draw();

    const checkList = () => {
      const filled = this.s.rows.filter((r) => r.g || r.f);
      const problems = [];
      const seen = new Set();
      for (const r of filled) if (r.g && !haploid(r.g)) problems.push(NOT_HAPLOID);
      for (const r of filled) {
        if (!r.g) problems.push('Pick a genotype for every row.');
        else if (seen.has(r.g)) problems.push(`${r.g} is listed twice.`);
        seen.add(r.g);
        if (parseFrequency(r.f) == null) problems.push(`Give a frequency for ${r.g || 'each row'} as a fraction, decimal or percent.`);
      }
      if (!problems.length) {
        for (const r of filled) {
          const want = expected.get(r.g) ?? 0;
          if (!want) problems.push(`This individual (${this.zygoteText()}) cannot make ${r.g} gametes.`);
          else if (Math.abs(parseFrequency(r.f) - want) > 1e-6) problems.push(`The frequency of ${r.g} gametes is off. Each gene’s allele goes to half the gametes, and the two genes assort independently, so multiply the two halves.`);
        }
        for (const a of expected.keys()) if (!seen.has(a)) problems.push('A gamete genotype is missing from your list.');
      }
      if (problems.length) {
        this.s.listResult = { kind: 'bad', text: problems[0] };
        fb.className = 'feedback bad';
        fb.textContent = problems[0];
        return;
      }
      this.s.listResult = {
        kind: 'good',
        text: `Right: ${[...expected].map(([g, p]) => `${g} ${fraction(p)}`).join(', ')}. Each gamete gets one allele of each gene, and the genes assort independently.`,
      };
      this.s.done.add('h');
      this.mod.complete('build');
      this.renderPanel();
    };

    clear(this.listEl).append(
      rows,
      h(
        'div',
        { class: 'gl-actions' },
        h('button', { class: 'btn gl-add', type: 'button', onclick: () => { this.s.rows.push({ g: '', f: '' }); edited(); draw(); } }, '+ Add a gamete'),
        h('button', { class: 'btn primary', type: 'button', onclick: checkList }, 'Check'),
      ),
      fb,
    );
  }
}

export { BuildStep, IDS };
