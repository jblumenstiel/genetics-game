// Module 0: Build the cell. Students construct nuclei (chromosomes, chromatids, alleles) through fertilization,
// mitosis and meiosis for one locus with two alleles, and the engine grades every answer.
// No creatures and no phenotypes: just named alleles.

import { h, clear } from '../../core/dom.js';
import { makeRng, pick, int, shuffle } from '../../core/rng.js';
import { PALETTE } from '../../core/palette.js';
import { haplotype, diploid, allelesAt } from '../../engine/genome.js';
import { meiosis, fertilize } from '../../engine/meiosis.js';
import { gameteDistribution, fraction } from '../../engine/cross.js';
import { nucleusFromCell, metaphaseIINuclei, gameteNuclei, evaluate, minCrossovers, parseFrequency } from '../../engine/drawing.js';
import { CellBuilder } from '../../builder/cell-builder.js';

const LETTERS = ['A', 'B', 'D', 'E', 'G', 'H', 'R', 'T'];

function productWith(cell, locus, allele, rng) {
  for (;;) {
    const p = meiosis(cell, rng, { crossingOver: false }).products.find((x) => allelesAt(x.cell, locus)[0] === allele);
    if (p) return p.cell;
  }
}

function buildInstance(seed) {
  const rng = makeRng(seed);
  const L = pick(rng, LETTERS);
  const up = L;
  const low = L.toLowerCase();
  const centromere = pick(rng, [30, 40, 60, 70]);
  const pos = centromere < 50 ? int(rng, 62, 86) : int(rng, 14, 38);
  const karyotype = [{ id: '1', name: 'Chromosome 1', length: 100, centromere, loci: [{ id: L, pos }] }];
  const make = (alleles) => diploid(karyotype, [alleles.map((a, i) => haplotype({ [L]: a }, { color: PALETTE.hap[i] }))]);

  // Either both parents are homozygous for different alleles, or one is heterozygous and we say which allele
  // its gamete carried. The zygote is always heterozygous.
  const [x, y] = shuffle(rng, [up, low]);
  const mode = pick(rng, ['homozygous', 'motherHet', 'fatherHet']);
  let mother;
  let father;
  let eggAllele;
  let spermAllele;
  if (mode === 'homozygous') {
    [mother, father, eggAllele, spermAllele] = [[x, x], [y, y], x, y];
  } else if (mode === 'motherHet') {
    [mother, father, eggAllele, spermAllele] = [[up, low], [y, y], x, y];
  } else {
    [mother, father, eggAllele, spermAllele] = [[x, x], [up, low], x, y];
  }
  const motherCell = make(mother);
  const fatherCell = make(father);
  const egg = productWith(motherCell, L, eggAllele, rng);
  const sperm = productWith(fatherCell, L, spermAllele, rng);
  const zygote = fertilize(egg, sperm);
  const target = pick(rng, [up, low]);
  const result = meiosis(zygote, rng, { crossingOver: false });

  return { seed, L, up, low, karyotype, mode, mother, father, motherCell, fatherCell, egg, sperm, zygote, eggAllele, spermAllele, target, result };
}

const g = (alleles) => alleles.join('/');

