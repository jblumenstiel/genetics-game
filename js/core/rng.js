// Seeded random numbers. Every generated puzzle draws from one of these, so a seed reproduces it exactly.

// mulberry32: small, fast, good enough for games and simulations.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

// Integer in [lo, hi], inclusive.
export function int(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function chance(rng, p) {
  return rng() < p;
}

export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Draw an index from a list of weights.
export function weighted(rng, weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let u = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    u -= weights[i];
    if (u < 0) return i;
  }
  return weights.length - 1;
}

// Derive an independent child generator, e.g. one per step of a module.
export function fork(rng) {
  return makeRng(Math.floor(rng() * 0xffffffff));
}
