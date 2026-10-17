// The creatures and the traits they can carry.
//
// Species differ in body plan. Traits are shared, so any species can be spotted or have curly tails.
// Each trait says how alleles map to phenotype (dominance mode), and why, in a sentence students can use.

import { completeDominance, incompleteDominance, codominance } from '../engine/phenotype.js';
import { mix, PALETTE } from '../core/palette.js';

export const SPECIES = {
  gorby: { id: 'gorby', name: 'gorby', plural: 'gorbies', body: 'round', baseColor: PALETTE.creature.moss },
  glubbin: { id: 'glubbin', name: 'glubbin', plural: 'glubbins', body: 'pear', baseColor: PALETTE.creature.lagoon },
  chomny: { id: 'chomny', name: 'chomny', plural: 'chomnies', body: 'wide', baseColor: PALETTE.creature.sand },
};

const BLUE = PALETTE.creature.blue;
const RUST = PALETTE.creature.rust;

export const TRAITS = {
  spots: {
    id: 'spots',
    name: 'Spots',
    dominance: 'complete',
    alleles: [
      { id: 'S', label: 'S', note: 'makes a working spot-pigment enzyme' },
      { id: 's', label: 's', note: 'broken enzyme, no pigment' },
    ],
    express: completeDominance(
      'S',
      's',
      { key: 'spotted', label: 'spotted', features: { spots: true } },
      { key: 'plain', label: 'plain', features: { spots: false } },
    ),
    why: 'One working copy of S makes enough pigment enzyme to draw spots. S is haplosufficient, so it is dominant and s is recessive.',
  },
  ears: {
    id: 'ears',
    name: 'Ears',
    dominance: 'complete',
    alleles: [
      { id: 'E', label: 'E', note: 'makes ear-stiffening cartilage protein' },
      { id: 'e', label: 'e', note: 'loss-of-function allele' },
    ],
    express: completeDominance(
      'E',
      'e',
      { key: 'perky', label: 'perky ears', features: { ears: 'perky' } },
      { key: 'floppy', label: 'floppy ears', features: { ears: 'floppy' } },
    ),
    why: 'One working copy of E makes enough cartilage protein to hold the ears up. E is haplosufficient and dominant.',
  },
  tail: {
    id: 'tail',
    name: 'Tail',
    dominance: 'complete',
    alleles: [
      { id: 'T', label: 'T', note: 'makes a curl-forming protein' },
      { id: 't', label: 't', note: 'loss-of-function allele' },
    ],
    express: completeDominance(
      'T',
      't',
      { key: 'curly', label: 'curly tail', features: { tail: 'curly' } },
      { key: 'straight', label: 'straight tail', features: { tail: 'straight' } },
    ),
    why: 'One working copy of T is enough to curl the tail, so T is dominant over the broken t allele.',
  },
  color: {
    id: 'color',
    name: 'Body color',
    dominance: 'incomplete',
    alleles: [
      { id: 'CB', label: 'Cᴮ', note: 'adds blue pigment' },
      { id: 'CR', label: 'Cᴿ', note: 'adds rust pigment' },
    ],
    express: incompleteDominance(
      'CB',
      [
        { key: 'rust', label: 'rust' },
        { key: 'mauve', label: 'mauve' },
        { key: 'blue', label: 'blue' },
      ],
      (f) => ({ bodyColor: mix(RUST, BLUE, f) }),
    ),
    why: 'Each copy adds its own pigment, so one Cᴮ and one Cᴿ blend to an in-between mauve. Neither allele is dominant: this is incomplete dominance.',
  },
  antennae: {
    id: 'antennae',
    name: 'Antennae',
    dominance: 'incomplete',
    alleles: [
      { id: 'AL', label: 'Aᴸ', note: 'grows an antenna segment' },
      { id: 'AN', label: 'Aᴺ', note: 'no antenna growth' },
    ],
    express: incompleteDominance(
      'AL',
      [
        { key: 'none', label: 'no antennae' },
        { key: 'short', label: 'short antennae' },
        { key: 'long', label: 'long antennae' },
      ],
      (f) => ({ antennae: f }),
    ),
    why: 'Antenna length depends on dose: two Aᴸ copies grow long antennae, one grows short ones. This is incomplete dominance.',
  },
  pattern: {
    id: 'pattern',
    name: 'Pattern',
    dominance: 'codominant',
    alleles: [
      { id: 'PD', label: 'Pᴰ', note: 'draws dots' },
      { id: 'PT', label: 'Pᵀ', note: 'draws stripes' },
    ],
    express: codominance(['PD', 'PT'], {
      PD: { key: 'dots', label: 'dots', features: { spots: true } },
      PT: { key: 'stripes', label: 'stripes', features: { stripes: true } },
    }),
    why: 'Each allele makes its own pattern and both show in a heterozygote, which has dots and stripes. This is codominance.',
  },
};

export const DEFAULT_FEATURES = {
  spots: false,
  stripes: false,
  ears: 'nub',
  tail: 'none',
  antennae: 0,
};

// Creature drawing parameters for a species plus any number of trait phenotypes.
export function creatureFeatures(species, phenotypes = []) {
  return Object.assign(
    { species: species.id, body: species.body, bodyColor: species.baseColor },
    DEFAULT_FEATURES,
    ...phenotypes.map((p) => p.features),
  );
}
