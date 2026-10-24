// Step D: which kind of allele? Problems one at a time, generated from the seed: which allele is dominant (Exam I
// 2024), classifying an allele from bdellbee genotypes that include a deletion heterozygote, the 2 : 1 ratio among
// the survivors of a recessive lethal cross, and the haplosufficiency sentence (Exam I 2023). Expected answers come
// from js/engine/dominance.js; the canvas shows each problem's bdellbees or table.

import { h, clear } from '../../core/dom.js';
import { QuestionSheet } from '../../core/question-sheet.js';
import { PALETTE } from '../../core/palette.js';
import { stepLetter } from '../registry.js';
import { label } from '../../render/chromosome.js';
import { QUIZ_CATEGORIES, MECHANISMS, evidence, classify, survivors, survivorRatio } from '../../engine/dominance.js';
import { fraction } from '../../engine/cross.js';
import { alleleName, genotypeName, questionRng, SUP, DEL } from './instance.js';
import { genotypeCard, cardRow, text } from './views.js';
import { shuffle } from '../../core/rng.js';

const LETHAL_TEXT = { recessiveLethal: 'No bdellbee develops', dominantLethal: 'No bdellbee survives' };
const LETHAL_CAPTION = { recessiveLethal: 'does not develop', dominantLethal: 'dies young' };

