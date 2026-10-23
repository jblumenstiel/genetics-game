// Two or more genes on different chromosomes assort independently, so the product rule gives the probability of any
// combination of alleles or phenotypes. A gene here is { trait, alleles: [x, y] }: one diploid parent's two alleles.

import { gameteDistribution, offspringPhenotypes } from './cross.js';
import { alleleLabel, genotypeLabel, sortAlleles } from './phenotype.js';

// Gametes of one parent: [{ alleles: [one allele per gene], p }]. Each gene contributes one allele, and the genes
// assort independently, so a gamete's probability is the product of its per-gene probabilities.
export function dihybridGametes(genes) {
  return genes.reduce(
    (acc, g) => acc.flatMap(({ alleles, p }) => [...gameteDistribution(g.alleles)].map(([a, pa]) => ({ alleles: [...alleles, a], p: p * pa }))),
    [{ alleles: [], p: 1 }],
  );
}

// Offspring phenotype classes of a cross over several genes: [{ key, label, p }], most common first. Each key joins
// the per-gene phenotype keys with "|", and each label joins the per-gene labels with ", ".
export function dihybridPhenotypes(mother, father) {
  const perGene = mother.map((g, i) => offspringPhenotypes(g.trait, g.alleles, father[i].alleles));
  return perGene
    .reduce(
      (acc, list) => acc.flatMap((x) => list.map((y) => ({ keys: [...x.keys, y.key], labels: [...x.labels, y.label], p: x.p * y.p }))),
      [{ keys: [], labels: [], p: 1 }],
    )
    .map(({ keys, labels, p }) => ({ key: keys.join('|'), label: labels.join(', '), p }))
    .sort((a, b) => b.p - a.p || a.key.localeCompare(b.key));
}

// Metaphase I alignments with one bivalent per gene: [{ poles: [alleles toward one pole, alleles toward the other], p }].
// Flipping every bivalent at once is the same alignment seen from the other side, so n bivalents have 2^(n-1)
// distinct alignments. Each one sends complementary allele sets to the poles, so it makes two kinds of gametes.
export function metaphaseIAlignments(genes) {
  const [first, ...rest] = genes;
  const all = rest.reduce(
    (acc, g) => acc.flatMap(({ poles: [x, y] }) => [0, 1].map((k) => ({ poles: [[...x, g.alleles[k]], [...y, g.alleles[1 - k]]] }))),
    [{ poles: [[first.alleles[0]], [first.alleles[1]]] }],
  );
  return all.map((a) => ({ ...a, p: 1 / all.length }));
}

// A gamete's genotype in one-line notation: one allele per gene, with " ; " between genes on different chromosomes.
export function gameteLabel(genes, alleles) {
  return alleles.map((a, i) => alleleLabel(genes[i].trait, a)).join(' ; ');
}

// Gamete genotypes for a picker: [{ text, kind }]. kind is 'gamete' for a real gamete of this parent, 'notHaploid'
// for a look-alike built from its alleles with more than one copy of a gene, or 'missing' for one that lacks a gene.
export function gameteChoices(genes) {
  const sorted = genes.map((g) => sortAlleles(g.trait, g.alleles).map((a) => alleleLabel(g.trait, a)));
  const real = [...new Set(dihybridGametes(genes).map((g) => gameteLabel(genes, g.alleles)))].map((text) => ({ text, kind: 'gamete' }));
  const notHaploid = [
    genes.map((g) => genotypeLabel(g.trait, g.alleles)).join(' ; '),
    sorted.map((x) => x.join('')).join(''),
    sorted.map((x) => x.join('')).join(' ; '),
    [sorted[0][0], ...sorted.map((x) => x[0])].join(' ; '),
  ].map((text) => ({ text, kind: 'notHaploid' }));
  const missing = [{ text: sorted[0][1], kind: 'missing' }];
  const seen = new Set();
  return [...real, ...notHaploid, ...missing].filter((c) => !seen.has(c.text) && seen.add(c.text));
}
