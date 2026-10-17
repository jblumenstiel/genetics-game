// Minimal promise-based tweening on the Pixi ticker. Works on any object with numeric properties, including
// Pixi display objects, their .scale / .position points, and plain records like membrane ellipses.

export const EASE = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
};

export class Tweener {
  constructor(ticker) {
    this.ticker = ticker;
    this.tweens = new Set();
    this.tick = (t) => this.update(t.deltaMS);
    ticker.add(this.tick);
  }

  to(target, props, { duration = 600, ease = 'inOutCubic', delay = 0 } = {}) {
    return new Promise((resolve) => {
      this.tweens.add({
        target,
        props,
        from: null,
        duration: Math.max(1, duration),
        delay,
        elapsed: 0,
        ease: typeof ease === 'function' ? ease : EASE[ease],
        resolve,
      });
    });
  }

  wait(ms) {
    return this.to({}, {}, { duration: ms });
  }

  update(dt) {
    for (const tw of [...this.tweens]) {
      if (tw.target.destroyed) {
        this.tweens.delete(tw);
        tw.resolve();
        continue;
      }
      tw.elapsed += dt;
      const t0 = tw.elapsed - tw.delay;
      if (t0 < 0) continue;
      if (!tw.from) {
        tw.from = {};
        for (const k in tw.props) tw.from[k] = tw.target[k];
      }
      const t = Math.min(1, t0 / tw.duration);
      const e = tw.ease(t);
      for (const k in tw.props) tw.target[k] = tw.from[k] + (tw.props[k] - tw.from[k]) * e;
      if (t >= 1) {
        this.tweens.delete(tw);
        tw.resolve();
      }
    }
  }

  // Stop tweens on a target, leaving it where it is.
  kill(target) {
    for (const tw of [...this.tweens]) {
      if (tw.target === target) {
        this.tweens.delete(tw);
        tw.resolve();
      }
    }
  }

  killAll() {
    for (const tw of this.tweens) tw.resolve();
    this.tweens.clear();
  }

  destroy() {
    this.killAll();
    this.ticker.remove(this.tick);
  }
}
