/* ============================================================
   NEKO · js/friends.js
   View "Pesan": cari akun, kirim permintaan berteman, dan
   chatting lintas perangkat lewat server. Modul ini juga menjadi
   dispatcher event realtime (pesan masuk, teman, XP live).
   ============================================================ */
(function () {
  'use strict';

  const Neko = window.Neko = window.Neko || {};
  const { esc, timeAgo, initials } = Neko.util;
  const { icon } = Neko.icons;

  const state = {
    tab: 'chats',
    query: '',
    peer: '',
    loading: false,
    chats: null,
    friends: null,
    search: null,
    thread: null,
    threadPeer: null,
    typingPeer: false,
    typingTimer: null
  };

  let boundRoot = null;
  let searchDebounce = null;

  function enabled() {
    return Boolean(Neko.api && Neko.api.token) && location.protocol !== 'file:';
  }

  /* ---------------- Render ---------------- */

  function render() {
    if (!enabled()) {
      return (
        '<section class="msg-offline">' +
        '<span class="msg-offline-ic">' + icon('wifi-off') + '</span>' +
        '<h2>Pesan butuh server NEKO</h2>' +
        '<p>Cari teman, add friend, dan chatting baru aktif saat aplikasi dibuka dari server. Jalankan <b>Mulai-NEKO.bat</b>, lalu buka alamat server di setiap perangkat.</p>' +
        '<div class="msg-offline-tip">' + icon('info') + '<span>Semua riwayat pesan tersimpan di server, jadi chat tetap ada saat pindah perangkat.</span></div>' +
        '</section>'
      );
    }
    return (
      '<section class="msg-view" data-thread-open="' + (state.peer && state.tab === 'chats' ? '1' : '0') + '">' +
      '<header class="msg-head">' +
      '<div><span class="kicker">KOMUNITAS NEKO</span><h1>Pesan &amp; Teman</h1>' +
      '<p>Cari akun lain, berteman, lalu ngobrol real-time dari perangkat mana pun.</p></div>' +
      '<div class="msg-head-actions">' +
      '<div class="msg-search">' + icon('search') + '<input id="msgSearch" type="search" placeholder="Cari username atau nama…" value="' + esc(state.query) + '" autocomplete="off"></div>' +
      '<button type="button" class="btn btn-soft btn-sm" data-msg-refresh>' + icon('restart') + 'Muat ulang</button>' +
      '</div></header>' +
      '<nav class="msg-tabs" role="tablist">' +
      msgTab('chats', 'Pesan', 'chat') +
      msgTab('friends', 'Teman', 'users') +
      msgTab('requests', 'Permintaan', 'bell') +
      msgTab('find', 'Cari akun', 'search') +
      '</nav>' +
      '<div class="msg-body" id="msgBody">' + panelHTML() + '</div>' +
      '</section>'
    );
  }

  function msgTab(id, label, ic) {
    const n = id === 'chats' ? totalUnread() : id === 'requests' ? incomingCount() : 0;
    return (
      '<button type="button" role="tab" class="msg-tab ' + (state.tab === id ? 'on' : '') + '" data-msg-tab="' + id + '" aria-selected="' + String(state.tab === id) + '">' +
      icon(ic) + '<span>' + label + '</span>' + (n ? '<i class="msg-tab-n">' + n + '</i>' : '') + '</button>'
    );
  }

  function totalUnread() {
    return state.chats ? state.chats.totalUnread || 0 : 0;
  }

  function incomingCount() {
    return state.friends && state.friends.incoming ? state.friends.incoming.length : 0;
  }

  function panelHTML() {
    if (state.loading) return '<div class="msg-loading">' + icon('restart') + '<span>Mengambil data dari server…</span></div>';
    if (state.tab === 'chats') return chatsHTML();
    if (state.tab === 'friends') return friendsHTML();
    if (state.tab === 'requests') return requestsHTML();
    return searchHTML();
  }

  function chatsHTML() {
    const list = state.chats ? state.chats.conversations : [];
    const peers = list.filter(item => item.lastAt > 0);
    const idle = list.filter(item => !item.lastAt);
    const rows = peers.concat(idle);
    if (!rows.length) {
      return emptyState('users', 'Belum ada percakapan', 'Cari akun temanmu di tab "Cari akun", kirim permintaan berteman, lalu mulai ngobrol di sini.');
    }
    return (
      '<div class="msg-split">' +
      '<div class="msg-list">' + rows.map(convoRow).join('') + '</div>' +
      '<div class="msg-thread" id="msgThread">' + (state.peer ? threadHTML() : threadPlaceholder()) + '</div>' +
      '</div>'
    );
  }

  function convoRow(item) {
    const active = state.peer && normalize(item.username) === normalize(state.peer);
    const preview = item.lastText ? (normalize(item.lastFrom) === normalize(selfName()) ? 'Kamu: ' : '') + item.lastText : 'Belum ada pesan';
    return (
      '<button type="button" class="msg-convo ' + (active ? 'on' : '') + '" data-msg-peer="' + esc(item.username) + '">' +
      '<span class="msg-avatar">' + esc(initials(item.displayName)) + (item.unread ? '<i class="msg-dot"></i>' : '') + '</span>' +
      '<span class="msg-convo-copy"><b>' + esc(item.displayName) + '</b>' +
      '<small>' + esc(preview) + '</small></span>' +
      '<span class="msg-convo-time">' + (item.lastAt ? timeAgo(item.lastAt) : '') + (item.unread ? '<i class="msg-pill">' + item.unread + '</i>' : '') + '</span>' +
      '</button>'
    );
  }

  function threadPlaceholder() {
    return (
      '<div class="msg-thread-empty">' + Neko.mascot.svg('miki', 'happy') +
      '<p>Pilih percakapan di sebelah untuk mulai membaca dan membalas.</p></div>'
    );
  }

  function threadHTML() {
    if (!state.thread) {
      return '<div class="msg-loading">' + icon('restart') + '<span>Membuka percakapan…</span></div>';
    }
    const messages = state.thread.messages || [];
    return (
      '<header class="msg-thread-head">' +
      '<button type="button" class="btn btn-ghost btn-sm msg-back" data-msg-back>' + icon('arrow-left') + '</button>' +
      '<span class="msg-avatar">' + esc(initials(threadName())) + '</span>' +
      '<div class="msg-thread-id"><b>' + esc(threadName()) + '</b><small>@' + esc(state.peer) + (state.typingPeer ? ' · sedang menulis…' : '') + '</small></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-msg-unfriend title="Hapus teman">' + icon('close') + '</button>' +
      '</header>' +
      '<div class="msg-bubbles" id="msgBubbles">' + (messages.length ? messages.map(bubbleHTML).join('') : '<div class="msg-bubbles-empty">Belum ada pesan. Kirim yang pertama!</div>') + '</div>' +
      '<form class="msg-composer" id="msgComposer">' +
      '<input id="msgText" type="text" maxlength="500" placeholder="Tulis pesan…" autocomplete="off">' +
      '<button type="submit" class="btn btn-primary btn-sm" data-msg-send>' + icon('send') + 'Kirim</button>' +
      '</form>'
    );
  }

  function threadName() {
    if (state.thread && state.thread.peer) return state.thread.peer.displayName;
    const found = state.chats && state.chats.conversations.find(item => normalize(item.username) === normalize(state.peer));
    return found ? found.displayName : state.peer;
  }

  function bubbleHTML(item) {
    const mine = item.from === normalize(selfName());
    return (
      '<div class="msg-bubble ' + (mine ? 'me' : 'them') + '">' +
      '<span class="msg-bubble-text">' + esc(item.text) + '</span>' +
      '<span class="msg-bubble-meta">' + timeAgo(item.at) + (mine ? (item.read ? ' · dibaca' : ' · terkirim') : '') + '</span>' +
      '</div>'
    );
  }

  function friendsHTML() {
    const list = state.friends && state.friends.friends ? state.friends.friends : [];
    const outgoing = state.friends && state.friends.outgoing ? state.friends.outgoing : [];
    if (!list.length && !outgoing.length) {
      return emptyState('users', 'Daftar teman masih kosong', 'Begitu permintaanmu diterima, nama mereka muncul di sini lengkap dengan level XP-nya.');
    }
    return (
      '<div class="msg-friends">' +
      list.map(friendRow).join('') +
      (outgoing.length ? '<div class="msg-outgoing"><span class="setup-label">Permintaan terkirim</span><div class="msg-out-row">' + outgoing.map(item => '<span class="msg-out-chip">' + esc(item.displayName) + '</span>').join('') + '</div></div>' : '') +
      '</div>'
    );
  }

  function friendRow(item) {
    return (
      '<div class="msg-friend-card">' +
      '<span class="msg-avatar lg">' + esc(initials(item.displayName)) + '</span>' +
      '<div class="msg-friend-copy"><b>' + esc(item.displayName) + '</b><small>@' + esc(item.username) + ' · ' + esc(item.role || 'Member') + '</small>' +
      '<span class="msg-friend-xp">' + icon('xp') + (item.xp || 0) + ' XP · ' + esc(item.title || '') + '</span></div>' +
      '<div class="msg-friend-actions">' +
      '<button type="button" class="btn btn-soft btn-sm" data-msg-peer="' + esc(item.username) + '" data-msg-open>' + icon('chat') + 'Chat</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-msg-remove="' + esc(item.username) + '" title="Hapus teman">' + icon('close') + '</button>' +
      '</div></div>'
    );
  }

  function requestsHTML() {
    const incoming = state.friends && state.friends.incoming ? state.friends.incoming : [];
    if (!incoming.length) {
      return emptyState('bell', 'Tidak ada permintaan masuk', 'Permintaan berteman dari akun lain akan muncul di sini beserta tombol Terima / Tolak.');
    }
    return (
      '<div class="msg-requests">' + incoming.map(item => (
        '<div class="msg-request-card">' +
        '<span class="msg-avatar lg">' + esc(initials(item.displayName)) + '</span>' +
        '<div class="msg-friend-copy"><b>' + esc(item.displayName) + '</b><small>@' + esc(item.username) + ' · ' + (item.xp || 0) + ' XP</small></div>' +
        '<div class="msg-friend-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-msg-accept="' + esc(item.username) + '">' + icon('check') + 'Terima</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-msg-decline="' + esc(item.username) + '">' + icon('close') + 'Tolak</button>' +
        '</div></div>'
      )).join('') + '</div>'
    );
  }

  function searchHTML() {
    if (state.search === null) {
      return emptyState('search', 'Mulai cari akun', 'Ketik nama atau username di kolom pencarian. Hasil datang langsung dari server.');
    }
    if (!state.search.length) {
      return emptyState('spy', 'Tidak ada akun ditemukan', 'Coba kata kunci lain, atau minta teman mendaftar lewat tab Daftar di halaman masuk.');
    }
    return (
      '<div class="msg-results">' + state.search.map(resultRow).join('') + '</div>'
    );
  }

  function resultRow(item) {
    let action;
    if (item.isFriend) action = '<button type="button" class="btn btn-soft btn-sm" data-msg-peer="' + esc(item.username) + '" data-msg-open>' + icon('chat') + 'Chat</button>';
    else if (item.incoming) action = '<button type="button" class="btn btn-primary btn-sm" data-msg-accept="' + esc(item.username) + '">' + icon('check') + 'Terima</button>';
    else if (item.outgoing) action = '<span class="msg-state-chip pending">' + icon('clock') + 'Terkirim</span>';
    else action = '<button type="button" class="btn btn-primary btn-sm" data-msg-add="' + esc(item.username) + '">' + icon('user-plus') + 'Add</button>';
    return (
      '<div class="msg-friend-card">' +
      '<span class="msg-avatar lg">' + esc(initials(item.displayName)) + '</span>' +
      '<div class="msg-friend-copy"><b>' + esc(item.displayName) + '</b><small>@' + esc(item.username) + ' · ' + esc(item.role || 'Member') + '</small>' +
      '<span class="msg-friend-xp">' + icon('xp') + (item.xp || 0) + ' XP</span></div>' +
      '<div class="msg-friend-actions">' + action + '</div>' +
      '</div>'
    );
  }

  function emptyState(ic, title, sub) {
    return (
      '<div class="msg-empty">' +
      '<span class="msg-empty-ic">' + icon(ic) + '</span>' +
      '<h3>' + esc(title) + '</h3><p>' + esc(sub) + '</p>' +
      '</div>'
    );
  }

  /* ---------------- Data ---------------- */

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function selfName() {
    return Neko.store.session ? Neko.store.session.username : '';
  }

  async function loadShell(force) {
    if (!enabled()) return;
    if (force) state.loading = true;
    paintBody();
    try {
      const [chats, friends] = await Promise.all([Neko.api.chats.list(), Neko.api.friends.list()]);
      state.chats = chats;
      state.friends = friends;
    } catch (error) {
      state.chats = state.chats || { conversations: [], totalUnread: 0 };
      state.friends = state.friends || { friends: [], incoming: [], outgoing: [] };
      if (error.status === 401) return;
    } finally {
      state.loading = false;
    }
    paintTabs();
    paintBody();
    if (state.peer && state.tab === 'chats') loadThread(state.peer);
  }

  async function loadThread(peer) {
    state.peer = peer;
    state.thread = null;
    paintBody();
    try {
      state.thread = await Neko.api.chats.messages(peer);
      await Neko.api.chats.read(peer).catch(() => {});
      if (state.chats) {
        state.chats.conversations.forEach(item => {
          if (normalize(item.username) === normalize(peer)) item.unread = 0;
        });
        state.chats.totalUnread = state.chats.conversations.reduce((sum, item) => sum + (item.unread || 0), 0);
      }
    } catch (error) {
      state.thread = { messages: [], peer: null, error: error.message };
    }
    paintBody();
    scrollBubbles();
  }

  async function runSearch() {
    if (!enabled()) return;
    try {
      const data = await Neko.api.users.search(state.query);
      state.search = data.users || [];
    } catch (error) {
      state.search = [];
    }
    paintBody();
  }

  async function mutate(promise, successText, reload) {
    try {
      await promise;
      if (successText) Neko.ui.toast('Berhasil', successText, 'success', 'check');
      Neko.audio.play('success');
      if (reload !== false) await loadShell(false);
    } catch (error) {
      Neko.audio.play('error');
      Neko.ui.toast('Gagal', error.message || 'Coba lagi sebentar lagi.', 'error', 'warning');
    }
  }

  /* ---------------- Bind ---------------- */

  function bind(root) {
    boundRoot = root;
    if (!enabled()) return;
    loadShell(true);

    root.addEventListener('click', event => {
      const tab = event.target.closest('[data-msg-tab]');
      if (tab) {
        state.tab = tab.dataset.msgTab;
        Neko.audio.play('select');
        if (state.tab === 'find' && state.query && state.search === null) runSearch();
        paintTabs();
        paintBody();
        return;
      }
      const refresh = event.target.closest('[data-msg-refresh]');
      if (refresh) { Neko.audio.play('tap'); loadShell(true); return; }

      const openPeer = event.target.closest('[data-msg-peer]');
      if (openPeer) {
        Neko.audio.play('select');
        state.tab = 'chats';
        paintTabs();
        loadThread(openPeer.dataset.msgPeer);
        return;
      }
      if (event.target.closest('[data-msg-back]')) {
        state.peer = '';
        state.thread = null;
        paintBody();
        return;
      }
      const add = event.target.closest('[data-msg-add]');
      if (add) { mutate(Neko.api.friends.request(add.dataset.msgAdd), 'Permintaan teman terkirim ke @' + add.dataset.msgAdd + '.'); return; }
      const accept = event.target.closest('[data-msg-accept]');
      if (accept) { mutate(Neko.api.friends.accept(accept.dataset.msgAccept), 'Sekarang berteman. Silakan chat!'); return; }
      const decline = event.target.closest('[data-msg-decline]');
      if (decline) { mutate(Neko.api.friends.decline(decline.dataset.msgDecline), 'Permintaan ditolak.'); return; }
      const remove = event.target.closest('[data-msg-remove]') || event.target.closest('[data-msg-unfriend]');
      if (remove) {
        const who = remove.dataset.msgRemove || state.peer;
        state.peer = '';
        state.thread = null;
        mutate(Neko.api.friends.remove(who), 'Teman dihapus dari daftar.');
        return;
      }
    });

    root.addEventListener('submit', event => {
      if (!event.target.matches('#msgComposer')) return;
      event.preventDefault();
      const input = root.querySelector('#msgText');
      const text = input ? input.value.trim() : '';
      if (!text || !state.peer) return;
      const sendBtn = root.querySelector('[data-msg-send]');
      if (sendBtn) sendBtn.disabled = true;
      optimisticPush(text);
      if (input) input.value = '';
      Neko.api.chats.send(state.peer, text).then(() => {
        if (state.chats) {
          const convo = state.chats.conversations.find(item => normalize(item.username) === normalize(state.peer));
          if (convo) { convo.lastText = text; convo.lastFrom = normalize(selfName()); convo.lastAt = Date.now(); }
        }
        if (state.thread && state.thread.messages) state.thread.messages.forEach(item => { if (item.from === normalize(selfName())) item.read = true; });
        paintBubbles();
      }).catch(error => {
        dropOptimistic(text);
        Neko.ui.toast('Pesan gagal terkirim', error.message || 'Coba lagi.', 'error', 'warning');
        Neko.audio.play('error');
      }).finally(() => {
        if (sendBtn) sendBtn.disabled = false;
        const again = root.querySelector('#msgText');
        if (again) again.focus();
      });
      Neko.audio.play('select');
    });

    root.addEventListener('input', event => {
      if (event.target.id !== 'msgSearch') return;
      state.query = event.target.value.trim();
      window.clearTimeout(searchDebounce);
      if (state.query.length && state.query.length < 3) return;
      searchDebounce = window.setTimeout(() => {
        if (!state.query) { state.search = []; paintBody(); return; }
        state.tab = 'find';
        paintTabs();
        paintBody('<div class="msg-loading">' + icon('restart') + '<span>Mencari akun…</span></div>');
        runSearch();
      }, 420);
    });

    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && state.peer && boundRoot && boundRoot.contains(event.target)) {
        state.peer = '';
        state.thread = null;
        paintBody();
      }
    });

    window.clearInterval(state.pollTimer);
    state.pollTimer = window.setInterval(() => {
      if (document.hidden || !state.chats) return;
      if (currentVisible() !== 'messages') return;
      loadShell(false);
    }, 20000);
  }

  function currentVisible() {
    return Neko.app ? Neko.app.currentView : null;
  }

  function optimisticPush(text) {
    const message = { id: 'tmp_' + Date.now(), from: normalize(selfName()), to: normalize(state.peer), text, at: Date.now(), read: false, pending: true };
    if (!state.thread) state.thread = { messages: [], peer: null };
    if (!state.thread.messages) state.thread.messages = [];
    state.thread.messages.push(message);
    paintBubbles();
    scrollBubbles();
  }

  function dropOptimistic(text) {
    if (!state.thread || !state.thread.messages) return;
    const index = state.thread.messages.map(item => item.text).lastIndexOf(text);
    if (index >= 0) state.thread.messages.splice(index, 1);
    paintBubbles();
  }

  /* ---------------- Lukis ulang sebagian ---------------- */

  function bodyEl() {
    return boundRoot ? boundRoot.querySelector('#msgBody') : null;
  }

  function paintBody(replacement) {
    const body = bodyEl();
    if (!body) return;
    const view = boundRoot.querySelector('.msg-view');
    if (view) view.dataset.threadOpen = state.peer && state.tab === 'chats' ? '1' : '0';
    body.innerHTML = replacement || panelHTML();
    if (!replacement) scrollBubbles();
  }

  function paintTabs() {
    if (!boundRoot) return;
    boundRoot.querySelectorAll('[data-msg-tab]').forEach(tab => {
      const on = tab.dataset.msgTab === state.tab;
      tab.classList.toggle('on', on);
      tab.setAttribute('aria-selected', String(on));
      const id = tab.dataset.msgTab;
      const n = id === 'chats' ? totalUnread() : id === 'requests' ? incomingCount() : 0;
      let badge = tab.querySelector('.msg-tab-n');
      if (n) {
        if (!badge) {
          badge = document.createElement('i');
          badge.className = 'msg-tab-n';
          tab.appendChild(badge);
        }
        badge.textContent = String(n);
      } else if (badge) badge.remove();
    });
  }

  function paintBubbles() {
    const box = boundRoot ? boundRoot.querySelector('#msgBubbles') : null;
    if (!box || !state.thread || !state.thread.messages) return;
    box.innerHTML = state.thread.messages.length
      ? state.thread.messages.map(bubbleHTML).join('')
      : '<div class="msg-bubbles-empty">Belum ada pesan. Kirim yang pertama!</div>';
  }

  function scrollBubbles() {
    const box = boundRoot ? boundRoot.querySelector('#msgBubbles') : null;
    if (box) box.scrollTop = box.scrollHeight;
  }

  /* ---------------- Dispatcher realtime ---------------- */

  function showInThisView() {
    return Boolean(boundRoot && boundRoot.isConnected);
  }

  document.addEventListener('neko:event', event => {
    const item = event.detail || {};
    const data = item.data || item.payload || {};
    if (item.type === 'message') {
      if (showInThisView()) {
        if (state.peer && normalize(data.from) === normalize(state.peer) && state.thread && state.thread.messages) {
          state.thread.messages.push({ from: data.from, to: normalize(selfName()), text: data.text, at: data.at || Date.now(), read: true });
          paintBubbles();
          scrollBubbles();
          Neko.api.chats.read(state.peer).catch(() => {});
          return;
        }
        loadShell(false);
      } else if (state.chats) {
        loadShell(false);
      }
      Neko.store.addNotification('Pesan dari ' + (data.displayName || data.from), String(data.text || '').slice(0, 90), 'message');
      if (!showInThisView()) Neko.ui.toast('Pesan baru', (data.displayName || data.from) + ': ' + String(data.text || '').slice(0, 60), 'info', 'chat');
      Neko.audio.play('notify');
      return;
    }
    if (item.type === 'friend-request') {
      Neko.store.addNotification('Permintaan teman', (data.displayName || data.from) + ' ingin berteman denganmu.', 'friend');
      Neko.ui.toast('Permintaan teman baru', (data.displayName || data.from) + ' (@' + data.from + ') mengirim permintaan.', 'info', 'users');
      Neko.audio.play('notify');
      if (showInThisView()) loadShell(false);
      return;
    }
    if (item.type === 'friend-accepted') {
      Neko.store.addNotification('Teman baru', (data.displayName || data.from) + ' menerima permintaanmu.', 'friend');
      Neko.ui.toast('Teman baru!', (data.displayName || data.from) + ' sekarang ada di daftar teman.', 'success', 'check');
      if (showInThisView()) loadShell(false);
      return;
    }
    if (item.type === 'live-xp') {
      refreshAfterLiveXP(data);
      return;
    }
  });

  async function refreshAfterLiveXP(data) {
    const gained = Number(data.xp || data.amount || 0);
    if (gained) Neko.ui.toast('XP Kelas Langsung', '+' + gained + ' XP masuk ke akunmu.', 'success', 'xp');
    try {
      const fresh = await Neko.api.restoreSession();
      if (fresh) Neko.store.hydrate(fresh);
    } catch (error) { /* tetap pakai XP lokal */ }
    if (Neko.app && Neko.app.refresh) Neko.app.refresh();
  }

  document.addEventListener('neko:logout', () => {
    window.clearInterval(state.pollTimer);
    state.chats = null;
    state.friends = null;
    state.search = null;
    state.thread = null;
    state.peer = '';
    state.query = '';
    state.tab = 'chats';
    boundRoot = null;
  });

  Neko.friends = {
    render,
    bind,
    get unread() { return totalUnread(); },
    refresh() { if (showInThisView()) loadShell(false); }
  };
})();
