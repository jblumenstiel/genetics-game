// Every planned module, in course order. Modules with a load() function are playable; the rest show on the
// hub as planned. See docs/ROADMAP.md for the full descriptions.

// A unit with `bare: true` is shown by its title alone ("Meiosis") rather than as "Unit A. ...".
export const UNITS = [
  {
    id: 'meiosis',
    title: 'Meiosis',
    bare: true,
    modules: [
      {
        n: 0,
        id: 'drawing',
        title: 'Build the cell',
        blurb: 'Assemble eggs, sperm, zygotes, mitotic and meiotic cells chromatid by chromatid for one gene with two alleles. The engine grades every cell.',
        exam: true,
        load: () => import('./m00-drawing/index.js'),
      },
    ],
  },
  {
    id: 'A',
    title: 'Segregation and dominance',
    modules: [
      {
        n: 1,
        id: 'segregation',
        title: 'One gene, one meiosis',
        blurb: 'Walk a cell through meiosis and mitosis, fertilize gametes into a Punnett square, breed a litter, then solve for hidden parents.',
        exam: true,
        load: () => import('./m01-segregation/index.js'),
      },
      { n: 2, id: 'dominance', title: 'Dominance zoo', blurb: 'Complete, incomplete, codominance, haploinsufficiency, recessive lethals and gamete viability.', exam: true },
      { n: 3, id: 'complementation', title: 'Complementation', blurb: 'Grow auxotrophs on media and sort mutants into complementation groups.', exam: true },
      {
        n: 4,
        id: 'assortment',
        title: 'Two genes, two chromosomes',
        blurb: 'Independent orientation of two bivalents; the product rule and the 9:3:3:1 dihybrid cross.',
        exam: true,
        underConstruction: true,
        load: () => import('./m02-assortment/index.js'),
      },
    ],
  },
  {
    id: 'B',
    title: 'Linkage and mapping',
    modules: [
      { n: 5, id: 'linkage', title: 'Linked genes: cis and trans', blurb: 'One crossover makes two of four products recombinant.', exam: true },
      { n: 6, id: 'distance', title: 'Genetic distance', blurb: 'Random spore analysis: estimate recombination frequency and build a map.', exam: true },
      { n: 7, id: 'three-point', title: 'Three-point crosses and interference', blurb: 'Gene order, double crossovers, coefficient of coincidence.', exam: true },
      { n: 8, id: 'mapping-functions', title: 'Beyond 50%: mapping functions', blurb: 'Slide to 3000 cM and watch double crossovers hide.', exam: true },
      { n: 9, id: 'four-loci', title: 'Four loci, mixed linkage', blurb: 'Infer which genes are linked from progeny classes.' },
      { n: 10, id: 'interference', title: 'Crossover interference', blurb: 'See how crossovers space themselves out along a chromosome.' },
    ],
  },
  {
    id: 'C',
    title: 'Chromosome behavior',
    modules: [
      { n: 11, id: 'nondisjunction', title: 'Non-disjunction: MI vs MII', blurb: 'Diagnose the division that failed, with and without centromere crossovers.' },
      { n: 12, id: 'sex-linkage', title: 'Sex chromosomes and sex linkage', blurb: 'XY, ZW, XO and haplodiploid systems.', exam: true },
      { n: 13, id: 'pedigrees', title: 'Pedigrees', blurb: 'Modes of inheritance and Bayesian updating.', exam: true },
      { n: 14, id: 'inversions', title: 'Inversions', blurb: 'Bridges, fragments and recombination suppression.' },
    ],
  },
  {
    id: 'D',
    title: 'Fungal genetics',
    modules: [
      { n: 15, id: 'tetrads', title: 'Tetrad analysis', blurb: 'Parental ditypes, non-parental ditypes and tetratypes.' },
      { n: 16, id: 'ordered-tetrads', title: 'Ordered tetrads and centromere mapping', blurb: 'MI vs MII segregation patterns in Neurospora asci.' },
      { n: 17, id: 'gene-conversion', title: 'Gene conversion', blurb: '6:2 and 5:3 asci from mismatch repair.' },
    ],
  },
  {
    id: 'E',
    title: 'Probability and statistics',
    modules: [
      { n: 18, id: 'binomial', title: 'Binomial probability', blurb: 'At least one, exactly k of n.', exam: true },
      { n: 19, id: 'chi-square', title: 'Chi-square goodness of fit', blurb: 'Test segregation distortion from observed counts.', exam: true },
      { n: 20, id: 'p-values', title: 'What a p-value means', blurb: 'Simulate the null and see where your data fall.', exam: true },
      { n: 21, id: 'simulate-r', title: 'Simulate it in R', blurb: 'Predict the output of short simulation loops.', exam: true },
      { n: 22, id: 'quantitative', title: 'Quantitative genetics', blurb: 'Many loci make a bell curve; heritability and selection.' },
    ],
  },
  {
    id: 'F',
    title: 'Molecular genetics',
    modules: [
      { n: 23, id: 'genetic-material', title: 'DNA is the genetic material', blurb: 'Griffith, Avery, and Hershey and Chase.' },
      { n: 24, id: 'meselson-stahl', title: 'Meselson and Stahl', blurb: 'Predict density bands under three replication models.' },
      { n: 25, id: 'replication-fork', title: 'The replication fork', blurb: 'Leading and lagging strands, and why 3′ ends matter.' },
      { n: 26, id: 'pcr-primers', title: 'PCR and primer design', blurb: 'Genotype deletions, insertions and inversions at any ploidy.' },
      { n: 27, id: 'transcription', title: 'Transcription', blurb: 'Template strand, coding strand and direction.' },
      { n: 28, id: 'dsb-repair', title: 'Double-strand break repair', blurb: 'The Szostak model and double Holliday junctions.' },
      { n: 29, id: 'mismatch-repair', title: 'Mismatch repair and gene conversion', blurb: 'Heteroduplex repair outcomes.' },
      { n: 30, id: 'molecules-to-maps', title: 'From molecules to map distance', blurb: 'Spo11 breaks, crossover choice and interference.' },
    ],
  },
  {
    id: 'G',
    title: 'Bacterial genetics',
    modules: [
      { n: 31, id: 'selective-media', title: 'Selective media', blurb: 'Choose media to select or screen genotypes.' },
      { n: 32, id: 'transformation', title: 'Transformation', blurb: 'Donor DNA uptake and recombination.' },
      { n: 33, id: 'transduction', title: 'Transduction', blurb: 'Co-transduction frequency and gene order.' },
    ],
  },
];

export function findModule(id) {
  for (const unit of UNITS) {
    const m = unit.modules.find((x) => x.id === id);
    if (m) return { ...m, unit };
  }
  return null;
}

// How a unit is named in headings and module eyebrows: "Meiosis" or "Unit A".
export function unitLabel(unit) {
  return unit.bare ? unit.title : `Unit ${unit.id}`;
}

// Panel eyebrow, unit first: "Unit A · Module 1".
export function moduleEyebrow(entry) {
  return `${unitLabel(entry.unit)} · Module ${entry.n}`;
}

// Units are lettered, modules numbered, and each panel within a module lettered: A, B, C, ...
export function stepLetter(i) {
  return String.fromCharCode(65 + i);
}
