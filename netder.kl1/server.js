'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { WebSocketServer, WebSocket } = require('ws');

const webRoot = __dirname;
const publicDirectories = new Set(['assets', 'classroom', 'miko']);
const publicFiles = new Set(['index.html', 'favicon.svg', 'loading-logo.svg', 'site.webmanifest', 'sw.js']);
const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');
const rooms = new Map();
const roomLifetime = 4 * 60 * 60 * 1000;
const questionDuration = 20 * 1000;
const maxPlayers = 100;
const reactions = new Set(['👏', '🎉', '🤔', '❤️', '⚡']);
const quiz = [
  { prompt: 'Perangkat yang meneruskan paket antarjaringan adalah…', options: ['Router', 'Hub', 'Mouse', 'Printer'], answer: 0, explanation: 'Router meneruskan paket di antara jaringan IP.' },
  { prompt: 'VLAN terutama digunakan untuk…', options: ['Segmentasi jaringan logis', 'Menambah kecepatan CPU', 'Mengganti kabel', 'Menyimpan kata sandi'], answer: 0, explanation: 'VLAN memisahkan broadcast domain secara logis.' },
  { prompt: 'Berapa panjang alamat IPv4?', options: ['16 bit', '32 bit', '64 bit', '128 bit'], answer: 1, explanation: 'Alamat IPv4 memiliki panjang 32 bit.' },
  { prompt: 'Port standar SSH adalah…', options: ['20', '22', '53', '443'], answer: 1, explanation: 'SSH umumnya menggunakan TCP port 22.' },
  { prompt: 'DNS membantu menerjemahkan…', options: ['Nama domain menjadi alamat IP', 'Kabel menjadi sinyal radio', 'RAM menjadi penyimpanan', 'VLAN menjadi subnet'], answer: 0, explanation: 'DNS memetakan nama domain ke alamat IP.' },
  { prompt: 'Subnet mask /24 adalah…', options: ['255.0.0.0', '255.255.0.0', '255.255.255.0', '255.255.255.255'], answer: 2, explanation: 'Prefix /24 memiliki 24 bit network mask.' },
  { prompt: 'Kabel fiber optik membawa data menggunakan…', options: ['Cahaya', 'Air', 'Suara', 'Panas'], answer: 0, explanation: 'Fiber mengirimkan data melalui pulsa cahaya.' },
  { prompt: 'DHCP digunakan untuk…', options: ['Mengalokasikan konfigurasi IP', 'Mengedit gambar', 'Menguji suhu CPU', 'Membuat akun email'], answer: 0, explanation: 'DHCP memberikan konfigurasi jaringan secara otomatis.' },
  { prompt: 'Perintah umum untuk menguji jangkauan host adalah…', options: ['ping', 'mkdir', 'format', 'copy'], answer: 0, explanation: 'ping menguji konektivitas jaringan menggunakan ICMP.' },
  { prompt: 'Model OSI memiliki berapa layer?', options: ['4', '5', '6', '7'], answer: 3, explanation: 'Model referensi OSI terdiri atas tujuh layer.' }
];

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'], ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.ico', 'image/x-icon'], ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'], ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'], ['.pdf', 'application/pdf'], ['.apk', 'application/vnd.android.package-archive']
]);

function send(socket, value) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}

function error(socket, message) {
  send(socket, { type: 'error', message });
}

function tokenMatches(candidate, expected) {
  if (typeof candidate !== 'string' || !/^[a-f\d-]{36}$/i.test(candidate)) return false;
  const provided = Buffer.from(candidate);
  const stored = Buffer.from(expected);
  return provided.length === stored.length && crypto.timingSafeEqual(provided, stored);
}

function getRoom(socket) {
  const room = rooms.get(socket.roomId);
  return room && room.id === socket.roomId ? room : null;
}

function publicState(room, socket) {
  const player = socket.role === 'player' ? room.players.get(socket.playerId) : null;
  const state = {
    type: 'state',
    role: socket.role,
    roomId: room.id,
    title: room.title,
    phase: room.phase,
    questionIndex: room.questionIndex,
    questionCount: quiz.length,
    deadline: room.deadline,
    answered: room.answers.size,
    playerCount: room.players.size,
    players: socket.role === 'host' ? [...room.players.values()].map(item => ({
      id: item.id, name: item.name, avatar: item.avatar, score: item.score,
      connected: item.connected, answered: room.answers.has(item.id)
    })) : [],
    score: player?.score || 0,
    reactions: room.reactions.slice(-8)
  };
  if (room.phase === 'question') {
    const item = quiz[room.questionIndex];
    state.question = { prompt: item.prompt, options: item.options };
    state.submitted = Boolean(player && room.answers.has(player.id));
  } else if (room.phase === 'result') {
    const item = quiz[room.questionIndex];
    state.question = { prompt: item.prompt, options: item.options, answer: item.answer, explanation: item.explanation };
    state.results = [...room.answers.entries()].map(([id, answer]) => ({
      id, choice: answer.choice, correct: answer.choice === item.answer
    }));
  } else if (room.phase === 'finished') {
    state.question = null;
  }
  return state;
}

