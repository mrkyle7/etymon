// Finds the perfect route to every ending of every word, and writes them to
// public/routes.js for the game's "score to beat". Run it after changing the
// rules or a word: `node scripts/routes.js` (a few minutes; each word runs in
// its own process). `node scripts/routes.js nice` redoes one word.
//
// A route is each century's move, [x, y, breadth], made as a player could.
// To the real ending it must mean what the word really meant every century;
// to the others, anything goes. It searches centuries in turn, keeping the
// best few routes in every part of the map at every breadth, so it's very
// good but not guaranteed best.
'use strict';

const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'routes.js');
const PER_BUCKET = 6; // routes kept per 10×10 square of the map and breadth

function search(E, li, ending) {
  const L = E.LEVELS[li];
  const real = ending === L.target;
  const step = real ? 2 : 4;
  const points = [];
  for (let x = 0; x <= 100; x += step) for (let y = 0; y <= 100; y += step) points.push([x, y]);
  for (const l of E.landmarks(L)) points.push([l.x, l.y]);
  for (const [x, y] of Object.values(L.fads || {})) points.push([x, y]);
  const reveal = L.eras.length - E.REVEAL;

  let routes = [{ g: E.newGame(li), path: [] }];
  for (let i = 0; i < L.eras.length; i++) {
    const last = i === L.eras.length - 1;
    const best = new Map();
    for (const route of routes) {
      const g = route.g;
      for (const r of [g.r, g.r + E.BROADEN, g.r - E.NARROW]) {
        if (r < E.MIN_BREADTH || r > E.MAX_BREADTH) continue;
        for (const [x, y] of points) {
          if (Math.hypot(x - g.x, y - g.y) > E.REACH) continue;
          const p = E.preview(g, { x, y, r });
          if (real && !p.senses.includes(L.history[i])) continue;
          const speakers = Math.min(400, g.speakers + p.delta);
          if (speakers <= 0) continue;
          const key = `${x},${y},${r}|${p.senses.join(',')}`;
          const seen = best.get(key);
          if (!seen || seen.speakers < speakers) best.set(key, { speakers, route, move: { x, y, r } });
        }
      }
    }
    // Play the moves worth keeping, and keep the best few in every bucket.
    const buckets = new Map();
    for (const b of [...best.values()].sort((a, z) => z.speakers - a.speakers)) {
      const k = `${Math.floor(b.move.x / 10)},${Math.floor(b.move.y / 10)},${b.move.r}`;
      const n = buckets.get(k) || 0;
      if (n >= PER_BUCKET) continue;
      const g = structuredClone(b.route.g);
      E.advance(g, b.move);
      if (i + 1 >= reveal && g.goal !== ending) continue;
      if (last && g.outcome !== 'arrived') continue;
      buckets.set(k, n + 1);
      b.kept = { g, path: [...b.route.path, [b.move.x, b.move.y, b.move.r]] };
    }
    routes = [...best.values()].filter((b) => b.kept).map((b) => b.kept);
    if (!routes.length) return null;
  }
  return routes.sort((a, z) => E.score(z.g) - E.score(a.g))[0].path;
}

if (process.argv[2] === '--word') {
  const E = require('../public/game.js');
  const li = E.LEVELS.findIndex((L) => L.id === process.argv[3]);
  const out = {};
  for (const ending of Object.keys(E.LEVELS[li].endings)) out[ending] = search(E, li, ending);
  process.send(out);
} else {
  const E = require('../public/game.js');
  const words = process.argv.slice(2).length ? process.argv.slice(2) : E.LEVELS.map((L) => L.id);
  const routes = { ...E.ROUTES };
  Promise.all(words.map((id) => new Promise((resolve, reject) => {
    const child = fork(__filename, ['--word', id]);
    child.on('message', (out) => { routes[id] = out; resolve(); });
    child.on('exit', (code) => code && reject(new Error(`${id} failed`)));
  }))).then(() => {
    const ordered = Object.fromEntries(E.LEVELS.map((L) => [L.id, routes[L.id]]).filter(([, r]) => r));
    const body = Object.entries(ordered).map(([id, ends]) => `  ${JSON.stringify(id)}: {\n${
      Object.entries(ends).map(([end, r]) => `    ${JSON.stringify(end)}: ${JSON.stringify(r)},`).join('\n')}\n  },`).join('\n');
    fs.writeFileSync(OUT, `// Made by scripts/routes.js: don't edit by hand.
(function (root, routes) {
  if (typeof module === 'object' && module.exports) module.exports = routes;
  else root.EtymonRoutes = routes;
})(typeof self !== 'undefined' ? self : this, {
${body}
});
`);
    for (const [id, ends] of Object.entries(ordered)) {
      for (const [end, r] of Object.entries(ends)) console.log(id, end, r ? 'found' : 'NO ROUTE');
    }
  });
}
