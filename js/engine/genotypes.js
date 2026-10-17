// One-line genotype notation for a gene in a diploid organism, plus look-alike options that are impossible under
// standard conditions, each with the reason why.
//
// Notation: a slash separates the alleles on the two homologs of one chromosome (B/b). A semicolon separates
// genes on different chromosomes (A/a ; B/b).

import { shuffle } from '../core/rng.js';

// Options for an autosomal gene with alleles [U, l]. `other` is a letter that is not this gene.
export function genotypeOptions([U, l], other, rng) {
  const O = other.toUpperCase();
  const possible = [
    [U, U],
    [U, l],
    [l, l],
  ].map((alleles) => ({ text: alleles.join('/'), alleles, possible: true }));
  const impossible = [
    {
      text: U,
      reason: `${U} lists only one allele. A diploid carries two copies of every autosome, so an autosomal gene always has two alleles, one on each homolog. Having just one allele (hemizygous) happens for X-linked genes in males, not for autosomal genes.`,
    },
    {
      text: `${U}/${U}/${l}`,
      reason: 'Three alleles means three copies of this chromosome: a trisomy, or a triploid organism. A normal diploid has exactly two copies.',
    },
    {
      text: `${U}/${U}/${l}/${l}`,
      reason: 'Four alleles means four copies of this chromosome: a tetraploid, not a diploid.',
    },
    {
      text: `${U} ; ${l}`,
      reason: `A semicolon separates genes on different, non-homologous chromosomes. ${U} and ${l} are alleles of the same gene, carried on the two homologs, so they are written with a slash: ${U}/${l}.`,
    },
    {
      text: `${U}/${O}`,
      reason: `${O} is not an allele of this gene. Both alleles of a gene must be versions of that gene (${U} or ${l}); ${O} would name a different gene.`,
    },
  ].map((o) => ({ ...o, possible: false, alleles: null }));
  return rng ? shuffle(rng, [...possible, ...impossible]) : [...possible, ...impossible];
}

export const IMPOSSIBLE_NOTE = 'This is not a possible genotype under standard conditions.';

const canGive = (parent) => [...new Set(parent)];
const list = (alleles) => (alleles.length === 1 ? `only ${alleles[0]}` : alleles.join(' or '));

// Can a zygote with alleles [p, q] come from these parents? If not, say why in a sentence.
export function zygoteFromParents([p, q], mother, father) {
  const m = canGive(mother);
  const f = canGive(father);
  const ok = (m.includes(p) && f.includes(q)) || (m.includes(q) && f.includes(p));
  if (ok) return { ok: true };
  return {
    ok: false,
    reason: `To be ${p}/${q}, the zygote needs ${p === q ? `${p} from both parents` : `${p} from one parent and ${q} from the other`}. The mother (${mother.join('/')}) can pass on ${list(m)}, and the father (${father.join('/')}) can pass on ${list(f)}.`,
  };
}
