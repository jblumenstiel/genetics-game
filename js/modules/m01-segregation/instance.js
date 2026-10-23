// Generates one playthrough of Module 1 from a seed, plus the Pixi views the steps share.

import { makeRng, pick, chance, int, shuffle } from '../../core/rng.js';
import { PALETTE } from '../../core/palette.js';
import { haplotype, diploid, allelesAt } from '../../engine/genome.js';
import { meiosis, fertilize } from '../../engine/meiosis.js';
import { genotypeLabel, alleleLabel } from '../../engine/phenotype.js';
import { allGenotypes } from '../../engine/cross.js';
import { completeDominance } from '../../engine/phenotype.js';
import { SPECIES, creatureFeatures } from '../../species/catalog.js';
import { Creature } from '../../render/creature.js';
import { ChromatidView, label } from '../../render/chromosome.js';
import { alleleOn } from '../../engine/genome.js';

const LETTERS = ['A', 'B', 'D', 'G', 'H', 'P', 'R', 'T'];

// One pigment gene: the capital allele makes a working pigment enzyme (dominant), the lowercase allele is broken
// (recessive). A bdellbee is colored when it has at least one working copy and white when it has none.
export function pigmentTrait(L) {
  const up = L;
  const low = L.toLowerCase();
  return {
    id: 'pigment',
    name: 'Pigment',
    dominance: 'complete',
    alleles: [
      { id: up, label: up, note: 'makes a working pigment enzyme' },
      { id: low, label: low, note: 'a broken enzyme, no pigment' },
    ],
    express: completeDominance(up, low, { key: 'pigmented', label: 'pigmented', features: {} }, { key: 'white', label: 'white', features: { bodyColor: PALETTE.creature.white } }),
    why: `One working copy of ${up} makes enough pigment to color the bdellbee, so ${up} is dominant and ${low} is recessive.`,
  };
}

const NAMES = ['Pip', 'Mossy', 'Bramble', 'Tuffet', 'Wobble', 'Juniper', 'Nib', 'Puddle', 'Clover', 'Fennel', 'Burdock', 'Sorrel', 'Quill', 'Tansy'];

export function makeParent(base, alleles, colors, name) {
  const { trait, karyotype } = base;
  const haps = alleles.map((a, i) => haplotype({ [trait.id]: a }, { color: colors[i], origin: name }));
  const cell = diploid(karyotype, [haps]);
  const phenotype = trait.express(alleles);
  return {
    name,
    alleles,
    cell,
    phenotype,
    features: base.featuresFor(phenotype),
    label: genotypeLabel(trait, alleles),
  };
}

export function buildInstance(seed) {
  const rng = makeRng(seed);
  const species = pick(rng, Object.values(SPECIES));
  // Complete dominance only: a capital dominant allele and a lowercase recessive one. Other dominance modes
  // come in Module 3.
  const trait = pigmentTrait(pick(rng, LETTERS));
  const [A, a] = trait.alleles.map((x) => x.id);
  const pos = pick(rng, [14, 20, 26, 66, 74, 82]);
  const karyotype = [{ id: '1', name: 'Chromosome 1', length: 100, centromere: 42, loci: [{ id: trait.id, pos }] }];
  // Every bdellbee in a problem shares one look; only its color follows the genotype.
  const look = { features: { ears: pick(rng, ['perky', 'floppy', 'nub']), tail: pick(rng, ['curly', 'straight', 'none']) } };
  const base = { species, trait, karyotype, featuresFor: (phenotype) => creatureFeatures(species, [look, phenotype]) };
  const names = shuffle(rng, NAMES);
  const het = [A, a];
  const [c0, c1, c2, c3] = PALETTE.hap;

  // The heterozygote from A and B becomes the mother in C: her gametes are eggs. The father is heterozygous too,
  // so the Punnett square is the monohybrid cross.
  const meiosisParent = makeParent(base, het, [c0, c1], names[0]);
  const parents = [meiosisParent, makeParent(base, het, [c2, c3], names[2])];

  const genos = allGenotypes(trait);
  const pairs = [];
  for (let i = 0; i < genos.length; i++) for (let j = i; j < genos.length; j++) pairs.push([genos[i], genos[j]]);
  const informative = pairs.filter(([x, y]) => x[0] !== x[1] || y[0] !== y[1]);
  const [d1, d2] = shuffle(rng, chance(rng, 0.8) ? pick(rng, informative) : pick(rng, pairs));
  const detective = {
    parents: [makeParent(base, d1, [c0, c1], names[3]), makeParent(base, d2, [c2, c3], names[4])],
    litterSize: int(rng, 9, 14),
    seed: Math.floor(rng() * 0xffffffff),
  };

  return { seed, rng, species, trait, karyotype, locus: karyotype[0].loci[0], base, meiosisParent, parents, detective };
}

