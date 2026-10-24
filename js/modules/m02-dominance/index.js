// Module 2: Dominance zoo. Learning slides first (A to C), then problems (D), then open reflection (E). No cell
// building: the canvas shows slides, bdellbees and mechanism pictures, and questions sit in the question sheet.

import { h, clear } from '../../core/dom.js';
import { PALETTE } from '../../core/palette.js';
import { moduleEyebrow, stepLetter } from '../registry.js';
import { buildInstance } from './instance.js';
import { BasicsStep } from './basics-step.js';
import { PagesStep } from './pages-step.js';
import { QuizStep } from './quiz-step.js';
import { ReflectStep } from './reflect-step.js';
import { TERMS_1, TERMS_2 } from './slides.js';

class DominanceModule {
  constructor(ctx) {
    this.ctx = ctx;
    this.inst = buildInstance(ctx.seed);
    // answered: questions got right. seen: answered questions the student has moved past. pages: the page each
    // slide step was left on.
    this.state = { answered: new Set(), seen: new Set(), pages: {} };
    this.done = new Set();
    this.steps = [
      { id: 'basics', title: 'Alleles and phenotypes', make: () => new BasicsStep(this) },
      { id: 'terms1', title: 'Terminology 1', make: () => new PagesStep(this, 'terms1', 'Terminology 1', TERMS_1) },
      { id: 'terms2', title: 'Terminology 2', make: () => new PagesStep(this, 'terms2', 'Terminology 2: Mechanisms of Dominance', TERMS_2) },
      { id: 'quiz', title: 'Which kind of allele?', make: () => new QuizStep(this) },
      { id: 'reflect', title: 'Reflections', make: () => new ReflectStep(this) },
    ];
    this.titleLayer = new PIXI.Container();
    this.titleH = 0;
    this.stageText = '';
    ctx.root.addChild(this.titleLayer);
    // Back and Next for the slides, along the bottom of the canvas (the same bar Module 0 uses for Check).
    this.bar = h('div', { class: 'build-bar slide-bar', hidden: true });
    ctx.stage.append(this.bar);
    this.buildPanel();
    this.go(0);
  }

  buildPanel() {
    const { entry, panel } = this.ctx;
    this.stepper = h('ol', { class: 'stepper' });
    this.body = h('div', { class: 'step' });
    clear(panel).append(
      h(
        'div',
        {},
        h('div', { class: 'eyebrow' }, moduleEyebrow(entry)),
        h('h1', {}, entry.title),
        h('p', { class: 'meta' }, `Today: diploid `, h('b', {}, this.inst.species.plural), ` and how two alleles of one gene work together to make a phenotype. Every gene here is autosomal.`),
      ),
      entry.underConstruction
        ? h('div', { class: 'callout construction' }, h('b', {}, '🚧 Under construction'), 'This module is still being built. Parts of it may change or not work as expected yet.')
        : '',
      this.stepper,
      this.body,
      h('div', { class: 'panel-foot' }, h('span', {}, `Seed ${this.ctx.seed}`)),
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
    this.setNav(null);
    this.index = i;
    this.stageText = '';
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

  // The label of the next step's way on, as the panel and the sheet show it: "Continue: B. Terminology 1 ▶".
  continueLabel() {
    const i = this.index + 1;
    return i < this.steps.length ? `Continue: ${stepLetter(i)}. ${this.steps[i].title} ▶` : null;
  }

  complete(id) {
    this.done.add(id);
    this.renderStepper();
  }

  // The stage name at the top of the canvas, without a letter. Steps call it as their page changes.
  setStage(text) {
    this.stageText = text;
    this.refreshTitle();
  }

  refreshTitle() {
    this.titleLayer.removeChildren().forEach((c) => c.destroy());
    const { w } = this.ctx.size();
    const fontSize = w < 480 ? 19 : 23;
    this.titleH = this.stageText ? 12 + Math.ceil(fontSize * 1.3) : 0;
    if (this.container) this.container.y = this.titleH;
    if (!this.stageText) return;
    const t = new PIXI.Text({ text: this.stageText, style: { fontFamily: 'Fraunces, Georgia, serif', fontWeight: '600', fontSize, fill: PALETTE.ink }, resolution: 2 });
    t.scale.set(Math.min(1, (w - 32) / t.width));
    t.anchor.set(0.5, 0);
    t.position.set(w / 2, 12);
    this.titleLayer.addChild(t);
  }

  // Buttons for the bar along the bottom of the canvas: [{ label, onClick, primary }], or null to hide it.
  setNav(buttons, note = '') {
    const bar = clear(this.bar);
    if (!buttons) {
      bar.hidden = true;
      this.ctx.stage.style.setProperty('--sheet-lift', '0px');
      return;
    }
    bar.append(
      h('div', { class: 'feedback hint' }, note),
      h(
        'div',
        { class: 'row' },
        buttons.map((b) => h('button', { class: b.primary ? 'btn primary' : 'btn', type: 'button', onclick: b.onClick }, b.label)),
      ),
    );
    bar.hidden = false;
    this.ctx.stage.style.setProperty('--sheet-lift', `${this.barSpace()}px`);
  }

  // Canvas height the bar covers, with its margin.
  barSpace() {
    return this.bar.hidden ? 0 : this.bar.offsetHeight + 12;
  }

  // The canvas area below the title, where steps lay out (the step leaves room for the bar and any sheet itself).
  size() {
    const { w, h: hgt } = this.ctx.size();
    return { w, h: hgt - this.titleH };
  }

  relayout() {
    const { w, h: hgt } = this.size();
    this.step?.resize?.(w, hgt);
  }

  resize() {
    this.refreshTitle();
    this.relayout();
  }

  destroy() {
    this.step?.exit();
    this.container?.destroy({ children: true });
    this.titleLayer.destroy({ children: true });
    this.bar.remove();
    this.ctx.stage.style.removeProperty('--sheet-lift');
  }
}

export default {
  id: 'dominance',
  mount(ctx) {
    return new DominanceModule(ctx);
  },
};
