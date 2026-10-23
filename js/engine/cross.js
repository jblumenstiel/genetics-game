// Exact expectations for crosses, used to grade predictions and to score hypotheses in detective puzzles.

import { genotypeKey, sortAlleles } from './phenotype.js';

// Gametes from a normal disomic genotype: each copy goes to half the gametes.
export function gameteDistribution(alleles) {
  const dist = new Map();
  for (const a of alleles) dist.set(a, (dist.get(a) ?? 0) + 1 / alleles.length);
  return dist;
}

// Offspring genotypes of a single-locus cross: [{ alleles, key, p }].
export function offspringGenotypes(trait, g1, g2) {
  const out = new Map();
  for (const [a, pa] of gameteDistribution(g1)) {
    for (const [b, pb] of gameteDistribution(g2)) {
      const alleles = sortAlleles(trait, [a, b]);
      const key = genotypeKey(trait, alleles);
      const prev = out.get(key);
      out.set(key, { alleles, key, p: (prev?.p ?? 0) + pa * pb });
    }
  }
  return [...out.values()];
}

// Offspring phenotypes: [{ key, label, p, genotypes: [...] }], in a stable order.
export function offspringPhenotypes(trait, g1, g2) {
  const out = new Map();
  for (const g of offspringGenotypes(trait, g1, g2)) {
    const ph = trait.express(g.alleles);
    const prev = out.get(ph.key) ?? { key: ph.key, label: ph.label, p: 0, genotypes: [] };
    prev.p += g.p;
    prev.genotypes.push(g);
    out.set(ph.key, prev);
  }
  return [...out.values()].sort((a, b) => b.p - a.p || a.key.localeCompare(b.key));
}

// Every unordered diploid genotype for a trait's alleles.
export function allGenotypes(trait) {
  const ids = trait.alleles.map((a) => a.id);
  const out = [];
  for (let i = 0; i < ids.length; i++) for (let j = i; j < ids.length; j++) out.push([ids[i], ids[j]]);
  return out;
}

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

// Smallest integer ratio for a list of probabilities, e.g. [0.75, 0.25] -> [3, 1].
export function integerRatio(ps) {
  for (let d = 1; d <= 64; d++) {
    const ints = ps.map((p) => p * d);
    if (ints.every((x) => Math.abs(x - Math.round(x)) < 1e-9)) {
      const r = ints.map(Math.round);
      const g = r.reduce((acc, x) => gcd(acc, x), 0) || 1;
      return r.map((x) => x / g);
    }
  }
  return ps;
}

// "1/4", "2/3", "1". Falls back to a decimal for awkward values.
export function fraction(p) {
  if (p === 0) return '0';
  if (Math.abs(p - 1) < 1e-12) return '1';
  for (let d = 2; d <= 64; d++) {
    const n = Math.round(p * d);
    if (Math.abs(p * d - n) < 1e-9) {
      const g = gcd(n, d);
      return `${n / g}/${d / g}`;
    }
  }
  return p.toFixed(3);
}

const GLYPHS = { '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞' };

// The same fraction as `fraction`, written as a single character where one exists ("½", "¼"), else "9/16".
export function fractionGlyph(p) {
  const f = fraction(p);
  return GLYPHS[f] ?? f;
}

// Multinomial log-likelihood of observed phenotype counts, without the constant coefficient.
// Returns -Infinity when the hypothesis cannot produce an observed class.
export function logLikelihood(counts, dist) {
  let ll = 0;
  for (const [key, n] of Object.entries(counts)) {
    if (!n) continue;
    const p = dist.find((d) => d.key === key)?.p ?? 0;
    if (p === 0) return -Infinity;
    ll += n * Math.log(p);
  }
  return ll;
}

// Probability of a genotype given a phenotype among the offspring of a cross (Bayes over the Punnett square).
export function genotypeGivenPhenotype(trait, g1, g2, phenotypeKey, targetKey) {
  const ph = offspringPhenotypes(trait, g1, g2).find((p) => p.key === phenotypeKey);
  if (!ph) return 0;
  const g = ph.genotypes.find((x) => x.key === targetKey);
  return g ? g.p / ph.p : 0;
}
