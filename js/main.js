import { makeRng, segregateSingleLocus, phenotype } from './engine/meiosis.js';

// Muted, organic palette.
const COLORS = {
  bg: 0xf4efe6,
  cell: 0xe6dcc6,
  cellEdge: 0xb8a98a,
  ink: 0x4a4339,
  dominant: 0x6f9a74,
  recessive: 0xc48a63,
  spotted: 0xd9b48f,
  spot: 0x9c7150,
  plain: 0xbfd0c4,
  button: 0xddd3bd,
};

// ?seed=123 in the URL reproduces a specific run.
const seed = Number(new URLSearchParams(location.search).get('seed')) || Date.now();
const rng = makeRng(seed);

const app = new PIXI.Application();
await app.init({ background: COLORS.bg, resizeTo: window, antialias: true });
document.getElementById('game').appendChild(app.canvas);

const scene = new PIXI.Container();
app.stage.addChild(scene);

const state = {
  genotype: randomGenotype(),
  result: null, // output of segregateSingleLocus
  animT: 1,     // 0 -> 1 while spores travel from the cell to their slots
};

let layoutNow = null;   // layout computed in the last build()
let spores = [];        // display objects, one per spore
let builtW = 0;
let builtH = 0;

function randomGenotype() {
  return ['SS', 'Ss', 'ss'][Math.floor(rng() * 3)];
}

function alleleColor(allele) {
  return allele === allele.toUpperCase() ? COLORS.dominant : COLORS.recessive;
}

function label(str, size, opts = {}) {
  const t = new PIXI.Text({
    text: str,
    style: { fontFamily: 'system-ui, sans-serif', fontSize: size, fill: COLORS.ink, ...opts },
  });
  t.anchor.set(0.5);
  return t;
}

function layout(w, h) {
  const wide = w >= 720;
  const s = Math.max(0.6, Math.min(1.2, Math.min(w / 900, h / 640)));
  const cell = wide ? { x: w * 0.28, y: h * 0.5 } : { x: w / 2, y: h * 0.42 };
  const slots = wide
    ? [[w * 0.62, h * 0.4], [w * 0.84, h * 0.4], [w * 0.62, h * 0.62], [w * 0.84, h * 0.62]]
    : [0.2, 0.4, 0.6, 0.8].map((f) => [w * f, h * 0.7]);
  return { s, cell, slots, wide, w, h };
}

function drawCell(L) {
  const { s, cell } = L;
  const g = new PIXI.Graphics();
  g.ellipse(cell.x, cell.y, 150 * s, 110 * s).fill(COLORS.cell);
  g.ellipse(cell.x, cell.y, 150 * s, 110 * s).stroke({ width: 3 * s, color: COLORS.cellEdge });
  scene.addChild(g);

  // Two homologs, one allele each. Drawn as simple rounded bars.
  const [a1, a2] = state.genotype;
  [[a1, -30], [a2, 30]].forEach(([allele, dx]) => {
    const x = cell.x + dx * s;
    const bar = new PIXI.Graphics()
      .roundRect(x - 14 * s, cell.y - 45 * s, 28 * s, 90 * s, 14 * s)
      .fill(alleleColor(allele));
    scene.addChild(bar);
    const t = label(allele, 20 * s, { fill: 0xffffff, fontWeight: '600' });
    t.position.set(x, cell.y);
    scene.addChild(t);
  });
}

