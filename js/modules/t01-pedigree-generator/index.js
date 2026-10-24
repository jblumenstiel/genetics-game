// Tool 1: Pedigree Generator. A plain HTML page, not a game module: pick a mode of inheritance and it draws a
// three-generation human pedigree that shows it, from js/engine/pedigree.js. The mode and seed live in the URL
// (#/m/pedigree-generator?mode=xr&seed=123), so a pedigree can be shared and comes back the same.

import { h, clear } from '../../core/dom.js';
import { randomSeed } from '../../core/rng.js';
import { MODES, pedigreeFor, isAffected, genotypeParts } from '../../engine/pedigree.js';

const SVG = 'http://www.w3.org/2000/svg';
const S = 26; // square side
const R = 13; // circle radius
const Y = [40, 160, 280]; // generation rows
const GAP = 64; // spacing between people in a row

// How each mode writes genotypes, under the pedigree.
const NOTATION = {
  ar: ['a is the trait allele and A the normal one; affected people are a/a.'],
  ad: ['A is the trait allele and a the normal one; A/a and A/A people are affected.'],
  xr: ['X', ['a'], ' carries the trait allele and X', ['A'], ' the normal one. Males have one X and a Y.'],
  xd: ['X', ['A'], ' carries the trait allele and X', ['a'], ' the normal one. Males have one X and a Y.'],
  y: ['Y', ['A'], ' carries the trait allele and Y', ['a'], ' the normal one. Females are XX.'],
  mt: ['mt', ['A'], ' is mitochondrial DNA carrying the trait allele, mt', ['a'], ' the normal type. Mitochondria come from the egg.'],
};

function svgEl(tag, attrs = {}, text) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
}

// The pedigree drawing: each grandparent couple centered over its children, the generation II couple joined in the
// middle, and generation III centered under them.
function drawPedigree(ped) {
  const svg = svgEl('svg', { class: 'ped-svg', role: 'img', 'aria-label': `${MODES[ped.mode].label} pedigree` });
  const lines = svgEl('g', { class: 'ped-lines' });
  const marks = svgEl('g');
  svg.append(lines, marks);
  const line = (x1, y1, x2, y2) => lines.append(svgEl('line', { x1, y1, x2, y2 }));
  const pos = new Map();

  const xII = ped.II.map((_, i) => 340 - ((ped.II.length - 1) * GAP) / 2 + i * GAP);
  const famA = xII.slice(0, ped.nA);
  const famB = xII.slice(ped.nA);
  const mid = (xs) => (xs[0] + xs[xs.length - 1]) / 2;
  const iA = ped.nA - 1;
  const cII = (xII[iA] + xII[iA + 1]) / 2;
  const nIII = ped.III.length;
  const x3 = Math.max(60, Math.min(640 - (nIII - 1) * GAP, cII - ((nIII - 1) * GAP) / 2));
  const cA = mid(famA);
  const cB = mid(famB);
  [cA - 30, cA + 30, cB - 30, cB + 30].forEach((x, i) => pos.set(ped.I[i], x));
  ped.II.forEach((p, i) => pos.set(p, xII[i]));
  ped.III.forEach((p, i) => pos.set(p, x3 + i * GAP));

  // A couple: the mating line, a line down to the sibship line, which runs below the parents' labels.
  const couple = (left, right, gen, kids) => {
    const y = Y[gen];
    const [xl, xr] = [pos.get(left), pos.get(right)].sort((a, b) => a - b);
    line(xl + R, y, xr - R, y);
    const cx = (xl + xr) / 2;
    const sy = y + R + 47;
    const kx = kids.map((k) => pos.get(k));
    line(cx, y, cx, sy);
    line(Math.min(cx, ...kx), sy, Math.max(cx, ...kx), sy);
    kx.forEach((x) => line(x, sy, x, Y[gen + 1] - R));
  };
  couple(ped.I[0], ped.I[1], 0, ped.II.slice(0, ped.nA));
  couple(ped.I[2], ped.I[3], 0, ped.II.slice(ped.nA));
  couple(ped.couple.father, ped.couple.mother, 1, ped.III);

  for (const p of [...ped.I, ...ped.II, ...ped.III]) {
    const x = pos.get(p);
    const y = Y[p.gen];
    const cls = isAffected(ped.mode, p) ? 'affected' : '';
    marks.append(
      p.sex === 'M' ? svgEl('rect', { x: x - R, y: y - R, width: S, height: S, class: cls }) : svgEl('circle', { cx: x, cy: y, r: R, class: cls }),
      svgEl('text', { x, y: y + R + 15, class: 'ped-id' }, p.id),
    );
    const g = svgEl('text', { x, y: y + R + 31, class: 'ped-geno' });
    for (const part of genotypeParts(ped.mode, p)) {
      g.append(part.sup ? svgEl('tspan', { 'baseline-shift': 'super', 'font-size': '9' }, part.text) : svgEl('tspan', {}, part.text));
    }
    marks.append(g);
  }
  // The view fits the people drawn, with the generation numerals in the left margin, so it stays legible when narrow.
  const xs = [...pos.values()];
  const left = Math.min(...xs) - 70;
  const width = Math.max(...xs) + 40 - left;
  ['I', 'II', 'III'].forEach((r, i) => marks.append(svgEl('text', { x: left + 8, y: Y[i] + 5, class: 'ped-gen' }, r)));
  svg.setAttribute('viewBox', `${left} 0 ${width} ${Y[2] + R + 40}`);
  svg.style.maxWidth = `${width * 1.15}px`;
  return svg;
}

function notation(mode) {
  return h('p', { class: 'ped-note' }, NOTATION[mode].map((x) => (Array.isArray(x) ? h('sup', {}, x[0]) : x)));
}

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
