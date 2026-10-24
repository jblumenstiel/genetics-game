// Step A: alleles, genotypes and phenotypes. A statement on the canvas opens two quick quizzes (pick the phenotype
// among genotypes, then the genotype among phenotypes), and the step ends on the question the next pages answer.

import { h, clear, question } from '../../core/dom.js';
import { QuestionSheet, answeredNote, sheetPointer } from '../../core/question-sheet.js';
import { shuffle } from '../../core/rng.js';
import { PALETTE } from '../../core/palette.js';
import { stepLetter } from '../registry.js';
import { label } from '../../render/chromosome.js';
import { GENOTYPE_MENU, PHENOTYPE_MENU, questionRng } from './instance.js';
import { canvasButton, definitionCard, genotypeCard, text } from './views.js';

const STATEMENT = 'Dominance describes how the two alleles in a genotype work together to produce a phenotype.';
const FRAMING = 'How do alleles come together to produce genotypes, and how do those genotypes produce phenotypes?';

export class BasicsStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.s = mod.state.basics ??= { opened: false };
    this.questions = this.makeQuestions();
  }

  // One phenotype among three genotypes, then one genotype among three phenotypes, drawn from the menus by seed.
  makeQuestions() {
    const rng = questionRng(this.inst, 1);
    const genos = shuffle(rng, GENOTYPE_MENU);
    const phenos = shuffle(rng, PHENOTYPE_MENU);
    const phenotype = phenos[0];
    const genotype = genos[3];
    const q1 = {
      prompt: 'Which of the following is a phenotype?',
      options: shuffle(rng, [
        ...genos.slice(0, 3).map((g) => ({ label: g, correct: false, feedback: `${g} is a genotype: it names the alleles an individual carries. A phenotype is something you can observe or measure about the individual.` })),
        { label: phenotype, correct: true, feedback: `Right. “${phenotype}” is a phenotype: a trait you can observe or measure. The other three name alleles, so they are genotypes.` },
      ]),
    };
    const q2 = {
      prompt: 'Which of the following is a genotype?',
      options: shuffle(rng, [
        ...phenos.slice(1, 4).map((p) => ({ label: p, correct: false, feedback: `“${p}” is a phenotype: it describes what the individual is like. A genotype names the alleles, in one-line notation such as S/s.` })),
        { label: genotype, correct: true, feedback: `Right. ${genotype} is a genotype: it names the alleles carried, with “/” between the alleles of one gene and “ ; ” between genes on different chromosomes.` },
      ]),
    };
    return [q1, q2];
  }

  enter(container, body) {
    this.container = container;
    this.body = body;
    this.mod.setStage('Alleles, genotypes and phenotypes');
    this.sheet = new QuestionSheet(this.mod, () => this.mod.relayout());
    this.renderPanel();
  }

  exit() {
    this.exited = true;
    this.sheet.moveOn(this.mod.state.seen);
    this.sheet.remove();
  }

  open() {
    this.s.opened = true;
    this.renderPanel();
  }

  renderPanel() {
    if (this.exited) return;
    this.sheet.begin();
    this.renderBody(clear(this.body));
    this.sheet.end();
    this.draw();
  }

  renderBody(body) {
    const { answered, seen } = this.mod.state;
    body.append(h('h2', {}, `${stepLetter(this.mod.index)}. Alleles, genotypes and phenotypes`));
    if (!this.s.opened) {
      body.append(h('p', {}, STATEMENT), sheetPointer('Click the statement on the main page to begin.'));
      return;
    }
    body.append(h('p', {}, STATEMENT));
    const [q1, q2] = this.questions;
    const state = this.mod.state;
    const rerender = () => this.renderPanel();
    if (!this.sheet.ask(body, { key: 'basics:phenotype', q: q1, state, rerender })) return;
    if (!answered.has('basics:genotype')) {
      this.sheet.ask(body, { key: 'basics:genotype', q: q2, state, rerender, onRight: () => this.mod.complete('basics') });
      return;
    }
    // Both right: the answer stays in the sheet with the question the next pages answer, and the way on.
    body.append(answeredNote(q2), h('p', {}, h('b', {}, FRAMING)), h('p', { class: 'hint' }, 'Keep this question in mind: the terminology pages answer it.'));
    if (seen.has('basics:genotype')) return;
    const onward = this.mod.continueLabel();
    this.sheet.showForm(
      question({ ...q2, answered: true }),
      h('p', { class: 'prompt framing' }, FRAMING),
      h(
        'div',
        { class: 'row sheet-next' },
        h(
          'button',
          {
            class: 'btn primary',
            type: 'button',
            onclick: () => {
              seen.add('basics:genotype');
              this.mod.next();
            },
          },
          onward,
        ),
      ),
    );
  }

  draw() {
    const layer = this.container;
    layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const { w, h: hgt } = this.mod.size();
    const avail = hgt - this.sheet.space() - 8;
    if (!this.s.opened) {
      const b = canvasButton(STATEMENT, { width: Math.min(w - 40, 520), primary: true, onTap: () => this.open() });
      b.position.set(w / 2, Math.max(b.h / 2 + 20, avail * 0.42));
      const hint = text('Click to begin ▸', 14, { weight: '800', fill: PALETTE.inkSoft });
      hint.anchor.set(0.5, 0);
      hint.position.set(w / 2, b.y + b.h / 2 + 12);
      layer.addChild(b, hint);
      return;
    }
    const cw = Math.min(w - 24, 720);
    const card = definitionCard('Dominance', STATEMENT, cw, { compact: w < 520 });
    card.position.set((w - cw) / 2, 6);
    layer.addChild(card);
    this.drawPath(layer, w, card.y + card.h + 14, avail);
  }

  // Alleles → genotype → phenotype, with the module's pigment gene.
  drawPath(layer, w, top, avail) {
    const P = this.inst.pigment;
    const p = P.toLowerCase();
    const room = avail - top;
    if (room < 90) return;
    const size = Math.max(50, Math.min(90, room * 0.45));
    const row = new PIXI.Container();
    const chip = (a, color) => {
      const c = new PIXI.Container();
      c.addChild(new PIXI.Graphics().roundRect(-20, -16, 40, 32, 9).fill(color));
      const t = label(a, 18, { fill: 0xffffff, fontWeight: '800' });
      t.anchor.set(0.5);
      c.addChild(t);
      return c;
    };
    const alleles = new PIXI.Container();
    const c1 = chip(P, PALETTE.clay);
    const c2 = chip(p, PALETTE.dusk);
    c1.x = -26;
    c2.x = 26;
    alleles.addChild(c1, c2);
    const geno = label(`${P}/${p}`, 26, { fill: PALETTE.sage, fontWeight: '800' });
    geno.anchor.set(0.5);
    const bee = genotypeCard({ features: this.inst.features(), genotype: '', size });
    const parts = [alleles, geno, bee];
    const caps = ['two alleles', 'a genotype', 'a phenotype: pigmented'];
    const narrow = w < 520;
    const gap = narrow ? (w - 40) / 3 : Math.min(200, (w - 80) / 3);
    const arrow = new PIXI.Graphics();
    parts.forEach((part, i) => {
      const x = (i - 1) * gap;
      part.x = x;
      part.y = i === 2 ? -size * 0.55 : 0;
      row.addChild(part);
      const cap = text(caps[i], narrow ? 12 : 14, { weight: '800', fill: PALETTE.inkSoft, align: 'center', width: gap - 8 });
      cap.anchor.set(0.5, 0);
      cap.position.set(x, size * 0.55 + 8);
      row.addChild(cap);
      if (i < 2) {
        const x0 = x + gap * 0.3;
        const x1 = x + gap * 0.7;
        arrow.moveTo(x0, 0).lineTo(x1 - 8, 0).stroke({ width: 3, color: PALETTE.sage, cap: 'round' });
        arrow.poly([x1, 0, x1 - 10, -6, x1 - 10, 6]).fill(PALETTE.sage);
      }
    });
    row.addChild(arrow);
    row.position.set(w / 2, top + Math.min(room / 2, size * 0.75 + 10));
    layer.addChild(row);
  }

  resize() {
    this.draw();
  }
}
