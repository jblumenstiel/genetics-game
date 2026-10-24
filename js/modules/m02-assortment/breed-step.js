// Step 4: breed a litter through real meioses and fertilization, then compare the tally with 9:3:3:1.

import { h, clear } from '../../core/dom.js';
import { fractionGlyph, integerRatio } from '../../engine/cross.js';
import { expectedClasses, offspringPhenotype } from './instance.js';
import { tallyBars } from './tally.js';

export class BreedStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.classes = expectedClasses(this.inst);
    this.counts = mod.state.litterCounts ?? (mod.state.litterCounts = {});
    this.total = mod.state.litterTotal ?? 0;
  }

  enter(container, body) {
    this.body = body;
    this.renderPanel();
  }

  exit() {}

  litter(n) {
    for (let i = 0; i < n; i++) {
      const kid = offspringPhenotype(this.inst, this.inst.rng);
      this.counts[kid.key] = (this.counts[kid.key] ?? 0) + 1;
      this.total++;
    }
    this.mod.state.litterTotal = this.total;
    this.mod.complete('breed');
    this.renderPanel();
  }

  reset() {
    for (const k of Object.keys(this.counts)) delete this.counts[k];
    this.total = 0;
    this.mod.state.litterTotal = 0;
    this.renderPanel();
  }

  renderPanel() {
    const body = clear(this.body);
    const { mother, father } = this.inst;
    body.append(
      h('h2', {}, 'Breed a litter'),
      h(
        'p',
        {},
        `${mother.name} and ${father.name} are both ${mother.label}. Each offspring gets one gamete from each parent, so every class in the cross can appear.`,
      ),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => this.litter(10) }, 'Breed 10'),
        h('button', { class: 'btn', onclick: () => this.litter(100) }, 'Breed 100'),
        h('button', { class: 'btn small', disabled: !this.total, onclick: () => this.reset() }, 'Clear'),
      ),
    );

    if (this.total) {
      const rows = this.classes.map((c) => ({ label: c.label, n: this.counts[c.key] ?? 0, p: c.p }));
      body.append(
        tallyBars(rows, this.total),
        h('p', { class: 'hint' }, `${this.total} offspring. Expected ratio ${integerRatio(this.classes.map((c) => c.p)).join(' : ')}. The dark tick marks each class's expected share.`),
        h(
          'table',
          { class: 'arrangements' },
          h('tr', {}, h('th', {}, 'Phenotype'), h('th', {}, 'Expected'), h('th', {}, 'Observed')),
          this.classes.map((c) =>
            h('tr', {}, h('td', {}, c.label), h('td', {}, fractionGlyph(c.p)), h('td', {}, `${((100 * (this.counts[c.key] ?? 0)) / this.total).toFixed(0)}%`)),
          ),
        ),
        h(
          'div',
          { class: 'callout' },
          h('b', {}, 'Small litters wobble'),
          `With ${this.total} offspring, the classes only roughly match ${this.classes.map((c) => fractionGlyph(c.p)).join(', ')}. The ratio is an expectation: the larger the litter, the closer the tally gets.`,
        ),
      );
    }
  }
}
