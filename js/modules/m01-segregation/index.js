// Module 1: One gene, one meiosis.
// An intro page, then five steps (A to E) that share one generated instance: meiosis vs mitosis, gametes,
// fertilization, breeding, detective.

import { h, clear } from '../../core/dom.js';
import { moduleEyebrow, stepLetter } from '../registry.js';
import { buildInstance } from './instance.js';
import { IntroStep } from './intro-step.js';
import { MeiosisStep } from './meiosis-step.js';
import { GametesStep } from './gametes-step.js';
import { FertilizationStep } from './fertilization-step.js';
import { BreedStep } from './breed-step.js';
import { DetectiveStep } from './detective-step.js';

class SegregationModule {
  constructor(ctx) {
    this.ctx = ctx;
    this.inst = buildInstance(ctx.seed);
    this.state = { answered: new Set() };
    this.done = new Set();
    this.steps = [
      { id: 'intro', title: 'Intro', intro: true, make: () => new IntroStep(this) },
      { id: 'meiosis', title: 'Meiosis', make: () => new MeiosisStep(this) },
      { id: 'gametes', title: 'Gametes', make: () => new GametesStep(this) },
      { id: 'fertilization', title: 'Fertilization', make: () => new FertilizationStep(this) },
      { id: 'breed', title: 'Breed', make: () => new BreedStep(this) },
      { id: 'detective', title: 'Detective', make: () => new DetectiveStep(this) },
    ];
    this.buildPanel();
    this.go(0);
  }

  buildPanel() {
    const { entry, panel } = this.ctx;
    const { species, trait } = this.inst;
    const [A, a] = trait.alleles;
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
          ' and one autosomal pigment gene. ',
          h('b', {}, A.label),
          ` (dominant) ${A.note}; `,
          h('b', {}, a.label),
          ` (recessive) is ${a.note}, so ${a.label}/${a.label} bdellbees are white.`,
        ),
      ),
      entry.underConstruction
        ? h(
            'div',
            { class: 'callout construction' },
            h('b', {}, '🚧 Under construction'),
            'This module is still being built. Parts of it may change or not work as expected yet.',
          )
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
            s.intro ? s.title : `${stepLetter(i - 1)}. ${s.title}`,
          ),
        ),
      ),
    );
  }

  go(i) {
    this.step?.exit();
    this.ctx.tween.killAll();
    this.container?.destroy({ children: true });
    this.index = i;
    this.container = new PIXI.Container();
    this.ctx.root.addChild(this.container);
    clear(this.body);
    this.step = this.steps[i].make();
    this.step.enter(this.container, this.body);
    this.renderStepper();
    this.ctx.panel.scrollTop = 0;
  }

  next() {
    if (this.index < this.steps.length - 1) this.go(this.index + 1);
  }

  complete(id) {
    this.done.add(id);
    this.renderStepper();
  }

  resize(w, hgt) {
    this.step?.resize?.(w, hgt);
  }

  destroy() {
    this.step?.exit();
    this.container?.destroy({ children: true });
  }
}

export default {
  id: 'segregation',
  mount(ctx) {
    return new SegregationModule(ctx);
  },
};
