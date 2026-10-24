'use strict';

const test = require('node:test');
const assert = require('node:assert');
const E = require('../public/game.js');

const senseNames = (L) => new Set(E.landmarks(L).map((l) => l.name));

test('every word is well formed: its senses, centuries and history', () => {
  for (const L of E.LEVELS) {
    const names = senseNames(L);
    assert.ok(names.has(L.start), `${L.id}: start`);
    assert.ok(names.has(L.target), `${L.id}: target`);
    assert.strictEqual(L.history.length, L.eras.length, `${L.id}: a history step per century`);
    for (const h of L.history) assert.ok(names.has(h), `${L.id}: history ${h}`);
    L.eras.forEach(([year, needed, form, clue, scorned, [alt, altClue], scornClue], i) => {
      assert.ok(altClue && alt.length === 2, `${L.id} ${year}: a second pair it might want, with its clue`);
      for (const n of alt) {
        assert.ok(E.landmarks(L, year).some((l) => l.name === n), `${L.id} ${year}: ${n} exists by then`);
        assert.ok(!scorned.includes(n), `${L.id} ${year}: ${n} isn't both wanted and out of fashion`);
      }
      assert.ok(Number.isInteger(year) && form && clue, `${L.id}: ${year}`);
      assert.ok(scorned.length, `${L.id} ${year}: scorns something`);
      assert.ok(scornClue, `${L.id} ${year}: a clue to what's out of fashion`);
      for (const n of scorned) {
        assert.ok(E.landmarks(L, year).some((l) => l.name === n), `${L.id} ${year}: scorned ${n} exists by then`);
        assert.ok(!needed.includes(n), `${L.id} ${year}: ${n} isn't both wanted and scorned`);
        assert.notStrictEqual(L.history[i], n, `${L.id} ${year}: history doesn't head for a scorned sense`);
      }
      for (const n of needed) {
        assert.ok(names.has(n), `${L.id} ${year}: needs ${n}`);
        assert.ok(E.landmarks(L, year).some((l) => l.name === n), `${L.id} ${year}: ${n} exists by then`);
      }
    });
    for (const l of E.landmarks(L)) {
      assert.ok(l.x >= 0 && l.x <= 100 && l.y >= 0 && l.y <= 100, `${L.id}: ${l.name} on the map`);
      assert.ok(l.quote, `${L.id}: ${l.name} has a quote`);
    }
    assert.ok(L.endings[L.target], `${L.id}: the real ending is an ending`);
    assert.ok(Object.keys(L.endings).length >= 3, `${L.id}: several endings`);
    for (const name of Object.keys(L.endings)) {
      assert.ok(names.has(name), `${L.id}: ending ${name} is a sense`);
      assert.ok(L.endings[name].text, `${L.id}: ending ${name} has its story`);
    }
    for (const [name, [x, y, quote, after]] of Object.entries(L.fads)) {
      assert.ok(!names.has(name), `${L.id}: fad ${name} isn't already a sense`);
      assert.ok(names.has(after) && quote && x >= 0 && x <= 100 && y >= 0 && y <= 100, `${L.id}: fad ${name}`);
    }
  }
});

test('history itself survives and arrives, every word', () => {
  E.LEVELS.forEach((L, i) => {
    const h = E.historyGame(i);
    assert.strictEqual(h.outcome, 'arrived', L.id);
    assert.ok(E.score(h) > E.ARRIVAL_BONUS, L.id);
  });
});

test('every ending has a perfect route, of moves a player could make', () => {
  E.LEVELS.forEach((L, i) => {
    for (const ending of Object.keys(L.endings)) {
      const route = E.ROUTES[L.id][ending];
      assert.strictEqual(route.length, L.eras.length, `${L.id} ${ending}: a move per century (run scripts/routes.js)`);
      const g = E.newGame(i);
      route.forEach(([x, y, r], c) => {
        const at = `${L.id} ${ending} ${L.eras[c][0]}`;
        assert.ok(Math.hypot(x - g.x, y - g.y) <= E.REACH, `${at}: within reach`);
        assert.ok([g.r, g.r + E.BROADEN, g.r - E.NARROW].includes(r), `${at}: same, broadened or narrowed`);
        assert.deepStrictEqual(E.constrain(g, { x, y, r }), { x, y, r }, `${at}: unclamped`);
        const p = E.advance(g, { x, y, r });
        if (ending === L.target) assert.ok(p.senses.includes(L.history[c]), `${at}: holds ${L.history[c]}`);
      });
      assert.strictEqual(g.goal, ending, `${L.id} ${ending}: leads there`);
      assert.strictEqual(g.outcome, 'arrived', `${L.id} ${ending}: arrives`);
    }
  });
});

