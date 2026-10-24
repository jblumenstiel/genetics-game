import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../js/core/rng.js';
import { MODES, simulate, pedigreeFor, showsPattern, isAffected, genotypeText } from '../js/engine/pedigree.js';

const people = (ped) => [...ped.I, ...ped.II, ...ped.III];
const kids = (ped) => people(ped).filter((p) => p.mother);

test('every mode finds a clear pedigree with someone affected, and the seed reproduces it', () => {
  for (const mode of Object.keys(MODES)) {
    for (let seed = 1; seed <= 40; seed++) {
      const ped = pedigreeFor(mode, seed);
      assert.ok(ped, `${mode} seed ${seed}`);
      assert.ok(showsPattern(ped));
      assert.ok(people(ped).some((p) => isAffected(mode, p)));
      const again = pedigreeFor(mode, seed);
      assert.deepEqual(people(again).map((p) => genotypeText(mode, p)), people(ped).map((p) => genotypeText(mode, p)));
    }
  }
});

// Transmission rules, checked on many raw simulations (clear or not).
function eachChild(mode, check, n = 300) {
  const rng = makeRng(7);
  for (let i = 0; i < n; i++) {
    const ped = simulate(mode, rng);
    for (const c of kids(ped)) check(c, ped);
  }
}

test('autosomal: each child has one allele from each parent', () => {
  for (const mode of ['ar', 'ad']) {
    eachChild(mode, (c) => {
      const [x, y] = c.g.auto;
      const ok = (c.mother.g.auto.includes(x) && c.father.g.auto.includes(y)) || (c.mother.g.auto.includes(y) && c.father.g.auto.includes(x));
      assert.ok(ok);
    });
  }
});

test('X-linked: sons get their X from the mother; daughters get the father\'s X', () => {
  for (const mode of ['xr', 'xd']) {
    eachChild(mode, (c) => {
      if (c.sex === 'M') {
        assert.equal(c.g.x.length, 1);
        assert.ok(c.mother.g.x.includes(c.g.x[0]));
      } else {
        assert.equal(c.g.x.length, 2);
        assert.ok(c.g.x.includes(c.father.g.x[0]));
      }
    });
  }
  // X-linked dominant: an affected father has only affected daughters.
  eachChild('xd', (c) => {
    if (c.sex === 'F' && isAffected('xd', c.father)) assert.ok(isAffected('xd', c));
  });
});

test('Y-linked: sons share the father\'s status and daughters are never affected', () => {
  eachChild('y', (c) => {
    if (c.sex === 'F') assert.equal(isAffected('y', c), false);
    else assert.equal(isAffected('y', c), isAffected('y', c.father));
  });
});

test('mitochondrial: every child has the mother\'s status, whatever the father\'s', () => {
  eachChild('mt', (c) => assert.equal(isAffected('mt', c), isAffected('mt', c.mother)));
});

test('autosomal recessive: affected only as a/a', () => {
  eachChild('ar', (c) => assert.equal(isAffected('ar', c), c.g.auto.join('') === 'aa'));
});
