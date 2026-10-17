import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../js/core/rng.js';
import { haplotype, diploid } from '../js/engine/genome.js';
import { meiosis, fertilize } from '../js/engine/meiosis.js';
import { nucleusFromCell, metaphaseIINuclei, gameteNuclei, evaluate, minCrossovers, parseFrequency, nucleusKey } from '../js/engine/drawing.js';

const K = [{ id: '1', length: 100, centromere: 42, loci: [{ id: 'B', pos: 20 }] }];
const LOCI = ['B'];
const rng = makeRng(1);
const mother = diploid(K, [[haplotype({ B: 'B' }), haplotype({ B: 'B' })]]);
const father = diploid(K, [[haplotype({ B: 'b' }), haplotype({ B: 'b' })]]);
const egg = meiosis(mother, rng, { crossingOver: false }).products[0].cell;
const sperm = meiosis(father, rng, { crossingOver: false }).products[0].cell;
const zygote = fertilize(egg, sperm);

const chrom = (...alleles) => ({ kind: 'chromosome', chrom: '1', chromatids: alleles.map((a) => ({ alleles: { B: a } })) });
const biv = (h1, h2, crossovers = []) => ({ kind: 'bivalent', chrom: '1', homologs: [h1, h2], crossovers });
const codes = (r) => r.problems.map((p) => p.code);

test('egg and sperm are graded by label', () => {
  const expected = [nucleusFromCell(egg, { label: 'Egg' }), nucleusFromCell(sperm, { label: 'Sperm' })];
  const right = [{ label: 'Egg', items: [chrom('B')] }, { label: 'Sperm', items: [chrom('b')] }];
  const swapped = [{ label: 'Egg', items: [chrom('b')] }, { label: 'Sperm', items: [chrom('B')] }];
  assert.ok(evaluate(right, expected, { loci: LOCI, matchBy: 'label' }).ok);
  assert.deepEqual(codes(evaluate(swapped, expected, { loci: LOCI, matchBy: 'label' })), ['content', 'content']);
  const replicated = [{ label: 'Egg', items: [chrom('B', 'B')] }, { label: 'Sperm', items: [chrom('b')] }];
  assert.deepEqual(codes(evaluate(replicated, expected, { loci: LOCI, matchBy: 'label' })), ['chromatid-count']);
});

test('zygote has two unreplicated homologs', () => {
  const expected = [nucleusFromCell(zygote, { label: 'Zygote' })];
  assert.ok(evaluate([{ label: 'Zygote', items: [chrom('b'), chrom('B')] }], expected, { loci: LOCI }).ok);
  assert.deepEqual(codes(evaluate([{ label: 'Zygote', items: [chrom('B')] }], expected, { loci: LOCI })), ['chromosome-count']);
  assert.deepEqual(codes(evaluate([{ label: 'Zygote', items: [chrom('B'), chrom(null)] }], expected, { loci: LOCI })), ['unlabeled']);
});

test('mitotic metaphase: replicated, unpaired, identical sisters', () => {
  const expected = [nucleusFromCell(zygote, { replicated: true })];
  assert.ok(evaluate([{ items: [chrom('B', 'B'), chrom('b', 'b')] }], expected, { loci: LOCI }).ok);
  assert.deepEqual(codes(evaluate([{ items: [biv(chrom('B', 'B'), chrom('b', 'b'))] }], expected, { loci: LOCI })), ['no-pairing']);
  assert.deepEqual(codes(evaluate([{ items: [chrom('B', 'b'), chrom('b', 'B')] }], expected, { loci: LOCI })), ['sisters-differ']);
});

test('mitosis daughters: two identical nuclei', () => {
  const daughter = nucleusFromCell(zygote);
  const expected = [daughter, daughter];
  const right = [{ items: [chrom('B'), chrom('b')] }, { items: [chrom('b'), chrom('B')] }];
  assert.ok(evaluate(right, expected, { loci: LOCI }).ok);
  assert.deepEqual(codes(evaluate([right[0]], expected, { loci: LOCI })), ['nucleus-count']);
  const split = [{ items: [chrom('B'), chrom('B')] }, { items: [chrom('b'), chrom('b')] }];
  assert.deepEqual(codes(evaluate(split, expected, { loci: LOCI })), ['content']);
});

