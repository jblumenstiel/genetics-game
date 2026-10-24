// Draws a pedigree from js/engine/pedigree.js as an SVG, and the line explaining each mode's genotype notation. Shared
// by Tool 1 in the site and the standalone page at /pedigree/.

import { h } from '../../core/dom.js';
import { MODES, isAffected, genotypeParts } from '../../engine/pedigree.js';

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
export function drawPedigree(ped) {
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

export function notation(mode) {
  return h('p', { class: 'ped-note' }, NOTATION[mode].map((x) => (Array.isArray(x) ? h('sup', {}, x[0]) : x)));
}