test('the ending depends on how closely the journey followed history', () => {
  const L = E.LEVELS[0];
  const reveal = L.eras.length - E.REVEAL;
  const true_ = E.newGame(0);
  for (let i = 0; i < reveal; i++) {
    assert.strictEqual(true_.goal, null, 'unknown until the last centuries');
    E.advance(true_, { x: true_.x, y: true_.y, r: true_.r });
  }
  // Staying put on "ignorant" and "foolish" means what nice really meant only in 1300.
  assert.strictEqual(E.faithful(true_), 1);
  assert.notStrictEqual(true_.goal, L.target);
  assert.strictEqual(true_.goal, 'foolish', 'the other ending nearest you');
  const real = E.perfectGame(0);
  assert.strictEqual(E.faithful(real), L.eras.length);
  assert.strictEqual(real.goal, L.target);
});

test('fads sprout beside what you carried, pay once, then go out of fashion', () => {
  const g = E.newGame(0);
  E.advance(g, { x: 32, y: 12, r: 10 }); // wanton
  assert.deepStrictEqual(g.log[0].sprouted, ['lecherous']);
  assert.deepStrictEqual(E.fadNow(g), ['lecherous']);
  assert.ok(g.seen.includes('lecherous'));
  const [x, y] = E.LEVELS[0].fads.lecherous;
  const fad = E.preview(g, { x, y, r: 5 }).reasons.find((r) => r.sense === 'lecherous');
  assert.ok(fad.fad && fad.amount === E.FAD);
  E.advance(g, { x, y, r: g.r });
  E.advance(g, { x, y, r: g.r });
  assert.ok(E.scornedNow(g).includes('lecherous'), 'out of fashion two centuries on');
  assert.strictEqual(E.preview(g, { x, y, r: 5 }).reasons.find((r) => r.sense === 'lecherous').amount, -E.SCORN);
});

test('moves are limited to the reach, the map, and the breadth change', () => {
  const g = E.newGame(0);
  const m = E.constrain(g, { x: g.x + 100, y: g.y, r: 99 });
  assert.ok(Math.hypot(m.x - g.x, m.y - g.y) <= E.REACH + 0.1);
  assert.strictEqual(m.r, g.r + E.BROADEN);
  assert.strictEqual(E.constrain(g, { x: g.x, y: g.y, r: 6 }).r, g.r - E.NARROW, 'narrowing is slow');
  assert.ok(E.NARROW < E.BROADEN);
  assert.strictEqual(E.constrain({ ...g, x: 2, y: 2 }, { x: -50, y: -50, r: 0 }).x, 0);
  assert.ok(E.constrain(g, { x: g.x, y: g.y, r: 0 }).r >= E.MIN_BREADTH);
});

test('the preview is exactly what the century does', () => {
  const g = E.newGame(1);
  const move = { x: g.x + 12, y: g.y + 10, r: g.r + 4 };
  const p = E.preview(g, move);
  const before = g.speakers;
  E.advance(g, move);
  assert.strictEqual(g.speakers, before + p.delta);
  assert.deepStrictEqual({ x: g.x, y: g.y, r: g.r }, p.move);
});

test('needed senses pay more, scorned ones cost, as do vagueness and emptiness', () => {
  const g = E.newGame(0);
  const L = E.LEVELS[0];
  const at = (name) => E.landmarks(L).find((l) => l.name === name);
  g.x = at('foolish').x; g.y = at('foolish').y; g.r = 5;
  const needed = E.preview(g, { x: g.x, y: g.y, r: 5 }).reasons.find((r) => r.sense === 'foolish');
  g.x = at('strange').x; g.y = at('strange').y;
  const plain = E.preview(g, { x: g.x, y: g.y, r: 5 }).reasons.find((r) => r.sense === 'strange');
  assert.ok(needed.needed && needed.amount > plain.amount);

  const start = E.newGame(0);
  assert.deepStrictEqual(E.scornedNow(start), ['shy', 'effeminate']);
  assert.ok(start.seen.includes('shy'), 'out of fashion senses are always visible');
  const scorned = E.preview(start, { x: at('shy').x, y: at('shy').y, r: 5 }).reasons.find((r) => r.sense === 'shy');
  assert.ok(scorned.scorned && scorned.amount === -E.SCORN && scorned.ifWanted === -E.SCORN);

  const empty = E.newGame(0);
  empty.x = 95; empty.y = 5; empty.r = 5;
  assert.ok(E.preview(empty, { x: 95, y: 5, r: 5 }).reasons.some((r) => /nobody knows/.test(r.text)));

  const vague = E.newGame(0);
  vague.x = 40; vague.y = 40; vague.r = 30;
  assert.ok(E.preview(vague, { x: 40, y: 40, r: 30 }).reasons.some((r) => /too vague/.test(r.text)));
});

test('a word nobody says becomes obsolete', () => {
  const g = E.newGame(0);
  g.speakers = 15;
  E.advance(g, { x: 95, y: 5 });
  // Out where nothing is meant: −20 for meaninglessness and −10 forgetting.
  E.advance(g, { x: 95, y: 5 });
  assert.strictEqual(g.outcome, 'obsolete');
  assert.strictEqual(E.score(g), 0);
});

