/* ============================================================
   NEKO · server/cloud-store.js
   Penyimpan snapshot NEKO di Supabase (tabel `neko_snapshot`).

   Dipakai oleh `api/neko.js` (Vercel serverless). Berbeda dengan
   `supabase-sync.js` yang menimpa satu baris tanpa syarat, modul ini
   memakai *compare-and-swap*: tulis hanya berhasil kalau `revision`
   di database masih sama dengan yang kita baca. Kalau ada penulis
   lain di antara baca dan tulis, penulisan ditolak (konflik) dan
   pemanggil mengulang — jadi tidak ada update yang hilang.

   Tidak butuh dependency npm: cukup `fetch` bawaan Node 18+.
   ============================================================ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

/* ---------------- Konfigurasi ---------------- */

function readDotEnv() {
  const file = path.join(__dirname, '.env');
  const out = {};
  try {
    if (!fs.existsSync(file)) return out;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const text = line.trim();
      if (!text || text.startsWith('#')) continue;
      const eq = text.indexOf('=');
      if (eq < 1) continue;
      const name = text.slice(0, eq).trim();
      let value = text.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (value) out[name] = value;
    }
  } catch (error) { /* abaikan */ }
  return out;
}

const dotenv = readDotEnv();

function pick(name, fallback) {
  const fromEnv = process.env[name];
  if (fromEnv !== undefined && String(fromEnv).trim() !== '') return String(fromEnv).trim();
  if (dotenv[name]) return dotenv[name];
  return fallback === undefined ? '' : fallback;
}

function normalizeBase(raw) {
  let url = String(raw || '').trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
  if (!url) return '';
  url = url.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

const BASE_URL = normalizeBase(pick('SUPABASE_URL', ''));
const SECRET = pick('SUPABASE_SERVICE_ROLE_KEY', pick('SUPABASE_KEY', ''));
const TABLE = pick('NEKO_SNAPSHOT_TABLE', 'neko_snapshot');
const SNAPSHOT_KEY = pick('NEKO_SNAPSHOT_KEY', 'main');
const CONFIGURED = Boolean(BASE_URL && SECRET);
const TIMEOUT_MS = Math.max(3000, Number(pick('NEKO_CLOUD_TIMEOUT_MS', '12000')) || 12000);

/* Di serverless, `supabase-sync.js` (mode tulis-tanpa-syarat) harus mati
   supaya tidak menimpa snapshot yang ditulis modul ini. Kredensial sudah
   disalin ke konstanta di atas, jadi aman menghapusnya dari process.env
   sebelum `server/server.js` dimuat. */
if (process.env.NEKO_SERVERLESS === '1') {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_KEY;
}

/* ---------------- Klien PostgREST ---------------- */

function headers() {
  const list = { apikey: SECRET, 'Content-Type': 'application/json', Accept: 'application/json' };
  if (SECRET.startsWith('eyJ')) list.Authorization = 'Bearer ' + SECRET;
  return list;
}

async function call(method, query, body, prefer) {
  if (!CONFIGURED) throw new Error('Supabase belum dikonfigurasi (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong).');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const url = BASE_URL + '/rest/v1/' + TABLE + (query ? '?' + query : '');
  try {
    const res = await fetch(url, {
      method,
      headers: Object.assign(headers(), prefer ? { Prefer: prefer } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store'
    });
    const raw = await res.text();
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (error) { parsed = null; }
    return { status: res.status, body: parsed, raw };
  } finally {
    clearTimeout(timer);
  }
}

function describe(result) {
  const detail = String(result.raw || '').replace(/\s+/g, ' ').slice(0, 220);
  if (result.status === 404) return 'Tabel "' + TABLE + '" belum ada — jalankan server/supabase/schema.sql di SQL Editor.';
  if (result.status === 401 || result.status === 403) return 'Kunci Supabase ditolak (' + result.status + '). Periksa SUPABASE_SERVICE_ROLE_KEY. ' + detail;
  return 'Supabase HTTP ' + result.status + ': ' + detail;
}

/* ---------------- API publik ---------------- */

/**
 * Baca snapshot terkini.
 * @returns {Promise<{value: object, revision: number, updatedAt: string}>}
 */
async function readSnapshot() {
  const query = 'select=value,revision,updated_at&key=eq.' + encodeURIComponent(SNAPSHOT_KEY);
  const result = await call('GET', query);
  if (result.status >= 300) throw new Error(describe(result));

  const rows = Array.isArray(result.body) ? result.body : [];
  if (!rows.length) return { value: {}, revision: 0, updatedAt: '' };

  let value = rows[0].value;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch (error) { value = {}; }
  }
  return {
    value: value && typeof value === 'object' ? value : {},
    revision: Number(rows[0].revision || 0) || 0,
    updatedAt: rows[0].updated_at || ''
  };
}

/**
 * Tulis snapshot hanya kalau revisinya masih `expectedRevision`.
 * @returns {Promise<{ok: boolean, conflict: boolean, revision: number, error?: string}>}
 */
async function writeSnapshot(value, expectedRevision) {
  const nextRevision = Number(expectedRevision || 0) + 1;
  const row = { value, revision: nextRevision, updated_at: new Date().toISOString() };

  if (expectedRevision > 0) {
    const query = 'key=eq.' + encodeURIComponent(SNAPSHOT_KEY) + '&revision=eq.' + expectedRevision;
    const result = await call('PATCH', query, row, 'return=representation');
    if (result.status >= 300) {
      return { ok: false, conflict: false, revision: expectedRevision, error: describe(result) };
    }
    const rows = Array.isArray(result.body) ? result.body : [];
    if (!rows.length) return { ok: false, conflict: true, revision: expectedRevision };
    return { ok: true, conflict: false, revision: nextRevision };
  }

  /* Belum ada baris (revision 0): buat baru, jangan menimpa apa pun. */
  const insert = await call('POST', 'on_conflict=key', [
    { key: SNAPSHOT_KEY, value, revision: nextRevision, updated_at: row.updated_at }
  ], 'return=representation,resolution=merge-duplicates');

  if (insert.status >= 300) {
    return { ok: false, conflict: false, revision: 0, error: describe(insert) };
  }
  const rows = Array.isArray(insert.body) ? insert.body : [];
  if (rows.length && Number(rows[0].revision || 0) !== nextRevision) {
    return { ok: false, conflict: true, revision: expectedRevision };
  }
  return { ok: true, conflict: false, revision: nextRevision };
}

function status() {
  return {
    configured: CONFIGURED,
    table: TABLE + ' (key=' + SNAPSHOT_KEY + ')',
    url: BASE_URL.replace(/^https?:\/\//, ''),
    mode: 'compare-and-swap'
  };
}

module.exports = { CONFIGURED, TABLE, SNAPSHOT_KEY, BASE_URL, readSnapshot, writeSnapshot, status };
