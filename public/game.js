// Etymon's rules. No DOM here, so the page and the tests share it.
//
// You are a word. The map is meaning: each landmark is a sense a word can
// have, and your circle is the senses you carry. Each century you drift
// (up to REACH across the map) and may broaden a lot or narrow a little, then
// the century passes and your speakers change:
//   - each century you choose what happens: your world's event, or one that
//     changes history. The event sets the century's tastes.
//   - each sense you carry wins speakers, a lot more if the century needs
//     words for it (you only learn which afterwards)
//   - each sense out of fashion this century loses you speakers
//   - fads sprout next to senses you've carried: they pay well the century
//     they appear, then go out of fashion two centuries later
//   - carry more than MAX_SENSES and you're too vague: what you win is diluted
//   - carry none and nobody knows what you mean
//   - every century some speakers forget you anyway
// Reach 0 speakers and you're obsolete. What you mean today is hidden until
// the last REVEAL centuries. Survive to the last century carrying it to win,
// and see the perfect route.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./routes.js'));
  else root.Etymon = factory(root.EtymonRoutes);
})(typeof self !== 'undefined' ? self : this, function (ROUTES) {
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
  const MAX_SPEAKERS = 600;
  const GAIN = { needed: 30, plain: 3 };
  const SCORN = 25;
  const FAD = 12; // a fad, the century it sprouts
  const FAD_LIFE = 2; // centuries until a fad is out of fashion
  const REVEAL = 3; // centuries left when you learn what you're becoming
  const ON_COURSE = 3; // history's events kept by then, for the real ending
  const MEANINGLESS = 20;
  const FORGETTING = 10;
  const ARRIVAL_BONUS = 100;
  const SIGHT = 24; // how far from your word you can make out other senses

  // Landmarks are [x, y, a quote using the word in that sense, and the year
  // the sense appears, if not from the start]. `eras` are [year, the word's
  // spelling then]. `worlds` are the histories the word can live through, one
  // for each ending: `target`'s is the real one. Each has an event a century,
  // [its clue, the senses it wants, the senses out of fashion, a clue to
  // those], and each century you choose your world's event or one that
  // changes history. `history` is what the word really meant each century.
  // `fads` are [x, y, quote, the sense that makes them sprout], appearing the
  // century after you carry it. `endings` are what the word can mean today.
  // Perfect routes to each are in routes.js, made by scripts/routes.js.
  const LEVELS = [
    {
      id: 'nice', word: 'nice', origin: 'Latin nescius, "not knowing"',
      start: 'ignorant', startAt: [18, 28], breadth: 10, target: 'pleasant',
      blurb: 'Borrowed from Old French in about 1300, it meant "foolish" or "ignorant".',
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
        effeminate: [22, 6, 'nyce and womanish in his array'],
        trivial: [8, 92, 'nice and idle tales'],
        refined: [56, 40, 'a nice taste in music', 1700],
        respectable: [48, 96, 'a nice girl from a nice family', 1800],
      },
      endings: {
        pleasant: { text: 'Today nice means pleasant: "a nice day at the seaside". Just as history had it.' },
        foolish: { text: 'In your world nice never grew up: "don\'t be nice" means don\'t be daft.' },
        precise: { text: 'In your world the scholars kept nice: it means exact, as in "a nice distinction", and nothing else.' },
        delicate: { text: 'In your world nice means fragile: "handle it nicely, it\'s nice".' },
      },
      fads: {
        lecherous: [40, 22, 'a nice old lecher', 'wanton'],
        cowardly: [46, 54, 'too nice to fight', 'shy'],
        pedantic: [80, 12, 'a nice pedant', 'precise'],
        prim: [70, 42, 'nice and prim', 'dainty'],
        posh: [62, 74, 'a nice neighbourhood', 'agreeable'],
      },
      eras: [[1300, 'nyce'], [1400, 'nyce'], [1500, 'nyse'], [1600, 'nice'], [1700, 'nice'], [1800, 'nice'], [1900, 'nice'], [2000, 'nice']],
      worlds: {
        pleasant: [
          ['Minstrels mock the gullible and the lusty.', ['foolish', 'wanton'], ['shy', 'effeminate'], 'Bold knights have no patience for the bashful, or the soft.'],
          ['Courtly love: gallants flirt, ladies blush.', ['wanton', 'shy'], ['foolish', 'trivial'], 'The court has no time for fools, or idle chatter.'],
          ['Manners multiply, and everyone frets over them.', ['shy', 'fussy'], ['coy', 'ignorant'], 'Plain dealing and the new learning: no more playing hard to get, and no more dunces.'],
          ['Scholars and lawyers split hairs.', ['subtle', 'precise'], ['shy', 'lavish'], 'Wits and Puritans: the tongue-tied are left behind, and finery frowned on.'],
          ['Science measures; fashion frills.', ['precise', 'dainty'], ['fussy', 'effeminate'], 'Enlightened gentlemen sneer at fuss, and at fops.'],
          ['Drawing rooms, tea, and polite company.', ['agreeable', 'tasty'], ['dainty', 'wanton'], 'Rugged Romantics laugh at frills; Victorians blush at anything racy.'],
          ['Postcards from the seaside, and a new irony.', ['sarcastic', 'pleasant'], ['agreeable', 'respectable'], 'Mere politeness is the dullest thing going, and respectability a bore.'],
          ['Everything is lovely, thanks for asking.', ['pleasant', 'kind'], ['sarcastic', 'precise'], 'Earnest is in, irony is so last century, and nobody splits hairs.'],
        ],
        foolish: [
          ['Jesters at every feast, and nobody reads.', ['foolish', 'ignorant'], ['shy', 'delicate'], 'Nobody has time for the timid or the tender.'],
          ['Fools\' feasts and travelling wonders.', ['foolish', 'strange'], ['precise', 'dainty'], 'Nobody minds their manners or their measures.'],
          ['Idle tales and pranks at court.', ['trivial', 'foolish'], ['subtle', 'fussy'], 'Fine distinctions bore everyone.'],
          ['Comedies of clowns and teasing lovers.', ['foolish', 'coy'], ['precise', 'delicate'], 'No one splits hairs, or handles anything gently.'],
          ['Gin lanes and gossip sheets.', ['ignorant', 'trivial'], ['refined', 'precise'], 'Polish and precision are for prigs.'],
          ['Music halls and freak shows.', ['foolish', 'strange'], ['respectable', 'agreeable'], 'Respectability is a bore.'],
          ['Slapstick on the silent screen.', ['foolish', 'sarcastic'], ['kind', 'pleasant'], 'Sweetness is for suckers.'],
          ['Daft videos, endlessly shared.', ['foolish', 'trivial'], ['precise', 'refined'], 'Nobody cares about getting it right.'],
        ],
        precise: [
          ['Clerks copy every word exactly.', ['precise', 'fussy'], ['wanton', 'coy'], 'The clerks frown on flirting.'],
          ['Monks argue over every letter.', ['fussy', 'precise'], ['lavish', 'wanton'], 'Extravagance and lust are sins.'],
          ['Lawyers split hairs.', ['subtle', 'precise'], ['foolish', 'trivial'], 'No patience for fools, or idle talk.'],
          ['Scholars quarrel in Latin.', ['subtle', 'fussy'], ['lavish', 'coy'], 'Puritans frown on finery and flirting.'],
          ['The Royal Society measures everything.', ['precise', 'refined'], ['ignorant', 'strange'], 'Superstition is out.'],
          ['Clerks and governesses keep everything just so.', ['precise', 'fussy'], ['tasty', 'wanton'], 'Appetites are vulgar.'],
          ['Engineers and examiners.', ['precise', 'subtle'], ['sarcastic', 'trivial'], 'Irony and trifles are frowned on.'],
          ['Data, and the fine print.', ['precise', 'subtle'], ['pleasant', 'kind'], 'Mere niceness counts for nothing.'],
        ],
        delicate: [
          ['Herbalists tend tender seedlings.', ['delicate', 'shy'], ['wanton', 'ignorant'], 'Brutes and lechers are shunned.'],
          ['Odd and tender plants from the East.', ['delicate', 'strange'], ['foolish', 'trivial'], 'Fools and chatter are out.'],
          ['Silks for the rich, care for the frail.', ['delicate', 'lavish'], ['ignorant', 'coy'], 'No dunces, and no games.'],
          ['Lace and fine glass.', ['delicate', 'dainty'], ['foolish', 'strange'], 'Fools\' festivals and freak shows are banned.'],
          ['Porcelain from China.', ['delicate', 'refined'], ['ignorant', 'wanton'], 'Coarse manners are out.'],
          ['Pressed flowers and fainting heroines.', ['delicate', 'dainty'], ['tasty', 'fussy'], 'Hearty food and fuss are common.'],
          ['Tea rooms: fine china and fancy cakes.', ['delicate', 'tasty'], ['sarcastic', 'agreeable'], 'Irony and small talk are vulgar.'],
          ['Handle with care, and be gentle.', ['delicate', 'kind'], ['sarcastic', 'trivial'], 'Snark and fluff are out.'],
        ],
      },
      history: ['foolish', 'wanton', 'shy', 'fussy', 'precise', 'agreeable', 'pleasant', 'pleasant'],
    },
    {
      id: 'silly', word: 'silly', origin: 'Old English sǣlig, "blessed, happy"',
      start: 'blessed', breadth: 10, target: 'foolish',
      blurb: 'In Old English it meant "blessed".',
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
        helpless: [62, 24, 'the sely, helpless babe'],
        humble: [30, 78, 'a sely, humble cottar'],
        childish: [72, 78, 'silly as a child', 1600],
        giddy: [8, 92, 'silly and giddy with ale', 1500],
      },
      endings: {
        foolish: { text: 'Today silly means foolish: "a silly question". Just as history had it.' },
        holy: { text: 'In your world silly stayed blessed: carols sing of a "silly night", and nobody laughs.' },
        weak: { text: 'In your world silly means flimsy: "don\'t lean on that, it\'s silly".' },
        rustic: { text: 'In your world silly means countryfolk: "silly cheese from the hills".' },
      },
      fads: {
        pious: [22, 4, 'a seely, pious soul', 'holy'],
        meek: [62, 6, 'meek as a seely lamb', 'harmless'],
        naive: [40, 46, 'silly and trusting', 'innocent'],
        sickly: [84, 30, 'a silly, sickly child', 'feeble'],
        clumsy: [80, 62, 'a silly, clumsy lad', 'simple'],
      },
      eras: [[1000, 'sǣlig'], [1100, 'seely'], [1200, 'seely'], [1300, 'sely'], [1400, 'sely'], [1500, 'silly'], [1600, 'silly'], [1700, 'silly']],
      worlds: {
        foolish: [
          ['Monks copy psalms and feast on saints\' days.', ['holy', 'happy'], ['harmless', 'helpless'], 'Raiders on the coast: the meek and the helpless go under.'],
          ['Sermons on lambs and martyrs.', ['innocent', 'saintly'], ['happy', 'cheerful'], 'Penance and fasting: mirth and merrymaking are frowned on.'],
          ['Friars preach meekness to the poor.', ['innocent', 'harmless'], ['holy', 'lucky'], 'Fat, worldly priests give holiness a bad name, and fortune-telling is a sin.'],
          ['Plague years: pity, and dancing anyway.', ['pitiable', 'cheerful'], ['saintly', 'humble'], 'The saints didn\'t stop the plague, and the poor who survive want more.'],
          ['Old soldiers beg at the gates.', ['pitiable', 'feeble'], ['innocent', 'holy'], 'Hard times: nobody believes in innocence, or in miracles.'],
          ['Pastoral poems, and swindlers at the fair.', ['gullible', 'rustic'], ['weak', 'blessed'], 'A warrior king despises weakness, and reformers the old blessings.'],
          ['Stage clowns: plain folk, and pratfalls.', ['simple', 'stunned'], ['pitiable', 'helpless'], 'Pity is out of fashion: the beggars and the helpless are whipped.'],
          ['Wits in the coffee houses mock everything.', ['foolish', 'trivial'], ['rustic', 'humble'], 'Town wits sneer at country bumpkins and at humble pie.'],
        ],
        holy: [
          ['Monks copy psalms by candlelight.', ['holy', 'saintly'], ['lucky', 'cheerful'], 'Feasting and fortune are frowned on.'],
          ['Crusaders take the cross.', ['blessed', 'holy'], ['rustic', 'happy'], 'Peasant merriment is sinful.'],
          ['Cathedrals rise to the saints.', ['saintly', 'innocent'], ['lucky', 'cheerful'], 'Luck is pagan, and laughter idle.'],
          ['Pilgrims crowd the shrines.', ['holy', 'blessed'], ['pitiable', 'rustic'], 'The poor are told to bear it.'],
          ['Mystics and hermits.', ['holy', 'humble'], ['happy', 'lucky'], 'Pleasure is a snare.'],
          ['The old faith holds.', ['holy', 'saintly'], ['gullible', 'giddy'], 'Dupes and drunkards are scorned.'],
          ['Psalms in every parlour.', ['holy', 'blessed'], ['stunned', 'trivial'], 'Slapstick and trifles are sinful.'],
          ['Revivals in the fields.', ['holy', 'innocent'], ['foolish', 'trivial'], 'The wits are godless.'],
        ],
        weak: [
          ['Raiders burn the villages.', ['harmless', 'helpless'], ['holy', 'saintly'], 'The saints didn\'t save us.'],
          ['Old walls crumble.', ['harmless', 'feeble'], ['lucky', 'cheerful'], 'Nobody feels lucky, or merry.'],
          ['Famine years.', ['helpless', 'pitiable'], ['holy', 'happy'], 'God and joy seem far away.'],
          ['Plague years: the weak and the dying.', ['feeble', 'pitiable'], ['cheerful', 'saintly'], 'No dancing, and no miracles.'],
          ['Castles fall to cannon.', ['weak', 'feeble'], ['innocent', 'holy'], 'Nobody is innocent, nothing sacred.'],
          ['Flimsy houses of the poor.', ['weak', 'helpless'], ['blessed', 'rustic'], 'The country is no blessing.'],
          ['Old castles crumble; old soldiers totter.', ['weak', 'feeble'], ['simple', 'trivial'], 'No time for simpletons or trifles.'],
          ['Paper fans and silk slippers.', ['weak', 'trivial'], ['foolish', 'simple'], 'Fools and bumpkins are out.'],
        ],
        rustic: [
          ['Harvest home in the fields.', ['happy', 'lucky'], ['holy', 'harmless'], 'Priests and milksops are mocked.'],
          ['Market-town fairs.', ['rustic', 'cheerful'], ['saintly', 'pitiable'], 'No saints, and no beggars.'],
          ['Village dances on the green.', ['rustic', 'humble'], ['holy', 'weak'], 'The church is far off, and the weak stay home.'],
          ['Ploughmen in the ballads.', ['rustic', 'simple'], ['saintly', 'feeble'], 'Saints and weaklings are out of the songs.'],
          ['Peasants rise up, and win.', ['rustic', 'cheerful'], ['innocent', 'pitiable'], 'Nobody wants pity now.'],
          ['Pastoral poems.', ['rustic', 'simple'], ['weak', 'holy'], 'Neither the frail nor the pious are sung.'],
          ['Country fairs and morris dancing.', ['rustic', 'humble'], ['stunned', 'trivial'], 'Pratfalls and trifles are for town.'],
          ['Farmers\' almanacs.', ['rustic', 'simple'], ['foolish', 'giddy'], 'Fools and drunks are town folk.'],
        ],
      },
      history: ['blessed', 'innocent', 'innocent', 'harmless', 'pitiable', 'feeble', 'simple', 'foolish'],
    },
    {
      id: 'awful', word: 'awful', origin: 'Old English egefull, "full of awe"',
      start: 'awe-inspiring', breadth: 10, target: 'very bad',
      blurb: 'It meant "inspiring awe", as of God.',
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
        fearful: [10, 18, 'awful of the dark', 1500],
        mighty: [56, 58, 'an awful king and his host'],
        monstrous: [58, 6, 'an awful beast', 1500],
        tremendous: [94, 72, 'in an awful hurry', 1800],
      },
      endings: {
        'very bad': { text: 'Today awful means very bad: "that was awful". Just as history had it.' },
        wonderful: { text: 'In your world awful went the way of awesome: "the concert was awful!" is praise.' },
        solemn: { text: 'In your world awful still belongs in church: "an awful silence" is a holy one.' },
        enormous: { text: 'In your world awful just means big: "an awful house" is a mansion.' },
      },
      fads: {
        hallowed: [8, 40, 'awful and holy ground', 'reverent'],
        grim: [42, 86, 'an awful grim face', 'solemn'],
        ghastly: [34, 42, 'an awful, ghastly face', 'terrifying'],
        shocking: [68, 50, 'awful manners', 'dreadful'],
        excessive: [66, 82, 'awful prices', 'great'],
      },
      eras: [[1200, 'aȝefull'], [1300, 'aweful'], [1400, 'aweful'], [1500, 'awfull'], [1600, 'awful'], [1700, 'awful'], [1800, 'awful'], [1900, 'awful']],
      worlds: {
        'very bad': [
          ['Cathedrals rise; the faithful kneel.', ['reverent', 'pious'], ['sublime', 'great'], 'Wild crags are the devil\'s country, and boasting is a sin.'],
          ['Doom paintings over every chancel arch.', ['solemn', 'sinful'], ['majestic', 'mighty'], 'Barons humble the king and his strongmen.'],
          ['Requiems, and storms at sea.', ['solemn', 'terrifying'], ['pious', 'sinful'], 'Lollards jeer at outward piety, and at the priests\' talk of sin.'],
          ['Executions in the square; mountains in the poems.', ['gruesome', 'sublime'], ['solemn', 'reverent'], 'Reformers strip the altars of ceremony, and get up off their knees.'],
          ['Tragedies on the stage, and grim news from the wars.', ['dreadful', 'sublime'], ['wonderful', 'monstrous'], 'Sceptics scoff at marvels and monsters.'],
          ['Everything is bigger: cities, debts, wigs.', ['dreadful', 'enormous'], ['terrifying', 'fearful'], 'Reason tames the old terrors, and nobody admits to being afraid.'],
          ['Novels of fashion: frightful bonnets, frightfully dull.', ['ugly', 'very'], ['great', 'pious'], 'Grandeur looks vulgar now, and piety is for Sundays.'],
          ['Slang everywhere; complaints about everything.', ['very bad', 'tiresome'], ['dreadful', 'majestic'], 'Penny dreadfuls are for children, and empires are going out of style.'],
        ],
        wonderful: [
          ['Kings crowned in splendour.', ['majestic', 'wonderful'], ['sinful', 'terrifying'], 'Nobody wants sin or fear.'],
          ['Marvels brought back from the East.', ['wonderful', 'great'], ['sinful', 'pious'], 'The preachers are ignored.'],
          ['Royal progresses through the mountains.', ['majestic', 'sublime'], ['terrifying', 'solemn'], 'No dread, and no long faces.'],
          ['Explorers\' tales of new worlds.', ['wonderful', 'sublime'], ['gruesome', 'dreadful'], 'Horrors are out of fashion.'],
          ['Masques and fireworks.', ['wonderful', 'mighty'], ['dreadful', 'fearful'], 'Gloom and fright are banished.'],
          ['Wonders of science.', ['wonderful', 'great'], ['terrifying', 'monstrous'], 'Reason tames the monsters.'],
          ['Great exhibitions.', ['wonderful', 'tremendous'], ['ugly', 'dreadful'], 'Nobody admits to anything grim.'],
          ['Jazz and moving pictures.', ['wonderful', 'very'], ['very bad', 'tiresome'], 'Moaning is out.'],
        ],
        solemn: [
          ['Cathedrals rise; the faithful kneel.', ['reverent', 'solemn'], ['great', 'wonderful'], 'Boasting and marvels are vanity.'],
          ['Requiem bells.', ['solemn', 'pious'], ['majestic', 'great'], 'Kings and their pomp are humbled.'],
          ['Chantries for the dead.', ['solemn', 'reverent'], ['wonderful', 'sublime'], 'Marvels and mountains distract from prayer.'],
          ['Old rites kept in secret.', ['solemn', 'pious'], ['gruesome', 'monstrous'], 'Horrors are for the street.'],
          ['State funerals for great men.', ['solemn', 'majestic'], ['wonderful', 'mighty'], 'No fireworks, no swagger.'],
          ['Sermons and silence.', ['solemn', 'reverent'], ['enormous', 'great'], 'Size is vulgar.'],
          ['Gothic revival churches.', ['solemn', 'sublime'], ['very', 'ugly'], 'Slang and ugliness are frowned on.'],
          ['War memorials, vast and silent.', ['solemn', 'reverent'], ['very bad', 'tiresome'], 'Complaining is disrespectful.'],
        ],
        enormous: [
          ['Castles of unheard-of size.', ['great', 'mighty'], ['pious', 'reverent'], 'Nobody kneels any more.'],
          ['Armies of thousands.', ['great', 'majestic'], ['solemn', 'sinful'], 'No time for long faces or sin.'],
          ['Cannon and great ships.', ['mighty', 'great'], ['pious', 'reverent'], 'Prayer gives way to powder.'],
          ['Galleons and sea monsters.', ['great', 'monstrous'], ['solemn', 'pious'], 'Sailors scoff at sermons.'],
          ['Princes build palaces to outdo each other.', ['great', 'mighty'], ['reverent', 'solemn'], 'Humility is out.'],
          ['Everything is bigger: cities, debts, wigs.', ['enormous', 'great'], ['dreadful', 'terrifying'], 'Fear is for small minds.'],
          ['Railways and factories, bigger every year.', ['enormous', 'tremendous'], ['solemn', 'ugly'], 'Progress is neither grave nor ugly.'],
          ['Skyscrapers and ocean liners.', ['enormous', 'very'], ['very bad', 'solemn'], 'Pessimists are behind the times.'],
        ],
      },
      history: ['reverent', 'solemn', 'terrifying', 'terrifying', 'dreadful', 'dreadful', 'ugly', 'very bad'],
    },
    {
      id: 'girl', word: 'girl', origin: 'Middle English gyrle, "a child"',
      start: 'child', breadth: 18, target: 'young woman',
      blurb: 'Chaucer\'s "girles" were children, boys included.',
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
        maiden: [62, 14, 'a gerle, unwed and fair'],
        orphan: [8, 84, 'a foundling girle'],
        harlot: [30, 6, 'a girl of the town', 1600],
        playmate: [46, 70, 'girles at their games'],
      },
      endings: {
        'young woman': { maxBreadth: 9, text: 'Today girl means a young woman, and only that. Just as history had it.' },
        child: { maxBreadth: 12, text: 'In your world girl still means any child, as Chaucer had it: "boy girls and maid girls".' },
        servant: { maxBreadth: 12, text: 'In your world girl means a servant, of any age: "ring for the girl".' },
        pupil: { maxBreadth: 12, text: 'In your world girl means a schoolchild: "the girls are back at their letters".' },
      },
      fads: {
        urchin: [14, 22, 'a girl of the gutters', 'rogue'],
        apprentice: [28, 50, 'a girl bound to a trade', 'boy'],
        maidservant: [82, 32, 'the girl who lays the fires', 'servant'],
        bride: [50, 90, 'the girl to be married', 'daughter'],
        'chorus girl': [92, 68, 'a girl from the music hall', 'sweetheart'],
      },
      eras: [[1300, 'gyrle'], [1400, 'girle'], [1500, 'gerle'], [1600, 'girle'], [1700, 'girl'], [1800, 'girl'], [1900, 'girl'], [2000, 'girl']],
      worlds: {
        'young woman': [
          ['Village feast days: children everywhere.', ['child', 'young person'], ['rogue', 'servant'], 'The sheriff hangs the thieves, and serfs run from their lords.'],
          ['Famine roads, and boys sent out to work.', ['beggar', 'boy'], ['servant', 'peasant'], 'After the plague, nobody will serve for the old wages, and lords fear the peasants.'],
          ['Grammar schools open their doors.', ['young person', 'pupil'], ['beggar', 'orphan'], 'Poor laws drive vagrants and foundlings from the parish.'],
          ['Great houses fill with staff.', ['servant', 'young woman'], ['peasant', 'playmate'], 'Courtiers sneer at country folk, and Puritans at games.'],
          ['Masquerades, and marriages arranged.', ['flirt', 'daughter'], ['boy', 'maiden'], 'Boys are breeched at seven, and old maids are mocked.'],
          ['Department stores and love letters.', ['shopgirl', 'sweetheart'], ['servant', 'harlot'], 'Polite society pretends the servants, and the streetwalkers, aren\'t there.'],
          ['Dance halls and nights out.', ['young woman', 'friends'], ['flirt', 'maiden'], 'Respectable ladies frown on coquettes, and spinsters are old hat.'],
          ['Birthday cards and graduations.', ['young woman', 'daughter'], ['servant', 'harlot'], 'Nobody has servants any more, and nobody is called a fallen woman.'],
        ],
        child: [
          ['Village feast days: children everywhere.', ['child', 'infant'], ['rogue', 'servant'], 'Thieves and drudges are kept out.'],
          ['Games in the lanes.', ['child', 'playmate'], ['servant', 'maiden'], 'Nobody works, and nobody weds.'],
          ['Boys and girls together at play.', ['child', 'boy'], ['beggar', 'sweetheart'], 'No beggars, and no courting.'],
          ['Nurseries in the great houses.', ['child', 'infant'], ['harlot', 'servant'], 'The streets and the kitchens are hidden.'],
          ['Foundling hospitals.', ['child', 'orphan'], ['flirt', 'sweetheart'], 'Flirting is frowned on.'],
          ['Nurseries and schoolrooms in every house.', ['child', 'infant'], ['shopgirl', 'maiden'], 'Shop work and spinsters are out.'],
          ['School for every child, by law.', ['child', 'playmate'], ['flirt', 'young woman'], 'Grown-up girls are a worry.'],
          ['A baby boom: prams in every street.', ['child', 'infant'], ['young woman', 'friends'], 'Nights out are over.'],
        ],
        servant: [
          ['Serfs bound to the manor.', ['servant', 'peasant'], ['pupil', 'playmate'], 'No schooling, and no play.'],
          ['Hired hands on the roads.', ['servant', 'beggar'], ['pupil', 'infant'], 'No time for letters or babies.'],
          ['Pages and serving lads in the great hall.', ['servant', 'boy'], ['playmate', 'maiden'], 'Play and courtship wait.'],
          ['Great houses fill with staff.', ['servant', 'young person'], ['pupil', 'infant'], 'Schools and nurseries are shut.'],
          ['Workhouse children put to work.', ['servant', 'orphan'], ['flirt', 'sweetheart'], 'Romance is idleness.'],
          ['Below stairs and behind counters.', ['servant', 'shopgirl'], ['pupil', 'sweetheart'], 'No lessons, and no love letters.'],
          ['Maids in every middle-class home.', ['servant', 'young woman'], ['friends', 'flirt'], 'No nights out on a maid\'s wage.'],
          ['Au pairs and waitresses.', ['servant', 'young person'], ['friends', 'pupil'], 'Work comes first.'],
        ],
        pupil: [
          ['Priests teach the farmers\' children their letters.', ['pupil', 'child'], ['rogue', 'beggar'], 'Truants and beggars are shamed.'],
          ['Nursemaids teach their charges.', ['pupil', 'infant'], ['servant', 'rogue'], 'Drudges and rascals are kept away.'],
          ['Grammar schools open their doors.', ['pupil', 'young person'], ['beggar', 'servant'], 'Learning, not labour.'],
          ['Charity schools for poor children.', ['pupil', 'child'], ['harlot', 'peasant'], 'The street and the field are no place for a girl.'],
          ['Young ladies\' academies.', ['pupil', 'daughter'], ['flirt', 'servant'], 'Flirts and drudges are frowned on.'],
          ['Nurseries and schoolrooms.', ['pupil', 'infant'], ['shopgirl', 'servant'], 'Work can wait.'],
          ['School for every child, by law.', ['pupil', 'child'], ['flirt', 'servant'], 'Lessons first.'],
          ['Exams and school uniforms.', ['pupil', 'young person'], ['servant', 'harlot'], 'Nobody is in service now.'],
        ],
      },
      history: ['child', 'young person', 'young person', 'young woman', 'young woman', 'young woman', 'young woman', 'young woman'],
    },
    {
      id: 'meat', word: 'meat', origin: 'Old English mete, "food"',
      start: 'food', breadth: 18, target: 'flesh',
      blurb: 'It meant any food: "meat and drink".',
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
        portion: [6, 36, 'his mete for the day'],
        prey: [70, 10, 'mete for the hawks'],
        marrow: [80, 92, 'the meat of the bone', 1300],
        bait: [52, 38, 'mete for the hook'],
      },
      endings: {
        flesh: { maxBreadth: 10, text: 'Today meat means animal flesh. Just as history had it.' },
        food: { maxBreadth: 12, text: 'In your world meat still means any food, as Swedish mat does: "meat and drink".' },
        kernel: { maxBreadth: 12, text: 'In your world meat means the inside of things: "the meat of a walnut", never a steak.' },
        substance: { maxBreadth: 12, text: 'In your world meat means substance: "a meaty argument", and butchers sell flesh.' },
      },
      fads: {
        grain: [20, 18, 'mete of corn and barley', 'provisions'],
        banquet: [20, 96, 'a meat for the king', 'feast'],
        supper: [48, 82, 'sit down to meat', 'meal'],
        game: [68, 58, 'meat of the hare and boar', 'venison'],
        carcass: [96, 48, 'the meat hung in the larder', 'flesh'],
      },
      eras: [[1000, 'mete'], [1100, 'mete'], [1200, 'mete'], [1300, 'mete'], [1400, 'mete'], [1500, 'meate'], [1600, 'meat'], [1700, 'meat']],
      worlds: {
        flesh: [
          ['A hard winter; stores run low.', ['food', 'provisions'], ['kernel', 'bait'], 'Famine: nobody bothers with nutshells, or wastes food on the hook.'],
          ['Norman lords and their banquets.', ['feast', 'food'], ['fodder', 'portion'], 'Norman lords leave the cattle\'s feed, and the rationing, to the English.'],
          ['Monasteries ring the bell for supper.', ['meal', 'nourishment'], ['feast', 'prey'], 'The abbot preaches against gluttony, and against the hunt.'],
          ['Fast days, and orchards in the cloister.', ['fish', 'pulp'], ['bread', 'marrow'], 'Bakers in the pillory for short loaves, butchers for bad bones.'],
          ['Royal hunts, and preachers on the weakness of the body.', ['venison', 'body'], ['substance', 'dish'], 'Lollards mock the schoolmen\'s "substance", and fancy dishes are banned by law.'],
          ['Butchers organise into guilds.', ['flesh', 'body'], ['fish', 'pulp'], 'The new church scorns fast days, and sells off the monks\' orchards.'],
          ['Roast beef of old England, and nuts from the colonies.', ['flesh', 'kernel'], ['venison', 'prey'], 'The king\'s deer, and his falcons\' quarry, are not for the likes of you.'],
          ['Pamphleteers argue the heart of every matter.', ['flesh', 'gist'], ['food', 'nourishment'], 'Dictionary makers frown at loose old ways of speaking, and the sermons empty.'],
        ],
        food: [
          ['A hard winter; stores run low.', ['food', 'provisions'], ['kernel', 'bait'], 'Nobody wastes food on nuts or hooks.'],
          ['Norman banquets.', ['food', 'feast'], ['fodder', 'prey'], 'Cattle feed and the hunt are for others.'],
          ['The monastery bell for supper.', ['meal', 'food'], ['flesh', 'body'], 'The flesh is mortified.'],
          ['Market days in the growing towns.', ['food', 'dish'], ['flesh', 'pulp'], 'Butchers and fruiterers are fined.'],
          ['Bread and ale for the harvesters.', ['food', 'bread'], ['venison', 'flesh'], 'Meat is for lords.'],
          ['Cookery books in print.', ['food', 'dish'], ['flesh', 'body'], 'Nobody talks of flesh at table.'],
          ['Meat and drink at every inn.', ['food', 'meal'], ['flesh', 'venison'], 'Butchery is vulgar.'],
          ['Ship\'s stores for the voyage.', ['food', 'provisions'], ['flesh', 'gist'], 'No butchers aboard, and no arguments.'],
        ],
        kernel: [
          ['Nuts stored for winter.', ['kernel', 'provisions'], ['flesh', 'feast'], 'No feasting this year.'],
          ['Nut harvests.', ['kernel', 'food'], ['flesh', 'fodder'], 'The herds are thin.'],
          ['Grain and nuts in the barns.', ['kernel', 'bread'], ['flesh', 'fish'], 'Fast days, every day.'],
          ['Orchards in the cloister.', ['kernel', 'pulp'], ['flesh', 'fish'], 'The monks eat no flesh.'],
          ['Orchards and nut groves.', ['kernel', 'pulp'], ['venison', 'flesh'], 'The hunt is forbidden.'],
          ['Physicians on marrow and seed.', ['kernel', 'marrow'], ['flesh', 'fish'], 'Meat and fish are blamed for fevers.'],
          ['Nuts from the colonies.', ['kernel', 'pulp'], ['flesh', 'venison'], 'Roast beef is out of fashion.'],
          ['Botanists split seeds.', ['kernel', 'marrow'], ['flesh', 'food'], 'Butchers and cooks are behind the times.'],
        ],
        substance: [
          ['Sermons on bread for the soul.', ['nourishment', 'food'], ['kernel', 'fodder'], 'Husks and cattle feed are for beasts.'],
          ['Scholars ask what things are made of.', ['nourishment', 'substance'], ['feast', 'flesh'], 'Gluttony is a sin.'],
          ['Theologians debate the substance of the bread.', ['substance', 'bread'], ['flesh', 'feast'], 'The flesh is weak.'],
          ['Schoolmen dispute.', ['substance', 'nourishment'], ['fish', 'flesh'], 'Fish and flesh are for the kitchen.'],
          ['Preachers on the body and the soul.', ['substance', 'body'], ['venison', 'dish'], 'Hunting and fine dishes are vanity.'],
          ['Printers spread the argument.', ['substance', 'nourishment'], ['flesh', 'fish'], 'Nobody argues about dinner.'],
          ['Puritans preach plain bread and plain truth.', ['substance', 'bread'], ['venison', 'flesh'], 'Feasting is popish.'],
          ['Pamphleteers get to the heart of it.', ['substance', 'gist'], ['flesh', 'food'], 'Mere food is beneath argument.'],
        ],
      },
      history: ['food', 'food', 'meal', 'fish', 'fish', 'flesh', 'flesh', 'flesh'],
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

  // The senses this game has by now: the word's own, and the fads that have
  // sprouted along your route (`g.fads`, each fad's sprouting century).
  function senses(g, era = g.era) {
    const level = levelOf(g);
    const year = level.eras[Math.min(era, level.eras.length - 1)][0];
    const fads = Object.entries(g.fads)
      .filter(([, at]) => at <= era)
      .map(([name, at]) => { const [x, y, quote] = level.fads[name]; return { name, x, y, quote, from: year, fad: at }; });
    return [...landmarks(level, year), ...fads];
  }
  const senseAt = (g, name) => senses(g, Infinity).find((l) => l.name === name);

  function newGame(levelIndex = 0) {
    const level = LEVELS[levelIndex];
    const [x, y] = level.startAt || [landmark(level, level.start).x, landmark(level, level.start).y];
    const start = { x, y };
    const g = {
      levelIndex, era: 0, x: start.x, y: start.y, r: level.breadth, speakers: START_SPEAKERS,
      trail: [{ x: start.x, y: start.y, r: level.breadth }], log: [], over: false, outcome: null,
      seen: [], fads: {}, goal: null, world: level.target, visits: {},
    };
    offer(g);
    look(g);
    return g;
  }

  // Senses you can make out: those near you, fads, and any you've made out
  // before. Even today's meaning stays a "?" until you get near it.
  function look(g) {
    const seen = new Set(g.seen);
    for (const name of Object.keys(g.fads)) seen.add(name);
    for (const l of senses(g)) if (dist(l, g) <= SIGHT + g.r) seen.add(l.name);
    g.seen = [...seen];
  }

  const levelOf = (g) => LEVELS[g.levelIndex];
  const eraOf = (g) => levelOf(g).eras[Math.min(g.era, levelOf(g).eras.length - 1)];
  // A world's event this century: what happens, and so what's in fashion.
  function event(g, world) {
    const [clue, wanted, scorned, scornClue] = levelOf(g).worlds[world][Math.min(g.era, levelOf(g).eras.length - 1)];
    return { world, clue, wanted, scorned, scornClue };
  }
  // The events you can choose between this century: your world's, and one
  // that changes history. From the real history that's the world of the
  // other ending nearest your word; from another world, it's back to history.
  // Once you know what you're becoming, your world is its world.
  function offer(g) {
    const level = levelOf(g);
    if (g.goal) {
      g.events = [event(g, g.goal)];
    } else {
      const other = g.world !== level.target ? level.target : Object.keys(level.worlds).filter((w) => w !== level.target)
        .map((w) => ({ w, d: dist(landmark(level, w), g) })).sort((a, b) => a.d - b.d)[0].w;
      g.events = [event(g, g.world), event(g, other)];
    }
    g.pick = 0;
  }
  const eventNow = (g) => g.events[g.pick];
  const wantedNow = (g) => eventNow(g).wanted;
  const clueNow = (g) => eventNow(g).clue;

  // Out of fashion this century: the event's, and fads that have had their day.
  const scornedNow = (g) => [...eventNow(g).scorned,
    ...Object.entries(g.fads).filter(([, at]) => g.era === at + FAD_LIFE).map(([name]) => name)];
  const scornClueNow = (g) => eventNow(g).scornClue;
  const fadNow = (g) => Object.entries(g.fads).filter(([, at]) => g.era === at).map(([name]) => name);
  // Whether you know yet what the word means today.
  const goalKnown = (g) => !!g.goal;

  // How many centuries so far you kept to history's events.
  const faithful = (g) => g.log.filter((l) => l.kept).length;

  // What your journey makes of the word today: the real meaning if you've
  // mostly kept to history, or else the world you've spent longest in (the
  // later, if two tie).
  function chooseEnding(g) {
    const level = levelOf(g);
    if (faithful(g) >= ON_COURSE) return level.target;
    const others = g.log.map((l) => l.world).filter((w) => w !== level.target);
    return others.reduce((best, w) => (others.filter((o) => o === w).length >= others.filter((o) => o === best).length ? w : best));
  }

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
    const needed = wantedNow(g);
    const scorned = scornedNow(g);
    const fads = fadNow(g);
    const held = senses(g).filter((l) => dist(l, m) <= m.r);
    const reasons = [];
    for (const s of held) {
      if (scorned.includes(s.name)) {
        reasons.push({ sense: s.name, scorned: true, amount: -SCORN, ifPlain: -SCORN, ifWanted: -SCORN, text: `${s.name} is out of fashion` });
        continue;
      }
      if (fads.includes(s.name)) {
        reasons.push({ sense: s.name, fad: true, amount: FAD, ifPlain: FAD, ifWanted: FAD, text: `${s.name} is the latest fad` });
        continue;
      }
      const isNeeded = needed.includes(s.name);
      // What the player can know beforehand: the gain if it isn't wanted, and if it is.
      reasons.push({
        sense: s.name, amount: isNeeded ? GAIN.needed : GAIN.plain, needed: isNeeded,
        ifPlain: GAIN.plain, ifWanted: GAIN.needed, text: s.name,
      });
    }
    // Too many meanings and you're vague: everything you'd win is diluted, to
    // MAX_SENSES out of every sense you carry. Its cost shows on its own.
    if (held.length > MAX_SENSES) {
      const won = (key) => reasons.reduce((n, r) => n + Math.max(0, r[key]), 0);
      const diluted = (key) => Math.round((won(key) * MAX_SENSES) / held.length) - won(key);
      reasons.push({ vague: true, amount: diluted('amount'), ifPlain: diluted('ifPlain'), ifWanted: diluted('ifWanted'), text: `too vague: ${held.length} meanings` });
    }
    if (!held.length) reasons.push({ amount: -MEANINGLESS, text: 'nobody knows what you mean' });
    reasons.push({ amount: -FORGETTING, text: 'forgotten by some' });
    const delta = reasons.reduce((n, r) => n + r.amount, 0);
    // The range the player could know: no sense wanted, to every sense wanted.
    const sure = reasons.reduce((n, r) => n + (r.ifPlain === undefined ? r.amount : r.ifPlain), 0);
    const best = reasons.reduce((n, r) => n + (r.ifWanted === undefined ? r.amount : r.ifWanted), 0);
    return { move: m, senses: held.map((s) => s.name), reasons, delta, range: [sure, best] };
  }

  // The best the coming century could do for you from here: every move you
  // could make, at each breadth you could choose. The page shows it once the
  // century has passed, to judge the move you made.
  function bestMove(g) {
    const points = [...senses(g)];
    for (let dx = -REACH; dx <= REACH; dx += 2) for (let dy = -REACH; dy <= REACH; dy += 2) points.push({ x: g.x + dx, y: g.y + dy });
    let best = null;
    for (const r of [g.r, g.r + BROADEN, g.r - NARROW]) {
      for (const pt of points) {
        if (dist(pt, g) > REACH) continue;
        const p = preview(g, { x: pt.x, y: pt.y, r });
        if (!best || p.delta > best.delta) best = p;
      }
    }
    return best;
  }
  // How a century's move compares with the best one: how many speakers short of it.
  const GRADES = [[0, 'best'], [10, 'good'], [30, 'fair'], [Infinity, 'poor']];
  const grade = (delta, best) => GRADES.find(([short]) => best - delta <= short)[1];

  function reachedTarget(g, at = g) {
    if (!g.goal) return false;
    const level = levelOf(g);
    const max = level.endings[g.goal].maxBreadth;
    return dist(landmark(level, g.goal), at) <= at.r && (!max || at.r <= max);
  }

  // Let a century pass with you at `move`, and its event `move.pick` (or the
  // one chosen already).
  function advance(g, move) {
    if (g.over) return null;
    const level = levelOf(g);
    if (move.pick !== undefined) g.pick = move.pick;
    const p = preview(g, move);
    const ev = eventNow(g);
    Object.assign(g, p.move);
    g.speakers = clamp(g.speakers + p.delta, 0, MAX_SPEAKERS);
    g.trail.push({ ...p.move });
    const year = eraOf(g)[0];
    g.log.push({
      year, form: eraOf(g)[1], senses: p.senses, wanted: wantedNow(g), clue: clueNow(g), scorned: scornedNow(g),
      delta: p.delta, speakers: g.speakers, at: { ...p.move }, world: ev.world, kept: ev.world === level.target, pick: g.pick,
    });
    g.world = ev.world;

    // Fads sprout next to the senses you carried.
    g.era++;
    const sprouted = [];
    if (g.era < level.eras.length) {
      for (const [name, [, , , after]] of Object.entries(level.fads || {})) {
        if (!(name in g.fads) && p.senses.includes(after)) { g.fads[name] = g.era; sprouted.push(name); }
      }
    }
    g.log[g.log.length - 1].sprouted = sprouted;
    g.log[g.log.length - 1].meant = p.senses.includes(level.history[g.era - 1]);
    if (g.era === level.eras.length - REVEAL) g.goal = chooseEnding(g);
    if (g.era < level.eras.length) offer(g);
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

  // The perfect route to an ending, played through the same rules: each
  // century's move and the event chosen.
  function perfectGame(levelIndex, ending = LEVELS[levelIndex].target) {
    const g = newGame(levelIndex);
    for (const [x, y, r, pick] of ROUTES[LEVELS[levelIndex].id][ending]) if (!g.over) advance(g, { x, y, r, pick });
    return g;
  }
  const historyGame = (levelIndex) => perfectGame(levelIndex);

  return {
    LEVELS, REACH, SIGHT, MIN_BREADTH, MAX_BREADTH, BROADEN, NARROW, MAX_SENSES, SCORN, FAD, FAD_LIFE, REVEAL,
    ARRIVAL_BONUS, START_SPEAKERS, MAX_SPEAKERS, ON_COURSE, ROUTES, GAIN,
    landmarks, senses, senseAt, newGame, eraOf, eventNow, wantedNow, clueNow, scornedNow, scornClueNow, fadNow, goalKnown, constrain, preview, advance,
    reachedTarget, bestMove, grade, score, historyGame, perfectGame, faithful, chooseEnding,
  };
});