function broadcast(room) {
  for (const socket of room.clients) send(socket, publicState(room, socket));
}

function clearQuestionTimer(room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
}

function showResults(room) {
  if (room.phase !== 'question') return;
  clearQuestionTimer(room);
  room.phase = 'result';
  room.deadline = 0;
  broadcast(room);
}

function startQuestion(room) {
  if (room.questionIndex >= quiz.length) {
    room.phase = 'finished';
    room.deadline = 0;
    broadcast(room);
    return;
  }
  room.phase = 'question';
  room.answers.clear();
  room.deadline = Date.now() + questionDuration;
  clearQuestionTimer(room);
  room.timer = setTimeout(() => showResults(room), questionDuration);
  broadcast(room);
}

function newRoomId() {
  let code;
  do { code = String(crypto.randomInt(100000, 1000000)); } while (rooms.has(code));
  return code;
}

function avatarFrom(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const allowed = {
    gender: new Set(['neutral', 'boy', 'girl']),
    hair: new Set(['curly', 'short', 'long', 'spiky', 'wavy', 'braids', 'fade', 'bun']),
    accessory: new Set(['none', 'glasses', 'cap', 'headphones', 'ribbon']),
    outfit: new Set(['uniform', 'hoodie', 'sport', 'lab'])
  };
  const avatar = {};
  for (const [key, choices] of Object.entries(allowed)) {
    if (!choices.has(value[key])) return null;
    avatar[key] = value[key];
  }
  return avatar;
}

function handleMessage(socket, message) {
  if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') {
    error(socket, 'Pesan tidak valid.');
    return;
  }

  if (message.type === 'create') {
    if (socket.roomId) return error(socket, 'Keluar dari room saat ini sebelum membuat room baru.');
    const title = typeof message.title === 'string' ? message.title.trim().slice(0, 60) : '';
    const room = {
      id: newRoomId(), token: crypto.randomUUID(), title: title || 'Kelas TJKT',
      phase: 'lobby', questionIndex: 0, deadline: 0, answers: new Map(),
      players: new Map(), clients: new Set(), reactions: [], timer: null, touchedAt: Date.now()
    };
    rooms.set(room.id, room);
    socket.roomId = room.id;
    socket.role = 'host';
    room.clients.add(socket);
    send(socket, { type: 'created', roomId: room.id, token: room.token });
    broadcast(room);
    return;
  }

  if (message.type === 'join') {
    if (socket.roomId) return error(socket, 'Keluar dari room saat ini sebelum bergabung ke room lain.');
    const roomId = typeof message.roomId === 'string' ? message.roomId : '';
    const room = rooms.get(roomId);
    const name = typeof message.name === 'string' ? message.name.trim().slice(0, 24) : '';
    const avatar = avatarFrom(message.avatar);
    if (!room || room.phase !== 'lobby') return error(socket, 'Room tidak ditemukan atau sesi sudah dimulai.');
    if (name.length < 2) return error(socket, 'Nama tampilan minimal 2 karakter.');
    if (!avatar) return error(socket, 'Pengaturan avatar tidak valid.');
    if (room.players.size >= maxPlayers) return error(socket, 'Room sudah mencapai batas 100 peserta.');
    if ([...room.players.values()].some(player => player.name.toLocaleLowerCase('id') === name.toLocaleLowerCase('id'))) {
      return error(socket, 'Nama tersebut sudah digunakan di room ini.');
    }
    const player = { id: crypto.randomUUID(), token: crypto.randomUUID(), name, avatar, score: 0, connected: true };
    room.players.set(player.id, player);
    room.touchedAt = Date.now();
    socket.roomId = room.id;
    socket.role = 'player';
    socket.playerId = player.id;
    room.clients.add(socket);
    send(socket, { type: 'joined', roomId: room.id, token: player.token, playerId: player.id });
    broadcast(room);
    return;
  }

  if (message.type === 'resume') {
    const room = rooms.get(String(message.roomId || ''));
    if (!room || typeof message.token !== 'string') return error(socket, 'Room atau sesi yang ingin dipulihkan tidak ditemukan.');
    if (tokenMatches(message.token, room.token)) {
      socket.roomId = room.id;
      socket.role = 'host';
      room.clients.add(socket);
    } else {
      const player = [...room.players.values()].find(item => tokenMatches(message.token, item.token));
      if (!player) return error(socket, 'Sesi pemain sudah tidak berlaku.');
      player.connected = true;
      socket.roomId = room.id;
      socket.role = 'player';
      socket.playerId = player.id;
      room.clients.add(socket);
    }
    room.touchedAt = Date.now();
    send(socket, { type: 'resumed', roomId: room.id, role: socket.role, playerId: socket.playerId || null });
    broadcast(room);
    return;
  }

  const room = getRoom(socket);
  if (!room || !room.clients.has(socket)) return error(socket, 'Bergabung ke room terlebih dahulu.');
  room.touchedAt = Date.now();

  if (message.type === 'start' && socket.role === 'host') {
    if (room.phase !== 'lobby' || room.players.size === 0) return error(socket, 'Kuis dapat dimulai setelah setidaknya satu siswa bergabung.');
    room.questionIndex = 0;
    for (const player of room.players.values()) player.score = 0;
    startQuestion(room);
  } else if (message.type === 'answer' && socket.role === 'player') {
    const player = room.players.get(socket.playerId);
    const choice = message.choice;
    if (room.phase !== 'question' || !player || room.answers.has(player.id)) return error(socket, 'Jawaban sudah dikirim atau waktu soal telah selesai.');
    if (!Number.isInteger(choice) || choice < 0 || choice >= quiz[room.questionIndex].options.length) return error(socket, 'Pilihan jawaban tidak valid.');
    const correct = choice === quiz[room.questionIndex].answer;
    const points = correct ? 100 + Math.round(400 * Math.max(0, room.deadline - Date.now()) / questionDuration) : 0;
    player.score += points;
    room.answers.set(player.id, { choice, points });
    if (room.answers.size >= [...room.players.values()].filter(item => item.connected).length) showResults(room);
    else broadcast(room);
  } else if (message.type === 'advance' && socket.role === 'host') {
    if (room.phase !== 'result') return error(socket, 'Soal berikutnya belum tersedia.');
    room.questionIndex++;
    startQuestion(room);
  } else if (message.type === 'close' && socket.role === 'host') {
    clearQuestionTimer(room);
    for (const client of room.clients) {
      send(client, { type: 'closed', message: 'Guru mengakhiri room ini.' });
      client.close(1000, 'Room closed');
    }
    rooms.delete(room.id);
  } else if (message.type === 'leave' && socket.role === 'player') {
    room.players.delete(socket.playerId);
    room.answers.delete(socket.playerId);
    room.clients.delete(socket);
    socket.roomId = null;
    socket.role = null;
    broadcast(room);
    if (room.phase === 'question' &&
        room.answers.size >= [...room.players.values()].filter(item => item.connected).length) showResults(room);
  } else if (message.type === 'react') {
    const emoji = typeof message.emoji === 'string' ? message.emoji : '';
    if (!reactions.has(emoji)) return error(socket, 'Reaksi tidak tersedia.');
    const player = socket.role === 'player' ? room.players.get(socket.playerId) : null;
    room.reactions.push({
      id: crypto.randomUUID(), emoji,
      name: socket.role === 'host' ? 'Guru' : player?.name || 'Siswa',
      timestamp: Date.now()
    });
    room.reactions = room.reactions.slice(-12);
    broadcast(room);
  } else {
    error(socket, 'Aksi tidak diizinkan untuk sesi ini.');
  }
}

