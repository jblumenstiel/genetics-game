// The learning slides of steps B and C: one page per term, each with a definition and a picture drawn below it.
// A page is { id, term, body(inst), draw(ctx) }. draw lays out the example in the area under the definition card:
// ctx = { layer, inst, w, top, height, app, page (state kept for this page), redraw() }.

import { h } from '../../core/dom.js';
import { PALETTE } from '../../core/palette.js';
import { TRAITS } from '../../species/catalog.js';
import { phenotypeOf, normalComplexFraction, dose } from '../../engine/dominance.js';
import { fraction } from '../../engine/cross.js';
import { genotypeCard, cardRow, dosageBars, dimerGrid, dimerKey, switchIcon, text } from './views.js';
import { WHITE, GOLDEN, DEL } from './instance.js';

const lower = (L) => L.toLowerCase();

// Creature size for the area left under the definition, leaving room for one more picture if there is one.
function sizeFor(ctx, { extra = 0, max = 110 } = {}) {
  return Math.max(46, Math.min(max, (ctx.height - extra - 40) / 1.9));
}

// Cards in a row at the given top; returns the bottom.
function placeRow(ctx, items, top, size) {
  const row = cardRow(
    items.map((it) => genotypeCard({ ...it, size })),
    ctx.w - 24,
    Math.max(10, size * 0.22),
  );
  row.position.set(ctx.w / 2, top);
  ctx.layer.addChild(row);
  return top + row.h;
}

// A one-line reading of the example, under it.
function placeNote(ctx, str, top) {
  const t = text(str, ctx.w < 480 ? 13 : 15, { width: Math.min(ctx.w - 32, 680), weight: '700', fill: PALETTE.sage, align: 'center' });
  t.anchor.set(0.5, 0);
  t.position.set(ctx.w / 2, top + 8);
  ctx.layer.addChild(t);
  return t.y + t.height;
}

function place(ctx, view, top) {
  view.position.set(view.centered === false ? 0 : ctx.w / 2, top);
  ctx.layer.addChild(view);
  return top + view.h;
}

// The pigment gene shared by the dominant and recessive pages: pigmented with one working copy.
function pigmentRow(ctx, highlight) {
  const P = ctx.inst.pigment;
  const p = lower(P);
  const f = ctx.inst.features;
  return [
    { genotype: `${P}/${P}`, features: f(), caption: 'pigmented', highlight: highlight === 'PP' },
    { genotype: `${P}/${p}`, features: f(), caption: 'pigmented', highlight: highlight === 'Pp' },
    { genotype: `${p}/${p}`, features: f({ bodyColor: WHITE }), caption: 'white', highlight: highlight === 'pp' },
  ];
}

