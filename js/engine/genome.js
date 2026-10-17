// Genome model.
//
// A haplotype is one parental chromosome's set of alleles. A chromatid is a list of segments in standard map
// coordinates (cM), each pointing at the haplotype it was copied from. Crossing over swaps segments between
// chromatids, so a recombinant chromatid still knows which parent each stretch came from, which is what the
// renderer uses to color it.
//
// Chromosome definitions (a karyotype) look like:
//   { id: '1', name: 'Chromosome 1', length: 100, centromere: 50, loci: [{ id: 'spots', pos: 30 }] }

let nextHapId = 1;

export function haplotype(alleles, { origin = null, color = null, label = '' } = {}) {
  return { id: nextHapId++, alleles: { ...alleles }, origin, color, label };
}

// A single unreplicated chromosome carrying one haplotype along its whole length.
export function chromosome(def, hap, { inversion = null } = {}) {
  return {
    chrom: def.id,
    segments: [{ from: 0, to: def.length, hap }],
    inversion: inversion ? { ...inversion } : null,
    aberration: null,
  };
}

export function copyChromatid(c) {
  return {
    chrom: c.chrom,
    segments: c.segments.map((s) => ({ ...s })),
    inversion: c.inversion ? { ...c.inversion } : null,
    aberration: c.aberration,
  };
}

// The segment covering a map position. Positions at the far end belong to the last segment.
export function segmentAt(c, pos) {
  for (const s of c.segments) if (pos >= s.from && pos < s.to) return s;
  return c.segments[c.segments.length - 1];
}

export function findLocus(karyotype, locusId) {
  for (let i = 0; i < karyotype.length; i++) {
    const locus = karyotype[i].loci.find((l) => l.id === locusId);
    if (locus) return { def: karyotype[i], index: i, locus };
  }
  throw new Error(`Unknown locus ${locusId}`);
}

export function alleleOn(c, locus) {
  return segmentAt(c, locus.pos).hap.alleles[locus.id];
}

// A cell holds, for each chromosome in the karyotype, the list of copies present (2 in a normal diploid,
// 1 in a haploid spore or gamete, 3 in a trisomic, 0 in a nullisomic).
export function makeCell(karyotype, copies) {
  return { karyotype, chromosomes: karyotype.map((def, i) => ({ def, copies: copies[i] })) };
}

// Build a diploid cell from two haplotype lists, one per parent. haps[i] is [maternalHap, paternalHap] for
// chromosome i.
export function diploid(karyotype, haps, options = {}) {
  return makeCell(
    karyotype,
    karyotype.map((def, i) => haps[i].map((h, k) => chromosome(def, h, { inversion: options.inversions?.[i]?.[k] }))),
  );
}

// All alleles at a locus across every copy of its chromosome, in copy order.
export function allelesAt(cell, locusId) {
  const { index, locus } = findLocus(cell.karyotype, locusId);
  return cell.chromosomes[index].copies.map((c) => alleleOn(c, locus));
}

export function ploidyOf(cell, index) {
  return cell.chromosomes[index].copies.length;
}
