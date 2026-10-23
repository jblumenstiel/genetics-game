// Generates one playthrough of Module 2 from a seed: two genes on two different chromosomes, and two parents who are
// both heterozygous at both genes (dihybrids). Gametes come from real engine meioses.

import { makeRng, pick, shuffle } from '../../core/rng.js';
import { PALETTE } from '../../core/palette.js';
import { haplotype, diploid, allelesAt, alleleOn } from '../../engine/genome.js';
import { meiosis, fertilize } from '../../engine/meiosis.js';
import { genotypeLabel } from '../../engine/phenotype.js';
import { dihybridPhenotypes } from '../../engine/dihybrid.js';
import { SPECIES, TRAITS, creatureFeatures } from '../../species/catalog.js';
import { creatureCard, pigmentTrait } from '../m01-segregation/instance.js';

// Both genes are pigment genes with complete dominance, so a bdellbee is colored for each gene when it has a working
// copy and white when it has none: one gene colors the body, the other the spots. S is taken by the spot gene, and
// P would read badly next to P(...) for probabilities.
const BODY_LETTERS = ['A', 'B', 'D', 'G', 'H', 'R', 'T'];
const NAMES = ['Pip', 'Mossy', 'Bramble', 'Tuffet', 'Wobble', 'Juniper', 'Nib', 'Puddle', 'Clover', 'Fennel'];
const POSITIONS = [20, 30, 70, 80];

// genes[i] is the allele pair for traits[i].
function makeParent(base, genes, colors, name) {
  const { traits, karyotype } = base;
  const haps = genes.map((pair, i) => [0, 1].map((k) => haplotype({ [traits[i].id]: pair[k] }, { color: colors[k], origin: name })));
  const phenos = traits.map((t, i) => t.express(genes[i]));
  return {
    name,
    genes,
    cell: diploid(karyotype, haps),
    features: base.featuresFor(phenos),
    label: genotypeOf(base, genes),
    phenotype: { label: phenos.map((p) => p.label).join(', ') },
  };
}

// One-line genotype across both genes: "B/b ; S/s".
export function genotypeOf(inst, genes) {
  return inst.traits.map((t, i) => genotypeLabel(t, genes[i])).join(' ; ');
}

// What a bdellbee with these allele pairs looks like: [{ key, label, features }] per gene, plus the drawing features.
export function lookOf(inst, genes) {
  const phenos = inst.traits.map((t, i) => t.express(genes[i]));
  return { key: phenos.map((p) => p.key).join('|'), label: phenos.map((p) => p.label).join(', '), features: inst.featuresFor(phenos) };
}

export function buildInstance(seed) {
  const rng = makeRng(seed);
  const species = pick(rng, Object.values(SPECIES));
  const traits = shuffle(rng, [pigmentTrait(pick(rng, BODY_LETTERS)), TRAITS.spots]);
  const karyotype = traits.map((t, i) => ({
    id: String(i + 1),
    name: `Chromosome ${i + 1}`,
    length: 100,
    centromere: 42,
    loci: [{ id: t.id, pos: pick(rng, POSITIONS) }],
  }));
  // Every bdellbee in a problem shares one shape; only the body and spot colors follow the genotype.
  const look = { features: { ears: pick(rng, ['perky', 'floppy', 'nub']), tail: pick(rng, ['curly', 'straight', 'none']) } };
  const base = { species, traits, karyotype, featuresFor: (phenos) => creatureFeatures(species, [look, ...phenos]) };
  const names = shuffle(rng, NAMES);
  const het = traits.map((t) => [t.alleles[0].id, t.alleles[1].id]);
  const [c0, c1, c2, c3] = PALETTE.hap;
  return {
    ...base,
    seed,
    rng,
    mother: makeParent(base, het, [c0, c1], names[0]),
    father: makeParent(base, het, [c2, c3], names[1]),
  };
}

// The gene list for the engine's cross functions: [{ trait, alleles }] for one parent.
export function genesOf(inst, parent) {
  return inst.traits.map((trait, i) => ({ trait, alleles: parent.genes[i] }));
}

// Exact offspring phenotype classes of the cross, most common first.
export function expectedClasses(inst) {
  return dihybridPhenotypes(genesOf(inst, inst.mother), genesOf(inst, inst.father));
}

// One real meiosis of a parent. The genes sit on different chromosomes, so crossing over is off here.
export function gametes(parent, rng) {
  return meiosis(parent.cell, rng, { crossingOver: false }).products;
}

// The allele of each gene in one gamete, in trait order.
export function gameteAlleles(inst, gamete) {
  return inst.karyotype.map((def, i) => alleleOn(gamete.chromosomes[i][0], def.loci[0]));
}

// One offspring: a gamete from each parent, fertilized, then each trait expressed.
export function offspringPhenotype(inst, rng) {
  const zygote = fertilize(pick(rng, gametes(inst.mother, rng)).cell, pick(rng, gametes(inst.father, rng)).cell);
  return lookOf(
    inst,
    inst.traits.map((t) => allelesAt(zygote, t.id)),
  );
}

// Both parents side by side, with their genotype and phenotype underneath.
export function parentCards(inst, size) {
  return [inst.mother, inst.father].map((p) => creatureCard(p, { size }));
}

// A seeded generator for one question's option order, so the same seed shows the same order.
export function questionRng(inst, n) {
  return makeRng(inst.seed + n);
}

export { creatureCard };
