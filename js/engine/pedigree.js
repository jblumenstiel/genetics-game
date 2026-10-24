// Three-generation human pedigrees for one trait, simulated by Mendelian (or uniparental) transmission and kept only
// when they show their mode of inheritance clearly.
//
// Shape: two grandparent couples (I-1 × I-2 and I-3 × I-4), each with a sibship in generation II. The last child of
// the first family marries the first child of the second, and their children are generation III.
//
// Dominant modes call the trait allele A (a is normal); recessive modes call the trait allele a (A is normal).

import { makeRng, int } from '../core/rng.js';

export const MODES = {
  ar: { label: 'Autosomal recessive allele', short: 'autosomal recessive' },
  ad: { label: 'Autosomal dominant allele', short: 'autosomal dominant' },
  xr: { label: 'X-linked recessive allele', short: 'X-linked recessive' },
  xd: { label: 'X-linked dominant allele', short: 'X-linked dominant' },
  y: { label: 'Y-linked dominant allele', short: 'Y-linked' },
  mt: { label: 'Mitochondrial dominant allele', short: 'mitochondrial' },
};

const pickBy = (rng, weights) => {
  let r = rng() * weights.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of weights) if ((r -= w) < 0) return v;
  return weights[weights.length - 1][0];
};
const either = (rng, pair) => pair[rng() < 0.5 ? 0 : 1];
const sorted = (pair) => [...pair].sort(); // 'A' before 'a'

// A founder's alleles, at frequencies that make clear pedigrees reasonably common for each mode.
function founder(mode, sex, rng) {
  switch (mode) {
    case 'ar':
      return { auto: pickBy(rng, [[['A', 'A'], 45], [['A', 'a'], 40], [['a', 'a'], 15]]) };
    case 'ad':
      return { auto: pickBy(rng, [[['a', 'a'], 70], [['A', 'a'], 30]]) };
    case 'xr':
      return { x: sex === 'F' ? pickBy(rng, [[['A', 'A'], 55], [['A', 'a'], 45]]) : [pickBy(rng, [['A', 70], ['a', 30]])] };
    case 'xd':
      return { x: sex === 'F' ? pickBy(rng, [[['a', 'a'], 65], [['A', 'a'], 35]]) : [pickBy(rng, [['a', 65], ['A', 35]])] };
    case 'y':
      return sex === 'M' ? { y: pickBy(rng, [['A', 50], ['a', 50]]) } : {};
    case 'mt':
      return { mt: pickBy(rng, [['A', 45], ['a', 55]]) };
  }
  throw new Error(`Unknown mode ${mode}`);
}

// A child's alleles from its mother and father.
function inherit(mode, sex, mother, father, rng) {
  switch (mode) {
    case 'ar':
    case 'ad':
      return { auto: sorted([either(rng, mother.g.auto), either(rng, father.g.auto)]) };
    case 'xr':
    case 'xd':
      // A daughter gets her father's only X; a son gets his father's Y, so only the mother's X.
      return { x: sex === 'F' ? sorted([either(rng, mother.g.x), father.g.x[0]]) : [either(rng, mother.g.x)] };
    case 'y':
      return sex === 'M' ? { y: father.g.y } : {};
    case 'mt':
      // Mitochondria come from the egg only.
      return { mt: mother.g.mt };
  }
  throw new Error(`Unknown mode ${mode}`);
}

export function isAffected(mode, p) {
  const { g } = p;
  switch (mode) {
    case 'ar':
      return g.auto[0] === 'a' && g.auto[1] === 'a';
    case 'ad':
      return g.auto.includes('A');
    case 'xr':
      return g.x.every((a) => a === 'a');
    case 'xd':
      return g.x.includes('A');
    case 'y':
      return p.sex === 'M' && g.y === 'A';
    case 'mt':
      return g.mt === 'A';
  }
  throw new Error(`Unknown mode ${mode}`);
}

// A genotype as parts for display: [{ text, sup? }], so X-linked alleles can be superscripts on X.
export function genotypeParts(mode, p) {
  const { g } = p;
  switch (mode) {
    case 'ar':
    case 'ad':
      return [{ text: `${g.auto[0]}/${g.auto[1]}` }];
    case 'xr':
    case 'xd':
      return p.sex === 'F'
        ? [{ text: 'X' }, { text: g.x[0], sup: true }, { text: 'X' }, { text: g.x[1], sup: true }]
        : [{ text: 'X' }, { text: g.x[0], sup: true }, { text: 'Y' }];
    case 'y':
      return p.sex === 'F' ? [{ text: 'XX' }] : [{ text: 'XY' }, { text: g.y, sup: true }];
    case 'mt':
      return [{ text: 'mt' }, { text: g.mt, sup: true }];
  }
  throw new Error(`Unknown mode ${mode}`);
}

export const genotypeText = (mode, p) => genotypeParts(mode, p).map((x) => (x.sup ? `^${x.text}` : x.text)).join('');

