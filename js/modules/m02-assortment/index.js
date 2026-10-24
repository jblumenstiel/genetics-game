// Module 2: Two genes, two chromosomes.
// Four steps (A to D) share one generated instance: Metaphase I alignments, gametes, the Punnett square, and a litter.

import { h, clear } from '../../core/dom.js';
import { PALETTE } from '../../core/palette.js';
import { moduleEyebrow, stepLetter } from '../registry.js';
import { buildInstance, parentCards } from './instance.js';
import { OrientationStep } from './orientation-step.js';
import { GametesStep } from './gametes-step.js';
import { CrossStep } from './cross-step.js';
import { BreedStep } from './breed-step.js';
import { BuildStep } from './build-step.js';

class AssortmentModule {
  constructor(ctx) {
    this.ctx = ctx;
    this.inst = buildInstance(ctx.seed);
    // answered: questions got right. seen: answered questions the student has moved past (they leave the screen).
    this.state = { answered: new Set(), seen: new Set() };
    this.done = new Set();
    // stage: the name at the top of the canvas, without the step letter.
    this.steps = [
      { id: 'orientation', title: 'Orientation', stage: 'Meiosis: Metaphase I', make: () => new OrientationStep(this) },
      { id: 'gametes', title: 'Gametes', stage: 'Gametes: from two genes', make: () => new GametesStep(this) },
      { id: 'cross', title: 'Punnett square', stage: 'Fertilization: the Punnett square', ownCanvas: true, make: () => new CrossStep(this) },
      { id: 'breed', title: 'Breed', stage: 'Breeding: a litter', make: () => new BreedStep(this) },
      // Its stage name changes with each question (Fertilization, Mitosis, Meiosis), so the step sets it.
      { id: 'build', title: 'Build the cell', stage: 'Fertilization: egg and sperm', ownCanvas: true, make: () => new BuildStep(this) },
    ];
    this.titleLayer = new PIXI.Container();
    this.titleH = 0;
    // A step can replace the stage name while it runs (the Build the cell step, question by question).
    this.stageText = null;
    ctx.root.addChild(this.titleLayer);
    this.buildPanel();
    this.go(0);
  }

  buildPanel() {
    const { entry, panel } = this.ctx;
    const { species, traits } = this.inst;
    this.stepper = h('ol', { class: 'stepper' });
    this.body = h('div', { class: 'step' });
    clear(panel).append(
      h(
        'div',
        {},
        h('div', { class: 'eyebrow' }, moduleEyebrow(entry)),
        h('h1', {}, entry.title),
        h(
          'p',
          { class: 'meta' },
          'Today: diploid ',
          h('b', {}, species.plural),
          ' and two autosomal genes on different chromosomes, both with complete dominance. ',
          traits.flatMap((t) => {
            const [A, a] = t.alleles;
            const part = t.id === 'spots' ? 'spot' : 'body';
            return [h('b', {}, A.label), ` makes ${part} pigment, so `, h('b', {}, `${a.label}/${a.label}`), ` bdellbees are ${t.express([a.id, a.id]).label}. `];
          }),
        ),
      ),
      entry.underConstruction
        ? h('div', { class: 'callout construction' }, h('b', {}, '🚧 Under construction'), 'This module is still being built. Parts of it may change or not work as expected yet.')
        : '',
      this.stepper,
      this.body,
      h(
        'div',
        { class: 'panel-foot' },
        h('span', {}, `Seed ${this.ctx.seed}`),
      ),
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
            {
              class: [i === this.index ? 'current' : '', this.done.has(s.id) ? 'done' : ''].join(' ').trim(),
              onclick: () => this.go(i),
            },
            `${stepLetter(i)}. ${s.title}`,
          ),
        ),
      ),
    );
  }

  go(i) {
    this.step?.exit();
    this.ctx.tween.killAll();
    this.container?.destroy({ children: true });
    this.parentsLayer = null;
    this.index = i;
    this.container = new PIXI.Container();
    this.ctx.root.addChild(this.container);
    this.stageText = null;
    this.refreshTitle();
    if (!this.steps[i].ownCanvas) this.drawParents();
    clear(this.body);
    this.step = this.steps[i].make();
    this.step.enter(this.container, this.body);
    this.renderStepper();
    this.ctx.panel.scrollTop = 0;
  }

  // The canvas area below the title, where steps lay out.
  size() {
    const { w, h: hgt } = this.ctx.size();
    return { w, h: hgt - this.titleH };
  }

  // The step's stage name at the top of the canvas. Its height depends only on the canvas width.
  refreshTitle() {
    this.titleLayer.removeChildren().forEach((c) => c.destroy());
    const { w } = this.ctx.size();
    const fontSize = w < 480 ? 20 : 24;
    this.titleH = 12 + Math.ceil(fontSize * 1.3);
    if (this.container) this.container.y = this.titleH;
    const t = new PIXI.Text({ text: this.stageText ?? this.steps[this.index].stage, style: { fontFamily: 'Fraunces, Georgia, serif', fontWeight: '600', fontSize, fill: PALETTE.ink }, resolution: 2 });
    // A long title shrinks to stay on one line.
    t.scale.set(Math.min(1, (w - 32) / t.width));
    t.anchor.set(0.5, 0);
    t.position.set(w / 2, 12);
    this.titleLayer.addChild(t);
  }

  setStage(text) {
    this.stageText = text;
    this.refreshTitle();
  }

  // The parents stay on the canvas through the steps that don't draw their own; the layout follows the stage size.
  drawParents() {
    this.parentsLayer?.destroy({ children: true });
    this.parentsLayer = new PIXI.Container();
    this.container.addChild(this.parentsLayer);
    const { w, h: hgt } = this.size();
    const size = Math.max(60, Math.min(96, hgt * 0.16));
    parentCards(this.inst, size).forEach((card, i) => {
      card.container.position.set(w * (0.32 + i * 0.36), size * 0.7);
      this.parentsLayer.addChild(card.container);
    });
  }

  next() {
    if (this.index < this.steps.length - 1) this.go(this.index + 1);
  }

  complete(id) {
    this.done.add(id);
    this.renderStepper();
  }

  resize() {
    this.refreshTitle();
    if (this.container && !this.steps[this.index].ownCanvas) this.drawParents();
    const { w, h: hgt } = this.size();
    this.step?.resize?.(w, hgt);
  }

  destroy() {
    this.step?.exit();
    this.container?.destroy({ children: true });
    this.titleLayer.destroy({ children: true });
  }
}

export default {
  id: 'assortment',
  mount(ctx) {
    return new AssortmentModule(ctx);
  },
};
