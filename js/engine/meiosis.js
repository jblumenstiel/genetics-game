// The meiosis engine.
//
// meiosis(cell, rng, options) runs one meiosis on a diploid cell and returns the four products in tetrad
// order: products 0 and 1 come from Metaphase I pole 0, products 2 and 3 from pole 1. Every random choice can
// be overridden, so a module can script an exact meiosis for a puzzle and the same engine can also generate
// thousands of random ones for "random spore analysis".
//
// Options (all optional):
//   interference: m for the counting model (0 = none). Default 0.
//   crossingOver: false turns crossovers off everywhere.
//   crossovers:   { [chromIndex]: [{ pos, pair: [i, j] }] } forces crossovers. pair names strand positions
//                 in the four-strand bundle at that point: 0 and 1 are copy 0's sisters, 2 and 3 are copy
//                 1's sisters. pair defaults to a random non-sister pair.
//   orientation:  { [chromIndex]: 0 | 1 } which copy faces pole 0 at Metaphase I.
//   nondisjunction: { [chromIndex]: { stage: 'MI' | 'MII', pole: 0 | 1 } }

import { copyChromatid, makeCell } from './genome.js';
import { int, shuffle } from '../core/rng.js';

// Stahl's counting model. Crossover precursors fall along the bivalent as a Poisson process; every (m+1)th one
// becomes a crossover, starting from a random phase so the process is stationary. A bivalent of length L cM
// gets 2L/100 crossovers on average (each chromatid is in half of them, so L cM means L/100 crossovers per
// chromatid). m = 0 gives no interference and Haldane's mapping function.
export function sampleCrossoverPositions(length, m, rng) {
  const rate = (m + 1) * 0.02;
  const phase = Math.floor(rng() * (m + 1));
  const out = [];
  let x = 0;
  for (let k = 0; ; k++) {
    x += -Math.log(1 - rng()) / rate;
    if (x >= length) break;
    if (k % (m + 1) === phase) out.push(x);
  }
  return out;
}

function splitSegments(segments, pos) {
  const left = [];
  const right = [];
  for (const s of segments) {
    if (s.to <= pos) left.push({ ...s });
    else if (s.from >= pos) right.push({ ...s });
    else {
      left.push({ ...s, to: pos });
      right.push({ ...s, from: pos });
    }
  }
  return [left, right];
}

function mergeSegments(segments) {
  const out = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (last && last.hap === s.hap && last.to === s.from) last.to = s.to;
    else out.push({ ...s });
  }
  return out;
}

// The inverted region involved when two chromatids pair, if they differ in arrangement.
function loopRegion(a, b) {
  if (!a.inversion === !b.inversion) return null;
  return a.inversion || b.inversion;
}

// Reciprocal exchange at pos. The arm away from the centromere is swapped, so each chromatid keeps its own
// centromere (and therefore its own sister at Meiosis II).
export function exchange(a, b, pos, centromere) {
  const swapRight = centromere < pos;
  const [la, ra] = splitSegments(a.segments, pos);
  const [lb, rb] = splitSegments(b.segments, pos);
  if (swapRight) {
    a.segments = mergeSegments(la.concat(rb));
    b.segments = mergeSegments(lb.concat(ra));
  } else {
    a.segments = mergeSegments(lb.concat(ra));
    b.segments = mergeSegments(la.concat(rb));
  }
  // An inversion lying entirely on the swapped arm travels with it.
  const travels = (inv) => inv && (swapRight ? inv.start >= pos : inv.end <= pos);
  const invA = a.inversion;
  const invB = b.inversion;
  a.inversion = (travels(invA) ? null : invA) || (travels(invB) ? invB : null);
  b.inversion = (travels(invB) ? null : invB) || (travels(invA) ? invA : null);
}

