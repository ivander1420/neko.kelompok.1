/* ============================================================
   NEKO · server/server.js
   Server resmi NEKO: akun sungguhan (PIN di-hash dengan scrypt),
   sinkronisasi profil antar-perangkat, komunitas (pengumuman +
   leaderboard), teman, pesan, dan Kelas Langsung bergaya Kahoot
   dengan PIN via WebSocket. Tanpa dependensi eksternal.

   Jalankan:  node server/server.js   (atau klik Mulai-NEKO.bat)
   Buka:      http://localhost:3000   (atau http://IP-lan:3000)
   ============================================================ */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const DB_FILE = path.join(ROOT, 'server', 'db.json');
const PORT = Number(process.env.NEKO_PORT || 3000);
const SCRYPT_N = 1 << 14;

/* ---------------- Database JSON sederhana ---------------- */

const emptyDB = () => ({
  users: {},
  sessions: {},
  community: { announcements: [], info: { title: 'Papan informasi NEKO', body: 'Belum ada informasi baru dari admin. Tetap semangat belajar TJKT!', updatedBy: '', updatedAt: 0 } },
  friends: {},
  chats: {},
  seen: {}
});

let db = emptyDB();

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = { ...emptyDB(), ...parsed };
      db.users = parsed.users || {};
      db.sessions = parsed.sessions || {};
      db.friends = parsed.friends || {};
      db.chats = parsed.chats || {};
      db.seen = parsed.seen || {};
    }
  } catch (error) {
    console.error('[neko] db.json rusak, memakai basis baru:', error.message);
    db = emptyDB();
  }
}

let saveTimer = null;
let saving = false;
function saveDB() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushDB, 500);
}

async function flushDB() {
  if (saving) return;
  saving = true;
  const tmp = DB_FILE + '.tmp';
  try {
    await fsp.writeFile(tmp, JSON.stringify(db), 'utf8');
    await fsp.rename(tmp, DB_FILE);
  } catch (error) {
    console.error('[neko] gagal menyimpan db:', error.message);
  } finally {
    saving = false;
  }
}

process.on('exit', () => {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch (error) { /* abaikan */ }
});

/* ---------------- Akun preset (roles + PIN awal) ---------------- */

const PRESET_ACCOUNTS = [
  { username: 'ivander', displayName: 'Ivander', pin: '141210', role: 'Developer' },
  { username: 'Muh.haditrafanizam', displayName: 'Rafanizam', pin: '220810', role: 'President' },
  { username: 'AkhsanJauharSantoso', displayName: 'Akhsan', pin: '140411', role: 'Admin' },
  { username: 'Pakandy', displayName: 'Pak Andy', pin: '123321', role: 'Guru' },
  { username: 'Pakharry', displayName: 'Pak Harry', pin: '456654', role: 'Guru' },
  { username: 'Buksri', displayName: 'Bu Sri', pin: '789987', role: 'Guru' },
  { username: 'Firmansyah', displayName: 'Pak Firman', pin: '100110', role: 'Wali Kelas' },
  { username: 'Nurlinda', displayName: 'Bu Linda', pin: '120200', role: 'Guru' },
  { username: 'Norma.S.Kom', displayName: 'Bu Norma', pin: '344334', role: 'Guru' },
  { username: 'Wahyu.', displayName: 'Pak Wahyu', pin: '456756', role: 'Guru' },
  { username: 'demo', displayName: 'Siswa Demo', pin: '111111', role: 'Member' }
];

function emptyProfile(user) {
  return {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    joinedAt: Date.now(),
    xp: 0,
    badges: [],
    notifications: [],
    books: {},
    checkin: { streak: 0, best: 0, last: null, claimed: [] },
    stats: { gamesPlayed: 0, games: {}, booksFinished: 0, pagesRead: 0, quizBest: 0, correct: 0, answered: 0, spyWins: 0, minutes: 0, xpToday: 0, xpDate: null, liveWins: 0, livePlayed: 0 },
    favorites: [],
    settings: { profilePublic: true, reminders: true }
  };
}

const SEASONS = [
  { id: 1, min: 0, short: 'Pemula', title: 'Teknisi Baru' },
  { id: 2, min: 600, short: 'Penjelajah', title: 'Teknisi Junior' },
  { id: 3, min: 1600, short: 'Arsitek', title: 'Teknisi Madya' },
  { id: 4, min: 3000, short: 'Penjaga', title: 'Spesialis Jaringan' },
  { id: 5, min: 5000, short: 'Legenda', title: 'Network Legend' }
];

function seasonForXP(xp) {
  const value = Math.max(0, Number(xp) || 0);
  let season = SEASONS[0];
  for (const item of SEASONS) if (value >= item.min) season = item;
  return season;
}

/* ---------------- Bank soal untuk Kelas Langsung ---------------- */

let quizBank = [];
function loadQuizBank() {
  try {
    const code = fs.readFileSync(path.join(ROOT, 'data', 'quiz.js'), 'utf8');
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { timeout: 5000 });
    quizBank = (sandbox.window.NEK_QUIZ && sandbox.window.NEK_QUIZ.questions) || [];
  } catch (error) {
    console.error('[neko] gagal memuat bank soal:', error.message);
    quizBank = [];
  }
}

/* ---------------- Kriptografi akun ---------------- */

function hashPin(pin, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(String(pin), salt, 32, { N: SCRYPT_N, r: 8, p: 1 }).toString('hex');
}

function newSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function validUsername(value) {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,23}$/.test(String(value || ''));
}

function validPin(value) {
  return /^[0-9]{6,12}$/.test(String(value || ''));
}

function createSession(username) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = { username: normalizeUsername(username), createdAt: Date.now() };
  saveDB();
  return token;
}

function userFromToken(token) {
  if (!token) return null;
  const session = db.sessions[token];
  if (!session) return null;
  return db.users[session.username] || null;
}

