/* ============================================================
   NEKO · server/supabase-sync.js
   Menyimpan state server NEKO ke database Supabase (Postgres)
   lewat REST/PostgREST — tanpa dependensi npm, cukup Node.

   Cara kerja:
     * Seluruh isi db (sama seperti server/db.json) disimpan sebagai
       SATU baris JSONB di tabel `neko_snapshot` dengan key='main'.
     * Saat server menyala, snapshot diambil dulu (pull).
     * Setiap kali server menyimpan data, snapshot dikirim (push)
       dengan debounce + antrian + retry eksponensial, jadi tidak ada
       request berlebih dan tidak ada kiriman yang hilang.
     * Kalau SUPABASE_URL / kunci tidak diisi, modul ini diam total
       dan server tetap memakai server/db.json seperti biasa.

   Kunci yang dipakai HARUS service_role / sb_secret_ (hanya boleh ada
   di server, jangan pernah masuk ke APK atau JavaScript browser).
   ============================================================ */
'use strict';

const https = require('node:https');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

/* ---------------- Baca .env di samping server.js ---------------- */

function loadDotEnv() {
  const file = path.join(__dirname, '.env');
  const result = { found: false, keys: [] };
  try {
    if (!fs.existsSync(file)) return result;
    result.found = true;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      let text = line.trim();
      if (!text || text.startsWith('#')) continue;
      if (text.startsWith('export ')) text = text.slice(7).trim();
      const eq = text.indexOf('=');
      if (eq < 1) continue;
      const name = text.slice(0, eq).trim();
      let value = text.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!value) continue;
      result.keys.push(name);
      if (process.env[name] === undefined) process.env[name] = value;
    }
  } catch (error) { /* .env tidak wajib */ }
  return result;
}

const DOT_ENV = loadDotEnv();

const TABLE = process.env.NEKO_SNAPSHOT_TABLE || 'neko_snapshot';
const SNAPSHOT_KEY = process.env.NEKO_SNAPSHOT_KEY || 'main';
const BASE_URL = normalizeBaseUrl(process.env.SUPABASE_URL);
const SECRET = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '');
const IS_HTTPS = BASE_URL.startsWith('https://');
const CONFIGURED = Boolean(BASE_URL && SECRET);
const DEBOUNCE_MS = Number(process.env.NEKO_SYNC_DEBOUNCE_MS || 1500);

/* SUPABASE_URL di dashboard Supabase kadang disalin lengkap dengan
   '/rest/v1' di ujungnya. Modul ini selalu menambahkan '/rest/v1/<tabel>'
   sendiri, jadi sisanya dibuang supaya tidak jadi /rest/v1/rest/v1 (PGRST125). */
