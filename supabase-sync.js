/* ============================================================
   NEKO · server/supabase-sync.js
   Menyimpan state server NEKO ke database Supabase (Postgres)
   lewat REST/PostgREST — tanpa dependensi npm, cukup modul bawaan Node.js.

   Fitur:
     * Seluruh isi database NEKO disimpan sebagai SATU baris JSONB
       di tabel `neko_snapshot` dengan key='main'.
     * Saat server menyala: snapshot ditarik (pull).
     * Jika Supabase masih kosong ({}) dan lokal db.json berisi data,
       data lokal otomatis dinaikkan ke Supabase (tidak tertimpa).
     * Jika Supabase sudah ada isinya, data digabung (merge) dua arah.
     * Setiap ada aktivitas (akun baru, profil, chat, teman, poin),
       perubahan otomatis dikirim (push) dengan debounce + antrian.
     * Mendukung format API key lama (JWT service_role) maupun format
       baru (sb_secret_...). Kunci sb_secret_ dikirim lewat header `apikey`
       tanpa Authorization Bearer token agar tidak ditolak PostgREST.
     * Jika Supabase belum terhubung / offline / error, server tetap
       berjalan 100% normal dengan server/db.json lokal.
   ============================================================ */
'use strict';

const https = require('node:https');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

/* ---------------- Baca file .env ---------------- */

function loadDotEnv() {
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env')
  ];
  const result = { found: false, file: '', keys: [] };

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      result.found = true;
      result.file = file;
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        let text = line.trim();
        if (!text || text.startsWith('#')) continue;
        if (text.startsWith('export ')) text = text.slice(7).trim();
        const eq = text.indexOf('=');
        if (eq < 1) continue;
        const name = text.slice(0, eq).trim();
        let value = text.slice(eq + 1).trim();

        // Hapus inline comment jika tidak dalam kutip
        if (!value.startsWith('"') && !value.startsWith("'")) {
          const hashIdx = value.indexOf('#');
          if (hashIdx >= 0) value = value.slice(0, hashIdx).trim();
        }

        // Hapus tanda kutip luar
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1).trim();
        }

        if (!value) continue;
        if (!result.keys.includes(name)) result.keys.push(name);
        if (process.env[name] === undefined) process.env[name] = value;
      }
      break;
    } catch (_) { /* abaikan error baca file */ }
  }
  return result;
}

const DOT_ENV = loadDotEnv();

function normalizeBaseUrl(raw) {
  let url = String(raw || '').trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
  if (!url) return '';
  url = url.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

const TABLE = process.env.NEKO_SNAPSHOT_TABLE || 'neko_snapshot';
const SNAPSHOT_KEY = process.env.NEKO_SNAPSHOT_KEY || 'main';
const BASE_URL = normalizeBaseUrl(process.env.SUPABASE_URL);
const SECRET = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim().replace(/^['"]|['"]$/g, '');
const IS_HTTPS = BASE_URL.startsWith('https://');
const CONFIGURED = Boolean(BASE_URL && SECRET);
const DEBOUNCE_MS = Math.max(500, Number(process.env.NEKO_SYNC_DEBOUNCE_MS || 1500));
const AUTH_MODE = String(process.env.SUPABASE_AUTH_MODE || 'auto').toLowerCase();

/* ---------------- Logging format rapi ---------------- */

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function log() {
  console.log.apply(console, ['[' + stamp() + '] [neko:supabase]'].concat(Array.prototype.slice.call(arguments)));
}

function warn() {
  console.warn.apply(console, ['[' + stamp() + '] [neko:supabase]'].concat(Array.prototype.slice.call(arguments)));
}

function keyHint() {
  if (!SECRET) return '(kosong)';
  const kind = SECRET.startsWith('sb_secret_') ? 'sb_secret (kunci baru)'
    : SECRET.startsWith('sb_publishable_') ? 'sb_publishable (kunci publik)'
      : SECRET.startsWith('eyJ') ? 'service_role (JWT lama)' : 'format lain';
  return kind + ' · ' + SECRET.length + ' karakter · ...' + SECRET.slice(-4);
}

/**
 * Header autentikasi Supabase yang aman dan sesuai standar terbaru.
 * Kunci baru (sb_secret_...) HANYA dikirim via header `apikey`.
 * Authorization: Bearer HANYA dikirim jika kunci berformat JWT (diawali eyJ...).
 */
function authHeaders() {
  if (!SECRET || AUTH_MODE === 'none') return {};
  const isJwt = SECRET.startsWith('eyJ');
  const headers = {
    apikey: SECRET
  };

  if (AUTH_MODE === 'bearer' || (AUTH_MODE === 'auto' && isJwt)) {
    headers.Authorization = 'Bearer ' + SECRET;
  }
  return headers;
}

/* ---------------- HTTP Client bawaan Node.js ---------------- */

function call(method, query, optHeaders, body) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(BASE_URL + '/rest/v1/' + TABLE + (query ? '?' + query : ''));
    } catch (error) {
      reject(new Error('SUPABASE_URL tidak valid: ' + error.message));
      return;
    }

    const lib = IS_HTTPS ? https : http;
    const headers = Object.assign(
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      authHeaders(),
      optHeaders || {}
    );

    if (body) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const started = Date.now();
    const req = lib.request(url, {
      method,
      headers,
      timeout: 15000
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          raw,
          ms: Date.now() - started
        });
      });
    });

    req.on('timeout', () => req.destroy(new Error('waktu habis (15s) saat menghubungi Supabase')));
    req.on('error', (error) => {
      if (error.code === 'ENOTFOUND') {
        reject(new Error('SUPABASE_URL tidak bisa di-resolve (' + (error.hostname || BASE_URL) + ') — cek koneksi internet / DNS'));
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
        reject(new Error('koneksi ke Supabase ditolak/putus (' + error.code + ')'));
      } else {
        reject(error);
      }
    });

    if (body) req.write(body);
    req.end();
  });
}

