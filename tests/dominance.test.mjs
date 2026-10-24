import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MECHANISMS, QUIZ_CATEGORIES, phenotypeOf, evidence, classify, survivors, survivorRatio, normalComplexFraction, thresholdVerdict, meetsThreshold, dose } from '../js/engine/dominance.js';

const mutant = (m, a, b) => phenotypeOf(m, [a, b]).mutant;
const lives = (m, a, b) => phenotypeOf(m, [a, b]).survives;

test('recessive and haploinsufficient loss of function differ only in the heterozygote', () => {
  assert.deepEqual([mutant('recessive', '+', '+'), mutant('recessive', '+', 'm'), mutant('recessive', 'm', 'm')], [false, false, true]);
  assert.deepEqual([mutant('haploinsufficient', '+', '+'), mutant('haploinsufficient', '+', 'm'), mutant('haploinsufficient', 'm', 'm')], [false, true, true]);
  // A deletion behaves like the loss-of-function allele.
  assert.equal(mutant('recessive', '+', 'Δ'), false);
  assert.equal(mutant('haploinsufficient', '+', 'Δ'), true);
});

test('dominant negative and gain of function: the deletion heterozygote is normal', () => {
  for (const m of ['dominantNegative', 'gainOfFunction']) {
    assert.equal(mutant(m, '+', 'm'), true);
    assert.equal(mutant(m, '+', 'Δ'), false);
  }
  // Losing the gene entirely gives the loss phenotype for a dominant negative, but not the new gain-of-function trait.
  assert.equal(mutant('dominantNegative', 'Δ', 'Δ'), true);
  assert.equal(mutant('gainOfFunction', 'Δ', 'Δ'), false);
});

test('lethals: recessive kills only the homozygote, dominant kills the heterozygote', () => {
  assert.deepEqual([lives('recessiveLethal', '+', '+'), lives('recessiveLethal', '+', 'm'), lives('recessiveLethal', 'm', 'm')], [true, true, false]);
  assert.equal(mutant('recessiveLethal', '+', 'm'), true); // dominant for the visible trait
  assert.deepEqual([lives('dominantLethal', '+', '+'), lives('dominantLethal', '+', 'm')], [true, false]);
});

test('classify reads every quiz category back from its own evidence', () => {
  for (const c of QUIZ_CATEGORIES) assert.equal(classify(evidence(c)), c, c);
  assert.ok(Object.keys(MECHANISMS).length === 6);
});

test('recessive lethal: survivors of two heterozygotes are 2 : 1, and all mutant survivors are heterozygous', () => {
  const s = survivors('recessiveLethal', ['+', 'm'], ['+', 'm']);
  assert.equal(s.lost, 0.25);
  assert.equal(survivorRatio('recessiveLethal', ['+', 'm'], ['+', 'm']), '2 : 1');
  const mut = s.classes.filter((c) => c.mutant);
  assert.equal(mut.length, 1);
  assert.deepEqual(mut[0].g, ['+', 'm']);
  assert.ok(Math.abs(mut[0].p - 2 / 3) < 1e-12);
  // Without lethality the same cross would be 3 : 1.
  assert.equal(survivorRatio('haploinsufficient', ['+', 'm'], ['+', 'm']), '3 : 1');
  assert.equal(survivorRatio('recessive', ['+', 'm'], ['+', 'm']), '1 : 3');
});

test('dominant negative complexes: a dimer is all normal ¼ of the time, a tetramer 1/16', () => {
  assert.equal(normalComplexFraction(2), 0.25);
  assert.equal(normalComplexFraction(4), 1 / 16);
});

test('dosage threshold: at or below 50% one copy is enough', () => {
  assert.equal(dose(['+', 'm']), 0.5);
  assert.equal(thresholdVerdict(0.35), 'haplosufficient');
  assert.equal(thresholdVerdict(0.5), 'haplosufficient');
  assert.equal(thresholdVerdict(0.7), 'haploinsufficient');
  assert.equal(meetsThreshold(['+', 'm'], 0.35), true);
  assert.equal(meetsThreshold(['+', 'm'], 0.7), false);
  assert.equal(meetsThreshold(['+', '+'], 0.7), true);
});
