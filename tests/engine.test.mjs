import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../js/core/rng.js';
import { haplotype, diploid, allelesAt } from '../js/engine/genome.js';
import { meiosis, mitosis, fertilize } from '../js/engine/meiosis.js';
import { isRecombinant, productAllele, segregationDivision, classifyTetrad } from '../js/engine/tetrad.js';
import { haldane, haldaneInverse, kosambi, kosambiInverse, secondDivisionFrequency } from '../js/engine/mapping.js';

// One chromosome carrying loci A and B, centromere at the left end unless given.
function twoLocusCell({ length = 100, centromere = 0, a = 10, b = 30, inversion = null } = {}) {
  const karyotype = [{ id: '1', length, centromere, loci: [{ id: 'A', pos: a }, { id: 'B', pos: b }] }];
  const haps = [[haplotype({ A: 'A', B: 'B' }), haplotype({ A: 'a', B: 'b' })]];
  return diploid(karyotype, haps, { inversions: inversion ? [[null, inversion]] : undefined });
}

const PARENTAL = [{ A: 'A', B: 'B' }, { A: 'a', B: 'b' }];

function recombinationFraction(cell, rng, n, options = {}, { viableOnly = false } = {}) {
  let rec = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    for (const p of meiosis(cell, rng, options).products) {
      if (viableOnly && !p.viable) continue;
      total++;
      if (isRecombinant(p, cell.karyotype, 'A', 'B', PARENTAL)) rec++;
    }
  }
  return rec / total;
}

test('a single locus segregates 2:2 in every tetrad without crossing over', () => {
  const rng = makeRng(1);
  const cell = twoLocusCell();
  for (let i = 0; i < 200; i++) {
    const { products } = meiosis(cell, rng, { crossingOver: false });
    const alleles = products.map((p) => productAllele(p, cell.karyotype, 'A'));
    assert.equal(alleles.filter((x) => x === 'A').length, 2);
  }
});

test('Metaphase I orientation is 50/50', () => {
  const rng = makeRng(2);
  const cell = twoLocusCell();
  let pole0GetsA = 0;
  const n = 10000;
  for (let i = 0; i < n; i++) {
    const { products } = meiosis(cell, rng, { crossingOver: false });
    if (productAllele(products[0], cell.karyotype, 'A') === 'A') pole0GetsA++;
  }
  assert.ok(Math.abs(pole0GetsA / n - 0.5) < 0.02);
});

test('a single forced crossover between the loci makes exactly 2 of 4 products recombinant', () => {
  const rng = makeRng(3);
  const cell = twoLocusCell();
  for (let i = 0; i < 100; i++) {
    const { products } = meiosis(cell, rng, { crossovers: { 0: [{ pos: 20 }] } });
    const rec = products.filter((p) => isRecombinant(p, cell.karyotype, 'A', 'B', PARENTAL)).length;
    assert.equal(rec, 2);
  }
});

test('with no interference, recombination follows the Haldane mapping function', () => {
  const rng = makeRng(4);
  const rf = recombinationFraction(twoLocusCell({ a: 10, b: 30 }), rng, 20000);
  assert.ok(Math.abs(rf - haldane(20)) < 0.01, `rf ${rf} vs ${haldane(20)}`);
});

test('loci 3000 cM apart behave as unlinked (25% of each gamete class)', () => {
  const rng = makeRng(5);
  const rf = recombinationFraction(twoLocusCell({ length: 3100, a: 10, b: 3010 }), rng, 3000);
  assert.ok(Math.abs(rf - 0.5) < 0.02, `rf ${rf}`);
});

test('loci on different chromosomes assort independently', () => {
  const rng = makeRng(6);
  const karyotype = [
    { id: '1', length: 100, centromere: 50, loci: [{ id: 'A', pos: 20 }] },
    { id: '2', length: 100, centromere: 50, loci: [{ id: 'B', pos: 20 }] },
  ];
  const cell = diploid(karyotype, [
    [haplotype({ A: 'A' }), haplotype({ A: 'a' })],
    [haplotype({ B: 'B' }), haplotype({ B: 'b' })],
  ]);
  let rec = 0;
  let total = 0;
  for (let i = 0; i < 10000; i++) {
    for (const p of meiosis(cell, rng).products) {
      total++;
      if (isRecombinant(p, karyotype, 'A', 'B', PARENTAL)) rec++;
    }
  }
  assert.ok(Math.abs(rec / total - 0.5) < 0.015);
});

