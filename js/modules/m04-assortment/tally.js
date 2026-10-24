// Observed counts as bars, with a tick at the expected fraction. Rows are [{ label, n, p }].

import { h } from '../../core/dom.js';

export function tallyBars(rows, total) {
  return h(
    'div',
    { class: 'tally' },
    rows.map((r) =>
      h(
        'div',
        { class: 'tally-row' },
        h('span', {}, `${r.label}: ${r.n}`),
        h('div', { class: 'tally-bar' }, h('i', { style: { width: `${total ? (100 * r.n) / total : 0}%` } }), h('em', { style: { left: `${r.p * 100}%` } })),
        h('span', {}, `${total ? ((100 * r.n) / total).toFixed(0) : 0}%`),
      ),
    ),
  );
}
