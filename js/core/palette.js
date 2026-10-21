// Art direction: muted, organic tones. Pixi colors are numbers; css() converts for the DOM.

export const PALETTE = {
  paper: 0xf3eee4,
  panel: 0xfbf8f2,
  ink: 0x3b3631,
  inkSoft: 0x7a7167,
  line: 0xe2d9ca,
  sage: 0x6f8f6a,
  clay: 0xc08466,
  ochre: 0xd2ab62,
  dusk: 0x7e94ad,
  plum: 0x9a7a92,
  blush: 0xe8a99a,
  cell: 0xf6eedf,
  cellEdge: 0xc9b89b,
  nucleus: 0xebe0cb,
  spindle: 0xb9ab92,
  // Haplotype colors: one per parental chromosome, so recombinant chromatids show where each piece came from.
  hap: [0xc98f7a, 0x7e9db4, 0x8fae8b, 0xd3ae6a, 0xa98bb0, 0x9b9b7a],
  creature: {
    moss: 0x9bb38a,
    lagoon: 0x8fb3b0,
    sand: 0xd8bf94,
    blue: 0x7f9dc0,
    rust: 0xc9825e,
    // A bdellbee with no pigment (homozygous recessive for a pigment gene).
    white: 0xfbf9f4,
  },
};

function channels(c) {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

function pack(r, g, b) {
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

// Linear blend from a (t = 0) to b (t = 1).
export function mix(a, b, t) {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return pack(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

// Negative amounts darken toward ink, positive amounts lighten toward white.
export function shade(c, amount) {
  return amount < 0 ? mix(c, 0x2a2622, -amount) : mix(c, 0xffffff, amount);
}

export function css(c) {
  return `#${c.toString(16).padStart(6, '0')}`;
}