export class QuizStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.items = this.inst.quiz.map((item, i) => ({ ...item, key: `quiz:${i}`, q: this.question(item, i) }));
  }

  // ---- questions ----

  question(item, i) {
    switch (item.type) {
      case 'which-dominant':
        return this.whichDominant(item);
      case 'classify':
        return this.classifyQuestion(item, i);
      case 'lethal-ratio':
        return this.ratioQuestion(item, i);
      case 'lethal-het':
        return this.hetQuestion(item, i);
      case 'sentence':
        return SENTENCE[item.part];
    }
    throw new Error(item.type);
  }

  // The three genotypes of a cancer gene and whether each has increased risk. The heterozygote shares the
  // phenotype of the dominant allele's homozygote.
  riskTable(item) {
    const plus = `${item.gene}${SUP.plus}`;
    const minus = `${item.gene}${SUP.minus}`;
    return [
      { name: `${plus}/${plus}`, risk: false },
      { name: `${plus}/${minus}`, risk: item.dominant === '-' },
      { name: `${minus}/${minus}`, risk: true },
    ].map((r) => ({ ...r, text: r.risk ? 'Increased risk' : 'No increased risk' }));
  }

  whichDominant(item) {
    const g = item.gene;
    const rows = this.riskTable(item);
    const het = rows[1];
    const dom = item.dominant === '+' ? `${g}${SUP.plus}` : `${g}${SUP.minus}`;
    const domHomo = item.dominant === '+' ? rows[0] : rows[2];
    return {
      prompt: `Two genes can cause cancer when mutated. For the ${g} gene, which is the dominant allele?`,
      options: [`${g}${SUP.plus}`, `${g}${SUP.minus}`].map((a) => ({
        label: a,
        correct: a === dom,
        feedback:
          a === dom
            ? `Right. ${het.name} has ${het.text.toLowerCase()}, like ${domHomo.name}: the heterozygote shows the phenotype of ${dom}, so ${dom} is dominant.`
            : `${het.name} has ${het.text.toLowerCase()}, the same as ${domHomo.name}. The dominant allele is the one whose phenotype the heterozygote shows.`,
      })),
    };
  }

  // Names and facts for one problem's gene.
  facts(item) {
    const L = item.letter;
    const name = (g) => genotypeName(L, g);
    return {
      Lm: alleleName(L, 'm'),
      P: name(['+', '+']),
      H: name(['+', 'm']),
      M: name(['m', 'm']),
      D: name(['+', 'Δ']),
      normal: item.trait.normalText,
      mutant: item.trait.mutantText,
    };
  }

  classifyQuestion(item) {
    const ev = evidence(item.mechanism);
    const right = classify(ev);
    const f = this.facts(item);
    const lethal = item.mechanism === 'recessiveLethal' || item.mechanism === 'dominantLethal';
    return {
      prompt: lethal
        ? `Which term best describes the ${f.Lm} allele? Look at which genotypes survive.`
        : `Which term best describes the ${f.Lm} allele?`,
      options: QUIZ_CATEGORIES.map((c) => ({ label: MECHANISMS[c].label, correct: c === right, feedback: classifyFeedback(right, c, f) })),
    };
  }

  ratioQuestion(item) {
    const f = this.facts(item);
    const ratio = survivorRatio('recessiveLethal', ['+', 'm'], ['+', 'm']);
    const { lost, classes } = survivors('recessiveLethal', ['+', 'm'], ['+', 'm']);
    const golden = classes.filter((c) => c.mutant).reduce((s, c) => s + c.p, 0);
    const why = {
      '3 : 1': `3 : 1 counts the ${f.M} zygotes as golden, but they do not develop. Take them away, and the survivors are 2 golden : 1 normal.`,
      '1 : 2 : 1': `1 : 2 : 1 is the genotype ratio of all zygotes (${f.P} : ${f.H} : ${f.M}). Among survivors ${f.M} is missing, and the question asks about body color.`,
      '1 : 1': `1 : 1 is what a cross to ${f.P} gives. Here both parents are ${f.H}.`,
    };
    return {
      prompt: `Two golden bdellbees, both ${f.H}, are crossed. Among the offspring that survive, what is the expected ratio of golden to normal color?`,
      options: shuffle(questionRng(this.inst, 40), ['3 : 1', '2 : 1', '1 : 2 : 1', '1 : 1']).map((r) => ({
        label: r,
        correct: r === ratio,
        feedback:
          r === ratio
            ? `Right. ${fraction(lost)} of the zygotes are ${f.M} and do not develop. Of the survivors, ${fraction(golden)} are ${f.H} (golden) and ${fraction(1 - golden)} are ${f.P} (normal): ${ratio}.`
            : why[r],
      })),
    };
  }

  hetQuestion(item) {
    const f = this.facts(item);
    const { classes } = survivors('recessiveLethal', ['+', 'm'], ['+', 'm']);
    const golden = classes.filter((c) => c.mutant);
    const het = golden.filter((c) => c.g.includes('+')).reduce((s, c) => s + c.p, 0) / golden.reduce((s, c) => s + c.p, 0);
    const answer = het === 1 ? 'All of them' : fraction(het);
    const why = {
      '2/3': `2/3 is the share of all survivors that are ${f.H}. Among the golden ones, every one is ${f.H}, because ${f.M} does not develop.`,
      '1/3': `1/3 of the survivors are ${f.P}, and those have normal color, not golden.`,
      '1/2': `Half of all zygotes are ${f.H}, but the question is about the golden survivors only.`,
    };
    return {
      prompt: `What fraction of the golden survivors are heterozygous (${f.H})?`,
      options: ['1/3', '1/2', '2/3', 'All of them'].map((o) => ({
        label: o,
        correct: o === answer,
        feedback: o === answer ? `Right. A golden bdellbee has at least one ${f.Lm}, and ${f.M} does not develop, so every golden survivor is ${f.H}.` : why[o],
      })),
    };
  }

  // ---- lifecycle and panel ----

  enter(container, body) {
    this.container = container;
    this.body = body;
    this.mod.setStage('Which kind of allele?');
    this.sheet = new QuestionSheet(this.mod, () => this.mod.relayout());
    this.renderPanel();
  }

  exit() {
    this.exited = true;
    this.sheet.moveOn(this.mod.state.seen);
    this.sheet.remove();
  }

  // The first problem the student has not moved past.
  current() {
    return this.items.findIndex((it) => !this.mod.state.seen.has(it.key));
  }

  renderPanel() {
    if (this.exited) return;
    this.sheet.begin();
    this.renderBody(clear(this.body));
    this.sheet.end();
    this.draw();
  }

  renderBody(body) {
    const { answered } = this.mod.state;
    body.append(
      h('h2', {}, `${stepLetter(this.mod.index)}. Which kind of allele?`),
      h(
        'p',
        {},
        `Most problems show the bdellbees for one gene: its normal allele (${SUP.plus}), its mutant allele (${SUP.m}), and ${DEL}, a deletion of the gene with no copy at all. The deletion heterozygote shows what losing one copy does by itself.`,
      ),
    );
    const n = this.items.length;
    const done = this.items.filter((it) => answered.has(it.key)).length;
    body.append(h('p', { class: 'hint' }, `${done} of ${n} answered.`));
    for (const [i, it] of this.items.entries()) {
      const last = i === n - 1;
      const onward = this.mod.continueLabel();
      const proceed = last ? (onward ? [{ label: onward, onClick: () => (this.mod.state.seen.add(it.key), this.mod.complete('quiz'), this.mod.next()) }] : []) : null;
      const shown = this.sheet.ask(body, {
        key: it.key,
        q: it.q,
        state: this.mod.state,
        rerender: () => this.renderPanel(),
        proceed,
        onRight: last ? () => this.mod.complete('quiz') : null,
      });
      if (!shown || last) return;
    }
  }

  // ---- canvas ----

  draw() {
    const layer = this.container;
    layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const { w, h: hgt } = this.mod.size();
    const avail = hgt - this.sheet.space() - 8;
    let i = this.current();
    if (i < 0) i = this.items.length - 1;
    const item = this.items[i];
    const inner = new PIXI.Container();
    layer.addChild(inner);
    const head = text(`Problem ${i + 1} of ${this.items.length}`, 13, { weight: '800', fill: PALETTE.inkSoft });
    head.anchor.set(0.5, 0);
    head.position.set(w / 2, 4);
    inner.addChild(head);
    const top = 30;
    const ctx = { layer: inner, w, top, height: avail - top, answered: this.mod.state.answered.has(item.key) };
    if (item.type === 'which-dominant') this.drawRisk(ctx, item);
    else if (item.type === 'classify') this.drawEvidence(ctx, item);
    else if (item.type === 'lethal-ratio' || item.type === 'lethal-het') this.drawCross(ctx, item);
    else this.drawSentence(ctx);
    const b = inner.getLocalBounds();
    const bottom = b.y + b.height;
    if (bottom > avail && avail > 60) {
      const k = Math.max(0.5, avail / bottom);
      inner.scale.set(k);
      inner.x = (w - w * k) / 2;
    }
  }

  drawRisk(ctx, item) {
    const rows = this.riskTable(item);
    const tw = Math.min(ctx.w - 40, 420);
    const g = new PIXI.Graphics();
    const rh = 40;
    const x0 = ctx.w / 2 - tw / 2;
    const title = text(`The ${item.gene} gene and cancer risk`, 17, { weight: '800' });
    title.anchor.set(0.5, 0);
    title.position.set(ctx.w / 2, ctx.top);
    ctx.layer.addChild(title);
    const t0 = ctx.top + title.height + 10;
    rows.forEach((r, k) => {
      const y = t0 + k * (rh + 6);
      g.roundRect(x0, y, tw, rh, 10).fill(r.risk ? 0xf5e3d9 : 0xe3ecdd).stroke({ width: 1.5, color: r.risk ? PALETTE.clay : PALETTE.sage });
      const gname = label(r.name, 18, { fill: PALETTE.ink, fontWeight: '800' });
      gname.anchor.set(0, 0.5);
      gname.position.set(x0 + 16, y + rh / 2);
      const risk = text(r.text, 15, { weight: '800', fill: r.risk ? 0x9a5a3d : PALETTE.sage });
      risk.anchor.set(1, 0.5);
      risk.position.set(x0 + tw - 16, y + rh / 2);
      ctx.layer.addChild(gname, risk);
    });
    ctx.layer.addChildAt(g, 0);
  }

  drawEvidence(ctx, item) {
    const ev = evidence(item.mechanism);
    const f = this.facts(item);
    const s = Math.max(44, Math.min(84, (ctx.height - 70) / 2.3));
    const cards = ev.map((e) => {
      const name = genotypeName(item.letter, e.g);
      if (!e.survives) return genotypeCard({ genotype: name, features: null, lethalText: LETHAL_TEXT[item.mechanism], caption: LETHAL_CAPTION[item.mechanism], size: s });
      const look = e.mutant ? item.trait.mutant : item.trait.normal;
      const caption = item.mechanism === 'dominantLethal' ? 'survives' : e.mutant ? item.trait.mutantText : item.trait.normalText;
      return genotypeCard({ genotype: name, features: this.inst.features(look), caption, size: s, highlight: e.g[1] === 'Δ' });
    });
    const row = cardRow(cards, ctx.w - 24, Math.max(10, s * 0.25));
    // Ears and antennae reach above a card's top, so the row starts a little lower.
    row.position.set(ctx.w / 2, ctx.top + s * 0.15);
    ctx.layer.addChild(row);
    const key = text(`${alleleName(item.letter, '+')} is the normal allele, ${f.Lm} the mutant allele, and ${DEL} a deletion of the gene. The highlighted bdellbee has lost one copy.`, 13, {
      width: Math.min(ctx.w - 32, 620),
      weight: '700',
      fill: PALETTE.inkSoft,
      align: 'center',
    });
    key.anchor.set(0.5, 0);
    key.position.set(ctx.w / 2, row.y + row.h + 10);
    ctx.layer.addChild(key);
  }

  // Two golden parents, and once the ratio is answered, the four kinds of zygote with the lethal one marked.
  drawCross(ctx, item) {
    const f = this.facts(item);
    const s = Math.max(46, Math.min(80, (ctx.height - 40) / 2.6));
    const golden = this.inst.features(item.trait.mutant);
    const parents = cardRow(
      [genotypeCard({ genotype: f.H, features: golden, caption: 'golden', size: s }), genotypeCard({ genotype: f.H, features: golden, caption: 'golden', size: s })],
      ctx.w - 24,
      s * 0.9,
    );
    parents.position.set(ctx.w / 2, ctx.top);
    const times = text('×', 26, { weight: '800', fill: PALETTE.inkSoft });
    times.anchor.set(0.5);
    times.position.set(ctx.w / 2, ctx.top + s * 0.55);
    ctx.layer.addChild(parents, times);
    if (!this.mod.state.answered.has(this.items.find((it) => it.type === 'lethal-ratio').key)) return;
    // The zygotes, each ¼: the one that does not develop is drawn as an empty outline.
    const zs = [['+', '+'], ['+', 'm'], ['+', 'm'], ['m', 'm']];
    const kids = cardRow(
      zs.map((g) => {
        const mutant = g.includes('m');
        if (g[0] === 'm') return genotypeCard({ genotype: genotypeName(item.letter, g), features: null, caption: '¼, does not develop', size: s * 0.8 });
        return genotypeCard({ genotype: genotypeName(item.letter, g), features: this.inst.features(mutant ? item.trait.mutant : {}), caption: `¼, ${mutant ? 'golden' : 'normal'}`, size: s * 0.8 });
      }),
      ctx.w - 24,
      s * 0.2,
    );
    kids.position.set(ctx.w / 2, ctx.top + parents.h + 16);
    ctx.layer.addChild(kids);
  }

  // The Exam I sentence, with each blank filled in once it is answered.
  drawSentence(ctx) {
    const { answered } = this.mod.state;
    const keys = this.items.filter((it) => it.type === 'sentence').map((it) => it.key);
    const fill = (k, blank, answer) => (answered.has(keys[k]) ? answer : blank);
    const str = `Usually, when an individual is heterozygous for a mutation that destroys the function of a gene, it still shows the wild-type phenotype. In this case, the ${fill(0, '(wild-type / mutant)', 'wild-type')} allele is dominant. This is because ${fill(1, '(one / two)', 'one')} functional copy is enough to provide proper function. The wild-type allele is called ${fill(2, '(haploinsufficient / haplosufficient)', 'haplosufficient')}.`;
    const t = text(str, ctx.w < 520 ? 15 : 18, { width: Math.min(ctx.w - 40, 640), weight: '600' });
    t.anchor.set(0.5, 0);
    t.position.set(ctx.w / 2, ctx.top + 6);
    const cw = t.width + 36;
    const bg = new PIXI.Graphics().roundRect(ctx.w / 2 - cw / 2, ctx.top - 10, cw, t.height + 32, 14).fill(PALETTE.panel).stroke({ width: 1.5, color: PALETTE.line });
    ctx.layer.addChild(bg, t);
  }

  resize() {
    this.draw();
  }
}