function steps(inst) {
  const { L, zygote, egg, sperm, result, target, mother, father, mode, eggAllele, spermAllele } = inst;
  const note =
    mode === 'motherHet'
      ? ` The mother is heterozygous; this egg carries ${eggAllele}.`
      : mode === 'fatherHet'
        ? ` The father is heterozygous; this sperm carries ${spermAllele}.`
        : '';
  const homologs = zygote.chromosomes[0].copies.map((c) => ({ [L]: c.segments[0].hap.alleles[L] }));
  return [
    {
      id: 'a',
      title: 'Egg and sperm',
      prompt: `The mother is ${g(mother)} and the father is ${g(father)}.${note} Build the egg and the sperm. In each, show the chromosomes, the correct number of chromatids, and the allele on every chromatid.`,
      start: [{ label: 'Egg' }, { label: 'Sperm' }],
      fixed: true,
      matchBy: 'label',
      expected: () => [nucleusFromCell(egg, { label: 'Egg' }), nucleusFromCell(sperm, { label: 'Sperm' })],
    },
    {
      id: 'b',
      title: 'Zygote',
      prompt: 'Build the zygote nucleus immediately after fertilization: the chromosomes, the correct number of chromatids, and the allele on every chromatid.',
      start: [{ label: 'Zygote' }],
      fixed: true,
      expected: () => [nucleusFromCell(zygote, { label: 'Zygote' })],
    },
    {
      id: 'c',
      title: 'Mitotic metaphase',
      prompt: 'The zygote is in mitosis. Build its nucleus at metaphase.',
      start: [{ label: 'Zygote at metaphase' }],
      fixed: true,
      expected: () => [nucleusFromCell(zygote, { replicated: true })],
    },
    {
      id: 'd',
      title: 'Daughter cells',
      prompt: 'Mitosis has finished. Build the nuclei of the daughter cells. Add a nucleus for each daughter.',
      start: [{ label: '' }],
      maxNuclei: 4,
      expected: () => [nucleusFromCell(zygote), nucleusFromCell(zygote)],
    },
    {
      id: 'e',
      title: 'Metaphase I',
      prompt: `One of this individual’s germline stem cells enters meiosis. It will eventually produce a gamete with genotype ${target}. Build the nucleus at metaphase I, and mark the minimum number of crossovers needed with an X.`,
      start: [{ label: 'Metaphase I' }],
      fixed: true,
      crossovers: true,
      minCross: minCrossovers({ [L]: target }, homologs, [L]),
      expected: () => [nucleusFromCell(zygote, { replicated: true, paired: true })],
    },
    {
      id: 'f',
      title: 'Metaphase II',
      prompt: 'Meiosis I has finished. Build each nucleus at metaphase II.',
      start: [{ label: '' }],
      maxNuclei: 4,
      expected: () => metaphaseIINuclei(result),
    },
    {
      id: 'g',
      title: 'Gametes',
      prompt: 'Meiosis has finished. Build the nucleus of each gamete.',
      start: [{ label: '' }],
      maxNuclei: 6,
      expected: () => gameteNuclei(result),
    },
    {
      id: 'h',
      title: 'Gamete list',
      prompt: 'List every gamete genotype this individual can make and the expected frequency of each. Assume normal meiosis (no non-disjunction). No drawing needed.',
      list: true,
    },
  ];
}

// Turn a grader problem into a sentence for this question.
function explain(step, p, inst) {
  const one = (n) => `${n} chromosome${n === 1 ? '' : 's'}`;
  switch (p.code) {
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
      return 'Every chromatid needs an allele. Tap a chromosome to select it, then tap each chromatid to set its allele.';
    case 'sisters-differ':
      return 'Sister chromatids are copies made in S phase, so they carry the same allele, unless a crossover swapped pieces.';
    case 'content':
      return {
        a: `${p.label} carries the wrong allele. Which allele did ${p.label === 'Egg' ? 'the mother' : 'the father'} pass on?`,
        b: 'The zygote gets one chromosome from the egg and one from the sperm. Check the alleles.',
        c: 'Replication copies each chromosome exactly. Check the alleles on each chromosome.',
        d: 'Each daughter gets one sister chromatid of every chromosome, so both daughters match the zygote.',
        e: 'The bivalent should hold the two homologs this individual inherited. Check the alleles.',
        f: 'At anaphase I the homologs separated. Which alleles end up together in each nucleus?',
        g: 'Each gamete gets one chromatid. How many gametes carry each allele?',
      }[step.id];
    case 'crossovers-extra':
      return `No crossover is needed. With one locus, a ${inst.target} gamete simply gets a chromatid from the homolog carrying ${inst.target}. Remove the X.`;
    case 'crossovers-missing':
      return `This gamete needs at least ${p.min} crossover${p.min === 1 ? '' : 's'}.`;
    default:
      return 'Not quite.';
  }
}

class DrawingModule {
  constructor(ctx) {
    this.ctx = ctx;
    this.inst = buildInstance(ctx.seed);
    this.steps = steps(this.inst);
    this.answers = {};
    this.attempts = {};
    this.done = new Set();
    this.revealed = new Set();
    this.feedback = null;
    this.listRows = null;

    this.scene = new PIXI.Container();
    ctx.root.addChild(this.scene);
    this.strip = new PIXI.Container();
    this.scene.addChild(this.strip);
    const karyotype = this.inst.karyotype;
    const alleles = { [this.inst.L]: [this.inst.up, this.inst.low] };
    this.parents = new CellBuilder({ app: ctx.app, container: this.strip, karyotype, alleles, readOnly: true, fixedNuclei: true });
    this.parents.setNuclei([
      nucleusFromCell(this.inst.motherCell, { label: `Mother (${g(this.inst.mother)})` }),
      nucleusFromCell(this.inst.fatherCell, { label: `Father (${g(this.inst.father)})` }),
    ]);
    this.builder = new CellBuilder({
      app: ctx.app,
      container: this.scene,
      karyotype,
      alleles,
      onChange: (nuclei) => {
        this.answers[this.step.id] = nuclei;
        this.renderTools();
      },
    });

    this.buildPanel();
    this.go(0);
  }

