// Tool 1: Pedigree Generator. A plain HTML page, not a game module: pick a mode of inheritance and it draws a
// three-generation human pedigree that shows it, from js/engine/pedigree.js. The mode and seed live in the URL
// (#/m/pedigree-generator?mode=xr&seed=123), so a pedigree can be shared and comes back the same.

import { h, clear } from '../../core/dom.js';
import { randomSeed } from '../../core/rng.js';
import { MODES, pedigreeFor } from '../../engine/pedigree.js';
import { drawPedigree, notation } from './draw.js';

class PedigreeGenerator {
  constructor(ctx) {
    this.ctx = ctx;
    this.root = ctx.root;
    const mode = ctx.params.get('mode');
    const seed = Number(ctx.params.get('seed'));
    this.mode = MODES[mode] ? mode : '';
    this.seed = Number.isFinite(seed) && seed > 0 ? seed : null;
    this.showGenotypes = false;
    this.build();
    if (this.mode) this.generate(this.seed ?? (randomSeed() || 1));
  }

  build() {
    this.select = h(
      'select',
      { class: 'gl-field ped-select', id: 'ped-mode' },
      h('option', { value: '', selected: !this.mode, disabled: true }, 'Choose a mode of inheritance…'),
      Object.entries(MODES).map(([id, m]) => h('option', { value: id, selected: id === this.mode }, m.label)),
    );
    this.select.addEventListener('change', () => {
      this.mode = this.select.value;
      this.generate(randomSeed() || 1);
    });
    this.out = h('div', { class: 'ped-out' });
    clear(this.root).append(
      h(
        'div',
        { class: 'tool-page' },
        h('div', { class: 'eyebrow' }, 'Tools · Tool 1'),
        h('h1', {}, 'Pedigree Generator'),
        h('p', { class: 'ped-lead' }, 'Choose a mode of inheritance to generate a three-generation human pedigree that shows it. Each pedigree is simulated generation by generation and kept only if its pattern is clear.'),
        h('label', { class: 'ped-label', for: 'ped-mode' }, 'Mode of inheritance'),
        this.select,
        this.out,
      ),
    );
  }

  generate(seed) {
    this.seed = seed;
    this.showGenotypes = false;
    this.ped = pedigreeFor(this.mode, seed);
    history.replaceState(null, '', `#/m/${this.ctx.entry.id}?mode=${this.mode}&seed=${seed}`);
    this.render();
  }

  render() {
    const out = clear(this.out);
    if (!this.ped) {
      out.append(h('p', { class: 'ped-note' }, 'No clear pedigree came from this seed. Try New pedigree.'));
      return;
    }
    const card = h('div', { class: `ped-card${this.showGenotypes ? '' : ' hide-genotypes'}` }, drawPedigree(this.ped));
    const toggle = h(
      'button',
      {
        class: 'btn primary',
        type: 'button',
        onclick: () => {
          this.showGenotypes = !this.showGenotypes;
          card.classList.toggle('hide-genotypes', !this.showGenotypes);
          toggle.textContent = this.showGenotypes ? 'Hide genotypes' : 'Show genotypes';
        },
      },
      this.showGenotypes ? 'Hide genotypes' : 'Show genotypes',
    );
    out.append(
      card,
      h('div', { class: 'row ped-actions' }, toggle, h('button', { class: 'btn', type: 'button', onclick: () => this.generate(randomSeed() || 1) }, 'New pedigree')),
      h('p', { class: 'ped-note' }, 'Square = male, circle = female, filled = affected.'),
      notation(this.mode),
      h('p', { class: 'ped-seed' }, `Seed ${this.seed}`),
    );
  }

  destroy() {
    clear(this.root);
  }
}

export default {
  id: 'pedigree-generator',
  mount(ctx) {
    return new PedigreeGenerator(ctx);
  },
};
