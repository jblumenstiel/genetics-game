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
- Units are lettered, modules numbered, and the panels within a module lettered: "A. Meiosis", "B. Gametes".
  Panel headings put the unit first ("Unit A · Module 1"); use `moduleEyebrow` and `stepLetter` in `registry.js`.
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
- **Gamete pickers include non-haploid look-alikes.** Whenever students choose gamete genotypes, mix the real
  gametes with options built from the individual's alleles that are not haploid: its diploid genotype (H/h), two
  copies (H;H), three copies (HHH), doubled sets (Hh;Hh); with more genes, things like A/a ; B/b or AaBb. Choosing
  one shows "Gametes are haploid. Under normal meiosis, this is not a proper genotype for a gamete."
  Exception: in non-disjunction modules (MI or MII), some disomic or nullisomic gametes are correct. The prompt
  must say the question is about the abnormal case of non-disjunction, and only then are those gametes accepted.
- State the assumptions in prompts (for example "a diploid organism, and an autosomal gene").
- Gate counting questions before building where it teaches something, for example "After Meiosis I, there are
  how many nuclei?" (1 or 2), "After Meiosis II, how many gametes?" (1, 2 or 4).
- Label division stages by name: "Mitosis: Metaphase", "Meiosis: Metaphase I", "Meiosis: Metaphase II". Use
  Roman numerals for Meiosis I and II.
- **Punnett squares:** sperm across the top row, eggs down the left column, with the father shown above and the
  mother to the left. Each cell shows its bdellbee, its genotype and its probability, as P(A/a) = ½ × ½ = ¼.
  Present the square as a summary of independent fertilization events, not as a mechanism.
- "Show me" appears after two wrong checks. An answer the student was shown does not count as completed.

## Interaction and visual style

- Students build cells by dragging pieces from the tray: chromosomes with 1 or 2 chromatids, allele chips, the
  nucleus piece and the bin. Drop targets highlight while dragging. Avoid select-then-press-a-button flows.
- Each question's stage name is the title at the top of the main page ("Mitosis: Metaphase"), without its letter.
- Forms for a question (like Module 0's gamete list) go on the main page under that title, as HTML in `ctx.stage`
  styled like the build tray. The side panel keeps the prompt and, once it is right, the result.
- Questions on the main page go in a sheet at the bottom of the canvas (Module 1's `QuestionSheet`), one at a time.
  The picture lays out above the sheet, and the panel records each right answer with its reason.
- A right answer stays on screen, selected with its response, until the student moves on (next question, next action
  or next page). Don't swap the picker for a one-line summary.
- Metaphase arrangement is chosen on the canvas (bar above the cell, or dropping a chromosome on the plate):
  centromeres single file on the plate, or homologs paired across it.
- Animations (the how-to demo, anaphase, egg and sperm fusion, the closing "A new bdellbee is born!") lock input
  while they run, never count as the student's answer, and stop cleanly if the student moves to another question.
- Art style: clean, vector, muted and organic. Colors come from `js/core/palette.js` and the CSS variables in
  `css/style.css`; type is Fraunces (headings) and Nunito (body).
- The creatures are gorbies, glubbins and chomnies; "bdellbee" is the general name for a creature in the game.
  Sperm are drawn as an oval head wider than tall with a wavy tail on the right; eggs are round.
- **Bdellbee phenotype (provisional; may change):** each gene gets one bdellbee look per problem. It is colored
  when the dominant allele is present (homozygous or heterozygous) and white when homozygous recessive. No
  genotype is written on the creature.

## Current state and deferred work

- Module 0 (Build the cell) is finished and in use. Module 1 (One gene, one meiosis) and Module 2 (Two genes, two chromosomes) are under construction.
- Crossing over is removed from Module 0's Metaphase I for now. The engine and builder still support it; to bring it
  back, set `crossovers: true` and `minCross` on Question E.
- Module 1 decisions:
  - It opens with an intro page of objectives and builds from meiosis to the Punnett square.
  - It uses one pigment gene with complete dominance only (incomplete and codominance wait for Module 3), and makes
    no mention of crossing over.
  - Its heterozygous bdellbee from A and B becomes the mother in C, and C and D cross two heterozygotes.
  - B. Gametes makes single random gametes first, then batches of 10, 20 or 30 up to 200.
  - Deferred: a "1 gamete from each of many meioses" comparison in B.
- The roadmap's "Build the cell" thread adds the same eight questions to Modules 2, 5, 9 and 11 with more loci.
- Exam I covers binomial probability and chi-square early; the statistics modules may move earlier in the roadmap.
