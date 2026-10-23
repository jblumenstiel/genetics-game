// Step A: walk a cell through meiosis (or mitosis) stage by stage, with checkpoint questions.

import { h, clear, question } from '../../core/dom.js';
import { ChromatidView, CellLayer, SpindleLayer } from '../../render/chromosome.js';
import { meiosis } from '../../engine/meiosis.js';
import { alleleOn } from '../../engine/genome.js';
import { alleleLabel } from '../../engine/phenotype.js';
import { creatureCard } from './instance.js';

const HALF_PI = Math.PI / 2;

function countQuestion(prompt, correct, right, wrong) {
  return {
    prompt,
    options: [1, 2, 4].map((n) => ({
      label: String(n),
      correct: n === correct,
      feedback: n === correct ? right : wrong[n],
    })),
  };
}

const SHARED = {
  G1: {
    id: 'G1',
    name: 'G1',
    title: 'Before DNA replication',
    text: 'The cell holds two homologs of this chromosome, one from each parent (shown in two colors). The band marks the gene and its allele.',
    q: countQuestion(
      'How many chromatids does each chromosome have right now?',
      1,
      'One. An unreplicated chromosome is a single DNA molecule: one chromatid.',
      { 2: 'Not yet. Replication has not happened, so each chromosome is still one DNA molecule.', 4: 'Four would be two replicated homologs together. Each chromosome here is one molecule.' },
    ),
  },
  S: {
    id: 'S',
    name: 'S phase',
    title: 'DNA replication',
    text: 'Each chromosome copies itself. The two copies, sister chromatids, stay joined at the centromere and carry the same allele.',
    q: countQuestion(
      'Replication just finished. How many chromatids does each chromosome have now?',
      2,
      'Two identical sister chromatids, joined at the centromere.',
      { 1: 'Replication doubled the DNA. Look at each chromosome: there are now two strands side by side.', 4: 'Four is the count for both homologs together, not for one chromosome.' },
    ),
  },
};

const MEIOSIS = [
  SHARED.G1,
  SHARED.S,
  {
    id: 'P1',
    name: 'Prophase I',
    title: 'Homologs pair up',
    text: 'Homologous chromosomes find each other and pair along their length. This paired unit is a bivalent.',
    q: countQuestion(
      'The homologs are now paired. How many chromatids does each chromosome have at this moment?',
      2,
      'Two per chromosome, so the bivalent holds four.',
      { 1: 'Replication already happened in S phase, so each chromosome has two sisters.', 4: 'The bivalent has four, but that is two chromosomes. Each chromosome still has two.' },
    ),
  },
  {
    id: 'M1',
    name: 'Metaphase I',
    title: 'Pairs line up on the plate',
    text: 'Spindle fibers attach each homolog to one pole. Which homolog faces which pole is random: a coin flip at every meiosis.',
    interactive: 'Tap the paired chromosomes to flip which homolog faces which pole.',
    // Asked once the student has flipped the pair at least once.
    flipQ: 'orientation',
  },
  {
    id: 'A1',
    name: 'Anaphase I',
    title: 'Homologs separate',
    text: 'The homologs move to opposite poles. Sister chromatids stay together. This separation of the two alleles is Mendel’s law of segregation.',
  },
  {
    id: 'T1',
    name: 'Telophase I',
    title: 'Two cells',
    text: 'The cell divides. Each daughter cell has one homolog, still made of two sister chromatids.',
    q: {
      prompt: 'What does each of these two cells contain?',
      options: [
        { label: 'One copy of the chromosome, made of two sister chromatids', correct: true, feedback: 'Right. The cells are haploid (one copy of each chromosome), but each copy is still replicated.' },
        { label: 'Two copies of the chromosome, one from each parent', feedback: 'That was the starting cell. Meiosis I sent the two homologs to different cells.' },
        { label: 'One chromatid', feedback: 'Not yet. Sister chromatids only separate in Meiosis II.' },
      ],
    },
  },
  {
    id: 'M2',
    name: 'Metaphase II',
    title: 'Sisters line up',
    text: 'In each cell the spindle turns and attaches the two sister chromatids to opposite poles.',
  },
  {
    id: 'A2',
    name: 'Anaphase II',
    title: 'Sisters separate',
    text: 'Sister chromatids pull apart. Each becomes its own chromosome.',
  },
  {
    id: 'T2',
    name: 'Telophase II',
    title: 'Four haploid products',
    text: 'Two divisions turned one diploid cell into four haploid cells, each with one chromatid of this chromosome.',
    q: 'products',
  },
];

