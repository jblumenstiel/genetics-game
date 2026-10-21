// Genotype to phenotype. Each trait gets an express(alleleIds) function built by one of the helpers below.
// They count allele copies, so they work for any number of copies (haploid, diploid, trisomic, polyploid).
//
// express returns { key, label, features } where features are creature drawing parameters.

// Complete dominance: one copy of the dominant allele is enough for the dominant phenotype.
export function completeDominance(dominantId, recessiveId, dominantPheno, recessivePheno) {
  return (alleles) => {
    const p = alleles.includes(dominantId) ? dominantPheno : recessivePheno;
    return { ...p, features: { ...p.features } };
  };
}

// Incomplete dominance: the phenotype reflects the fraction f of copies that are the "high" allele.
// classes are [allLow, mixed, allHigh]; featuresOf(f) maps the fraction to drawing parameters.
export function incompleteDominance(highId, classes, featuresOf) {
  return (alleles) => {
    const f = alleles.length ? alleles.filter((a) => a === highId).length / alleles.length : 0;
    const c = f === 0 ? classes[0] : f === 1 ? classes[2] : classes[1];
    return { key: c.key, label: c.label, features: featuresOf(f) };
  };
}

// Codominance: every allele present shows its own feature.
// byAllele: { [alleleId]: { key, label, features } }, joined into one phenotype when several are present.
export function codominance(order, byAllele) {
  return (alleles) => {
    const present = order.filter((id) => alleles.includes(id));
    const parts = present.map((id) => byAllele[id]);
    return {
      key: parts.map((p) => p.key).join('+'),
      label: parts.map((p) => p.label).join(' and '),
      features: Object.assign({}, ...parts.map((p) => p.features)),
    };
  };
}

// Order alleles the way the trait lists them, so Ss is never written sS.
export function sortAlleles(trait, alleles) {
  const order = trait.alleles.map((a) => a.id);
  return alleles.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export function alleleLabel(trait, id) {
  return trait.alleles.find((a) => a.id === id).label;
}

// One-line notation, dominant first, with "/" between the alleles on the two homologs: "S/s", "Cᴮ/Cᴿ".
export function genotypeLabel(trait, alleles) {
  return sortAlleles(trait, alleles)
    .map((id) => alleleLabel(trait, id))
    .join('/');
}

export function genotypeKey(trait, alleles) {
  return sortAlleles(trait, alleles).join('/');
}

export function express(trait, alleles) {
  return trait.express(alleles);
}