  get step() {
    return this.steps[this.index];
  }

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
        h('p', { class: 'meta' }, 'One gene, ', h('b', {}, L), ', with two alleles, ', h('b', {}, up), ' and ', h('b', {}, low), '. Build each cell from chromosomes; the engine checks your answer.'),
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
    const s = this.step;
    this.builder.fixedNuclei = !!s.fixed;
    this.builder.maxNuclei = s.maxNuclei ?? 4;
    this.builder.root.visible = !s.list;
    if (!s.list) this.builder.setNuclei(this.answers[s.id] ?? s.start);
    this.renderStepper();
    this.renderBody();
    this.layout();
    this.ctx.panel.scrollTop = 0;
  }

  resize() {
    this.layout();
  }

  layout() {
    const { w, h: hgt } = this.ctx.size();
    const stripH = Math.max(110, Math.min(170, hgt * 0.24));
    const showStrip = ['a', 'b'].includes(this.step.id);
    this.strip.visible = showStrip;
    this.parents.setRect({ x: w * 0.1, y: 22, w: w * 0.8, h: stripH - 22 });
    const top = showStrip ? stripH + 12 : 28;
    this.builder.setRect({ x: 12, y: top, w: w - 24, h: hgt - top - 8 });
  }

  renderBody() {
    const s = this.step;
    const body = clear(this.body);
    body.append(h('div', { class: 'stage-name' }, `Question ${s.id}`), h('h2', {}, s.title), h('p', {}, s.prompt));
    if (s.list) return this.renderList(body);
    this.tools = h('div', { class: 'tools' });
    body.append(
      h('p', { class: 'hint' }, 'Tap a nucleus to choose where new chromosomes go. Tap a chromosome to select it, then tap its chromatids to set alleles. Drag a chromosome to another nucleus, or onto its homolog to pair them.'),
      this.tools,
    );
    this.feedbackEl = h('div', { class: 'feedback' });
    body.append(
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => this.check() }, 'Check'),
        this.prevAnswer() ? h('button', { class: 'btn', onclick: () => this.copyPrevious() }, `Start from my answer to ${this.prevAnswer().id}`) : null,
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
    const nuclei = this.answers[prev.id].map((n, i) => ({ ...n, label: s.fixed ? (s.start[i]?.label ?? '') : '' }));
    const fitted = s.fixed ? s.start.map((st, i) => ({ label: st.label, items: nuclei[i]?.items ?? [] })) : nuclei.slice(0, s.maxNuclei ?? 4);
    this.builder.setNuclei(fitted);
    this.answers[s.id] = this.builder.getNuclei();
  }

  renderTools() {
    if (!this.tools || this.step.list) return;
    const b = this.builder;
    const s = this.step;
    const biv = b.selectedBivalent();
    const selItem = b.selectedItem();
    const tools = clear(this.tools);
    tools.append(
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn small', onclick: () => b.addChromosome(false) }, '+ Chromosome (1 chromatid)'),
        h('button', { class: 'btn small', onclick: () => b.addChromosome(true) }, '+ Replicated chromosome (2 chromatids)'),
      ),
      h(
        'div',
        { class: 'row' },
        s.fixed ? null : h('button', { class: 'btn small', disabled: b.nuclei.length >= b.maxNuclei, onclick: () => b.addNucleus() }, '+ Nucleus'),
        selItem
          ? h('button', { class: 'btn small', onclick: () => b.deleteSelected() }, 'Delete chromosome')
          : s.fixed
            ? null
            : h('button', { class: 'btn small', disabled: !b.canRemoveNucleus(), onclick: () => b.deleteSelected() }, 'Remove nucleus'),
        biv ? h('button', { class: 'btn small', onclick: () => b.unpair() }, 'Unpair') : null,
      ),
    );
    if (s.crossovers) {
      tools.append(
        biv
          ? h(
              'div',
              { class: 'picker' },
              h('div', { class: 'picker-label' }, 'Mark a crossover (X) on this bivalent:'),
              h(
                'div',
                { class: 'row' },
                b.intervals().map((iv) => h('button', { class: 'btn small', onclick: () => b.addCrossover(iv.index) }, `X ${iv.label}`)),
                biv.crossovers.length ? h('button', { class: 'btn small', onclick: () => b.clearCrossovers() }, 'Clear X') : null,
              ),
            )
          : h('p', { class: 'hint' }, 'To mark crossovers, select a paired bivalent.'),
      );
    }
  }

  check() {
    const s = this.step;
    const student = this.builder.getNuclei();
    const result = evaluate(student, s.expected(), { loci: [this.inst.L], matchBy: s.matchBy ?? 'multiset', minCross: s.minCross ?? null });
    this.attempts[s.id] = (this.attempts[s.id] ?? 0) + 1;
    if (result.ok && this.revealed.has(s.id)) {
      this.feedback = { kind: 'good', text: 'That matches the answer you were shown. Use “New problem” to try one on your own.' };
    } else if (result.ok) {
      this.done.add(s.id);
      this.feedback = { kind: 'good', text: this.praise(s) };
      this.renderStepper();
    } else {
      this.feedback = { kind: 'bad', text: explain(s, result.problems[0], this.inst) };
    }
    this.renderFeedback();
  }

  praise(s) {
    return {
      a: 'Right. Each gamete is haploid: one chromosome, one chromatid.',
      b: 'Right. Fertilization restores two homologs, one from each parent, each still a single chromatid.',
      c: 'Right. Each homolog replicated into two identical sisters, and in mitosis they line up without pairing.',
      d: 'Right. Sisters separated, so each daughter is an exact copy of the zygote.',
      e: `Right. The homologs pair as a bivalent. No crossover is needed: the ${this.inst.target} gamete just takes a chromatid from its homolog.`,
      f: 'Right. The homologs went to different cells, each still carrying two sister chromatids.',
      g: 'Right. Four haploid gametes, two carrying each allele.',
    }[s.id];
  }

  renderFeedback() {
    if (!this.feedbackEl) return;
    const s = this.step;
    const el = clear(this.feedbackEl);
    if (!this.feedback) return;
    el.className = `feedback ${this.feedback.kind}`;
    el.append(this.feedback.text);
    if (this.feedback.kind === 'bad' && (this.attempts[s.id] ?? 0) >= 2) {
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
    const { up, low, zygote, L } = this.inst;
    const expected = gameteDistribution(allelesAt(zygote, L));
    if (!this.listRows) this.listRows = [{ g: '', f: '' }];
    const rows = h('div', { class: 'picker' });
    const draw = () => {
      clear(rows);
      this.listRows.forEach((r, i) => {
        const sel = h('select', { class: 'choice', 'aria-label': `Genotype ${i + 1}` }, h('option', { value: '' }, 'genotype…'), [up, low].map((a) => h('option', { value: a, selected: r.g === a }, a)));
        sel.addEventListener('change', () => (r.g = sel.value));
        const freq = h('input', { class: 'choice', type: 'text', value: r.f, placeholder: 'frequency, e.g. 1/4', 'aria-label': `Frequency ${i + 1}` });
        freq.addEventListener('input', () => (r.f = freq.value));
        rows.append(h('div', { class: 'row' }, sel, freq, this.listRows.length > 1 ? h('button', { class: 'btn small', onclick: () => { this.listRows.splice(i, 1); draw(); } }, '✕') : null));
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
          if (!want) problems.push(`This individual cannot make ${r.g} gametes.`);
          else if (Math.abs(parseFrequency(r.f) - want) > 1e-6) problems.push(`The frequency of ${r.g} gametes is off. What fraction of gametes get each homolog?`);
        }
        for (const a of expected.keys()) if (!seen.has(a)) problems.push('A gamete genotype is missing from your list.');
      }
      fb.className = `feedback ${problems.length ? 'bad' : 'good'}`;
      fb.textContent = problems.length
        ? problems[0]
        : `Right: ${[up, low].filter((a) => expected.has(a)).map((a) => `${a} ${fraction(expected.get(a))}`).join(', ')}. Segregation sends each homolog to half the gametes.`;
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
        h('button', { class: 'btn small', onclick: () => { this.listRows.push({ g: '', f: '' }); draw(); } }, '+ Row'),
        h('button', { class: 'btn primary', onclick: checkList }, 'Check'),
      ),
      fb,
    );
  }

  destroy() {
    this.builder.destroy();
    this.parents.destroy();
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
