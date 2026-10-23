// Boots Pixi once and routes between the hub (#/) and modules (#/m/<id>?seed=<n>).
// The single canvas moves between the hub hero and the module stage.

import { UNITS, findModule, unitLabel } from './modules/registry.js';
import { Tweener } from './core/tween.js';
import { makeRng, randomSeed, pick } from './core/rng.js';
import { h, clear } from './core/dom.js';
import { PALETTE } from './core/palette.js';
import { Creature } from './render/creature.js';
import { SPECIES, TRAITS, creatureFeatures } from './species/catalog.js';
import { allGenotypes } from './engine/cross.js';

await Promise.all([document.fonts.load('700 16px Nunito'), document.fonts.load('600 16px Fraunces')]).catch(() => {});

const app = new PIXI.Application();
await app.init({
  background: PALETTE.paper,
  antialias: true,
  resolution: Math.min(2, window.devicePixelRatio || 1),
  autoDensity: true,
});
app.canvas.style.display = 'block';

const els = {
  heroStage: document.getElementById('hero-stage'),
  units: document.getElementById('units'),
  stage: document.getElementById('stage'),
  panel: document.getElementById('panel'),
  crumbs: document.getElementById('crumbs'),
};

let current = null;
let observer = null;

function host(el, background) {
  el.appendChild(app.canvas);
  app.renderer.background.color = background;
  app.resizeTo = el;
  observer?.disconnect();
  observer = new ResizeObserver(() => {
    app.resize();
    current?.resize?.(app.screen.width, app.screen.height);
  });
  observer.observe(el);
  app.resize();
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(query) };
}

function teardown() {
  current?.destroy();
  current = null;
  app.stage.removeChildren().forEach((c) => c.destroy({ children: true }));
}

let routeToken = 0;

async function route() {
  routeToken++;
  teardown();
  const { parts, params } = parseHash();
  if (parts[0] === 'm' && parts[1]) {
    const entry = findModule(parts[1]);
    if (entry?.load) return showModule(entry, params);
  }
  showHub();
}

// Hub

function randomCreature(rng, species) {
  const traits = Object.values(TRAITS);
  const chosen = [pick(rng, traits)];
  const second = pick(rng, traits.filter((t) => t.id !== chosen[0].id && !(t.id === 'pattern' && chosen[0].id === 'spots')));
  chosen.push(second);
  const phenos = chosen.map((t) => t.express(pick(rng, allGenotypes(t))));
  return creatureFeatures(species, phenos);
}

function showHub() {
  document.body.dataset.view = 'hub';
  document.title = 'Bdellbee Genetics';
  clear(els.crumbs);
  host(els.heroStage, 0xebe3d4);

  const rng = makeRng(randomSeed());
  const root = new PIXI.Container();
  app.stage.addChild(root);
  const species = [SPECIES.gorby, SPECIES.glubbin, SPECIES.chomny];
  const creatures = species.map((s) => {
    const c = new Creature(randomCreature(rng, s), { size: 110 });
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointertap', () => c.setFeatures(randomCreature(rng, s)));
    root.addChild(c);
    return c;
  });
  const names = species.map((s) => {
    const t = new PIXI.Text({ text: s.name, style: { fontFamily: 'Nunito', fontWeight: '800', fontSize: 15, fill: PALETTE.inkSoft }, resolution: 2 });
    t.anchor.set(0.5, 0);
    root.addChild(t);
    return t;
  });
  const layout = (w, hgt) => {
    const size = Math.min(110, w / 5.4, hgt * 0.42);
    creatures.forEach((c, i) => {
      c.position.set((w * (i + 1)) / 4, hgt * 0.46);
      if (c.size !== size) {
        c.size = size;
        c.setFeatures(c.features);
      }
      names[i].position.set(c.x, c.y + size * 0.62);
    });
  };
  layout(app.screen.width, app.screen.height);

  clear(els.units);
  for (const unit of UNITS) {
    els.units.append(
      h(
        'section',
        { class: 'unit' },
        h(
          'div',
          { class: 'unit-head' },
          h('h2', {}, unit.bare ? unit.title : `${unitLabel(unit)}. ${unit.title}`),
          h('span', {}, `${unit.modules.length} module${unit.modules.length === 1 ? '' : 's'}`),
        ),
        h(
          'div',
          { class: 'cards' },
          unit.modules.map((m) =>
            h(
              'article',
              { class: `card ${m.load ? 'ready' : 'planned'}` },
              h('div', { class: 'num' }, `MODULE ${m.n}`),
              h('h3', {}, m.title),
              h('p', {}, m.blurb),
              h(
                'div',
                { class: 'card-foot' },
                h('span', { class: 'tags' }, m.exam ? h('span', { class: 'tag' }, 'Exam I topic') : null, m.underConstruction ? h('span', { class: 'tag construction' }, 'Under construction') : null),
                m.load ? h('a', { class: 'btn primary small', href: `#/m/${m.id}` }, 'Play') : h('span', { class: 'tag planned' }, 'Planned'),
              ),
            ),
          ),
        ),
      ),
    );
  }

  current = {
    resize: layout,
    destroy() {
      creatures.forEach((c) => c.destroy());
    },
  };
}

// Modules

async function showModule(entry, params) {
  let seed = Number(params.get('seed'));
  if (!Number.isFinite(seed) || seed <= 0) {
    seed = randomSeed() || 1;
    history.replaceState(null, '', `#/m/${entry.id}?seed=${seed}`);
  }
  document.body.dataset.view = 'module';
  document.title = `${entry.title} · Bdellbee Genetics`;
  clear(els.crumbs).append(h('a', { href: '#/' }, 'All modules'), h('span', {}, '›'), h('span', { class: 'crumb-unit' }, unitLabel(entry.unit)), h('span', { class: 'crumb-unit' }, '›'), h('span', {}, `Module ${entry.n}`));
  host(els.stage, PALETTE.paper);
  clear(els.panel);

  const token = routeToken;
  const mod = (await entry.load()).default;
  if (token !== routeToken) return;
  const root = new PIXI.Container();
  app.stage.addChild(root);
  const tween = new Tweener(app.ticker);
  const instance = mod.mount({
    app,
    root,
    panel: els.panel,
    // The element behind the canvas, for HTML that sits on the main page (a form is easier to use as HTML).
    stage: els.stage,
    seed,
    rng: makeRng(seed),
    tween,
    entry,
    size: () => ({ w: app.screen.width, h: app.screen.height }),
    newSeed: () => {
      location.hash = `#/m/${entry.id}?seed=${randomSeed() || 1}`;
    },
  });
  current = {
    resize: (w, hgt) => instance.resize?.(w, hgt),
    destroy() {
      instance.destroy?.();
      tween.destroy();
      clear(els.panel);
    },
  };
}

window.addEventListener('hashchange', route);
route();
