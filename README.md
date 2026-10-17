# Gorby Genetics

Interactive genetics modules with gorbies, glubbins and chomnies, built on PixiJS (WebGL) and a tested
meiosis engine. Every module is generated from a seed, so creatures, traits, dominance, genotypes and
numbers change each play, and `?seed=` in the URL reproduces a specific instance.

Live site: https://jblumenstiel.github.io/genetics-game/

## Status

- **Module 1, One gene, one meiosis:** playable. Meiosis vs mitosis with chromatid-count checkpoints,
  Metaphase I orientation, gametes (whole tetrads vs one product per meiosis), fertilization into a Punnett
  square, predict-then-breed, and a detective puzzle with conditional probability.
- **Modules 2 to 33:** planned. See [docs/ROADMAP.md](docs/ROADMAP.md).

How the code fits together: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run locally

ES modules do not load from `file://`, so serve the folder:

```bash
python3 tools/serve.py 8000
```

Then open http://localhost:8000. The dev server disables caching so edits always reload.

## Test the engine

```bash
npm test
```

Requires Node 18 or newer. The tests check the engine against known results: 1:1 segregation, Haldane's
mapping function with no interference, 3000 cM behaving as unlinked, two of four products recombinant
after one crossover, the MII segregation formula for centromere distance, PD = NPD for unlinked genes,
MI vs MII non-disjunction, inversion suppression of recombination, and the coefficient of coincidence
under interference.