export const TERMS_1 = [
  {
    id: 'dominant',
    term: 'Dominant allele',
    body: () => 'A dominant allele shows its phenotype in a heterozygote: one copy is enough to produce it.',
    draw(ctx) {
      const P = ctx.inst.pigment;
      const s = sizeFor(ctx);
      const bottom = placeRow(ctx, pigmentRow(ctx, 'Pp'), ctx.top, s);
      placeNote(ctx, `${P}/${lower(P)} looks like ${P}/${P}: one ${P} is enough for pigment, so ${P} is dominant.`, bottom);
    },
  },
  {
    id: 'recessive',
    term: 'Recessive allele',
    body: () =>
      'A recessive allele shows its phenotype only when no dominant allele is with it: in a diploid, only in the homozygote. In a heterozygote, its phenotype is hidden.',
    draw(ctx) {
      const P = ctx.inst.pigment;
      const p = lower(P);
      const s = sizeFor(ctx);
      const bottom = placeRow(ctx, pigmentRow(ctx, 'pp'), ctx.top, s);
      placeNote(ctx, `Only ${p}/${p} is white. In ${P}/${p} the white phenotype is hidden, so ${p} is recessive.`, bottom);
    },
  },
  {
    id: 'incomplete',
    term: 'Incomplete dominance',
    body: () => 'With incomplete dominance, the heterozygote’s phenotype is in between the phenotypes of the two homozygotes.',
    draw(ctx) {
      const t = TRAITS.color;
      const s = sizeFor(ctx);
      const items = [['CB', 'CB'], ['CB', 'CR'], ['CR', 'CR']].map((g, i) => {
        const p = t.express(g);
        return { genotype: g.map((a) => t.alleles.find((x) => x.id === a).label).join('/'), features: ctx.inst.features(p.features), caption: p.label, highlight: i === 1 };
      });
      const bottom = placeRow(ctx, items, ctx.top, s);
      placeNote(ctx, 'Cᴮ/Cᴿ is mauve, a blend between the blue and rust homozygotes.', bottom);
    },
  },
  {
    id: 'codominance',
    term: 'Codominance',
    body: () => 'With codominance, the heterozygote shows the phenotypes of both alleles fully, side by side, not as a blend.',
    draw(ctx) {
      const t = TRAITS.pattern;
      const s = sizeFor(ctx);
      const items = [['PD', 'PD'], ['PD', 'PT'], ['PT', 'PT']].map((g, i) => {
        const p = t.express(g);
        return { genotype: g.map((a) => t.alleles.find((x) => x.id === a).label).join('/'), features: ctx.inst.features(p.features), caption: p.label, highlight: i === 1 };
      });
      const bottom = placeRow(ctx, items, ctx.top, s);
      placeNote(ctx, 'Pᴰ/Pᵀ has both dots and stripes, each as clear as in its homozygote.', bottom);
    },
  },
  {
    id: 'recessive-lethal',
    term: 'Recessive lethal',
    body: () =>
      'A recessive lethal allele kills only when an individual has two copies; heterozygotes survive. The same allele can be dominant for another trait.',
    draw(ctx) {
      const Y = ctx.inst.golden;
      const y = lower(Y);
      const f = ctx.inst.features;
      const s = sizeFor(ctx);
      const bottom = placeRow(
        ctx,
        [
          { genotype: `${Y}/${Y}`, features: null, caption: 'does not develop', highlight: true },
          { genotype: `${Y}/${y}`, features: f({ bodyColor: GOLDEN }), caption: 'golden' },
          { genotype: `${y}/${y}`, features: f(), caption: 'normal color' },
        ],
        ctx.top,
        s,
      );
      placeNote(ctx, `One ${Y} makes a golden body (dominant for color), but only ${Y}/${Y} is lethal (recessive for survival).`, bottom);
    },
  },
  {
    id: 'dominant-lethal',
    term: 'Dominant lethal',
    body: () =>
      'A dominant lethal allele kills with a single copy. Carriers usually die before they can reproduce, so the allele is not passed on: each case comes from a new mutation. The exception is an allele that acts late, after reproduction, as in Huntington’s disease.',
    draw(ctx) {
      const K = ctx.inst.lethal;
      const k = lower(K);
      const s = sizeFor(ctx);
      const bottom = placeRow(
        ctx,
        [
          { genotype: `${K}/${k}`, features: null, lethalText: 'No bdellbee survives', caption: 'dies young', highlight: true },
          { genotype: `${k}/${k}`, features: ctx.inst.features(), caption: 'normal' },
        ],
        ctx.top,
        s,
      );
      placeNote(ctx, `Any bdellbee with one ${K} dies before it can reproduce, so ${K} is not inherited.`, bottom);
    },
  },
];

// The dosage picture for the two haplo pages: bars for 100%, 50% and 0% with a threshold to drag, and the
// bdellbees for each genotype, which change as the threshold moves.
function thresholdPage(ctx, { letter, look, start }) {
  const L = letter;
  const l = lower(L);
  const genotypes = [
    { name: `${L}/${L}`, g: ['+', '+'] },
    { name: `${L}/${l}`, g: ['+', 'm'] },
    { name: `${l}/${l}`, g: ['m', 'm'] },
  ];
  ctx.page.threshold ??= start;
  const barsH = Math.max(110, Math.min(170, ctx.height * 0.36));
  const bw = Math.min(ctx.w - 32, 420);
  // The bdellbees and the note change while the line is dragged, so they are redrawn on their own; redrawing the
  // bars would drop the line being dragged.
  const dyn = new PIXI.Container();
  const sub = { ...ctx, layer: dyn };
  const s = sizeFor(ctx, { extra: barsH + 40, max: 80 });
  const drawRow = () => {
    dyn.removeChildren().forEach((c) => c.destroy({ children: true }));
    const t = ctx.page.threshold;
    const bottom = placeRow(
      sub,
      genotypes.map((x) => {
        const normal = dose(x.g) >= t;
        return { genotype: x.name, features: ctx.inst.features(normal ? look.normal : look.mutant), caption: normal ? look.normalText : look.mutantText, highlight: x.g[0] === '+' && x.g[1] === 'm' };
      }),
      ctx.top + barsH + 8,
      s,
    );
    const pct = Math.round(t * 100);
    const note =
      t <= 0.5
        ? `${look.goal}, a bdellbee needs ${pct}% of the normal product. ${L}/${l} has 50%, so it ${look.isNormal}: ${L} is haplosufficient, and ${l} is recessive.`
        : `${look.goal}, a bdellbee needs ${pct}% of the normal product. ${L}/${l} has only 50%, so it ${look.isMutant}: ${L} is haploinsufficient, and ${l} is dominant.`;
    const end = placeNote(sub, note, bottom);
    if (!ctx.page.dragged) {
      const hint = text('Drag the dashed line up or down.', 12, { weight: '700', fill: PALETTE.inkSoft });
      hint.anchor.set(0.5, 0);
      hint.position.set(ctx.w / 2, end + 4);
      dyn.addChild(hint);
    }
  };
  const bars = dosageBars({
    bars: genotypes.map((x) => ({ label: x.name, value: dose(x.g) })),
    width: bw,
    height: barsH,
    threshold: ctx.page.threshold,
    app: ctx.app,
    onDrag: (v) => {
      ctx.page.threshold = v;
      ctx.page.dragged = true;
      drawRow();
    },
  });
  bars.position.set(ctx.w / 2 - bw / 2, ctx.top);
  ctx.layer.addChild(bars, dyn);
  drawRow();
  ctx.cleanup = () => bars.stopDrag?.();
}

