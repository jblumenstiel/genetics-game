// Mapping functions: convert between map distance d (cM) and recombination fraction r.

export function haldane(d) {
  return 0.5 * (1 - Math.exp((-2 * d) / 100));
}

export function haldaneInverse(r) {
  return -50 * Math.log(1 - 2 * r);
}

export function kosambi(d) {
  const x = (4 * d) / 100;
  return 0.5 * Math.tanh(x / 2);
}

export function kosambiInverse(r) {
  return 25 * Math.log((1 + 2 * r) / (1 - 2 * r));
}

// Ordered-tetrad centromere distance with no interference: the fraction of asci showing MII segregation for
// a locus d cM from its centromere.
export function secondDivisionFrequency(d) {
  return (2 / 3) * (1 - Math.exp((-3 * d) / 100));
}
