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
  let replay = null; // { step, timer } while the replay plays
  let revealed = false; // whether the player has asked to see the best route

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
  // The real word's journey, to measure yours against as you go.
  const reals = {};
  const realGame = () => reals[game.levelIndex] || (reals[game.levelIndex] = E.historyGame(game.levelIndex));
  const realSpeakers = (i) => (i ? realGame().log[i - 1].speakers : E.START_SPEAKERS);
  // The answer: the perfect route to the ending you got, or to the real one.
  const answerGame = () => E.perfectGame(game.levelIndex, game.goal || level().target);
  const GRADE_TEXT = { best: 'The best move you had.', good: 'A good move', fair: 'A fair move', poor: 'A poor move' };
  const signed = (n) => (n > 0 ? `+${n}` : String(n));
  function ordinalCentury(year) {
    const c = Math.floor(year / 100) + 1;
    const s = c % 100 >= 11 && c % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[c % 10] || 'th');
    return `${c}${s} century`;
  }
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
    const word = game.over ? L.word : era[2];
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
      const label = svg('text', { class: 'ghost-word', x: wx, y: wy, 'text-anchor': 'middle' }, word);
      label.append(svg('tspan', { class: `count ${game.speakers < realSpeakers(game.era) ? 'behind' : 'ahead'}` }, count));
      above.push(label);
    }
    $('below').replaceChildren(...below);
    $('above').replaceChildren(...above);
    return p;
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

  // Bring the crowd up to date. Those who leave walk off to what lost them
  // (`losses`: how many, and the sense that cost them, or none for those who
  // just forgot you) and stand there in red until the next century passes.
  // Newcomers walk in from the senses that won them (`from`, a list of points).
  function updateCrowd(losses = [], from = []) {
    for (const dot of leftBehind) { dot.classList.add('faded'); setTimeout(() => dot.remove(), 1000); }
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
    let k = 0;
    while (people.length < n) {
      const dot = svg('circle', { class: 'person', r: 0.75 });
      $('crowd').append(dot);
      if (from.length) {
        const src = from[k++ % from.length];
        dot.style.transition = 'none';
        moveTo(dot, [src.x, src.y]);
        getComputedStyle(dot).transform; // start the walk from the sense
        dot.style.transition = '';
        dot.style.transitionDelay = `${Math.min(k * 40, 800)}ms`;
      }
      moveTo(dot, spot(people.length, game, n));
      people.push(dot);
    }
  }

  // Numbers that rise off the map where the century paid you, or cost you.
  function float(x, y, text, cls) {
    const t = svg('text', { class: `float ${cls}`, x, y, 'text-anchor': 'middle' }, text);
    $('floats').append(t);
    setTimeout(() => t.remove(), 3200);
  }

  function renderTimeline() {
    const L = level();
    const real = realGame();
    const top = Math.max(200, ...game.log.map((l) => l.speakers), ...real.log.map((l) => l.speakers));
    const tick = (i) => (game.over && !revealed ? '' : el('span', { class: 'par', style: `bottom:${(100 * realSpeakers(i)) / top}%` }));
    $('timeline').replaceChildren(...L.eras.map((e, i) => {
      const entry = game.log[i];
      const last = i === L.eras.length - 1;
      if (entry) {
        const hit = entry.senses.some((s) => entry.wanted.includes(s));
        return el('li', { class: `done${hit ? ' hit' : ''}`, title: `${e[0]}: ${entry.speakers} speakers (the real ${L.word} had ${realSpeakers(i + 1)}); ${entry.grade} move; really meant ${L.history[i]}` },
          el('span', { class: 'bar-wrap' }, el('span', { class: `bar ${entry.grade}`, style: `height:${(100 * entry.speakers) / top}%` }), tick(i + 1)),
          el('span', { class: `mark ${entry.faithful ? 'true' : 'astray'}` }, entry.faithful ? '✓' : '✗'),
          el('span', { class: 'yr' }, String(e[0])));
      }
      const now = i === game.era && !game.over;
      return el('li', { class: now ? 'now' : 'later' },
        el('span', { class: 'bar-wrap' }, now ? el('span', { class: 'bar ghost-bar', style: `height:${(100 * game.speakers) / top}%` }) : '', tick(i + 1)),
        el('span', { class: 'mark' }, now ? '•' : last ? '★' : ''),
        el('span', { class: 'yr' }, String(e[0])));
    }));
  }

  function render() {
    const L = level();
    const era = E.eraOf(game);
    $('year').textContent = game.over ? 'Today' : era[0];
    $('form').textContent = game.over ? L.word : era[2];
    $('speakers').textContent = game.speakers;
    // At the end the real word's speakers would give away the best score.
    const par = game.over ? E.score(realGame()) - E.ARRIVAL_BONUS : realSpeakers(game.era);
    $('par').hidden = game.over && !revealed;
    $('par').textContent = `real ${L.word}: ${par}`;
    $('par').className = `par-note ${game.speakers < par ? 'behind' : 'ahead'}`;
    const fads = game.over ? [] : E.fadNow(game);
    const mine = game.over ? (game.log[game.log.length - 1] || { senses: [] }).senses : meaningNow();
    $('now-chips').replaceChildren(...(mine.length
      ? mine.map((s) => el('span', { class: `chip${fads.includes(s) ? ' fad' : ''}` }, s))
      : [el('span', { class: 'chip bad' }, 'nothing at all')]));

    // Next: the century's clue, and what you can already see about it.
    $('next').hidden = game.over;
    $('drift').hidden = game.over;
    $('over').hidden = !game.over;
    $('next-label').textContent = `The ${ordinalCentury(era[0])}`;
    $('clue').textContent = E.clueNow(game);
    $('scorn-clue').textContent = E.scornClueNow(game);
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
    $('narrow').setAttribute('aria-pressed', String(ghost.r < game.r));
    $('broaden').setAttribute('aria-pressed', String(ghost.r > game.r));
    $('narrow').disabled = game.over || game.r <= E.MIN_BREADTH;
    $('broaden').disabled = game.over || game.r >= E.MAX_BREADTH;

    // What you'd mean after the drift: kept, new and dropped. What it does to
    // your speakers only shows once the century has passed.
    const vague = p.senses.length > E.MAX_SENSES;
    $('next-chips').replaceChildren(
      ...p.senses.map((s) => el('span', { class: `chip ${mine.includes(s) ? 'kept' : 'new'}${vague ? ' vague' : ''}` },
        mine.includes(s) ? s : `+ ${s}`)),
      ...(p.senses.length ? [] : [el('span', { class: 'chip bad' }, 'nothing at all')]),
      ...mine.filter((s) => !p.senses.includes(s)).map((s) => el('span', { class: 'chip dropped' }, s)));
    $('pass').textContent = `Let the ${ordinalCentury(era[0])} pass`;
  }

  function pass() {
    if (game.over) return showEnd();
    const L = level();
    const before = E.eraOf(game)[0];
    const hadGoal = game.goal;
    const best = E.bestMove(game);
    const p = E.advance(game, ghost);
    $('floats').replaceChildren();
    const entry = game.log[game.log.length - 1];
    const at = (name) => E.senseAt(game, name);
    const hit = p.senses.filter((s) => entry.wanted.includes(s));
    const stung = p.senses.filter((s) => entry.scorned.includes(s));
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
      for (let i = 0; i < Math.max(1, Math.round(r.amount / PER_PERSON)) && r.amount > 0; i++) from.push(l);
    }
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

    // What the century did, over the map until the next one.
    const fresh = game.over ? [] : E.landmarks(L, E.eraOf(game)[0]).filter((l) => l.from > before);
    $('result').hidden = false;
    $('result').replaceChildren(
      el('span', { class: 'r-year' }, `${entry.year}: `),
      'it wanted ', ...words(entry.wanted, hit), '. ',
      ...(entry.scorned.length ? [el('span', { class: stung.length ? 'astray' : '' }, ...words(entry.scorned, stung), ' went out of fashion. ')] : []),
      el('strong', { class: p.delta >= 0 ? 'pos' : 'neg' }, `${signed(p.delta)} speakers. `),
      el('span', { class: `grade ${entry.grade}` }, entry.grade === 'best' ? `${GRADE_TEXT.best} ` : `${GRADE_TEXT[entry.grade]}: the best was ${signed(entry.best)}. `),
      el('span', { class: entry.faithful ? 'true' : 'astray' }, `Really, ${L.word} meant ${really} ${entry.faithful ? '✓' : '✗'}`),
      ...(entry.sprouted.length ? [el('span', { class: 'fadnote' }, ` ✦ New fad: ${entry.sprouted.join(', ')}.`)] : []),
      ...(fresh.length ? [el('span', {}, ` A new meaning appears${fresh.some((l) => game.seen.includes(l.name)) ? `: ${fresh.filter((l) => game.seen.includes(l.name)).map((l) => l.name).join(', ')}` : ' somewhere'}.`)] : []),
      ...(!hadGoal && game.goal ? [el('span', { class: 'reveal' }, ` ★ You're becoming ${game.goal}.`)] : []));
    ghost = { x: game.x, y: game.y, r: game.r };
    render();
    updateCrowd(losses, from);
    if (game.over) setTimeout(showEnd, 1800);
  }

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
    $('end-table').replaceChildren(...game.log.map((l, i) => el('tr', { class: l.faithful ? 'true' : 'astray' },
      el('td', {}, String(l.year)),
      el('td', {}, ...(l.senses.length ? words(l.senses, l.wanted) : ['—'])),
      el('td', {}, el(l.wanted.includes(L.history[i]) ? 'strong' : 'span', {}, L.history[i]), l.faithful ? ' ✓' : ''),
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
    if (game.over) return;
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
  $('narrow').addEventListener('click', () => {
    ghost = E.constrain(game, { ...ghost, r: ghost.r < game.r ? game.r : game.r - E.NARROW });
    render();
  });
  $('broaden').addEventListener('click', () => {
    ghost = E.constrain(game, { ...ghost, r: ghost.r > game.r ? game.r : game.r + E.BROADEN });
    render();
  });
  $('pass').addEventListener('click', pass);
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]') || $('game').hidden || game.over) return;
    const step = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[e.key];
    if (step) {
      e.preventDefault();
      ghost = E.constrain(game, { x: ghost.x + step[0], y: ghost.y + step[1], r: ghost.r });
      render();
    } else if (e.key === '-' || e.key === '[') $('narrow').click();
    else if (e.key === '+' || e.key === '=' || e.key === ']') $('broaden').click();
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

  // On phones the drift card is pinned to the bottom: leave room for it.
  if (window.ResizeObserver) {
    new ResizeObserver(([e]) => $('game').style.setProperty('--drift', `${Math.ceil(e.target.offsetHeight)}px`)).observe($('drift'));
  }

  renderWords();
  let seen = false;
  try { seen = localStorage.getItem('etymon-seen-rules') === '2'; localStorage.setItem('etymon-seen-rules', '2'); } catch { /* fine */ }
  if (!seen) $('rules').showModal();
})();
