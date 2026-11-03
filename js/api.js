/* ============================================================
   NEKO · js/api.js
   Jembatan server NEKO: akun sungguhan, sinkronisasi profil
   lintas perangkat, realtime events (pesan/teman), dan kanal
   WebSocket untuk Kelas Langsung dengan fallback long-poll.
   ============================================================ */
(function () {
  'use strict';

  const Neko = window.Neko = window.Neko || {};

  const TOKEN_KEY = 'neko_token_v1';
  const isFile = location.protocol === 'file:';

  let token = '';
  try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch (error) { token = ''; }

  let online = !isFile;
  let lastEventSeq = 0;
  let eventLoop = null;
  let socket = null;
  let socketRetry = 0;
  let liveFallbackTimer = null;
  const liveState = { pin: '', rev: 0, polling: false };

  try {
    lastEventSeq = Number(localStorage.getItem('neko_event_seq_v1') || 0) || 0;
  } catch (error) { lastEventSeq = 0; }

  function setToken(value) {
    token = String(value || '');
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (error) { /* penyimpanan privat */ }
  }

  async function request(path, options = {}) {
    if (isFile) throw new Error('offline');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), options.timeout || 12000);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token && options.auth !== false) headers.Authorization = 'Bearer ' + token;
      const response = await fetch(path, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        cache: 'no-store'
      });
      let payload = null;
      try { payload = await response.json(); } catch (error) { payload = null; }
      if (!response.ok) {
        if (payload === null) {
          online = false;
          const offlineError = new Error('Server NEKO tidak terhubung ke alamat ini.');
          offlineError.offline = true;
          throw offlineError;
        }
        const error = new Error((payload && payload.error) || 'Terjadi kesalahan server (' + response.status + ').');
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      online = true;
      return payload;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function probe() {
    if (isFile) { online = false; return false; }
    try {
      await request('/api/community?ping=1', { auth: false, timeout: 4000 });
      online = true;
    } catch (error) {
      online = false;
    }
    return online;
  }

  /* ---------------- Sesi & sinkronisasi profil ---------------- */

  async function login(username, pin) {
    const data = await request('/api/auth/login', { method: 'POST', body: { username, pin }, auth: false });
    setToken(data.token);
    return data;
  }

  async function register(displayName, username, pin) {
    const data = await request('/api/auth/register', { method: 'POST', body: { displayName, username, pin }, auth: false });
    setToken(data.token);
    return data;
  }

  async function restoreSession() {
    if (!token || isFile) return null;
    try {
      const data = await request('/api/auth/session');
      return data;
    } catch (error) {
      if (error.status === 401) setToken('');
      return null;
    }
  }

  async function logout() {
    try { if (token) await request('/api/auth/logout', { method: 'POST', timeout: 4000 }); } catch (error) { /* sesi lokal tetap dibersihkan */ }
    setToken('');
  }

  let syncTimer = null;
  let syncInFlight = false;
  let queued = null;

  function scheduleSync(payload) {
    if (!token || isFile) return;
    queued = payload;
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(flushSync, 900);
  }

  async function flushSync(force = false) {
    if (!queued) { if (!force) return; }
    if (syncInFlight) return;
    const payload = queued;
    if (!payload) return;
    syncInFlight = true;
    queued = null;
    try {
      await request('/api/profile', { method: 'PUT', body: payload });
      Neko.api.lastSyncAt = Date.now();
      document.dispatchEvent(new CustomEvent('neko:synced'));
    } catch (error) {
      queued = payload;
      window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(flushSync, 8000);
    } finally {
      syncInFlight = false;
    }
  }

  /* ---------------- Realtime events (pesan, teman, XP live) ---------------- */

  function dispatchEvent(item) {
    if (!item || !item.type) return;
    if (item.seq) {
      lastEventSeq = Math.max(lastEventSeq, Number(item.seq) || 0);
      try { localStorage.setItem('neko_event_seq_v1', String(lastEventSeq)); } catch (error) { /* abaikan */ }
    }
    document.dispatchEvent(new CustomEvent('neko:event', { detail: item }));
  }

  async function eventLoopOnce() {
    if (!token || isFile) return;
    try {
      const data = await request('/api/notifications/poll?since=' + lastEventSeq, { timeout: 32000 });
      if (Array.isArray(data.events)) data.events.forEach(dispatchEvent);
    } catch (error) {
      await Neko.util.wait(4000);
    }
  }

  function startEvents() {
    stopEvents();
    if (!token || isFile) return;
    let alive = true;
    eventLoop = {
      stop() { alive = false; }
    };
    (async () => {
      while (alive && token) {
        await eventLoopOnce();
      }
    })();
  }

  function stopEvents() {
    if (eventLoop) { eventLoop.stop(); eventLoop = null; }
  }

  /* ---------------- WebSocket Kelas Langsung ---------------- */

  function wsURL() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/ws';
  }

  function ensureSocket(onLiveMessage) {
    if (isFile) return null;
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return socket;
    try {
      socket = new WebSocket(wsURL());
    } catch (error) {
      scheduleSocketReconnect(onLiveMessage);
      return null;
    }
    socket.onopen = () => {
      socketRetry = 0;
      try { socket.send(JSON.stringify({ type: 'identify', token })); } catch (error) { /* abaikan */ }
      if (liveState.pin) {
        try { socket.send(JSON.stringify({ type: 'live-subscribe', pin: liveState.pin, token })); } catch (error) { /* abaikan */ }
      }
    };
    socket.onmessage = event => {
      let message = null;
      try { message = JSON.parse(event.data); } catch (error) { return; }
      if (message && message.type === 'live-state' && onLiveMessage) onLiveMessage(message);
    };
    socket.onclose = () => {
      socket = null;
      scheduleSocketReconnect(onLiveMessage);
    };
    socket.onerror = () => {
      try { socket && socket.close(); } catch (error) { /* abaikan */ }
      socket = null;
    };
    return socket;
  }

  function scheduleSocketReconnect(onLiveMessage) {
    socketRetry += 1;
    const delay = Math.min(15000, 1000 * Math.pow(1.6, socketRetry));
    window.setTimeout(() => ensureSocket(onLiveMessage), delay);
  }

  function subscribeLive(pin, onMessage) {
    liveState.pin = String(pin || '');
    const ws = ensureSocket(onMessage);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: 'live-subscribe', pin: liveState.pin, token })); } catch (error) { /* fallback polls */ }
    }
    startLiveFallback(onMessage);
  }

  function startLiveFallback(onMessage) {
    window.clearInterval(liveFallbackTimer);
    liveFallbackTimer = window.setInterval(async () => {
      if (!liveState.pin) return;
      const wsOpen = socket && socket.readyState === WebSocket.OPEN;
      if (wsOpen && !liveState.polling) return; // WebSocket sehat: tidak perlu poll
      if (liveState.polling) return;
      liveState.polling = true;
      try {
        const data = await request('/api/live/wait?pin=' + encodeURIComponent(liveState.pin) + '&since=' + liveState.rev, { timeout: 30000 });
        if (data && data.state && (data.rev > liveState.rev || data.timeout)) {
          liveState.rev = data.rev || liveState.rev;
          onMessage({ type: 'live-state', rev: data.rev, state: data.state, host: data.host });
        }
      } catch (error) {
        liveState.polling = false;
        if (error && (error.status === 404 || /tidak ditemukan/i.test(error.message || ''))) {
          unsubscribeLive();
          onMessage({ type: 'live-closed' });
          return;
        }
      }
      liveState.polling = false;
    }, 1500);
  }

  function unsubscribeLive() {
    liveState.pin = '';
    liveState.rev = 0;
    window.clearInterval(liveFallbackTimer);
    liveFallbackTimer = null;
  }

  function sendLiveAnswer(payload) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'live-answer', token, ...payload }));
      return;
    }
    request('/api/live/answer', { method: 'POST', body: { ...payload } }).catch(() => {});
  }

  /* ---------------- API publik ---------------- */

  Neko.api = {
    request, probe, setToken,
    get token() { return token; },
    get online() { return online; },
    lastSyncAt: 0,
    login, register, restoreSession, logout,
    scheduleSync, flushSync,
    startEvents, stopEvents,
    subscribeLive, unsubscribeLive, sendLiveAnswer,
    live: {
      create(options) { return request('/api/live/create', { method: 'POST', body: options }); },
      join(pin, name, character) { return request('/api/live/join', { method: 'POST', body: { pin, name, character } }); },
      setCharacter(pin, character, joinedKey) { return request('/api/live/character', { method: 'POST', body: { pin, character, joinedKey } }); },
      host(pin, action, extra = {}) { return request('/api/live/host', { method: 'POST', body: { pin, action, ...extra } }); },
      answer(pin, choice, timeMs, joinedKey) {
        return request('/api/live/answer', { method: 'POST', body: { pin, choice, timeMs, joinedKey } });
      },
      state(pin) { return request('/api/live/state?pin=' + encodeURIComponent(pin)); }
    },
    users: {
      search(q) { return request('/api/users/search?q=' + encodeURIComponent(q || '')); }
    },
    friends: {
      list() { return request('/api/friends'); },
      request(username) { return request('/api/friends/request', { method: 'POST', body: { username } }); },
      accept(username) { return request('/api/friends/accept', { method: 'POST', body: { username } }); },
      decline(username) { return request('/api/friends/decline', { method: 'POST', body: { username } }); },
      remove(username) { return request('/api/friends/remove', { method: 'POST', body: { username } }); }
    },
    chats: {
      list() { return request('/api/chats'); },
      messages(withUser) { return request('/api/messages?with=' + encodeURIComponent(withUser)); },
      send(to, text) { return request('/api/messages/send', { method: 'POST', body: { to, text } }); },
      read(withUser) { return request('/api/messages/read', { method: 'POST', body: { with: withUser } }); }
    }
  };
})();
