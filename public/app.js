// Etymon's page: draws the map of meaning from public/game.js and handles taps.
(function () {
  'use strict';
  const E = window.Etymon;
  const $ = (id) => document.getElementById(id);
  const SVG = 'http://www.w3.org/2000/svg';
  const BEST_KEY = 'etymon-best';
  const ENDINGS_KEY = 'etymon-endings';
  // Your speakers are a crowd of dots in your circle, one per PER_PERSON.
  const PER_PERSON = 5;
  const CROWD_MAX = 120;
  const REPLAY_STEP = 1100; // ms per century

  let game;
  let ghost; // where you're thinking of drifting: { x, y, r }
  let people = []; // the crowd's dots, innermost first
  let leftBehind = []; // dots who left you last century, standing where they went
  let newcomers = 0; // how many of the crowd, at its end, arrived last century
  let replay = null; // { step, timer } while the replay plays
  let revealed = false; // whether the player has asked to see the best route
  let shuffledFor = null; // the century whose events were last put in order

  function svg(tag, attrs = {}, text) {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    node.append(...children);
    return node;
  }

  function stored(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private window */ }
  }
  function saveBest(id, score) {
    const b = stored(BEST_KEY);
    if (b[id] !== undefined && b[id] >= score) return false;
    b[id] = score;
    store(BEST_KEY, b);
    return true;
  }
  // The endings you've found for each word, like a set to collect.
  function saveEnding(id, ending) {
    const found = stored(ENDINGS_KEY);
    found[id] = [...new Set([...(found[id] || []), ending])];
    store(ENDINGS_KEY, found);
    return found[id];
  }

  const level = () => E.LEVELS[game.levelIndex];
  // The answer: the perfect route to the ending you got, or to the real one.
  const answerGame = () => E.perfectGame(game.levelIndex, game.goal || level().target);
  const signed = (n) => (n > 0 ? `+${n}` : String(n));
  const words = (names, bold = []) => names.flatMap((w, i) => [i ? (i === names.length - 1 ? ' and ' : ', ') : '',
    el(bold.includes(w) ? 'strong' : 'span', {}, w)]);
  // What you mean where you stand now.
  const meaningNow = () => E.preview(game, { x: game.x, y: game.y, r: game.r }).senses;

  // Play a word: the game takes the whole screen.
  function start(levelIndex) {
    stopReplay();
    game = E.newGame(levelIndex);
    ghost = { x: game.x, y: game.y, r: game.r };
    $('result').hidden = true;
    $('blurb').textContent = level().blurb;
    $('crowd').replaceChildren();
    $('floats').replaceChildren();
    people = [];
    leftBehind = [];
    shuffledFor = null;
    newcomers = 0;
    revealed = false;
    $('menu').hidden = true;
    $('game').hidden = false;
    $('game-word').textContent = level().word;
    const root = document.documentElement;
    if (root.requestFullscreen && !document.fullscreenElement) root.requestFullscreen().catch(() => {});
    render();
    updateCrowd();
  }

  function showMenu() {
    stopReplay();
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    $('game').hidden = true;
    $('menu').hidden = false;
    renderWords();
  }

  // The start screen: a card for each word, with your best and the endings you've found.
  function renderWords() {
    const b = stored(BEST_KEY);
    const found = stored(ENDINGS_KEY);
    $('words').replaceChildren(...E.LEVELS.map((L, i) => el('button', {
      type: 'button', class: 'word-card', onclick: () => start(i),
    }, el('span', { class: 'w' }, L.word), el('span', { class: 'b' }, L.blurb),
    el('span', { class: 'meta' }, `${(found[L.id] || []).length} of ${Object.keys(L.endings).length} endings found`,
      b[L.id] !== undefined ? ` · best ${b[L.id]}` : ''))));
  }

  function path(points) {
    return points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  }

  function renderMap() {
    const L = level();
    const era = E.eraOf(game);
    const fads = game.over ? [] : E.fadNow(game);
    const mine = game.over ? [] : meaningNow();
    const p = E.preview(game, ghost);
    const below = [];
    const above = [];
    // The best route shows only once the player asks for the answer.
    const real = game.over && revealed ? answerGame() : null;
    // During the replay, both journeys up to this century.
    const upTo = replay ? replay.step + 1 : Infinity;

    for (let v = 0; v <= 100; v += 25) {
      below.push(svg('line', { class: 'grid', x1: v, y1: 0, x2: v, y2: 100 }));
      below.push(svg('line', { class: 'grid', x1: 0, y1: v, x2: 100, y2: v }));
    }
    if (real) {
      const steps = real.trail.slice(0, upTo);
      if (!replay) for (const t of steps.slice(1)) below.push(svg('circle', { class: 'history-step', cx: t.x, cy: t.y, r: t.r }));
      below.push(svg('path', { class: 'history', d: path(steps) }));
    }
    below.push(svg('path', { class: 'trail', d: path(game.trail.slice(0, upTo)) }));
    if (!game.over) {
      below.push(svg('circle', { class: 'reach', cx: game.x, cy: game.y, r: E.REACH }));
      below.push(svg('circle', { class: 'now', cx: game.x, cy: game.y, r: game.r }));
    }
    const shown = game.over ? E.senses(game, Infinity) : E.senses(game);
    for (const l of shown) {
      // Senses too far away to make out are a faint "?" until you get near.
      const known = game.over || game.seen.includes(l.name);
      const cls = ['sense'];
      if (!known) cls.push('unknown');
      if (fads.includes(l.name)) cls.push('fad');
      if (mine.includes(l.name)) cls.push('mine');
      if (p.senses.includes(l.name) && !game.over) cls.push('held');
      const g = svg('g', { class: cls.join(' ') });
      if (fads.includes(l.name)) {
        g.append(svg('text', { class: 'spark', x: l.x, y: l.y + 1.3, 'text-anchor': 'middle' }, '✦'));
      } else {
        g.append(svg('circle', { cx: l.x, cy: l.y, r: known ? 1 : 0.7 }));
      }
      const anchor = l.x > 80 ? 'end' : l.x < 20 ? 'start' : 'middle';
      g.append(svg('text', { x: l.x, y: l.y + 4.6, 'text-anchor': anchor }, known ? l.name : '?'));
      // What you become, once you know it and can see it.
      if (game.goal && known && l.name === game.goal) g.append(svg('text', { class: 'target-star', x: l.x + 1.6, y: l.y - 1.4 }, '★'));
      above.push(g);
    }
    // What the century just passed wanted and scorned stays on the map until
    // the next one passes.
    const last = !game.over && !replay && game.log[game.log.length - 1];
    const word = game.over ? L.word : era[1];
    const count = ` ${game.speakers}`;
    const at = game.over ? game : p.move;
    const [wx, wy] = wordSpot(word + count, at, shown);
    if (last) {
      for (const name of last.wanted) {
        const l = E.senseAt(game, name);
        const hit = last.senses.includes(name);
        below.push(svg('circle', { class: `verdict-wanted${hit ? ' hit' : ''}`, cx: l.x, cy: l.y, r: 2.6 }));
        // The speakers it would have brought you, waiting round it.
        const missed = hit ? 0 : Math.round(E.GAIN.needed / PER_PERSON);
        const rand = seeded(`${name}${last.year}`);
        for (let i = 0; i < missed; i++) {
          const a = rand() * 2 * Math.PI;
          const d = 2.2 + rand() * 4;
          below.push(svg('circle', { class: 'missed-person', cx: l.x + Math.cos(a) * d, cy: l.y + Math.sin(a) * d, r: 0.75 }));
        }
      }
      for (const name of last.scorned) {
        const l = E.senseAt(game, name);
        above.push(svg('path', { class: `verdict-scorned${last.senses.includes(name) ? ' stung' : ''}`,
          d: `M${l.x - 1.8} ${l.y - 1.8}L${l.x + 1.8} ${l.y + 1.8}M${l.x + 1.8} ${l.y - 1.8}L${l.x - 1.8} ${l.y + 1.8}` }));
      }
    }
    if (replay) {
      const you = game.trail[Math.min(replay.step, game.trail.length - 1)];
      if (real) {
        const them = real.trail[Math.min(replay.step, real.trail.length - 1)];
        above.push(svg('circle', { class: 'replay-real', cx: them.x, cy: them.y, r: them.r }));
        above.push(svg('text', { class: 'real-word', x: them.x, y: Math.max(them.y - them.r + 4.5, 1), 'text-anchor': 'middle' }, 'best route'));
      }
      above.push(svg('circle', { class: 'ghost', cx: you.x, cy: you.y, r: you.r }));
      above.push(svg('text', { class: 'ghost-word', x: you.x, y: you.y - 1.6, 'text-anchor': 'middle' }, 'you'));
      const year = replay.step ? L.eras[replay.step - 1][0] : 'Start';
      above.push(svg('text', { class: 'replay-year', x: 1, y: 6 }, String(year)));
    } else {
      if (!game.over && Math.hypot(p.move.x - game.x, p.move.y - game.y) > 0.5) {
        above.push(svg('line', { class: 'arrow', x1: game.x, y1: game.y, x2: p.move.x, y2: p.move.y, 'marker-end': 'url(#arrowhead)' }));
      }
      above.push(svg('circle', { class: `ghost${p.senses.length > E.MAX_SENSES ? ' vague' : ''}`, cx: at.x, cy: at.y, r: at.r }));
      if (!game.over) above.push(...breadthButtons(at));
      const label = svg('text', { class: 'ghost-word', x: wx, y: wy, 'text-anchor': 'middle' }, word);
      label.append(svg('tspan', { class: 'count' }, count));
      above.push(label);
    }
    $('below').replaceChildren(...below);
    $('above').replaceChildren(...above);
    return p;
  }

  // Broaden (+) and narrow (−) sit on the edge of your circle, on whichever
  // side has room. Pressed shows the change you've chosen; tap again to undo.
  function breadthButtons(at) {
    const side = at.x > 70 ? -1 : 1;
    return [['broaden', '+', -0.6, ghost.r > game.r, game.r >= E.MAX_BREADTH],
      ['narrow', '−', 0.6, ghost.r < game.r, game.r <= E.MIN_BREADTH]].map(([act, sign, a, pressed, off]) => {
      const x = Math.min(101, Math.max(-1, at.x + side * Math.cos(a) * at.r));
      const y = Math.min(101, Math.max(-1, at.y + Math.sin(a) * at.r));
      const g = svg('g', { class: `breadth-btn${pressed ? ' pressed' : ''}${off ? ' off' : ''}`, 'data-act': act, role: 'button',
        'aria-label': act === 'broaden' ? 'Broaden a lot: hold more meanings' : 'Narrow a little: hold fewer meanings' });
      g.append(svg('circle', { cx: x, cy: y, r: 3.4 }), svg('text', { x, y: y + 1.6, 'text-anchor': 'middle' }, sign));
      return g;
    });
  }

  // Roughly where a label's text sits on the map: [left, top, right, bottom].
  function textBox(x, y, text, size, anchor = 'middle') {
    const w = text.length * size * 0.55;
    const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
    return [left, y - size * 0.8, left + w, y + size * 0.25];
  }
  const overlaps = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

  // Where to write your word's spelling by its circle: above it, or below,
  // left or right of it, wherever it doesn't cover a meaning's label.
  function wordSpot(word, at, senses, size = 4, also = []) {
    const taken = also.concat(senses.flatMap((l) => {
      const anchor = l.x > 80 ? 'end' : l.x < 20 ? 'start' : 'middle';
      return [textBox(l.x, l.y + 4.6, game.seen.includes(l.name) || game.over ? l.name : '?', 3.8, anchor), [l.x - 1.2, l.y - 1.2, l.x + 1.2, l.y + 1.2]];
    }));
    const w = word.length * size * 0.55;
    const spots = [
      [at.x, at.y - at.r - 1.2], [at.x, at.y + at.r + 4], [at.x - at.r - w / 2 - 1, at.y + 1.4], [at.x + at.r + w / 2 + 1, at.y + 1.4],
    ].filter(([x, y]) => y > -2 && y < 103 && x - w / 2 > -4 && x + w / 2 < 104);
    return spots.find(([x, y]) => !taken.some((b) => overlaps(textBox(x, y, word, size), b))) || spots[0] || [at.x, at.y];
  }

  // Where the i-th of n speakers stands in a circle: a sunflower spread over
  // the whole circle, so a bigger crowd is a denser one.
  function spot(i, at, n) {
    const a = i * 2.39996;
    const d = at.r * 0.9 * Math.sqrt((i + 0.5) / Math.max(n, 12));
    return [at.x + Math.cos(a) * d, at.y + Math.sin(a) * d];
  }
  // Random numbers that come out the same for the same text, so a scatter
  // stays put however often the map is drawn.
  function seeded(text) {
    let h = 2166136261;
    for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }
  // Somewhere between `from` and `to` away from a point, on the map.
  function near(c, from, to) {
    const a = Math.random() * 2 * Math.PI;
    const d = from + Math.random() * (to - from);
    return [Math.min(103, Math.max(-3, c.x + Math.cos(a) * d)), Math.min(103, Math.max(-3, c.y + Math.sin(a) * d))];
  }
  const moveTo = (dot, [x, y]) => { dot.style.transform = `translate(${x}px, ${y}px)`; };

  // Somewhere inside your circle near a point: where a newcomer stands, by
  // the meaning that won them.
  function inside(c) {
    const [x, y] = near(c, 0.8, 2.6);
    const d = Math.hypot(x - game.x, y - game.y);
    const max = game.r * 0.9;
    return d <= max ? [x, y] : [game.x + ((x - game.x) * max) / d, game.y + ((y - game.y) * max) / d];
  }

  // Bring the crowd up to date. Those who leave walk off to what lost them
  // (`losses`: how many, and the sense that cost them, or none for those who
  // just forgot you) and stand there in red until the next century passes.
  // Newcomers walk in from the senses that won them (`from`: points, `won` if
  // the meaning was wanted) and stand by them, gold or green, until the next
  // century passes and they join the crowd.
  function updateCrowd(losses = [], from = []) {
    for (const dot of leftBehind) { dot.classList.add('faded'); setTimeout(() => dot.remove(), 1000); }
    for (const dot of people) dot.classList.remove('won', 'gained', 'at-risk');
    leftBehind = [];
    const n = Math.min(CROWD_MAX, Math.round(game.speakers / PER_PERSON));
    const away = losses.flatMap((l) => Array.from({ length: l.n }, () => (l.at ? near(l.at, 1.5, 4) : near(game, game.r + 1.5, game.r + 5))));
    while (people.length && (away.length || people.length > n)) {
      const dot = people.pop();
      dot.classList.add('gone');
      if (away.length) {
        moveTo(dot, away.shift());
        leftBehind.push(dot);
      } else {
        dot.classList.add('faded');
        setTimeout(() => dot.remove(), 1200);
      }
    }
    people.forEach((dot, i) => moveTo(dot, spot(i, game, n)));
    const settled = people.length;
    let k = 0;
    while (people.length < n) {
      const dot = svg('circle', { class: 'person', r: 0.75 });
      $('crowd').append(dot);
      if (from.length) {
        const src = from[k++ % from.length];
        dot.classList.add(src.won ? 'won' : 'gained');
        dot.style.transition = 'none';
        moveTo(dot, [src.x, src.y]);
        getComputedStyle(dot).transform; // start the walk from the sense
        dot.style.transition = '';
        dot.style.transitionDelay = `${Math.min(k * 40, 800)}ms`;
      }
      moveTo(dot, from.length ? inside(from[(k - 1) % from.length]) : spot(people.length, game, n));
      people.push(dot);
    }
    // Newcomers last, so the settled crowd is the first to forget you.
    newcomers = people.length - settled;
    markRisk();
  }

  // The speakers you're sure to lose if the century passed now, by your
  // circle's size: those who forget you anyway, and what being too vague or
  // meaning nothing is sure to cost. They show hollow, from the edge of the crowd in.
  function markRisk() {
    const p = !game.over && !replay && E.preview(game, ghost);
    // Vagueness counts only what it's sure to cost, as if nothing were wanted.
    const sure = p ? -p.reasons.filter((r) => !r.sense).reduce((n, r) => n + (r.vague ? r.ifPlain : r.amount), 0) : 0;
    const n = Math.round(sure / PER_PERSON);
    const settled = people.length - newcomers;
    people.forEach((dot, i) => {
      const rank = i < settled ? settled - 1 - i : settled + (people.length - 1 - i);
      dot.classList.toggle('at-risk', rank < n);
    });
  }

  // Numbers that rise off the map where the century paid you, or cost you.
  function float(x, y, text, cls) {
    const t = svg('text', { class: `float ${cls}`, x, y, 'text-anchor': 'middle' }, text);
    $('floats').append(t);
    setTimeout(() => t.remove(), 3200);
  }

  // A cell per century in one line: past ones show what they did to your
  // speakers, coloured by how good the move was, with ✓ if you meant what
  // the word really meant; tap one to see its summary again.
  function renderTimeline() {
    const L = level();
    $('timeline').replaceChildren(...L.eras.map((e, i) => {
      const entry = game.log[i];
      if (entry) {
        return el('li', { class: `done ${entry.grade}`, role: 'button', tabindex: '0',
          title: `${e[0]}: ${signed(entry.delta)} speakers, a ${entry.grade} move; ${entry.kept ? 'kept to' : 'changed'} history`,
          onclick: () => showSummary(i), onkeydown: (evt) => { if (evt.key === 'Enter') showSummary(i); } },
        signed(entry.delta), el('span', { class: `mark ${entry.kept ? 'true' : 'astray'}` }, entry.kept ? '✓' : '✗'));
      }
      const now = i === game.era && !game.over;
      return el('li', { class: now ? 'now' : 'later' }, String(e[0]), i === L.eras.length - 1 ? el('span', { class: 'mark' }, '★') : '');
    }));
  }

  function render() {
    const L = level();
    const era = E.eraOf(game);
    $('year').textContent = game.over ? 'Today' : era[0];
    $('form').textContent = game.over ? L.word : era[1];
    $('speakers').textContent = game.speakers;
    const fads = game.over ? [] : E.fadNow(game);
    const mine = game.over ? (game.log[game.log.length - 1] || { senses: [] }).senses : meaningNow();
    $('now-chips').replaceChildren(...(mine.length
      ? mine.map((s) => el('span', { class: `chip${fads.includes(s) ? ' fad' : ''}` }, s))
      : [el('span', { class: 'chip bad' }, 'nothing at all')]));

    // Next: the century's clue, and what you can already see about it.
    $('next').hidden = game.over;
    $('drift').hidden = game.over;
    $('over').hidden = !game.over;
    // What happens this century: your world's event, or one that changes
    // history. Nothing says which is which: they come in an order of their
    // own, the first chosen to start with. The chosen one shows its clues;
    // tap the other to choose it.
    $('next-label').replaceChildren('The ', el('span', { class: 'decade' }, `${era[0]}s`));
    const order = game.events.length > 1 && seeded(`${L.id}${era[0]}${game.events.map((e) => e.world)}`)() < 0.5 ? [1, 0] : game.events.map((e, i) => i);
    if (shuffledFor !== game.era) { shuffledFor = game.era; game.pick = order[0]; }
    $('events').replaceChildren(...(game.over ? [] : order.map((i) => {
      const ev = game.events[i];
      return el('button', {
        type: 'button', role: 'radio', 'aria-checked': String(i === game.pick), class: `event${i === game.pick ? ' chosen' : ''}`,
        onclick: () => { game.pick = i; render(); },
      }, el('span', { class: 'clue' }, ev.clue), ...(i === game.pick ? [el('span', { class: 'scorn-clue' }, ev.scornClue)] : []));
    })));
    const goal = game.goal;
    $('tags').replaceChildren(
      ...fads.map((s) => el('span', { class: 'tag fad', title: 'A new fad' }, `✦ ${s}`)),
      el('span', { class: 'tag goal' }, goal
        ? `★ becoming ${goal}${L.endings[goal].maxBreadth ? ', narrowly' : ''}`
        : `★ becoming ? until ${L.eras[L.eras.length - E.REVEAL][0]}`));
    $('over-text').textContent = game.outcome === 'obsolete' ? 'Nobody says you any more.'
      : game.outcome === 'arrived' ? `${L.word} means ${goal}.` : `You survived, but didn't become ${goal}.`;

    const p = renderMap();
    if (!replay) ghost = p.move;
    renderTimeline();

    // What you'd mean after the drift: kept, new and dropped. What it does to
    // your speakers only shows once the century has passed.
    const vague = p.senses.length > E.MAX_SENSES;
    $('next-chips').replaceChildren(
      ...p.senses.map((s) => el('span', { class: `chip ${mine.includes(s) ? 'kept' : 'new'}${vague ? ' vague' : ''}` },
        mine.includes(s) ? s : `+ ${s}`)),
      ...(p.senses.length ? [] : [el('span', { class: 'chip bad' }, 'nothing at all')]),
      ...mine.filter((s) => !p.senses.includes(s)).map((s) => el('span', { class: 'chip dropped' }, s)));
    $('game').classList.toggle('begun', game.era > 0);
    const next = L.eras[game.era + 1];
    $('pass').textContent = `Continue to ${next ? next[0] : 'today'}`;
    markRisk();
  }

  function pass() {
    if (game.over) return showEnd();
    const L = level();
    const hadGoal = game.goal;
    const seenBefore = [...game.seen];
    const best = E.bestMove(game);
    const p = E.advance(game, ghost);
    $('floats').replaceChildren();
    const entry = game.log[game.log.length - 1];
    const at = (name) => E.senseAt(game, name);
    const hit = p.senses.filter((s) => entry.wanted.includes(s));
    const really = L.history[game.log.length - 1];
    entry.best = Math.max(best.delta, p.delta);
    entry.grade = E.grade(p.delta, entry.best);

    // On the map: what each sense paid, and what you missed.
    const from = [];
    const losses = p.reasons.filter((r) => r.amount < 0)
      .map((r) => ({ n: Math.round(-r.amount / PER_PERSON), at: r.sense ? at(r.sense) : null }));
    for (const r of p.reasons) {
      if (!r.sense) continue;
      const l = at(r.sense);
      float(l.x, l.y - 2.4, signed(r.amount), r.scorned ? 'bad' : r.needed ? 'wanted' : 'plain');
      for (let i = 0; i < Math.max(1, Math.round(r.amount / PER_PERSON)) && r.amount > 0; i++) from.push({ x: l.x, y: l.y, won: r.needed });
    }
    from.sort((a, b) => b.won - a.won); // those a wanted meaning won walk in first
    for (const w of entry.wanted) {
      if (!hit.includes(w)) { const l = at(w); float(l.x, l.y - 2.4, 'wanted', 'missed'); }
    }
    float(game.x, game.y + 2, signed(p.delta), `total ${p.delta >= 0 ? 'pos' : 'neg'}`);
    p.reasons.filter((r) => !r.sense).forEach((r, i) => {
      const label = { 'forgotten by some': 'forgotten', 'nobody knows what you mean': 'meaningless' }[r.text] || 'too vague';
      float(game.x, game.y + game.r + 3.5 + i * 4.2, `${signed(r.amount)} ${label}`, 'bad');
    });

    $('speakers-delta').textContent = signed(p.delta);
    $('speakers-delta').className = `bump ${p.delta >= 0 ? 'pos' : 'neg'}`;
    void $('speakers-delta').offsetWidth;
    $('speakers-delta').classList.add('show');

    // Keep what the century did, to show now and again from the timeline.
    entry.reasons = p.reasons;
    entry.missed = entry.wanted.filter((w) => !hit.includes(w));
    entry.really = really;
    entry.appeared = game.over ? [] : E.landmarks(L, E.eraOf(game)[0]).filter((l) => l.from > entry.year).map((l) => l.name);
    entry.sighted = game.seen.filter((name) => !seenBefore.includes(name) && !entry.sprouted.includes(name));
    entry.becoming = !hadGoal && game.goal;
    showSummary(game.log.length - 1);
    ghost = { x: game.x, y: game.y, r: game.r };
    render();
    updateCrowd(losses, from);
    if (game.over) setTimeout(showEnd, 1800);
  }

  // The summary of a century: each gain and loss and why, the total, what
  // the word really meant, and any new ways to go.
  function showSummary(i) {
    const L = level();
    const entry = game.log[i];
    const general = { 'forgotten by some': 'forgotten', 'nobody knows what you mean': 'meaningless' };
    const row = (cls, amount, what, why) => el('tr', { class: cls }, el('td', { class: 'amt' }, amount), el('td', {}, what), el('td', { class: 'why' }, why));
    const named = entry.appeared.filter((name) => game.seen.includes(name));
    const found = [
      ...entry.sprouted.map((name) => el('li', { class: 'fadnote' }, `✦ ${name}, a new fad`)),
      ...entry.sighted.map((name) => el('li', {}, `${name} comes into sight`)),
      ...(entry.appeared.length > named.length ? [el('li', {}, 'A new meaning appears somewhere')] : []),
      ...(entry.becoming ? [el('li', { class: 'reveal' }, `★ You're becoming ${entry.becoming}`)] : []),
    ];
    $('result').replaceChildren(
      el('div', { class: 'pop-head' },
        el('strong', {}, String(entry.year)),
        el('strong', { class: `total ${entry.delta >= 0 ? 'pos' : 'neg'}` }, `${signed(entry.delta)} speakers`),
        el('button', { type: 'button', class: 'quiet close', 'aria-label': 'Close', onclick: hideSummary }, '✕')),
      el('table', { class: 'tally' }, el('tbody', {},
        ...entry.reasons.map((r) => (r.sense
          ? row(r.scorned ? 'bad' : r.needed ? 'wanted' : r.fad ? 'fad' : 'plain', signed(r.amount), r.sense,
            r.scorned ? 'out of fashion' : r.needed ? 'wanted' : r.fad ? 'fad' : '')
          : row('bad', signed(r.amount), general[r.text] || 'too vague', ''))),
        ...entry.missed.map((w) => row('missed', `(${signed(E.GAIN.needed)})`, w, 'wanted, missed')))),
      el('p', { class: entry.kept ? 'true' : 'astray' }, entry.kept ? 'You kept to history ✓' : 'You changed history ✗'),
      el('p', { class: 'really' }, `Really, ${L.word} meant ${entry.really}${entry.meant ? ', and so did you' : ''}.`),
      ...(found.length ? [el('ul', { class: 'found' }, ...found)] : []));
    // Out of the way of your circle: in whichever half of the map it isn't.
    $('result').classList.toggle('at-top', game.y > 50);
    $('result').hidden = false;
  }
  function hideSummary() { $('result').hidden = true; }
  // A tap anywhere but the summary, or the timeline that shows it, closes it.
  document.addEventListener('pointerdown', (evt) => {
    if (!$('result').hidden && !evt.target.closest('#result, #timeline')) hideSummary();
  });

  function showEnd() {
    const L = level();
    const score = E.score(game);
    const goal = game.goal;
    const perfect = E.score(answerGame());
    // Matching the best route reveals it: there's nothing left to find.
    if (score >= perfect) revealed = true;
    $('end-kicker').textContent = game.outcome === 'obsolete' ? '' : goal === L.target ? 'The real ending' : 'Another ending';
    $('end-title').textContent = {
      arrived: goal === L.target ? `You became "${L.word}"` : `In your world, ${L.word} means ${goal}`,
      survived: 'You survived, but as something else',
      obsolete: 'Obsolete',
    }[game.outcome];
    $('end-text').textContent = {
      arrived: L.endings[goal] && L.endings[goal].text,
      survived: goal ? `Your journey was leading to ${goal}, but you didn't mean it${L.endings[goal].maxBreadth ? ' narrowly enough' : ''} at the end. ${L.endings[goal].text}` : '',
      obsolete: 'Nobody says you any more. You live on in the backs of old dictionaries.',
    }[game.outcome] || '';
    $('end-score').textContent = String(score);
    $('end-perfect-wrap').hidden = !revealed;
    $('end-perfect').textContent = String(perfect) + (score >= perfect ? ' (you found it!)' : '');
    $('end-reveal').hidden = revealed;
    $('end-reveal').textContent = 'Reveal the answer';
    $('end-reveal').classList.remove('warn');
    $('end-warning').hidden = true;
    const isBest = saveBest(L.id, score);
    $('end-best').textContent = isBest ? 'A new best for this word.' : `Your best for this word: ${stored(BEST_KEY)[L.id]}.`;
    const found = game.outcome === 'arrived' ? saveEnding(L.id, goal) : (stored(ENDINGS_KEY)[L.id] || []);
    const all = Object.keys(L.endings);
    $('end-endings').replaceChildren(`Endings found for ${L.word}: ${found.length} of ${all.length} `,
      ...all.map((e) => el('span', { class: `chip${found.includes(e) ? ' kept' : ' locked'}` }, found.includes(e) ? e : '?')));
    $('end-table').replaceChildren(...game.log.map((l, i) => el('tr', { class: l.meant ? 'true' : 'astray' },
      el('td', {}, String(l.year)),
      el('td', {}, ...(l.senses.length ? words(l.senses, l.wanted) : ['—'])),
      el('td', {}, el(l.wanted.includes(L.history[i]) ? 'strong' : 'span', {}, L.history[i]), l.meant ? ' ✓' : ''),
      el('td', { class: 'wanted' }, l.wanted.join(', ')))));
    $('end-next').hidden = game.levelIndex >= E.LEVELS.length - 1;
    render();
    if (!$('end').open) $('end').showModal();
  }

  // The answer is two taps away: the first warns that it's the answer.
  function reveal() {
    if ($('end-warning').hidden) {
      $('end-warning').hidden = false;
      $('end-reveal').textContent = 'Yes, show me the answer';
      $('end-reveal').classList.add('warn');
      return;
    }
    revealed = true;
    showEnd();
  }

  // The replay: your circle century by century, and the best route's once revealed.
  function startReplay() {
    stopReplay();
    replay = { step: 0 };
    $('crowd').classList.add('away');
    render();
    replay.timer = setInterval(() => {
      replay.step++;
      if (replay.step > level().eras.length) { stopReplay(); render(); return; }
      render();
    }, REPLAY_STEP);
  }
  function stopReplay() {
    if (replay) clearInterval(replay.timer);
    replay = null;
    $('crowd').classList.remove('away');
  }

  // Tap or drag on the map to choose where to drift.
  function pointAt(evt) {
    const map = $('map');
    const pt = map.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(map.getScreenCTM().inverse());
  }
  // A tap near a meaning goes to that meaning.
  function target(evt) {
    const p = pointAt(evt);
    const near = E.senses(game)
      .map((l) => ({ l, d: Math.hypot(l.x - p.x, l.y - p.y) }))
      .sort((a, b) => a.d - b.d)[0];
    const at = near && near.d <= 6 ? near.l : p;
    return E.constrain(game, { x: at.x, y: at.y, r: ghost.r });
  }
  let dragging = false;
  $('map').addEventListener('pointerdown', (evt) => {
    hideSummary();
    if (game.over) return;
    const btn = evt.target.closest('.breadth-btn');
    if (btn) return btn.classList.contains('off') ? null : (btn.dataset.act === 'broaden' ? broaden() : narrow());
    dragging = true;
    $('map').setPointerCapture(evt.pointerId);
    ghost = target(evt);
    render();
  });
  $('map').addEventListener('pointermove', (evt) => {
    if (!dragging || game.over) return;
    ghost = target(evt);
    render();
  });
  const stop = () => { dragging = false; };
  $('map').addEventListener('pointerup', stop);
  $('map').addEventListener('pointercancel', stop);

  // Each century you may narrow a little or broaden a lot: tap again to undo.
  function narrow() {
    ghost = E.constrain(game, { ...ghost, r: ghost.r < game.r ? game.r : game.r - E.NARROW });
    render();
  }
  function broaden() {
    ghost = E.constrain(game, { ...ghost, r: ghost.r > game.r ? game.r : game.r + E.BROADEN });
    render();
  }
  $('pass').addEventListener('click', pass);
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]') || $('game').hidden || game.over) return;
    const step = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[e.key];
    if (step) {
      e.preventDefault();
      ghost = E.constrain(game, { x: ghost.x + step[0], y: ghost.y + step[1], r: ghost.r });
      render();
    } else if (e.key === '-' || e.key === '[') narrow();
    else if (e.key === '+' || e.key === '=' || e.key === ']') broaden();
    else if (e.key === 'Enter' && e.target === document.body) pass();
  });

  $('rules-btn').addEventListener('click', () => $('rules').showModal());
  $('help').addEventListener('click', () => $('rules').showModal());
  $('exit').addEventListener('click', showMenu);
  $('see-end').addEventListener('click', showEnd);
  $('replay-btn').addEventListener('click', startReplay);
  $('end-menu').addEventListener('click', () => { $('end').close(); showMenu(); });
  $('end-replay').addEventListener('click', () => { $('end').close(); startReplay(); });
  $('end-reveal').addEventListener('click', reveal);
  $('end-next').addEventListener('click', () => { $('end').close(); start(game.levelIndex + 1); });
  $('end-again').addEventListener('click', () => { $('end').close(); start(game.levelIndex); });
  $('end-map').addEventListener('click', () => $('end').close());

  // On phones the Now card sits above the map and the drift card is pinned
  // to the bottom: the map fits between them.
  if (window.ResizeObserver) {
    for (const [id, name] of [['drift', '--drift'], ['now', '--now'], ['next', '--next']]) {
      new ResizeObserver(([e]) => $('game').style.setProperty(name, `${Math.ceil(e.target.offsetHeight)}px`)).observe($(id));
    }
  }

  renderWords();
  let seen = false;
  try { seen = localStorage.getItem('etymon-seen-rules') === '3'; localStorage.setItem('etymon-seen-rules', '3'); } catch { /* fine */ }
  if (!seen) $('rules').showModal();
})();
