/* ============================================================
   NEKO · server/supabase-sync.js
   Menyimpan state server NEKO ke database Supabase (Postgres)
   lewat REST/PostgREST — tanpa dependensi npm, cukup Node.

   Cara kerja:
     * Seluruh isi db (sama seperti server/db.json) disimpan sebagai
       SATU baris JSONB di tabel `neko_snapshot` dengan key='main'.
     * Saat server menyala, snapshot diambil dulu (pull).
     * Setiap kali server menyimpan data, snapshot dikirim (push)
       dengan debounce + antrian, jadi tidak ada request berlebih.
     * Kalau SUPABASE_URL / kunci tidak diisi, modul ini diam total
       dan server tetap memakai server/db.json seperti biasa.

   Kunci yang dipakai HARUS service_role (hanya boleh ada di server,
   jangan pernah masuk ke APK atau JavaScript browser).
   ============================================================ */
'use strict';

const https = require('node:https');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TABLE = process.env.NEKO_SNAPSHOT_TABLE || 'neko_snapshot';
const SNAPSHOT_KEY = process.env.NEKO_SNAPSHOT_KEY || 'main';

/* ---------------- Baca .env di samping server.js ---------------- */

function loadDotEnv() {
  const file = path.join(__dirname, '.env');
  try {
    if (!fs.existsSync(file)) return;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const text = line.trim();
      if (!text || text.startsWith('#')) continue;
      const eq = text.indexOf('=');
      if (eq < 1) continue;
      const name = text.slice(0, eq).trim();
      let value = text.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (value && process.env[name] === undefined) process.env[name] = value;
    }
  } catch (error) { /* .env tidak wajib */ }
}

loadDotEnv();

const BASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SECRET = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '');
const IS_HTTPS = BASE_URL.startsWith('https://');
const CONFIGURED = Boolean(BASE_URL && SECRET);

/* ---------------- HTTP kecil ---------------- */

function call(method, query, headers, body) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(BASE_URL + '/rest/v1/' + TABLE + (query ? '?' + query : ''));
    } catch (error) {
      reject(new Error('SUPABASE_URL tidak valid: ' + error.message));
      return;
    }
    const lib = IS_HTTPS ? https : http;
    const req = lib.request(url, {
      method,
      headers: {
        apikey: SECRET,
       ...(SECRET.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + SECRET }),
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 12000
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (error) { parsed = null; }
        resolve({ status: res.statusCode, body: parsed, raw });
      });
    });
    req.on('timeout', () => req.destroy(new Error('waktu habis saat menghubungi Supabase')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/* ---------------- Antrian push ---------------- */

let lastPushedRevision = 0;
let pending = null;          // db object terbaru yang belum terkirim
let inFlight = false;
let timer = null;
let failures = 0;
let lastError = '';
let lastPushAt = 0;
const DEBOUNCE_MS = Number(process.env.NEKO_SYNC_DEBOUNCE_MS || 1500);

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
  try {
    const result = await call('POST', '', { Prefer: 'return=minimal,resolution=merge-duplicates' }, body);
    if (result.status >= 200 && result.status < 300) {
      lastPushedRevision = revision;
      failures = 0;
      lastError = '';
      lastPushAt = Date.now();
    } else {
      throw new Error('HTTP ' + result.status + ' ' + String(result.raw || '').slice(0, 180));
    }
  } catch (error) {
    failures += 1;
    lastError = error.message;
    pending = payload;                       // jangan buang data: coba lagi
    console.error('[neko] sinkron Supabase gagal (' + failures + 'x):', error.message);
    if (failures === 3) console.error('[neko] data tetap aman di server/db.json, sinkron akan dicoba terus.');
  } finally {
    inFlight = false;
  }
}

function scheduleDrain(delay = 0) {
  clearTimeout(timer);
  timer = setTimeout(() => { drain().catch(() => {}); }, delay);
}

/* ---------------- API modul ---------------- */

/** Ambil snapshot dari Supabase. Mengembalikan { value, revision, updatedAt } atau null. */
async function pull() {
  if (!CONFIGURED) return null;
  const result = await call('GET', 'select=value,revision,updated_at&key=eq.' + encodeURIComponent(SNAPSHOT_KEY), { Accept: 'application/json' });
  if (result.status >= 300) throw new Error('HTTP ' + result.status + ' ' + String(result.raw || '').slice(0, 180));
  const rows = Array.isArray(result.body) ? result.body : [];
  if (!rows.length) return null;
  const row = rows[0];
  let value = row.value;
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch (error) { value = null; } }
  if (!value || typeof value !== 'object') return null;
  lastPushedRevision = Number(row.revision || 0);
  return { value, revision: lastPushedRevision, updatedAt: row.updated_at || '' };
}

/** Simpan snapshot db ke Supabase (debounce). */
function push(state) {
  if (!CONFIGURED) return false;
  pending = state;
  scheduleDrain(DEBOUNCE_MS);
  return true;
}

/** Tunggu kiriman terakhir selesai — dipakai saat server dimatikan. */
async function flush(timeoutMs = 4000) {
  if (!CONFIGURED) return false;
  const until = Date.now() + timeoutMs;
  while ((pending || inFlight) && Date.now() < until) {
    await drain();
    const wait = Math.max(50, Math.min(400, until - Date.now()));
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  return !pending;
}

function status() {
  if (!CONFIGURED) {
    return { enabled: false, detail: 'SUPABASE_URL / kunci kosong — pakai server/db.json saja.' };
  }
  return {
    enabled: true,
    table: TABLE + ' (key=' + SNAPSHOT_KEY + ')',
    revision: lastPushedRevision,
    failures,
    lastError,
    lastPushAt,
    detail: BASE_URL.replace(/^https:\/\//, '')
  };
}

module.exports = { CONFIGURED, pull, push, flush, status };
