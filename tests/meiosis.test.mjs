import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, segregateSingleLocus, phenotype } from '../js/engine/meiosis.js';

test('each tetrad has two spores of each homolog allele', () => {
  const rng = makeRng(1);
  for (let i = 0; i < 200; i++) {
    const { spores } = segregateSingleLocus('Ss', rng);
    assert.equal(spores.filter((x) => x === 'S').length, 2);
    assert.equal(spores.filter((x) => x === 's').length, 2);
  }
});

test('homolog orientation at Meiosis I is close to 50/50', () => {
  const rng = makeRng(42);
  const n = 10000;
  let flipped = 0;
  for (let i = 0; i < n; i++) {
    if (segregateSingleLocus('Ss', rng).poles[0][0] === 's') flipped++;
  }
  assert.ok(Math.abs(flipped / n - 0.5) < 0.02, `got ${flipped / n}`);
});

test('same seed gives the same outcomes', () => {
  const a = makeRng(7);
  const b = makeRng(7);
  for (let i = 0; i < 50; i++) {
    assert.deepEqual(segregateSingleLocus('Ss', a), segregateSingleLocus('Ss', b));
  }
});

test('S is dominant: SS and Ss are spotted, ss is plain', () => {
  assert.equal(phenotype('SS'), 'spotted');
  assert.equal(phenotype('Ss'), 'spotted');
  assert.equal(phenotype('ss'), 'plain');
});
