import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../js/core/rng.js';
import { haplotype, diploid, alleleOn } from '../js/engine/genome.js';
import { meiosis } from '../js/engine/meiosis.js';
import { dihybridGametes, dihybridPhenotypes, metaphaseIAlignments, gameteChoices } from '../js/engine/dihybrid.js';
import { TRAITS } from '../js/species/catalog.js';
import { integerRatio, fraction } from '../js/engine/cross.js';

const spots = TRAITS.spots; // S / s, complete dominance
const ears = TRAITS.ears; // E / e

const het = (trait, [x, y]) => ({ trait, alleles: [x, y] });
const SsEe = [het(spots, ['S', 's']), het(ears, ['E', 'e'])];

// Two chromosomes, one gene each, from a diploid parent.
function twoChromosomeCell(genes) {
  const karyotype = genes.map((g, i) => ({ id: String(i + 1), length: 100, centromere: 42, loci: [{ id: g.trait.id, pos: 30 }] }));
  const haps = genes.map((g) => g.alleles.map((a) => haplotype({ [g.trait.id]: a })));
  return { karyotype, cell: diploid(karyotype, haps) };
}

test('dihybrid gametes: four equally likely combinations from SsEe', () => {
  const gametes = dihybridGametes(SsEe);
  assert.equal(gametes.length, 4);
  const keys = gametes.map((g) => g.alleles.join(' ')).sort();
  assert.deepEqual(keys, ['S E', 'S e', 's E', 's e']);
  for (const g of gametes) assert.equal(g.p, 0.25);
});

test('engine meioses on two chromosomes give the same four gametes, each about 1/4', () => {
  const { cell } = twoChromosomeCell(SsEe);
  const rng = makeRng(7);
  const counts = new Map();
  const n = 4000;
  for (let i = 0; i < n; i++) {
    for (const p of meiosis(cell, rng, { crossingOver: false }).products) {
      const key = SsEe.map((g, k) => alleleOn(p.chromosomes[k][0], { id: g.trait.id, pos: 30 })).join(' ');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const expected = dihybridGametes(SsEe).map((g) => g.alleles.join(' ')).sort();
  assert.deepEqual([...counts.keys()].sort(), expected);
  for (const v of counts.values()) assert.ok(Math.abs(v / (4 * n) - 0.25) < 0.02, `frequency ${v / (4 * n)}`);
});

test('product rule: P(s and E) from SsEe is 1/2 x 1/2 = 1/4', () => {
  const p = dihybridGametes(SsEe).filter((g) => g.alleles[0] === 's' && g.alleles[1] === 'E').reduce((s, g) => s + g.p, 0);
  assert.equal(p, 0.25);
});

test('SsEe x SsEe gives 9:3:3:1 across phenotype classes', () => {
  const classes = dihybridPhenotypes(SsEe, SsEe);
  assert.deepEqual(integerRatio(classes.map((c) => c.p)), [9, 3, 3, 1]);
  const both = classes.find((c) => c.label === 'spotted, perky ears');
  assert.equal(fraction(both.p), '9/16');
});

test('product rule for a double recessive: P(ss ee) = 1/4 x 1/4 = 1/16', () => {
  const classes = dihybridPhenotypes(SsEe, SsEe);
  const plainFloppy = classes.find((c) => c.label === 'plain, floppy ears');
  assert.equal(fraction(plainFloppy.p), '1/16');
});

test('SsEe x ssee gives 1:1:1:1', () => {
  const ssee = [het(spots, ['s', 's']), het(ears, ['e', 'e'])];
  const classes = dihybridPhenotypes(SsEe, ssee);
  assert.deepEqual(integerRatio(classes.map((c) => c.p)), [1, 1, 1, 1]);
});

test('two bivalents have two Metaphase I alignments, which together make the four gametes', () => {
  const alignments = metaphaseIAlignments(SsEe);
  assert.equal(alignments.length, 2);
  for (const a of alignments) assert.equal(a.p, 0.5);
  const kinds = alignments.flatMap((a) => a.poles.map((x) => x.join(' '))).sort();
  assert.deepEqual(kinds, dihybridGametes(SsEe).map((g) => g.alleles.join(' ')).sort());
  // Each alignment sends one allele of every gene to each pole.
  for (const { poles } of alignments) for (let i = 0; i < 2; i++) assert.notEqual(poles[0][i], poles[1][i]);
});

test('three bivalents have four alignments', () => {
  const three = [...SsEe, het(TRAITS.tail, ['T', 't'])];
  assert.equal(metaphaseIAlignments(three).length, 4);
});

test('gamete choices: the four real gametes plus look-alikes that are not haploid', () => {
  const choices = gameteChoices(SsEe);
  assert.deepEqual(choices.filter((c) => c.kind === 'gamete').map((c) => c.text).sort(), ['S ; E', 'S ; e', 's ; E', 's ; e']);
  const fakes = choices.filter((c) => c.kind === 'notHaploid').map((c) => c.text);
  for (const t of ['S/s ; E/e', 'SsEe', 'Ss ; Ee']) assert.ok(fakes.includes(t), t);
  assert.equal(new Set(choices.map((c) => c.text)).size, choices.length);
});

test('gamete choices for a homozygote list its one real gamete once', () => {
  const ssee = [het(spots, ['s', 's']), het(ears, ['e', 'e'])];
  assert.deepEqual(gameteChoices(ssee).filter((c) => c.kind === 'gamete').map((c) => c.text), ['s ; e']);
});
