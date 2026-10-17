// The cell builder: students assemble nuclei by dragging pieces from a tray.
//
//   drag a chromosome piece into a nucleus      add it (1 chromatid, or 2 sister chromatids)
//   drag an allele chip onto a chromatid        label that chromatid
//   drag a chromosome onto its homolog          pair them as a bivalent
//   drag a chromosome to another nucleus        move it (pulling it out of a pair if needed)
//   drag the X chip onto a bivalent             mark a crossover where you drop it
//   drag the nucleus piece into the work area   add a nucleus
//   drag anything onto the bin                  remove it
//   tap a chromatid                             cycle its allele (shortcut)
//
// The builder holds drawing models (see engine/drawing.js) and redraws from them, so grading never depends on
// where things sit on screen. It works for any karyotype and any number of loci.

import { PALETTE } from '../core/palette.js';
import { label as textLabel } from '../render/chromosome.js';

let nextId = 1;
const uid = () => nextId++;

const CHROMATID_FILL = 0xeee4d1;
const CHROMATID_EDGE = 0x9d8f78;
const CENTROMERE = 0x8a7d68;
const UNSET = 0xd9d2c5;
const TRASH = 0xb4644a;

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

function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

export class CellBuilder {
  // alleles: { [locusId]: [allele, ...] } choices per locus, in display order.
  constructor({ app, container, karyotype, alleles, onChange, maxNuclei = 4, fixedNuclei = false, readOnly = false, crossovers = false }) {
    this.app = app;
    this.karyotype = karyotype;
    this.alleles = alleles;
    this.onChange = onChange ?? (() => {});
    this.maxNuclei = maxNuclei;
    this.fixedNuclei = fixedNuclei;
    this.readOnly = readOnly;
    this.crossovers = crossovers;
    this.root = new PIXI.Container();
    this.overlay = new PIXI.Container();
    this.overlay.eventMode = 'none';
    container.addChild(this.root, this.overlay);
    this.nuclei = [];
    this.demoToken = 0;
    this.rect = { x: 0, y: 0, w: 400, h: 300 };
    this.onMove = (e) => this.dragMove(e);
    this.onUp = (e) => this.dragEnd(e);
  }

  destroy() {
    this.cancelDrag();
    this.stopDemo();
    this.root.destroy({ children: true });
    this.overlay.destroy({ children: true });
  }

  // ---- model ----

  setNuclei(nuclei) {
    this.cancelDrag();
    this.stopDemo();
    this.nuclei = nuclei.map((n) => ({ id: uid(), label: n.label ?? '', items: (n.items ?? []).map(cloneItem) }));
    this.render();
  }

  getNuclei() {
    return this.nuclei.map((n) => ({ label: n.label, items: n.items.map(strip) }));
  }

  changed() {
    this.render();
    // While the demo runs, its moves are not the student's answer.
    if (!this.locked) this.onChange(this.getNuclei());
  }

  def(chrom) {
    return this.karyotype.find((k) => k.id === chrom);
  }

  // Where a chromosome model lives: its nucleus, its index there, and its bivalent if paired.
  locate(chrom) {
    for (const n of this.nuclei) {
      for (let i = 0; i < n.items.length; i++) {
        const it = n.items[i];
        if (it === chrom) return { nucleus: n, index: i };
        if (it.kind === 'bivalent' && it.homologs.includes(chrom)) return { nucleus: n, index: i, bivalent: it };
      }
    }
    return null;
  }

  // Take a chromosome out of wherever it is; a pair it leaves becomes a single chromosome.
  detach(chrom) {
    const at = this.locate(chrom);
    if (!at) return;
    if (at.bivalent) at.nucleus.items.splice(at.index, 1, at.bivalent.homologs.find((h) => h !== chrom));
    else at.nucleus.items.splice(at.index, 1);
  }

  // Crossover intervals: stretches between consecutive landmarks (chromosome ends, centromere, loci).
  intervals(chrom = this.karyotype[0].id) {
    const def = this.def(chrom);
    const marks = [
      { pos: 0, name: 'end' },
      { pos: def.centromere, name: 'centromere' },
      ...def.loci.map((l) => ({ pos: l.pos, name: l.id })),
      { pos: def.length, name: 'end' },
    ].sort((a, b) => a.pos - b.pos);
    return marks.slice(1).map((m, i) => ({ index: i, from: marks[i], to: m, mid: (marks[i].pos + m.pos) / 2, label: `between ${marks[i].name} and ${m.name}` }));
  }