// One offspring from two parents, through two real meioses and a fertilization.
export function breed(inst, p1, p2, rng) {
  const g1 = pick(rng, meiosis(p1.cell, rng, { crossingOver: false }).products);
  const g2 = pick(rng, meiosis(p2.cell, rng, { crossingOver: false }).products);
  const zygote = fertilize(g1.cell, g2.cell);
  const alleles = allelesAt(zygote, inst.trait.id);
  const phenotype = inst.trait.express(alleles);
  return { alleles, phenotype, label: genotypeLabel(inst.trait, alleles), features: inst.base.featuresFor(phenotype) };
}

// Every phenotype class the trait can show, in a stable order.
export function phenotypeClasses(trait) {
  const seen = new Map();
  for (const g of allGenotypes(trait)) {
    const p = trait.express(g);
    if (!seen.has(p.key)) seen.set(p.key, p);
  }
  return [...seen.values()];
}

// A creature with its name, genotype and phenotype written underneath.
export function creatureCard(parent, { size = 100, genotype = parent.label, caption = parent.phenotype.label } = {}) {
  const container = new PIXI.Container();
  const creature = new Creature(parent.features, { size });
  const name = label(parent.name, Math.max(13, size * 0.17), { fontWeight: '800' });
  const geno = label(genotype, Math.max(13, size * 0.16), { fill: PALETTE.sage });
  const pheno = label(caption, Math.max(12, size * 0.13), { fontWeight: '600', fill: PALETTE.inkSoft });
  for (const t of [name, geno, pheno]) t.anchor.set(0.5, 0);
  name.y = size * 0.55;
  geno.y = name.y + name.height + 1;
  pheno.y = geno.y + geno.height;
  container.addChild(creature, name, geno, pheno);
  return {
    container,
    creature,
    setGenotype(text) {
      geno.text = text;
    },
    destroy() {
      container.destroy({ children: true });
    },
  };
}

// A small round gamete holding one chromatid, labeled with its allele.
export function gameteView(inst, chromatid, radius) {
  const c = new PIXI.Container();
  const ring = new PIXI.Graphics();
  ring.circle(0, 0, radius).fill(PALETTE.cell).stroke({ width: 2, color: PALETTE.cellEdge });
  c.addChild(ring);
  const view = new ChromatidView(chromatid, inst.karyotype[0], {
    scale: (radius * 1.45) / 100,
    width: Math.max(7, radius * 0.24),
    loci: [{ locus: inst.locus, text: alleleLabel(inst.trait, alleleOn(chromatid, inst.locus)) }],
    labelSide: 1,
  });
  view.rotation = Math.PI / 2;
  view.x = radius * 0.12;
  view.uprightLabels();
  c.addChild(view);
  c.allele = alleleOn(chromatid, inst.locus);
  c.ring = ring;
  c.radius = radius;
  return c;
}

export function highlight(gamete, on, color = PALETTE.ochre) {
  gamete.ring.clear().circle(0, 0, gamete.radius).fill(PALETTE.cell).stroke({ width: on ? 4 : 2, color: on ? color : PALETTE.cellEdge });
}