const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
    return response.end('Method not allowed');
  }

  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400); return response.end('Bad request'); }
  const target = path.resolve(webRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (target !== webRoot && !target.startsWith(`${webRoot}${path.sep}`)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('Forbidden');
  }
  const relativePath = path.relative(webRoot, target);
  const pathSegments = relativePath.split(path.sep);
  const isPublicFile = pathSegments.length === 1 && publicFiles.has(pathSegments[0]);
  const isPublicDirectory = publicDirectories.has(pathSegments[0]);
  if ((!isPublicFile && !isPublicDirectory) || pathSegments.some(segment => segment.startsWith('.'))) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('Not found');
  }
  const type = mimeTypes.get(path.extname(target).toLowerCase());
  if (!type) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('Not found');
  }
  try {
    const content = await fs.readFile(target);
    response.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': path.basename(target) === 'index.html' ? 'no-cache' : 'public, max-age=300'
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (cause) {
    if (cause.code === 'ENOENT' || cause.code === 'EISDIR') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return response.end('Not found');
    }
    console.error('Unable to serve application file:', cause);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Unable to read application file');
  }
});

const webSockets = new WebSocketServer({ server, path: '/realtime', maxPayload: 16 * 1024 });
webSockets.on('connection', socket => {
  socket.messageTimes = [];
  socket.on('message', raw => {
    const now = Date.now();
    socket.messageTimes = socket.messageTimes.filter(time => now - time < 10_000);
    if (socket.messageTimes.length >= 40) return error(socket, 'Terlalu banyak pesan; tunggu sebentar.');
    socket.messageTimes.push(now);
    try { handleMessage(socket, JSON.parse(raw.toString())); }
    catch (cause) {
      console.error('Unable to process classroom message:', cause);
      error(socket, 'Pesan tidak dapat diproses.');
    }
  });
  socket.on('close', () => {
    const room = getRoom(socket);
    if (!room) return;
    room.clients.delete(socket);
    if (socket.role === 'player') {
      const player = room.players.get(socket.playerId);
      if (player) player.connected = false;
    }
    room.touchedAt = Date.now();
    broadcast(room);
  });
  socket.on('error', cause => console.warn('Classroom WebSocket error:', cause.message));
});

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (now - room.touchedAt <= roomLifetime) continue;
    clearQuestionTimer(room);
    for (const socket of room.clients) socket.close(1000, 'Room expired');
    rooms.delete(room.id);
  }
}, 60_000);
cleanupTimer.unref();

server.listen(port, host, () => console.log(`NetQuest running at http://${host}:${port}`));