  // ---- layout ----

  setRect(rect) {
    this.rect = rect;
    this.render();
  }

  trayHeight() {
    return this.readOnly ? 0 : Math.max(84, Math.min(104, this.rect.h * 0.2));
  }

  nucleusRects() {
    const { x, y, w } = this.rect;
    const h = this.rect.h - this.trayHeight() - (this.readOnly ? 0 : 10);
    const n = this.nuclei.length;
    const cols = n <= 2 ? Math.max(1, n) : 2;
    const rows = Math.max(1, Math.ceil(n / cols));
    const cw = w / cols;
    const ch = h / rows;
    return this.nuclei.map((nuc, i) => ({
      nucleus: nuc,
      cx: x + cw * ((i % cols) + 0.5),
      cy: y + ch * (Math.floor(i / cols) + 0.5) + 10,
      rx: cw * 0.44,
      ry: ch * 0.38,
    }));
  }

  alleleColor(locusId, allele) {
    if (!allele) return UNSET;
    const i = this.alleles[locusId].indexOf(allele);
    return [PALETTE.clay, PALETTE.dusk, PALETTE.sage, PALETTE.ochre][i % 4];
  }

  yOf(def, pos) {
    return (pos / def.length - 0.5) * this.chromLen;
  }

  chromosomeWidth(c, W = this.w) {
    return c.chromatids.length * W + (c.chromatids.length - 1) * W * 0.2;
  }

  itemWidth(it) {
    if (it.kind === 'bivalent') return it.homologs.reduce((s, h) => s + this.chromosomeWidth(h), 0) + this.w * 1.3;
    return this.chromosomeWidth(it);
  }

  // ---- drawing ----

  render() {
    this.root.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.hits = { nuclei: [], chromatids: [], chromosomes: [], bivalents: [], trash: null, area: null };
    this.pendingBounds = [];
    const rects = this.nucleusRects();
    const minDim = Math.min(...rects.map((r) => Math.min(r.rx * 2, r.ry * 2)), 420);
    this.chromLen = Math.max(60, Math.min(200, minDim * 0.62));
    this.w = Math.max(12, Math.min(22, this.chromLen * 0.12));

    this.hits.area = { x: this.rect.x, y: this.rect.y, width: this.rect.w, height: this.rect.h - this.trayHeight() };
    for (const r of rects) this.drawNucleus(r);
    if (!this.readOnly) this.drawTray();
    this.highlight = new PIXI.Graphics();
    this.root.addChild(this.highlight);
  }

