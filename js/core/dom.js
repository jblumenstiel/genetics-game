// Tiny DOM builder for the side panel.
//   h('button', { class: 'btn', onclick: fn }, 'Label')

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

// A multiple-choice question. Wrong answers explain themselves and can be retried; the first correct answer
// calls onCorrect. Options: [{ label, correct, feedback }].
export function question({ prompt, options, onCorrect, onAnswer, explain, answered = false }) {
  let solved = false;
  const feedback = h('div', { class: 'feedback', role: 'status' });
  const buttons = options.map((opt) => {
    const b = h('button', { class: 'choice', type: 'button' }, opt.label);
    b.addEventListener('click', () => {
      if (solved) return;
      onAnswer?.(opt);
      if (opt.correct) {
        solved = true;
        b.classList.add('right');
        buttons.forEach((x) => (x.disabled = x !== b));
        feedback.className = 'feedback good';
        feedback.textContent = opt.feedback || explain || 'Right.';
        onCorrect?.(opt);
      } else {
        b.classList.add('wrong');
        b.disabled = true;
        feedback.className = 'feedback bad';
        feedback.textContent = opt.feedback || 'Not quite. Try another answer.';
      }
    });
    return b;
  });
  // `answered` draws a question the student already got right: the correct choice selected, with its response.
  if (answered) {
    solved = true;
    // As after a live correct answer: the right choice stays lit, the rest are disabled, and clicks do nothing.
    options.forEach((opt, i) => {
      buttons[i].disabled = !opt.correct;
      if (opt.correct) buttons[i].classList.add('right');
    });
    const right = options.find((o) => o.correct);
    feedback.className = 'feedback good';
    feedback.textContent = right?.feedback || explain || 'Right.';
  }
  return h('div', { class: 'question' }, h('p', { class: 'prompt' }, prompt), h('div', { class: 'choices' }, buttons), feedback);
}
