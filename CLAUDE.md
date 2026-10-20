# CLAUDE.md

Standing instructions for working on **Bdellbee Genetics**, an interactive genetics game for BIOL 360 Honors
Genetics. Students use it to prepare for the course exams, so exam alignment matters.

- Live site: https://jblumenstiel.github.io/genetics-game/ (GitHub Pages, deployed from `main`)
- What is planned, and in what order: [docs/ROADMAP.md](docs/ROADMAP.md)
- How the code fits together: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Source material for questions: the exams and class problems in the parent `ClaudeGame` folder

## Workflow

- Build **one module at a time**. The instructor tests each change and gives feedback before moving on.
- Test every change locally before offering to publish:
  - `npm test` runs the engine and grader tests (Node is in `~/.local/node/bin`; put it on `PATH`).
  - `python3 tools/serve.py 8000` serves the site with caching off. Check the change in the browser, at desktop
    and phone widths, and look for console errors.
- **Commit and push only when the instructor asks.** Pushing to `main` publishes to the live site within a minute
  or two. After a push, confirm the live site serves the new files.
- Remind the instructor to hard refresh (Cmd+Shift+R) when checking the live site.
- Record decisions in the repo (this file or the roadmap), not only in conversation.
- **Suggest additions to this file.** When the instructor settles something that should hold beyond the current
  task, offer in one line to add it here: a new feedback or teaching rule, a correction to how something is
  drawn or worded, a feature deferred for later, or a change to the workflow. Add it only after they agree, and
  keep the wording short. Don't suggest it for one-off fixes.

## Code conventions

- Plain ES modules, no build step. PixiJS is loaded from a CDN, pinned at **8.21.0**; keep the version pinned.
- `js/engine/` is pure logic with no drawing, and every engine change gets Node tests in `tests/`. Check the
  biology against known results (segregation ratios, mapping functions, centromere distance, and so on).
- Every module generates its instance from a seed (`?seed=` in the URL reproduces it). Vary species, alleles,
  genotypes and numbers from the seed instead of hard-coding them.
- Expected answers come from the engine (for example `nucleusFromCell`, `metaphaseIINuclei`, `gameteNuclei`), never
  typed in by hand. The grader in `js/engine/drawing.js` returns coded problems; the module turns them into
  sentences.
- New modules go in `js/modules/m<nn>-<name>/` and are registered in `js/modules/registry.js`. Set
  `underConstruction: true` on modules that are not finished; they get a note in the panel and a tag on the hub.
- Module 0 sits in its own unit, "Meiosis" (`bare: true`, shown by title alone). Other units are "Unit A", "Unit B", ...
- Match the surrounding code: comment why, not what, and keep functions small.

## Teaching and feedback rules

- **Name the genotypes.** When an answer has the wrong genotype, say so and give both, computed from the
  instance: "This is not the right genotype. The genotype should be H/h; you built H/H." For several nuclei,
  list each one. Never fall back on a generic hint like "check the alleles".
- **Count chromosomes by centromeres.** When a student counts sister chromatids as chromosomes, say so: "You have
  2 chromatids, but those are the sister chromatids of a single homolog."
- Feedback should name the specific misconception (pairing in mitosis, unreplicated chromosomes at metaphase,
  sisters with different alleles, wrong number of nuclei), and explain the biology in a sentence.
- Use one-line genotype notation: `/` separates alleles on homologs, ` ; ` separates genes on different
  chromosomes. Genotype pickers mix possible and impossible options; an impossible choice shows "This is not a
  possible genotype under standard conditions." with the reason.
- State the assumptions in prompts (for example "a diploid organism, and an autosomal gene").
- Gate counting questions before building where it teaches something, for example "After Meiosis I, there are
  how many nuclei?" (1 or 2), "After Meiosis II, how many gametes?" (1, 2 or 4).
- Label division stages by name: "Mitosis: Metaphase", "Meiosis: Metaphase I", "Meiosis: Metaphase II". Use
  Roman numerals for Meiosis I and II.
- "Show me" appears after two wrong checks. An answer the student was shown does not count as completed.

## Interaction and visual style

- Students build cells by dragging pieces from the tray: chromosomes with 1 or 2 chromatids, allele chips, the
  nucleus piece and the bin. Drop targets highlight while dragging. Avoid select-then-press-a-button flows.
- Metaphase arrangement is chosen on the canvas (bar above the cell, or dropping a chromosome on the plate):
  centromeres single file on the plate, or homologs paired across it.
- Animations (the how-to demo, anaphase, egg and sperm fusion, the closing "A new bdellbee is born!") lock input
  while they run, never count as the student's answer, and stop cleanly if the student moves to another question.
- Art style: clean, vector, muted and organic. Colors come from `js/core/palette.js` and the CSS variables in
  `css/style.css`; type is Fraunces (headings) and Nunito (body).
- The creatures are gorbies, glubbins and chomnies; "bdellbee" is the general name for a creature in the game.
  Sperm are drawn as an oval head wider than tall with a wavy tail on the right; eggs are round.

## Current state and deferred work

- Module 0 (Build the cell) is in use. Module 1 (One gene, one meiosis) is under construction.
- Crossing over is removed from Module 0's Metaphase I for now. The engine and builder still support it; to bring it
  back, set `crossovers: true` and `minCross` on question e.
- The roadmap's "Build the cell" thread adds the same eight questions to Modules 2, 5, 9 and 11 with more loci.
- Exam I covers binomial probability and chi-square early; the statistics modules may move earlier in the roadmap.
