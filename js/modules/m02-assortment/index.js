// Module 2: Two genes, two chromosomes.
// Four steps (A to D) share one generated instance: Metaphase I alignments, gametes, the Punnett square, and a litter.

import { h, clear } from '../../core/dom.js';
import { moduleEyebrow, stepLetter } from '../registry.js';
import { buildInstance, parentCards } from './instance.js';
import { OrientationStep } from './orientation-step.js';
import { GametesStep } from './gametes-step.js';
import { CrossStep } from './cross-step.js';
import { BreedStep } from './breed-step.js';

class AssortmentModule {
  constructor(ctx) {
    this.ctx = ctx;
    this.inst = buildInstance(ctx.seed);
    this.state = { answered: new Set() };
    this.done = new Set();
    this.steps = [
      { id: 'orientation', title: 'Orientation', make: () => new OrientationStep(this) },
      { id: 'gametes', title: 'Gametes', make: () => new GametesStep(this) },
      { id: 'cross', title: 'Punnett square', ownCanvas: true, make: () => new CrossStep(this) },
      { id: 'breed', title: 'Breed', make: () => new BreedStep(this) },
    ];
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
        h('button', { class: 'btn small', onclick: () => this.ctx.newSeed() }, 'New creatures'),
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
    if (!this.steps[i].ownCanvas) this.drawParents();
    clear(this.body);
    this.step = this.steps[i].make();
    this.step.enter(this.container, this.body);
    this.renderStepper();
    this.ctx.panel.scrollTop = 0;
  }

  // The parents stay on the canvas through the steps that don't draw their own; the layout follows the stage size.
  drawParents() {
    this.parentsLayer?.destroy({ children: true });
    this.parentsLayer = new PIXI.Container();
    this.container.addChild(this.parentsLayer);
    const { w, h: hgt } = this.ctx.size();
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

  resize(w, hgt) {
    if (this.container && !this.steps[this.index].ownCanvas) this.drawParents();
    this.step?.resize?.(w, hgt);
  }

  destroy() {
    this.step?.exit();
    this.container?.destroy({ children: true });
  }
}

export default {
  id: 'assortment',
  mount(ctx) {
    return new AssortmentModule(ctx);
  },
};
