// Step A: two pairs of homologs line up at Metaphase I, and each pair orients independently of the other. Two
// bivalents give two distinct alignments, and each alignment makes two kinds of gametes: four in all.

import { h, clear, question } from '../../core/dom.js';
import { fraction } from '../../engine/cross.js';
import { metaphaseIAlignments, dihybridGametes, gameteLabel } from '../../engine/dihybrid.js';
import { genesOf } from './instance.js';

export class OrientationStep {
  constructor(mod) {
    this.mod = mod;
    this.inst = mod.inst;
    this.parent = this.inst.mother;
    this.genes = genesOf(this.inst, this.parent);
    this.alignments = metaphaseIAlignments(this.genes);
    this.kinds = dihybridGametes(this.genes).map((g) => gameteLabel(this.genes, g.alleles));
  }

  enter(container, body) {
    this.body = body;
    this.renderPanel();
  }

  exit() {
    this.exited = true;
  }

  get answered() {
    return this.mod.state.answered;
  }

  ask(body, key, q) {
    body.append(
      question({
        ...q,
        onCorrect: () => {
          this.answered.add(key);
          setTimeout(() => !this.exited && this.renderPanel(), 900);
        },
      }),
    );
  }

  renderPanel() {
    const body = clear(this.body);
    const { name, label } = this.parent;
    const [t1, t2] = this.inst.traits;
    const n = this.alignments.length;
    body.append(
      h('h2', {}, 'Two pairs at Metaphase I'),
      h(
        'p',
        {},
        `${name} is ${label}. One chromosome pair carries the ${t1.name.toLowerCase()} gene and a second pair carries the ${t2.name.toLowerCase()} gene. At Meiosis: Metaphase I, each pair lines up across the plate as a bivalent, and which homolog faces which pole is random.`,
      ),
    );

    if (!this.answered.has('orientation:alignments')) {
      this.ask(body, 'orientation:alignments', {
        prompt: 'Counting mirror images as the same, how many different alignments of the two bivalents are possible at Metaphase I?',
        options: [1, 2, 4].map((k) => ({
          label: String(k),
          correct: k === n,
          feedback:
            k === n
              ? `Right. Hold the first bivalent still: the second can face the same way or the opposite way. Flipping both at once is the same alignment seen from the other side, so there are ${n}, each with probability ${fraction(1 / n)}.`
              : k < n
                ? 'The two bivalents orient independently, so the second pair does not have to copy the first.'
                : 'That counts each alignment twice. Flipping both bivalents at once gives the same alignment seen from the other side.',
        })),
      });
      return;
    }

    body.append(h('p', { class: 'hint' }, `✓ ${n} alignments, each with probability ${fraction(1 / n)}.`), this.table());

    if (!this.answered.has('orientation:kinds')) {
      const k = this.kinds.length;
      this.ask(body, 'orientation:kinds', {
        prompt: `Under normal meiosis, how many genetically different kinds of gametes can ${name} (${label}) make?`,
        options: [2, 4, 8].map((x) => ({
          label: String(x),
          correct: x === k,
          feedback:
            x === k
              ? `Right. Each alignment makes two kinds, and the two alignments make different kinds: ${this.kinds.join(', ')}.`
              : x < k
                ? 'One alignment makes 2 kinds of gametes, but the other alignment, equally likely, makes 2 different kinds.'
                : 'A gamete carries one allele of each of the 2 genes, so there are 2 × 2 combinations.',
        })),
      });
      return;
    }

    this.mod.complete('orientation');
    body.append(
      h('p', { class: 'hint' }, `✓ ${this.kinds.length} kinds of gametes: ${this.kinds.join(', ')}.`),
      h(
        'div',
        { class: 'callout' },
        h('b', {}, 'Independent assortment'),
        'Genes on different chromosomes segregate independently at Meiosis I: how one pair lines up says nothing about how the other pair lines up. So every combination of one allele from each gene is equally likely in the gametes.',
      ),
      h('button', { class: 'btn primary', onclick: () => this.mod.next() }, 'Continue: gametes ▶'),
    );
  }

  // Each alignment sends one set of alleles to each pole. After Meiosis II each set ends up in two gametes.
  table() {
    return h(
      'table',
      { class: 'arrangements' },
      h('tr', {}, h('th', {}, 'Alignment'), h('th', {}, 'One pole gets'), h('th', {}, 'The other pole gets')),
      this.alignments.map((a, i) =>
        h(
          'tr',
          {},
          h('td', {}, String(i + 1)),
          a.poles.map((alleles) => h('td', {}, gameteLabel(this.genes, alleles))),
        ),
      ),
      h('caption', { style: { captionSide: 'bottom', textAlign: 'left', fontSize: '13px', paddingTop: '6px' } }, 'After Meiosis II, each pole’s set of alleles ends up in two of the four gametes.'),
    );
  }
}
