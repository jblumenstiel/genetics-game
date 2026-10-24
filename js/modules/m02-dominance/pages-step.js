// Steps B and C: a series of slides, one term per page. The canvas shows the definition card with its bdellbee
// example under it; Back and Next sit in the bar along the bottom of the canvas; the panel lists the pages.

import { h, clear } from '../../core/dom.js';
import { stepLetter } from '../registry.js';
import { definitionCard } from './views.js';

export class PagesStep {
  constructor(mod, id, heading, pages) {
    this.mod = mod;
    this.id = id;
    this.heading = heading;
    this.pages = pages;
    this.i = mod.state.pages[id] ?? 0;
    // State each page keeps while the step is open (the threshold a student dragged to).
    this.pageState = (mod.state.pageState ??= {});
  }

  get page() {
    return this.pages[this.i];
  }

  enter(container, body) {
    this.container = container;
    this.body = body;
    this.mod.setStage(this.heading);
    this.show(this.i);
  }

  exit() {
    this.ctx?.cleanup?.();
  }

  show(i) {
    this.ctx?.cleanup?.();
    this.i = i;
    this.mod.state.pages[this.id] = i;
    if (i === this.pages.length - 1) this.mod.complete(this.id);
    this.renderPanel();
    const last = i === this.pages.length - 1;
    const onward = this.mod.continueLabel();
    this.mod.setNav(
      [
        i > 0 ? { label: '◀ Back', onClick: () => this.show(i - 1) } : null,
        last ? (onward ? { label: onward, primary: true, onClick: () => this.mod.next() } : null) : { label: 'Next ▶', primary: true, onClick: () => this.show(i + 1) },
      ].filter(Boolean),
      `${i + 1} of ${this.pages.length}`,
    );
    this.draw();
  }

  renderPanel() {
    const body = clear(this.body);
    const index = this.mod.index;
    body.append(
      h('h2', {}, `${stepLetter(index)}. ${this.heading}`),
      h('p', { class: 'hint' }, 'Read each definition and its bdellbee example on the main page, then press Next.'),
      h(
        'ol',
        { class: 'page-list' },
        this.pages.map((p, k) =>
          h('li', {}, h('button', { class: k === this.i ? 'current' : k < this.i ? 'done' : '', type: 'button', onclick: () => this.show(k) }, p.term)),
        ),
      ),
      this.page.panel ? this.page.panel() : '',
    );
  }

  draw() {
    const layer = this.container;
    layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const { w, h: hgt } = this.mod.size();
    const avail = hgt - this.mod.barSpace() - 8;
    const compact = w < 520 || avail < 420;
    const cw = Math.min(w - 24, 760);
    const inner = new PIXI.Container();
    layer.addChild(inner);
    const card = definitionCard(this.page.term, this.page.body(this.mod.inst), cw, { compact });
    card.position.set((w - cw) / 2, 6);
    inner.addChild(card);
    const top = card.y + card.h + (compact ? 10 : 16);
    // The example draws into its own layer, so it can sit in the middle of the space under the definition.
    const example = new PIXI.Container();
    inner.addChild(example);
    this.ctx = {
      layer: example,
      inst: this.mod.inst,
      w,
      top,
      height: avail - top,
      app: this.mod.ctx.app,
      page: (this.pageState[`${this.id}:${this.page.id}`] ??= {}),
      redraw: () => this.draw(),
    };
    this.page.draw(this.ctx);
    const eb = example.getLocalBounds();
    const spare = avail - (eb.y + eb.height);
    if (spare > 24) example.y = Math.min(spare * 0.4, 80);
    // A short stage (a phone) shrinks the slide to fit above the bar rather than hiding its bottom.
    const b = inner.getLocalBounds();
    const bottom = b.y + b.height;
    if (bottom > avail) {
      const k = Math.max(0.55, avail / bottom);
      inner.scale.set(k);
      inner.x = (w - w * k) / 2;
    }
  }

  resize() {
    this.mod.setNav(null);
    this.show(this.i);
  }
}