const MITOSIS = [
  SHARED.G1,
  SHARED.S,
  {
    id: 'PM',
    name: 'Prophase',
    title: 'Chromosomes condense',
    text: 'In mitosis the homologs do not pair. Each replicated chromosome acts on its own.',
  },
  {
    id: 'MM',
    name: 'Metaphase',
    title: 'Chromosomes line up one by one',
    text: 'Each chromosome lines up on the plate with its two sisters facing opposite poles.',
  },
  {
    id: 'AM',
    name: 'Anaphase',
    title: 'Sisters separate',
    text: 'Sister chromatids move to opposite poles, so each pole gets one copy of every chromosome.',
  },
  {
    id: 'TM',
    name: 'Telophase',
    title: 'Two daughter cells',
    text: 'The cell divides into two.',
    q: {
      prompt: 'What did mitosis produce?',
      options: [
        { label: 'Two genetically identical diploid cells', correct: true, feedback: 'Right. Each daughter got one sister of every chromosome, so both carry the parent’s full genotype.' },
        { label: 'Two identical haploid cells', feedback: 'Count the chromosomes in each daughter: both homologs are there, so the cells are diploid.' },
        { label: 'Four non-identical haploid cells', feedback: 'That is meiosis. Mitosis has one division and keeps both homologs together.' },
      ],
    },
  },
];

