// A multiple-choice question on the main page, in a sheet at the bottom of the canvas. The step lays its picture
// out above the sheet (space()), and is told to lay out again when the sheet appears, disappears or grows with
// feedback. The side panel keeps the prompt and, once it is right, the result (answeredNote).

import { h, clear, question } from '../../core/dom.js';

export class QuestionSheet {
  // relayout: called when the sheet's height changes.
  constructor(mod, relayout) {
    this.el = h('div', { class: 'stage-sheet at-bottom', hidden: true });
    mod.ctx.stage.append(this.el);
    this.relayout = relayout;
    this.key = null;
    this.laidOut = 0;
  }

  // Shows question q under `key`. Showing the same key again keeps the student's wrong answers on screen.
  show(key, q) {
    if (this.key !== key) {
      this.key = key;
      // question() writes its feedback after onAnswer, so measure once the click has been handled.
      const onAnswer = (o) => {
        q.onAnswer?.(o);
        queueMicrotask(() => this.fit());
      };
      clear(this.el).append(question({ ...q, onAnswer }));
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
    clear(this.el);
    this.fit();
  }

  // Canvas height the sheet covers, with its margins.
  space() {
    return this.el.hidden ? 0 : this.el.offsetHeight + 24;
  }

  fit() {
    const s = this.space();
    if (s === this.laidOut) return;
    this.laidOut = s;
    this.relayout();
  }

  remove() {
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
