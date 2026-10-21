import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAITS } from '../js/species/catalog.js';
import { genotypeLabel } from '../js/engine/phenotype.js';
import {
  offspringPhenotypes,
  offspringGenotypes,
  integerRatio,
  fraction,
  genotypeGivenPhenotype,
  logLikelihood,
} from '../js/engine/cross.js';

test('complete dominance: one S copy is enough for spots', () => {
  const t = TRAITS.spots;
  assert.equal(t.express(['S', 'S']).key, 'spotted');
  assert.equal(t.express(['S', 's']).key, 'spotted');
  assert.equal(t.express(['s', 's']).key, 'plain');
});

test('incomplete dominance is dosage dependent, including trisomics', () => {
  const t = TRAITS.color;
  assert.equal(t.express(['CB', 'CB']).key, 'blue');
  assert.equal(t.express(['CB', 'CR']).key, 'mauve');
  assert.equal(t.express(['CR', 'CR']).key, 'rust');
  assert.equal(t.express(['CB', 'CB', 'CR']).key, 'mauve');
});

test('codominance shows both alleles', () => {
  const p = TRAITS.pattern.express(['PD', 'PT']);
  assert.equal(p.label, 'dots and stripes');
  assert.equal(p.features.spots, true);
  assert.equal(p.features.stripes, true);
});

test('Ss x Ss gives 3 spotted : 1 plain and 1/4 SS', () => {
  const t = TRAITS.spots;
  const ph = offspringPhenotypes(t, ['S', 's'], ['S', 's']);
  assert.deepEqual(integerRatio(ph.map((p) => p.p)), [3, 1]);
  assert.equal(ph[0].key, 'spotted');
  const ss = offspringGenotypes(t, ['S', 's'], ['S', 's']).find((g) => g.key === 'S/S');
  assert.equal(fraction(ss.p), '1/4');
});

test('P(SS given spotted) from Ss x Ss is 1/3', () => {
  assert.equal(fraction(genotypeGivenPhenotype(TRAITS.spots, ['S', 's'], ['S', 's'], 'spotted', 'S/S')), '1/3');
});

test('incomplete dominance cross gives 1:2:1', () => {
  const ph = offspringPhenotypes(TRAITS.color, ['CB', 'CR'], ['CB', 'CR']);
  assert.deepEqual(integerRatio(ph.map((p) => p.p)), [2, 1, 1]);
  assert.equal(ph[0].key, 'mauve');
});

test('genotype labels are ordered dominant first', () => {
  assert.equal(genotypeLabel(TRAITS.spots, ['s', 'S']), 'S/s');
  assert.equal(genotypeLabel(TRAITS.color, ['CR', 'CB']), 'Cᴮ/Cᴿ');
});

test('likelihood rules out impossible hypotheses', () => {
  const dist = offspringPhenotypes(TRAITS.spots, ['S', 'S'], ['s', 's']);
  assert.equal(logLikelihood({ spotted: 5, plain: 1 }, dist), -Infinity);
  assert.ok(Number.isFinite(logLikelihood({ spotted: 6 }, dist)));
});