function publicUser(user) {
  if (!user) return null;
  const season = seasonForXP(user.profile?.xp || 0);
  return {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    xp: Math.round(user.profile?.xp || 0),
    season: season.id,
    title: season.title
  };
}

function seedPresets() {
  let added = 0;
  for (const preset of PRESET_ACCOUNTS) {
    const key = normalizeUsername(preset.username);
    if (!db.users[key]) {
      const salt = newSalt();
      const user = {
        username: preset.username,
        displayName: preset.displayName,
        role: preset.role,
        salt,
        hash: hashPin(preset.pin, salt),
        createdAt: Date.now()
      };
      user.profile = emptyProfile(user);
      user.prefs = null;
      db.users[key] = user;
      added += 1;
    }
  }
  if (added) saveDB();
  return added;
}

/* ---------------- Util HTTP ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  });
  res.end(body);
}

function readBody(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) { reject(new Error('body terlalu besar')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) { resolve({}); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (error) { reject(new Error('body bukan JSON')); }
    });
    req.on('error', reject);
  });
}

function bearer(req) {
  const header = String(req.headers.authorization || '');
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return '';
}

function clientIP(req) {
  return req.socket.remoteAddress || 'unknown';
}

/* ---------------- Rate limit login ---------------- */

const attempts = new Map();
function tooMany(key) {
  const now = Date.now();
  const entry = attempts.get(key) || { count: 0, until: 0 };
  if (now > entry.until) { entry.count = 0; entry.until = now + 5 * 60 * 1000; }
  entry.count += 1;
  attempts.set(key, entry);
  return entry.count > 25;
}
function clearAttempts(key) { attempts.delete(key); }

/* ---------------- Teman & pesan ---------------- */

function friendRecord(username) {
  const key = normalizeUsername(username);
  if (!db.friends[key]) db.friends[key] = { friends: [], incoming: [], outgoing: [] };
  return db.friends[key];
}

function areFriends(a, b) {
  return friendRecord(a).friends.includes(normalizeUsername(b));
}

function pushChat(a, b, message) {
  const key = [normalizeUsername(a), normalizeUsername(b)].sort().join('|');
  if (!db.chats[key]) db.chats[key] = [];
  db.chats[key].push(message);
  if (db.chats[key].length > 400) db.chats[key] = db.chats[key].slice(-400);
  return key;
}

function chatBetween(a, b) {
  const key = [normalizeUsername(a), normalizeUsername(b)].sort().join('|');
  return db.chats[key] || [];
}

/* Event realtime untuk pengguna (pesan/teman) lewat WS atau polling */
let eventSeq = 0;
const eventLog = new Map(); // username(lower) -> array {seq, type, data}
function pushEvent(username, type, data) {
  const key = normalizeUsername(username);
  if (!eventLog.has(key)) eventLog.set(key, []);
  const list = eventLog.get(key);
  const item = { seq: ++eventSeq, type, data, at: Date.now() };
  list.push(item);
  if (list.length > 60) list.shift();
  wsHub.pushEvent(key, item);
  liveEvents.notify('user:' + key, item);
  return item;
}

/* ---------------- WebSocket mini (RFC 6455) ---------------- */

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const OPCODE_TEXT = 0x1;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xA;

class MiniSocket {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.alive = true;
    this.handlers = { message: null, close: null };
    socket.on('data', chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.drain();
    });
    socket.on('error', () => this.kill());
    socket.on('close', () => this.kill());
  }

  drain() {
    while (this.alive && this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const opcode = first & 0x0F;
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7F;
      let offset = 2;
      if (length === 126) {
        if (this.buffer.length < offset + 2) return;
        length = this.buffer.readUInt16BE(offset); offset += 2;
      } else if (length === 127) {
        if (this.buffer.length < offset + 8) return;
        length = Number(this.buffer.readBigUInt64BE(offset)); offset += 8;
      }
      let maskKey = null;
      if (masked) {
        if (this.buffer.length < offset + 4) return;
        maskKey = this.buffer.subarray(offset, offset + 4); offset += 4;
      }
      if (this.buffer.length < offset + length) return;
      const payload = Buffer.from(this.buffer.subarray(offset, offset + length));
      if (maskKey) for (let i = 0; i < payload.length; i += 1) payload[i] ^= maskKey[i % 4];
      this.buffer = this.buffer.subarray(offset + length);
      if (opcode === OPCODE_TEXT) {
        try { this.handlers.message && this.handlers.message(JSON.parse(payload.toString('utf8'))); }
        catch (error) { /* abaikan frame rusak */ }
      } else if (opcode === OPCODE_PING) {
        this.rawFrame(OPCODE_PONG, payload);
      } else if (opcode === OPCODE_CLOSE) {
        this.kill();
        return;
      }
    }
  }

  rawFrame(opcode, payload) {
    if (!this.alive) return;
    let header;
    const length = payload.length;
    if (length < 126) {
      header = Buffer.from([0x80 | opcode, length]);
    } else if (length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(length), 2);
    }
    try { this.socket.write(Buffer.concat([header, payload])); } catch (error) { this.kill(); }
  }

  send(obj) {
    this.rawFrame(OPCODE_TEXT, Buffer.from(JSON.stringify(obj), 'utf8'));
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.handlers.close && this.handlers.close();
    try { this.socket.destroy(); } catch (error) { /* abaikan */ }
  }

  close() {
    this.rawFrame(OPCODE_CLOSE, Buffer.alloc(0));
    this.kill();
  }
}

