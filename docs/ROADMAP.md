# Roadmap

Modules are built one at a time, with feedback after each. Every module is generated from a seed, so the
species, trait, dominance mode, genotypes, map distances and sample sizes change from one play to the next.
The `Exam` column marks topics that appear on BIOL 360 Exam I (2023, 2024).

Order follows the brain dump: start with one locus, add loci and linkage, then chromosome behavior, fungal
genetics, statistics, molecular genetics and bacterial genetics. Exam I tests binomial probability and
chi-square early, so Unit E modules 18 and 19 can be moved up to sit right after Module 4 if that matches
the course calendar better.

## Build the cell: a thread through every unit

Students build cells themselves, chromatid by chromatid, and the engine grades each one. The cell builder
(`js/builder/`) and grader (`js/engine/drawing.js`) handle any number of loci and chromosomes, so each later
module gets its own "Build the cell" step with the same eight exam-style questions:

1. egg and sperm, 2. zygote, 3. mitotic metaphase, 4. daughter nuclei, 5. metaphase I with the minimum
crossovers needed for a stated gamete, 6. metaphase II, 7. gametes, 8. gamete genotypes and frequencies.

| Where | Genetic setup |
|-------|---------------|
| Module 0 (built) | One locus, two alleles, no phenotypes |
| Module 4 | Two loci on different chromosomes |
| Module 5 | Two linked loci, cis and trans, crossovers required |
| Module 9 | Two linked loci plus one unlinked (the A B ; c exam question) |
| Module 11 | Non-disjunction at MI or MII |

## Meiosis

| # | Module | Core interaction | Exam |
|---|--------|------------------|------|
| 0 | **Build the cell** (built) | Keep or change the parents' one-line genotypes, then choose a zygote they could produce from options that include genotypes impossible for a diploid autosomal gene or for these parents (each explained); assemble egg, sperm, zygote, mitotic metaphase, daughter cells, metaphase I (with crossover marking), metaphase II and gametes; list gamete genotypes and frequencies. Questions b to h follow the zygote the student built, or another genotype they choose. Graded against the engine, with feedback per misconception | chromatids per chromosome; mitosis vs meiosis outcomes; drawing meiosis |

## Unit A: Segregation and dominance

| # | Module | Core interaction | Exam |
|---|--------|------------------|------|
| 1 | **One gene, one meiosis** (built) | Step a cell through meiosis or mitosis, answering chromatid-count checkpoints; flip bivalent orientation at Metaphase I; fertilize gametes to fill a Punnett square; predict then breed 1/10/100 offspring; detective puzzle inferring parent genotypes from a litter; conditional probability (P(SS given spotted)) | chromatids per chromosome; mitosis vs meiosis; Punnett square meaning; selfing ratios; P(WW given round) |
| 2 | Dominance zoo | Complete, incomplete, codominance, haploinsufficiency, recessive lethals (2:1). Show that codominance and incomplete dominance depend on how phenotypes are defined: the same genotypes can read as complete dominance, incomplete dominance or codominance depending on the phenotype classes chosen | dominant allele identification, haplosufficiency, what counts as a phenotype |
| 3 | Complementation | Auxotrophic creatures/fungi on minimal and supplemented media; build complementation groups from a cross grid | media choice, complementation groups, number of genes |
| 4 | Two genes, two chromosomes | Independent orientation of two bivalents; 9:3:3:1 emerges; product rule for A/a; B/b; C/c selfs | product rule, multi-locus genotype probabilities |

## Unit B: Linkage and mapping

| # | Module | Core interaction | Exam |
|---|--------|------------------|------|
| 5 | Linked genes: cis and trans | Place one crossover in a bivalent and see that 2 of 4 products are recombinant; coupling vs repulsion parents | single crossover gives 2 recombinant products; gametes from Ab/aB |
| 6 | Genetic distance | Random spore analysis: sample products, estimate RF, place genes on a map | gamete proportions at 12 cM |
| 7 | Three-point crosses and interference | Order genes from testcross classes; double crossovers; coefficient of coincidence and I = 1 − c | three-point testcross with I = 0, 0.2, 0.8; drawing the MI configuration |
| 8 | Beyond 50%: mapping functions | Slide distance from 1 to 3000 cM; watch double crossovers hide; Haldane and Kosambi curves | 2500 to 3000 cM gives 25% of each class |
| 9 | Four loci, mixed linkage | Two linked plus two independent, all linked, or all independent; infer the arrangement from progeny | combined linkage and independent assortment |
| 10 | Crossover interference | Counting-model visual of crossover spacing; compare m = 0 to strong interference | interference |

