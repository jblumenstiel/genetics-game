// Drawing models: the cells a student builds, the cells the engine says they should be, and the grader that
// compares them.
//
//   nucleus:    { label, items: [item], arrangement? }   arrangement at metaphase: 'plate' (single file on the
//               metaphase plate) or 'paired' (homologs paired across the plate); absent means not arranged
//   chromosome: { kind: 'chromosome', chrom, chromatids: [{ alleles: { [locusId]: allele | null } }] }
//   bivalent:   { kind: 'bivalent', chrom, homologs: [chromosome, chromosome], crossovers: [{ interval }] }
//
// Positions on screen never matter. What is graded is which nucleus each chromosome is in, how many chromatids
// it has, its alleles, whether homologs are paired, and how many crossovers were marked.

import { alleleOn } from './genome.js';

function chromatidModel(c, def) {
  return { alleles: Object.fromEntries(def.loci.map((l) => [l.id, alleleOn(c, l)])) };
}

// A nucleus straight from an engine cell. replicated: two identical sisters per chromosome. paired: homolog
// pairs become bivalents (Metaphase I).
export function nucleusFromCell(cell, { label = '', replicated = false, paired = false } = {}) {
  const items = [];
  for (const { def, copies } of cell.chromosomes) {
    const chroms = copies.map((c) => ({
      kind: 'chromosome',
      chrom: def.id,
      chromatids: (replicated ? [c, c] : [c]).map((x) => chromatidModel(x, def)),
    }));
    if (paired && chroms.length === 2) items.push({ kind: 'bivalent', chrom: def.id, homologs: chroms, crossovers: [] });
    else items.push(...chroms);
  }
  return { label, items };
}

// Metaphase II nuclei from an engine meiosis: each pole holds the two sister chromatids of one homolog, as they
// stand after any crossing over.
export function metaphaseIINuclei(result) {
  return [0, 1].map((p) => ({
    label: '',
    items: result.bivalents.map((b) => {
      const homolog = p === 0 ? b.orientation : 1 - b.orientation;
      return {
        kind: 'chromosome',
        chrom: b.def.id,
        chromatids: b.chromatids.filter((c) => c.homolog === homolog).map((c) => chromatidModel(c, b.def)),
      };
    }),
  }));
}

export function gameteNuclei(result) {
  return result.products.map((p) => nucleusFromCell(p.cell));
}

export function chromosomesOf(nucleus) {
  return nucleus.items.flatMap((it) => (it.kind === 'bivalent' ? it.homologs : [it]));
}

export function chromosomeCount(nucleus) {
  return chromosomesOf(nucleus).length;
}

const chromatidKey = (ct, loci) => loci.map((l) => ct.alleles[l] ?? '?').join('');
const chromosomeKey = (ch, loci) => `${ch.chrom}[${ch.chromatids.map((ct) => chromatidKey(ct, loci)).sort().join(',')}]`;

// A canonical string for a nucleus: order-free, so two nuclei with the same contents always match.
export function nucleusKey(nucleus, loci) {
  return nucleus.items
    .map((it) => (it.kind === 'bivalent' ? `biv(${it.homologs.map((h) => chromosomeKey(h, loci)).sort().join('|')})` : chromosomeKey(it, loci)))
    .sort()
    .join(' ');
}

// A nucleus's genotype in one-line notation: one allele string per chromosome (sister chromatids share it), with
// homologs joined by "/" and different chromosomes by " ; ". Uppercase alleles sort first, so it reads H/h.
// loci: ordered locus ids; chromOrder: chromosome ids in karyotype order.
export function nucleusGenotype(nucleus, loci, chromOrder = null) {
  const byChrom = new Map();
  for (const c of chromosomesOf(nucleus)) {
    const alleles = loci.map((l) => c.chromatids[0]?.alleles[l]).filter(Boolean).join('');
    if (!byChrom.has(c.chrom)) byChrom.set(c.chrom, []);
    byChrom.get(c.chrom).push(alleles || '?');
  }
  const order = chromOrder ?? [...byChrom.keys()].sort();
  const parts = order.filter((id) => byChrom.has(id)).map((id) => byChrom.get(id).sort().join('/'));
  return parts.length ? parts.join(' ; ') : 'empty';
}

// Fewest crossovers needed for a gamete chromatid spelling `target` along `loci` (in chromosome order), given the
// two parental homolog haplotypes. Each switch between homologs between adjacent loci costs one crossover.
export function minCrossovers(target, homologs, loci) {
  let cost = homologs.map((h) => (h[loci[0]] === target[loci[0]] ? 0 : Infinity));
  for (const l of loci.slice(1)) {
    cost = homologs.map((h, i) => {
      if (h[l] !== target[l]) return Infinity;
      return Math.min(cost[i], cost[1 - i] + 1);
    });
  }
  return Math.min(...cost);
}

