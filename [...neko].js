/* ============================================================
   NEKO · api/[...neko].js
   Titik masuk serverless (Vercel) untuk SELURUH API NEKO:
   /api/auth/*, /api/profile, /api/community, /api/friends,
   /api/messages, /api/live/*, /api/notifications/poll, dst.

   Tidak ada lagi hosting Node 24 jam (Render dsb.). Setiap permintaan:

     1. baca snapshot dari Supabase  (server/cloud-store.js)
     2. jalankan handler NEKO yang sama dengan server lokal
     3. simpan kembali dengan compare-and-swap (revision)
     4. kalau ada penulis lain di antara 1-3 → ulangi (maks 4x)

   Jadi data akun tetap utuh walau banyak perangkat membuka NEKO
   bersamaan, dan tidak ada satu pun proses yang perlu "selalu hidup".
   ============================================================ */
'use strict';

/* Harus diset SEBELUM modul lain dimuat: memberi tahu server.js bahwa ia
   berjalan tanpa disk dan tanpa WebSocket, serta mematikan penulis snapshot
   lama (supabase-sync) supaya tidak menimpa tulisan compare-and-swap. */
process.env.NEKO_SERVERLESS = '1';

const { Readable } = require('node:stream');
const store = require('../server/cloud-store.js');
const core = require('../server/server.js');

const MAX_ATTEMPTS = 4;
const POLL_WAIT_MS = 2500;

/* Endpoint yang hanya membaca: tidak perlu menulis snapshot balik.
   Ini menghemat kuota Supabase dan menghilangkan risiko tulis-tulis kosong. */
const READ_ONLY = new Set([
  'GET /health',
  'GET /api/health',
  'GET /api/community',
  'GET /api/auth/session',
  'GET /api/users/search',
  'GET /api/friends',
  'GET /api/chats',
  'GET /api/live/state',
  'GET /api/live/wait',
  'GET /api/room/state',
  'GET /api/room/list',
  'GET /api/room/wait',
  'GET /api/notifications/poll',
  'GET /api/sync-status'
]);

/* ---------------- Objek req/res tiruan ---------------- */

function makeReq(method, url, headers, bodyBuffer) {
  const stream = bodyBuffer && bodyBuffer.length ? Readable.from([bodyBuffer]) : Readable.from([]);
  stream.method = method;
  stream.url = url;
  stream.headers = headers || {};
  stream.socket = { remoteAddress: '127.0.0.1' };
  return stream;
}

function makeRes(capture) {
  const res = {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    setHeader(name, value) { capture.headers[String(name).toLowerCase()] = value; },
    getHeader(name) { return capture.headers[String(name).toLowerCase()]; },
    removeHeader(name) { delete capture.headers[String(name).toLowerCase()]; },
    writeHead(status, headers) {
      capture.status = status;
      if (headers && typeof headers === 'object') {
        for (const [name, value] of Object.entries(headers)) capture.headers[String(name).toLowerCase()] = value;
      }
      res.headersSent = true;
      return res;
    },
    write(chunk) {
      if (chunk) capture.chunks.push(Buffer.from(chunk));
      return true;
    },
    end(chunk) {
      if (chunk) capture.chunks.push(Buffer.from(chunk));
      capture.status = capture.status || 200;
      res.writableEnded = true;
      return res;
    },
    on() { return res; },
    once() { return res; },
    emit() { return false; }
  };
  return res;
}