const wsHub = {
  rooms: new Map(), // pin -> Set<MiniSocket>
  users: new Map(), // username-lower -> Set<MiniSocket>
  attachRoom(pin, mini) {
    if (!this.rooms.has(pin)) this.rooms.set(pin, new Set());
    this.rooms.get(pin).add(mini);
    mini.handlers.close = () => {
      const set = this.rooms.get(pin);
      if (set) { set.delete(mini); if (!set.size) this.rooms.delete(pin); }
    };
  },
  attachUser(username, mini) {
    const key = normalizeUsername(username);
    if (!this.users.has(key)) this.users.set(key, new Set());
    this.users.get(key).add(mini);
    mini.handlers.close = () => {
      const set = this.users.get(key);
      if (set) { set.delete(mini); if (!set.size) this.users.delete(key); }
    };
  },
  sendRoom(pin, obj) {
    const set = this.rooms.get(pin);
    if (!set) return;
    for (const mini of set) mini.send(obj);
  },
  sendUser(username, obj) {
    const set = this.users.get(normalizeUsername(username));
    if (!set) return;
    for (const mini of set) mini.send(obj);
  },
  pushEvent(username, item) {
    this.sendUser(username, { type: 'neko-event', data: item });
  }
};

/* Long-poll events untuk klien tanpa WebSocket */
const liveEvents = {
  waiters: new Map(), // channel -> Set<{res, timer}>
  watch(channel, req, res, sendPayload) {
    const set = this.waiters.get(channel) || new Set();
    this.waiters.set(channel, set);
    const entry = { res, sendPayload };
    const timer = setTimeout(() => {
      set.delete(entry);
      if (!res.writableEnded) sendPayload({ events: [], timeout: true });
    }, 25000);
    entry.timer = timer;
    set.add(entry);
    req.on('aborted', () => {
      clearTimeout(timer);
      set.delete(entry);
    });
  },
  notify(channel, item) {
    const set = this.waiters.get(channel);
    if (!set || !set.size) return;
    const batch = Array.from(set);
    set.clear();
    for (const entry of batch) {
      clearTimeout(entry.timer);
      if (!entry.res.writableEnded) entry.sendPayload({ events: [item] });
    }
  }
};

/* ---------------- Kelas Langsung (Kahoot-style) ---------------- */

const liveRooms = new Map(); // pin -> room

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDeck(options = {}) {
  const levelFilter = options.level && options.level !== 'Semua' ? options.level : null;
  const topicFilter = options.topic && options.topic !== 'Semua' ? options.topic : null;
  let pool = quizBank.filter(item => item && Array.isArray(item.o) && item.o.length >= 4);
  if (levelFilter) pool = pool.filter(item => item.level === levelFilter);
  if (topicFilter) pool = pool.filter(item => item.topic === topicFilter);
  if (pool.length < 4) pool = quizBank.filter(item => item && Array.isArray(item.o) && item.o.length >= 4);
  const count = Math.min(15, Math.max(4, Number(options.count) || 8));
  return shuffle(pool).slice(0, count).map(item => {
    const correctAnswer = item.o[item.a];
    const order = shuffle(item.o.slice(0, 4));
    return {
      q: item.q,
      o: order,
      a: order.indexOf(correctAnswer),
      e: item.e || '',
      level: item.level,
      topic: item.topic
    };
  });
}

function genPIN() {
  for (;;) {
    const pin = String(crypto.randomInt(100000, 999999));
    if (!liveRooms.has(pin)) return pin;
  }
}

function makeRoom(hostUser, options) {
  const pin = genPIN();
  const room = {
    pin,
    host: { username: hostUser.username, displayName: hostUser.displayName },
    createdAt: Date.now(),
    lastActivity: Date.now(),
    phase: 'lobby', // lobby | question | reveal | finished
    deck: buildDeck(options),
    index: -1,
    openedAt: 0,
    seconds: 20,
    players: new Map(), // key: username-lower
    leaderboard: [],
    answersSent: false
  };
  liveRooms.set(pin, room);
  return room;
}

function cleanCharacter(value) {
  const ch = String(value || '').trim().toLowerCase();
  return /^[a-z0-9_-]{1,20}$/.test(ch) ? ch : '';
}

function characterHeld(room, key, character) {
  if (!character) return false;
  for (const [playerKey, player] of room.players) {
    if (playerKey !== key && player.character === character) return player.displayName;
  }
  return '';
}

function roomPlayerView(player, hiddenAnswer) {
  return {
    name: player.displayName,
    character: player.character || '',
    score: player.score,
    streak: player.streak,
    lastPoints: player.lastPoints,
    correctCount: player.correctCount,
    answered: player.answered,
    anonymous: Boolean(player.anonymous)
  };
}

function roomState(room, role) {
  const showAnswer = room.phase !== 'question' || role === 'host';
  const question = room.index >= 0 && room.index < room.deck.length ? room.deck[room.index] : null;
  const players = Array.from(room.players.values())
    .map(player => roomPlayerView(player, room.phase === 'question'))
    .sort((a, b) => b.score - a.score);
  const state = {
    pin: room.pin,
    phase: room.phase,
    host: room.host,
    players,
    total: room.deck.length,
    index: room.index,
    seconds: room.seconds,
    openedAt: room.openedAt,
    serverNow: Date.now(),
    lastQuestionPoints: room.lastQuestionPoints || null
  };
  if (question && room.phase !== 'lobby') {
    state.question = {
      q: question.q,
      o: question.o,
      level: question.level,
      topic: question.topic,
      a: showAnswer ? question.a : null,
      e: showAnswer ? question.e : ''
    };
    if (showAnswer) {
      const tally = question.o.map(() => 0);
      let answeredCount = 0;
      room.players.forEach(player => {
        if (player.answeredQuestion === room.index && player.answerChoice >= 0) {
          tally[player.answerChoice] += 1;
          answeredCount += 1;
        }
      });
      state.question.tally = tally;
      state.answeredCount = answeredCount;
    }
  }
  if (room.phase === 'finished') state.leaderboard = room.leaderboard;
  return state;
}

function liveBroadcast(room) {
  room.rev = (room.rev || 0) + 1;
  const payload = { rev: room.rev, state: roomState(room, 'player'), host: roomState(room, 'host') };
  wsHub.sendRoom(room.pin, { type: 'live-state', ...payload });
  liveEvents.notify('live:' + room.pin, { rev: room.rev, state: payload.state, host: payload.host });
}

