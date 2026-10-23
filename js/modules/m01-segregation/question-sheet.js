// A multiple-choice question on the main page, in a sheet at the bottom of the canvas. The step lays its picture
// out above the sheet (space()), and is told to lay out again when the sheet appears, disappears or grows with
// feedback. The side panel keeps the prompt and, once it is right, the result (answeredNote). A question the student
// got right stays in the sheet, its answer selected, until the step moves on (next question, next action or page).
// On a stacked layout (phones, narrow windows) the sheet sits between the canvas and the panel instead, so the
// picture keeps its full height.

import { h, clear, question } from '../../core/dom.js';

// Matches the CSS breakpoint where the panel moves under the canvas.
const STACKED = '(max-width: 860px)';

export class QuestionSheet {
  // relayout: called when the sheet's height changes.
  constructor(mod, relayout) {
    this.el = h('div', { class: 'stage-sheet at-bottom', hidden: true });
    this.stage = mod.ctx.stage;
    this.stacked = window.matchMedia(STACKED);
    this.onStack = () => {
      this.place();
      this.fit();
    };
    this.stacked.addEventListener('change', this.onStack);
    this.place();
    this.relayout = relayout;
    this.key = null;
    this.answeredKey = null;
    this.laidOut = 0;
  }

  // Shows question q under `key`. Showing the same key again keeps the student's wrong answers on screen.
  // answered: draw it already right. next: { label, onClick } for a button under an answered question.
  show(key, q, { answered = false, next = null } = {}) {
    const state = `${key}:${answered}`;
    this.answeredKey = answered ? key : null;
    if (this.key !== state) {
      this.key = state;
      // question() writes its feedback after onAnswer, so measure once the click has been handled.
      const onAnswer = (o) => {
        q.onAnswer?.(o);
        queueMicrotask(() => this.fit());
      };
      clear(this.el).append(question({ ...q, onAnswer, answered }));
      if (answered && next) {
        this.el.append(h('div', { class: 'row sheet-next' }, h('button', { class: 'btn primary', type: 'button', onclick: next.onClick }, next.label)));
      }
      // Sentence-long choices stack full width in smaller type; short ones (½, 3 : 1) sit side by side.
      this.el.classList.toggle('wordy', q.options.some((o) => o.label.length > 12));
    }
    this.el.hidden = false;
    this.fit();
  }

  hide() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.key = null;
    this.answeredKey = null;
    clear(this.el);
    this.fit();
  }

  // Over the bottom of the canvas, or under it on a stacked layout.
  place() {
    const below = this.stacked.matches;
    if (below) this.stage.after(this.el);
    else this.stage.append(this.el);
    this.el.classList.toggle('below', below);
  }

  // Canvas height the sheet covers, with its margins.
  space() {
    return this.el.hidden || this.el.classList.contains('below') ? 0 : this.el.offsetHeight + 24;
  }

  fit() {
    const s = this.space();
    if (s === this.laidOut) return;
    this.laidOut = s;
    this.relayout();
  }

  // The student has moved on: an answered question on screen is marked seen in `seen` so it does not come back.
  moveOn(seen) {
    if (this.answeredKey) seen.add(this.answeredKey);
  }

  remove() {
    this.stacked.removeEventListener('change', this.onStack);
    this.el.remove();
  }
}

// The panel's record of a question once it is right: the prompt, the answer and why.
export function answeredNote(q) {
  const right = q.options.find((o) => o.correct);
  const why = (right.feedback ?? '').replace(/^Right[.:]\s*/, '');
  return h('div', { class: 'answered' }, h('p', { class: 'hint' }, `✓ ${q.prompt} `, h('b', {}, right.label)), why ? h('p', { class: 'hint' }, why) : '');
}

// The panel's pointer to the sheet while a question is open there.
export function sheetPointer(text) {
  return h('div', { class: 'callout' }, h('b', {}, `Answer on the main page ${window.innerWidth > 860 ? '←' : '↑'}`), text);
}