function normalizeBaseUrl(raw) {
  let url = String(raw || '').trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
  if (!url) return '';
  url = url.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

/* Mode autentikasi:
   bearer = apikey + Authorization: Bearer <kunci>  (default — inilah yang benar)
   apikey = hanya header apikey, kalau network policy project-nya diubah
   none   = tanpa keduanya; hampir selalu diblokir RLS (buat debug) */
const AUTH_MODE = String(process.env.SUPABASE_AUTH_MODE || 'bearer').toLowerCase();

/* ---------------- Log ---------------- */

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

/** Kunci tidak pernah dicetak utuh — hanya format, panjang, dan 4 karakter akhir. */
function keyHint() {
  if (!SECRET) return '(kosong)';
  const kind = SECRET.startsWith('sb_secret_') ? 'sb_secret'
    : SECRET.startsWith('sb_publishable_') ? 'sb_publishable'
      : SECRET.startsWith('eyJ') ? 'legacy JWT' : 'kunci lain';
  return kind + ' · ' + SECRET.length + ' karakter · ...' + SECRET.slice(-4);
}

function authHeaders() {
  if (AUTH_MODE === 'none') return {};
  if (AUTH_MODE === 'apikey') return { apikey: SECRET };
  // PostgREST menuntut DUA header: apikey dan Authorization.
  // Kunci model baru (sb_secret_...) juga dipakai sebagai Bearer — persis seperti service_role lama.
  return { apikey: SECRET, Authorization: 'Bearer ' + SECRET };
}


/* ---------------- HTTP kecil ---------------- */

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
      { 'Content-Type': 'application/json', Accept: 'application/json' },
      authHeaders(),
      optHeaders || {}
    );
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
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
        try { parsed = JSON.parse(raw); } catch (error) { parsed = null; }
        resolve({ status: res.statusCode, body: parsed, raw, ms: Date.now() - started });
      });
    });
    req.on('timeout', () => req.destroy(new Error('waktu habis (15s) saat menghubungi Supabase')));
    req.on('error', (error) => {
      if (error.code === 'ENOTFOUND') {
        reject(new Error('SUPABASE_URL tidak bisa di-resolve (' + error.hostname + ') — cek koneksi internet/DNS'));
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

/** Terjemahkan kegagalan HTTP jadi pesan yang bisa dibaca sendiri. */
function explain(result) {
  const status = result.status;
  const detail = String(result.raw || '').replace(/\s+/g, ' ').slice(0, 240);
  if (status === 401 || status === 403) {
    return 'HTTP ' + status + ' — Supabase menolak akses. Kunci harus service_role / sb_secret_ (bukan anon/publishable) '
      + 'dan RLS tabel ' + TABLE + ' harus bisa dilewati kunci tersebut. Kunci sekarang: ' + keyHint() + '. Detail: ' + detail;
  }
  if (status === 404) {
    return 'HTTP 404 — tabel ' + TABLE + ' tidak ditemukan di schema public, atau SUPABASE_URL milik project lain. Detail: ' + detail;
  }
  if (status === 400 || status === 406) {
    return 'HTTP ' + status + ' — permintaan ditolak PostgREST (kolom tidak cocok / Prefer header salah). Detail: ' + detail;
  }
  if (status >= 500) {
    return 'HTTP ' + status + ' — Supabase sedang bermasalah; data aman di server/db.json dan akan dicoba lagi. Detail: ' + detail;
  }
  return 'HTTP ' + status + ' — ' + detail;
}

/* ---------------- Antrian push ---------------- */

let lastPushedRevision = 0;
let pending = null;          // db object terbaru yang belum terkirim
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

/** Kirim snapshot: POST upsert, lalu PATCH, lalu POST biasa sebagai cadangan. */
async function sendSnapshot(body) {
  const first = await call('POST', 'on_conflict=key', {
    Prefer: 'return=minimal,resolution=merge-duplicates'
  }, body);
  if (first.status >= 200 && first.status < 300) return { ok: true, via: 'POST upsert', result: first };

  warn('POST upsert gagal (HTTP ' + first.status + '), coba PATCH ke baris key=' + SNAPSHOT_KEY);
  const patched = await call('PATCH', 'key=eq.' + encodeURIComponent(SNAPSHOT_KEY), {
    Prefer: 'return=representation'
  }, body);
  if (patched.status >= 200 && patched.status < 300) return { ok: true, via: 'PATCH', result: patched };

  warn('PATCH juga gagal (HTTP ' + patched.status + '), percobaan terakhir: POST tanpa on_conflict');
  const plain = await call('POST', '', { Prefer: 'return=minimal,resolution=merge-duplicates' }, body);
  if (plain.status >= 200 && plain.status < 300) return { ok: true, via: 'POST', result: plain };

  return { ok: false, via: 'POST upsert / PATCH / POST', errors: [first, patched, plain] };
}

async function drain() {
  if (inFlight || !CONFIGURED) return;
  const payload = pending;
  if (!payload) return;
  pending = null;
  inFlight = true;
  const revision = lastPushedRevision + 1;
  const body = JSON.stringify([{
    key: SNAPSHOT_KEY,
    value: payload,
    revision,
    updated_at: new Date().toISOString()
  }]);
  const kb = Math.round(Buffer.byteLength(body) / 1024);
  try {
    const sent = await sendSnapshot(body);
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
      throw new Error(parts[0] + ' || percobaan terakhir: ' + parts[2]);
    }
  } catch (error) {
    failures += 1;
    lastError = error.message;
    pending = payload; // jangan buang data: coba lagi
    const delay = Math.min(60000, DEBOUNCE_MS * Math.pow(2, Math.min(failures, 5)));
    warn('kirim snapshot GAGAL (' + failures + 'x), dicoba lagi dalam ' + delay + 'ms —', error.message);
    if (failures === 3) warn('data tetap aman di server/db.json; sinkronisasi berjalan terus di latar belakang.');
    scheduleDrain(delay);
  } finally {
    inFlight = false;
  }
}

function scheduleDrain(delay) {
  clearTimeout(timer);
  timer = setTimeout(() => { drain().catch(() => {}); }, Math.max(0, delay));
  // jangan menahan proses saat server hendak mati
  if (timer && typeof timer.unref === 'function') timer.unref();
}

/* ---------------- API modul ---------------- */

/**
 * Ambil snapshot dari Supabase.
 * @returns {Promise<null|{value, revision, updatedAt, empty}>} — null hanya kalau tidak terkonfigurasi.
 */
async function pull() {
  if (!CONFIGURED) return null;
  const result = await call('GET',
    'select=value,revision,updated_at&key=eq.' + encodeURIComponent(SNAPSHOT_KEY),
    { Accept: 'application/json' });
  lastPullAt = Date.now();
  if (result.status >= 300) {
    lastPullInfo = 'gagal HTTP ' + result.status;
    throw new Error(explain(result));
  }
  const rows = Array.isArray(result.body) ? result.body : [];
  if (!rows.length) {
    lastPullInfo = 'baris key=' + SNAPSHOT_KEY + ' belum ada';
    log('tarik snapshot (' + result.ms + 'ms): ' + lastPullInfo + ' — data lokal yang akan dikirim naik.');
    return { value: null, revision: 0, updatedAt: '', empty: true };
  }
  const row = rows[0];
  let value = row.value;
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch (error) { value = null; } }
  const revision = Number(row.revision || 0);
  lastPushedRevision = revision;
  if (!value || typeof value !== 'object' || Object.keys(value).length === 0) {
    lastPullInfo = 'snapshot masih kosong ({})';
    log('tarik snapshot (' + result.ms + 'ms): ' + lastPullInfo + ' · rev ' + revision + ' — data lokal yang akan dikirim naik.');
    return { value: {}, revision, updatedAt: row.updated_at || '', empty: true };
  }
  lastPullInfo = Object.keys(value).length + ' koleksi · rev ' + revision;
  log('tarik snapshot (' + result.ms + 'ms): dapat ' + lastPullInfo + ' · diubah ' + (row.updated_at || '-'));
  return { value, revision, updatedAt: row.updated_at || '', empty: false };
}

/** Simpan snapshot db ke Supabase (debounce). */
function push(state) {
  if (!CONFIGURED) return false;
  pending = state;
  scheduleDrain(DEBOUNCE_MS);
  return true;
}

/** Kirim sekarang juga tanpa menunggu debounce — dipakai saat server baru menyala. */
async function pushNow(state) {
  if (!CONFIGURED) return false;
  clearTimeout(timer);
  pending = state;
  await drain();
  return failures === 0;
}

/** Tunggu kiriman terakhir selesai — dipakai saat server dimatikan. */
async function flush(timeoutMs = 5000) {
  if (!CONFIGURED) return false;
  const until = Date.now() + timeoutMs;
  while ((pending || inFlight) && Date.now() < until) {
    if (!inFlight) await drain();
    const wait = Math.max(50, Math.min(400, until - Date.now()));
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  if (pending) warn('server dimatikan saat masih ada ' + Math.round(Buffer.byteLength(JSON.stringify(pending)) / 1024) + ' KB belum terkirim — data tetap aman di server/db.json.');
  return !pending;
}

function status() {
  if (!CONFIGURED) {
    return {
      enabled: false,
      detail: DOT_ENV.found
        ? 'server/.env terbaca, tapi SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong — pakai server/db.json saja.'
        : 'server/.env tidak ditemukan di samping server.js — pakai server/db.json saja.',
      dotenv: DOT_ENV
    };
  }
  return {
    enabled: true,
    url: BASE_URL.replace(/^https:\/\//, ''),
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
    detail: BASE_URL.replace(/^https:\/\//, '') + ' · tabel ' + TABLE + ' · rev ' + lastPushedRevision
  };
}

/** Sapaan di konsol supaya terlihat bahwa modul ini benar-benar dimuat. */
function logStartup() {
  if (!CONFIGURED) {
    log('sinkronisasi SUPABASE MATI — server tetap berjalan normal dengan server/db.json.');
    log('alasan: ' + (DOT_ENV.found
      ? 'server/.env terbaca (key: ' + (DOT_ENV.keys.join(', ') || 'tidak ada') + ') tapi SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong.'
      : 'file server/.env tidak ada di samping server.js.'));
    return false;
  }
  log('file .env: ' + (DOT_ENV.found ? 'terbaca (key: ' + DOT_ENV.keys.join(', ') + ')' : 'tidak ada, pakai environment sistem'));
  log('target: ' + BASE_URL + ' · tabel ' + TABLE + ' · baris key="' + SNAPSHOT_KEY + '"');
  log('kunci: ' + keyHint() + ' · mode auth: ' + AUTH_MODE + ' (header apikey + Authorization: Bearer)');
  log(' debounce push: ' + DEBOUNCE_MS + 'ms · retry: eksponensial, maksimal 60s');
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
  log
};