function awardAnswer(room, player, choice, timeMs) {
  if (room.phase !== 'question') return false;
  if (player.answeredQuestion === room.index) return false;
  const question = room.deck[room.index];
  if (!question) return false;
  const elapsed = Math.max(0, Math.min(room.seconds * 1000, Date.now() - room.openedAt));
  player.answeredQuestion = room.index;
  player.answerChoice = choice;
  player.answered = true;
  const correct = choice === question.a;
  let points = 0;
  if (correct) {
    const speed = 1 - elapsed / (room.seconds * 1000);
    points = Math.round(500 + 500 * speed) + Math.min(5, player.streak) * 25;
    player.streak += 1;
    player.correctCount += 1;
  } else {
    player.streak = 0;
  }
  player.score += points;
  player.lastPoints = points;
  return true;
}

function closeQuestionAnswers(room) {
  room.lastQuestionPoints = [];
  room.players.forEach(player => {
    if (player.answeredQuestion === room.index) {
      room.lastQuestionPoints.push({ name: player.displayName, points: player.lastPoints || 0, correct: Boolean(player.answeredQuestion === room.index && player.answerChoice === room.deck[room.index].a) });
    }
    player.answered = false;
  });
  room.lastQuestionPoints.sort((a, b) => b.points - a.points);
}

