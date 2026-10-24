// Step E: open reflections on codominance and on the phenotype as a human construct. Not graded: the student writes,
// then can show a model answer to compare. Each reflection has a picture on the canvas.

import { h, clear } from '../../core/dom.js';
import { QuestionSheet } from '../../core/question-sheet.js';
import { PALETTE } from '../../core/palette.js';
import { stepLetter } from '../registry.js';
import { label } from '../../render/chromosome.js';
import { dose } from '../../engine/dominance.js';
import { WHITE } from './instance.js';
import { genotypeCard, cardRow, dosageBars, gel, text } from './views.js';

const REFLECTIONS = [
  {
    id: 'verdicts',
    title: 'One gene, three verdicts',
    prompt: (inst) => {
      const P = inst.pigment;
      return `The same three genotypes show complete dominance by eye, incomplete dominance by pigment amount, and codominance on a protein gel. Which one is the real dominance relationship between ${P} and ${P.toLowerCase()}? What does that tell you about the word “dominant”?`;
    },
    model: (inst) => {
      const P = inst.pigment;
      const p = P.toLowerCase();
      return `Each verdict is right for its own phenotype. By eye, ${P}/${p} looks like ${P}/${P}, so ${P} is completely dominant for “pigmented or not”. Measured as pigment amount, ${P}/${p} is halfway, so for “how much pigment” the alleles show incomplete dominance. On a gel, ${P}/${p} has both protein forms, so for “which proteins are present” they are codominant. Dominance is not a property of an allele by itself: it is a relationship between two alleles for one phenotype, measured one way. “${P} is dominant” is shorthand for “${P} is dominant for pigmentation judged by eye”.`;
    },
    draw: drawVerdicts,
  },
  {
    id: 'sickle',
    title: 'Sickle cell: one allele, many relationships',
    prompt: () => 'Is the sickle-cell allele (Hbˢ) dominant or recessive?',
    model: () =>
      'It depends on the phenotype. For anemia, Hbˢ is recessive: only Hbˢ/Hbˢ people are anemic. For sickling of red cells at low oxygen, heterozygotes are in between: incomplete dominance. For resistance to malaria, heterozygotes are protected, so Hbˢ is dominant for that phenotype. On a gel, heterozygotes show both hemoglobins, so the alleles are codominant. One allele has four relationships, and the question has no answer until you say which phenotype you mean.',
    draw: drawSickle,
  },
  {
    id: 'abo',
    title: 'ABO blood groups',
    prompt: () => 'Iᴬ and Iᴮ are codominant with each other, yet each is dominant to i. Can an allele be called “dominant” on its own?',
    model: () =>
      'No. Dominance always compares two alleles in a heterozygote, for a stated phenotype. Iᴬ is dominant to i (Iᴬ/i is type A) but codominant with Iᴮ (Iᴬ/Iᴮ is type AB). So “Iᴬ is dominant” leaves out two things: dominant to which allele, and for which trait? A gene with many alleles can have an allele that is dominant to some, recessive to others, and codominant with others.',
    draw: drawAbo,
  },
  {
    id: 'construct',
    title: 'The phenotype is a human construct',
    prompt: () =>
      'Who decides what counts as a phenotype? Think about which traits get names, where the lines between classes are drawn, at what level we look (molecule, cell or whole organism), and under what conditions. How do these choices change what we call dominant or recessive?',
    model: () =>
      'People decide. We name the traits we notice or can measure; we draw lines between classes on traits that vary continuously; we choose to look at the whole organism, its cells or its molecules; and we look under particular conditions (resistance to malaria matters only where there is malaria). The alleles and their products are physical, but “dominant” and “recessive” describe how our chosen description of the phenotype sorts the genotypes. Change the description, as with the bdellbees above, and the same genotypes can show complete dominance, incomplete dominance or codominance. The terms stay useful as long as we say which phenotype we mean.',
    draw: drawConstruct,
  },
];

