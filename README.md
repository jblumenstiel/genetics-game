# Genetics Game

An interactive genetics learning game built with [PixiJS](https://pixijs.com/) (8.21.0, loaded from a CDN). The plan is to build it module by module.

## Run locally

ES modules do not load from `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Add `?seed=123` to the URL to reproduce a specific run.

## Test the genetics engine

```bash
npm test
```

Requires Node 18 or newer. The engine in `js/engine/` has no rendering code, so the tests run without a browser.

## Layout

- `index.html`: page shell and the Pixi script tag
- `js/main.js`: rendering and interaction
- `js/engine/meiosis.js`: pure genetics logic (seeded RNG, segregation, phenotype)
- `tests/`: Node tests for the engine

## Modules

1. Single locus, random segregation (in progress)