function finishRoom(room) {
  closeQuestionAnswers(room);
  room.phase = 'finished';
  room.leaderboard = Array.from(room.players.values())
    .map(player => ({ name: player.displayName, character: player.character || '', score: player.score, correctCount: player.correctCount, username: player.username || '' }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  /* XP Kelas Langsung masuk ke profil asli (tersimpan lintas perangkat) */
  const medalXP = [150, 100, 75];
  room.leaderboard.forEach((entry, index) => {
    if (!entry.username) return;
    const user = db.users[normalizeUsername(entry.username)];
    if (!user) return;
    user.profile = user.profile || emptyProfile(user);
    user.profile.stats = user.profile.stats || emptyProfile(user).stats;
    user.profile.xp = (user.profile.xp || 0) + medalXP[index];
    user.profile.stats.livePlayed = (user.profile.stats.livePlayed || 0) + 1;
    if (index === 0) user.profile.stats.liveWins = (user.profile.stats.liveWins || 0) + 1;
    pushEvent(entry.username, 'live-xp', { pin: room.pin, xp: medalXP[index], rank: index + 1 });
  });
  room.players.forEach(player => {
    if (!player.username) return;
    if (room.leaderboard.slice(0, 3).some(entry => normalizeUsername(entry.username) === normalizeUsername(player.username))) return;
    const user = db.users[normalizeUsername(player.username)];
    if (!user) return;
    user.profile = user.profile || emptyProfile(user);
    user.profile.stats = user.profile.stats || emptyProfile(user).stats;
    user.profile.stats.livePlayed = (user.profile.stats.livePlayed || 0) + 1;
    user.profile.xp = (user.profile.xp || 0) + 30;
  });
  saveDB();
}

setInterval(() => {
  const now = Date.now();
  for (const [pin, room] of liveRooms) {
    if (now - room.lastActivity > 30 * 60 * 1000) {
      const set = wsHub.rooms.get(pin);
      if (set) for (const mini of set) mini.send({ type: 'live-closed' });
      liveRooms.delete(pin);
    }
  }
}, 60 * 1000);

/* ---------------- REST API router ---------------- */

const routes = {

  'POST /api/auth/register': async (req, res) => {
    const body = await readBody(req);
    const username = String(body.username || '').trim();
    const displayName = String(body.displayName || '').trim();
    if (!validUsername(username)) return sendJSON(res, 400, { error: 'Username 3–24 karakter: huruf, angka, titik, garis bawah, atau strip.' });
    if (displayName.length < 2) return sendJSON(res, 400, { error: 'Nama tampilan minimal 2 huruf.' });
    if (!validPin(body.pin)) return sendJSON(res, 400, { error: 'PIN harus 6–12 angka.' });
    const key = normalizeUsername(username);
    if (db.users[key]) return sendJSON(res, 409, { error: 'Username itu sudah dipakai. Pilih yang lain.' });
    const salt = newSalt();
    const user = { username, displayName, role: 'Member', salt, hash: hashPin(body.pin, salt), createdAt: Date.now() };
    user.profile = emptyProfile(user);
    user.prefs = null;
    db.users[key] = user;
    const token = createSession(username);
    saveDB();
    sendJSON(res, 200, { token, user: publicUser(user), profile: user.profile, prefs: null, server: true });
  },

  'POST /api/auth/login': async (req, res) => {
    const body = await readBody(req);
    const key = normalizeUsername(body.username);
    if (tooMany(clientIP(req) + '|' + key)) return sendJSON(res, 429, { error: 'Terlalu banyak percobaan. Tunggu lima menit.' });
    const user = db.users[key];
    if (!user) return sendJSON(res, 401, { error: 'Username belum terdaftar di server ini.' });
    if (!validPin(body.pin)) return sendJSON(res, 401, { error: 'PIN tidak valid.' });
    const hash = hashPin(body.pin, user.salt);
    if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.hash))) return sendJSON(res, 401, { error: 'PIN belum cocok. Coba periksa lagi.' });
    clearAttempts(clientIP(req) + '|' + key);
    user.profile = user.profile || emptyProfile(user);
    user.profile.displayName = user.displayName;
    user.profile.role = user.role;
    const token = createSession(user.username);
    saveDB();
    sendJSON(res, 200, { token, user: publicUser(user), profile: user.profile, prefs: user.prefs || null, server: true });
  },

  'POST /api/auth/logout': async (req, res) => {
    const token = bearer(req);
    if (token && db.sessions[token]) { delete db.sessions[token]; saveDB(); }
    sendJSON(res, 200, { ok: true });
  },

  'GET /api/auth/session': async (req, res) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'Sesi tidak dikenali.' });
    user.lastSeen = Date.now();
    user.profile = user.profile || emptyProfile(user);
    user.profile.displayName = user.displayName;
    user.profile.role = user.role;
    saveDB();
    sendJSON(res, 200, { user: publicUser(user), profile: user.profile, prefs: user.prefs || null });
  },

  'PUT /api/profile': async (req, res) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'Sesi tidak dikenali.' });
    const body = await readBody(req);
    if (body.profile && typeof body.profile === 'object') {
      const clean = { ...body.profile };
      delete clean.username; delete clean.displayName; delete clean.role;
      clean.displayName = user.displayName;
      clean.role = user.role;
      clean.xp = Math.max(0, Math.round(Number(clean.xp) || 0));
      user.profile = { ...(user.profile || emptyProfile(user)), ...clean };
    }
    if (body.prefs && typeof body.prefs === 'object') user.prefs = body.prefs;
    user.lastSeen = Date.now();
    saveDB();
    sendJSON(res, 200, { ok: true, profile: user.profile, prefs: user.prefs || null });
  },

  /* Komunitas: dipakai js/community.js — pengumuman + leaderboard lintas perangkat */
  'GET /api/community': async (req, res) => {
    const players = Object.values(db.users)
      .filter(user => user.profile)
      .map(publicUser)
      .sort((a, b) => b.xp - a.xp);
    sendJSON(res, 200, {
      announcements: db.community.announcements.slice(0, 60),
      players,
      info: db.community.info,
      updatedAt: Date.now()
    });
  },

  'POST /api/community': async (req, res) => {
    const body = await readBody(req);
    const action = String(body.action || '');
    if (action === 'announce') {
      const user = userFromToken(bearer(req));
      if (!user || !['Developer', 'President', 'Admin'].includes(user.role)) return sendJSON(res, 403, { error: 'forbidden' });
      const src = body.announcement || body;
      const item = {
        id: 'srv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title: String(src.title || '').trim().slice(0, 80),
        body: String(src.body || '').trim().slice(0, 400),
        type: src.type || 'info',
        author: user.displayName,
        authorRole: user.role,
        time: Date.now()
      };
      if (!item.title || !item.body) return sendJSON(res, 400, { error: 'empty' });
      db.community.announcements.unshift(item);
      db.community.announcements = db.community.announcements.slice(0, 60);
      saveDB();
      return sendJSON(res, 200, { ok: true, announcement: item });
    }
    if (action === 'updateInfo') {
      const user = userFromToken(bearer(req));
      if (!user || !['Developer', 'President', 'Admin'].includes(user.role)) return sendJSON(res, 403, { error: 'forbidden' });
      const src = body.info || body;
      const title = String(src.title || '').trim().slice(0, 80);
      const text = String(src.body || '').trim().slice(0, 500);
      if (!title || !text) return sendJSON(res, 400, { error: 'empty' });
      db.community.info = {
        title,
        body: text,
        updatedBy: user.displayName,
        updatedAt: Date.now()
      };
      saveDB();
      return sendJSON(res, 200, { ok: true, info: db.community.info });
    }
    if (action === 'delete') {
      const user = userFromToken(bearer(req));
      if (!user || !['Developer', 'President', 'Admin'].includes(user.role)) return sendJSON(res, 403, { error: 'forbidden' });
      db.community.announcements = db.community.announcements.filter(item => item.id !== body.id);
      saveDB();
      return sendJSON(res, 200, { ok: true });
    }
    if (action === 'sync') {
      const user = userFromToken(bearer(req));
      if (user) { user.lastSeen = Date.now(); saveDB(); }
      return sendJSON(res, 200, { ok: true });
    }
    sendJSON(res, 400, { error: 'action tidak dikenal' });
  },

  'GET /api/users/search': async (req, res, url) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'login' });
    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const list = Object.values(db.users)
      .filter(item => normalizeUsername(item.username) !== normalizeUsername(user.username))
      .filter(item => !q || item.username.toLowerCase().includes(q) || item.displayName.toLowerCase().includes(q))
      .map(item => {
        const rec = friendRecord(user.username);
        const key = normalizeUsername(item.username);
        return { ...publicUser(item),
          isFriend: rec.friends.includes(key),
          incoming: rec.incoming.includes(key),
          outgoing: rec.outgoing.includes(key) };
      })
      .slice(0, 25);
    sendJSON(res, 200, { users: list });
  },

  'GET /api/friends': async (req, res) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'login' });
    const rec = friendRecord(user.username);
    const hydrate = list => list.map(key => db.users[key] ? publicUser(db.users[key]) : null).filter(Boolean);
    sendJSON(res, 200, { friends: hydrate(rec.friends), incoming: hydrate(rec.incoming), outgoing: hydrate(rec.outgoing) });
  },

  'POST /api/friends/request': async (req, res) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'login' });
    const body = await readBody(req);
    const targetKey = normalizeUsername(body.username);
    const target = db.users[targetKey];
    if (!target) return sendJSON(res, 404, { error: 'Akun tidak ditemukan.' });
    const selfKey = normalizeUsername(user.username);
    if (targetKey === selfKey) return sendJSON(res, 400, { error: 'Tidak bisa menambahkan diri sendiri.' });
    const myRec = friendRecord(user.username);
    const theirRec = friendRecord(target.username);
    if (myRec.friends.includes(targetKey)) return sendJSON(res, 200, { ok: true, already: true });
    if (!myRec.outgoing.includes(targetKey)) myRec.outgoing.push(targetKey);
    if (!theirRec.incoming.includes(selfKey)) theirRec.incoming.push(selfKey);
    saveDB();
    pushEvent(target.username, 'friend-request', { from: user.username, displayName: user.displayName });
    sendJSON(res, 200, { ok: true });
  },

  'POST /api/friends/accept': async (req, res) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'login' });
    const body = await readBody(req);
    const fromKey = normalizeUsername(body.username);
    const from = db.users[fromKey];
    if (!from) return sendJSON(res, 404, { error: 'Akun tidak ditemukan.' });
    const myRec = friendRecord(user.username);
    const theirRec = friendRecord(from.username);
    myRec.incoming = myRec.incoming.filter(item => item !== fromKey);
    if (!myRec.friends.includes(fromKey)) myRec.friends.push(fromKey);
    theirRec.outgoing = theirRec.outgoing.filter(item => item !== normalizeUsername(user.username));
    if (!theirRec.friends.includes(normalizeUsername(user.username))) theirRec.friends.push(normalizeUsername(user.username));
    saveDB();
    pushEvent(from.username, 'friend-accepted', { from: user.username, displayName: user.displayName });
    sendJSON(res, 200, { ok: true });
  },

  'POST /api/friends/decline': async (req, res) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'login' });
    const body = await readBody(req);
    const fromKey = normalizeUsername(body.username);
    const myRec = friendRecord(user.username);
    myRec.incoming = myRec.incoming.filter(item => item !== fromKey);
    const theirRec = friendRecord(fromKey);
    theirRec.outgoing = theirRec.outgoing.filter(item => item !== normalizeUsername(user.username));
    saveDB();
    sendJSON(res, 200, { ok: true });
  },

  'POST /api/friends/remove': async (req, res) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'login' });
    const body = await readBody(req);
    const otherKey = normalizeUsername(body.username);
    const myRec = friendRecord(user.username);
    const theirRec = friendRecord(otherKey);
    myRec.friends = myRec.friends.filter(item => item !== otherKey);
    theirRec.friends = theirRec.friends.filter(item => item !== normalizeUsername(user.username));
    saveDB();
    sendJSON(res, 200, { ok: true });
  },

  'GET /api/chats': async (req, res) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'login' });
    const selfKey = normalizeUsername(user.username);
    const rec = friendRecord(user.username);
    const conversations = rec.friends.map(friendKey => {
      const messages = chatBetween(user.username, friendKey);
      const last = messages[messages.length - 1] || null;
      const unread = messages.filter(item => item.to === selfKey && !item.read).length;
      const friend = db.users[friendKey];
      return {
        username: friend ? friend.username : friendKey,
        displayName: friend ? friend.displayName : friendKey,
        lastText: last ? last.text : '',
        lastFrom: last ? last.from : '',
        lastAt: last ? last.at : 0,
        unread
      };
    }).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
    const totalUnread = conversations.reduce((sum, item) => sum + item.unread, 0);
    sendJSON(res, 200, { conversations, totalUnread });
  },

  'GET /api/messages': async (req, res, url) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'login' });
    const peerKey = normalizeUsername(url.searchParams.get('with') || '');
    if (!areFriends(user.username, peerKey)) return sendJSON(res, 403, { error: 'Harus berteman untuk mengirim pesan.' });
    const selfKey = normalizeUsername(user.username);
    let messages = chatBetween(user.username, peerKey).map(item => ({ ...item }));
    messages.forEach(item => { if (item.to === selfKey && !item.read) { item.read = true; item.readBy = selfKey; } });
    saveDB();
    const peer = db.users[peerKey];
    sendJSON(res, 200, { messages: messages.slice(-200), peer: peer ? publicUser(peer) : null });
  },

  'POST /api/messages/send': async (req, res) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'login' });
    const body = await readBody(req);
    const targetKey = normalizeUsername(body.to);
    const target = db.users[targetKey];
    if (!target) return sendJSON(res, 404, { error: 'Akun tidak ditemukan.' });
    if (!areFriends(user.username, targetKey)) return sendJSON(res, 403, { error: 'Tambahkan teman dulu sebelum mengirim pesan.' });
    const text = String(body.text || '').trim().slice(0, 500);
    if (!text) return sendJSON(res, 400, { error: 'Pesan kosong.' });
    const selfKey = normalizeUsername(user.username);
    const message = { id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), from: selfKey, to: targetKey, text, at: Date.now(), read: false };
    pushChat(user.username, targetKey, message);
    saveDB();
    pushEvent(target.username, 'message', { from: user.username, displayName: user.displayName, text, at: message.at });
    sendJSON(res, 200, { ok: true, message });
  },

  'POST /api/messages/read': async (req, res) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'login' });
    const body = await readBody(req);
    const peerKey = normalizeUsername(body.with);
    const selfKey = normalizeUsername(user.username);
    chatBetween(user.username, peerKey).forEach(item => { if (item.to === selfKey && !item.read) { item.read = true; item.readBy = selfKey; } });
    saveDB();
    sendJSON(res, 200, { ok: true });
  },

  'GET /api/notifications/poll': async (req, res, url) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'login' });
    const key = normalizeUsername(user.username);
    const since = Number(url.searchParams.get('since') || 0);
    const items = (eventLog.get(key) || []).filter(item => item.seq > since);
    if (items.length) return sendJSON(res, 200, { events: items });
    liveEvents.watch('user:' + key, req, res, payload => sendJSON(res, 200, payload));
  },

  /* Kelas Langsung */
  'POST /api/live/create': async (req, res) => {
    const user = userFromToken(bearer(req));
    if (!user) return sendJSON(res, 401, { error: 'login' });
    const body = await readBody(req);
    if (!quizBank.length) loadQuizBank();
    const room = makeRoom(user, body);
    sendJSON(res, 200, { pin: room.pin, host: true });
  },

  'POST /api/live/join': async (req, res) => {
    const body = await readBody(req);
    const user = userFromToken(bearer(req));
    const pin = String(body.pin || '').trim();
    const room = liveRooms.get(pin);
    if (!room) return sendJSON(res, 404, { error: 'PIN tidak ditemukan. Pastikan kelas masih berjalan.' });
    if (room.phase !== 'lobby') return sendJSON(res, 409, { error: 'Kelas sudah dimulai. Tunggu sesi berikutnya.' });
    room.lastActivity = Date.now();
    let displayName = user ? user.displayName : String(body.name || '').trim().slice(0, 24);
    if (!displayName) return sendJSON(res, 400, { error: 'Nama pemain wajib diisi.' });
    const key = user ? normalizeUsername(user.username) : 'guest-' + crypto.randomBytes(4).toString('hex');
    const character = cleanCharacter(body.character);
    if (character) {
      const heldBy = characterHeld(room, key, character);
      if (heldBy) return sendJSON(res, 409, { error: 'Karakter ' + character + ' sudah dipakai ' + heldBy + '. Pilih karakter lain.' });
    }
    room.players.set(key, {
      username: user ? user.username : '',
      displayName,
      character,
      score: 0, streak: 0, correctCount: 0, lastPoints: 0,
      answered: false, answeredQuestion: -1, answerChoice: -1,
      anonymous: !user
    });
    liveBroadcast(room);
    sendJSON(res, 200, { ok: true, pin, joinedKey: key, character });
  },

  'POST /api/live/character': async (req, res) => {
    const body = await readBody(req);
    const user = userFromToken(bearer(req));
    const room = liveRooms.get(String(body.pin || ''));
    if (!room) return sendJSON(res, 404, { error: 'Sesi kelas tidak ditemukan.' });
    const key = user ? normalizeUsername(user.username) : String(body.joinedKey || '');
    const player = room.players.get(key);
    if (!player) return sendJSON(res, 403, { error: 'Kamu tidak ada di kelas ini.' });
    if (room.phase !== 'lobby') return sendJSON(res, 409, { error: 'Kelas sudah dimulai, karakter tidak bisa diganti.' });
    const character = cleanCharacter(body.character);
    if (!character) return sendJSON(res, 400, { error: 'Karakter tidak dikenali.' });
    const heldBy = characterHeld(room, key, character);
    if (heldBy) return sendJSON(res, 409, { error: 'Karakter itu baru saja dipakai ' + heldBy + '. Pilih karakter lain.' });
    player.character = character;
    room.lastActivity = Date.now();
    liveBroadcast(room);
    sendJSON(res, 200, { ok: true, character });
  },

  'POST /api/live/host': async (req, res) => {
    const body = await readBody(req);
    const user = userFromToken(bearer(req));
    const room = liveRooms.get(String(body.pin || ''));
    if (!room) return sendJSON(res, 404, { error: 'Sesi kelas tidak ditemukan.' });
    if (!user || normalizeUsername(user.username) !== normalizeUsername(room.host.username)) return sendJSON(res, 403, { error: 'Hanya pembuat kelas yang bisa mengatur sesi.' });
    room.lastActivity = Date.now();
    const action = String(body.action || '');
    if (action === 'start') {
      if (room.phase !== 'lobby' || !room.players.size) return sendJSON(res, 400, { error: 'Minimal satu pemain di lobby.' });
      room.phase = 'question';
      room.index = 0;
      room.openedAt = Date.now();
      room.seconds = Math.min(60, Math.max(8, Number(body.seconds) || 20));
      liveBroadcast(room);
      return sendJSON(res, 200, { ok: true });
    }
    if (action === 'reveal') {
      if (room.phase !== 'question') return sendJSON(res, 400, { error: 'Tidak ada soal aktif.' });
      closeQuestionAnswers(room);
      room.phase = 'reveal';
      liveBroadcast(room);
      return sendJSON(res, 200, { ok: true });
    }
    if (action === 'next') {
      if (room.phase !== 'reveal') return sendJSON(res, 400, { error: 'Ulas dulu soal ini.' });
      if (room.index >= room.deck.length - 1) {
        finishRoom(room);
        liveBroadcast(room);
        return sendJSON(res, 200, { ok: true, finished: true });
      }
      room.phase = 'question';
      room.index += 1;
      room.openedAt = Date.now();
      room.seconds = Math.min(60, Math.max(8, Number(body.seconds) || 20));
      liveBroadcast(room);
      return sendJSON(res, 200, { ok: true });
    }
    if (action === 'kick') {
      room.players.delete(normalizeUsername(body.name || ''));
      liveBroadcast(room);
      return sendJSON(res, 200, { ok: true });
    }
    if (action === 'restart') {
      room.deck = buildDeck(body.options || {});
      room.index = -1;
      room.phase = 'lobby';
      room.leaderboard = [];
      for (const player of room.players.values()) {
        player.score = 0; player.streak = 0; player.correctCount = 0; player.lastPoints = 0; player.answered = false; player.answeredQuestion = -1;
      }
      liveBroadcast(room);
      return sendJSON(res, 200, { ok: true });
    }
    if (action === 'close') {
      const set = wsHub.rooms.get(room.pin);
      if (set) for (const mini of set) mini.send({ type: 'live-closed' });
      liveRooms.delete(room.pin);
      return sendJSON(res, 200, { ok: true });
    }
    sendJSON(res, 400, { error: 'Aksi tidak dikenal.' });
  },

  'POST /api/live/answer': async (req, res) => {
    const body = await readBody(req);
    const room = liveRooms.get(String(body.pin || ''));
    if (!room) return sendJSON(res, 404, { error: 'Sesi kelas tidak ditemukan.' });
    const user = userFromToken(bearer(req));
    const key = user ? normalizeUsername(user.username) : String(body.joinedKey || '');
    const player = room.players.get(key);
    if (!player) return sendJSON(res, 403, { error: 'Kamu tidak ada di kelas ini.' });
    room.lastActivity = Date.now();
    const ok = awardAnswer(room, player, Number(body.choice), Number(body.timeMs));
    if (!ok) return sendJSON(res, 409, { error: 'Jawaban sudah terkunci atau sesi berjalan.' });
    liveBroadcast(room);
    sendJSON(res, 200, { ok: true, points: player.lastPoints });
  },

  'GET /api/live/state': async (req, res, url) => {
    const room = liveRooms.get(String(url.searchParams.get('pin') || ''));
    if (!room) return sendJSON(res, 404, { error: 'Sesi kelas tidak ditemukan.' });
    room.lastActivity = Date.now();
    const user = userFromToken(bearer(req));
    const isHost = user && normalizeUsername(user.username) === normalizeUsername(room.host.username);
    sendJSON(res, 200, { rev: room.rev || 0, state: roomState(room, 'player'), host: roomState(room, isHost ? 'host' : 'player') });
  },

  'GET /api/live/wait': async (req, res, url) => {
    const pin = String(url.searchParams.get('pin') || '');
    const room = liveRooms.get(pin);
    if (!room) return sendJSON(res, 404, { error: 'Sesi kelas tidak ditemukan.' });
    const since = Number(url.searchParams.get('since') || room.rev || 0);
    const user = userFromToken(bearer(req));
    const isHost = user && normalizeUsername(user.username) === normalizeUsername(room.host.username);
    const sendState = payload => {
      const wrapped = payload && Array.isArray(payload.events) ? payload.events[payload.events.length - 1] : null;
      if (wrapped && wrapped.rev) payload = { rev: wrapped.rev, state: wrapped.state, host: wrapped.host };
      if (payload.rev || payload.timeout) {
        if (payload.timeout) return sendJSON(res, 200, { rev: room.rev || 0, state: roomState(room, 'player'), host: roomState(room, isHost ? 'host' : 'player'), timeout: true });
        return sendJSON(res, 200, { rev: payload.rev, state: payload.state, host: isHost ? payload.host : payload.state });
      }
      sendJSON(res, 200, payload);
    };
    if ((room.rev || 0) > since) return sendJSON(res, 200, { rev: room.rev, state: roomState(room, 'player'), host: roomState(room, isHost ? 'host' : 'player') });
    liveEvents.watch('live:' + pin, req, res, sendState);
  }
};