// The Exam I 2023 sentence, one blank at a time.
const SENTENCE = [
  {
    prompt: 'In this case, which allele is dominant?',
    options: [
      { label: 'the wild-type allele', correct: true, feedback: 'Right. The heterozygote shows the wild-type phenotype, so the wild-type allele is dominant.' },
      { label: 'the mutant allele', correct: false, feedback: 'The heterozygote shows the wild-type phenotype. The dominant allele is the one whose phenotype the heterozygote shows.' },
    ],
  },
  {
    prompt: 'Why does the heterozygote look wild type? Because how many functional copies are enough?',
    options: [
      { label: 'one', correct: true, feedback: 'Right. The heterozygote has only one working copy, and it looks wild type, so one copy is enough.' },
      { label: 'two', correct: false, feedback: 'The heterozygote has just one functional copy and still looks wild type, so two copies cannot be needed.' },
    ],
  },
  {
    prompt: 'The wild-type allele is called:',
    options: [
      { label: 'haploinsufficient', correct: false, feedback: 'Haploinsufficient means one copy is not enough. Here one copy is enough, so the term is haplosufficient.' },
      { label: 'haplosufficient', correct: true, feedback: 'Right. “Haplo” means one set: one copy is sufficient, so the wild-type allele is haplosufficient.' },
    ],
  },
];

