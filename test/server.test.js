'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../server.js');

async function withServer(fn, options) {
  const server = createServer(options);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test('serves the game at /', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/`);
    assert.strictEqual(res.status, 200);
    assert.match(await res.text(), /<title>[^<]+<\/title>/);
  });
});

test('health check', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/healthz`);
    assert.strictEqual(res.status, 200);
  });
});

test('paths cannot escape public/', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/..%2fserver.js`);
    assert.strictEqual(res.status, 404);
  });
});

test('/api/me says who is signed in', async () => {
  const auth = {
    player: async (req) => (req.headers.cookie === 'userjwt=ok' ? { id: 'u1', name: 'Ann' } : null),
    loginUrl: (next) => `https://cheetahmoongames.com/login?next=${encodeURIComponent(next)}`,
  };
  await withServer(async (base) => {
    const signedIn = await (await fetch(`${base}/api/me`, { headers: { cookie: 'userjwt=ok' } })).json();
    assert.deepStrictEqual(signedIn, { signedIn: true, id: 'u1', name: 'Ann' });
    const signedOut = await (await fetch(`${base}/api/me`)).json();
    assert.strictEqual(signedOut.signedIn, false);
    assert.match(signedOut.loginUrl, /^https:\/\/cheetahmoongames\.com\/login\?next=/);
  }, { auth });
});

test('links back to Cheetah Moon Games and shows who is signed in', async () => {
  await withServer(async (base) => {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /href="https:\/\/cheetahmoongames\.com\/"/);
    assert.match(html, /fetch\('\/api\/me'\)/);
  });
});

test('installable: icons, manifest and service worker are served', async () => {
  await withServer(async (base) => {
    const html = await (await fetch(`${base}/`)).text();
    for (const ref of ['/icon.svg', '/icons/apple-touch-icon.png', '/manifest.webmanifest']) {
      assert.ok(html.includes(`href="${ref}"`), `page links ${ref}`);
    }
    const manifestRes = await fetch(`${base}/manifest.webmanifest`);
    assert.strictEqual(manifestRes.headers.get('content-type'), 'application/manifest+json');
    const manifest = await manifestRes.json();
    assert.strictEqual(manifest.start_url, '/');
    assert.strictEqual(manifest.display, 'standalone');
    const sizes = manifest.icons.map((i) => i.sizes);
    assert.ok(sizes.includes('192x192') && sizes.includes('512x512'), 'Chrome needs 192 and 512 px icons');
    assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
    for (const icon of [...manifest.icons, { src: '/icons/apple-touch-icon.png' }]) {
      const res = await fetch(base + icon.src);
      assert.strictEqual(res.status, 200, icon.src);
      if (icon.src.endsWith('.png')) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        assert.deepStrictEqual([...bytes.slice(1, 4)], [0x50, 0x4e, 0x47], `${icon.src} is a PNG`);
      }
    }
    const sw = await fetch(`${base}/sw.js`);
    assert.match(sw.headers.get('content-type'), /javascript/);
    assert.match(await sw.text(), /offline\.html/);
    assert.strictEqual((await fetch(`${base}/offline.html`)).status, 200);
  });
});

test('/api/record keeps a signed-in player\'s games, best scores and endings', async () => {
  const { Records, MemoryStore } = require('../store.js');
  const auth = {
    player: async (req) => (req.headers.cookie === 'userjwt=ok' ? { id: 'u1', name: 'Ann' } : null),
    loginUrl: () => 'https://cheetahmoongames.com/login',
  };
  const records = new Records(new MemoryStore());
  const game = { word: 'nice', score: 420, outcome: 'arrived', goal: 'pleasant', log: [{ year: 1300, senses: ['foolish'], wanted: ['foolish', 'wanton'], delta: 23, speakers: 123, kept: true, meant: true, really: 'foolish' }] };
  const post = (base, path, body, cookie = 'userjwt=ok') => fetch(`${base}${path}`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await withServer(async (base) => {
    assert.strictEqual((await fetch(`${base}/api/record`)).status, 401, 'only for signed-in players');
    assert.strictEqual((await post(base, '/api/record/games', game, '')).status, 401);
    assert.strictEqual((await post(base, '/api/record/games', { word: 'NICE!' })).status, 400);
    let r = await (await post(base, '/api/record/games', game)).json();
    assert.strictEqual(r.games.length, 1);
    assert.strictEqual(r.games[0].log[0].senses[0], 'foolish');
    assert.deepStrictEqual(r.best, { nice: 420 });
    assert.deepStrictEqual(r.endings, { nice: ['pleasant'] });
    r = await (await post(base, '/api/record/merge', { best: { nice: 380, silly: 200 }, endings: { nice: ['foolish'] } })).json();
    assert.deepStrictEqual(r.best, { nice: 420, silly: 200 });
    assert.deepStrictEqual(r.endings.nice, ['pleasant', 'foolish']);
    const got = await (await fetch(`${base}/api/record`, { headers: { cookie: 'userjwt=ok' } })).json();
    assert.deepStrictEqual(got, r);
  }, { auth, records });
  await withServer(async (base) => {
    assert.strictEqual((await fetch(`${base}/api/record`, { headers: { cookie: 'userjwt=ok' } })).status, 503, 'not configured without a bucket');
  }, { auth, records: null });
});
