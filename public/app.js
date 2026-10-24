// Etymon's page: draws the map of meaning from public/game.js and handles taps.
(function () {
  'use strict';
  const E = window.Etymon;
  const $ = (id) => document.getElementById(id);
  const SVG = 'http://www.w3.org/2000/svg';
  const BEST_KEY = 'etymon-best';
  // Your speakers are a crowd of dots in your circle, one per PER_PERSON.
  const PER_PERSON = 5;
  const CROWD_MAX = 80;

  let game;
  let ghost; // where you're thinking of drifting: { x, y, r }
  let showHistory = false;
  let people = []; // the crowd's dots, innermost first

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

  function bests() {
    try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {}; } catch { return {}; }
  }
  function saveBest(id, score) {
    const b = bests();
    if (b[id] !== undefined && b[id] >= score) return false;
    b[id] = score;
    try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch { /* private window */ }
    return true;
  }

  function start(levelIndex) {
    game = E.newGame(levelIndex);
    ghost = { x: game.x, y: game.y, r: game.r };
    showHistory = false;
    $('log').replaceChildren();
    $('result').replaceChildren('Read the clue, then tap a meaning to drift toward it.');
    $('crowd').replaceChildren();
    $('floats').replaceChildren();
    people = [];
    renderWords();
    render();
    updateCrowd();
  }

  function renderWords() {
    const b = bests();
    $('words').replaceChildren(...E.LEVELS.map((L, i) => el('button', {
      type: 'button', 'aria-current': String(i === game.levelIndex),
      onclick: () => start(i),
    }, L.word, b[L.id] !== undefined ? el('span', { class: 'best' }, `best ${b[L.id]}`) : '')));
  }

  function path(points) {
    return points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  }

  function renderMap() {
    const level = E.LEVELS[game.levelIndex];
    const era = E.eraOf(game);
    const scorned = game.over ? [] : E.scornedNow(game);
    const p = E.preview(game, ghost);
    const below = [];
    const above = [];

    for (let v = 0; v <= 100; v += 25) {
      below.push(svg('line', { class: 'grid', x1: v, y1: 0, x2: v, y2: 100 }));
      below.push(svg('line', { class: 'grid', x1: 0, y1: v, x2: 100, y2: v }));
    }
    if (showHistory) {
      const h = E.historyGame(game.levelIndex);
      // The perfect route: where it went and how broad it was, each century.
      for (const t of h.trail.slice(1)) below.push(svg('circle', { class: 'history-step', cx: t.x, cy: t.y, r: t.r }));
      below.push(svg('path', { class: 'history', d: path(h.trail) }));
    }
    below.push(svg('path', { class: 'trail', d: path(game.trail) }));
    if (!game.over) {
      below.push(svg('circle', { class: 'reach', cx: game.x, cy: game.y, r: E.REACH }));
      below.push(svg('circle', { class: 'now', cx: game.x, cy: game.y, r: game.r }));
    }
    for (const l of E.landmarks(level, game.over ? Infinity : era[0])) {
      // Senses too far away to make out are a faint "?" until you get near.
      const known = game.over || game.seen.includes(l.name);
      const cls = ['sense'];
      if (!known) cls.push('unknown');
      if (scorned.includes(l.name)) cls.push('scorned');
      if (p.senses.includes(l.name) && !game.over) cls.push('held');
      const g = svg('g', { class: cls.join(' ') });
      if (scorned.includes(l.name)) {
        g.append(svg('path', { class: 'cross', d: `M${l.x - 1.2} ${l.y - 1.2}L${l.x + 1.2} ${l.y + 1.2}M${l.x + 1.2} ${l.y - 1.2}L${l.x - 1.2} ${l.y + 1.2}` }));
      } else {
        g.append(svg('circle', { cx: l.x, cy: l.y, r: known ? 1 : 0.7 }));
      }
      const anchor = l.x > 80 ? 'end' : l.x < 20 ? 'start' : 'middle';
      g.append(svg('text', { x: l.x, y: l.y + 4.6, 'text-anchor': anchor }, known ? l.name : '?'));
      if (l.name === level.target) g.append(svg('text', { class: 'target-star', x: l.x + 1.6, y: l.y - 1.4 }, '★'));
      above.push(g);
    }
    if (!game.over && Math.hypot(p.move.x - game.x, p.move.y - game.y) > 0.5) {
      above.push(svg('line', { class: 'arrow', x1: game.x, y1: game.y, x2: p.move.x, y2: p.move.y, 'marker-end': 'url(#arrowhead)' }));
    }
    const at = game.over ? game : p.move;
    above.push(svg('circle', { class: `ghost${p.senses.length > E.MAX_SENSES ? ' vague' : ''}`, cx: at.x, cy: at.y, r: at.r }));
    above.push(svg('text', { class: 'ghost-word', x: at.x, y: at.y - 1.6, 'text-anchor': 'middle' },
      game.over ? level.word : era[2]));
    $('below').replaceChildren(...below);
    $('above').replaceChildren(...above);
    return p;
  }

  // Where the i-th speaker stands in a circle: a sunflower that fills from
  // the middle out, so a bigger crowd is a denser one.
  function spot(i, at) {
    const a = i * 2.39996;
    const d = at.r * 0.92 * Math.sqrt((i + 0.5) / CROWD_MAX);
    return [at.x + Math.cos(a) * d, at.y + Math.sin(a) * d];
  }
  const moveTo = (dot, [x, y]) => { dot.style.transform = `translate(${x}px, ${y}px)`; };

  // Bring the crowd up to date: those forgotten fade away, newcomers walk in
  // from the senses that won them (`from`, a list of points).
  function updateCrowd(lost = 0, from = []) {
    const n = Math.min(CROWD_MAX, Math.round(game.speakers / PER_PERSON));
    let leaving = Math.min(people.length, Math.round(lost / PER_PERSON));
    while (people.length && (leaving > 0 || people.length > n)) {
      const dot = people.pop();
      const [x, y] = spot(people.length, game);
      dot.classList.add('gone');
      moveTo(dot, [x + (x - game.x) * 0.8, y + (y - game.y) * 0.8 + 3]);
      setTimeout(() => dot.remove(), 1200);
      leaving--;
    }
    people.forEach((dot, i) => moveTo(dot, spot(i, game)));
    let k = 0;
    while (people.length < n) {
      const dot = svg('circle', { class: 'person', r: 0.6 });
      $('crowd').append(dot);
      if (from.length) {
        const src = from[k++ % from.length];
        dot.style.transition = 'none';
        moveTo(dot, [src.x, src.y]);
        getComputedStyle(dot).transform; // start the walk from the sense
        dot.style.transition = '';
        dot.style.transitionDelay = `${Math.min(k * 40, 800)}ms`;
      }
      moveTo(dot, spot(people.length, game));
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
    const level = E.LEVELS[game.levelIndex];
    const top = Math.max(200, ...game.log.map((l) => l.speakers));
    $('timeline').replaceChildren(...level.eras.map((e, i) => {
      const entry = game.log[i];
      const last = i === level.eras.length - 1;
      if (entry) {
        const hit = entry.senses.some((s) => entry.wanted.includes(s));
        return el('li', { class: `done${hit ? ' hit' : ''}`, title: `${e[0]}: ${entry.speakers} speakers` },
          el('span', { class: 'bar-wrap' }, el('span', { class: `bar ${entry.delta >= 0 ? 'up' : 'down'}`, style: `height:${(100 * entry.speakers) / top}%` })),
          el('span', { class: 'n' }, String(entry.speakers)),
          el('span', { class: 'yr' }, String(e[0])));
      }
      const now = i === game.era && !game.over;
      return el('li', { class: now ? 'now' : 'later' },
        el('span', { class: 'bar-wrap' }, now ? el('span', { class: 'bar ghost-bar', style: `height:${(100 * game.speakers) / top}%` }) : ''),
        el('span', { class: 'n' }, now ? 'now' : last ? '★' : ''),
        el('span', { class: 'yr' }, String(e[0])));
    }));
  }

  function render() {
    const level = E.LEVELS[game.levelIndex];
    const era = E.eraOf(game);
    $('year').textContent = game.over ? 'Today' : era[0];
    $('form').textContent = game.over ? level.word : era[2];
    $('speakers').textContent = game.speakers;
    $('target').textContent = level.target + (level.targetMaxBreadth ? ' (narrowly)' : '');
    $('clue-box').hidden = game.over;
    $('clue').textContent = era[3];
    const scorned = E.scornedNow(game);
    $('scorned-line').replaceChildren('People sneer at ',
      ...scorned.flatMap((s, i) => [i ? ' and ' : '', el('strong', {}, s)]), ` this century: carrying it costs ${E.SCORN}.`);
    $('preview').hidden = game.over;
    $('breadth').hidden = game.over;
    $('breadth-help').hidden = game.over;

    const p = renderMap();
    ghost = p.move;
    renderTimeline();
    const n = p.senses.length;
    $('breadth-val').textContent = n > E.MAX_SENSES ? `${n} meanings: too vague!` : n ? `holds ${n} meaning${n === 1 ? '' : 's'}` : 'holds nothing';
    $('breadth-val').className = n > E.MAX_SENSES || !n ? 'neg' : '';
    const narrowed = ghost.r < game.r;
    const broadened = ghost.r > game.r;
    $('narrow').setAttribute('aria-pressed', String(narrowed));
    $('broaden').setAttribute('aria-pressed', String(broadened));
    $('narrow').disabled = game.over || game.r <= E.MIN_BREADTH;
    $('broaden').disabled = game.over || game.r >= E.MAX_BREADTH;

    // You can't know what the century wants, so senses show what they'd win either way.
    $('reasons').replaceChildren(...(game.over ? [] : p.reasons.map((r) => el('li', { class: r.scorned ? 'scorned' : '' },
      el('span', {}, r.text), r.sense && !r.scorned
        ? el('span', { class: 'amt pos' }, `+${r.ifPlain}`, el('span', { class: 'or' }, ` or +${r.ifWanted} if wanted`))
        : el('span', { class: `amt ${r.amount >= 0 ? 'pos' : 'neg'}` }, signed(r.amount))))));
    const [lo, hi] = p.range;
    $('delta').textContent = game.over ? '' : lo === hi ? signed(lo) : `${signed(lo)} to ${signed(hi)}`;
    $('delta').className = hi < 0 ? 'neg' : lo >= 0 ? 'pos' : '';
    $('pass').textContent = game.over ? 'See how it ended' : `Let the ${ordinalCentury(era[0])} pass`;
  }

  const signed = (n) => (n > 0 ? `+${n}` : String(n));
  function ordinalCentury(year) {
    const c = Math.floor(year / 100) + 1;
    const s = c % 100 >= 11 && c % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[c % 10] || 'th');
    return `${c}${s} century`;
  }

  function pass() {
    if (game.over) return showEnd();
    const level = E.LEVELS[game.levelIndex];
    const before = E.eraOf(game)[0];
    const p = E.advance(game, ghost);
    const entry = game.log[game.log.length - 1];
    const quoteOf = (name) => E.landmarks(level).find((l) => l.name === name).quote;
    const at = (name) => E.landmarks(level).find((l) => l.name === name);
    const hit = p.senses.filter((s) => entry.wanted.includes(s));

    // On the map: what each sense paid, and what you missed.
    const from = [];
    let lost = 0;
    for (const r of p.reasons) {
      if (r.amount < 0) lost -= r.amount;
      if (!r.sense) continue;
      const l = at(r.sense);
      float(l.x, l.y - 2.4, signed(r.amount), r.scorned ? 'bad' : r.needed ? 'wanted' : 'plain');
      for (let i = 0; i < Math.max(1, Math.round(r.amount / PER_PERSON)) && r.amount > 0; i++) from.push(l);
    }
    for (const w of entry.wanted) {
      if (!hit.includes(w)) { const l = at(w); float(l.x, l.y - 2.4, 'wanted', 'missed'); }
    }
    p.reasons.filter((r) => !r.sense).forEach((r, i) => {
      float(game.x, game.y + game.r + 3.5 + i * 4.2, `${signed(r.amount)} ${r.text}`, 'bad');
    });

    $('speakers-delta').textContent = signed(p.delta);
    $('speakers-delta').className = `bump ${p.delta >= 0 ? 'pos' : 'neg'}`;
    void $('speakers-delta').offsetWidth;
    $('speakers-delta').classList.add('show');

    const list = (names, bold) => names.flatMap((w, i) => [i ? ' and ' : '', el(bold.includes(w) ? 'strong' : 'span', {}, w)]);
    $('result').replaceChildren(
      el('span', { class: 'r-year' }, `${entry.year} is over. `),
      'It wanted ', ...list(entry.wanted, hit), '. ',
      hit.length ? `You had ${hit.length === 2 ? 'both' : hit[0]}! ` : 'You had neither. ',
      el('strong', { class: p.delta >= 0 ? 'pos' : 'neg' }, `${signed(p.delta)} speakers`));
    const quote = p.senses.length ? el('q', {}, quoteOf(hit[0] || p.senses[0])) : el('span', {}, 'meaning nothing in particular');
    const wantedLine = el('span', { class: 'w' }, 'It wanted ',
      ...entry.wanted.flatMap((w, i) => [i ? ' and ' : '', el(hit.includes(w) ? 'strong' : 'span', {}, w)]), '.');
    // Senses that have just appeared this century.
    const fresh = game.over ? [] : E.landmarks(level, E.eraOf(game)[0]).filter((l) => l.from > before);
    const news = fresh.length ? el('span', { class: 'w' }, ...fresh.map((l) => (game.seen.includes(l.name)
      ? `A new sense appears: ${l.name}. ` : 'A new sense appears somewhere. '))) : '';
    $('log').prepend(el('li', {}, el('span', { class: 'y' }, String(entry.year)), el('span', { class: 'f' }, entry.form),
      quote, el('span', { class: p.delta >= 0 ? 'pos' : 'neg' }, ` ${signed(p.delta)}`), wantedLine, news));
    ghost = { x: game.x, y: game.y, r: game.r };
    render();
    updateCrowd(lost, from);
    if (game.over) {
      $('result').append(' The gold dashes are the perfect route.');
      setTimeout(showEnd, 1800);
    }
  }

  function showEnd() {
    const level = E.LEVELS[game.levelIndex];
    const score = E.score(game);
    const history = E.historyGame(game.levelIndex);
    const hs = E.score(history);
    $('end-title').textContent = {
      arrived: `You became "${level.word}"`,
      survived: 'You survived, but as something else',
      obsolete: 'Obsolete',
    }[game.outcome];
    $('end-text').textContent = {
      arrived: `In the last century you meant ${level.target}${level.targetMaxBreadth ? ', and nothing much else' : ''}, just as ${level.word} does today.`,
      survived: `People still say you, but you don't mean ${level.target}${level.targetMaxBreadth ? ' (narrowly enough)' : ''}. Somewhere, another word does.`,
      obsolete: 'Nobody says you any more. You live on in the backs of old dictionaries.',
    }[game.outcome];
    $('end-score').textContent = `${score}`;
    $('end-history').textContent = score >= hs
      ? `A perfect game! Following what ${level.word} really meant each century, the best anyone can score is ${hs}.`
      : `The perfect route scores ${hs}: it follows what ${level.word} really meant each century, and knows what every century wants. It's the gold dashes on the map.`;
    const isBest = saveBest(level.id, score);
    $('end-best').textContent = isBest ? 'A new best for this word.' : `Your best for this word: ${bests()[level.id]}.`;
    $('end-next').hidden = game.levelIndex >= E.LEVELS.length - 1;
    showHistory = true;
    renderWords();
    render();
    if (!$('end').open) $('end').showModal();
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
    const near = E.landmarks(E.LEVELS[game.levelIndex], E.eraOf(game)[0])
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
    if (document.querySelector('dialog[open]') || game.over) return;
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
  $('end-next').addEventListener('click', () => { $('end').close(); start(game.levelIndex + 1); });
  $('end-again').addEventListener('click', () => { $('end').close(); start(game.levelIndex); });
  $('end-map').addEventListener('click', () => $('end').close());

  start(0);
  let seen = false;
  try { seen = localStorage.getItem('etymon-seen-rules') === '1'; localStorage.setItem('etymon-seen-rules', '1'); } catch { /* fine */ }
  if (!seen) $('rules').showModal();
})();
