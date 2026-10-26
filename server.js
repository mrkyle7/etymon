'use strict';

// Etymon — served at https://etymon.cheetahmoongames.com
//
// No dependencies: it serves public/, a health check, /api/me, who the player
// is signed in as (see auth.js), and /api/record, a signed-in player's best
// scores, endings found and games played (see store.js). The game runs
// entirely in the browser.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { createAuth } = require('./auth');
const { recordsFromEnv, mergeInto } = require('./store');

const MAX_BODY = 64 * 1024;
const WORD = /^[a-z]{1,20}$/;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

class BadBody extends Error {}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new BadBody('too big')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new BadBody('not JSON')); }
    });
    req.on('error', reject);
  });
}

// A finished game as the page sends it, kept to what the history shows.
function cleanGame(g) {
  if (!g || !WORD.test(g.word) || !Number.isFinite(g.score) || !Array.isArray(g.log)) return null;
  const text = (v) => String(v || '').slice(0, 60);
  return {
    word: g.word, at: new Date().toISOString(), score: g.score, outcome: text(g.outcome), goal: text(g.goal),
    log: g.log.slice(0, 20).map((l) => ({
      year: Number(l.year) || 0, senses: (Array.isArray(l.senses) ? l.senses : []).slice(0, 12).map(text),
      wanted: (Array.isArray(l.wanted) ? l.wanted : []).slice(0, 4).map(text), delta: Number(l.delta) || 0,
      speakers: Number(l.speakers) || 0, kept: !!l.kept, meant: !!l.meant, really: text(l.really),
    })),
  };
}

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function createServer({ auth = createAuth(), records = recordsFromEnv() } = {}) {
  return http.createServer(async (req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Bad request');
      return;
    }

    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      return;
    }

    // Who's playing. Players sign in once, at cheetahmoongames.com/login.
    if (pathname === '/api/me') {
      const player = await auth.player(req);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(player
        ? { signedIn: true, id: player.id, name: player.name }
        : { signedIn: false, loginUrl: auth.loginUrl('https://etymon.cheetahmoongames.com/') }));
      return;
    }

    // A signed-in player's record: GET it, POST a finished game to
    // /api/record/games, or POST best scores and endings from the browser to
    // /api/record/merge. Keyed by the player's Cheetah Moon id.
    if (pathname === '/api/record' || pathname.startsWith('/api/record/')) {
      if (!records) return sendJson(res, 503, { error: 'not configured' });
      const player = await auth.player(req);
      if (!player) return sendJson(res, 401, { error: 'not signed in' });
      try {
        if (req.method === 'GET' && pathname === '/api/record') return sendJson(res, 200, await records.get(player.id));
        if (req.method === 'POST' && pathname === '/api/record/merge') {
          const body = await readJson(req);
          return sendJson(res, 200, await records.update(player.id, (r) => mergeInto(r, body)));
        }
        if (req.method === 'POST' && pathname === '/api/record/games') {
          const game = cleanGame(await readJson(req));
          if (!game) return sendJson(res, 400, { error: 'not a game' });
          return sendJson(res, 200, await records.update(player.id, (r) => {
            r.games.push(game);
            mergeInto(r, { best: { [game.word]: game.score }, endings: game.outcome === 'arrived' ? { [game.word]: [game.goal] } : {} });
          }));
        }
        return sendJson(res, 404, { error: 'not found' });
      } catch (err) {
        if (err instanceof BadBody) return sendJson(res, 400, { error: err.message });
        console.error('record', err.message);
        return sendJson(res, 500, { error: 'could not save' });
      }
    }

    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(PUBLIC_DIR, rel);
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  createServer().listen(port, () => console.log(`Listening on http://localhost:${port}`));
}

module.exports = { createServer };
