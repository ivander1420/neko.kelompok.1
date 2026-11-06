'use strict';
/* Simulasi permintaan Vercel ke api/[...neko].js memakai Supabase asli. */
const { Readable } = require('node:stream');
const handler = require('../api/[...neko].js');

function call(method, url, headers, body) {
  return new Promise((resolve) => {
    const payload = body ? Buffer.from(JSON.stringify(body), 'utf8') : Buffer.alloc(0);
    const req = payload.length ? Readable.from([payload]) : Readable.from([]);
    req.method = method;
    req.url = url;
    req.headers = Object.assign({ 'content-type': 'application/json' }, headers || {});
    req.socket = { remoteAddress: '127.0.0.1' };

    const chunks = [];
    const res = {
      statusCode: 200,
      headers: {},
      setHeader() {},
      writeHead(status, hdrs) { this.statusCode = status; Object.assign(this.headers, hdrs || {}); },
      write(chunk) { if (chunk) chunks.push(Buffer.from(chunk)); return true; },
      end(chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (e) { parsed = text.slice(0, 200); }
        resolve({ status: this.statusCode, body: parsed });
      }
    };
    handler(req, res).catch((e) => resolve({ status: 0, body: 'THROW: ' + e.message }));
  });
}

const results = [];
function note(name, value) {
  results.push(name + ': ' + (typeof value === 'string' ? value : JSON.stringify(value)));
}

(async () => {
  let r;

  r = await call('GET', '/api/health', {}, null);
  note('health', r.status + ' ' + JSON.stringify(r.body).slice(0, 240));

  const uname = 'qa' + Math.random().toString(36).slice(2, 8);
  r = await call('POST', '/api/auth/register', {}, { displayName: 'QA Uji', username: uname, pin: '123456' });
  note('register', r.status + ' token=' + Boolean(r.body && r.body.token));
  const token = (r.body && r.body.token) || '';
  const auth = { authorization: 'Bearer ' + token };

  r = await call('GET', '/api/auth/session', auth, null);
  note('session', r.status + ' user=' + (r.body && r.body.user && r.body.user.username));

  r = await call('PUT', '/api/profile', auth, { profile: { xp: 777, bio: 'halo dari vercel' } });
  note('saveProfile', r.status + ' xp=' + (r.body && r.body.profile && r.body.profile.xp));

  r = await call('POST', '/api/auth/login', {}, { username: uname, pin: '123456' });
  note('loginAgain', r.status + ' xp=' + (r.body && r.body.profile && r.body.profile.xp));
  const token2 = (r.body && r.body.token) || '';
  const auth2 = { authorization: 'Bearer ' + token2 };

  r = await call('GET', '/api/community', {}, null);
  note('community', r.status + ' players=' + (r.body && r.body.players ? r.body.players.length : '?'));

  r = await call('GET', '/api/notifications/poll?since=0', auth2, null);
  note('poll', r.status + ' events=' + (r.body && r.body.events ? r.body.events.length : '?'));

  r = await call('POST', '/api/live/create', auth2, { level: 'Semua', topic: 'Semua', count: 4 });
  note('liveCreate', r.status + ' pin=' + (r.body && r.body.pin));

  if (r.body && r.body.pin) {
    const pin = r.body.pin;
    r = await call('GET', '/api/live/state?pin=' + pin, {}, null);
    note('liveState', r.status + ' phase=' + (r.body && r.body.phase && r.body.phase.phase));
    r = await call('POST', '/api/live/join', {}, { pin, name: 'Siswa QA', character: 'neko1' });
    note('liveJoin', r.status + ' ok=' + Boolean(r.body && r.body.joinedKey));
    r = await call('POST', '/api/live/host', auth2, { pin, action: 'start' });
    note('liveStart', r.status);
  }

  console.log(results.join('\n'));
})();
