'use strict';
const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '..', 'server', '.env');
const env = {};
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const BASE = String(env.SUPABASE_URL).replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, 'Content-Type': 'application/json', Accept: 'application/json' };

async function rest(method, table, query, body, prefer) {
  const url = BASE + '/rest/v1/' + table + (query ? '?' + query : '');
  const headers = Object.assign({}, H);
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
  return { status: res.status, parsed, text: text.slice(0, 400) };
}

(async () => {
  // 1) Baca semua baris snapshot (ringkas)
  const all = await rest('GET', 'neko_snapshot', 'select=key,revision,updated_at');
  console.log('GET neko_snapshot ->', all.status, JSON.stringify(all.parsed));

  // 2) Baca isi main
  const main = await rest('GET', 'neko_snapshot', 'select=key,value&key=eq.main');
  if (main.status === 200 && Array.isArray(main.parsed) && main.parsed[0]) {
    const v = main.parsed[0].value || {};
    console.log('main keys =', Object.keys(v).join(', '));
    console.log('  users     =', Object.keys(v.users || {}).length);
    console.log('  sessions  =', Object.keys(v.sessions || {}).length);
    console.log('  friends   =', Object.keys(v.friends || {}).length);
    console.log('  chats     =', Object.keys(v.chats || {}).length);
    console.log('  announce  =', ((v.community || {}).announcements || []).length);
    console.log('  posts     =', (v.posts || []).length);
    console.log('  bytes     =', JSON.stringify(v).length);
    const names = Object.keys(v.users || {});
    console.log('  usernames =', names.slice(0, 30).join(' | '));
  } else {
    console.log('main read ->', main.status, main.text);
  }

  // 3) Uji tulis baris baru (key berbeda) + hapus
  const probe = await rest('POST', 'neko_snapshot', 'on_conflict=key', [
    { key: '__probe', value: { hello: 'world' }, revision: 1, updated_at: new Date().toISOString() }
  ], 'return=representation,resolution=merge-duplicates');
  console.log('POST __probe ->', probe.status, probe.text);

  const del = await rest('DELETE', 'neko_snapshot', 'key=eq.__probe');
  console.log('DELETE __probe ->', del.status, del.text);
})();