test('metaphase I needs a bivalent and no crossovers for one locus', () => {
  const expected = [nucleusFromCell(zygote, { replicated: true, paired: true })];
  assert.ok(evaluate([{ items: [biv(chrom('b', 'b'), chrom('B', 'B'))] }], expected, { loci: LOCI, minCross: 0 }).ok);
  assert.deepEqual(codes(evaluate([{ items: [chrom('B', 'B'), chrom('b', 'b')] }], expected, { loci: LOCI, minCross: 0 })), ['needs-pairing']);
  const crossed = [{ items: [biv(chrom('B', 'B'), chrom('b', 'b'), [{ interval: 0 }])] }];
  assert.deepEqual(codes(evaluate(crossed, expected, { loci: LOCI, minCross: 0 })), ['crossovers-extra']);
});

test('metaphase II and gametes come from the engine meiosis', () => {
  const result = meiosis(zygote, makeRng(2), { crossingOver: false });
  const mii = metaphaseIINuclei(result);
  assert.deepEqual(mii.map((n) => nucleusKey(n, LOCI)).sort(), ['1[B,B]', '1[b,b]']);
  assert.ok(evaluate([{ items: [chrom('b', 'b')] }, { items: [chrom('B', 'B')] }], mii, { loci: LOCI }).ok);
  const gametes = gameteNuclei(result);
  const right = ['B', 'b', 'B', 'b'].map((a) => ({ items: [chrom(a)] }));
  assert.ok(evaluate(right, gametes, { loci: LOCI }).ok);
  const wrong = ['B', 'B', 'B', 'b'].map((a) => ({ items: [chrom(a)] }));
  assert.deepEqual(codes(evaluate(wrong, gametes, { loci: LOCI })), ['content']);
});

test('minimum crossovers to spell a gamete', () => {
  const homologs = [
    { A: 'A', B: 'B', C: 'C' },
    { A: 'a', B: 'b', C: 'c' },
  ];
  assert.equal(minCrossovers({ A: 'A', B: 'B', C: 'C' }, homologs, ['A', 'B', 'C']), 0);
  assert.equal(minCrossovers({ A: 'A', B: 'b', C: 'c' }, homologs, ['A', 'B', 'C']), 1);
  assert.equal(minCrossovers({ A: 'A', B: 'b', C: 'C' }, homologs, ['A', 'B', 'C']), 2);
});

test('genotype options: three possible, the rest impossible with reasons', async () => {
  const { genotypeOptions } = await import('../js/engine/genotypes.js');
  const opts = genotypeOptions(['B', 'b'], 'D', makeRng(3));
  assert.deepEqual(opts.filter((o) => o.possible).map((o) => o.text).sort(), ['B/B', 'B/b', 'b/b']);
  const impossible = opts.filter((o) => !o.possible);
  assert.equal(impossible.length, 5);
  assert.ok(impossible.every((o) => o.reason.length > 40));
  assert.ok(impossible.some((o) => o.text === 'B ; b'));
});

test('zygotes must be possible from the parents', async () => {
  const { zygoteFromParents } = await import('../js/engine/genotypes.js');
  assert.ok(zygoteFromParents(['B', 'b'], ['B', 'b'], ['b', 'b']).ok);
  assert.ok(zygoteFromParents(['b', 'b'], ['B', 'b'], ['b', 'b']).ok);
  const no = zygoteFromParents(['B', 'B'], ['B', 'b'], ['b', 'b']);
  assert.equal(no.ok, false);
  assert.match(no.reason, /father \(b\/b\) can pass on only b/);
  assert.match(no.reason, /^To be B\/B, the zygote needs B from both parents/);
});

test('frequencies parse from fractions, decimals and percents', () => {
  assert.equal(parseFrequency('1/2'), 0.5);
  assert.equal(parseFrequency(' 0.25 '), 0.25);
  assert.equal(parseFrequency('50%'), 0.5);
  assert.equal(parseFrequency('half'), null);
});
