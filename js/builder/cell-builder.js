// The cell builder: students assemble nuclei from chromosomes and label every chromatid.
//
//   tap a nucleus            select it (new chromosomes go there)
//   tap a chromosome         select it; tap its chromatids again to cycle their alleles
//   drag a chromosome        move it to another nucleus, or drop it on a homolog to pair them
//
// The builder holds drawing models (see engine/drawing.js) and redraws from them, so grading never depends on
// where things sit on screen. It works for any karyotype and any number of loci.

import { PALETTE, shade } from '../core/palette.js';
import { label as textLabel } from '../render/chromosome.js';

let nextId = 1;
const uid = () => nextId++;

function cloneChromosome(c) {
  return { id: uid(), kind: 'chromosome', chrom: c.chrom, chromatids: c.chromatids.map((ct) => ({ alleles: { ...ct.alleles } })) };
}

function cloneItem(it) {
  if (it.kind === 'bivalent') return { id: uid(), kind: 'bivalent', chrom: it.chrom, homologs: it.homologs.map(cloneChromosome), crossovers: it.crossovers.map((x) => ({ ...x })) };
  return cloneChromosome(it);
}

function strip(it) {
  if (it.kind === 'bivalent') return { kind: 'bivalent', chrom: it.chrom, homologs: it.homologs.map(strip), crossovers: it.crossovers.map((x) => ({ ...x })) };
  return { kind: 'chromosome', chrom: it.chrom, chromatids: it.chromatids.map((ct) => ({ alleles: { ...ct.alleles } })) };
}

export class CellBuilder {
  // alleles: { [locusId]: [allele, allele, ...] } choices for each locus, in display order.
  constructor({ app, container, karyotype, alleles, onChange, maxNuclei = 4, fixedNuclei = false, readOnly = false }) {
    this.app = app;
    this.karyotype = karyotype;
    this.alleles = alleles;
    this.onChange = onChange ?? (() => {});
    this.maxNuclei = maxNuclei;
    this.fixedNuclei = fixedNuclei;
    this.readOnly = readOnly;
    this.root = new PIXI.Container();
    this.root.eventMode = 'static';
    container.addChild(this.root);
    this.nuclei = [];
    this.selected = null;
    this.rect = { x: 0, y: 0, w: 400, h: 300 };
    this.root.on('globalpointermove', (e) => this.dragMove(e));
  }

  destroy() {
    this.root.destroy({ children: true });
  }

  // ---- model ----

  setNuclei(nuclei) {
    this.nuclei = nuclei.map((n) => ({ id: uid(), label: n.label ?? '', items: (n.items ?? []).map(cloneItem) }));
    this.selected = this.nuclei.length && !this.readOnly ? { nucleus: this.nuclei[0].id } : null;
    this.render();
  }

  getNuclei() {
    return this.nuclei.map((n) => ({ label: n.label, items: n.items.map(strip) }));
  }

  changed() {
    this.render();
    this.onChange(this.getNuclei());
  }

  nucleusById(id) {
    return this.nuclei.find((n) => n.id === id);
  }

  findItem(id) {
    for (const n of this.nuclei) {
      const i = n.items.findIndex((it) => it.id === id);
      if (i >= 0) return { nucleus: n, index: i, item: n.items[i] };
      for (const it of n.items) {
        if (it.kind === 'bivalent') {
          const k = it.homologs.findIndex((hm) => hm.id === id);
          if (k >= 0) return { nucleus: n, index: n.items.indexOf(it), item: it.homologs[k], bivalent: it };
        }
      }
    }
    return null;
  }

  targetNucleus() {
    if (this.selected?.nucleus) return this.nucleusById(this.selected.nucleus);
    if (this.selected?.item) return this.findItem(this.selected.item)?.nucleus;
    return this.nuclei[0];
  }

  selectedItem() {
    return this.selected?.item ? this.findItem(this.selected.item) : null;
  }

  // ---- actions (called from the panel) ----