/* ---------------- WebSocket handler (opsional, cepat) ---------------- */

function handleUpgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  const head = 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n';
  try { socket.write(head); } catch (error) { socket.destroy(); return; }
  const mini = new MiniSocket(socket);
  let joinedRoom = null;
  mini.handlers.message = message => {
    if (!message || typeof message !== 'object') return;
    const type = String(message.type || '');
    if (type === 'identify') {
      const token = String(message.token || '');
      const user = userFromToken(token);
      if (user) wsHub.attachUser(user.username, mini);
      return;
    }
    if (type === 'live-subscribe') {
      const room = liveRooms.get(String(message.pin || ''));
      if (!room) return;
      const token = String(message.token || '');
      const user = userFromToken(token);
      const isHost = user && normalizeUsername(user.username) === normalizeUsername(room.host.username);
      wsHub.attachRoom(room.pin, mini);
      joinedRoom = room.pin;
      mini.send({ type: 'live-state', rev: room.rev || 0, state: roomState(room, 'player'), host: roomState(room, isHost ? 'host' : 'player') });
      return;
    }
    if (type === 'live-answer') {
      const room = liveRooms.get(String(message.pin || ''));
      if (!room) return;
      const token = String(message.token || '');
      const user = userFromToken(token);
      const key = user ? normalizeUsername(user.username) : String(message.joinedKey || '');
      const player = room.players.get(key);
      if (!player) return;
      awardAnswer(room, player, Number(message.choice), Number(message.timeMs));
      liveBroadcast(room);
    }
  };
}

