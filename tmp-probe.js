'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Baca server/.env
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
console.log('BASE =', BASE);
console.log('KEY  =', KEY.slice(0, 12) + '... (' + KEY.length + ' chars)');

async function probe(table, query) {
  const url = BASE + '/rest/v1/' + table + (query ? '?' + query : '');
  const res = await fetch(url, { headers: { apikey: KEY, Accept: 'application/json' } });
  const text = await res.text();
  return { table, status: res.status, body: text.slice(0, 300) };
}

(async () => {
  const tables = ['neko_users', 'neko_sessions', 'neko_profiles', 'neko_snapshot',
    'neko_announcements', 'neko_info_board', 'neko_friendships', 'neko_conversations',
    'neko_messages', 'neko_reads', 'neko_live_rooms', 'neko_live_players',
    'neko_live_answers', 'neko_events', 'neko_posts'];
  for (const t of tables) {
    try {
      const r = await probe(t, 'select=*&limit=1');
      let extra = '';
      try {
        const rows = JSON.parse(r.body);
        extra = Array.isArray(rows) ? ' rows=' + rows.length : '';
      } catch (e) { extra = ''; }
      console.log(String(r.status).padEnd(4), t.padEnd(22), extra, r.status >= 400 ? r.body : '');
    } catch (e) {
      console.log('ERR ', t.padEnd(22), e.message);
    }
  }
})();
