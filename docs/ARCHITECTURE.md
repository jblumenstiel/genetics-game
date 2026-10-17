# Architecture

Plain ES modules, no build step. PixiJS (WebGL) draws the creatures, cells and chromosomes; the DOM draws the
side panel, questions and controls. GitHub Pages serves the folder as is.

```
index.html            page shell, fonts, Pixi script tag
css/style.css         layout and art-direction tokens for the DOM
js/app.js             boots Pixi, routes between the hub and modules
js/core/              seeded RNG, tweening, palette, DOM helpers
js/engine/            genetics engine (no rendering; tested in Node)
js/species/           creature species and trait catalog
js/render/            Pixi drawing: creatures, chromatids, cells, charts
js/modules/           one folder per module, plus the registry used by the hub
tests/                Node tests for the engine
```

## Layers

1. **Engine** (`js/engine/`) is pure JS and knows nothing about drawing.
   - `genome.js`: haplotypes, chromatids as segment lists, homologs, cells, genotype readout.
     A chromatid is a list of segments in standard map coordinates (cM), each pointing at the haplotype it
     came from. That keeps recombinant chromatids drawable in their parental colors.
   - `meiosis.js`: replication, crossovers, Metaphase I orientation, Meiosis II, non-disjunction,
     inversion loops, and mitosis. Crossover positions come from Stahl's counting model with parameter
     `m` (m = 0 is no interference, which gives Haldane's mapping function). Each crossover picks one
     non-sister pair at random (no chromatid interference). Callers can force orientation, crossovers or
     non-disjunction to script a specific meiosis for a puzzle.
   - `tetrad.js`: PD/NPD/TT classification, MI/MII segregation patterns, recombinant counting.
   - `mapping.js`: Haldane and Kosambi mapping functions and their inverses.
   - `cross.js`: exact gamete and offspring distributions, ratio formatting, likelihoods.
   - `phenotype.js`: genotype to phenotype for complete, incomplete and codominant traits, dosage-aware so
     aneuploid and polyploid cells work.
   - `drawing.js`: models of cells a student builds (nuclei of chromosomes, chromatids, alleles, bivalents,
     crossover marks), expected models generated from engine cells and meioses, and a grader that returns
     coded problems (wrong nucleus count, chromatid count, pairing, unlabeled chromatids, sisters that
     differ, wrong contents, extra or missing crossovers) for the module to phrase. Also `minCrossovers`,
     the fewest crossovers needed to spell a stated gamete.
2. **Species** (`js/species/`) define the gorbies, glubbins and chomnies: body plan, karyotype, and the trait
   catalog. Each trait says which creature feature it drives (spots, ears, tail, color, antennae, pattern).
3. **Builder** (`js/builder/cell-builder.js`) is the interactive cell editor used by Module 0 and the
   "Build the cell" steps of later modules. It edits drawing models only, so grading never depends on
   screen positions.
4. **Render** (`js/render/`) draws everything as vector shapes with Pixi `Graphics`: procedural creatures with
   idle motion, chromatids colored by haplotype, and cell membranes.
5. **Modules** (`js/modules/<id>/`) take a seed, generate an instance from the engine, and run a sequence of
   steps. Each module exports `{ id, title, mount(ctx) }`; `mount` returns `{ destroy, resize }`.

## Generated instances

Every module visit gets a seed (shown in the URL as `?seed=`). The module derives its species, trait,
dominance mode, genotypes and sample sizes from that seed, so a student can share an exact puzzle and the
same seed always reproduces it.

## Planned engine extensions

- Interval crossover model with a specified coefficient of coincidence, for exam-style three-point problems
  (Module 7).
- Gene conversion and post-meiotic mitosis in octads (Module 17), driven by a DSB repair model shared with
  Modules 28 to 30.
- Polyploid meiosis and multivalent pairing (Module 26 genotyping in triploids and tetraploids).
- Sex chromosome systems (Module 12).