/* ---------------- Static file ---------------- */

function safePath(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const target = path.normalize(path.join(ROOT, rel));
  if (!target.startsWith(ROOT + path.sep) && target !== ROOT) return null;
  if (target.startsWith(path.join(ROOT, 'server'))) return null;
  return target;
}

async function serveStatic(req, res) {
  const target = safePath(req.url);
  if (!target) return sendJSON(res, 404, { error: 'not found' });
  try {
    const stat = await fsp.stat(target);
    if (!stat.isFile()) throw new Error('not file');
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300'
    });
    fs.createReadStream(target).pipe(res);
  } catch (error) {
    if (path.extname(target) === '') {
      const spa = path.join(ROOT, 'index.html');
      try {
        const html = await fsp.readFile(spa);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      } catch (inner) { /* jatuh ke 404 */ }
    }
    sendJSON(res, 404, { error: 'not found' });
  }
}

/* ---------------- Server utama ---------------- */

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, 'http://localhost');
  const method = req.method.toUpperCase();
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    });
    return res.end();
  }
  const routeKey = method + ' ' + parsed.pathname;
  const handler = routes[routeKey];
  if (handler) {
    try {
      await handler(req, res, parsed);
    } catch (error) {
      console.error('[neko] api error', routeKey, error.message);
      if (!res.headersSent) sendJSON(res, 500, { error: error.message || 'server error' });
    }
    return;
  }
  if (parsed.pathname.startsWith('/api/')) return sendJSON(res, 404, { error: 'endpoint tidak dikenal' });
  serveStatic(req, res);
});

server.on('upgrade', (req, socket) => {
  const parsed = new URL(req.url, 'http://localhost');
  if (parsed.pathname === '/ws') handleUpgrade(req, socket);
  else socket.destroy();
});

loadDB();
seedPresets();
loadQuizBank();

server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const lan = [];
  for (const list of Object.values(nets)) {
    for (const net of (list || [])) {
      if (net.family === 'IPv4' && !net.internal) lan.push(net.address);
    }
  }
  console.log('==================================================');
  console.log('  NEKO server aktif!');
  console.log('  Lokal :  http://localhost:' + PORT);
  for (const ip of lan) console.log('  Jaringan:  http://' + ip + ':' + PORT + '  ← bagikan ke teman/kelas');
  console.log('  Data   :  server/db.json');
  console.log('==================================================');
});