// One random pedigree, without checking that it shows anything.
export function simulate(mode, rng) {
  const person = (gen, sex, g) => ({ gen, sex, g });
  const randomSex = () => (rng() < 0.5 ? 'M' : 'F');
  const I = [person(0, 'M'), person(0, 'F'), person(0, 'M'), person(0, 'F')];
  I.forEach((p) => (p.g = founder(mode, p.sex, rng)));
  const sibship = (mother, father, n, gen) =>
    Array.from({ length: n }, () => {
      const sex = randomSex();
      return person(gen, sex, inherit(mode, sex, mother, father, rng));
    });
  const famA = sibship(I[1], I[0], int(rng, 2, 4), 1);
  const famB = sibship(I[3], I[2], int(rng, 2, 4), 1);
  // The last child of family A marries the first child of family B, so the spouses are of opposite sexes.
  const a = famA[famA.length - 1];
  const bSex = a.sex === 'M' ? 'F' : 'M';
  famB[0] = person(1, bSex, inherit(mode, bSex, I[3], I[2], rng));
  const b = famB[0];
  const father = a.sex === 'M' ? a : b;
  const mother = father === a ? b : a;
  const III = sibship(mother, father, int(rng, 3, 6), 2);
  const II = [...famA, ...famB];
  [I, II, III].forEach((gen, k) => gen.forEach((p, i) => (p.id = `${['I', 'II', 'III'][k]}-${i + 1}`)));
  // Parent links, for the checks and the drawing.
  famA.forEach((p) => Object.assign(p, { mother: I[1], father: I[0] }));
  famB.forEach((p) => Object.assign(p, { mother: I[3], father: I[2] }));
  III.forEach((p) => Object.assign(p, { mother, father }));
  return { mode, I, II, III, nA: famA.length, couple: { mother, father } };
}

// Does this pedigree show its mode clearly? Each mode lists the observations that tell it apart from the others.
export function showsPattern(ped) {
  const { mode } = ped;
  const all = [...ped.I, ...ped.II, ...ped.III];
  const aff = (p) => isAffected(mode, p);
  const affected = all.filter(aff);
  const children = (parent) => all.filter((c) => c.mother === parent || c.father === parent);
  const parents = all.filter((p) => children(p).length);
  const inGen = (gen) => all.some((p) => p.gen === gen && aff(p));
  const bothSexes = affected.some((p) => p.sex === 'M') && affected.some((p) => p.sex === 'F');
  if (!affected.length || affected.length > all.length * 0.6) return false;

  switch (mode) {
    case 'ar': {
      const { mother, father } = ped.couple;
      const affIII = ped.III.filter(aff);
      return (
        // affected children of two unaffected parents (not dominant),
        !aff(mother) && !aff(father) && affIII.length >= 1 && affIII.length <= ped.III.length / 2 &&
        // an affected daughter of an unaffected father (not X-linked recessive),
        all.some((p) => p.sex === 'F' && aff(p) && p.father && !aff(p.father)) &&
        // both sexes affected, and the trait skips a generation.
        bothSexes && (inGen(0) || inGen(1)) && affected.length <= 5
      );
    }
    case 'ad':
      return (
        // affected in every generation,
        inGen(0) && inGen(1) && inGen(2) && bothSexes &&
        // father-to-son transmission (not X-linked),
        all.some((p) => p.sex === 'M' && aff(p) && p.father && aff(p.father)) &&
        // and an affected parent with an unaffected child (a heterozygote; not every child is affected).
        parents.some((p) => aff(p) && children(p).some((c) => !aff(c)))
      );
    case 'xr': {
      const { mother, father } = ped.couple;
      return (
        // only males affected, including sons of two unaffected parents (a carrier mother),
        affected.every((p) => p.sex === 'M') &&
        ped.III.some((p) => aff(p)) && !aff(mother) && !aff(father) &&
        // and an affected grandfather or uncle, so it passes through carrier daughters.
        (inGen(0) || inGen(1)) && affected.length >= 2
      );
    }
    case 'xd':
      return (
        // an affected father whose daughters are all affected and sons all unaffected (not autosomal),
        parents.some((p) => p.sex === 'M' && aff(p) && children(p).some((c) => c.sex === 'F') && children(p).some((c) => c.sex === 'M')) &&
        // an affected mother with affected and unaffected children,
        parents.some((p) => p.sex === 'F' && aff(p) && children(p).some(aff) && children(p).some((c) => !aff(c))) &&
        affected.length >= 3
      );
    case 'y':
      return (
        // affected in every generation, father to every son, never to daughters,
        inGen(0) && inGen(1) && inGen(2) &&
        parents.some((p) => aff(p) && children(p).filter((c) => c.sex === 'M').length >= 2 && children(p).some((c) => c.sex === 'F')) &&
        // and unaffected men from an unaffected father, for contrast.
        all.some((p) => p.sex === 'M' && !aff(p) && p.father && !aff(p.father))
      );
    case 'mt':
      return (
        // affected in every generation and both sexes,
        inGen(0) && inGen(1) && inGen(2) && bothSexes &&
        // an affected mother whose children are all affected (two or more),
        parents.some((p) => p.sex === 'F' && aff(p) && children(p).length >= 2) &&
        // and an affected father whose children are all unaffected.
        parents.some((p) => p.sex === 'M' && aff(p) && children(p).every((c) => !aff(c)))
      );
  }
  throw new Error(`Unknown mode ${mode}`);
}

// The first pedigree from this seed that shows its mode clearly. The same mode and seed always give the same one.
export function pedigreeFor(mode, seed, maxTries = 20000) {
  const rng = makeRng(seed);
  for (let i = 0; i < maxTries; i++) {
    const ped = simulate(mode, rng);
    if (showsPattern(ped)) return { ...ped, seed, tries: i + 1 };
  }
  return null;
}