test('interference raises RF toward map distance and suppresses double crossovers', () => {
  // Three loci: A at 10, B at 20, C at 30.
  const karyotype = [{ id: '1', length: 100, centromere: 0, loci: [{ id: 'A', pos: 10 }, { id: 'B', pos: 20 }, { id: 'C', pos: 30 }] }];
  const cell = diploid(karyotype, [[haplotype({ A: 'A', B: 'B', C: 'C' }), haplotype({ A: 'a', B: 'b', C: 'c' })]]);
  function coincidence(m, seed) {
    const rng = makeRng(seed);
    let r1 = 0;
    let r2 = 0;
    let dco = 0;
    let n = 0;
    for (let i = 0; i < 20000; i++) {
      for (const p of meiosis(cell, rng, { interference: m }).products) {
        const g = ['A', 'B', 'C'].map((l) => productAllele(p, karyotype, l));
        const x1 = (g[0] === 'A') !== (g[1] === 'B');
        const x2 = (g[1] === 'B') !== (g[2] === 'C');
        n++;
        if (x1) r1++;
        if (x2) r2++;
        if (x1 && x2) dco++;
      }
    }
    return dco / n / ((r1 / n) * (r2 / n));
  }
  const c0 = coincidence(0, 7);
  const c4 = coincidence(4, 8);
  assert.ok(c0 > 0.8 && c0 < 1.2, `no interference c = ${c0}`);
  assert.ok(c4 < 0.4, `strong interference c = ${c4}`);

  const rfInterference = recombinationFraction(twoLocusCell({ a: 10, b: 30 }), makeRng(9), 20000, { interference: 4 });
  assert.ok(rfInterference > haldane(20) + 0.01, `rf with interference ${rfInterference}`);
});

test('MII segregation frequency matches the centromere-distance formula', () => {
  const rng = makeRng(10);
  const cell = twoLocusCell({ centromere: 0, a: 10, b: 60 });
  let mii = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    if (segregationDivision(meiosis(cell, rng).products, cell.karyotype, 'A') === 'MII') mii++;
  }
  assert.ok(Math.abs(mii / n - secondDivisionFrequency(10)) < 0.012, `MII ${mii / n}`);
});

test('tetrads from unlinked genes come out PD = NPD', () => {
  const rng = makeRng(11);
  const karyotype = [
    { id: '1', length: 100, centromere: 50, loci: [{ id: 'A', pos: 48 }] },
    { id: '2', length: 100, centromere: 50, loci: [{ id: 'B', pos: 48 }] },
  ];
  const cell = diploid(karyotype, [
    [haplotype({ A: 'A' }), haplotype({ A: 'a' })],
    [haplotype({ B: 'B' }), haplotype({ B: 'b' })],
  ]);
  const counts = { PD: 0, NPD: 0, TT: 0 };
  for (let i = 0; i < 10000; i++) counts[classifyTetrad(meiosis(cell, rng).products, karyotype, 'A', 'B', PARENTAL)]++;
  assert.ok(Math.abs(counts.PD - counts.NPD) / 10000 < 0.03, JSON.stringify(counts));
});

test('MI non-disjunction gives heterozygous disomics; MII gives homozygous disomics', () => {
  const rng = makeRng(12);
  const cell = twoLocusCell({ centromere: 5, a: 6, b: 90 });

  const mi = meiosis(cell, rng, { crossingOver: false, nondisjunction: { 0: { stage: 'MI', pole: 0 } } }).products;
  assert.deepEqual(mi.map((p) => p.chromosomes[0].length), [2, 2, 0, 0]);
  for (const p of mi.slice(0, 2)) assert.equal(productAllele(p, cell.karyotype, 'A'), 'A/a');

  const mii = meiosis(cell, rng, { crossingOver: false, orientation: { 0: 0 }, nondisjunction: { 0: { stage: 'MII', pole: 0 } } }).products;
  const disomic = mii.find((p) => p.chromosomes[0].length === 2);
  assert.equal(productAllele(disomic, cell.karyotype, 'A'), 'A/A');
  assert.equal(mii.filter((p) => p.chromosomes[0].length === 1).length, 2);
  assert.equal(mii.filter((p) => p.nullisomic).length, 1);
});

