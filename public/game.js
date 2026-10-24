// Etymon's rules. No DOM here, so the page and the tests share it.
//
// You are a word. The map is meaning: each landmark is a sense a word can
// have, and your circle is the senses you carry. Each century you drift
// (up to REACH across the map) and may broaden a lot or narrow a little, then
// the century passes and your speakers change:
//   - each sense you carry wins speakers, a lot more if the century needs
//     words for it (you only learn which afterwards)
//   - each sense out of fashion this century (you can see these) loses you
//     speakers
//   - fads sprout next to senses you've carried: they pay well the century
//     they appear, then go out of fashion two centuries later
//   - carry more than MAX_SENSES and you're too vague to be useful
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
  const MAX_SPEAKERS = 400;
  const GAIN = { needed: 18, plain: 3 };
  const SCORN = 15;
  const FAD = 8; // a fad, the century it sprouts
  const FAD_LIFE = 2; // centuries until a fad is out of fashion
  const REVEAL = 3; // centuries left when you learn what you're becoming
  const ON_COURSE = 3; // centuries matching history by then, for the real ending
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
  // wants, the senses out of fashion, and what it wants instead if you're
  // nearer that: [the senses, its clue], and a clue to what's out of
  // fashion]. `fads` are [x, y, quote, the sense that makes them sprout],
  // appearing the century after you carry it.
  // `endings` are what the word can mean today: `target`, the real one, and
  // others it ends up with if the journey strays from history (`history`,
  // what it really meant each century). Perfect routes to each are in
  // routes.js, made by scripts/routes.js.
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
      eras: [
        [1300, ['foolish', 'wanton'], 'nyce', 'Minstrels mock the gullible and the lusty.', ['shy', 'effeminate'],
          [['strange', 'coy'], 'Travellers\' tales of marvels, and maidens who won\'t look up.'], 'Bold knights have no patience for the bashful, or the soft.'],
        [1400, ['wanton', 'shy'], 'nyce', 'Courtly love: gallants flirt, ladies blush.', ['foolish', 'trivial'],
          [['strange', 'delicate'], 'Herbalists tend odd and tender plants.'], 'The court has no time for fools, or idle chatter.'],
        [1500, ['shy', 'fussy'], 'nyse', 'Manners multiply, and everyone frets over them.', ['coy', 'ignorant'],
          [['lavish', 'delicate'], 'Tudor feasts: silks for the rich, care for the frail.'], 'Plain dealing and the new learning: no more playing hard to get, and no more dunces.'],
        [1600, ['subtle', 'precise'], 'nice', 'Scholars and lawyers split hairs.', ['shy', 'lavish'],
          [['foolish', 'strange'], 'Fools\' festivals and travelling freak shows.'], 'Wits and Puritans: the tongue-tied are left behind, and finery frowned on.'],
        [1700, ['precise', 'dainty'], 'nice', 'Science measures; fashion frills.', ['fussy', 'effeminate'],
          [['delicate', 'lavish'], 'Porcelain from China, and what it costs.'], 'Enlightened gentlemen sneer at fuss, and at fops.'],
        [1800, ['agreeable', 'tasty'], 'nice', 'Drawing rooms, tea, and polite company.', ['dainty', 'wanton'],
          [['precise', 'fussy'], 'Clerks and governesses keep everything just so.'], 'Rugged Romantics laugh at frills; Victorians blush at anything racy.'],
        [1900, ['sarcastic', 'pleasant'], 'nice', 'Postcards from the seaside, and a new irony.', ['agreeable', 'respectable'],
          [['delicate', 'tasty'], 'Tea rooms: fine china and fancy cakes.'], 'Mere politeness is the dullest thing going, and respectability a bore.'],
        [2000, ['pleasant', 'kind'], 'nice', 'Everything is lovely, thanks for asking.', ['sarcastic', 'precise'],
          [['foolish', 'strange'], 'Videos of people doing daft and peculiar things.'], 'Earnest is in, irony is so last century, and nobody splits hairs.'],
      ],
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
      eras: [
        [1000, ['holy', 'happy'], 'sǣlig', 'Monks copy psalms and feast on saints\' days.', ['harmless', 'helpless'],
          [['lucky', 'cheerful'], 'Harvest home: luck and laughter in the fields.'], 'Raiders on the coast: the meek and the helpless go under.'],
        [1100, ['innocent', 'saintly'], 'seely', 'Sermons on lambs and martyrs.', ['happy', 'cheerful'],
          [['rustic', 'lucky'], 'Fortune-tellers at the market-town fairs.'], 'Penance and fasting: mirth and merrymaking are frowned on.'],
        [1200, ['innocent', 'harmless'], 'seely', 'Friars preach meekness to the poor.', ['holy', 'lucky'],
          [['cheerful', 'rustic'], 'Village dances on the green.'], 'Fat, worldly priests give holiness a bad name, and fortune-telling is a sin.'],
        [1300, ['pitiable', 'cheerful'], 'sely', 'Plague years: pity, and dancing anyway.', ['saintly', 'humble'],
          [['holy', 'blessed'], 'Pilgrims crowd the shrines.'], 'The saints didn\'t stop the plague, and the poor who survive want more.'],
        [1400, ['pitiable', 'feeble'], 'sely', 'Old soldiers beg at the gates.', ['innocent', 'holy'],
          [['happy', 'lucky'], 'Peasants rise up, and some get away with it.'], 'Hard times: nobody believes in innocence, or in miracles.'],
        [1500, ['gullible', 'rustic'], 'silly', 'Pastoral poems, and swindlers at the fair.', ['weak', 'blessed'],
          [['holy', 'saintly'], 'Reformers argue over the saints.'], 'A warrior king despises weakness, and reformers the old blessings.'],
        [1600, ['simple', 'stunned'], 'silly', 'Stage clowns: plain folk, and pratfalls.', ['pitiable', 'helpless'],
          [['weak', 'feeble'], 'Old castles crumble; old soldiers totter.'], 'Pity is out of fashion: the beggars and the helpless are whipped.'],
        [1700, ['foolish', 'trivial'], 'silly', 'Wits in the coffee houses mock everything.', ['rustic', 'humble'],
          [['weak', 'harmless'], 'Flimsy fashions: paper fans and silk slippers.'], 'Town wits sneer at country bumpkins and at humble pie.'],
      ],
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
      eras: [
        [1200, ['reverent', 'pious'], 'aȝefull', 'Cathedrals rise; the faithful kneel.', ['sublime', 'great'],
          [['majestic', 'wonderful'], 'Kings crowned in splendour.'], 'Wild crags are the devil\'s country, and boasting is a sin.'],
        [1300, ['solemn', 'sinful'], 'aweful', 'Doom paintings over every chancel arch.', ['majestic', 'mighty'],
          [['wonderful', 'great'], 'Marvels brought back from the East.'], 'Barons humble the king and his strongmen.'],
        [1400, ['solemn', 'terrifying'], 'aweful', 'Requiems, and storms at sea.', ['pious', 'sinful'],
          [['majestic', 'sublime'], 'Mountain passes and royal progresses.'], 'Lollards jeer at outward piety, and at the priests\' talk of sin.'],
        [1500, ['gruesome', 'sublime'], 'awfull', 'Executions in the square; mountains in the poems.', ['solemn', 'reverent'],
          [['majestic', 'great'], 'Princes build palaces to outdo each other.'], 'Reformers strip the altars of ceremony, and get up off their knees.'],
        [1600, ['dreadful', 'sublime'], 'awful', 'Tragedies on the stage, and grim news from the wars.', ['wonderful', 'monstrous'],
          [['solemn', 'majestic'], 'State funerals for great men.'], 'Sceptics scoff at marvels and monsters.'],
        [1700, ['dreadful', 'enormous'], 'awful', 'Everything is bigger: cities, debts, wigs.', ['terrifying', 'fearful'],
          [['wonderful', 'great'], 'Explorers\' maps of wonders and vast lands.'], 'Reason tames the old terrors, and nobody admits to being afraid.'],
        [1800, ['ugly', 'very'], 'awful', 'Novels of fashion: frightful bonnets, frightfully dull.', ['great', 'pious'],
          [['enormous', 'wonderful'], 'Railways and factories, bigger every year.'], 'Grandeur looks vulgar now, and piety is for Sundays.'],
        [1900, ['very bad', 'tiresome'], 'awful', 'Slang everywhere; complaints about everything.', ['dreadful', 'majestic'],
          [['solemn', 'enormous'], 'War memorials, vast and silent.'], 'Penny dreadfuls are for children, and empires are going out of style.'],
      ],
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
      eras: [
        [1300, ['child', 'young person'], 'gyrle', 'Village feast days: children everywhere.', ['rogue', 'servant'],
          [['peasant', 'pupil'], 'Village priests teach the farmers\' children their letters.'], 'The sheriff hangs the thieves, and serfs run from their lords.'],
        [1400, ['beggar', 'boy'], 'girle', 'Famine roads, and boys sent out to work.', ['servant', 'peasant'],
          [['infant', 'pupil'], 'Nursemaids and their charges.'], 'After the plague, nobody will serve for the old wages, and lords fear the peasants.'],
        [1500, ['young person', 'pupil'], 'gerle', 'Grammar schools open their doors.', ['beggar', 'orphan'],
          [['servant', 'boy'], 'Pages and serving lads in the great hall.'], 'Poor laws drive vagrants and foundlings from the parish.'],
        [1600, ['servant', 'young woman'], 'girle', 'Great houses fill with staff.', ['peasant', 'playmate'],
          [['pupil', 'child'], 'Charity schools for poor children.'], 'Courtiers sneer at country folk, and Puritans at games.'],
        [1700, ['flirt', 'daughter'], 'girl', 'Masquerades, and marriages arranged.', ['boy', 'maiden'],
          [['servant', 'child'], 'Foundling hospitals and their little workers.'], 'Boys are breeched at seven, and old maids are mocked.'],
        [1800, ['shopgirl', 'sweetheart'], 'girl', 'Department stores and love letters.', ['servant', 'harlot'],
          [['pupil', 'infant'], 'Nurseries and schoolrooms in every house.'], 'Polite society pretends the servants, and the streetwalkers, aren\'t there.'],
        [1900, ['young woman', 'friends'], 'girl', 'Dance halls and nights out.', ['flirt', 'maiden'],
          [['child', 'pupil'], 'School for every child, by law.'], 'Respectable ladies frown on coquettes, and spinsters are old hat.'],
        [2000, ['young woman', 'daughter'], 'girl', 'Birthday cards and graduations.', ['servant', 'harlot'],
          [['child', 'infant'], 'A baby boom: prams in every street.'], 'Nobody has servants any more, and nobody is called a fallen woman.'],
      ],
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
      eras: [
        [1000, ['food', 'provisions'], 'mete', 'A hard winter; stores run low.', ['kernel', 'bait'],
          [['bread', 'dish'], 'The bakehouse and the cooking pot.'], 'Famine: nobody bothers with nutshells, or wastes food on the hook.'],
        [1100, ['feast', 'food'], 'mete', 'Norman lords and their banquets.', ['fodder', 'portion'],
          [['kernel', 'provisions'], 'Nut harvests stored for winter.'], 'Norman lords leave the cattle\'s feed, and the rationing, to the English.'],
        [1200, ['meal', 'nourishment'], 'mete', 'Monasteries ring the bell for supper.', ['feast', 'prey'],
          [['bread', 'substance'], 'Theologians debate the substance of the bread.'], 'The abbot preaches against gluttony, and against the hunt.'],
        [1300, ['fish', 'pulp'], 'mete', 'Fast days, and orchards in the cloister.', ['bread', 'marrow'],
          [['food', 'meal'], 'Market days in the growing towns.'], 'Bakers in the pillory for short loaves, butchers for bad bones.'],
        [1400, ['venison', 'body'], 'mete', 'Royal hunts, and preachers on the weakness of the body.', ['substance', 'dish'],
          [['kernel', 'pulp'], 'Orchards and nut groves of the monasteries.'], 'Lollards mock the schoolmen\'s "substance", and fancy dishes are banned by law.'],
        [1500, ['flesh', 'body'], 'meate', 'Butchers organise into guilds.', ['fish', 'pulp'],
          [['food', 'dish'], 'Cookery books in print.'], 'The new church scorns fast days, and sells off the monks\' orchards.'],
        [1600, ['flesh', 'kernel'], 'meat', 'Roast beef of old England, and nuts from the colonies.', ['venison', 'prey'],
          [['substance', 'bread'], 'Puritans preach plain bread and plain truth.'], 'The king\'s deer, and his falcons\' quarry, are not for the likes of you.'],
        [1700, ['flesh', 'gist'], 'meat', 'Pamphleteers argue the heart of every matter.', ['food', 'nourishment'],
          [['substance', 'kernel'], 'Get to the heart of it: nutshells and pamphlets.'], 'Dictionary makers frown at loose old ways of speaking, and the sermons empty.'],
      ],
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
      seen: [], fads: {}, goal: null,
    };
    g.want = choose(g);
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
  // What this century wants, and its clue. Each century wants one of two
  // pairs of senses: the one nearer where your word is, so the clues follow
  // your path.
  function choose(g) {
    const level = levelOf(g);
    const era = eraOf(g);
    const options = [{ senses: era[1], clue: era[3] }];
    if (era[5]) options.push({ senses: era[5][0], clue: era[5][1] });
    const far = (o) => o.senses.reduce((n, name) => n + dist(landmark(level, name), g), 0);
    return options.reduce((a, b) => (far(b) < far(a) ? b : a));
  }
  const wantedNow = (g) => g.want.senses;
  const clueNow = (g) => g.want.clue;

  // Out of fashion this century: the century's own, and fads that have had their day.
  const scornedNow = (g) => [...(eraOf(g)[4] || []),
    ...Object.entries(g.fads).filter(([, at]) => g.era === at + FAD_LIFE).map(([name]) => name)];
  const scornClueNow = (g) => eraOf(g)[6];
  const fadNow = (g) => Object.entries(g.fads).filter(([, at]) => g.era === at).map(([name]) => name);
  // Whether you know yet what the word means today.
  const goalKnown = (g) => !!g.goal;

  // How many centuries so far you meant what the word really meant then.
  const faithful = (g) => g.log.filter((l, i) => l.senses.includes(levelOf(g).history[i])).length;

  // What your journey makes of the word today: the real meaning if you've
  // kept close to history, or else the other ending nearest where you are.
  function chooseEnding(g) {
    const level = levelOf(g);
    if (faithful(g) >= ON_COURSE) return level.target;
    return Object.keys(level.endings).filter((name) => name !== level.target)
      .map((name) => ({ name, d: dist(landmark(level, name), g) }))
      .sort((a, b) => a.d - b.d)[0].name;
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
    if (held.length > MAX_SENSES) {
      reasons.push({ amount: -VAGUE * (held.length - MAX_SENSES), text: `too vague: ${held.length} meanings` });
    }
    if (!held.length) reasons.push({ amount: -MEANINGLESS, text: 'nobody knows what you mean' });
    reasons.push({ amount: -FORGETTING, text: 'forgotten by some' });
    const delta = reasons.reduce((n, r) => n + r.amount, 0);
    // The range the player sees: no sense wanted, to every sense wanted.
    const sure = reasons.reduce((n, r) => n + (r.sense ? r.ifPlain : r.amount), 0);
    const best = reasons.reduce((n, r) => n + (r.sense ? r.ifWanted : r.amount), 0);
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
  const GRADES = [[0, 'best'], [6, 'good'], [18, 'fair'], [Infinity, 'poor']];
  const grade = (delta, best) => GRADES.find(([short]) => best - delta <= short)[1];

  function reachedTarget(g, at = g) {
    if (!g.goal) return false;
    const level = levelOf(g);
    const max = level.endings[g.goal].maxBreadth;
    return dist(landmark(level, g.goal), at) <= at.r && (!max || at.r <= max);
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
      year, form: eraOf(g)[2], senses: p.senses, wanted: wantedNow(g), clue: clueNow(g), scorned: scornedNow(g),
      delta: p.delta, speakers: g.speakers, at: { ...p.move },
    });

    // Fads sprout next to the senses you carried.
    g.era++;
    const sprouted = [];
    if (g.era < level.eras.length) {
      for (const [name, [, , , after]] of Object.entries(level.fads || {})) {
        if (!(name in g.fads) && p.senses.includes(after)) { g.fads[name] = g.era; sprouted.push(name); }
      }
    }
    g.log[g.log.length - 1].sprouted = sprouted;
    g.log[g.log.length - 1].faithful = p.senses.includes(level.history[g.era - 1]);
    if (g.era === level.eras.length - REVEAL) g.goal = chooseEnding(g);
    if (g.era < level.eras.length) g.want = choose(g);
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

  // The perfect route to an ending, played through the same rules. To the
  // real ending, it means what the word really meant every century.
  function perfectGame(levelIndex, ending = LEVELS[levelIndex].target) {
    const g = newGame(levelIndex);
    for (const [x, y, r] of ROUTES[LEVELS[levelIndex].id][ending]) if (!g.over) advance(g, { x, y, r });
    return g;
  }
  const historyGame = (levelIndex) => perfectGame(levelIndex);

  return {
    LEVELS, REACH, SIGHT, MIN_BREADTH, MAX_BREADTH, BROADEN, NARROW, MAX_SENSES, SCORN, FAD, FAD_LIFE, REVEAL,
    ARRIVAL_BONUS, START_SPEAKERS, ON_COURSE, ROUTES, GAIN,
    landmarks, senses, senseAt, newGame, eraOf, wantedNow, clueNow, scornedNow, scornClueNow, fadNow, goalKnown, constrain, preview, advance,
    reachedTarget, bestMove, grade, score, historyGame, perfectGame, faithful, chooseEnding,
  };
});
