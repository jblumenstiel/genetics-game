// Tetrad and spore analysis helpers. Products come from meiosis() in tetrad order.

import { findLocus, alleleOn } from './genome.js';

// The allele a haploid product carries at a locus (null if the chromosome is missing; joined if disomic).
export function productAllele(product, karyotype, locusId) {
  const { index, locus } = findLocus(karyotype, locusId);
  const list = product.chromosomes[index];
  if (list.length === 0) return null;
  return list.map((c) => alleleOn(c, locus)).join('/');
}

// Is a product recombinant for two loci, relative to the two parental haplotypes?
// parental: [{ [locusA]: allele, [locusB]: allele }, ...] (the meiocyte's two homolog haplotypes).
export function isRecombinant(product, karyotype, locusA, locusB, parental) {
  const a = productAllele(product, karyotype, locusA);
  const b = productAllele(product, karyotype, locusB);
  return !parental.some((p) => p[locusA] === a && p[locusB] === b);
}

// PD: only the two parental classes. NPD: only the two recombinant classes. TT: all four.
export function classifyTetrad(products, karyotype, locusA, locusB, parental) {
  const rec = products.map((p) => isRecombinant(p, karyotype, locusA, locusB, parental));
  const n = rec.filter(Boolean).length;
  if (n === 0) return 'PD';
  if (n === 4) return 'NPD';
  return 'TT';
}

// In an ordered tetrad, first-division (MI) segregation keeps each half uniform: AA aa. Anything else
// (Aa Aa, aA Aa ...) means the alleles separated at MII, which takes a crossover between locus and centromere.
export function segregationDivision(products, karyotype, locusId) {
  const g = products.map((p) => productAllele(p, karyotype, locusId));
  return g[0] === g[1] && g[2] === g[3] && g[0] !== g[2] ? 'MI' : 'MII';
}