function explain(result) {
  const status = result.status;
  const detail = String(result.raw || '').replace(/\s+/g, ' ').slice(0, 260);
  const sbErrorCode = result.headers && result.headers['sb-error-code'];

  if (sbErrorCode === 'UNAUTHORIZED_UNREGISTERED_API_KEY' || detail.includes('Unregistered API key')) {
    return 'HTTP 401 — Kunci API tidak terdaftar (UNAUTHORIZED_UNREGISTERED_API_KEY). '
      + 'Pastikan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di server/.env berasal dari project yang sama di Supabase Dashboard (Project Settings > API).';
  }
  if (status === 401 || status === 403) {
    return 'HTTP ' + status + ' — Akses ditolak Supabase. Pastikan memakai kunci service_role / sb_secret_ (bukan anon/publishable). Kunci: '
      + keyHint() + '. Detail: ' + detail;
  }
  if (status === 404) {
    return 'HTTP 404 — Tabel "' + TABLE + '" belum dibuat di Supabase schema public. Jalankan skrip server/supabase/schema.sql di SQL Editor.';
  }
  if (status === 400 || status === 406) {
    return 'HTTP ' + status + ' — Format data ditolak PostgREST. Detail: ' + detail;
  }
  if (status >= 500) {
    return 'HTTP ' + status + ' — Layanan Supabase sedang kendala internal; data aman di server/db.json. Detail: ' + detail;
  }
  return 'HTTP ' + status + ' — ' + detail;
}

/* ---------------- Antrian Push & Debounce ---------------- */

let lastPushedRevision = 0;
let pending = null;
let inFlight = false;
let timer = null;
let failures = 0;
let lastError = '';
let lastPushAt = 0;
let lastPushMs = 0;
let lastPushKb = 0;
let pushCount = 0;
let lastPullAt = 0;
let lastPullInfo = '';

/**
 * Kirim snapshot ke Supabase:
 * 1. Coba PATCH langsung ke baris key=main (karena schema.sql membuat baris awal).
 * 2. Jika belum ada atau gagal, coba POST upsert dengan on_conflict=key.
 * 3. Jika gagal, coba POST biasa.
 */