## Unit C: Chromosome behavior

| # | Module | Core interaction | Exam |
|---|--------|------------------|------|
| 11 | Non-disjunction: MI vs MII | Force ND at MI or MII, with and without a crossover between locus and centromere; diagnose ND stage from disomic gametes | |
| 12 | Sex chromosomes and sex linkage | XY, ZW, XO and haplodiploid systems; X-linked crosses | color blindness from a carrier mother |
| 13 | Pedigrees | Identify mode of inheritance; Bayesian updating with unaffected children | mode of inheritance; Huntington's conditional probability; linked-marker pedigree (cn bw) |
| 14 | Inversions | Paracentric bridges and acentric fragments, pericentric duplication/deficiency; recombination suppression | |

## Unit D: Fungal genetics (Neurospora)

| # | Module | Core interaction | Exam |
|---|--------|------------------|------|
| 15 | Tetrad analysis | Build asci; classify PD, NPD and TT under different linkage | |
| 16 | Ordered tetrads and centromere mapping | MI vs MII segregation patterns; centromere distance = ½ × MII frequency | |
| 17 | Gene conversion | 6:2 and 5:3 asci; mismatch repair outcomes | |

## Unit E: Probability and statistics

| # | Module | Core interaction | Exam |
|---|--------|------------------|------|
| 18 | Binomial probability | At least one, exactly k of n; families of children; selfed peas | yes |
| 19 | Chi-square goodness of fit | Test segregation distortion from observed counts | yes |
| 20 | What a p-value means | Simulate the null many times and see where the observed value falls | chi-square statistic vs p-value |
| 21 | Simulate it in R | Read and predict the output of short R simulation loops | Part II R code questions |
| 22 | Quantitative genetics | Many additive loci produce a bell curve; heritability and selection | |

## Unit F: Molecular genetics

| # | Module | Core interaction |
|---|--------|------------------|
| 23 | DNA is the genetic material | Griffith/Avery transformation and Hershey–Chase, both ways |
| 24 | Meselson–Stahl | Predict density bands for conservative, semiconservative and dispersive models |
| 25 | The replication fork | Leading and lagging strands; 3′ extension; primers |
| 26 | PCR and primer design | Design 5′→3′ primers to genotype deletions, TE insertions and inversions in haploids, diploids and polyploids |
| 27 | Transcription | Template vs coding strand; direction of synthesis |
| 28 | Double-strand break repair | Szostak model, double Holliday junctions, crossover vs noncrossover resolution |
| 29 | Mismatch repair and gene conversion | Heteroduplex repair links back to Module 17 |
| 30 | From molecules to map distance | Spo11 break frequency, crossover designation and interference link back to Modules 7 to 10 |

## Unit G: Bacterial genetics

| # | Module | Core interaction |
|---|--------|------------------|
| 31 | Selective media | Choose media to select or screen for genotypes |
| 32 | Transformation | Uptake and recombination of donor DNA |
| 33 | Transduction | Co-transduction frequency and gene order |

## Tools

Teaching tools listed after the units on the hub. They are plain HTML pages (`tool: true` in the registry), not game
modules: no canvas, no side panel, and they don't follow the game's question and feedback conventions.

| # | Tool | What it does |
|---|------|--------------|
| 1 | **Pedigree Generator** (built) | Pick autosomal recessive or dominant, X-linked recessive or dominant, Y-linked or mitochondrial; it simulates three-generation human pedigrees (`js/engine/pedigree.js`) and shows the first one whose pattern is clear, with genotypes on demand. Mode and seed are in the URL. A standalone copy without the site header is at `/pedigree/` (`pedigree/index.html`): it starts from a new random seed on every load, shows the seed, and takes a seed typed in |

## Later

- A play-through review from several student and instructor viewpoints (a struggling student, an honors student in
  a hurry, an outside genetics instructor, a usability reviewer), once more modules are built. Read-only, with a
  ranked report that keeps breaks of `CLAUDE.md` rules apart from differences of taste.