function newCapture() {
  return { status: 200, headers: {}, chunks: [] };
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/* ---------------- Kelas Langsung: hidup di dalam snapshot ---------------- */

function serializeLiveRooms() {
  const list = [];
  for (const room of core.liveRooms.values()) {
    list.push(Object.assign({}, room, { players: Array.from(room.players.entries()) }));
  }
  return list;
}

function restoreLiveRooms(list) {
  core.liveRooms.clear();
  if (!Array.isArray(list)) return;
  for (const item of list) {
    if (!item || !item.pin) continue;
    core.liveRooms.set(String(item.pin), Object.assign({}, item, { players: new Map(item.players || []) }));
  }
}

/* ---------------- Notifikasi (polling) ----------------
   Event tidak disimpan di memori serverless (pasti hilang antar-permintaan),
   jadi dihitung ulang dari data: pesan baru, permintaan teman, pengumuman. */

function collectEvents(db, me, since) {
  const self = String(me || '').toLowerCase();
  const cutoff = Number(since) || 0;
  const events = [];
  if (!self) return events;

  for (const [chatKey, messages] of Object.entries(db.chats || {})) {
    if (!String(chatKey).split('|').includes(self)) continue;
    for (const message of messages || []) {
      if (!message || message.to !== self) continue;
      const at = Number(message.at || 0);
      if (at <= cutoff) continue;
      const sender = (db.users || {})[message.from];
      events.push({
        seq: at,
        type: 'message',
        data: {
          from: message.from,
          displayName: (sender && sender.displayName) || message.from,
          text: message.text,
          at
        }
      });
    }
  }

  const record = (db.friends || {})[self];
  if (record && cutoff === 0) {
    for (const fromKey of record.incoming || []) {
      const user = (db.users || {})[fromKey];
      events.push({
        seq: Date.now() - 1,
        type: 'friend-request',
        data: { from: fromKey, displayName: (user && user.displayName) || fromKey }
      });
    }
  }

  if (cutoff === 0) {
    for (const item of ((db.community || {}).announcements || []).slice(0, 5)) {
      events.push({
        seq: Number(item.time || 0) || Date.now() - 2,
        type: 'announcement',
        data: { id: item.id, title: item.title, body: item.body, author: item.author }
      });
    }
  }

  events.sort((a, b) => a.seq - b.seq);
  return events.slice(-40);
}

function tokenOf(headers) {
  const header = String((headers && headers.authorization) || '');
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

function usernameOfToken(db, token) {
  const session = token && (db.sessions || {})[token];
  return session ? session.username : '';
}

/* ---------------- Jawaban ---------------- */

function sendCaptured(res, capture) {
  const status = capture.status || 200;
  const headers = Object.assign({}, capture.headers);
  const body = capture.chunks.length ? Buffer.concat(capture.chunks) : Buffer.alloc(0);
  headers['cache-control'] = 'no-store';
  headers['content-length'] = String(body.length);
  res.writeHead(status, headers);
  res.end(body);
}

function sendJSONDirect(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': String(body.length)
  });
  res.end(body);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------------- Handler ---------------- */

module.exports = async function handler(req, res) {
  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Vary': 'Origin',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    });
    res.end();
    return;
  }

  let requestBody = Buffer.alloc(0);
  if (method !== 'GET' && method !== 'HEAD') {
    try { requestBody = await readRequestBody(req); } catch (error) { requestBody = Buffer.alloc(0); }
  }

  const url = req.url || '/api/health';
  const pathname = String(url).split('?')[0];
  const headers = Object.assign({}, req.headers);

  /* ---- Endpoint polling: dijawab langsung, tanpa menyentuh state ---- */
  if (method === 'GET' && (pathname === '/api/notifications/poll' || pathname === '/api/live/wait' || pathname === '/api/room/wait')) {
    try {
      const snap = await store.readSnapshot();
      const db = core.mergeDB(core.emptyDB(), snap.value || {});
      restoreLiveRooms((snap.value || {}).__live);

      if (pathname === '/api/notifications/poll') {
        const query = new URLSearchParams(String(url).split('?')[1] || '');
        const since = Number(query.get('since') || 0) || 0;
        const me = usernameOfToken(db, tokenOf(headers));
        const events = collectEvents(db, me, since);
        if (!events.length) await wait(POLL_WAIT_MS);
        return sendJSONDirect(res, 200, { events, timeout: !events.length });
      }

      /* live/wait & room/wait: kembalikan state terbaru, tunggu sebentar
         kalau belum ada perubahan supaya klien tidak membanjiri server. */
      const capture = newCapture();
      const fake = makeReq('GET', url.replace('/api/live/wait', '/api/live/state').replace('/api/room/wait', '/api/room/state'), headers, null);
      const fakeRes = makeRes(capture);
      await core.handle(fake, fakeRes);
      await wait(POLL_WAIT_MS);
      return sendCaptured(res, capture);
    } catch (error) {
      return sendJSONDirect(res, 200, { events: [], timeout: true, note: 'poll-fallback: ' + error.message });
    }
  }

  /* ---- Permintaan biasa: baca → jalankan → tulis (CAS) ---- */
  const routeKey = method + ' ' + pathname;
  const shouldCommit = !READ_ONLY.has(routeKey);

  let lastError = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let snap;
    try {
      snap = await store.readSnapshot();
    } catch (error) {
      lastError = error;
      break;
    }

    const db = core.mergeDB(core.emptyDB(), snap.value || {});
    core.setDB(db);
    restoreLiveRooms((snap.value || {}).__live);

    const capture = newCapture();
    const fakeReq = makeReq(method, url, headers, requestBody);
    const fakeRes = makeRes(capture);

    try {
      await core.handle(fakeReq, fakeRes);
    } catch (error) {
      return sendJSONDirect(res, 500, { error: error.message || 'server error' });
    }

    if (!shouldCommit) return sendCaptured(res, capture);

    const payload = Object.assign({}, core.getDB(), { __live: serializeLiveRooms() });
    let write;
    try {
      write = await store.writeSnapshot(payload, snap.revision);
    } catch (error) {
      lastError = error;
      break;
    }

    if (write.ok) return sendCaptured(res, capture);
    if (!write.conflict) { lastError = new Error(write.error || 'gagal menyimpan'); break; }
    await wait(40 + attempt * 60);   // ada penulis lain: ulangi dengan data terbaru
  }

  sendJSONDirect(res, 503, {
    error: 'Data NEKO sedang sibuk ditulis perangkat lain. Coba lagi sebentar.',
    detail: lastError ? lastError.message : 'konflik penyimpanan'
  });
};
