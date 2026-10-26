'use strict';

// Where Etymon keeps each signed-in player's record, so it isn't lost with
// the browser's storage and follows them between devices: one JSON file per
// player in one bucket (GAMES_BUCKET, made in mrkyle7/cheetahmoongames
// terraform/etymon.tf):
//   players/<id>.json     { best, endings, games }, keyed by Cheetah Moon id
//
// Every save names the generation (version) of the file it expects to
// replace, and Cloud Storage refuses it if the file has changed since, so two
// instances can't overwrite each other: Records retries from a fresh read.
//
// GcsStore talks to the Cloud Storage JSON API directly, signed in as the
// service's own account through the metadata server, so it needs no packages
// or keys. MemoryStore behaves the same way and is used in tests. Both are
// Slow Chess's store.js, which follows King's Keep's.

class StoreConflict extends Error {}

class MemoryStore {
  constructor() {
    this.files = new Map(); // path → { body, generation, meta }
    this.nextGeneration = 1;
    this.writes = 0;
  }

  async read(path) {
    const f = this.files.get(path);
    return f ? { data: JSON.parse(f.body), generation: f.generation } : null;
  }

  // generation 0: the file must not exist yet.
  async write(path, data, { generation, meta = {} }) {
    const f = this.files.get(path);
    if ((f ? f.generation : 0) !== generation) throw new StoreConflict(`${path} changed`);
    this.writes++;
    const g = this.nextGeneration++;
    this.files.set(path, { body: JSON.stringify(data), generation: g, meta: { ...meta } });
    return g;
  }
}

const API = 'https://storage.googleapis.com';
const TOKEN_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

class GcsStore {
  constructor(bucket, { fetchImpl = fetch, getToken } = {}) {
    this.bucket = bucket;
    this.fetch = fetchImpl;
    this.getToken = getToken || (() => this.metadataToken());
    this.token = null;
  }

  // The service account's access token, cached until shortly before it expires.
  async metadataToken() {
    if (this.token && this.token.expires > Date.now() + 60_000) return this.token.value;
    const res = await this.fetch(TOKEN_URL, { headers: { 'Metadata-Flavor': 'Google' } });
    if (!res.ok) throw new Error(`metadata token: ${res.status}`);
    const t = await res.json();
    this.token = { value: t.access_token, expires: Date.now() + t.expires_in * 1000 };
    return this.token.value;
  }

  async request(url, init = {}) {
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetch(url, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${await this.getToken()}` },
      }).catch((err) => ({ ok: false, status: 0, err }));
      // Retry once on a dropped connection or a server error.
      if ((res.status === 0 || res.status >= 500) && attempt === 0) continue;
      if (res.status === 0) throw res.err;
      return res;
    }
  }

  objectUrl(path) {
    return `${API}/storage/v1/b/${this.bucket}/o/${encodeURIComponent(path)}`;
  }

  async read(path) {
    const res = await this.request(`${this.objectUrl(path)}?alt=media`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`read ${path}: ${res.status}`);
    return { data: await res.json(), generation: Number(res.headers.get('x-goog-generation')) };
  }

  async write(path, data, { generation, meta = {} }) {
    const boundary = `et${Date.now().toString(36)}`;
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name: path, contentType: 'application/json', metadata: meta }),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      JSON.stringify(data),
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const url = `${API}/upload/storage/v1/b/${this.bucket}/o?uploadType=multipart&ifGenerationMatch=${generation}&fields=generation`;
    const res = await this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (res.status === 412) throw new StoreConflict(`${path} changed`);
    if (!res.ok) throw new Error(`write ${path}: ${res.status}`);
    return Number((await res.json()).generation);
  }
}

// A player's record: their best score and the endings they've found for each
// word, and the games they've played, newest last (at most MAX_GAMES).
const MAX_GAMES = 500;
const emptyRecord = () => ({ best: {}, endings: {}, games: [] });

class Records {
  constructor(store) {
    this.store = store;
  }

  path(id) {
    return `players/${encodeURIComponent(id)}.json`;
  }

  async get(id) {
    const f = await this.store.read(this.path(id));
    return f ? { ...emptyRecord(), ...f.data } : emptyRecord();
  }

  // Change a player's record with `change(record)`, retrying from a fresh
  // read if another instance saved it first.
  async update(id, change) {
    for (let attempt = 0; ; attempt++) {
      const f = await this.store.read(this.path(id));
      const record = f ? { ...emptyRecord(), ...f.data } : emptyRecord();
      change(record);
      if (record.games.length > MAX_GAMES) record.games = record.games.slice(-MAX_GAMES);
      try {
        await this.store.write(this.path(id), record, { generation: f ? f.generation : 0 });
        return record;
      } catch (err) {
        if (!(err instanceof StoreConflict) || attempt >= 4) throw err;
      }
    }
  }
}

// Keep what's best of two records' scores and endings.
function mergeInto(record, { best = {}, endings = {} }) {
  for (const [word, score] of Object.entries(best)) {
    if (Number.isFinite(score) && !(record.best[word] >= score)) record.best[word] = score;
  }
  for (const [word, found] of Object.entries(endings)) {
    if (Array.isArray(found)) record.endings[word] = [...new Set([...(record.endings[word] || []), ...found.map(String)])];
  }
}

// The store, or null if GAMES_BUCKET isn't set: then records stay in the
// browser only.
function recordsFromEnv(env = process.env) {
  if (env.GAMES_BUCKET) return new Records(new GcsStore(env.GAMES_BUCKET));
  console.log('GAMES_BUCKET is not set: players\' records stay in their browsers.');
  return null;
}

module.exports = { MemoryStore, GcsStore, StoreConflict, Records, mergeInto, MAX_GAMES, recordsFromEnv };