// Grade a student's nuclei against the expected ones. Returns { ok, problems }, where each problem is
// { code, ...details } in priority order; the module turns codes into sentences for its stage.
//   matchBy: 'label' pairs nuclei by label (egg vs sperm); 'multiset' accepts any order.
//   minCross: if set, the number of crossovers marked must equal it.
//   arrangement: if set ('plate' or 'paired'), every nucleus must be arranged that way at metaphase.
export function evaluate(student, expected, { loci, matchBy = 'multiset', minCross = null, arrangement = null } = {}) {
  const problems = [];
  const done = () => ({ ok: problems.length === 0, problems });

  if (student.length !== expected.length) {
    problems.push({ code: 'nucleus-count', expected: expected.length, got: student.length });
    return done();
  }

  const pairs =
    matchBy === 'label'
      ? expected.map((e) => [student.find((s) => s.label === e.label), e])
      : student.map((s) => [s, expected[0]]);

  const expChromatids = chromosomesOf(expected[0])[0]?.chromatids.length;
  const expPaired = expected.some((e) => e.items.some((i) => i.kind === 'bivalent'));
  const expSistersDiffer = expected.some((e) =>
    chromosomesOf(e).some((c) => c.chromatids.length === 2 && chromatidKey(c.chromatids[0], loci) !== chromatidKey(c.chromatids[1], loci)),
  );

  for (const [s, e] of pairs) {
    const want = chromosomeCount(e);
    const got = chromosomeCount(s);
    // Chromatids are reported too, so feedback can explain that chromosomes are counted by centromeres.
    const chromatids = chromosomesOf(s).reduce((n, c) => n + c.chromatids.length, 0);
    if (got !== want) problems.push({ code: 'chromosome-count', label: s.label, expected: want, got, chromatids });
  }
  if (problems.length) return done();

  const all = student.flatMap(chromosomesOf);
  if (all.some((c) => c.chromatids.length !== expChromatids)) {
    problems.push({ code: 'chromatid-count', expected: expChromatids });
    return done();
  }

  if (arrangement) {
    const off = student.find((n) => n.arrangement !== arrangement);
    if (off) {
      problems.push(off.arrangement ? { code: 'wrong-arrangement', expected: arrangement, got: off.arrangement } : { code: 'not-arranged', expected: arrangement });
      return done();
    }
  }

  const studentPaired = student.some((n) => n.items.some((i) => i.kind === 'bivalent'));
  if (expPaired && student.some((n) => n.items.some((i) => i.kind !== 'bivalent'))) problems.push({ code: 'needs-pairing' });
  if (!expPaired && studentPaired) problems.push({ code: 'no-pairing' });
  if (problems.length) return done();

  // Each chromatid is labeled for the genes on its own chromosome (a chromosome carries only its own locus).
  if (all.some((c) => c.chromatids.some((ct) => Object.values(ct.alleles).some((a) => !a)))) {
    problems.push({ code: 'unlabeled' });
    return done();
  }

  if (!expSistersDiffer) {
    const crossed = new Set(
      student.flatMap((n) => n.items.filter((i) => i.kind === 'bivalent' && i.crossovers.length).flatMap((i) => i.homologs)),
    );
    const differ = all.some(
      (c) => !crossed.has(c) && c.chromatids.length === 2 && chromatidKey(c.chromatids[0], loci) !== chromatidKey(c.chromatids[1], loci),
    );
    if (differ) {
      problems.push({ code: 'sisters-differ' });
      return done();
    }
  }

  // Wrong contents: report the genotypes built and expected so feedback can name them.
  if (matchBy === 'label') {
    for (const [s, e] of pairs) {
      if (nucleusKey(s, loci) !== nucleusKey(e, loci)) problems.push({ code: 'content', label: s.label, got: nucleusGenotype(s, loci), expected: nucleusGenotype(e, loci) });
    }
  } else {
    const a = student.map((n) => nucleusKey(n, loci)).sort();
    const b = expected.map((n) => nucleusKey(n, loci)).sort();
    if (a.join('\n') !== b.join('\n')) {
      problems.push({
        code: 'content',
        got: student.map((n) => nucleusGenotype(n, loci)).sort(),
        expected: expected.map((n) => nucleusGenotype(n, loci)).sort(),
      });
    }
  }
  if (problems.length) return done();

  if (minCross != null) {
    const marked = student.flatMap((n) => n.items).reduce((s, i) => s + (i.kind === 'bivalent' ? i.crossovers.length : 0), 0);
    if (marked > minCross) problems.push({ code: 'crossovers-extra', min: minCross, got: marked });
    if (marked < minCross) problems.push({ code: 'crossovers-missing', min: minCross, got: marked });
  }
  return done();
}

// Parse a frequency typed by a student: "1/2", "0.5", "50%".
export function parseFrequency(text) {
  const t = String(text).trim().replace(/\s+/g, '');
  if (!t) return null;
  if (t.endsWith('%')) {
    const v = Number(t.slice(0, -1));
    return Number.isFinite(v) ? v / 100 : null;
  }
  if (t.includes('/')) {
    const [n, d] = t.split('/').map(Number);
    return Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d : null;
  }
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}