// Feedback for classifying an allele: why the right term fits, or why the chosen one does not, naming genotypes.
function classifyFeedback(right, chosen, f) {
  const lethalFact = right === 'recessiveLethal' ? `${f.M} does not develop, but ${f.H} survives` : `${f.H} does not survive`;
  if (chosen === right) {
    return {
      recessive: `Right. ${f.H} looks like ${f.P} (${f.normal}); only ${f.M} looks mutant (${f.mutant}). One normal copy is enough, so ${f.Lm} is recessive.`,
      haploinsufficient: `Right. ${f.H} already looks mutant (${f.mutant}), and so does ${f.D}: losing one copy is enough. ${f.Lm} is a loss-of-function allele that is dominant because the gene is haploinsufficient.`,
      dominantNegative: `Right. ${f.D}, with one normal copy and no mutant product, looks normal (${f.normal}), so one copy is enough. Yet ${f.H} looks mutant (${f.mutant}): the ${f.Lm} product interferes with the normal one.`,
      recessiveLethal: `Right. ${f.H} survives (and is golden), but ${f.M} does not develop: ${f.Lm} kills only with two copies. For body color, it is dominant.`,
      dominantLethal: `Right. ${f.H} does not survive: one copy of ${f.Lm} kills. Only ${f.P} and ${f.D} survive.`,
    }[right];
  }
  const lethal = right === 'recessiveLethal' || right === 'dominantLethal';
  switch (chosen) {
    case 'recessive':
      if (right === 'recessiveLethal') return `${f.Lm} is recessive for survival, but it is not simply recessive: ${f.H} is golden, so it is dominant for body color. The term that names its effect on survival is recessive lethal: only ${f.M} fails to develop.`;
      if (right === 'dominantLethal') return `${f.H} does not survive, so a single copy has an effect: ${f.Lm} is not recessive.`;
      return `${f.H} already looks mutant (${f.mutant}), so ${f.Lm} is not recessive: a recessive allele is hidden in the heterozygote.`;
    case 'haploinsufficient':
      if (right === 'recessive') return `${f.H} looks like ${f.P} (${f.normal}), so ${f.Lm} is not dominant: its phenotype is hidden in the heterozygote.`;
      if (right === 'dominantNegative') return `${f.D} looks normal (${f.normal}): losing one copy does not cause the phenotype, so the gene is not haploinsufficient. Something about the ${f.Lm} product itself makes ${f.H} mutant.`;
      if (right === 'recessiveLethal') return `${f.Lm} is dominant for body color (${f.H} is golden), but ${f.M} does not develop. The best term includes its effect on survival.`;
      return `${f.H} does not survive. One copy kills, so the better term is dominant lethal.`;
    case 'dominantNegative':
      if (right === 'recessive') return `${f.H} looks normal (${f.normal}), so the ${f.Lm} product does not interfere with the normal one.`;
      if (right === 'haploinsufficient') return `${f.D} looks mutant too (${f.mutant}): losing a copy is enough to cause the phenotype, so no interference is needed. This is haploinsufficiency.`;
      return `Look at survival: ${lethalFact}.`;
    case 'recessiveLethal':
      if (!lethal) return `Every genotype here survives, so ${f.Lm} is not lethal.`;
      return `${f.H} does not survive either, so one copy is enough to kill: dominant lethal.`;
    case 'dominantLethal':
      if (!lethal) return `Every genotype here survives, so ${f.Lm} is not lethal.`;
      return `${f.H} survives (golden); only ${f.M} does not develop. One copy does not kill, so ${f.Lm} is not dominant lethal.`;
  }
  return 'Not quite.';
}