  drawNucleus(r) {
    const { nucleus: n, cx, cy, rx, ry } = r;
    const g = new PIXI.Graphics().ellipse(cx, cy, rx, ry).fill({ color: PALETTE.nucleus, alpha: 0.55 }).stroke({ width: 2.5, color: PALETTE.cellEdge });
    this.root.addChild(g);
    this.hits.nuclei.push({ nucleus: n, cx, cy, rx, ry });

    const t = textLabel(n.label || `Nucleus ${this.nuclei.indexOf(n) + 1}`, 14, { fill: PALETTE.inkSoft, fontWeight: '800' });
    t.anchor.set(0.5, 1);
    t.position.set(cx, cy - ry - 4);
    this.root.addChild(t);

    if (!this.readOnly && !this.fixedNuclei && this.nuclei.length > 1) {
      const close = new PIXI.Container();
      close.addChild(new PIXI.Graphics().circle(0, 0, 11).fill(0xffffff).stroke({ width: 1.5, color: PALETTE.cellEdge }));
      const x = textLabel('×', 16, { fill: PALETTE.inkSoft });
      x.anchor.set(0.5, 0.55);
      close.addChild(x);
      close.position.set(cx + t.width / 2 + 16, cy - ry - 13);
      close.eventMode = 'static';
      close.cursor = 'pointer';
      close.on('pointertap', () => {
        this.nuclei = this.nuclei.filter((m) => m !== n);
        this.changed();
      });
      this.root.addChild(close);
    }

    if (!n.items.length && !this.readOnly) {
      const hint = textLabel('drag chromosomes here', 13, { fill: PALETTE.inkSoft, fontWeight: '600' });
      hint.anchor.set(0.5);
      hint.position.set(cx, cy);
      hint.alpha = 0.55;
      this.root.addChild(hint);
    }

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
      const view = it.kind === 'bivalent' ? this.drawBivalent(it, n) : this.drawChromosome(it, { nucleus: n });
      view.position.set(x + widths[i] / 2, 0);
      row.addChild(view);
      x += widths[i] + gap;
    });
    // Bounds can only be read once the views are placed in the row.
    this.pendingBounds?.forEach((fn) => fn());
    this.pendingBounds = [];
  }

  drawBivalent(it, nucleus) {
    const c = new PIXI.Container();
    const width = this.itemWidth(it);
    const L = this.chromLen;
    c.addChild(
      new PIXI.Graphics()
        .roundRect(-width / 2, -L / 2 - 10, width, L + 20, this.w)
        .fill({ color: PALETTE.ochre, alpha: 0.12 })
        .stroke({ width: 1.5, color: PALETTE.cellEdge, alpha: 0.9 }),
    );
    const w0 = this.chromosomeWidth(it.homologs[0]);
    const w1 = this.chromosomeWidth(it.homologs[1]);
    const inner = this.w * 0.5;
    const h0 = this.drawChromosome(it.homologs[0], { nucleus, bivalent: it });
    const h1 = this.drawChromosome(it.homologs[1], { nucleus, bivalent: it });
    h0.x = -inner / 2 - w0 / 2;
    h1.x = inner / 2 + w1 / 2;
    c.addChild(h0, h1);

    const def = this.def(it.chrom);
    const ivs = this.intervals(it.chrom);
    const seen = {};
    it.crossovers.forEach((xo, k) => {
      const iv = ivs[xo.interval];
      if (!iv) return;
      const stack = (seen[xo.interval] = (seen[xo.interval] ?? 0) + 1) - 1;
      const mark = this.crossMark();
      mark.position.set(0, this.yOf(def, iv.mid) + stack * 14);
      if (!this.readOnly) {
        mark.eventMode = 'static';
        mark.cursor = 'grab';
        mark.on('pointerdown', (e) => this.startDrag(e, { type: 'move-x', bivalent: it, index: k }, () => this.crossMark()));
      }
      c.addChild(mark);
    });

    this.pendingBounds.push(() => this.hits.bivalents.push({ bivalent: it, nucleus, view: c, bounds: c.getBounds(), def }));
    return c;
  }

  crossMark(size = this.w * 0.6) {
    const g = new PIXI.Graphics();
    g.circle(0, 0, size * 1.25).fill({ color: 0xffffff, alpha: 0.001 });
    g.moveTo(-size, -size).lineTo(size, size).moveTo(size, -size).lineTo(-size, size).stroke({ width: 4, color: PALETTE.ink, cap: 'round' });
    return g;
  }

  // A chromosome: one or two chromatids joined at the centromere, each with an allele band per locus.
  drawChromosome(chrom, { nucleus = null, bivalent = null, interactive = !this.readOnly, W = this.w, L = this.chromLen } = {}) {
    const c = new PIXI.Container();
    const def = this.def(chrom.chrom);
    const n = chrom.chromatids.length;
    const width = this.chromosomeWidth(chrom, W);
    const y = (pos) => (pos / def.length - 0.5) * L;
    const cy = y(def.centromere);
    const neck = W * 0.22;

    chrom.chromatids.forEach((ct, i) => {
      const view = new PIXI.Container();
      view.x = -width / 2 + W / 2 + i * W * 1.2;
      const body = new PIXI.Graphics();
      body.roundRect(-W / 2, -L / 2, W, cy + L / 2 - neck, W / 2).fill(CHROMATID_FILL).stroke({ width: 1.5, color: CHROMATID_EDGE });
      body.roundRect(-W / 2, cy + neck, W, L / 2 - cy - neck, W / 2).fill(CHROMATID_FILL).stroke({ width: 1.5, color: CHROMATID_EDGE });
      view.addChild(body);
      for (const locus of def.loci) {
        const allele = ct.alleles[locus.id];
        const bandH = W * 1.25;
        view.addChild(new PIXI.Graphics().roundRect(-W / 2 - 1, y(locus.pos) - bandH / 2, W + 2, bandH, 3).fill(this.alleleColor(locus.id, allele)));
        const t = textLabel(allele ?? '?', Math.max(11, W * 0.95), { fill: allele ? 0xffffff : PALETTE.inkSoft, fontWeight: '800' });
        t.anchor.set(0.5);
        t.position.set(0, y(locus.pos));
        view.addChild(t);
      }
      if (interactive) {
        view.eventMode = 'static';
        view.cursor = 'grab';
        view.hitArea = new PIXI.Rectangle(-W / 2 - 4, -L / 2 - 4, W + 8, L + 8);
        view.on('pointerdown', (e) =>
          this.startDrag(e, { type: 'move-chrom', chrom, chromatid: ct, def, source: c }, () => this.drawChromosome(chrom, { interactive: false, W: W * this.rowScale(c), L: L * this.rowScale(c) })),
        );
        this.pendingBounds.push(() => this.hits.chromatids.push({ chrom, chromatid: ct, def, view, bounds: view.getBounds() }));
      }
      c.addChild(view);
    });

    if (n === 2) c.addChild(new PIXI.Graphics().roundRect(-W * 0.6, cy - W * 0.3, W * 1.2, W * 0.6, W * 0.3).fill(CENTROMERE));
    else c.addChild(new PIXI.Graphics().circle(0, cy, W * 0.22).fill(CENTROMERE));

    if (interactive) this.pendingBounds.push(() => this.hits.chromosomes.push({ chrom, bivalent, nucleus, view: c, bounds: c.getBounds() }));
    return c;
  }

  rowScale(view) {
    return view.worldTransform.a;
  }

  // The tray of draggable pieces along the bottom.
  drawTray() {
    const th = this.trayHeight();
    const { x, w } = this.rect;
    const y = this.rect.y + this.rect.h - th;
    const tray = new PIXI.Graphics().roundRect(x, y, w, th, 14).fill(PALETTE.panel).stroke({ width: 1.5, color: PALETTE.line });
    this.root.addChild(tray);

    // A tab on the tray's top edge saying what it is for.
    const tab = textLabel('Drag from here ↓', 12, { fill: 0xffffff, fontWeight: '800' });
    tab.anchor.set(0, 0.5);
    const tabBg = new PIXI.Graphics().roundRect(x + 12, y - 11, tab.width + 18, 22, 11).fill(PALETTE.sage);
    tab.position.set(x + 21, y);
    this.root.addChild(tabBg, tab);
    this.trayPieces = [];

    const def = this.karyotype[0];
    const iconL = th * 0.5;
    const iconW = Math.max(8, iconL * 0.13);
    const blank = (k) => ({ chrom: def.id, chromatids: Array.from({ length: k }, () => ({ alleles: Object.fromEntries(def.loci.map((l) => [l.id, null])) })) });

    const pieces = [
      { caption: '1 chromatid', icon: () => this.drawChromosome(blank(1), { interactive: false, W: iconW, L: iconL }), payload: { type: 'new-chrom', copies: 1 } },
      { caption: '2 chromatids', icon: () => this.drawChromosome(blank(2), { interactive: false, W: iconW, L: iconL }), payload: { type: 'new-chrom', copies: 2 } },
    ];
    for (const [locusId, list] of Object.entries(this.alleles)) {
      for (const allele of list) pieces.push({ caption: 'allele', icon: () => this.alleleChip(locusId, allele, th * 0.2), payload: { type: 'allele', locusId, allele } });
    }
    if (this.crossovers) pieces.push({ caption: 'crossover', icon: () => this.crossMark(th * 0.13), payload: { type: 'new-x' } });
    if (!this.fixedNuclei) pieces.push({ caption: 'nucleus', icon: () => new PIXI.Graphics().ellipse(0, 0, th * 0.24, th * 0.17).fill({ color: PALETTE.nucleus }).stroke({ width: 2, color: PALETTE.cellEdge }), payload: { type: 'new-nucleus' } });

    const slots = pieces.length + 1;
    const slotW = w / slots;
    pieces.forEach((p, i) => {
      const cx = x + slotW * (i + 0.5);
      const holder = new PIXI.Container();
      holder.position.set(cx, y + th * 0.42);
      const icon = p.icon();
      holder.addChild(icon);
      holder.eventMode = 'static';
      holder.cursor = 'grab';
      holder.hitArea = new PIXI.Rectangle(-slotW / 2 + 2, -th * 0.4, slotW - 4, th * 0.8);
      holder.on('pointerdown', (e) => this.startDrag(e, p.payload, p.icon));
      this.root.addChild(holder);
      this.trayPieces.push({ payload: p.payload, icon: p.icon, x: cx, y: holder.y });
      const cap = textLabel(p.caption, 11, { fill: PALETTE.inkSoft, fontWeight: '700' });
      cap.anchor.set(0.5, 0);
      cap.position.set(cx, y + th * 0.8);
      this.root.addChild(cap);
    });

    // The bin.
    const bx = x + slotW * (slots - 0.5);
    const by = y + th * 0.42;
    const bin = new PIXI.Graphics();
    const s = th * 0.16;
    bin.roundRect(bx - s, by - s * 0.7, s * 2, s * 2.1, 3).stroke({ width: 2.5, color: TRASH });
    bin.moveTo(bx - s * 1.3, by - s * 0.9).lineTo(bx + s * 1.3, by - s * 0.9).stroke({ width: 2.5, color: TRASH, cap: 'round' });
    bin.moveTo(bx - s * 0.35, by - s * 1.25).lineTo(bx + s * 0.35, by - s * 1.25).stroke({ width: 2.5, color: TRASH, cap: 'round' });
    for (const dx of [-0.45, 0, 0.45]) bin.moveTo(bx + dx * s, by - s * 0.3).lineTo(bx + dx * s, by + s * 1.1).stroke({ width: 1.8, color: TRASH });
    this.root.addChild(bin);
    const cap = textLabel('remove', 11, { fill: TRASH, fontWeight: '700' });
    cap.anchor.set(0.5, 0);
    cap.position.set(bx, y + th * 0.8);
    this.root.addChild(cap);
    this.hits.trash = { x: bx - slotW / 2, y, width: slotW, height: th };
  }

  alleleChip(locusId, allele, r) {
    const c = new PIXI.Container();
    c.addChild(new PIXI.Graphics().roundRect(-r, -r * 0.8, r * 2, r * 1.6, r * 0.45).fill(this.alleleColor(locusId, allele)));
    const t = textLabel(allele, Math.max(13, r * 1.1), { fill: 0xffffff, fontWeight: '800' });
    t.anchor.set(0.5);
    c.addChild(t);
    return c;
  }

  // ---- guided demo ----

  pointerHand() {
    const g = new PIXI.Graphics();
    g.poly([0, 0, 0, 24, 6.5, 18.5, 11, 28, 15.5, 26, 11, 16.5, 19, 16.5]).fill(0xffffff).stroke({ width: 2, color: PALETTE.ink, join: 'round' });
    g.scale.set(1.25);
    return g;
  }

  stopDemo() {
    this.demoToken++;
    this.locked = false;
    this.overlay.removeChildren().forEach((c) => c.destroy({ children: true }));
  }

  // A pointer drags a chromosome into the first nucleus, labels it with an allele, then drops it on the bin, with
  // a caption for each move. The workspace is put back afterwards. Resolves false if interrupted.
  async demo(tween) {
    if (this.readOnly || !this.nuclei.length || !this.trayPieces?.length) return false;
    this.stopDemo();
    const token = this.demoToken;
    const alive = () => token === this.demoToken && !this.root.destroyed;
    const saved = this.getNuclei();
    this.locked = true;

    const hand = this.pointerHand();
    const caption = new PIXI.Container();
    this.overlay.addChild(caption, hand);
    const say = (text) => {
      if (!alive()) return Promise.resolve();
      caption.removeChildren().forEach((c) => c.destroy());
      const t = textLabel(text, 15, { fill: 0xffffff, fontWeight: '800' });
      t.anchor.set(0.5);
      const bg = new PIXI.Graphics().roundRect(-t.width / 2 - 14, -t.height / 2 - 8, t.width + 28, t.height + 16, 12).fill({ color: PALETTE.ink, alpha: 0.88 });
      caption.addChild(bg, t);
      // Just above the tray, where the pieces come from.
      caption.position.set(this.rect.x + this.rect.w / 2, this.rect.y + this.rect.h - this.trayHeight() - t.height / 2 - 18);
      return tween.wait(450);
    };
    const glide = (x, y, duration = 900) => (alive() ? tween.to(hand, { x, y }, { duration }) : Promise.resolve());
    const press = async () => {
      if (!alive()) return;
      const ring = new PIXI.Graphics().circle(0, 0, 18).stroke({ width: 3, color: PALETTE.ochre });
      ring.position.set(hand.x, hand.y);
      this.overlay.addChild(ring);
      await tween.to(ring, { alpha: 0 }, { duration: 380 });
      if (!ring.destroyed) ring.destroy();
    };
    const carry = async (ghost, x, y) => {
      if (!alive()) return ghost.destroy({ children: true });
      ghost.alpha = 0.9;
      ghost.position.set(hand.x, hand.y);
      this.overlay.addChildAt(ghost, 0);
      const follow = () => {
        if (!ghost.destroyed && !hand.destroyed) ghost.position.set(hand.x, hand.y);
      };
      tween.ticker.add(follow);
      await glide(x, y, 1000);
      tween.ticker.remove(follow);
      if (!ghost.destroyed) ghost.destroy({ children: true });
    };

    try {
      const n = this.nuclei[0];
      const nr = this.hits.nuclei.find((r) => r.nucleus === n);
      hand.position.set(nr.cx + nr.rx * 0.4, nr.cy);
      hand.alpha = 0;
      await tween.to(hand, { alpha: 1 }, { duration: 300 });

      await say('1. Drag a chromosome from the tray into a nucleus');
      const piece = this.trayPieces.find((p) => p.payload.type === 'new-chrom') ?? this.trayPieces[0];
      await glide(piece.x, piece.y);
      await press();
      if (!alive()) return false;
      await carry(piece.icon(), nr.cx, nr.cy);
      if (!alive()) return false;
      this.drop(piece.payload, { kind: 'nucleus', nucleus: n }, { x: nr.cx, y: nr.cy });
      await tween.wait(800);
      if (!alive()) return false;

      await say('2. Drag an allele onto a chromatid to label it');
      if (!alive()) return false;
      const chrom = n.items[n.items.length - 1];
      const chip = this.trayPieces.find((p) => p.payload.type === 'allele');
      const hit = this.hits.chromatids.find((c) => c.chrom === chrom);
      const def = this.def(chrom.chrom);
      const band = { x: hit.bounds.x + hit.bounds.width / 2, y: hit.bounds.y + (def.loci[0].pos / def.length) * hit.bounds.height };
      await glide(chip.x, chip.y);
      await press();
      if (!alive()) return false;
      await carry(chip.icon(), band.x, band.y);
      if (!alive()) return false;
      this.drop(chip.payload, { kind: 'chromatid', ...hit }, band);
      await tween.wait(1000);
      if (!alive()) return false;

      await say('3. Drag anything onto the bin to remove it');
      if (!alive()) return false;
      const whole = this.hits.chromosomes.find((c) => c.chrom === chrom);
      const center = { x: whole.bounds.x + whole.bounds.width / 2, y: whole.bounds.y + whole.bounds.height * 0.7 };
      await glide(center.x, center.y);
      await press();
      if (!alive()) return false;
      const s = whole.view.worldTransform.a;
      whole.view.alpha = 0.25;
      const trash = this.hits.trash;
      await carry(this.drawChromosome(chrom, { interactive: false, W: this.w * s, L: this.chromLen * s }), trash.x + trash.width / 2, trash.y + trash.height * 0.4);
      if (!alive()) return false;
      this.drop({ type: 'move-chrom', chrom }, { kind: 'trash' }, {});

      await say('Your turn!');
      await tween.to(hand, { alpha: 0 }, { duration: 1000 });
      return alive();
    } finally {
      if (token === this.demoToken && !this.root.destroyed) {
        this.overlay.removeChildren().forEach((c) => c.destroy({ children: true }));
        this.locked = false;
        this.nuclei = saved.map((m) => ({ id: uid(), label: m.label ?? '', items: m.items.map(cloneItem) }));
        this.changed();
      }
    }
  }

  // ---- dragging ----

  toPoint(e) {
    const p = new PIXI.Point();
    this.app.renderer.events.mapPositionToPoint(p, e.clientX, e.clientY);
    return p;
  }

  startDrag(e, payload, makeGhost) {
    if (this.readOnly || this.drag || this.locked) return;
    e.stopPropagation();
    const start = e.global.clone();
    this.drag = { payload, start, point: start, moved: false, makeGhost, ghost: null };
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  cancelDrag() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.drag?.ghost?.destroy({ children: true });
    if (this.drag?.payload.source && !this.drag.payload.source.destroyed) this.drag.payload.source.alpha = 1;
    this.drag = null;
  }

  dragMove(e) {
    const d = this.drag;
    if (!d) return;
    const p = this.toPoint(e);
    d.point = p;
    if (!d.moved && Math.hypot(p.x - d.start.x, p.y - d.start.y) < 6) return;
    if (!d.moved) {
      d.moved = true;
      d.ghost = d.makeGhost();
      d.ghost.alpha = 0.9;
      d.ghost.eventMode = 'none';
      this.root.addChild(d.ghost);
      if (d.payload.source) d.payload.source.alpha = 0.25;
    }
    d.ghost.position.set(p.x, p.y);
    this.showTarget(this.targetFor(d.payload, p));
  }

  dragEnd(e) {
    const d = this.drag;
    if (!d) return;
    const p = this.toPoint(e);
    const payload = d.payload;
    const moved = d.moved;
    this.cancelDrag();
    if (!moved) return this.tap(payload, p);
    this.drop(payload, this.targetFor(payload, p), p);
  }

  // What the dragged piece would land on at point p.
  targetFor(payload, p) {
    const h = this.hits;
    if (h.trash && inRect(p, h.trash) && ['move-chrom', 'move-x'].includes(payload.type)) return { kind: 'trash' };
    const nucleusAt = h.nuclei.find((r) => ((p.x - r.cx) / r.rx) ** 2 + ((p.y - r.cy) / r.ry) ** 2 <= 1);
    switch (payload.type) {
      case 'new-chrom':
        return nucleusAt ? { kind: 'nucleus', ...nucleusAt } : null;
      case 'allele': {
        const hit = h.chromatids.find((c) => inRect(p, c.bounds));
        return hit ? { kind: 'chromatid', ...hit } : null;
      }
      case 'new-x':
      case 'move-x': {
        const hit = h.bivalents.find((b) => inRect(p, b.bounds));
        return hit ? { kind: 'bivalent', ...hit } : payload.type === 'move-x' ? { kind: 'remove-x' } : null;
      }
      case 'new-nucleus':
        return !this.fixedNuclei && this.nuclei.length < this.maxNuclei && inRect(p, h.area) ? { kind: 'area' } : null;
      case 'move-chrom': {
        const onto = h.chromosomes.find((c) => c.chrom !== payload.chrom && !c.bivalent && c.chrom.chrom === payload.chrom.chrom && inRect(p, c.bounds));
        if (onto) return { kind: 'pair', ...onto };
        return nucleusAt ? { kind: 'nucleus', ...nucleusAt } : null;
      }
    }
    return null;
  }

  showTarget(t) {
    const g = this.highlight;
    g.clear();
    if (!t) return;
    const glow = { width: 4, color: PALETTE.ochre };
    if (t.kind === 'trash') g.roundRect(t.x ?? this.hits.trash.x, this.hits.trash.y + 4, this.hits.trash.width, this.hits.trash.height - 8, 10).stroke({ width: 4, color: TRASH });
    else if (t.kind === 'nucleus') g.ellipse(t.cx, t.cy, t.rx, t.ry).stroke(glow);
    else if (t.kind === 'area') g.rect(this.hits.area.x + 4, this.hits.area.y + 4, this.hits.area.width - 8, this.hits.area.height - 8).stroke({ ...glow, alpha: 0.6 });
    else if (t.bounds) g.roundRect(t.bounds.x - 4, t.bounds.y - 4, t.bounds.width + 8, t.bounds.height + 8, 8).stroke(glow);
  }

  // Nearest locus band (for alleles) or interval (for crossovers) to a point on a chromosome.
  nearestLocus(def, bounds, p) {
    const rel = (p.y - bounds.y) / bounds.height;
    const pos = rel * def.length;
    return def.loci.reduce((best, l) => (Math.abs(l.pos - pos) < Math.abs(best.pos - pos) ? l : best), def.loci[0]);
  }

  nearestInterval(def, bounds, p) {
    // Bivalent bounds include a 10px margin above and below the chromosomes.
    const rel = (p.y - bounds.y - 10 * (bounds.height / (this.chromLen + 20))) / (bounds.height * (this.chromLen / (this.chromLen + 20)));
    const pos = Math.max(0, Math.min(1, rel)) * def.length;
    return this.intervals(def.id).find((iv) => pos >= iv.from.pos && pos <= iv.to.pos) ?? this.intervals(def.id)[0];
  }

  tap(payload, p) {
    if (payload.type === 'move-chrom') {
      // Tapping a chromatid cycles its allele at the nearest band.
      const hit = this.hits.chromatids.find((c) => c.chromatid === payload.chromatid);
      const locus = hit ? this.nearestLocus(payload.def, hit.bounds, p) : payload.def.loci[0];
      const opts = this.alleles[locus.id];
      const cur = payload.chromatid.alleles[locus.id];
      payload.chromatid.alleles[locus.id] = cur ? opts[(opts.indexOf(cur) + 1) % opts.length] : opts[0];
      return this.changed();
    }
    if (payload.type === 'move-x') {
      payload.bivalent.crossovers.splice(payload.index, 1);
      return this.changed();
    }
    // Tapping a tray piece: drop it in the only nucleus if there is just one.
    if (payload.type === 'new-chrom' && this.nuclei.length === 1) return this.drop(payload, { kind: 'nucleus', nucleus: this.nuclei[0] }, p);
    if (payload.type === 'new-nucleus') return this.drop(payload, { kind: 'area' }, p);
    this.render();
  }

  drop(payload, t, p) {
    if (!t) return this.render();
    const def = this.karyotype[0];
    switch (payload.type) {
      case 'new-chrom': {
        const chromatids = Array.from({ length: payload.copies }, () => ({ alleles: Object.fromEntries(def.loci.map((l) => [l.id, null])) }));
        t.nucleus.items.push({ id: uid(), kind: 'chromosome', chrom: def.id, chromatids });
        break;
      }
      case 'allele': {
        const locus = this.nearestLocus(t.def, t.bounds, p);
        if (locus.id === payload.locusId) t.chromatid.alleles[locus.id] = payload.allele;
        else t.chromatid.alleles[payload.locusId] = payload.allele;
        break;
      }
      case 'new-x':
        t.bivalent.crossovers.push({ interval: this.nearestInterval(t.def, t.bounds, p).index });
        break;
      case 'move-x':
        payload.bivalent.crossovers.splice(payload.index, 1);
        if (t.kind === 'bivalent') t.bivalent.crossovers.push({ interval: this.nearestInterval(t.def, t.bounds, p).index });
        break;
      case 'new-nucleus':
        if (this.nuclei.length < this.maxNuclei) this.nuclei.push({ id: uid(), label: '', items: [] });
        break;
      case 'move-chrom':
        if (t.kind === 'trash') this.detach(payload.chrom);
        else if (t.kind === 'pair') {
          this.detach(payload.chrom);
          const at = this.locate(t.chrom);
          at.nucleus.items.splice(at.index, 1, { id: uid(), kind: 'bivalent', chrom: t.chrom.chrom, homologs: [t.chrom, payload.chrom], crossovers: [] });
        } else if (t.kind === 'nucleus') {
          const at = this.locate(payload.chrom);
          if (at.nucleus === t.nucleus && !at.bivalent) return this.render();
          this.detach(payload.chrom);
          t.nucleus.items.push(payload.chrom);
        }
        break;
    }
    this.changed();
  }
}