export class ReflectStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.s = mod.state.reflect ??= { i: 0, notes: {}, shown: {} };
  }

  get r() {
    return REFLECTIONS[this.s.i];
  }

  enter(container, body) {
    this.container = container;
    this.body = body;
    this.mod.setStage('Reflections');
    this.sheet = new QuestionSheet(this.mod, () => this.mod.relayout());
    this.show(this.s.i);
  }

  exit() {
    this.exited = true;
    this.sheet.remove();
  }

  show(i) {
    this.s.i = i;
    const last = i === REFLECTIONS.length - 1;
    if (last) this.mod.complete('reflect');
    this.mod.setNav(
      [
        i > 0 ? { label: '◀ Back', onClick: () => this.show(i - 1) } : null,
        last ? { label: 'Return to main page', primary: true, onClick: () => (location.hash = '#/') } : { label: 'Next ▶', primary: true, onClick: () => this.show(i + 1) },
      ].filter(Boolean),
      `${i + 1} of ${REFLECTIONS.length}`,
    );
    this.renderPanel();
  }

  renderPanel() {
    if (this.exited) return;
    const r = this.r;
    const body = clear(this.body);
    body.append(
      h('h2', {}, `${stepLetter(this.mod.index)}. Reflections`),
      h('p', { class: 'hint' }, 'These are open questions with no single right answer. Write your thoughts on the main page, then compare them with a model answer.'),
      h(
        'ol',
        { class: 'page-list' },
        REFLECTIONS.map((x, k) => h('li', {}, h('button', { class: k === this.s.i ? 'current' : this.s.shown[x.id] ? 'done' : '', type: 'button', onclick: () => this.show(k) }, x.title))),
      ),
    );
    if (this.s.shown[r.id]) body.append(h('div', { class: 'answered' }, h('p', { class: 'hint' }, h('b', {}, 'Model answer. '), r.model(this.inst))));
    this.renderSheet();
    this.draw();
  }

  // The reflection on the main page: the prompt, a box to write in, and the model answer once shown.
  renderSheet() {
    const r = this.r;
    const area = h('textarea', { class: 'reflect-box', rows: 4, placeholder: 'Write your thoughts here…', 'aria-label': 'Your reflection' });
    area.value = this.s.notes[r.id] ?? '';
    area.addEventListener('input', () => (this.s.notes[r.id] = area.value));
    const shown = this.s.shown[r.id];
    this.sheet.showForm(
      h('p', { class: 'prompt' }, r.prompt(this.inst)),
      area,
      shown
        ? h('div', { class: 'feedback good model-answer' }, h('b', {}, 'A model answer: '), r.model(this.inst))
        : h(
            'div',
            { class: 'row sheet-next' },
            h(
              'button',
              {
                class: 'btn',
                type: 'button',
                onclick: () => {
                  this.s.shown[r.id] = true;
                  this.renderPanel();
                },
              },
              'Show a model answer',
            ),
          ),
    );
  }

  draw() {
    const layer = this.container;
    layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const { w, h: hgt } = this.mod.size();
    const avail = hgt - this.mod.barSpace() - this.sheet.space() - 8;
    const inner = new PIXI.Container();
    layer.addChild(inner);
    const title = text(this.r.title, w < 520 ? 17 : 20, { weight: '600', display: true, width: w - 40, align: 'center' });
    title.anchor.set(0.5, 0);
    title.position.set(w / 2, 4);
    inner.addChild(title);
    this.r.draw({ layer: inner, inst: this.inst, w, top: title.height + 16, height: avail - title.height - 16, revealed: !!this.s.shown[this.r.id] });
    const b = inner.getLocalBounds();
    const bottom = b.y + b.height;
    if (bottom > avail && avail > 60) {
      const k = Math.max(0.45, avail / bottom);
      inner.scale.set(k);
      inner.x = (w - w * k) / 2;
    }
  }

  resize() {
    this.draw();
  }
}