test('a crossover between centromere and locus makes an MII disomic heterozygous at that locus', () => {
  const rng = makeRng(13);
  const cell = twoLocusCell({ centromere: 5, a: 6, b: 90 });
  const { products } = meiosis(cell, rng, {
    orientation: { 0: 0 },
    crossovers: { 0: [{ pos: 50, pair: [0, 2] }] },
    nondisjunction: { 0: { stage: 'MII', pole: 0 } },
  });
  const disomic = products.find((p) => p.chromosomes[0].length === 2);
  assert.equal(productAllele(disomic, cell.karyotype, 'A'), 'A/A', 'centromere-linked locus stays homozygous');
  const distal = productAllele(disomic, cell.karyotype, 'B').split('/').sort().join('/');
  assert.equal(distal, 'B/b', 'distal locus becomes heterozygous');
});

test('inversion heterozygotes suppress recombination among viable products', () => {
  const para = twoLocusCell({ length: 100, centromere: 5, a: 30, b: 60, inversion: { start: 20, end: 70 } });
  const peri = twoLocusCell({ length: 100, centromere: 45, a: 30, b: 60, inversion: { start: 20, end: 70 } });
  const normal = twoLocusCell({ length: 100, centromere: 5, a: 30, b: 60 });

  const rfNormal = recombinationFraction(normal, makeRng(14), 5000);
  const rfPara = recombinationFraction(para, makeRng(15), 5000, {}, { viableOnly: true });
  const rfPeri = recombinationFraction(peri, makeRng(16), 5000, {}, { viableOnly: true });
  assert.ok(rfNormal > 0.2, `normal ${rfNormal}`);
  // Some viable recombinants remain: two-strand double crossovers inside the loop are balanced.
  assert.ok(rfPara < rfNormal / 3, `paracentric ${rfPara} vs normal ${rfNormal}`);
  assert.ok(rfPeri < rfNormal / 3, `pericentric ${rfPeri} vs normal ${rfNormal}`);

  const single = meiosis(para, makeRng(17), { crossovers: { 0: [{ pos: 45, pair: [0, 2] }] } }).products;
  const kinds = single.flatMap((p) => p.chromosomes[0].map((c) => c.aberration)).filter(Boolean).sort();
  assert.deepEqual(kinds, ['acentric', 'dicentric']);
  assert.equal(single.filter((p) => p.viable).length, 2);
});

test('mitosis copies the genotype; fertilization combines gametes', () => {
  const rng = makeRng(18);
  const cell = twoLocusCell();
  const [d1, d2] = mitosis(cell);
  assert.deepEqual(allelesAt(d1, 'A'), ['A', 'a']);
  assert.deepEqual(allelesAt(d2, 'A'), ['A', 'a']);
  const { products } = meiosis(cell, rng, { crossingOver: false, orientation: { 0: 0 } });
  const zygote = fertilize(products[0].cell, products[3].cell);
  assert.deepEqual(allelesAt(zygote, 'A'), ['A', 'a']);
});

test('the same seed reproduces the same meiosis', () => {
  const cell = twoLocusCell();
  const run = (seed) => meiosis(cell, makeRng(seed)).products.map((p) => productAllele(p, cell.karyotype, 'B')).join();
  assert.equal(run(99), run(99));
});

test('mapping functions invert', () => {
  for (const d of [1, 12, 50, 150]) {
    assert.ok(Math.abs(haldaneInverse(haldane(d)) - d) < 1e-9);
    assert.ok(Math.abs(kosambiInverse(kosambi(d)) - d) < 1e-9);
  }
  assert.ok(Math.abs(haldane(3000) - 0.5) < 1e-9);
});
