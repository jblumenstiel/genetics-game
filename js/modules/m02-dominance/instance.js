// Generates one playthrough of Module 2 from a seed: the species and look shared by every bdellbee, the allele letters
// for each example, the slide A menus, and the order and genes of the problems in D.

import { makeRng, pick, shuffle } from '../../core/rng.js';
import { PALETTE, mix } from '../../core/palette.js';
import { SPECIES, creatureFeatures } from '../../species/catalog.js';
import { QUIZ_CATEGORIES } from '../../engine/dominance.js';

// Letters that read clearly and do not collide with the catalog's own (S spots, C color, P pattern, E ears, T tail,
// A antennae).
const LETTERS = ['B', 'D', 'G', 'H', 'K', 'L', 'M', 'N', 'R', 'W'];

// Superscript characters for allele names: T⁺, Tᵐ, Eᴰᴺ.
export const SUP = { plus: '⁺', m: 'ᵐ', minus: '⁻' };
export const DEL = 'Δ';

export const WHITE = PALETTE.creature.white;
export const GOLDEN = 0xe2b860;

// Genotypes and phenotypes for slide A's two quizzes. Mixed bdellbee and human examples, all in one-line notation.
export const GENOTYPE_MENU = ['S/s', 's/s', 'E/E', 'T/t', 'Cᴮ/Cᴿ', 'A/a ; B/b', 'XᴬXᵃ', 'Iᴬ/i', 'Hbᴬ/Hbˢ', 'D/d ; e/e'];
export const PHENOTYPE_MENU = [
  'spotted',
  'white body',
  'floppy ears',
  'curly tail',
  'mauve body color',
  'type AB blood',
  'increased cancer risk',
  'red flowers',
  'short antennae',
  'color blindness',
];

// The visible traits a problem's gene can control: what a normal and a mutant bdellbee look like.
const QUIZ_TRAITS = [
  { name: 'ears', normal: { ears: 'perky' }, mutant: { ears: 'floppy' }, normalText: 'perky ears', mutantText: 'floppy ears' },
  { name: 'antennae', normal: { antennae: 1 }, mutant: { antennae: 0 }, normalText: 'antennae', mutantText: 'no antennae' },
  { name: 'spots', normal: { spots: true }, mutant: { spots: false }, normalText: 'spotted', mutantText: 'plain' },
  { name: 'pigment', normal: {}, mutant: { bodyColor: WHITE }, normalText: 'pigmented', mutantText: 'white' },
];

export function buildInstance(seed) {
  const rng = makeRng(seed);
  const species = pick(rng, Object.values(SPECIES));
  // Every bdellbee in the module shares one look; each example changes only the trait it is about.
  const look = { ears: pick(rng, ['perky', 'nub']), tail: pick(rng, ['curly', 'none']), antennae: 0, spots: false, stripes: false };
  const letters = shuffle(rng, LETTERS);
  const inst = {
    seed,
    species,
    look,
    // Allele letters for the terminology examples.
    pigment: letters[0],
    antennaGene: letters[1],
    earGene: letters[2],
    bandGene: letters[3],
    golden: letters[4],
    lethal: letters[5],
    features: (overrides = {}) => creatureFeatures(species, [{ features: look }, { features: overrides }]),
    // A body shade for a fraction of the normal pigment: full color down to white.
    shadeFor: (dose) => mix(WHITE, species.baseColor, dose),
  };
  inst.quiz = buildQuiz(inst, makeRng(seed + 7), letters.slice(6));
  return inst;
}

// The problem set for step D: two "which allele is dominant" items from Exam I, the five kinds of allele in a seeded
// order (each with its own gene and trait), the 2 : 1 follow-ups, and the haplosufficiency sentence.
function buildQuiz(inst, rng, spare) {
  const traits = shuffle(rng, QUIZ_TRAITS);
  const geneLetters = shuffle(rng, [...spare, ...LETTERS.filter((l) => !spare.includes(l))]);
  const kinds = shuffle(rng, QUIZ_CATEGORIES);
  const items = [];
  // Which of the two cancer genes has the dominant normal allele.
  const alphaFirst = rng() < 0.5;
  items.push({ type: 'which-dominant', gene: 'α', dominant: alphaFirst ? '+' : '-' });
  items.push({ type: 'which-dominant', gene: 'β', dominant: alphaFirst ? '-' : '+' });
  // Each problem without lethality gets its own trait, so two problems in a row never look alike.
  let nextTrait = 0;
  kinds.forEach((mechanism, i) => {
    const L = geneLetters[i];
    // Lethal problems use the golden body (dominant for color) or no visible trait; the others use a trait.
    const trait =
      mechanism === 'recessiveLethal'
        ? { name: 'body color', normal: {}, mutant: { bodyColor: GOLDEN }, normalText: 'normal color', mutantText: 'golden' }
        : mechanism === 'dominantLethal'
          ? { name: 'survival', normal: {}, mutant: {}, normalText: 'normal', mutantText: 'normal' }
          : traits[nextTrait++ % traits.length];
    items.push({ type: 'classify', mechanism, letter: L, trait });
    if (mechanism === 'recessiveLethal') {
      items.push({ type: 'lethal-ratio', letter: L, trait });
      items.push({ type: 'lethal-het', letter: L, trait });
    }
  });
  items.push({ type: 'sentence', part: 0 }, { type: 'sentence', part: 1 }, { type: 'sentence', part: 2 });
  return items;
}

// Allele names for a problem's gene: L⁺ (normal), Lᵐ (mutant), Δ (deletion).
export function alleleName(letter, kind) {
  if (kind === '+') return `${letter}${SUP.plus}`;
  if (kind === 'm') return `${letter}${SUP.m}`;
  return DEL;
}

export function genotypeName(letter, g) {
  return g.map((k) => alleleName(letter, k)).join('/');
}

// A seeded order for one question's options, so the same seed shows the same order.
export function questionRng(inst, n) {
  return makeRng(inst.seed * 31 + n);
}