test('narrowing words must be narrow to arrive', () => {
  const i = E.LEVELS.findIndex((L) => L.id === 'girl');
  const L = E.LEVELS[i];
  const max = L.endings[L.target].maxBreadth;
  const t = E.landmarks(L).find((l) => l.name === L.target);
  const g = E.newGame(i);
  assert.ok(!E.reachedTarget(g, { x: t.x, y: t.y, r: max }), 'not before the ending is known');
  g.goal = L.target;
  assert.ok(!E.reachedTarget(g, { x: t.x, y: t.y, r: max + 1 }));
  assert.ok(E.reachedTarget(g, { x: t.x, y: t.y, r: max }));
});

test('drifting with purpose beats staying put', () => {
  E.LEVELS.forEach((L, i) => {
    const stay = E.newGame(i);
    while (!stay.over) E.advance(stay, { x: stay.x, y: stay.y, r: stay.r });
    assert.ok(!(stay.outcome === 'arrived' && stay.goal === L.target), `${L.id}: staying put never becomes the real word`);
    assert.ok(E.score(E.perfectGame(i, stay.goal)) > E.score(stay), `${L.id}: even its own ending`);
    assert.ok(E.score(E.historyGame(i)) > E.score(stay), L.id);
  });
});

test('the forecast brackets what the century really does', () => {
  E.LEVELS.forEach((L, i) => {
    const g = E.newGame(i);
    while (!g.over) {
      const move = { x: g.x + 7, y: g.y + 5, r: g.r };
      const p = E.preview(g, move);
      assert.ok(p.range[0] <= p.delta && p.delta <= p.range[1], `${L.id} ${E.eraOf(g)[0]}`);
      E.advance(g, move);
    }
  });
});

test('senses appear in their century, and far ones stay unseen until you get near', () => {
  const L = E.LEVELS[0];
  assert.ok(!E.landmarks(L, 1300).some((l) => l.name === 'sarcastic'));
  assert.ok(E.landmarks(L, 1900).some((l) => l.name === 'sarcastic'));
  const g = E.newGame(0);
  assert.ok(!g.seen.includes(L.target), 'where you are going is hidden too');
  assert.ok(g.seen.includes('foolish'), 'near senses are seen');
  assert.ok(!g.seen.includes('kind'), 'far senses are not');
  // The history route ends up seeing where it went.
  const h = E.historyGame(0);
  for (const name of L.history) assert.ok(h.seen.includes(name), name);
});

test('the log tells you afterwards what each century wanted', () => {
  const g = E.newGame(2);
  E.advance(g, { x: g.x, y: g.y });
  assert.deepStrictEqual(g.log[0].wanted, E.LEVELS[2].eras[0][1]);
});

test('each century wants what is nearer your word, so the clues follow your path', () => {
  const L = E.LEVELS[0];
  const near = E.newGame(0);
  assert.strictEqual(E.clueNow(near), L.eras[0][3]);
  const at = (name) => E.landmarks(L).find((l) => l.name === name);
  const far = E.newGame(0);
  far.x = at('strange').x; far.y = at('strange').y;
  E.advance(far, { x: far.x, y: far.y }); // 1300 passes near strange and coy
  assert.deepStrictEqual(far.log[0].wanted, L.eras[0][1], 'chosen when the century began');
  // 1400 begins near strange: it wants strange and delicate.
  assert.deepStrictEqual(E.wantedNow(far), L.eras[1][5][0]);
  assert.strictEqual(E.clueNow(far), L.eras[1][5][1]);
});

test('nice starts out meaning both ignorant and foolish, as its story says', () => {
  const g = E.newGame(0);
  assert.deepStrictEqual(E.preview(g, { x: g.x, y: g.y, r: g.r }).senses.sort(), ['foolish', 'ignorant']);
});

test('the best move is one you could make, and no move you could make beats it', () => {
  E.LEVELS.forEach((L, i) => {
    const g = E.newGame(i);
    const best = E.bestMove(g);
    assert.deepStrictEqual(E.constrain(g, best.move), best.move, `${L.id}: a legal move`);
    for (let dx = -E.REACH; dx <= E.REACH; dx += 5) {
      for (let dy = -E.REACH; dy <= E.REACH; dy += 5) {
        assert.ok(E.preview(g, { x: g.x + dx, y: g.y + dy, r: g.r }).delta <= best.delta, `${L.id}: ${dx},${dy}`);
      }
    }
  });
  assert.strictEqual(E.grade(29, 29), 'best');
  assert.strictEqual(E.grade(20, 29), 'good');
  assert.strictEqual(E.grade(5, 29), 'fair');
  assert.strictEqual(E.grade(-7, 29), 'poor');
});
