// The standalone Pedigree Generator at /pedigree/: the site's Tool 1 without the site around it. Every page load
// starts from a new random seed, shown under the pedigree; "Specify seed" brings back a particular pedigree. The seed
// stays the same when the mode changes, so a mode and a seed together name one pedigree.

import { h, clear } from '../js/core/dom.js';
import { randomSeed } from '../js/core/rng.js';
import { MODES, pedigreeFor } from '../js/engine/pedigree.js';
import { drawPedigree, notation } from '../js/modules/t01-pedigree-generator/draw.js';

const MAX_SEED = 4294967295; // seeds are 32-bit

const els = {
  select: document.getElementById('ped-mode'),
  out: document.getElementById('ped-out'),
  seedNow: document.getElementById('seed-now'),
  form: document.getElementById('seed-form'),
  input: document.getElementById('seed-input'),
  error: document.getElementById('seed-error'),
};

let mode = '';
let seed = randomSeed() || 1;

els.select.append(
  h('option', { value: '', selected: true, disabled: true }, 'Choose a mode of inheritance…'),
  ...Object.entries(MODES).map(([id, m]) => h('option', { value: id }, m.label)),
);

function render() {
  els.seedNow.textContent = String(seed);
  const out = clear(els.out);
  if (!mode) return;
  const ped = pedigreeFor(mode, seed);
  if (!ped) {
    out.append(h('p', { class: 'ped-note' }, 'No clear pedigree came from this seed. Try New pedigree or another seed.'));
    return;
  }
  const card = h('div', { class: 'ped-card hide-genotypes' }, drawPedigree(ped));
  const toggle = h(
    'button',
    {
      class: 'btn primary',
      type: 'button',
      onclick: () => {
        const show = card.classList.toggle('hide-genotypes') === false;
        toggle.textContent = show ? 'Hide genotypes' : 'Show genotypes';
      },
    },
    'Show genotypes',
  );
  const another = h(
    'button',
    {
      class: 'btn',
      type: 'button',
      onclick: () => {
        seed = randomSeed() || 1;
        render();
      },
    },
    'New pedigree',
  );
  out.append(
    card,
    h('div', { class: 'row ped-actions' }, toggle, another),
    h('p', { class: 'ped-note' }, 'Square = male, circle = female, filled = affected.'),
    notation(mode),
  );
}

function showError(text) {
  els.error.textContent = text;
  els.error.hidden = !text;
}

els.select.addEventListener('change', () => {
  mode = els.select.value;
  render();
});

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = els.input.value.trim();
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > MAX_SEED) {
    showError(`Enter a whole number from 1 to ${MAX_SEED}.`);
    return;
  }
  showError('');
  seed = Number(text);
  els.input.value = '';
  render();
});

els.input.addEventListener('input', () => showError(''));

render();