async function sendSnapshot(bodyArray, bodyObject) {
  // Percobaan 1: PATCH baris yang sudah ada
  const patched = await call('PATCH', 'key=eq.' + encodeURIComponent(SNAPSHOT_KEY), {
    Prefer: 'return=representation'
  }, bodyObject);
  if (patched.status >= 200 && patched.status < 300) {
    // Jika PATCH mengembalikan baris yang diubah (atau sukses minimal)
    if (!Array.isArray(patched.body) || patched.body.length > 0) {
      return { ok: true, via: 'PATCH', result: patched };
    }
  }

  // Percobaan 2: POST upsert on_conflict=key
  const upsert = await call('POST', 'on_conflict=key', {
    Prefer: 'return=minimal,resolution=merge-duplicates'
  }, bodyArray);
  if (upsert.status >= 200 && upsert.status < 300) {
    return { ok: true, via: 'POST upsert', result: upsert };
  }

  // Percobaan 3: POST biasa
  const plain = await call('POST', '', {
    Prefer: 'return=minimal'
  }, bodyArray);
  if (plain.status >= 200 && plain.status < 300) {
    return { ok: true, via: 'POST insert', result: plain };
  }

  return { ok: false, via: 'PATCH / POST upsert', errors: [patched, upsert, plain] };
}

async function drain() {
  if (inFlight || !CONFIGURED) return;
  const payload = pending;
  if (!payload) return;

  pending = null;
  inFlight = true;
  const revision = lastPushedRevision + 1;
  const now = new Date().toISOString();

  const item = {
    key: SNAPSHOT_KEY,
    value: payload,
    revision,
    updated_at: now
  };

  const bodyArray = JSON.stringify([item]);
  const bodyObject = JSON.stringify({
    value: payload,
    revision,
    updated_at: now
  });

  const kb = Math.round(Buffer.byteLength(bodyArray) / 1024);

  try {
    const sent = await sendSnapshot(bodyArray, bodyObject);
    if (sent.ok) {
      lastPushedRevision = revision;
      failures = 0;
      lastError = '';
      lastPushAt = Date.now();
      lastPushMs = sent.result.ms;
      lastPushKb = kb;
      pushCount += 1;
      log('kirim snapshot SUKSES · rev ' + revision + ' · ' + kb + ' KB · ' + sent.result.ms + 'ms · via ' + sent.via);
    } else {
      const parts = sent.errors.map(explain);
      throw new Error(parts[0] || parts[1] || 'Gagal menyimpan snapshot ke Supabase');
    }
  } catch (error) {
    failures += 1;
    lastError = error.message;
    pending = payload; // data tetap dijaga untuk dicoba ulang
    const delay = Math.min(60000, DEBOUNCE_MS * Math.pow(2, Math.min(failures, 5)));
    warn('kirim snapshot GAGAL (' + failures + 'x) — ' + error.message);
    if (failures === 1) {
      warn('data tetap aman di server/db.json; server terus berjalan dan sinkron dicoba otomatis.');
    }
    scheduleDrain(delay);
  } finally {
    inFlight = false;
  }
}

function scheduleDrain(delay) {
  clearTimeout(timer);
  timer = setTimeout(() => { drain().catch(() => {}); }, Math.max(0, delay));
  if (timer && typeof timer.unref === 'function') timer.unref();
}

/* ---------------- API Publik ---------------- */

/**
 * Ambil snapshot dari Supabase.
 * Mengembalikan: { value, revision, updatedAt, empty }
 * empty=true jika baris belum ada atau value masih {}
 */
async function pull() {
  if (!CONFIGURED) return null;
  const result = await call('GET', 'select=key,value,revision,updated_at&key=eq.' + encodeURIComponent(SNAPSHOT_KEY), {
    Accept: 'application/json'
  });
  lastPullAt = Date.now();

  if (result.status >= 300) {
    lastPullInfo = 'gagal HTTP ' + result.status;
    throw new Error(explain(result));
  }

  const rows = Array.isArray(result.body) ? result.body : [];
  if (!rows.length) {
    lastPullInfo = 'baris key=' + SNAPSHOT_KEY + ' belum ada';
    log('tarik snapshot (' + result.ms + 'ms): ' + lastPullInfo + ' — data lokal siap dikirim naik.');
    return { value: {}, revision: 0, updatedAt: '', empty: true };
  }

  const row = rows[0];
  let val = row.value;
  if (typeof val === 'string') {
    try { val = JSON.parse(val); } catch (_) { val = null; }
  }

  const revision = Number(row.revision || 0);
  lastPushedRevision = revision;

  if (!val || typeof val !== 'object' || Object.keys(val).length === 0) {
    lastPullInfo = 'snapshot Supabase masih kosong ({})';
    log('tarik snapshot (' + result.ms + 'ms): ' + lastPullInfo + ' · rev ' + revision + ' — data lokal yang akan diunggah.');
    return { value: {}, revision, updatedAt: row.updated_at || '', empty: true };
  }

  const collCount = Object.keys(val).length;
  lastPullInfo = collCount + ' koleksi · rev ' + revision;
  log('tarik snapshot (' + result.ms + 'ms): dapat ' + lastPullInfo + ' · diubah ' + (row.updated_at || '-'));
  return { value: val, revision, updatedAt: row.updated_at || '', empty: false };
}

