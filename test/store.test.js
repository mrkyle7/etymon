'use strict';

// Players' records (store.js): the Cloud Storage client against a fake of the
// JSON API (from Slow Chess's test/store.test.js), and Records on top.

const test = require('node:test');
const assert = require('node:assert');
const { GcsStore, MemoryStore, StoreConflict, Records, mergeInto, MAX_GAMES } = require('../store.js');

function fakeGcs() {
  const objects = new Map(); // name → { body, generation }
  let gen = 100;
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const reply = (status, body, headers = {}) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
    assert.strictEqual(init.headers.Authorization, 'Bearer tok');
    if (u.pathname.startsWith('/upload/')) {
      const match = Number(u.searchParams.get('ifGenerationMatch'));
      const parts = init.body.split(/--et[a-z0-9]+(?:--)?\r\n/).filter(Boolean);
      const meta = JSON.parse(parts[0].split('\r\n\r\n')[1]);
      const media = parts[1].split('\r\n\r\n')[1].replace(/\r\n$/, '');
      const current = objects.get(meta.name);
      if ((current ? current.generation : 0) !== match) return reply(412, { error: 'precondition' });
      objects.set(meta.name, { body: media, generation: ++gen });
      return reply(200, { generation: String(gen) });
    }
    const m = /^\/storage\/v1\/b\/([^/]+)\/o\/(.+)$/.exec(u.pathname);
    assert.strictEqual(m[1], 'records-bucket');
    const obj = objects.get(decodeURIComponent(m[2]));
    if (!obj) return reply(404, {});
    return new Response(obj.body, { status: 200, headers: { 'x-goog-generation': String(obj.generation) } });
  };
  return { objects, fetchImpl };
}

test('GcsStore writes with a generation check and reads back', async () => {
  const gcs = fakeGcs();
  const store = new GcsStore('records-bucket', { fetchImpl: gcs.fetchImpl, getToken: async () => 'tok' });
  assert.strictEqual(await store.read('players/u1.json'), null);
  const g1 = await store.write('players/u1.json', { a: 1 }, { generation: 0 });
  await assert.rejects(store.write('players/u1.json', { a: 2 }, { generation: 0 }), StoreConflict);
  const g2 = await store.write('players/u1.json', { a: 2 }, { generation: g1 });
  assert.deepStrictEqual(await store.read('players/u1.json'), { data: { a: 2 }, generation: g2 });
});

test('GcsStore signs in through the metadata server and retries a server error once', async () => {
  let tokens = 0;
  let failures = 1;
  const fetchImpl = async (url, init = {}) => {
    if (url.startsWith('http://metadata.google.internal/')) {
      assert.strictEqual(init.headers['Metadata-Flavor'], 'Google');
      tokens++;
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }));
    }
    if (failures-- > 0) return new Response('', { status: 503 });
    return new Response('{}', { status: 404 });
  };
  const store = new GcsStore('records-bucket', { fetchImpl });
  assert.strictEqual(await store.read('players/u1.json'), null);
  assert.strictEqual(await store.read('players/u1.json'), null);
  assert.strictEqual(tokens, 1, 'the token is cached');
});

test('a record starts empty, and changes survive another instance saving first', async () => {
  const store = new MemoryStore();
  const records = new Records(store);
  assert.deepStrictEqual(await records.get('u1'), { best: {}, endings: {}, games: [] });
  // Another instance saves between this one's read and its write.
  const write = store.write.bind(store);
  let raced = false;
  store.write = async (path, data, opts) => {
    if (!raced) { raced = true; await write(path, { best: { nice: 300 }, endings: {}, games: [] }, { generation: 0 }); }
    return write(path, data, opts);
  };
  const r = await records.update('u1', (rec) => mergeInto(rec, { best: { nice: 200, silly: 150 } }));
  assert.deepStrictEqual(r.best, { nice: 300, silly: 150 }, 'kept the other save, and its better score');
});

test('merging keeps the best scores and every ending found', () => {
  const r = { best: { nice: 300 }, endings: { nice: ['foolish'] }, games: [] };
  mergeInto(r, { best: { nice: 250, girl: 90 }, endings: { nice: ['pleasant', 'foolish'], meat: ['flesh'] } });
  assert.deepStrictEqual(r.best, { nice: 300, girl: 90 });
  assert.deepStrictEqual(r.endings, { nice: ['foolish', 'pleasant'], meat: ['flesh'] });
});

test('a record keeps the newest games', async () => {
  const records = new Records(new MemoryStore());
  for (let i = 0; i < MAX_GAMES + 3; i++) await records.update('u1', (r) => r.games.push({ n: i }));
  const { games } = await records.get('u1');
  assert.strictEqual(games.length, MAX_GAMES);
  assert.strictEqual(games[games.length - 1].n, MAX_GAMES + 2);
});