// The pigment gene by eye, by pigment amount, and on a gel (the p allele makes a shorter, broken protein).
function drawVerdicts(ctx) {
  const P = ctx.inst.pigment;
  const p = P.toLowerCase();
  const gs = [
    { name: `${P}/${P}`, g: ['+', '+'] },
    { name: `${P}/${p}`, g: ['+', 'm'] },
    { name: `${p}/${p}`, g: ['m', 'm'] },
  ];
  const s = Math.max(44, Math.min(70, ctx.height * 0.16));
  const row = cardRow(
    gs.map((x) => genotypeCard({ genotype: x.name, features: ctx.inst.features(dose(x.g) > 0 ? {} : { bodyColor: WHITE }), caption: dose(x.g) > 0 ? 'pigmented' : 'white', size: s })),
    ctx.w - 24,
    s * 0.4,
  );
  row.position.set(ctx.w / 2, ctx.top);
  ctx.layer.addChild(row);
  const tag = (str, x, y) => {
    const t = text(str, 13, { weight: '800', fill: PALETTE.inkSoft });
    t.anchor.set(0.5, 0);
    t.position.set(x, y);
    ctx.layer.addChild(t);
    return t.height;
  };
  const eyeH = tag('By eye: complete dominance', ctx.w / 2, ctx.top + row.h + 2);
  const y0 = ctx.top + row.h + eyeH + 14;
  const side = ctx.w >= 620;
  const pw = side ? Math.min(300, ctx.w / 2 - 30) : Math.min(ctx.w - 40, 320);
  const ph = 120;
  const bars = dosageBars({ bars: gs.map((x) => ({ label: x.name, value: dose(x.g), color: ctx.inst.shadeFor(Math.max(0.25, dose(x.g))) })), width: pw, height: ph });
  const lanes = gel(
    [
      { label: `${P}/${P}`, bands: [{ y: 0.15, strength: 1 }] },
      { label: `${P}/${p}`, bands: [{ y: 0.15, strength: 0.55 }, { y: 0.7, strength: 0.55 }] },
      { label: `${p}/${p}`, bands: [{ y: 0.7, strength: 1 }] },
    ],
    pw,
    ph,
  );
  if (side) {
    bars.position.set(ctx.w / 2 - pw - 20, y0);
    lanes.position.set(ctx.w / 2 + 20 + pw / 2, y0);
    ctx.layer.addChild(bars, lanes);
    tag('Pigment amount: incomplete dominance', ctx.w / 2 - 20 - pw / 2, y0 + ph + 4);
    tag('Protein gel: codominance', ctx.w / 2 + 20 + pw / 2, y0 + ph + 4);
  } else {
    bars.position.set(ctx.w / 2 - pw / 2, y0);
    ctx.layer.addChild(bars);
    const h1 = tag('Pigment amount: incomplete dominance', ctx.w / 2, y0 + ph + 4);
    const y1 = y0 + ph + h1 + 14;
    lanes.position.set(ctx.w / 2, y1);
    ctx.layer.addChild(lanes);
    tag('Protein gel: codominance', ctx.w / 2, y1 + ph + 4);
  }
}

// A table drawn on the canvas: header row and rows of cells; the last column can wait until the answer is shown.
function drawTable(ctx, header, rows, { hideLast = false } = {}) {
  const narrow = ctx.w < 600;
  const fs = narrow ? 12 : 14;
  const tw = Math.min(ctx.w - 24, 760);
  const cols = header.length;
  const first = tw * (narrow ? 0.3 : 0.32);
  const rest = (tw - first) / (cols - 1);
  const x0 = ctx.w / 2 - tw / 2;
  const g = new PIXI.Graphics();
  ctx.layer.addChild(g);
  let y = ctx.top;
  const line = (cells, bold, fill) => {
    const ts = cells.map((c, k) => {
      const t = text(c, fs, { width: (k === 0 ? first : rest) - 10, weight: bold ? '800' : '600', fill, align: k === 0 ? 'left' : 'center' });
      t.anchor.set(k === 0 ? 0 : 0.5, 0);
      t.position.set(k === 0 ? x0 + 6 : x0 + first + rest * (k - 1) + rest / 2, y + 6);
      return t;
    });
    const hgt = Math.max(...ts.map((t) => t.height)) + 12;
    ctx.layer.addChild(...ts);
    g.moveTo(x0, y + hgt).lineTo(x0 + tw, y + hgt).stroke({ width: 1, color: PALETTE.line });
    y += hgt;
  };
  line(header, true, PALETTE.ink);
  for (const r of rows) line(hideLast ? [...r.slice(0, -1), '?'] : r, false, PALETTE.ink);
  return y;
}

