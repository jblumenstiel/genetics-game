// Pure genetics logic for the meiosis engine. No rendering code lives here,
// so it can be tested in Node and reused by every module.

// Small seeded PRNG (mulberry32). Passing the same seed reproduces the same
// sequence of random outcomes, so a generated instance can be shared or replayed.
export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A genotype is two allele symbols, e.g. 'Ss'. Uppercase is dominant.
export function alleles(genotype) {
  return [genotype[0], genotype[1]];
}

// Single locus, no crossing over.
// Meiosis I: the two homologs go to opposite poles, chosen at random.
// Meiosis II: sister chromatids separate, so each pole yields two identical spores.
export function segregateSingleLocus(genotype, rng) {
  const [h1, h2] = alleles(genotype);
  const flip = rng() < 0.5;
  const poles = flip ? [[h2, h2], [h1, h1]] : [[h1, h1], [h2, h2]];
  return { poles, spores: poles.flat() };
}

// Genotype -> phenotype for the creature. 'S' (spots) is dominant over 's' (plain).
export function phenotype(genotype) {
  return genotype.includes('S') ? 'spotted' : 'plain';
}