  addChromosome(replicated, chrom = this.karyotype[0].id) {
    const n = this.targetNucleus();
    if (!n) return;
    const def = this.karyotype.find((k) => k.id === chrom);
    const blank = () => ({ alleles: Object.fromEntries(def.loci.map((l) => [l.id, null])) });
    const item = { id: uid(), kind: 'chromosome', chrom, chromatids: replicated ? [blank(), blank()] : [blank()] };
    n.items.push(item);
    this.selected = { item: item.id };
    this.changed();
  }

  addNucleus() {
    if (this.fixedNuclei || this.nuclei.length >= this.maxNuclei) return;
    const n = { id: uid(), label: '', items: [] };
    this.nuclei.push(n);
    this.selected = { nucleus: n.id };
    this.changed();
  }

  canRemoveNucleus() {
    return !this.fixedNuclei && this.nuclei.length > 1 && !!this.selected?.nucleus;
  }

  deleteSelected() {
    const sel = this.selectedItem();
    if (sel) {
      if (sel.bivalent) {
        // Deleting one homolog of a pair leaves the other as a plain chromosome.
        const other = sel.bivalent.homologs.find((hm) => hm !== sel.item);
        sel.nucleus.items.splice(sel.index, 1, other);
      } else sel.nucleus.items.splice(sel.index, 1);
      this.selected = { nucleus: sel.nucleus.id };
      return this.changed();
    }
    if (this.canRemoveNucleus()) {
      this.nuclei = this.nuclei.filter((n) => n.id !== this.selected.nucleus);
      this.selected = { nucleus: this.nuclei[0].id };
      this.changed();
    }
  }

  selectedBivalent() {
    const sel = this.selectedItem();
    if (!sel) return null;
    return sel.bivalent ?? (sel.item.kind === 'bivalent' ? sel.item : null);
  }

  unpair() {
    const sel = this.selectedItem();
    const b = this.selectedBivalent();
    if (!b) return;
    const n = sel.nucleus;
    n.items.splice(n.items.indexOf(b), 1, ...b.homologs);
    this.changed();
  }

  // Crossover intervals: stretches between consecutive landmarks (chromosome ends, centromere, loci).
  intervals(chrom = this.karyotype[0].id) {
    const def = this.karyotype.find((k) => k.id === chrom);
    const marks = [
      { pos: 0, name: 'end' },
      { pos: def.centromere, name: 'centromere' },
      ...def.loci.map((l) => ({ pos: l.pos, name: l.id })),
      { pos: def.length, name: 'end' },
    ].sort((a, b) => a.pos - b.pos);
    return marks.slice(1).map((m, i) => ({ index: i, from: marks[i], to: m, mid: (marks[i].pos + m.pos) / 2, label: `between ${marks[i].name} and ${m.name}` }));
  }

  addCrossover(interval) {
    const b = this.selectedBivalent();
    if (!b) return;
    b.crossovers.push({ interval });
    this.changed();
  }

  clearCrossovers() {
    const b = this.selectedBivalent();
    if (!b) return;
    b.crossovers = [];
    this.changed();
  }

  // ---- layout and drawing ----

  setRect(rect) {
    this.rect = rect;
    this.render();
  }

  nucleusRects() {
    const { x, y, w, h } = this.rect;
    const n = this.nuclei.length;
    const cols = n <= 2 ? n : 2;
    const rows = Math.ceil(n / Math.max(1, cols));
    const cw = w / Math.max(1, cols);
    const ch = h / Math.max(1, rows);
    return this.nuclei.map((nuc, i) => {
      const cx = x + cw * ((i % cols) + 0.5);
      const cy = y + ch * (Math.floor(i / cols) + 0.5) + 8;
      return { nucleus: nuc, cx, cy, rx: cw * 0.44, ry: ch * 0.38 };
    });
  }

  alleleColor(locusId, allele) {
    if (!allele) return 0xd9d2c5;
    const i = this.alleles[locusId].indexOf(allele);
    return [PALETTE.clay, PALETTE.dusk, PALETTE.sage, PALETTE.ochre][i % 4];
  }

