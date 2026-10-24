// Mechanisms of dominance, as rules from genotype to phenotype, for Module 2 (Dominance zoo).
//
// A genotype here is a pair of allele kinds:
//   '+'  the normal (wild-type) allele, which makes a working product
//   'm'  the mutant allele whose behaviour depends on the mechanism
//   'Δ'  a deletion of the gene: no copy at all
// Every phenotype is judged for one trait at a time, so an allele can be dominant for one trait and recessive for
// another (a recessive lethal that is dominant for coat color).

import { fraction } from './cross.js';

export const MECHANISMS = {
  recessive: { label: 'recessive', kind: 'loss of function' },
  haploinsufficient: { label: 'dominant', kind: 'loss of function' },
  dominantNegative: { label: 'dominant negative', kind: 'interferes with the normal product' },
  gainOfFunction: { label: 'gain of function', kind: 'new or excess activity' },
  recessiveLethal: { label: 'recessive lethal', kind: 'loss of an essential function' },
  dominantLethal: { label: 'dominant lethal', kind: 'one copy kills' },
};

// The five kinds of allele the Module 2 problems ask students to tell apart.
export const QUIZ_CATEGORIES = ['recessive', 'haploinsufficient', 'dominantNegative', 'recessiveLethal', 'dominantLethal'];

const count = (g, a) => g.filter((x) => x === a).length;

// Working copies of the normal product, as a fraction of the normal two-copy amount.
export function dose(g) {
  return count(g, '+') / 2;
}

// The phenotype of genotype g under a mechanism: { survives, mutant }. mutant is the trait the gene is named for
// (straight tail, floppy ears, golden body...), judged only for individuals that survive.
export function phenotypeOf(mechanism, g) {
  const plus = count(g, '+');
  const m = count(g, 'm');
  switch (mechanism) {
    case 'recessive':
      return { survives: true, mutant: plus === 0 };
    case 'haploinsufficient':
      return { survives: true, mutant: plus < 2 };
    case 'dominantNegative':
      // The mutant product spoils the normal one; with no product at all the phenotype is lost too.
      return { survives: true, mutant: m > 0 || plus === 0 };
    case 'gainOfFunction':
      // Only the mutant product has the new activity, so losing the gene does not make the phenotype.
      return { survives: true, mutant: m > 0 };
    case 'recessiveLethal':
      // The visible trait (golden body) needs one mutant copy; two copies, or no working copy, are lethal.
      return plus === 0 ? { survives: false, mutant: null } : { survives: true, mutant: m > 0 };
    case 'dominantLethal':
      return m > 0 ? { survives: false, mutant: null } : { survives: true, mutant: false };
  }
  throw new Error(`Unknown mechanism ${mechanism}`);
}

// The genotypes a problem shows for each kind of allele. A deletion heterozygote (+/Δ) is the clue that separates a
// dominant (haploinsufficient) allele from a dominant negative one.
export const EVIDENCE_GENOTYPES = [
  ['+', '+'],
  ['+', 'm'],
  ['m', 'm'],
  ['+', 'Δ'],
];

export function evidence(mechanism) {
  return EVIDENCE_GENOTYPES.map((g) => ({ g, ...phenotypeOf(mechanism, g) }));
}

// Reads a kind of allele back from the phenotypes of the evidence genotypes. Returns a QUIZ_CATEGORIES id, or
// 'gainOfFunction' when a dominant allele is not explained by losing a copy and could also be a dominant negative.
export function classify(ev) {
  const at = (a, b) => ev.find((e) => (e.g[0] === a && e.g[1] === b) || (e.g[0] === b && e.g[1] === a));
  const het = at('+', 'm');
  const hom = at('m', 'm');
  const del = at('+', 'Δ');
  if (!het.survives) return 'dominantLethal';
  if (!hom.survives) return 'recessiveLethal';
  if (!het.mutant) return 'recessive';
  if (del.mutant) return 'haploinsufficient';
  return 'dominantNegative';
}

// Offspring of a cross among those that survive: [{ g, p, mutant }] with p summing to 1, and the probability that
// a zygote does not survive.
export function survivors(mechanism, p1, p2) {
  const zygotes = [];
  for (const a of p1) for (const b of p2) zygotes.push([a, b].sort((x, y) => '+mΔ'.indexOf(x) - '+mΔ'.indexOf(y)));
  const alive = zygotes.filter((g) => phenotypeOf(mechanism, g).survives);
  const byKey = new Map();
  for (const g of alive) {
    const key = g.join('/');
    const e = byKey.get(key) ?? { g, n: 0, mutant: phenotypeOf(mechanism, g).mutant };
    e.n++;
    byKey.set(key, e);
  }
  return {
    lost: 1 - alive.length / zygotes.length,
    classes: [...byKey.values()].map(({ g, n, mutant }) => ({ g, mutant, p: n / alive.length })),
  };
}

// Mutant : normal phenotype ratio among survivors, as small whole numbers ("2 : 1").
export function survivorRatio(mechanism, p1, p2) {
  const { classes } = survivors(mechanism, p1, p2);
  const mutant = classes.filter((c) => c.mutant).reduce((s, c) => s + c.p, 0);
  const normal = 1 - mutant;
  for (let d = 1; d <= 12; d++) {
    const a = mutant * d;
    const b = normal * d;
    if (Math.abs(a - Math.round(a)) < 1e-9 && Math.abs(b - Math.round(b)) < 1e-9) return `${Math.round(a)} : ${Math.round(b)}`;
  }
  return `${fraction(mutant)} : ${fraction(normal)}`;
}

// Dominant negative in a complex of n subunits: with half the subunits mutant, the fraction of complexes made only
// of normal subunits is (½)^n.
export function normalComplexFraction(n, mutantShare = 0.5) {
  return (1 - mutantShare) ** n;
}

// Dosage and a threshold: the phenotype is normal when the working product is at least the fraction the trait needs.
// At 50% or below, one copy is enough (haplosufficient) and the loss-of-function allele is recessive; above 50%,
// one copy falls short (haploinsufficient) and it is dominant.
export function thresholdVerdict(threshold) {
  return threshold <= 0.5 ? 'haplosufficient' : 'haploinsufficient';
}

export function meetsThreshold(g, threshold) {
  return dose(g) >= threshold;
}