function drawCreature(L) {
  const { s, cell } = L;
  const r = 46 * s;
  const x = cell.x;
  const y = cell.y - 190 * s;
  const spotted = phenotype(state.genotype) === 'spotted';

  const g = new PIXI.Graphics();
  g.ellipse(x, y, r, r * 0.85).fill(spotted ? COLORS.spotted : COLORS.plain);
  g.ellipse(x, y, r, r * 0.85).stroke({ width: 2 * s, color: COLORS.ink, alpha: 0.4 });
  if (spotted) {
    [[-0.4, -0.3], [0.3, -0.35], [0.1, 0.25], [-0.25, 0.3]].forEach(([dx, dy]) => {
      g.circle(x + dx * r, y + dy * r, r * 0.14).fill(COLORS.spot);
    });
  }
  g.circle(x - r * 0.35, y - r * 0.2, r * 0.12).fill(COLORS.ink);
  g.circle(x + r * 0.35, y - r * 0.2, r * 0.12).fill(COLORS.ink);
  g.moveTo(x - r * 0.25, y + r * 0.25)
    .quadraticCurveTo(x, y + r * 0.45, x + r * 0.25, y + r * 0.25)
    .stroke({ width: 2 * s, color: COLORS.ink });
  scene.addChild(g);

  const name = label(`Genotype ${state.genotype}: ${spotted ? 'spotted' : 'plain'}`, 16 * s);
  name.position.set(x, y + r + 18 * s);
  scene.addChild(name);
}

function drawSpores(L) {
  spores = [];
  if (!state.result) return;
  state.result.spores.forEach((allele) => {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics().circle(0, 0, 24 * L.s).fill(alleleColor(allele));
    const t = label(allele, 20 * L.s, { fill: 0xffffff, fontWeight: '600' });
    c.addChild(g, t);
    scene.addChild(c);
    spores.push(c);
  });
  placeSpores();
}

function easeOut(t) {
  return 1 - (1 - t) ** 3;
}

// Spores start at the cell center and move to their slots as animT goes 0 -> 1.
function placeSpores() {
  if (!layoutNow) return;
  const e = easeOut(state.animT);
  const from = layoutNow.cell;
  spores.forEach((c, i) => {
    const [x, y] = layoutNow.slots[i];
    c.position.set(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
  });
}

function drawButtons(L) {
  const { w, h, s } = L;
  const bw = 170 * s;
  const bh = 44 * s;
  const make = (text, x, y, onTap) => {
    const c = new PIXI.Container();
    c.position.set(x, y);
    const bg = new PIXI.Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2).fill(COLORS.button);
    c.addChild(bg, label(text, 18 * s));
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointertap', onTap);
    scene.addChild(c);
  };
  const y = h - 50 * s;
  make('New creature', w / 2 - bw * 0.6, y, () => {
    state.genotype = randomGenotype();
    state.result = null;
    state.animT = 1;
    build();
  });
  make('Run meiosis', w / 2 + bw * 0.6, y, () => {
    state.result = segregateSingleLocus(state.genotype, rng);
    state.animT = 0;
    build();
  });
}

function drawText(L) {
  const { w, h, s } = L;
  const title = label('Meiosis: one locus, random segregation', 26 * s, { fontWeight: '600' });
  title.position.set(w / 2, 24 * s);
  scene.addChild(title);

  let msg;
  if (!state.result) {
    msg = 'The creature carries two copies of this gene, one on each homolog. Run meiosis to split them.';
  } else {
    const nS = state.result.spores.filter((a) => a === 'S').length;
    msg = `Four spores: ${nS} carry S, ${4 - nS} carry s. Homologs split at Meiosis I; sister copies split at Meiosis II.`;
  }
  const note = label(msg, 16 * s, { wordWrap: true, wordWrapWidth: Math.min(w - 40, 760) * s });
  note.position.set(w / 2, h - 110 * s);
  scene.addChild(note);
}

function build() {
  const { width: w, height: h } = app.screen;
  builtW = w;
  builtH = h;
  layoutNow = layout(w, h);

  scene.removeChildren().forEach((c) => c.destroy({ children: true }));
  drawCreature(layoutNow);
  drawCell(layoutNow);
  drawSpores(layoutNow);
  drawText(layoutNow);
  drawButtons(layoutNow);
}

// The ticker drives the spore animation and rebuilds the scene if the window was resized.
app.ticker.add((t) => {
  if (app.screen.width !== builtW || app.screen.height !== builtH) {
    build();
    return;
  }
  if (state.animT < 1) {
    state.animT = Math.min(1, state.animT + t.deltaMS / 700);
    placeSpores();
  }
});

build();
