// Etymon's rules. No DOM here, so the page and the tests share it.
//
// You are a word. The map is meaning: each landmark is a sense a word can
// have, and your circle is the senses you carry. Each century you drift
// (up to REACH across the map) and may broaden a lot or narrow a little, then
// the century passes and your speakers change:
//   - each sense you carry wins speakers, a lot more if the century needs
//     words for it (you only learn which afterwards)
//   - each sense the century scorns (you can see these) loses you speakers
//   - carry more than MAX_SENSES and you're too vague to be useful
//   - carry none and nobody knows what you mean
//   - every century some speakers forget you anyway
// Reach 0 speakers and you're obsolete. Survive to the last century carrying
// the meaning you have today to win, and see the perfect route.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Etymon = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const REACH = 20;
  const MIN_BREADTH = 5;
  const MAX_BREADTH = 30;
  // Each century you may broaden by up to BROADEN or narrow by up to NARROW:
  // meanings spread easily and are slow to shed.
  const BROADEN = 4;
  const NARROW = 2;
  const MAX_SENSES = 3;
  const START_SPEAKERS = 100;
  const MAX_SPEAKERS = 400;
  const GAIN = { needed: 18, plain: 3 };
  const SCORN = 15;
  const VAGUE = 10; // per sense over MAX_SENSES
  const MEANINGLESS = 20;
  const FORGETTING = 10;
  const ARRIVAL_BONUS = 100;
  const SIGHT = 24; // how far from your word you can make out other senses

  // Landmarks are [x, y, a quote using the word in that sense, and the year
  // the sense appears, if not from the start]. `history` is the sense the
  // word really had each century, and `route` is the best way to play it:
  // each century's [x, y, breadth], a move a player could make, found by
  // searching every legal move. Each century is
  // [year, the senses it wants, the word's spelling then, a clue to what it
  // wants, the senses it scorns].
  const LEVELS = [
    {
      id: 'nice', word: 'nice', origin: 'Latin nescius, "not knowing"',
      start: 'ignorant', breadth: 10, target: 'pleasant',
      blurb: 'Borrowed from Old French in about 1300, it meant "foolish" or "ignorant". Make it mean "pleasant".',
      landmarks: {
        ignorant: [12, 22, 'he was nyce and knew no letters'],
        foolish: [24, 34, 'a nyce fool, soon deceived'],
        wanton: [32, 12, 'nyce and wanton in her ways'],
        strange: [14, 60, 'a nice and strange device'],
        shy: [40, 44, 'too nice to speak at court'],
        fussy: [52, 30, 'nice about his meat and drink'],
        delicate: [44, 68, 'a nice and tender plant'],
        precise: [68, 20, 'a nice distinction between the two'],
        dainty: [60, 52, 'nice in her dress'],
        agreeable: [74, 66, 'a nice young man'],
        kind: [82, 84, 'it was nice of you to come'],
        pleasant: [88, 48, 'a nice day at the seaside'],
        coy: [28, 48, 'nice and coy, she turned away'],
        lavish: [30, 86, 'nice and costly attire', 1400],
        subtle: [52, 6, 'a nice point of law', 1500],
        tasty: [64, 86, 'a nice cup of tea', 1800],
        sarcastic: [94, 28, 'oh, very nice', 1900],
      },
      eras: [
        [1300, ['foolish', 'wanton'], 'nyce', 'Minstrels mock the gullible and the lusty.', ['ignorant']],
        [1400, ['wanton', 'shy'], 'nyce', 'Courtly love: gallants flirt, ladies blush.', ['foolish']],
        [1500, ['shy', 'fussy'], 'nyse', 'Manners multiply, and everyone frets over them.', ['coy']],
        [1600, ['subtle', 'precise'], 'nice', 'Scholars and lawyers split hairs.', ['shy']],
        [1700, ['precise', 'dainty'], 'nice', 'Science measures; fashion frills.', ['fussy']],
        [1800, ['agreeable', 'tasty'], 'nice', 'Drawing rooms, tea, and polite company.', ['dainty']],
        [1900, ['sarcastic', 'pleasant'], 'nice', 'Postcards from the seaside, and a new irony.', ['agreeable']],
        [2000, ['pleasant', 'kind'], 'nice', 'Everything is lovely, thanks for asking.', ['sarcastic']],
      ],
      history: ['foolish', 'wanton', 'shy', 'fussy', 'precise', 'agreeable', 'pleasant', 'pleasant'],
      route: [[26, 24, 14], [32, 28, 18], [42, 34, 18], [60, 26, 22], [78, 34, 26], [88, 40, 30], [86, 40, 28], [86, 60, 26]],
    },
    {
      id: 'silly', word: 'silly', origin: 'Old English sǣlig, "blessed, happy"',
      start: 'blessed', breadth: 10, target: 'foolish',
      blurb: 'In Old English it meant "blessed". Make it mean "foolish".',
      landmarks: {
        blessed: [14, 16, 'seely is the man that God loves'],
        holy: [32, 8, 'a seely saint'],
        happy: [12, 42, 'a seely time'],
        lucky: [24, 58, 'a sely chance'],
        innocent: [36, 30, 'the seely lamb'],
        harmless: [50, 16, 'seely and meek'],
        pitiable: [54, 40, 'the sely wretch'],
        weak: [76, 14, 'silly walls that would not hold'],
        feeble: [68, 30, 'a silly old man, weak with years'],
        rustic: [48, 64, 'silly shepherds'],
        simple: [70, 56, 'silly, plain folk'],
        foolish: [88, 72, 'a silly question'],
        saintly: [48, 4, 'a seely martyr'],
        cheerful: [8, 72, 'seely and glad'],
        gullible: [60, 84, 'silly sheep, easily led', 1500],
        stunned: [94, 46, 'knocked silly', 1600],
        trivial: [78, 92, 'a silly little thing', 1600],
      },
      eras: [
        [1000, ['holy', 'happy'], 'sǣlig', 'Monks copy psalms and feast on saints\' days.', ['harmless']],
        [1100, ['innocent', 'saintly'], 'seely', 'Sermons on lambs and martyrs.', ['happy']],
        [1200, ['innocent', 'harmless'], 'seely', 'Friars preach meekness to the poor.', ['holy']],
        [1300, ['pitiable', 'cheerful'], 'sely', 'Plague years: pity, and dancing anyway.', ['saintly']],
        [1400, ['pitiable', 'feeble'], 'sely', 'Old soldiers beg at the gates.', ['innocent']],
        [1500, ['gullible', 'rustic'], 'silly', 'Pastoral poems, and swindlers at the fair.', ['weak']],
        [1600, ['simple', 'stunned'], 'silly', 'Stage clowns: plain folk, and pratfalls.', ['pitiable']],
        [1700, ['foolish', 'trivial'], 'silly', 'Wits in the coffee houses mock everything.', ['rustic']],
      ],
      history: ['blessed', 'innocent', 'innocent', 'harmless', 'pitiable', 'feeble', 'simple', 'foolish'],
      route: [[26, 20, 14], [46, 20, 18], [36, 30, 22], [40, 32, 20], [58, 40, 24], [60, 56, 28], [74, 58, 26], [82, 70, 26]],
    },
    {
      id: 'awful', word: 'awful', origin: 'Old English egefull, "full of awe"',
      start: 'awe-inspiring', breadth: 10, target: 'very bad',
      blurb: 'It meant "inspiring awe", as of God. Make it mean "very bad".',
      landmarks: {
        'awe-inspiring': [14, 80, 'the awful majesty of God'],
        majestic: [30, 92, 'an awful throne'],
        reverent: [8, 56, 'awful, they knelt'],
        sublime: [26, 66, 'awful mountains'],
        solemn: [40, 74, 'an awful silence in the church'],
        wonderful: [56, 88, 'awful splendour'],
        terrifying: [44, 50, 'an awful storm'],
        great: [70, 70, 'an awful lot'],
        dreadful: [60, 38, 'awful news'],
        very: [88, 56, 'awful nice of you'],
        ugly: [70, 20, 'an awful hat'],
        'very bad': [86, 26, 'that was awful'],
        pious: [6, 94, 'awful worship'],
        sinful: [26, 32, 'awful deeds'],
        gruesome: [46, 20, 'an awful sight', 1500],
        enormous: [80, 86, 'an awful big house', 1700],
        tiresome: [94, 8, 'an awful bore', 1900],
      },
      eras: [
        [1200, ['reverent', 'pious'], 'aȝefull', 'Cathedrals rise; the faithful kneel.', ['sublime']],
        [1300, ['solemn', 'sinful'], 'aweful', 'Doom paintings over every chancel arch.', ['majestic']],
        [1400, ['solemn', 'terrifying'], 'aweful', 'Requiems, and storms at sea.', ['pious']],
        [1500, ['gruesome', 'sublime'], 'awfull', 'Executions in the square; mountains in the poems.', ['solemn']],
        [1600, ['dreadful', 'sublime'], 'awful', 'Tragedies on the stage, and grim news from the wars.', ['wonderful']],
        [1700, ['dreadful', 'enormous'], 'awful', 'Everything is bigger: cities, debts, wigs.', ['terrifying']],
        [1800, ['ugly', 'very'], 'awful', 'Novels of fashion: frightful bonnets, frightfully dull.', ['great']],
        [1900, ['very bad', 'tiresome'], 'awful', 'Slang everywhere; complaints about everything.', ['dreadful']],
      ],
      history: ['reverent', 'solemn', 'terrifying', 'terrifying', 'dreadful', 'dreadful', 'ugly', 'very bad'],
      route: [[8, 68, 14], [22, 74, 18], [30, 58, 22], [34, 42, 26], [48, 54, 26], [66, 60, 24], [70, 44, 24], [82, 28, 24]],
    },
    {
      id: 'girl', word: 'girl', origin: 'Middle English gyrle, "a child"',
      start: 'child', breadth: 18, target: 'young woman', targetMaxBreadth: 9,
      blurb: 'Chaucer\'s "girles" were children, boys included. Narrow it until it means only "young woman".',
      landmarks: {
        child: [50, 50, 'the gyrles of the parish, both boys and maids'],
        boy: [36, 42, 'a knave gerl, a boy'],
        infant: [48, 32, 'a gyrle in swaddling'],
        'young person': [58, 62, 'girles and lads at play'],
        peasant: [26, 62, 'country girles'],
        rogue: [22, 30, 'a ragged girle of the streets'],
        servant: [72, 38, 'the girl brought the tea'],
        daughter: [62, 80, 'my girl is to be wed'],
        sweetheart: [80, 76, 'my best girl'],
        'young woman': [82, 56, 'a girl of twenty'],
        beggar: [12, 46, 'a poor girle at the gate'],
        pupil: [34, 80, 'the girles at their letters'],
        flirt: [94, 88, 'a gay girl', 1700],
        shopgirl: [92, 28, 'the girl at the counter', 1800],
        friends: [70, 94, 'a night out with the girls', 1900],
      },
      eras: [
        [1300, ['child', 'young person'], 'gyrle', 'Village feast days: children everywhere.', ['rogue']],
        [1400, ['beggar', 'boy'], 'girle', 'Famine roads, and boys sent out to work.', ['servant']],
        [1500, ['young person', 'pupil'], 'gerle', 'Grammar schools open their doors.', ['beggar']],
        [1600, ['servant', 'young woman'], 'girle', 'Great houses fill with staff.', ['peasant']],
        [1700, ['flirt', 'daughter'], 'girl', 'Masquerades, and marriages arranged.', ['boy']],
        [1800, ['shopgirl', 'sweetheart'], 'girl', 'Department stores and love letters.', ['servant']],
        [1900, ['young woman', 'friends'], 'girl', 'Dance halls and nights out.', ['flirt']],
        [2000, ['young woman', 'daughter'], 'girl', 'Birthday cards and graduations.', ['servant']],
      ],
      history: ['child', 'young person', 'young person', 'young woman', 'young woman', 'young woman', 'young woman', 'young woman'],
      route: [[40, 62, 18], [44, 52, 18], [50, 50, 18], [68, 50, 16], [68, 56, 14], [76, 66, 12], [72, 56, 10], [74, 56, 8]],
    },
    {
      id: 'meat', word: 'meat', origin: 'Old English mete, "food"',
      start: 'food', breadth: 18, target: 'flesh', targetMaxBreadth: 10,
      blurb: 'It meant any food: "meat and drink". Narrow it down to animal flesh.',
      landmarks: {
        food: [46, 50, 'mete and drink'],
        meal: [38, 66, 'at mete, the king spoke'],
        provisions: [28, 28, 'mete for the journey'],
        nourishment: [34, 44, 'mete for the soul'],
        fodder: [20, 56, 'mete for the cattle'],
        bread: [60, 70, 'the mete of the poor'],
        kernel: [58, 24, 'the meat of a nut'],
        fish: [68, 46, 'fish and other meate'],
        substance: [76, 70, 'the meat of the argument'],
        flesh: [86, 34, 'a joint of meat'],
        body: [92, 10, 'the flesh is weak'],
        dish: [16, 78, 'a mete of eels'],
        feast: [30, 90, 'great mete at the wedding'],
        pulp: [44, 12, 'the meat of the apple', 1300],
        venison: [78, 50, 'red meat of the deer', 1400],
        gist: [94, 86, 'the meat of the matter', 1700],
      },
      eras: [
        [1000, ['food', 'provisions'], 'mete', 'A hard winter; stores run low.', ['kernel']],
        [1100, ['feast', 'food'], 'mete', 'Norman lords and their banquets.', ['fodder']],
        [1200, ['meal', 'nourishment'], 'mete', 'Monasteries ring the bell for supper.', ['feast']],
        [1300, ['fish', 'pulp'], 'mete', 'Fast days, and orchards in the cloister.', ['bread']],
        [1400, ['venison', 'body'], 'mete', 'Royal hunts, and preachers on the weakness of the body.', ['substance']],
        [1500, ['flesh', 'body'], 'meate', 'Butchers organise into guilds.', ['fish']],
        [1600, ['flesh', 'kernel'], 'meat', 'Roast beef of old England, and nuts from the colonies.', ['venison']],
        [1700, ['flesh', 'gist'], 'meat', 'Pamphleteers argue the heart of every matter.', ['food']],
      ],
      history: ['food', 'food', 'meal', 'fish', 'fish', 'flesh', 'flesh', 'flesh'],
      route: [[32, 40, 18], [32, 40, 18], [38, 48, 18], [54, 36, 18], [72, 36, 16], [86, 22, 14], [76, 38, 12], [78, 40, 10]],
    },
  ];

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round = (v) => Math.round(v * 10) / 10;

  // The senses that exist by `year` (all of them if no year).
  function landmarks(level, year = Infinity) {
    return Object.entries(level.landmarks)
      .map(([name, [x, y, quote, from]]) => ({ name, x, y, quote, from: from || 0 }))
      .filter((l) => l.from <= year);
  }
  const landmark = (level, name) => landmarks(level).find((l) => l.name === name);

  function newGame(levelIndex = 0) {
    const level = LEVELS[levelIndex];
    const start = landmark(level, level.start);
    const g = {
      levelIndex, era: 0, x: start.x, y: start.y, r: level.breadth, speakers: START_SPEAKERS,
      trail: [{ x: start.x, y: start.y, r: level.breadth }], log: [], over: false, outcome: null,
      seen: [],
    };
    look(g);
    return g;
  }

  // Senses you can make out: those near you, the one you're heading for,
  // the ones this century scorns, and any you've made out before.
  function look(g) {
    const level = levelOf(g);
    const seen = new Set(g.seen);
    seen.add(level.target);
    for (const name of scornedNow(g)) seen.add(name);
    for (const l of landmarks(level, eraOf(g)[0])) if (dist(l, g) <= SIGHT + g.r) seen.add(l.name);
    g.seen = [...seen];
  }

  const levelOf = (g) => LEVELS[g.levelIndex];
  const eraOf = (g) => levelOf(g).eras[Math.min(g.era, levelOf(g).eras.length - 1)];
  const scornedNow = (g) => eraOf(g)[4] || [];

  // Where a move may go: within REACH of where you are, on the map, and
  // at most BROADEN broader or NARROW narrower than you are now.
  function constrain(g, move) {
    let { x, y } = move;
    const d = Math.hypot(x - g.x, y - g.y);
    if (d > REACH) {
      x = g.x + ((x - g.x) * REACH) / d;
      y = g.y + ((y - g.y) * REACH) / d;
    }
    const r = clamp(move.r === undefined ? g.r : move.r,
      Math.max(MIN_BREADTH, g.r - NARROW), Math.min(MAX_BREADTH, g.r + BROADEN));
    return { x: round(clamp(x, 0, 100)), y: round(clamp(y, 0, 100)), r };
  }

  // What the coming century would do to you if you moved there.
  function preview(g, move) {
    const m = constrain(g, move);
    const level = levelOf(g);
    const needed = eraOf(g)[1];
    const scorned = scornedNow(g);
    const senses = landmarks(level, eraOf(g)[0]).filter((l) => dist(l, m) <= m.r);
    const reasons = [];
    for (const s of senses) {
      if (scorned.includes(s.name)) {
        reasons.push({ sense: s.name, scorned: true, amount: -SCORN, ifPlain: -SCORN, ifWanted: -SCORN, text: `${s.name} is scorned` });
        continue;
      }
      const isNeeded = needed.includes(s.name);
      // What the player can know beforehand: the gain if it isn't wanted, and if it is.
      reasons.push({
        sense: s.name, amount: isNeeded ? GAIN.needed : GAIN.plain, needed: isNeeded,
        ifPlain: GAIN.plain, ifWanted: GAIN.needed, text: s.name,
      });
    }
    if (senses.length > MAX_SENSES) {
      reasons.push({ amount: -VAGUE * (senses.length - MAX_SENSES), text: `too vague: ${senses.length} senses` });
    }
    if (!senses.length) reasons.push({ amount: -MEANINGLESS, text: 'nobody knows what you mean' });
    reasons.push({ amount: -FORGETTING, text: 'forgotten by some' });
    const delta = reasons.reduce((n, r) => n + r.amount, 0);
    // The range the player sees: no sense wanted, to every sense wanted.
    const sure = reasons.reduce((n, r) => n + (r.sense ? r.ifPlain : r.amount), 0);
    const best = reasons.reduce((n, r) => n + (r.sense ? r.ifWanted : r.amount), 0);
    return { move: m, senses: senses.map((s) => s.name), reasons, delta, range: [sure, best] };
  }

  function reachedTarget(g, at = g) {
    const level = levelOf(g);
    const t = landmark(level, level.target);
    return dist(t, at) <= at.r && (!level.targetMaxBreadth || at.r <= level.targetMaxBreadth);
  }

  // Let a century pass with you at `move`.
  function advance(g, move) {
    if (g.over) return null;
    const level = levelOf(g);
    const p = preview(g, move);
    Object.assign(g, p.move);
    g.speakers = clamp(g.speakers + p.delta, 0, MAX_SPEAKERS);
    g.trail.push({ ...p.move });
    const year = eraOf(g)[0];
    g.log.push({
      year, form: eraOf(g)[2], senses: p.senses, wanted: eraOf(g)[1], scorned: scornedNow(g),
      delta: p.delta, speakers: g.speakers,
    });

    g.era++;
    if (g.era < level.eras.length) look(g);
    if (g.speakers <= 0) {
      g.over = true;
      g.outcome = 'obsolete';
    } else if (g.era >= level.eras.length) {
      g.over = true;
      g.outcome = reachedTarget(g) ? 'arrived' : 'survived';
    }
    return p;
  }

  function score(g) {
    if (g.outcome === 'obsolete') return 0;
    return g.speakers + (g.outcome === 'arrived' ? ARRIVAL_BONUS : 0);
  }

  // The meanings the word really took, played perfectly through the same rules.
  function historyGame(levelIndex) {
    const g = newGame(levelIndex);
    for (const [x, y, r] of LEVELS[levelIndex].route) if (!g.over) advance(g, { x, y, r });
    return g;
  }

  return {
    LEVELS, REACH, SIGHT, MIN_BREADTH, MAX_BREADTH, BROADEN, NARROW, MAX_SENSES, SCORN, ARRIVAL_BONUS, START_SPEAKERS,
    landmarks, newGame, eraOf, scornedNow, constrain, preview, advance, reachedTarget, score, historyGame,
  };
});