  cycleAllele(chromatid, locusId) {
    const opts = this.alleles[locusId];
    const cur = chromatid.alleles[locusId];
    chromatid.alleles[locusId] = cur ? opts[(opts.indexOf(cur) + 1) % opts.length] : opts[0];
  }

  render() {
    this.root.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.itemBounds = [];
    const rects = this.nucleusRects();
    const minDim = Math.min(...rects.map((r) => Math.min(r.rx * 2, r.ry * 2)), 400);
    this.chromLen = Math.max(70, Math.min(200, minDim * 0.62));
    this.w = Math.max(12, Math.min(22, this.chromLen * 0.12));

    const bg = new PIXI.Graphics().rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h).fill({ color: 0xffffff, alpha: 0.001 });
    bg.eventMode = this.readOnly ? 'none' : 'static';
    bg.on('pointertap', () => {
      this.selected = null;
      this.changed();
    });
    this.root.addChild(bg);

    for (const r of rects) this.drawNucleus(r);
  }

  drawNucleus(r) {
    const { nucleus: n, cx, cy, rx, ry } = r;
    const sel = this.selected?.nucleus === n.id;
    const g = new PIXI.Graphics();
    g.ellipse(cx, cy, rx, ry).fill({ color: PALETTE.nucleus, alpha: 0.55 }).stroke({ width: sel ? 4 : 2.5, color: sel ? PALETTE.ochre : PALETTE.cellEdge });
    g.eventMode = this.readOnly ? 'none' : 'static';
    g.cursor = 'pointer';
    g.on('pointertap', (e) => {
      e.stopPropagation();
      this.selected = { nucleus: n.id };
      this.changed();
    });
    this.root.addChild(g);
    r.graphic = g;

    const name = n.label || `Nucleus ${this.nuclei.indexOf(n) + 1}`;
    const t = textLabel(name, 14, { fill: PALETTE.inkSoft, fontWeight: '800' });
    t.anchor.set(0.5, 1);
    t.position.set(cx, cy - ry - 4);
    this.root.addChild(t);

    if (!n.items.length && !this.readOnly) {
      const hint = textLabel('empty', 13, { fill: PALETTE.inkSoft, fontWeight: '600' });
      hint.anchor.set(0.5);
      hint.position.set(cx, cy);
      hint.alpha = 0.6;
      this.root.addChild(hint);
    }

    // Items in a centered row, scaled down if they would overflow the nucleus.
    const W = this.w;
    const widths = n.items.map((it) => this.itemWidth(it));
    const gap = W * 1.8;
    const total = widths.reduce((s, x) => s + x, 0) + gap * Math.max(0, n.items.length - 1);
    const scale = Math.min(1, (rx * 1.7) / Math.max(1, total), (ry * 1.7) / (this.chromLen + 30));
    const row = new PIXI.Container();
    row.position.set(cx, cy);
    row.scale.set(scale);
    this.root.addChild(row);
    let x = -total / 2;
    n.items.forEach((it, i) => {
      const view = this.drawItem(it, n);
      view.position.set(x + widths[i] / 2, 0);
      row.addChild(view);
      x += widths[i] + gap;
    });
  }

  chromosomeWidth(c) {
    return c.chromatids.length * this.w + (c.chromatids.length - 1) * this.w * 0.2;
  }

  itemWidth(it) {
    if (it.kind === 'bivalent') return it.homologs.reduce((s, hm) => s + this.chromosomeWidth(hm), 0) + this.w * 0.5 + this.w * 0.8;
    return this.chromosomeWidth(it);
  }

  drawItem(it, nucleus) {
    if (it.kind !== 'bivalent') return this.drawChromosome(it, nucleus, null);
    const c = new PIXI.Container();
    const width = this.itemWidth(it);
    const L = this.chromLen;
    const selected = this.selected?.item && (this.selected.item === it.id || it.homologs.some((hm) => hm.id === this.selected.item));
    const pill = new PIXI.Graphics()
      .roundRect(-width / 2, -L / 2 - 10, width, L + 20, this.w)
      .fill({ color: PALETTE.ochre, alpha: 0.12 })
      .stroke({ width: selected ? 2.5 : 1.5, color: selected ? PALETTE.ochre : PALETTE.cellEdge, alpha: 0.9 });
    c.addChild(pill);
    const w0 = this.chromosomeWidth(it.homologs[0]);
    const w1 = this.chromosomeWidth(it.homologs[1]);
    const inner = this.w * 0.5;
    const h0 = this.drawChromosome(it.homologs[0], nucleus, it);
    const h1 = this.drawChromosome(it.homologs[1], nucleus, it);
    h0.x = -inner / 2 - w0 / 2;
    h1.x = inner / 2 + w1 / 2;
    c.addChild(h0, h1);

    // Crossover marks between the two inner (non-sister) chromatids.
    const def = this.karyotype.find((k) => k.id === it.chrom);
    const ivs = this.intervals(it.chrom);
    const seen = {};
    for (const xo of it.crossovers) {
      const iv = ivs[xo.interval];
      if (!iv) continue;
      const k = (seen[xo.interval] = (seen[xo.interval] ?? 0) + 1) - 1;
      const y = this.yOf(def, iv.mid) + k * 12;
      const s = this.w * 0.55;
      const xg = new PIXI.Graphics()
        .moveTo(-s, y - s)
        .lineTo(s, y + s)
        .moveTo(s, y - s)
        .lineTo(-s, y + s)
        .stroke({ width: 3.5, color: PALETTE.ink, cap: 'round' });
      c.addChild(xg);
    }
    return c;
  }

  yOf(def, pos) {
    return (pos / def.length - 0.5) * this.chromLen;
  }

  drawChromosome(chrom, nucleus, bivalent) {
    const c = new PIXI.Container();
    const def = this.karyotype.find((k) => k.id === chrom.chrom);
    const W = this.w;
    const L = this.chromLen;
    const n = chrom.chromatids.length;
    const width = this.chromosomeWidth(chrom);
    const selected = this.selected?.item === chrom.id || (bivalent && this.selected?.item === bivalent.id);
    const cy = this.yOf(def, def.centromere);
    const gap = W * 0.2;

    if (selected) {
      c.addChild(new PIXI.Graphics().roundRect(-width / 2 - 5, -L / 2 - 5, width + 10, L + 10, W * 0.7).stroke({ width: 3, color: PALETTE.ochre }));
    }

    chrom.chromatids.forEach((ct, i) => {
      const x = -width / 2 + W / 2 + i * (W + gap);
      const view = new PIXI.Container();
      view.x = x;
      const body = new PIXI.Graphics();
      const neck = W * 0.22;
      body.roundRect(-W / 2, -L / 2, W, cy + L / 2 - neck, W / 2).fill(0xeee4d1).stroke({ width: 1.5, color: 0x9d8f78 });
      body.roundRect(-W / 2, cy + neck, W, L / 2 - cy - neck, W / 2).fill(0xeee4d1).stroke({ width: 1.5, color: 0x9d8f78 });
      view.addChild(body);
      for (const locus of def.loci) {
        const y = this.yOf(def, locus.pos);
        // The allele letter sits inside its band, so neighboring chromatids never collide.
        const allele = ct.alleles[locus.id];
        const bandH = W * 1.25;
        view.addChild(new PIXI.Graphics().roundRect(-W / 2 - 1, y - bandH / 2, W + 2, bandH, 3).fill(this.alleleColor(locus.id, allele)));
        const t = textLabel(allele ?? '?', Math.max(12, W * 0.95), { fill: allele ? 0xffffff : PALETTE.inkSoft, fontWeight: '800' });
        t.anchor.set(0.5);
        t.position.set(0, y);
        view.addChild(t);
      }
      view.eventMode = this.readOnly ? 'none' : 'static';
      view.cursor = 'pointer';
      view.hitArea = new PIXI.Rectangle(-W / 2 - 3, -L / 2, W + 6, L);
      view.on('pointerdown', (e) => this.pointerDown(e, chrom, bivalent, ct, def, view));
      c.addChild(view);
    });

    // Sister chromatids are held together at the centromere.
    if (n === 2) c.addChild(new PIXI.Graphics().roundRect(-W * 0.6, cy - W * 0.3, W * 1.2, W * 0.6, W * 0.3).fill(0x8a7d68));
    else c.addChild(new PIXI.Graphics().circle(0, cy, W * 0.22).fill(0x8a7d68));

    c.chromId = chrom.id;
    this.itemBounds.push({ id: chrom.id, nucleus: nucleus.id, view: c, w: width, h: L });
    return c;
  }

  // ---- pointer handling ----

  pointerDown(e, chrom, bivalent, chromatid, def, chromatidView) {
    e.stopPropagation();
    const start = e.global.clone();
    const local = chromatidView.toLocal(e.global);
    this.drag = { chrom, bivalent, chromatid, def, start, localY: local.y, moved: false, ghost: null };
    const up = (ev) => this.pointerUp(ev);
    chromatidView.once('pointerup', up);
    chromatidView.once('pointerupoutside', up);
  }

  dragMove(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.global.x - d.start.x, e.global.y - d.start.y) < 6) return;
    if (!d.moved) {
      d.moved = true;
      const view = this.itemBounds.find((b) => b.id === d.chrom.id)?.view;
      if (view) {
        const pos = view.getGlobalPosition();
        d.ghost = view;
        d.offset = { x: pos.x - e.global.x, y: pos.y - e.global.y };
        const s = view.worldTransform.a;
        view.removeFromParent();
        view.scale.set(s);
        view.alpha = 0.85;
        this.root.addChild(view);
      }
    }
    if (d.ghost) d.ghost.position.set(e.global.x + d.offset.x, e.global.y + d.offset.y);
  }

  pointerUp(e) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (!d.moved) return this.tap(d);
    this.drop(d, e.global);
  }

  tap(d) {
    const isSelected = this.selected?.item === d.chrom.id || (d.bivalent && this.selected?.item === d.bivalent.id);
    if (!isSelected) {
      this.selected = { item: d.chrom.id };
      return this.changed();
    }
    // Cycle the allele at the locus band nearest the tap.
    const nearest = d.def.loci.reduce((best, l) => (Math.abs(this.yOf(d.def, l.pos) - d.localY) < Math.abs(this.yOf(d.def, best.pos) - d.localY) ? l : best), d.def.loci[0]);
    this.cycleAllele(d.chromatid, nearest.id);
    this.changed();
  }

  drop(d, point) {
    const from = this.findItem(d.chrom.id);
    // Dropped on another unpaired chromosome of the same type: pair them.
    const target = this.itemBounds.find((b) => {
      if (b.id === d.chrom.id || b.view === d.ghost) return false;
      const p = b.view.toLocal(point);
      return Math.abs(p.x) < b.w / 2 + 12 && Math.abs(p.y) < b.h / 2 + 10;
    });
    if (target) {
      const to = this.findItem(target.id);
      if (to && !to.bivalent && !from.bivalent && to.item.chrom === d.chrom.chrom) {
        from.nucleus.items.splice(from.index, 1);
        const idx = to.nucleus.items.indexOf(to.item);
        const biv = { id: uid(), kind: 'bivalent', chrom: d.chrom.chrom, homologs: [to.item, d.chrom], crossovers: [] };
        to.nucleus.items.splice(idx, 1, biv);
        this.selected = { item: biv.id };
        return this.changed();
      }
    }
    // Dropped inside a nucleus: move it there (pulling it out of a pair if needed).
    const rect = this.nucleusRects().find((r) => ((point.x - r.cx) / r.rx) ** 2 + ((point.y - r.cy) / r.ry) ** 2 <= 1);
    if (rect && (rect.nucleus !== from.nucleus || from.bivalent)) {
      if (from.bivalent) {
        const other = from.bivalent.homologs.find((hm) => hm !== d.chrom);
        from.nucleus.items.splice(from.index, 1, other);
      } else from.nucleus.items.splice(from.index, 1);
      rect.nucleus.items.push(d.chrom);
      this.selected = { item: d.chrom.id };
    }
    this.changed();
  }
}
