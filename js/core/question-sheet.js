// A multiple-choice question on the main page. Where it sits depends on the window:
//   side:   wide windows. A column between the canvas and the panel, so the picture keeps its full height; the
//           canvas narrows while the sheet shows, and the step lays out again through its usual resize.
//   bottom: medium windows. Over the bottom of the canvas; the step lays its picture out above it (space()) and is
//           told to lay out again when the sheet appears, disappears or grows with feedback.
//   below:  stacked layouts (phones). Between the canvas and the panel, in the page's flow.
// The side panel keeps the prompt and, once it is right, the result (answeredNote). A question the student got right
// stays in the sheet, its answer selected, until the step moves on (next question, next action or page).

import { h, clear, question } from './dom.js';

// Match the CSS: the panel moves under the canvas at STACKED, and the side column appears at SIDE.
const STACKED = '(max-width: 860px)';
const SIDE = '(min-width: 1150px)';

export class QuestionSheet {
  // relayout: called when the sheet's height over the canvas changes. reserve: keep the side column while the step
  // is open, even with no question showing, so the picture keeps one width (Module 1's meiosis stages).
  constructor(mod, relayout, { reserve = false } = {}) {
    this.el = h('div', { class: 'stage-sheet at-bottom', hidden: true });
    this.stage = mod.ctx.stage;
    this.reserve = reserve;
    this.stacked = window.matchMedia(STACKED);
    this.wide = window.matchMedia(SIDE);
    this.onWindow = () => {
      this.place();
      this.fit();
    };
    this.stacked.addEventListener('change', this.onWindow);
    this.wide.addEventListener('change', this.onWindow);
    this.place();
    this.relayout = relayout;
    this.key = null;
    this.answeredKey = null;
    this.laidOut = 0;
  }

  // Shows question q under `key`. Showing the same key again keeps the student's wrong answers on screen.
  // answered: draw it already right. next: one or more { label, onClick } buttons under an answered question, the
  // same moves the panel offers (Next question, Continue to the next step, ...); the first is the primary one.
  show(key, q, { answered = false, next = [] } = {}) {
    const buttons = answered ? [].concat(next ?? []) : [];
    const state = `${key}:${answered}:${buttons.map((b) => b.label).join('|')}`;
    this.asked = true;
    this.answeredKey = answered ? key : null;
    if (this.key !== state) {
      this.key = state;
      // question() writes its feedback after onAnswer, so measure once the click has been handled.
      const onAnswer = (o) => {
        q.onAnswer?.(o);
        queueMicrotask(() => this.fit());
      };
      clear(this.el).append(question({ ...q, onAnswer, answered }));
      if (buttons.length) {
        this.el.append(
          h(
            'div',
            { class: 'row sheet-next' },
            buttons.map((b, i) => h('button', { class: i === 0 ? 'btn primary' : 'btn', type: 'button', onclick: b.onClick }, b.label)),
          ),
        );
      }
      // Sentence-long choices stack full width in smaller type; short ones (½, 3 : 1) sit side by side.
      this.el.classList.toggle('wordy', q.options.some((o) => o.label.length > 12));
    }
    this.el.hidden = false;
    this.syncColumn();
    this.fit();
  }

  // The usual flow for one question of a step's set. Not yet right: the question here and a pointer in the panel.
  // Right: the panel records it, and it stays here with "Next question ▶" under it, or for the last of a set the
  // step's way on (`proceed`, the same buttons the panel shows). Returns true once the student is past it, so a step
  // can chain its questions. state: { answered, seen } sets; rerender: redraws the step.
  ask(body, { key, q, state, rerender, onRight, proceed = null, pointer = 'Each answer you get right is recorded here.' }) {
    if (state.answered.has(key)) {
      body.append(answeredNote(q));
      if (state.seen.has(key)) return true;
      const nextQuestion = {
        label: 'Next question ▶',
        onClick: () => {
          state.seen.add(key);
          rerender();
        },
      };
      this.show(key, q, { answered: true, next: proceed ?? [nextQuestion] });
      return !!proceed;
    }
    const onCorrect = () => {
      state.answered.add(key);
      onRight?.();
      rerender();
    };
    this.show(key, { ...q, onCorrect });
    body.append(sheetPointer(pointer));
    return false;
  }

  // A step marks the start and end of drawing its panel; a sheet nothing was shown in during it is hidden.
  begin() {
    this.asked = false;
  }

  end() {
    if (!this.asked) this.hide();
  }

  // Shows a form the step builds itself (the Detective's genotype pickers). It is redrawn each time, since the step
  // owns its state.
  showForm(...nodes) {
    this.asked = true;
    this.key = null;
    this.answeredKey = null;
    clear(this.el).append(...nodes);
    this.el.classList.remove('wordy');
    this.el.hidden = false;
    this.syncColumn();
    this.fit();
  }

  hide() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.key = null;
    this.answeredKey = null;
    clear(this.el);
    this.syncColumn();
    this.fit();
  }

  place() {
    this.mode = this.stacked.matches ? 'below' : this.wide.matches ? 'side' : 'bottom';
    if (this.mode === 'bottom') this.stage.append(this.el);
    else this.stage.after(this.el);
    this.el.classList.toggle('below', this.mode === 'below');
    this.el.classList.toggle('side', this.mode === 'side');
    this.syncColumn();
  }

  // The page grows a column for the side sheet only while it is in use, so other steps keep the full width.
  syncColumn() {
    const on = this.mode === 'side' && (!this.el.hidden || this.reserve);
    this.stage.parentNode?.classList.toggle('with-side', on);
  }

  // Whether the sheet sits over the canvas (bottom mode), so the picture must leave room for it.
  covers() {
    return this.mode === 'bottom';
  }

  // Canvas height the sheet covers, with its margins.
  space() {
    return this.el.hidden || !this.covers() ? 0 : this.el.offsetHeight + 24;
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
    this.stacked.removeEventListener('change', this.onWindow);
    this.wide.removeEventListener('change', this.onWindow);
    this.el.remove();
    this.reserve = false;
    this.mode = null;
    this.stage.parentNode?.classList.remove('with-side');
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
