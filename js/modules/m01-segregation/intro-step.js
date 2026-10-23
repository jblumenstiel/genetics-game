// The opening page: what Module 1 covers, with today's bdellbee and the path through steps A to E.

import { h } from '../../core/dom.js';
import { PALETTE } from '../../core/palette.js';
import { label } from '../../render/chromosome.js';
import { stepLetter } from '../registry.js';
import { creatureCard } from './instance.js';

// One line per step, in the order of the stepper after the intro.
const OBJECTIVES = {
  meiosis: 'Review one meiosis, following one gene, and see why each gamete carries either allele with probability ½.',
  gametes: 'Predict what fraction of gametes carry each allele, then make random gametes and count them.',
  fertilization: 'Join one egg and one sperm at a time, then see how these independent events build a Punnett square.',
  breed: 'Predict the offspring ratio, then breed a litter and compare.',
  detective: 'Work backwards from a litter to the parents’ genotypes.',
};

export class IntroStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.steps = mod.steps.filter((s) => !s.intro);
  }

  enter(container, body) {
    this.container = container;
    const { name, label: geno } = this.inst.meiosisParent;
    const { trait, species } = this.inst;
    const [D, r] = trait.alleles;
    body.append(
      h('div', { class: 'stage-name' }, 'Introduction'),
      h(
        'p',
        {},
        `In this module, we briefly repeat meiosis and then think about inheritance: how the two copies of one gene are passed from parents to offspring. Today’s ${species.plural} carry one gene for ${trait.name.toLowerCase()}, with a dominant allele, ${D.label}, and a recessive allele, ${r.label}. Our first bdellbee is ${name}, who is ${geno}.`,
      ),
      h('p', {}, h('b', {}, 'Objectives')),
      h(
        'ul',
        { class: 'tips' },
        this.steps.map((s, i) => h('li', {}, h('b', {}, `${stepLetter(i)}. ${s.title}: `), OBJECTIVES[s.id])),
      ),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => this.mod.next() }, `Start: ${stepLetter(0)}. ${this.steps[0].title} ▶`)),
    );
    const { w, h: hgt } = this.mod.size();
    this.resize(w, hgt);
  }

  exit() {}

  resize(w, hgt) {
    const layer = this.container;
    layer.removeChildren().forEach((c) => c.destroy({ children: true }));

    const title = new PIXI.Text({
      text: 'One Gene, One Meiosis: From Meiosis to Inheritance',
      style: { fontFamily: 'Fraunces, Georgia, serif', fontWeight: '600', fontSize: 24, fill: PALETTE.ink, wordWrap: true, wordWrapWidth: w - 48, align: 'center' },
      resolution: 2,
    });
    title.anchor.set(0.5, 0);
    title.position.set(w / 2, 24);
    layer.addChild(title);

    const size = Math.max(60, Math.min(100, hgt * 0.16));
    const card = creatureCard(this.inst.meiosisParent, { size });
    const b = card.container.getLocalBounds();
    card.container.position.set(w / 2, title.y + title.height + 20 - b.y);
    layer.addChild(card.container);
    const flowTop = card.container.y + b.y + b.height + 32;
    this.drawFlow(layer, w, hgt, flowTop);
  }

  // The steps as a row of boxes joined by arrows, or a column on narrow screens.
  drawFlow(layer, w, hgt, top) {
    const n = this.steps.length;
    const rowW = Math.min(160, (w - 48 - 26 * (n - 1)) / n);
    const vertical = rowW < 104;
    // A column shrinks its boxes and gaps to fit the stage height.
    const room = hgt - top - 16;
    const gap = vertical ? Math.max(14, Math.min(26, (room - n * 30) / (n - 1))) : 26;
    const bw = vertical ? Math.min(300, w - 64) : rowW;
    const bh = vertical ? Math.max(26, Math.min(48, (room - gap * (n - 1)) / n)) : 74;
    const g = new PIXI.Graphics();
    layer.addChild(g);
    this.steps.forEach((s, i) => {
      const x = vertical ? w / 2 - bw / 2 : w / 2 - (n * bw + (n - 1) * gap) / 2 + i * (bw + gap);
      const y = vertical ? top + i * (bh + gap) : top;
      g.roundRect(x, y, bw, bh, 12).fill(PALETTE.panel).stroke({ width: 2, color: PALETTE.cellEdge });
      const t = label(`${stepLetter(i)}. ${s.title}`, vertical ? 15 : 14, { fontWeight: '800', fill: PALETTE.sage, wordWrap: true, wordWrapWidth: bw - 12, align: 'center' });
      t.anchor.set(0.5);
      t.position.set(x + bw / 2, y + bh / 2);
      layer.addChild(t);
      if (i === n - 1) return;
      // Arrow to the next box.
      const s1 = 9;
      if (vertical) {
        const ax = w / 2;
        const y0 = y + bh + 4;
        const y1 = y + bh + gap - 4;
        g.moveTo(ax, y0).lineTo(ax, y1 - s1 * 0.6).stroke({ width: 3, color: PALETTE.sage, cap: 'round' });
        g.poly([ax, y1, ax - s1 * 0.6, y1 - s1, ax + s1 * 0.6, y1 - s1]).fill(PALETTE.sage);
      } else {
        const ay = y + bh / 2;
        const x0 = x + bw + 4;
        const x1 = x + bw + gap - 4;
        g.moveTo(x0, ay).lineTo(x1 - s1 * 0.6, ay).stroke({ width: 3, color: PALETTE.sage, cap: 'round' });
        g.poly([x1, ay, x1 - s1, ay - s1 * 0.6, x1 - s1, ay + s1 * 0.6]).fill(PALETTE.sage);
      }
    });
  }
}