function drawSickle(ctx) {
  drawTable(
    ctx,
    ['Phenotype', 'Hbᴬ/Hbᴬ', 'Hbᴬ/Hbˢ', 'Hbˢ/Hbˢ', 'Relationship'],
    [
      ['Anemia', 'none', 'none', 'anemia', 'Hbˢ recessive'],
      ['Red cells sickle at low oxygen', 'no', 'some', 'many', 'incomplete'],
      ['Resistance to malaria', 'no', 'yes', 'yes', 'Hbˢ dominant'],
      ['Hemoglobin on a gel', 'A', 'A and S', 'S', 'codominant'],
    ],
    { hideLast: !ctx.revealed },
  );
}

function drawAbo(ctx) {
  drawTable(
    ctx,
    ['Genotype', 'Iᴬ/Iᴬ', 'Iᴬ/i', 'Iᴮ/Iᴮ', 'Iᴮ/i', 'Iᴬ/Iᴮ', 'i/i'],
    [
      ['Blood type', 'A', 'A', 'B', 'B', 'AB', 'O'],
      ['Sugars on red cells', 'A', 'A', 'B', 'B', 'A and B', 'neither'],
    ],
  );
}

// Seven bdellbees with pigment amounts from none to full, sorted two ways: by eye (colored or not) and by shade.
function drawConstruct(ctx) {
  const n = 7;
  const s = Math.max(30, Math.min(56, (ctx.w - 40) / n / 1.7));
  const doses = Array.from({ length: n }, (_, i) => i / (n - 1));
  const row = cardRow(
    doses.map((d) => genotypeCard({ genotype: `${Math.round(d * 100)}%`, features: ctx.inst.features({ bodyColor: ctx.inst.shadeFor(d) }), size: s })),
    ctx.w - 24,
    s * 0.2,
  );
  row.position.set(ctx.w / 2, ctx.top);
  ctx.layer.addChild(row);
  const g = new PIXI.Graphics();
  ctx.layer.addChild(g);
  const span = (row.width ?? 0) || ctx.w - 60;
  const left = ctx.w / 2 - span / 2;
  const bracket = (from, to, y, str) => {
    const x0 = left + span * from;
    const x1 = left + span * to;
    g.moveTo(x0 + 3, y).lineTo(x0 + 3, y + 8).lineTo(x1 - 3, y + 8).lineTo(x1 - 3, y).stroke({ width: 2, color: PALETTE.sage });
    const t = label(str, 12, { fill: PALETTE.sage, fontWeight: '800' });
    t.anchor.set(0.5, 0);
    t.position.set((x0 + x1) / 2, y + 11);
    ctx.layer.addChild(t);
  };
  const y1 = ctx.top + row.h + 10;
  const a = text('Two classes, by eye:', 13, { weight: '800', fill: PALETTE.inkSoft });
  a.position.set(left, y1);
  ctx.layer.addChild(a);
  bracket(0, 1 / n, y1 + a.height + 2, 'white');
  bracket(1 / n, 1, y1 + a.height + 2, 'colored');
  const y2 = y1 + a.height + 40;
  const b = text('Three classes, by shade:', 13, { weight: '800', fill: PALETTE.inkSoft });
  b.position.set(left, y2);
  ctx.layer.addChild(b);
  bracket(0, 2 / n, y2 + b.height + 2, 'pale');
  bracket(2 / n, 5 / n, y2 + b.height + 2, 'medium');
  bracket(5 / n, 1, y2 + b.height + 2, 'dark');
}