/**
 * Masukkan database lokal ke antrean kirim Supabase (debounce).
 */
function push(state) {
  if (!CONFIGURED) return false;
  pending = state;
  scheduleDrain(DEBOUNCE_MS);
  return true;
}

/**
 * Kirim langsung saat ini juga tanpa debounce (dipakai saat boot).
 */
async function pushNow(state) {
  if (!CONFIGURED) return false;
  clearTimeout(timer);
  pending = state;
  await drain();
  return failures === 0;
}

/**
 * Tunggu seluruh antrean kirim selesai sebelum shutdown.
 */
async function flush(timeoutMs = 5000) {
  if (!CONFIGURED) return false;
  const until = Date.now() + timeoutMs;
  while ((pending || inFlight) && Date.now() < until) {
    if (!inFlight) await drain();
    const wait = Math.max(50, Math.min(300, until - Date.now()));
    await new Promise((r) => setTimeout(r, wait));
  }
  return !pending;
}

function status() {
  if (!CONFIGURED) {
    return {
      enabled: false,
      detail: DOT_ENV.found
        ? 'server/.env terbaca, tetapi SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY masih kosong — berjalan dengan server/db.json saja.'
        : 'server/.env tidak ditemukan — berjalan dengan server/db.json saja.',
      dotenv: DOT_ENV
    };
  }

  return {
    enabled: true,
    url: BASE_URL.replace(/^https?:\/\//, ''),
    table: TABLE + ' (key=' + SNAPSHOT_KEY + ')',
    key: keyHint(),
    authMode: AUTH_MODE,
    dotenv: DOT_ENV,
    revision: lastPushedRevision,
    pendingKb: pending ? Math.round(Buffer.byteLength(JSON.stringify(pending)) / 1024) : 0,
    inFlight,
    failures,
    lastError,
    lastPushAt,
    lastPushMs,
    lastPushKb,
    pushCount,
    lastPullAt,
    lastPullInfo,
    debounceMs: DEBOUNCE_MS,
    detail: BASE_URL.replace(/^https?:\/\//, '') + ' · tabel ' + TABLE + ' · rev ' + lastPushedRevision
  };
}

function logStartup() {
  if (!CONFIGURED) {
    log('Sinkronisasi Supabase NONAKTIF — server berjalan penuh dengan server/db.json.');
    if (DOT_ENV.found) {
      log('File .env terbaca (' + DOT_ENV.file + '), tapi SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi.');
    } else {
      log('File server/.env belum dibuat. Salin dari server/.env.example jika ingin sinkron cloud.');
    }
    return false;
  }

  log('File .env: terbaca (' + (DOT_ENV.file ? path.basename(DOT_ENV.file) : 'environment') + ', kunci: ' + DOT_ENV.keys.join(', ') + ')');
  log('Target: ' + BASE_URL + ' · tabel ' + TABLE + ' · baris key="' + SNAPSHOT_KEY + '"');
  log('Kredensial: ' + keyHint());
  log('Header auth: apikey=' + (SECRET.slice(0, 10) + '...') + (SECRET.startsWith('eyJ') ? ' + Authorization: Bearer' : ' (tanpa Bearer, aman untuk format baru sb_secret_)'));
  log('Debounce push: ' + DEBOUNCE_MS + 'ms · auto-retry eksponensial');
  return true;
}

module.exports = {
  CONFIGURED,
  TABLE,
  SNAPSHOT_KEY,
  BASE_URL,
  pull,
  push,
  pushNow,
  flush,
  status,
  logStartup,
  log,
  warn
};