export function meiosis(cell, rng, options = {}) {
  const m = options.interference ?? 0;
  const products = [0, 1, 2, 3].map((i) => ({
    index: i,
    pole: i < 2 ? 0 : 1,
    chromosomes: cell.karyotype.map(() => []),
  }));
  const bivalents = [];

  cell.chromosomes.forEach(({ def, copies }, j) => {
    if (copies.length !== 2) throw new Error(`Meiosis needs two copies of chromosome ${def.id}`);

    // Replication: two sister chromatids per homolog.
    const chromatids = [copies[0], copies[0], copies[1], copies[1]].map((c, k) => ({
      ...copyChromatid(c),
      homolog: k < 2 ? 0 : 1,
      sister: k % 2,
      loops: 0,
    }));

    // Crossing over in the four-strand bundle.
    let planned;
    if (options.crossovers?.[j]) {
      planned = options.crossovers[j].map((x) => ({ pos: x.pos, pair: x.pair ?? [int(rng, 0, 1), int(rng, 2, 3)] }));
    } else if (options.crossingOver === false) {
      planned = [];
    } else {
      planned = sampleCrossoverPositions(def.length, m, rng).map((pos) => ({
        pos,
        pair: [int(rng, 0, 1), int(rng, 2, 3)],
      }));
    }
    // Crossovers name strand positions in the bundle, not chromatids. Positions 0 and 1 always hold copy 0's
    // DNA and 2 and 3 hold copy 1's; a crossover reconnects which centromere continues along which position.
    // So each arm is walked outward from the centromere, tracking which chromatid occupies each position.
    const region = loopRegion(copies[0], copies[1]);
    const crossovers = [];
    for (const arm of ['left', 'right']) {
      const onArm = planned
        .filter((x) => (arm === 'left' ? x.pos < def.centromere : x.pos >= def.centromere))
        .sort((a, b) => Math.abs(a.pos - def.centromere) - Math.abs(b.pos - def.centromere));
      const occupant = [0, 1, 2, 3];
      for (const x of onArm) {
        const [p, q] = x.pair;
        const a = occupant[p];
        const b = occupant[q];
        const inLoop = !!region && x.pos > region.start && x.pos < region.end;
        exchange(chromatids[a], chromatids[b], x.pos, def.centromere);
        occupant[p] = b;
        occupant[q] = a;
        if (inLoop) {
          chromatids[a].loops++;
          chromatids[b].loops++;
        }
        crossovers.push({ pos: x.pos, pair: [p, q], chromatids: [a, b], inLoop });
      }
    }
    crossovers.sort((a, b) => a.pos - b.pos);

    // An odd number of exchanges inside an inversion loop leaves a chromatid unbalanced. Paracentric
    // inversions give a dicentric bridge and an acentric fragment; pericentric ones give duplications and
    // deficiencies.
    const inv = copies[0].inversion || copies[1].inversion;
    const normalHomolog = copies[0].inversion ? 1 : 0;
    for (const c of chromatids) {
      if (c.loops % 2 === 0) continue;
      const pericentric = inv.start < def.centromere && def.centromere < inv.end;
      if (pericentric) c.aberration = 'duplication-deficiency';
      else c.aberration = c.homolog === normalHomolog ? 'dicentric' : 'acentric';
    }

    // Metaphase I orientation and Anaphase I.
    const orientation = options.orientation?.[j] ?? int(rng, 0, 1);
    const nd = options.nondisjunction?.[j] ?? null;
    const ndPole = nd ? (nd.pole ?? int(rng, 0, 1)) : null;
    let poles = [
      chromatids.filter((c) => c.homolog === orientation),
      chromatids.filter((c) => c.homolog !== orientation),
    ];
    if (nd?.stage === 'MI') poles = ndPole === 0 ? [chromatids.slice(), []] : [[], chromatids.slice()];

    // Meiosis II.
    poles.forEach((list, p) => {
      const [first, second] = [products[2 * p], products[2 * p + 1]];
      if (list.length === 2) {
        if (nd?.stage === 'MII' && ndPole === p) {
          (rng() < 0.5 ? first : second).chromosomes[j].push(...list);
        } else {
          const [a, b] = rng() < 0.5 ? list : [list[1], list[0]];
          first.chromosomes[j].push(a);
          second.chromosomes[j].push(b);
        }
      } else if (list.length === 4) {
        // Disomic pole after MI non-disjunction: each product gets one chromatid of each homolog.
        const h0 = shuffle(rng, list.filter((c) => c.homolog === 0));
        const h1 = shuffle(rng, list.filter((c) => c.homolog === 1));
        first.chromosomes[j].push(h0[0], h1[0]);
        second.chromosomes[j].push(h0[1], h1[1]);
      }
    });

    bivalents.push({ def, chromatids, crossovers, orientation, nondisjunction: nd ? { stage: nd.stage, pole: ndPole } : null });
  });

  for (const p of products) {
    p.aneuploid = p.chromosomes.some((list) => list.length !== 1);
    p.nullisomic = p.chromosomes.some((list) => list.length === 0);
    p.viable = !p.nullisomic && p.chromosomes.every((list) => list.every((c) => !c.aberration));
    p.cell = makeCell(cell.karyotype, p.chromosomes.map((list) => list.map(copyChromatid)));
  }
  return { bivalents, products };
}

// Mitosis: every chromosome replicates and the sisters go to opposite daughters, so both daughters carry the
// same copies as the parent.
export function mitosis(cell) {
  const daughter = () => makeCell(cell.karyotype, cell.chromosomes.map(({ copies }) => copies.map(copyChromatid)));
  return [daughter(), daughter()];
}

// Fertilization: the zygote carries every chromosome copy from both gametes.
export function fertilize(a, b) {
  return makeCell(
    a.karyotype,
    a.chromosomes.map((c, i) => [...c.copies, ...b.chromosomes[i].copies].map(copyChromatid)),
  );
}
