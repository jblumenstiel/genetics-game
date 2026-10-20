// Module 0: Build the cell. Students construct nuclei (chromosomes, chromatids, alleles) through fertilization,
// mitosis and meiosis for one autosomal gene with two alleles in a diploid, and the engine grades every answer.
// No creatures and no phenotypes: just named alleles.
//
// The student chooses the parents' genotypes in question a. The egg and sperm they build make the zygote that
// questions b to h follow, unless they pick a different genotype to follow.

import { h, clear } from '../../core/dom.js';
import { unitLabel } from '../registry.js';
import { makeRng, pick, int } from '../../core/rng.js';
import { PALETTE } from '../../core/palette.js';
import { haplotype, diploid, chromosome, makeCell, allelesAt } from '../../engine/genome.js';
import { meiosis } from '../../engine/meiosis.js';
import { gameteDistribution, fraction } from '../../engine/cross.js';
import { nucleusFromCell, metaphaseIINuclei, gameteNuclei, evaluate, minCrossovers, parseFrequency } from '../../engine/drawing.js';
import { genotypeOptions, zygoteFromParents, IMPOSSIBLE_NOTE } from '../../engine/genotypes.js';
import { label as textLabel } from '../../render/chromosome.js';
import { CellBuilder } from '../../builder/cell-builder.js';
import { Creature } from '../../render/creature.js';
import { SPECIES, TRAITS, creatureFeatures } from '../../species/catalog.js';
import { allGenotypes } from '../../engine/cross.js';

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
    this.parentNotes = {}; // a parent option the student picked that is impossible, with its reason
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
        this.renderArrangement();
      },
    });
    this.lockNote = new PIXI.Container();
    this.lockNote.visible = false;
    this.scene.addChild(this.lockNote);
    // A question shown above the cell before its nuclei appear (question f: how many nuclei after meiosis I?).
    this.nucleiBar = new PIXI.Container();
    this.scene.addChild(this.nucleiBar);
    this.nucleiPick = {}; // step id -> number chosen
    this.nucleiOk = new Set(); // step ids answered correctly
    this.introLayer = new PIXI.Container();
    this.scene.addChild(this.introLayer);
    this.birthLayer = new PIXI.Container();
    this.scene.addChild(this.birthLayer);
    this.birthToken = 0;

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
        id: 'intro',
        title: 'Intro',
        intro: true,
        prompt: () => '',
      },
      {
        id: 'a',
        title: 'Egg and sperm',
        prompt: () =>
          `This is a diploid organism, and gene ${this.inst.L} is autosomal (it is not on a sex chromosome). Keep the parents’ genotypes below or choose your own, then choose a zygote genotype these parents could produce. Then build the egg and the sperm that would make it: in each, show the chromosomes, the correct number of chromatids, and the allele on every chromatid. The rest of the exercise follows the zygote you choose.`,
        start: [{ label: 'Egg' }, { label: 'Sperm', shape: 'sperm' }],
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
        title: 'Mitosis: Metaphase',
        prompt: () => 'The zygote is in mitosis. Build its nucleus at metaphase, then choose how the chromosomes are arranged on the metaphase plate.',
        start: [{ label: 'Zygote at metaphase' }],
        fixed: true,
        metaphase: true,
        arrangement: 'plate',
        anaphase: 'sisters',
        expected: () => [nucleusFromCell(d().zygote, { replicated: true })],
      },
      {
        id: 'd',
        title: 'Mitosis: Daughter cells',
        prompt: () => 'Mitosis has finished, giving two daughter cells. Build the nucleus of each daughter cell: the chromosomes, the correct number of chromatids, and the allele on every chromatid.',
        start: [{ label: 'Daughter cell 1' }, { label: 'Daughter cell 2' }],
        fixed: true,
        expected: () => [nucleusFromCell(d().zygote), nucleusFromCell(d().zygote)],
      },
      {
        id: 'e',
        title: 'Meiosis: Metaphase I',
        prompt: () =>
          `One of this individual’s germline stem cells enters meiosis. It will eventually produce a gamete with genotype ${d().target}. Build the nucleus at metaphase I and choose how the chromosomes are arranged on the metaphase plate.`,
        start: [{ label: 'Metaphase I' }],
        fixed: true,
        metaphase: true,
        arrangement: 'paired',
        anaphase: 'homologs',
        // Crossing over comes later; to bring it back, add `crossovers: true` and `minCross: () => d().minCross`.
        expected: () => [nucleusFromCell(d().zygote, { replicated: true, paired: true })],
      },
      {
        id: 'f',
        title: 'Meiosis: Metaphase II',
        prompt: () => 'Meiosis I has finished. First say how many nuclei there are, then build each nucleus at metaphase II and choose how the chromosomes are arranged on the metaphase plate.',
        start: [{ label: 'Nucleus 1' }, { label: 'Nucleus 2' }],
        fixed: true,
        // Answered above the cell before the nuclei appear.
        nucleiQuestion: {
          text: 'After Meiosis I, there are how many nuclei?',
          options: [1, 2],
          answer: 2,
          wrong: 'Incorrect. Meiosis I divides one cell into two: the homologs went to opposite poles, so there are two nuclei.',
          right: 'Correct: two nuclei, one at each pole of the meiosis I spindle. Build each one at metaphase II.',
        },
        metaphase: true,
        arrangement: 'plate',
        anaphase: 'sisters',
        expected: () => metaphaseIINuclei(d().result),
      },
      {
        id: 'g',
        title: 'Meiosis: Gametes',
        prompt: () => 'Meiosis has finished. First say how many gametes there are, then build the nucleus of each gamete.',
        start: [{ label: 'Gamete 1' }, { label: 'Gamete 2' }, { label: 'Gamete 3' }, { label: 'Gamete 4' }],
        fixed: true,
        nucleiQuestion: {
          text: 'After Meiosis II, how many gametes are there?',
          options: [1, 2, 4],
          answer: 4,
          wrong: {
            1: 'Incorrect. Meiosis has two divisions, and each one splits every cell in two, so one cell becomes more than one gamete.',
            2: 'Incorrect. Two is the count after Meiosis I. Meiosis II then splits each of those two cells again.',
          },
          right: 'Correct: Meiosis I makes two cells and Meiosis II splits each again, giving four gametes. Build each one.',
        },
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
        h('div', { class: 'eyebrow' }, `Module ${entry.n} · ${unitLabel(entry.unit)}`),
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
      h('div', { class: 'panel-foot' }, h('span', {}, `Seed ${this.ctx.seed}`), (this.footBtn = h('button', { class: 'btn small' }, 'New problem'))),
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
            s.intro ? s.title : `${s.id}. ${s.title}`,
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
    this.builder.metaphase = !!s.metaphase;
    this.builder.root.visible = !s.list && !s.intro && this.nucleiShown(s);
    this.introLayer.visible = !!s.intro;
    this.stopBirth();
    const last = i === this.steps.length - 1;
    this.footBtn.textContent = last ? 'Return to main page' : 'New problem';
    this.footBtn.onclick = last ? () => this.goHome() : () => this.ctx.newSeed();
    if (!s.list && !s.intro) this.builder.setNuclei(this.answers[s.id] ?? s.start);
    this.applyLock();
    this.renderStepper();
    this.renderBody();
    this.layout();
    this.ctx.panel.scrollTop = 0;
    if (s.id === 'a' && !this.demoSeen()) setTimeout(() => this.playDemo(), 500);
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
    if (this.step.list || this.step.intro || this.destroyed) return;
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

  nucleiShown(s = this.step) {
    return !s.nucleiQuestion || this.nucleiOk.has(s.id);
  }

  pickNuclei(n) {
    const s = this.step;
    this.nucleiPick[s.id] = n;
    if (n === s.nucleiQuestion.answer) {
      this.nucleiOk.add(s.id);
      this.builder.root.visible = true;
      this.builder.setNuclei(this.answers[s.id] ?? s.start);
    }
    this.layout();
    this.renderBody();
  }

  goHome() {
    location.hash = '#/';
  }

  // ---- celebration after the gamete list ----

  stopBirth() {
    this.birthToken++;
    this.birth = null;
    if (this.birthFrame) this.ctx.tween.ticker.remove(this.birthFrame);
    this.birthFrame = null;
    this.birthLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
  }

  // An egg and a sperm, each carrying a gamete genotype this individual can make, meet and begin to fuse; then a
  // new bdellbee appears. Picks are random; the creature's genotype is not shown.
  playBirth(gametes) {
    this.stopBirth();
    const any = (list) => list[Math.floor(Math.random() * list.length)];
    const species = any(Object.values(SPECIES));
    const trait = any(Object.values(TRAITS));
    this.birth = {
      egg: any(gametes),
      sperm: any(gametes),
      features: creatureFeatures(species, [trait.express(any(allGenotypes(trait)))]),
      done: false,
    };
    this.animateBirth(false);
  }

  async animateBirth(instant) {
    const b = this.birth;
    if (!b) return;
    const token = ++this.birthToken;
    const alive = () => token === this.birthToken && !this.destroyed;
    const tw = this.ctx.tween;
    if (this.birthFrame) tw.ticker.remove(this.birthFrame);
    const layer = this.birthLayer;
    layer.removeChildren().forEach((c) => c.destroy({ children: true }));

    const { w, h: hgt } = this.ctx.size();
    const kid = Math.max(70, Math.min(110, hgt * 0.17));
    const R = Math.max(45, Math.min(w * 0.15, (hgt - 90 - kid * 1.5) / 2.2));
    const ex = w * 0.36;
    const ey = 70 + R + 10;
    const headRx = R * 0.8;
    const headRy = R * 0.58;
    const contactX = ex + R + headRx - R * 0.12;

    // A gamete's single chromosome, labeled with its allele.
    const chromosomeWithAllele = (x, y, len, allele, color) => {
      const c = new PIXI.Container();
      const wd = Math.max(8, len * 0.2);
      c.addChild(new PIXI.Graphics().roundRect(x - wd / 2, y - len / 2, wd, len, wd / 2).fill(0xeee4d1).stroke({ width: 1.5, color: 0x9d8f78 }));
      c.addChild(new PIXI.Graphics().roundRect(x - wd / 2 - 1, y - wd * 0.6, wd + 2, wd * 1.2, 3).fill(color));
      const t = textLabel(allele, Math.max(12, wd * 0.95), { fill: 0xffffff, fontWeight: '800' });
      t.anchor.set(0.5);
      t.position.set(x, y);
      c.addChild(t);
      return c;
    };
    const colorOf = (allele) => (allele === this.inst.up ? PALETTE.clay : PALETTE.dusk);

    // Egg: the round cell from the start of the module.
    const egg = new PIXI.Container();
    egg.addChild(new PIXI.Graphics().circle(ex, ey, R).fill(PALETTE.nucleus).stroke({ width: 3, color: PALETTE.cellEdge }));
    egg.addChild(chromosomeWithAllele(ex, ey, R * 0.9, b.egg, colorOf(b.egg)));
    const eggLabel = textLabel('Egg', 14, { fill: PALETTE.inkSoft, fontWeight: '800' });
    eggLabel.anchor.set(0.5, 1);
    eggLabel.position.set(ex, ey - R - 6);
    egg.addChild(eggLabel);

    // Sperm: an oval head about the egg's size, and a tail that wiggles as it swims in from the right.
    const sperm = new PIXI.Container();
    sperm.addChild(new PIXI.Graphics().ellipse(0, 0, headRx, headRy).fill(PALETTE.nucleus).stroke({ width: 3, color: PALETTE.cellEdge }));
    sperm.addChild(chromosomeWithAllele(0, 0, headRy * 1.3, b.sperm, colorOf(b.sperm)));
    const tail = new PIXI.Graphics();
    sperm.addChildAt(tail, 0);
    const spermLabel = textLabel('Sperm', 14, { fill: PALETTE.inkSoft, fontWeight: '800' });
    spermLabel.anchor.set(0.5, 1);
    spermLabel.position.set(0, -headRy - 6);
    sperm.addChild(spermLabel);
    let phase = 0;
    const drawTail = (amp) => {
      tail.clear().moveTo(headRx - 2, 0);
      for (let i = 1; i <= 30; i++) {
        const t = i / 30;
        tail.lineTo(headRx + t * R * 1.5, Math.sin(phase + t * Math.PI * 3) * headRy * 0.32 * amp * t);
      }
      tail.stroke({ width: 4, color: PALETTE.cellEdge, cap: 'round', join: 'round' });
    };

    // Where the membranes meet, a patch in the cytoplasm color hides both outlines: the start of fusion.
    const fusion = new PIXI.Graphics();
    const fuse = { k: 0 };
    const drawFusion = () => {
      fusion.clear();
      if (fuse.k <= 0.01) return;
      fusion.ellipse(ex + R - R * 0.06, ey, R * 0.13, R * 0.36 * fuse.k).fill(PALETTE.nucleus);
    };

    const title = new PIXI.Text({
      text: 'A new bdellbee is born!',
      style: { fontFamily: 'Fraunces, Georgia, serif', fontWeight: '600', fontSize: 28, fill: PALETTE.ink },
      resolution: 2,
    });
    title.anchor.set(0.5, 0);
    title.position.set(w / 2, 14);
    const creature = new Creature(b.features, { size: kid });
    creature.position.set(w / 2, ey + R + kid * 0.75);

    layer.addChild(egg, sperm, fusion, title, creature);

    if (instant) {
      sperm.position.set(contactX, ey);
      phase = 0;
      drawTail(0.35);
      fuse.k = 1;
      drawFusion();
      return;
    }

    sperm.position.set(w + R * 2.6, ey);
    title.alpha = 0;
    creature.scale.set(0);
    // The tail beats while swimming and slows as the membranes fuse.
    const beat = { a: 1 };
    this.birthFrame = (t) => {
      if (!alive() || tail.destroyed) return;
      phase += t.deltaMS / 90;
      drawTail(beat.a);
      drawFusion();
    };
    tw.ticker.add(this.birthFrame);
    await tw.to(sperm, { x: contactX }, { duration: 2600, ease: 'outCubic' });
    if (!alive()) return;
    await Promise.all([tw.to(fuse, { k: 1 }, { duration: 900 }), tw.to(beat, { a: 0.35 }, { duration: 900 })]);
    if (!alive()) return;
    await tw.to(title, { alpha: 1 }, { duration: 600 });
    if (!alive()) return;
    await tw.to(creature.scale, { x: 1, y: 1 }, { duration: 650, ease: 'outBack' });
    if (!alive()) return;
    // The simple animation stops here: the tail comes to rest.
    tw.ticker.remove(this.birthFrame);
    this.birthFrame = null;
    b.done = true;
  }

  // ---- intro ----

  renderIntro(body) {
    body.append(
      h('div', { class: 'stage-name' }, 'Introduction'),
      h(
        'p',
        {},
        'In this module, you will walk through a life cycle from a genetic and chromosomal perspective. In the first part, you will start with gamete (Egg and Sperm genotypes). Then, you will show how these produce a zygote after fertilization. This will be followed by some mitosis as the zygote develops. Finally, you will walk through the steps of meiosis, which produces the gametes you would have started with.',
      ),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => this.go(1) }, 'Start: question a ▶')),
    );
  }

  // The title and a circular life-cycle diagram: gametes → (fertilization) → zygote → (mitosis) → diploid cells →
  // (meiosis) → gametes. Each arrow names the questions that cover that step.
  drawIntro(w, hgt) {
    const layer = this.introLayer;
    layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (!this.step.intro) return;

    const title = new PIXI.Text({
      text: 'The Cycle of Diploid Life: Fertilization, Mitosis and Meiosis',
      style: { fontFamily: 'Fraunces, Georgia, serif', fontWeight: '600', fontSize: 24, fill: PALETTE.ink, wordWrap: true, wordWrapWidth: w - 48, align: 'center' },
      resolution: 2,
    });
    title.anchor.set(0.5, 0);
    title.position.set(w / 2, 24);
    layer.addChild(title);

    const top = 24 + title.height + 52;
    const cx = w / 2;
    const cy = top + (hgt - top) / 2;
    const R = Math.max(90, Math.min(w * 0.3, (hgt - top) * 0.36));
    const nodeR = R * 0.27;

    // Stages at three points of the circle, clockwise from the top.
    const nodes = [
      { angle: -Math.PI / 2, label: 'Egg + sperm', sub: 'gametes (n)', noDisc: true, draw: (g, x, y, r) => this.drawGametesIcon(g, x, y, r * 1.25) },
      { angle: Math.PI / 6, label: 'Zygote', sub: 'one cell (2n)', draw: (g, x, y, r) => this.drawCellIcon(g, x, y, r, 1) },
      { angle: (5 * Math.PI) / 6, label: 'Diploid cells', sub: 'body and germline (2n)', draw: (g, x, y, r) => this.drawCellIcon(g, x, y, r, 3) },
    ];
    const arrows = [
      { from: 0, to: 1, label: 'Fertilization', sub: 'questions a–b' },
      { from: 1, to: 2, label: 'Mitosis', sub: 'questions c–d' },
      { from: 2, to: 0, label: 'Meiosis', sub: 'questions e–h' },
    ];

    const g = new PIXI.Graphics();
    layer.addChild(g);
    const gap = nodeR / R + 0.12;
    for (const a of arrows) {
      const a0 = nodes[a.from].angle + gap;
      let a1 = nodes[a.to].angle - gap;
      if (a1 < a0) a1 += Math.PI * 2;
      // Start each arc at its own first point, or the path joins on from the previous one.
      g.moveTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R).arc(cx, cy, R, a0, a1).stroke({ width: 4, color: PALETTE.sage, cap: 'round' });
      // Arrowhead pointing along the circle (clockwise) at the end of the arc.
      const ex = cx + Math.cos(a1) * R;
      const ey = cy + Math.sin(a1) * R;
      const tx = -Math.sin(a1);
      const ty = Math.cos(a1);
      const s = 13;
      g.poly([ex + tx * s, ey + ty * s, ex - tx * 2 + Math.cos(a1) * s * 0.7, ey - ty * 2 + Math.sin(a1) * s * 0.7, ex - tx * 2 - Math.cos(a1) * s * 0.7, ey - ty * 2 - Math.sin(a1) * s * 0.7]).fill(PALETTE.sage);

      // Step name at the arc's midpoint: outside the circle, or inside it on narrow screens where the sides
      // have no room.
      const mid = (a0 + a1) / 2;
      const inside = w < 520;
      const lr = inside ? R * 0.5 : R + 30;
      const lx = cx + Math.cos(mid) * lr;
      const ly = cy + Math.sin(mid) * lr;
      const name = textLabel(a.label, 17, { fontWeight: '800', fill: PALETTE.sage });
      const sub = textLabel(a.sub, 12, { fontWeight: '700', fill: PALETTE.inkSoft });
      const ax = inside ? 0.5 : Math.cos(mid) > 0.25 ? 0 : Math.cos(mid) < -0.25 ? 1 : 0.5;
      name.anchor.set(ax, 0.5);
      sub.anchor.set(ax, 0);
      name.position.set(lx, ly - 8);
      sub.position.set(lx, ly + 3);
      layer.addChild(name, sub);
    }

    for (const n of nodes) {
      const x = cx + Math.cos(n.angle) * R;
      const y = cy + Math.sin(n.angle) * R;
      // A disc frames each stage, except the gametes: an outline around egg and sperm would read as a zygote.
      if (!n.noDisc) layer.addChild(new PIXI.Graphics().circle(x, y, nodeR).fill(PALETTE.panel).stroke({ width: 2.5, color: PALETTE.cellEdge }));
      const icon = new PIXI.Graphics();
      n.draw(icon, x, y, nodeR * 0.72);
      layer.addChild(icon);
      // Stage name below its circle, or above it for the top stage so the circle's middle stays clear.
      const label = textLabel(n.label, 15, { fontWeight: '800' });
      const sub = textLabel(n.sub, 12, { fontWeight: '700', fill: PALETTE.inkSoft });
      label.anchor.set(0.5, 0);
      sub.anchor.set(0.5, 0);
      if (Math.sin(n.angle) < -0.5) {
        sub.position.set(x, y - nodeR - 6 - sub.height);
        label.position.set(x, sub.y - label.height);
      } else {
        label.position.set(x, y + nodeR + 6);
        sub.position.set(x, y + nodeR + 6 + label.height);
      }
      layer.addChild(label, sub);
    }
  }

  // A tiny chromosome: a rounded bar in an allele color.
  miniChromosome(g, x, y, len, color) {
    const w = Math.max(3, len * 0.22);
    g.roundRect(x - w / 2, y - len / 2, w, len, w / 2).fill(color);
  }

  // Egg (large cell, one chromosome) and sperm (small head with a tail, one chromosome).
  drawGametesIcon(g, x, y, r) {
    const ex = x - r * 0.35;
    g.circle(ex, y, r * 0.6).fill(PALETTE.nucleus).stroke({ width: 2, color: PALETTE.cellEdge });
    this.miniChromosome(g, ex, y, r * 0.5, PALETTE.clay);
    const sx = x + r * 0.62;
    g.moveTo(sx + r * 0.2, y).bezierCurveTo(sx + r * 0.45, y - r * 0.25, sx + r * 0.6, y + r * 0.25, sx + r * 0.85, y).stroke({ width: 2, color: PALETTE.cellEdge, cap: 'round' });
    g.ellipse(sx, y, r * 0.24, r * 0.18).fill(PALETTE.nucleus).stroke({ width: 2, color: PALETTE.cellEdge });
    this.miniChromosome(g, sx, y, r * 0.24, PALETTE.dusk);
  }

  // One or a few diploid cells, each with two homologs (one per parent color).
  drawCellIcon(g, x, y, r, count) {
    const spots = count === 1 ? [[0, 0, 0.62]] : [[-0.42, 0.12, 0.4], [0.42, 0.12, 0.4], [0, -0.38, 0.4]];
    for (const [dx, dy, s] of spots) {
      const px = x + dx * r;
      const py = y + dy * r;
      g.circle(px, py, r * s).fill(PALETTE.nucleus).stroke({ width: 2, color: PALETTE.cellEdge });
      this.miniChromosome(g, px - r * s * 0.25, py, r * s * 0.9, PALETTE.clay);
      this.miniChromosome(g, px + r * s * 0.25, py, r * s * 0.9, PALETTE.dusk);
    }
  }

  // The question bar above the cell: prompt, one button per option, and feedback once one is chosen.
  drawNucleiBar(w) {
    const bar = this.nucleiBar;
    bar.removeChildren().forEach((c) => c.destroy({ children: true }));
    const q = this.step.nucleiQuestion;
    if (!q) return 0;
    const pick = this.nucleiPick[this.step.id];
    const prompt = textLabel(q.text, 16, { fontWeight: '800' });
    prompt.anchor.set(0.5, 0);
    prompt.position.set(w / 2, 12);
    bar.addChild(prompt);
    const size = 46;
    q.options.forEach((n, i) => {
      const chosen = pick === n;
      const color = chosen ? (n === q.answer ? PALETTE.sage : PALETTE.clay) : 0xffffff;
      const b = new PIXI.Container();
      const t = textLabel(String(n), 20, { fontWeight: '800', fill: chosen ? 0xffffff : PALETTE.ink });
      t.anchor.set(0.5);
      b.addChild(new PIXI.Graphics().roundRect(-size / 2, -18, size, 36, 12).fill(color).stroke({ width: 2, color: chosen ? color : PALETTE.cellEdge }), t);
      b.position.set(w / 2 + (i - (q.options.length - 1) / 2) * (size + 14), 60);
      b.eventMode = 'static';
      b.cursor = 'pointer';
      b.on('pointertap', () => this.pickNuclei(n));
      bar.addChild(b);
    });
    let height = 86;
    if (pick != null) {
      const right = pick === q.answer;
      // `wrong` is one message, or one per wrong option.
      const wrong = typeof q.wrong === 'string' ? q.wrong : q.wrong[pick];
      const fb = textLabel(right ? q.right : wrong, 13, { fontWeight: '700', fill: right ? PALETTE.sage : PALETTE.clay, wordWrap: true, wordWrapWidth: Math.min(w - 40, 560), align: 'center' });
      fb.anchor.set(0.5, 0);
      fb.position.set(w / 2, 86);
      bar.addChild(fb);
      height += fb.height + 6;
    }
    return height;
  }

  layout() {
    const { w, h: hgt } = this.ctx.size();
    this.drawIntro(w, hgt);
    if (this.birth?.done) this.animateBirth(true);
    const top = this.drawNucleiBar(w);
    this.builder.setRect({ x: 12, y: 28 + top, w: w - 24, h: hgt - 36 - top });
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

  // Question a: the engine suggests parents, which the student can change; then they pick a zygote those parents
  // could make and build its gametes.
  renderZygote(body) {
    const note = this.zygoteNote;
    const parentRow = (who) => {
      const pnote = this.parentNotes[who];
      return h(
        'div',
        { class: 'picker' },
        h('div', { class: 'picker-label' }, who === 'mother' ? 'Mother’s genotype' : 'Father’s genotype'),
        this.genotypeSelect(who, pnote?.text ?? (this.parents[who] ? g(this.parents[who]) : null), (o) => this.pickParent(who, o)),
        pnote ? this.impossibleNote(pnote) : null,
      );
    };
    body.append(
      h(
        'div',
        { class: 'callout' },
        h('b', {}, 'The parents'),
        'Keep these genotypes or choose others. One line per parent: the slash separates the alleles on the two homologs.',
        parentRow('mother'),
        parentRow('father'),
      ),
    );
    if (this.parentsPending()) {
      body.append(h('p', { class: 'hint' }, 'Choose a possible genotype for both parents to continue.'));
      return;
    }
    body.append(
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

  // A new parent genotype changes which zygotes are possible, so the zygote choice is checked again.
  pickParent(who, option) {
    // An impossible pick is shown and explained, but the last possible genotype is kept underneath it.
    if (!option.possible) this.parentNotes[who] = option;
    else {
      this.parents[who] = this.sorted(option.alleles);
      this.parentNotes[who] = null;
    }
    this.done.delete('a');
    this.revealed.delete('a');
    const { mother, father } = this.parents;
    if (!this.parentsPending()) {
      if (this.zygoteChoice) {
        const still = zygoteFromParents(this.zygoteChoice, mother, father);
        if (!still.ok) {
          const option = this.inst.options.find((o) => o.possible && o.text === g(this.zygoteChoice));
          this.zygoteChoice = null;
          this.zygoteNote = { option, title: 'With these parents, your zygote is no longer possible.', reason: still.reason };
        }
      } else if (this.zygoteNote?.option.possible) {
        // A zygote flagged for the old parents may be fine for the new ones.
        const now = zygoteFromParents(this.zygoteNote.option.alleles, mother, father);
        if (now.ok) {
          this.zygoteChoice = this.sorted(this.zygoteNote.option.alleles);
          this.zygoteNote = null;
        } else {
          this.zygoteNote = { ...this.zygoteNote, reason: now.reason };
        }
      }
      this.syncFollow();
    }
    this.feedback = null;
    this.applyLock();
    this.renderStepper();
    this.renderBody();
  }

  parentsPending() {
    return !!(this.parentNotes.mother || this.parentNotes.father);
  }

  // Questions b to h follow the zygote chosen in a; without one, they follow a default these parents can make.
  syncFollow() {
    const { mother, father } = this.parents;
    if (this.zygoteChoice) {
      if (g(this.zygoteChoice) !== g(this.follow.alleles) || !['chosen-a', 'gametes'].includes(this.follow.source)) this.setFollow(this.zygoteChoice, 'chosen-a');
      return;
    }
    if (this.follow.source === 'chosen') return;
    if (!zygoteFromParents(this.follow.alleles, mother, father).ok || this.follow.source !== 'default') {
      this.setFollow([mother[0], father[0]], 'default');
    }
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
    const locked = this.step.id === 'a' && (!this.zygoteChoice || this.parentsPending());
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
    if (s.intro) return this.renderIntro(body);
    body.append(h('div', { class: 'stage-name' }, `Question ${s.id}`), h('h2', {}, s.title), h('p', {}, s.prompt()));
    if (s.id === 'a') this.renderZygote(body);
    else this.renderFollow(body);
    if (!this.nucleiShown(s)) body.append(h('div', { class: 'callout' }, h('b', {}, 'First, answer the question above the cell'), s.nucleiQuestion.text));
    if (s.list) return this.renderList(body);
    this.arrangeEl = h('div');
    this.tools = h('div', { class: 'tools' });
    body.append(this.arrangeEl, this.tools);
    this.renderArrangement();
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

  // Metaphase questions: what the two arrangements mean. The choice itself is made on the canvas, in the bar above
  // the cell or by dropping chromosomes on the plate.
  renderArrangement() {
    if (!this.arrangeEl) return;
    const el = clear(this.arrangeEl);
    if (!this.step.metaphase) return;
    el.append(
      h(
        'div',
        { class: 'callout' },
        h('b', {}, 'Choose the arrangement in the bar above the cell'),
        h(
          'ul',
          { class: 'tips' },
          h('li', {}, h('b', {}, 'Centromeres on the plate: '), 'each chromosome lines up single file, its centromere on the plate and its sister chromatids facing opposite poles. You can also drop a chromosome on the dashed plate.'),
          h('li', {}, h('b', {}, 'Homologs paired across the plate: '), 'homologs pair side by side, one on each side of the plate, each facing one pole. You can also drag one homolog onto the other.'),
        ),
      ),
    );
  }

  // How to use the tray, as a short list next to the question.
  renderTools() {
    if (!this.tools || this.step.list) return;
    const s = this.step;
    const tips = [
      'Drag a chromosome from the tray into a nucleus: 1 chromatid, or 2 sister chromatids.',
      'Drag an allele onto each chromatid to label it (or tap a chromatid to cycle).',
      s.metaphase ? 'Choose the arrangement above, or drag one chromosome onto its homolog to pair them.' : 'Drag one chromosome onto its homolog to pair them; drag it away to unpair.',
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
    if (this.parentsPending()) return { problem: { code: 'parents' } };
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
    if (!this.nucleiShown(s)) {
      this.feedback = { kind: 'bad', text: `First answer the question above the cell: ${s.nucleiQuestion.text}` };
      return this.renderFeedback();
    }
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
      const r = evaluate(student, s.expected(), { loci: [this.inst.L], matchBy: 'multiset', minCross, arrangement: s.arrangement ?? null });
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
    // A correct metaphase plays the anaphase that follows it, on the student's own cell; correct gametes fuse.
    if (ok && s.anaphase) this.playAnaphase();
    if (ok && s.id === 'a') this.builder.fuseGametes(this.ctx.tween);
  }

  playAnaphase() {
    if (this.step.anaphase) this.builder.anaphase(this.ctx.tween, this.step.anaphase);
  }

  // Turn a grader problem into a sentence for this question.
  explain(step, p) {
    const one = (n) => `${n} chromosome${n === 1 ? '' : 's'}`;
    switch (p.code) {
      case 'parents':
        return 'First choose a possible genotype for both parents.';
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
      case 'chromosome-count': {
        const who = p.label || 'Each nucleus';
        const haploid = ['a', 'f', 'g'].includes(step.id);
        const should = haploid ? `${who} is haploid: it should hold ${one(p.expected)} (one copy of this chromosome)` : `${who} should hold ${one(p.expected)}, one from each parent`;
        // Students often count sister chromatids as separate chromosomes. Chromosomes are counted by centromeres.
        if (p.chromatids > p.got) {
          const whose = p.got === 1 ? 'those are the sister chromatids of a single homolog' : `they belong to only ${one(p.got)}`;
          return `${should}. You have ${p.chromatids} chromatids, but ${whose}. Chromosomes are counted by centromeres: two strands joined at one centromere are sister chromatids of one chromosome.`;
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
        if (p.expected === 'paired')
          return 'At metaphase I the homologs pair up side by side across the plate, so each homolog faces one pole. Choose “Homologs paired across the plate” above the cell.';
        return step.id === 'c'
          ? 'In mitosis homologs do not pair. Each replicated chromosome lines up on its own, centromere on the plate, with its sister chromatids facing opposite poles. Choose “Centromeres on the plate” above the cell, or drop the chromosomes on the dashed plate.'
          : 'At metaphase II there are no homolog pairs left: they separated at anaphase I. Each chromosome lines up with its centromere on the plate and its sisters facing opposite poles. Choose “Centromeres on the plate” above the cell, or drop the chromosomes on the dashed plate.';
      case 'needs-pairing':
        return 'At metaphase I every homolog is paired with its partner. Choose “Homologs paired across the plate” above the cell, or drag one homolog onto the other.';
      case 'no-pairing':
        return step.id === 'c'
          ? 'Homologs do not pair in mitosis: each replicated chromosome lines up on its own.'
          : 'The homologs separated at anaphase I, so nothing is paired at metaphase II.';
      case 'unlabeled':
        return 'Every chromatid needs an allele. Drag an allele from the tray onto each chromatid.';
      case 'sisters-differ':
        return 'Sister chromatids are copies made in S phase, so they carry the same allele, unless a crossover swapped pieces.';
      case 'content': {
        // Name the genotypes: what was built, and what the engine expects for the individual being followed.
        const list = (xs) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
        const why = {
          b: 'The zygote carries one chromosome from the egg and one from the sperm.',
          c: 'Replication copies each chromosome exactly, so the genotype does not change.',
          d: 'Each daughter gets one sister chromatid of every chromosome, so both match the zygote.',
          e: 'The bivalent holds the two homologs this individual inherited.',
          f: 'At anaphase I the homologs separated, so each nucleus carries one homolog with its two identical sisters.',
          g: 'Each gamete gets one chromatid of this chromosome.',
        }[step.id];
        if (p.expected.length === 1) return `This is not the right genotype. The genotype should be ${p.expected[0]}; you built ${p.got[0]}. ${why}`;
        const noun = { d: 'daughter nuclei', f: 'metaphase II nuclei', g: 'gametes' }[step.id] ?? 'nuclei';
        const should = p.expected.every((x) => x === p.expected[0])
          ? `Each of the ${p.expected.length} ${noun} should be ${p.expected[0]}`
          : `The ${p.expected.length} ${noun} should be ${list(p.expected)}`;
        return `These are not the right genotypes. ${should}; you built ${list(p.got)}. ${why}`;
      }
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
      c: 'Right. Each homolog replicated into two identical sisters, and in mitosis they line up single file on the plate without pairing. Watch anaphase: the sisters separate to opposite poles.',
      d: 'Right. Sisters separated, so each daughter is an exact copy of the zygote.',
      e: 'Right. The homologs pair across the plate as a bivalent. Watch anaphase I: the homologs separate while each keeps its two sisters.',
      f: 'Right. The homologs went to different cells, each still carrying two sister chromatids, lined up on the plate. Watch anaphase II: the sisters separate.',
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
    if (this.feedback.kind === 'good') {
      el.append(
        h(
          'div',
          { class: 'row', style: { marginTop: '8px' } },
          s.anaphase ? h('button', { class: 'btn small', onclick: () => this.playAnaphase() }, '▶ Watch anaphase again') : null,
          this.index < this.steps.length - 1 ? h('button', { class: 'btn primary', onclick: () => this.go(this.index + 1) }, `Next: question ${this.steps[this.index + 1].id} ▶`) : null,
        ),
      );
    }
  }

  showAnswer() {
    const s = this.step;
    const expected = s.expected();
    const labels = s.fixed ? s.start.map((x) => x.label) : expected.map(() => '');
    this.builder.setNuclei(expected.map((n, i) => ({ ...n, label: labels[i] ?? '', ...(s.arrangement ? { arrangement: s.arrangement } : {}) })));
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
        fb.append(h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn primary', onclick: () => this.goHome() }, 'Return to main page')));
        this.playBirth([...expected.keys()]);
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