export class MeiosisStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.tw = mod.ctx.tween;
    this.app = mod.ctx.app;
    this.mode = 'meiosis';
    this.index = 0;
    this.orient = this.inst.rng() < 0.5 ? 0 : 1;
    this.flips = 0;
    this.answered = mod.state.answered ?? (mod.state.answered = new Set());
  }

  get stages() {
    return this.mode === 'meiosis' ? MEIOSIS : MITOSIS;
  }

  get stage() {
    return this.stages[this.index];
  }

  // G1 and S phase come before either division, so they are named as interphase.
  stageName(s = this.stage) {
    if (s.id === 'G1' || s.id === 'S') return `Interphase: ${s.name}`;
    return `${this.mode === 'meiosis' ? 'Meiosis' : 'Mitosis'}: ${s.name}`;
  }

  title() {
    return this.stageName();
  }

  key(stage) {
    return stage.id === 'G1' || stage.id === 'S' ? stage.id : `${this.mode}:${stage.id}`;
  }

  enter(container, body) {
    this.container = container;
    this.body = body;
    this.cells = new PIXI.Container();
    this.cellLayer = new CellLayer();
    this.spindle = new SpindleLayer();
    this.chromLayer = new PIXI.Container();
    this.hit = new PIXI.Graphics();
    this.hit.eventMode = 'none';
    this.hit.cursor = 'pointer';
    this.hit.on('pointertap', () => this.flip());
    container.addChild(this.cellLayer, this.spindle, this.chromLayer, this.hit);

    this.cellRecs = Array.from({ length: 7 }, () => ({ x: 0, y: 0, rx: 10, ry: 10, alpha: 0 }));
    this.nucleus = { x: 0, y: 0, rx: 10, ry: 10, alpha: 0 };
    this.cellLayer.cells = this.cellRecs;
    this.cellLayer.nuclei = [this.nucleus];

    this.frame = () => this.draw();
    this.app.ticker.add(this.frame);
    const { w, h: hgt } = this.mod.size();
    this.resize(w, hgt);
    this.renderPanel();
  }

  exit() {
    this.app.ticker.remove(this.frame);
    this.card?.destroy();
  }

  resize(w, hgt) {
    const R = Math.max(110, Math.min(w * 0.38, hgt * 0.36));
    const cardSize = Math.max(64, Math.min(104, hgt * 0.16));
    this.g = {
      w,
      h: hgt,
      cx: w / 2,
      cy: Math.max(hgt * 0.56, cardSize * 1.6 + R * 0.95),
      R,
      cw: Math.max(9, Math.min(20, R * 0.065)),
    };
    this.g.scale = (R * 0.78) / this.inst.karyotype[0].length;

    this.card?.destroy();
    this.card = creatureCard(this.inst.meiosisParent, { size: cardSize });
    this.card.container.position.set(Math.max(cardSize * 0.8, w * 0.1), cardSize * 0.75);
    this.container.addChild(this.card.container);

    this.buildViews();
    this.apply(true);
  }

  buildViews() {
    this.chromLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const { trait, locus, karyotype } = this.inst;
    const copies = this.inst.meiosisParent.cell.chromosomes[0].copies;
    this.views = [];
    for (let hIdx = 0; hIdx < 2; hIdx++) {
      for (let s = 0; s < 2; s++) {
        const chromatid = copies[hIdx];
        const v = new ChromatidView(chromatid, karyotype[0], {
          scale: this.g.scale,
          width: this.g.cw,
          loci: [{ locus, text: alleleLabel(trait, alleleOn(chromatid, locus)) }],
          labelSide: s === 0 ? -1 : 1,
        });
        this.chromLayer.addChild(v);
        this.views.push(v);
      }
    }
  }

  // Target layout for a stage: positions for the four chromatids (homolog * 2 + sister), the cell membranes,
  // the nucleus and the spindle.
  targets(id) {
    const { cx, cy, R, cw } = this.g;
    const d = cw * 0.62;
    const D = cw * 1.55;
    const L = this.orient;
    const Rt = 1 - L;
    const views = new Array(4);
    const pair = (hIdx, x, y, rot, sep, { alpha1 = 1, scale = 1 } = {}) => {
      const ox = Math.cos(rot) * sep * scale;
      const oy = Math.sin(rot) * sep * scale;
      views[hIdx * 2] = { x: x - ox, y: y - oy, rotation: rot, alpha: 1, scale };
      views[hIdx * 2 + 1] = { x: x + ox, y: y + oy, rotation: rot, alpha: alpha1, scale };
    };
    const one = (idx, x, y, rot, scale = 1) => {
      views[idx] = { x, y, rotation: rot, alpha: 1, scale };
    };
    const cells = this.cellRecs.map(() => ({ alpha: 0 }));
    const main = { x: cx, y: cy, rx: R, ry: R * 0.9, alpha: 1 };
    const dL = cx - 0.56 * R;
    const dR = cx + 0.56 * R;
    const daughter = (x, ry = 0.66 * R) => ({ x, y: cy, rx: 0.5 * R, ry, alpha: 1 });
    const quarter = (x, y) => ({ x, y, rx: 0.42 * R, ry: 0.31 * R, alpha: 1 });
    const nucleus = { x: cx, y: cy, rx: 0.72 * R, ry: 0.64 * R, alpha: 0 };
    const spindle = { alpha: 0, poles: [], assign: [], plates: [] };
    const sidePoles = [
      { x: cx - 0.9 * R, y: cy },
      { x: cx + 0.9 * R, y: cy },
    ];
    const vPlate = { x1: cx, y1: cy - 0.82 * R, x2: cx, y2: cy + 0.82 * R };

    switch (id) {
      case 'G1':
      case 'S': {
        const sep = id === 'S' ? d : 0;
        const a1 = id === 'S' ? 1 : 0;
        pair(0, cx - 0.3 * R, cy - 0.06 * R, -0.35, sep, { alpha1: a1 });
        pair(1, cx + 0.28 * R, cy + 0.1 * R, 0.4, sep, { alpha1: a1 });
        cells[0] = main;
        nucleus.alpha = 1;
        break;
      }
      case 'P1':
        pair(0, cx - D, cy, 0, d);
        pair(1, cx + D, cy, 0, d);
        cells[0] = main;
        nucleus.alpha = 0.35;
        break;
      case 'M1':
        pair(L, cx - D, cy, 0, d);
        pair(Rt, cx + D, cy, 0, d);
        cells[0] = main;
        Object.assign(spindle, { alpha: 1, poles: sidePoles, assign: this.assignPoles(L, 0, 1), plates: [vPlate] });
        break;
      case 'A1':
        pair(L, cx - 0.55 * R, cy, 0, d);
        pair(Rt, cx + 0.55 * R, cy, 0, d);
        cells[0] = { ...main, rx: 1.12 * R, ry: 0.8 * R };
        Object.assign(spindle, { alpha: 1, poles: sidePoles, assign: this.assignPoles(L, 0, 1) });
        break;
      case 'T1':
        pair(L, dL, cy, 0, d);
        pair(Rt, dR, cy, 0, d);
        cells[0] = { ...main, rx: 1.12 * R, ry: 0.8 * R, alpha: 0 };
        cells[1] = daughter(dL);
        cells[2] = daughter(dR);
        break;
      case 'M2':
      case 'A2':
      case 'T2': {
        const spread = id === 'M2' ? null : 0.34 * R;
        const scale = id === 'T2' ? 0.62 : 1;
        for (const [hIdx, x] of [
          [L, dL],
          [Rt, dR],
        ]) {
          if (spread === null) pair(hIdx, x, cy, HALF_PI, d);
          else {
            one(hIdx * 2, x, cy - spread, HALF_PI, scale);
            one(hIdx * 2 + 1, x, cy + spread, HALF_PI, scale);
          }
        }
        if (id === 'T2') {
          cells[1] = { ...daughter(dL, 0.74 * R), alpha: 0 };
          cells[2] = { ...daughter(dR, 0.74 * R), alpha: 0 };
          cells[3] = quarter(dL, cy - 0.36 * R);
          cells[4] = quarter(dL, cy + 0.36 * R);
          cells[5] = quarter(dR, cy - 0.36 * R);
          cells[6] = quarter(dR, cy + 0.36 * R);
        } else {
          cells[1] = daughter(dL, id === 'A2' ? 0.74 * R : 0.66 * R);
          cells[2] = daughter(dR, id === 'A2' ? 0.74 * R : 0.66 * R);
          const poles = [
            { x: dL, y: cy - 0.6 * R },
            { x: dL, y: cy + 0.6 * R },
            { x: dR, y: cy - 0.6 * R },
            { x: dR, y: cy + 0.6 * R },
          ];
          const assign = [];
          assign[L * 2] = 0;
          assign[L * 2 + 1] = 1;
          assign[Rt * 2] = 2;
          assign[Rt * 2 + 1] = 3;
          const plates =
            id === 'M2'
              ? [
                  { x1: dL - 0.42 * R, y1: cy, x2: dL + 0.42 * R, y2: cy },
                  { x1: dR - 0.42 * R, y1: cy, x2: dR + 0.42 * R, y2: cy },
                ]
              : [];
          Object.assign(spindle, { alpha: 1, poles, assign, plates });
        }
        break;
      }
      case 'PM':
        pair(0, cx - 0.3 * R, cy, 0, d);
        pair(1, cx + 0.3 * R, cy, 0, d);
        cells[0] = main;
        nucleus.alpha = 0.35;
        break;
      case 'MM':
      case 'AM':
      case 'TM': {
        const scale = 0.66;
        const ys = [cy - 0.34 * R, cy + 0.36 * R];
        for (let hIdx = 0; hIdx < 2; hIdx++) {
          if (id === 'MM') pair(hIdx, cx, ys[hIdx], 0, d, { scale });
          else {
            const off = id === 'AM' ? 0.52 * R : 0.56 * R;
            one(hIdx * 2, cx - off, ys[hIdx], 0, scale);
            one(hIdx * 2 + 1, cx + off, ys[hIdx], 0, scale);
          }
        }
        if (id === 'TM') {
          cells[0] = { ...main, rx: 1.12 * R, ry: 0.8 * R, alpha: 0 };
          cells[1] = daughter(dL, 0.8 * R);
          cells[2] = daughter(dR, 0.8 * R);
        } else {
          cells[0] = id === 'AM' ? { ...main, rx: 1.12 * R, ry: 0.8 * R } : main;
          Object.assign(spindle, { alpha: 1, poles: sidePoles, assign: [0, 1, 0, 1], plates: id === 'MM' ? [vPlate] : [] });
        }
        break;
      }
    }
    return { views, cells, nucleus, spindle };
  }

  // Both sisters of homolog `left` go to pole a, the other homolog's to pole b.
  assignPoles(left, a, b) {
    const out = [];
    out[left * 2] = a;
    out[left * 2 + 1] = a;
    out[(1 - left) * 2] = b;
    out[(1 - left) * 2 + 1] = b;
    return out;
  }

  apply(instant = false, duration = 900) {
    const t = this.targets(this.stage.id);
    const tw = this.tw;
    const go = (target, props) => {
      if (instant) Object.assign(target, props);
      else {
        tw.kill(target);
        tw.to(target, props, { duration });
      }
    };
    this.views.forEach((v, i) => {
      const p = t.views[i];
      go(v, { x: p.x, y: p.y, rotation: p.rotation, alpha: p.alpha });
      go(v.scale, { x: p.scale, y: p.scale });
    });
    this.cellRecs.forEach((rec, i) => go(rec, t.cells[i]));
    go(this.nucleus, t.nucleus);
    Object.assign(this.spindle, { poles: t.spindle.poles, assign: t.spindle.assign, plates: t.spindle.plates });
    go(this.spindle.state, { alpha: t.spindle.alpha });

    const { cx, cy, R, cw } = this.g;
    const interactive = this.stage.id === 'M1';
    this.hit.clear();
    if (interactive) this.hit.rect(cx - 4.5 * cw, cy - 0.45 * R, 9 * cw, 0.95 * R).fill({ color: 0xffffff, alpha: 0.001 });
    this.hit.eventMode = interactive ? 'static' : 'none';
  }

  draw() {
    this.cellLayer.render();
    this.spindle.fibers = this.spindle.assign
      .map((p, i) => (p == null ? null : [this.spindle.poles[p], this.views[i]]))
      .filter((f) => f && f[0]);
    this.spindle.render();
    for (const v of this.views) {
      v.uprightLabels();
      v.avoidNeighbors(this.views);
    }
  }

  flip() {
    this.orient = 1 - this.orient;
    this.flips++;
    this.apply(false, 450);
    this.renderPanel();
  }

  goTo(i) {
    this.index = i;
    this.apply();
    if (this.stage.id === 'T2') this.recordGametes();
    this.renderPanel();
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.index = 0;
    this.apply(true);
    this.renderPanel();
  }

  restart() {
    this.orient = this.inst.rng() < 0.5 ? 0 : 1;
    this.flips = 0;
    this.index = 0;
    this.apply(true);
    this.renderPanel();
  }

  // Run the same meiosis through the engine so later steps use real products.
  recordGametes() {
    const { products } = meiosis(this.inst.meiosisParent.cell, this.inst.rng, { crossingOver: false, orientation: { 0: this.orient } });
    this.mod.state.meiosisProducts = products;
  }

  productsQuestion() {
    const [a, b] = this.inst.meiosisParent.alleles;
    const het = a !== b;
    const al = (x) => alleleLabel(this.inst.trait, x);
    return {
      prompt: 'How do the four products compare at this gene?',
      options: [
        {
          label: `All four carry the same allele`,
          correct: !het,
          feedback: het ? `Look at the labels: the two homologs carried ${al(a)} and ${al(b)}, and they went to different cells at Meiosis I.` : `Right. Both homologs carried ${al(a)}, so every product gets it.`,
        },
        {
          label: `Two carry one allele and two carry the other`,
          correct: het,
          feedback: het ? `Right: two ${al(a)} and two ${al(b)}. The alleles segregated at Meiosis I.` : `This parent is homozygous: both homologs carry ${al(a)}.`,
        },
        { label: 'They are two identical diploid cells', feedback: 'That is mitosis. Meiosis has two divisions and ends with four haploid cells.' },
      ],
    };
  }

  // Metaphase I: the orientation of the pair is the coin flip behind every probability that follows.
  orientationQuestion() {
    const [a, b] = this.inst.meiosisParent.alleles;
    const al = (x) => alleleLabel(this.inst.trait, x);
    return {
      prompt: `In any one meiosis, what is the probability that the homolog carrying ${al(a)} faces the left pole?`,
      options: [
        { label: '0', feedback: 'It can face either pole; you just flipped it.' },
        { label: '¼', feedback: `There are only two ways the pair can orient: ${al(a)} on the left, or ${al(b)} on the left.` },
        { label: '½', correct: true, feedback: `Right. The two orientations are equally likely, so it is a coin flip: ½ for ${al(a)} on the left, ½ for ${al(b)} on the left.` },
        { label: '1', feedback: 'Only if the spindle always grabbed the same homolog, and it does not. Flip the pair again.' },
      ],
    };
  }

  canAdvance() {
    const s = this.stage;
    if (s.q && !this.answered.has(this.key(s))) return false;
    if (s.interactive && this.flips === 0) return false;
    if (s.flipQ && !this.answered.has(`${this.key(s)}:flip`)) return false;
    return true;
  }

  renderPanel() {
    this.mod.refreshTitle();
    const s = this.stage;
    const n = this.stages.length;
    const last = this.index === n - 1;
    const body = clear(this.body);

    const { name, label: geno } = this.inst.meiosisParent;
    if (this.mode === 'mitosis') {
      body.append(
        h('div', { class: 'callout' }, h('b', {}, 'Comparing with mitosis'), `The same cell from ${name}, dividing by mitosis instead.`),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => this.setMode('meiosis') }, '◀ Back to meiosis')),
      );
    } else if (this.index === 0) {
      body.append(h('p', {}, `A quick review: follow ${name}’s gene (${geno}) through one meiosis, and watch where the two alleles go.`));
    }
    body.append(
      h('div', { class: 'stage-name' }, `${this.stageName()} · stage ${this.index + 1} of ${n}`),
      h('h2', {}, s.title),
      h('p', {}, s.text),
    );

    if (s.interactive) {
      body.append(
        h(
          'div',
          { class: 'callout' },
          h('b', {}, this.flips ? `Flipped ${this.flips} time${this.flips > 1 ? 's' : ''}` : 'Your turn'),
          this.flips
            ? `Either way is equally likely. Whichever homolog faces the left pole ends up in the two cells on the left.`
            : s.interactive,
        ),
      );
      const k = `${this.key(s)}:flip`;
      if (this.flips && s.flipQ) {
        const q = this.orientationQuestion();
        if (this.answered.has(k)) body.append(h('p', { class: 'hint' }, `✓ ${q.prompt} ½`));
        else
          body.append(
            question({
              ...q,
              onCorrect: () => {
                this.answered.add(k);
                setTimeout(() => this.renderPanel(), 900);
              },
            }),
          );
      }
    }

    const q = s.q === 'products' ? this.productsQuestion() : s.q;
    if (q) {
      const k = this.key(s);
      if (this.answered.has(k)) body.append(h('p', { class: 'hint' }, `✓ ${q.prompt}`));
      else
        body.append(
          question({
            ...q,
            onCorrect: () => {
              this.answered.add(k);
              if (s.id === 'T2') this.mod.complete('meiosis');
              setTimeout(() => this.renderPanel(), 900);
            },
          }),
        );
    }

    const nav = h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn', disabled: this.index === 0, onclick: () => this.goTo(this.index - 1) }, '◀ Back'),
      last
        ? h('button', { class: 'btn', onclick: () => this.restart() }, 'Run it again')
        : h('button', { class: 'btn primary', disabled: !this.canAdvance(), onclick: () => this.goTo(this.index + 1) }, 'Next stage ▶'),
    );
    body.append(nav);

    if (last && this.answered.has(this.key(s)) && this.mode === 'meiosis') {
      const [a, b] = this.inst.meiosisParent.alleles;
      const al = (x) => alleleLabel(this.inst.trait, x);
      body.append(
        h(
          'div',
          { class: 'callout' },
          h('b', {}, 'Segregation is a coin flip'),
          `The two alleles separated at Meiosis I, so each product carries one allele, ${al(a)} or ${al(b)}. Which product gets which depended on the coin flip at Metaphase I. Pick any one product at random, and it carries ${al(a)} with probability ½ and ${al(b)} with probability ½. Every gamete in the rest of this module starts from that ½.`,
        ),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => this.mod.next() }, 'Continue: B. Gametes ▶'), h('button', { class: 'btn', onclick: () => this.setMode('mitosis') }, 'Compare with mitosis')),
      );
    }
  }
}