export const TERMS_2 = [
  {
    id: 'haplosufficiency',
    term: 'Haplosufficiency: why loss of function is usually recessive',
    body: () =>
      'Most genes make a product, such as an enzyme. If one working copy makes enough product for the normal phenotype, the gene is haplosufficient. A heterozygote for a broken (loss-of-function) allele then looks normal, so the broken allele is recessive.',
    draw(ctx) {
      thresholdPage(ctx, {
        letter: ctx.inst.pigment,
        start: 0.3,
        look: { normal: {}, mutant: { bodyColor: WHITE }, normalText: 'pigmented', mutantText: 'white', goal: 'To be pigmented', isNormal: 'is pigmented', isMutant: 'is white' },
      });
    },
  },
  {
    id: 'haploinsufficiency',
    term: 'Haploinsufficiency: when loss of function is dominant',
    body: () =>
      'If one working copy is not enough, because the phenotype needs more than half the normal amount of product, the gene is haploinsufficient. A heterozygote for a loss-of-function allele then shows the mutant phenotype, so the loss-of-function allele is dominant.',
    draw(ctx) {
      thresholdPage(ctx, {
        letter: ctx.inst.antennaGene,
        start: 0.7,
        look: { normal: { antennae: 1 }, mutant: { antennae: 0 }, normalText: 'antennae', mutantText: 'no antennae', goal: 'To grow antennae', isNormal: 'has antennae', isMutant: 'has no antennae' },
      });
    },
  },
  {
    id: 'dosage',
    term: 'Dosage and incomplete dominance',
    body: () =>
      'Sometimes there is no cutoff: the phenotype follows the amount of product. Then a heterozygote, with half the product, is in between the two homozygotes. That is incomplete dominance.',
    draw(ctx) {
      const P = ctx.inst.pigment;
      const p = lower(P);
      const gs = [
        { name: `${P}/${P}`, g: ['+', '+'] },
        { name: `${P}/${p}`, g: ['+', 'm'] },
        { name: `${p}/${p}`, g: ['m', 'm'] },
      ];
      const barsH = Math.max(100, Math.min(150, ctx.height * 0.32));
      const bw = Math.min(ctx.w - 32, 420);
      const bars = dosageBars({ bars: gs.map((x) => ({ label: x.name, value: dose(x.g), color: ctx.inst.shadeFor(Math.max(0.25, dose(x.g))) })), width: bw, height: barsH });
      bars.position.set(ctx.w / 2 - bw / 2, ctx.top);
      ctx.layer.addChild(bars);
      const s = sizeFor(ctx, { extra: barsH + 40, max: 80 });
      const labels = ['full color', 'half color', 'white'];
      const bottom = placeRow(
        ctx,
        gs.map((x, i) => ({ genotype: x.name, features: ctx.inst.features({ bodyColor: ctx.inst.shadeFor(dose(x.g)) }), caption: labels[i], highlight: i === 1 })),
        ctx.top + barsH + 8,
        s,
      );
      placeNote(ctx, `${P}/${p} makes half the pigment and is half as colored: incomplete dominance.`, bottom);
    },
  },
  {
    id: 'dominant-negative',
    term: 'Dominant negative',
    body: () =>
      'A dominant negative allele makes a mutant product that spoils the normal one, often by joining it in a complex. A heterozygote then has much less than half the working complex.',
    draw(ctx) {
      const E = ctx.inst.earGene;
      const DN = `${E}ᴰᴺ`;
      const names = { '+': E, m: DN, Δ: DEL };
      const gs = [['+', '+'], ['+', 'm'], ['m', 'm'], ['+', 'Δ']];
      const grid = dimerGrid(Math.min(ctx.w - 120, 380));
      const key = dimerKey();
      const gridTop = ctx.top;
      grid.position.set(ctx.w / 2 - 40, gridTop);
      key.position.set(Math.min(ctx.w - 120, ctx.w / 2 + Math.min(ctx.w - 120, 380) / 2 - 20), gridTop + 4);
      ctx.layer.addChild(grid, key);
      const frac = fraction(normalComplexFraction(2));
      const gridCap = text(`In ${E}/${DN}, subunits pair at random: only ½ × ½ = ${frac} of the pairs are all normal and work.`, 13, { width: Math.min(ctx.w - 32, 560), weight: '700', fill: PALETTE.inkSoft, align: 'center' });
      gridCap.anchor.set(0.5, 0);
      gridCap.position.set(ctx.w / 2, gridTop + grid.h + 4);
      ctx.layer.addChild(gridCap);
      const rowTop = gridCap.y + gridCap.height + 10;
      const s = sizeFor(ctx, { extra: rowTop - ctx.top, max: 72 });
      const bottom = placeRow(
        ctx,
        gs.map((g) => {
          const mutant = phenotypeOf('dominantNegative', g).mutant;
          return { genotype: g.map((k) => names[k]).join('/'), features: ctx.inst.features({ ears: mutant ? 'floppy' : 'perky' }), caption: mutant ? 'floppy ears' : 'perky ears', highlight: g[1] === 'Δ' };
        }),
        rowTop,
        s,
      );
      placeNote(ctx, `${E}/${DEL} (one working copy, no mutant product) has perky ears, so one copy is enough. ${E}/${DN} has floppy ears because the mutant product interferes.`, bottom);
    },
  },
  {
    id: 'gain-of-function',
    term: 'Gain of function',
    body: () =>
      'A gain-of-function allele does something new or too much, such as a product that is stuck “on”. It is dominant because the normal copy cannot cancel what the mutant copy does. Human examples include Huntington’s disease and oncogenes such as RAS.',
    draw(ctx) {
      const B = ctx.inst.bandGene;
      const b = lower(B);
      const names = { '+': b, m: B, Δ: DEL };
      const sw = new PIXI.Container();
      const off = switchIcon(false, `${b} product: off unless signaled`);
      const on = switchIcon(true, `${B} product: stuck on`);
      off.x = -90;
      on.x = 90;
      sw.addChild(off, on);
      sw.h = Math.max(off.h, on.h) + 16;
      const after = place(ctx, sw, ctx.top + 16);
      const s = sizeFor(ctx, { extra: after - ctx.top, max: 76 });
      const gs = [['+', '+'], ['+', 'm'], ['m', 'm'], ['+', 'Δ']];
      const bottom = placeRow(
        ctx,
        gs.map((g) => {
          const mutant = phenotypeOf('gainOfFunction', g).mutant;
          const name = g[0] === '+' && g[1] === 'm' ? `${B}/${b}` : g.map((k) => names[k]).join('/');
          return { genotype: name, features: ctx.inst.features({ stripes: mutant }), caption: mutant ? 'striped' : 'plain', highlight: g[1] === 'Δ' };
        }),
        after + 6,
        s,
      );
      placeNote(ctx, `${b}/${DEL}, which loses a copy, stays plain: the stripes come from what the ${B} product does, not from losing ${b}.`, bottom);
    },
  },
  {
    id: 'codominance-mechanism',
    term: 'Codominance: both alleles make a working product',
    body: () =>
      'With codominance, each allele makes a working product with a different activity, so a heterozygote has both. In the human ABO blood groups, the Iᴬ and Iᴮ alleles each make an enzyme that adds its own sugar to red blood cells, so Iᴬ/Iᴮ people have both sugars: type AB.',
    draw(ctx) {
      const t = TRAITS.pattern;
      const tags = new PIXI.Container();
      const a = text('Pᴰ enzyme → dots', 14, { weight: '800', fill: PALETTE.sage });
      const b2 = text('Pᵀ enzyme → stripes', 14, { weight: '800', fill: PALETTE.sage });
      a.anchor.set(1, 0);
      a.x = -16;
      b2.x = 16;
      tags.addChild(a, b2);
      tags.h = a.height + 10;
      const after = place(ctx, tags, ctx.top + 6);
      const s = sizeFor(ctx, { extra: after - ctx.top, max: 90 });
      const items = [['PD', 'PD'], ['PD', 'PT'], ['PT', 'PT']].map((g, i) => {
        const p = t.express(g);
        return { genotype: g.map((x) => t.alleles.find((y) => y.id === x).label).join('/'), features: ctx.inst.features(p.features), caption: p.label, highlight: i === 1 };
      });
      const bottom = placeRow(ctx, items, after + 4, s);
      placeNote(ctx, 'Both enzymes work in Pᴰ/Pᵀ, so it has both patterns.', bottom);
    },
  },
  {
    id: 'summary',
    term: 'Telling the mechanisms apart',
    body: () =>
      'Compare a heterozygote for the allele with a heterozygote for a deletion of the gene (Δ, no copy at all). The deletion shows what losing one copy does by itself.',
    draw(ctx) {
      const { inst } = ctx;
      const rows = [
        { mech: 'haploinsufficient', letter: inst.antennaGene, names: (L) => ({ del: `${L}/${DEL}`, het: `${L}/${lower(L)}` }), look: (m) => ({ antennae: m ? 0 : 1 }), verdict: 'Losing a copy is enough: haploinsufficient (dominant).' },
        { mech: 'dominantNegative', letter: inst.earGene, names: (L) => ({ del: `${L}/${DEL}`, het: `${L}/${L}ᴰᴺ` }), look: (m) => ({ ears: m ? 'floppy' : 'perky' }), verdict: 'Losing a copy is fine; the mutant product interferes: dominant negative.' },
        { mech: 'gainOfFunction', letter: inst.bandGene, names: (L) => ({ del: `${lower(L)}/${DEL}`, het: `${L}/${lower(L)}` }), look: (m) => ({ stripes: m }), verdict: 'Losing a copy does nothing; the mutant product adds a trait: gain of function.' },
      ];
      const rowH = (ctx.height - 10) / rows.length;
      const s = Math.max(34, Math.min(56, rowH * 0.42));
      const narrow = ctx.w < 560;
      rows.forEach((r, i) => {
        const top = ctx.top + i * rowH;
        const n = r.names(r.letter);
        const del = phenotypeOf(r.mech, ['+', 'Δ']).mutant;
        const het = phenotypeOf(r.mech, ['+', 'm']).mutant;
        const pair = cardRow(
          [genotypeCard({ genotype: n.del, features: inst.features(r.look(del)), size: s }), genotypeCard({ genotype: n.het, features: inst.features(r.look(het)), size: s })],
          narrow ? ctx.w * 0.5 : 260,
          10,
        );
        pair.position.set(narrow ? ctx.w * 0.27 : ctx.w / 2 - 150, top);
        const v = text(r.verdict, narrow ? 12 : 14, { width: narrow ? ctx.w * 0.44 : Math.min(300, ctx.w / 2 - 40), weight: '700', fill: PALETTE.sage });
        v.anchor.set(0, 0.5);
        v.position.set(narrow ? ctx.w * 0.53 : ctx.w / 2 + 10, top + pair.h / 2);
        ctx.layer.addChild(pair, v);
      });
    },
    // The full comparison, as a table in the panel.
    panel: () =>
      h(
        'table',
        { class: 'mech-table' },
        h('thead', {}, h('tr', {}, ['Mechanism', 'The mutant allele', 'Heterozygote', 'Usually'].map((x) => h('th', {}, x)))),
        h(
          'tbody',
          {},
          [
            ['Haplosufficient gene', 'makes no working product', 'normal', 'recessive'],
            ['Haploinsufficient gene', 'makes no working product', 'mutant', 'dominant'],
            ['Dosage', 'makes no working product', 'in between', 'incomplete dominance'],
            ['Dominant negative', 'spoils the normal product', 'mutant', 'dominant'],
            ['Gain of function', 'adds new or excess activity', 'mutant', 'dominant'],
            ['Codominance', 'makes a different working product', 'both', 'codominance'],
          ].map((r) => h('tr', {}, r.map((x) => h('td', {}, x)))),
        ),
      ),
  },
];
