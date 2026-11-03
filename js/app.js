/* ============================================================
   NEKO · js/app.js
   Kerangka aplikasi: boot loader, shell tema, navigasi hash,
   dan pemasangan setiap layar.
   ============================================================ */
(function () {
  'use strict';

  const Neko = window.Neko = window.Neko || {};
  const { esc, formatNumber } = Neko.util;
  const { icon } = Neko.icons;

  const views = {
    home: { label: 'Beranda', short: 'Awal', icon: 'home', render: () => Neko.home.render(), bind: (root) => Neko.home.bind(root) },
    materials: { label: 'Perpustakaan', short: 'Buku', icon: 'books', render: () => Neko.book.render(), bind: (root) => Neko.book.bind(root) },
    arena: { label: 'Arena', short: 'Arena', icon: 'gamepad', render: () => Neko.arena.render(), bind: (root) => Neko.arena.bind(root) },
    messages: { label: 'Pesan', short: 'Pesan', icon: 'chat', render: () => Neko.friends.render(), bind: (root) => Neko.friends.bind(root) },
    kontak: { label: 'Kontak', short: 'Kontak', icon: 'school', render: () => Neko.contact.render(), bind: (root) => Neko.contact.bind(root) },
    profile: { label: 'Profil', short: 'Profil', icon: 'profile', render: () => Neko.profile.render(), bind: (root) => Neko.profile.bind(root) },
    admin: { label: 'Admin', short: 'Admin', icon: 'shield', render: () => Neko.admin.render(), bind: (root) => Neko.admin.bind(root) }
  };

  const ids = Object.keys(views);
  const app = document.getElementById('app');
  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');
  const dock = document.getElementById('dock');
  const viewRoot = document.getElementById('view');
  const loader = document.getElementById('loader');
  const loaderBar = document.getElementById('loaderBar');
  const loaderStatus = document.getElementById('loaderStatus');

  let current = 'home';
  let started = false;
  let bound = false;

  function canManage() {
    return Boolean(Neko.admin && Neko.admin.canManage());
  }

  function navIds() {
    return canManage() ? ids : ids.filter(id => id !== 'admin');
  }

  function valid(view) {
    return ids.includes(view) && (view !== 'admin' || canManage());
  }

  function applySidebar() {
    const collapsed = Boolean(Neko.store.prefs.sidebarCollapsed);
    document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'open';
  }

  function viewFromLocation() {
    const hash = String(location.hash || '').replace(/^#/, '').toLowerCase();
    return valid(hash) ? hash : null;
  }

  /* ---------------- Loader ---------------- */

  function bootLoader() {
    const stages = [
      'Menyiapkan dunia NEKO…',
      'Memuat buku materi TJKT…',
      'Menyalakan arena game…',
      'Membangunkan Miki, Miko & Neksya…',
      'Menyiapkan tema dan suara…'
    ];
    let progress = 0;
    let stage = 0;
    if (loaderStatus) loaderStatus.textContent = stages[0];
    const timer = window.setInterval(() => {
      progress = Math.min(92, progress + 4 + Math.random() * 7);
      if (loaderBar) loaderBar.style.width = progress + '%';
      const nextStage = Math.min(stages.length - 1, Math.floor(progress / 20));
      if (nextStage !== stage && loaderStatus) {
        stage = nextStage;
        loaderStatus.textContent = stages[stage];
      }
    }, 190);

    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    const minimum = new Promise(resolve => window.setTimeout(resolve, 1450));
    Promise.all([fonts, minimum]).then(async () => {
      window.clearInterval(timer);
      if (loaderStatus) loaderStatus.textContent = Neko.store.session ? 'Menyinkronkan akun dari server…' : 'Siap. Selamat belajar!';
      if (Neko.store.session && Neko.store.session.token && location.protocol !== 'file:') {
        const fresh = await Neko.api.restoreSession();
        if (fresh) Neko.store.hydrate(fresh);
      }
      if (loaderBar) loaderBar.style.width = '100%';
      if (loaderStatus) loaderStatus.textContent = 'Siap. Selamat belajar!';
      window.setTimeout(() => {
        if (Neko.store.session) start({ intro: false });
        else Neko.auth.show();
        if (loader) {
          loader.classList.add('is-done');
          window.setTimeout(() => { if (loader.isConnected) loader.remove(); }, 900);
        }
      }, 320);
    });
  }

  /* ---------------- Shell ---------------- */

  function shellHTML() {
    const profile = Neko.store.profile;
    const snap = Neko.seasons.seasonForXP(profile?.xp || 0);
    const session = Neko.store.session || { displayName: 'Siswa', role: 'Member' };
    const unread = Neko.store.unreadCount();
    const range = formatNumber(profile?.xp || 0) + ' XP';

    if (sidebar) {
      sidebar.innerHTML =
        '<div class="side-brand"><span class="side-brand-mark"><span class="logo-mask"></span></span>' +
        '<span class="side-brand-name"><b>NEKO</b><small>Belajar TJKT</small></span>' +
        '<button type="button" class="side-collapse" data-sidebar-toggle aria-label="' + (Neko.store.prefs.sidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar') + '" aria-pressed="' + String(Neko.store.prefs.sidebarCollapsed) + '">' + icon('sidebar') + '</button></div>' +
        '<nav class="side-nav">' + navIds().map(id => (
          '<button type="button" class="side-link ' + (id === current ? 'on' : '') + '" data-nav="' + id + '" title="' + views[id].label + '">' + icon(views[id].icon) + '<span>' + views[id].label + '</span></button>'
        )).join('') + '</nav>' +
        '<div class="side-season">' +
        '<span class="kicker">SEASON ' + snap.season.id + ' · ' + esc(snap.season.short).toUpperCase() + '</span>' +
        '<b>' + esc(snap.season.title) + '</b>' +
        '<p>' + (snap.next ? formatNumber(snap.xpToNext) + ' XP lagi menuju ' + esc(snap.next.short) : 'Kamu sudah di puncak Legenda') + '</p>' +
        '<div class="progress thin" style="margin-top:9px"><span style="width:' + snap.progress.toFixed(1) + '%"></span></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" style="margin-top:9px;width:100%" data-season="' + snap.season.id + '">' + icon('info') + 'Detail season</button>' +
        '</div>' +
        '<div class="side-foot">NEKO · Kelompok 1</div>';
    }

    if (topbar) {
      topbar.innerHTML =
        '<div class="topbar-inner">' +
        '<div class="top-brand"><span class="top-brand-mark"><span class="logo-mask"></span></span>' +
        '<span class="top-brand-copy"><b>NEKO</b><small>TJKT · Kelompok 1</small></span></div>' +
        '<div class="top-xp" id="topXp">' +
        '<div class="top-xp-line"><b>' + esc(snap.season.title) + '</b><span>' + range + '</span></div>' +
        '<div class="progress"><span style="width:' + snap.progress.toFixed(1) + '%"></span></div>' +
        '</div>' +
        '<div class="top-actions">' +
        '<button type="button" class="top-action" data-notifications aria-label="Notifikasi">' + icon('bell') + (unread ? '<span class="badge-dot"></span>' : '') + '</button>' +
        '<button type="button" class="top-action" data-open-leaderboard aria-label="Leaderboard">' + icon('ranking') + '</button>' +
        '<button type="button" class="top-action" data-top-audio aria-label="Suara"></button>' +
        '<button type="button" class="top-action top-hide-mobile" data-top-music aria-label="Musik">' + icon('music') + '</button>' +
        '<button type="button" class="top-action top-hide-xs" data-open-theme aria-label="Ganti tema">' + icon('palette') + '</button>' +
        '<button type="button" class="top-user" data-nav="profile" aria-label="Buka profil">' +
        '<span class="top-user-avatar">' + esc(Neko.util.initials(session.displayName)) + '</span>' +
        '<span class="top-user-name">' + esc(session.displayName) + '</span>' +
        '</button>' +
        '</div></div>';
    }

    if (dock) {
      const list = navIds();
      dock.style.setProperty('--dock-cols', list.length);
      dock.innerHTML = list.map(id => (
        '<button type="button" class="dock-btn ' + (id === current ? 'on' : '') + '" data-nav="' + id + '" aria-label="' + views[id].label + '">' +
        '<span class="dock-ic">' + icon(views[id].icon) + '</span>' +
        '<span class="dock-label">' + views[id].label + '</span>' +
        '<span class="dock-label is-short">' + (views[id].short || views[id].label) + '</span></button>'
      )).join('');
    }

    if (Neko.ui) Neko.ui.refreshAudioButtons();
  }

  function bindShell() {
    if (bound) return;
    bound = true;

    if (sidebar) {
      sidebar.addEventListener('click', event => {
        const nav = event.target.closest('[data-nav]');
        if (nav) { Neko.audio.play('select'); go(nav.dataset.nav); return; }
        if (event.target.closest('[data-sidebar-toggle]')) {
          const next = !Neko.store.prefs.sidebarCollapsed;
          Neko.store.patchPrefs({ sidebarCollapsed: next });
          applySidebar();
          shellHTML();
          Neko.audio.play('toggle');
          Neko.ui.toast(next ? 'Sidebar disembunyikan' : 'Sidebar dibuka', next ? 'Layar lebih lega. Tekan ikon lagi untuk membuka.' : 'Navigasi lengkap kembali tampil.', 'info', 'sidebar');
          return;
        }
        const season = event.target.closest('[data-season]');
        if (season) { Neko.home.seasonSheet(season.dataset.season); }
      });
    }

    document.addEventListener('click', event => {
      if (event.target.closest('[data-open-leaderboard]') && !event.target.closest('#topbar')) {
        Neko.audio.play('select');
        Neko.ui.leaderboardSheet();
        return;
      }
      const goButton = event.target.closest('[data-go]');
      if (goButton && !goButton.closest('[data-nav]')) {
        const target = goButton.dataset.go;
        if (valid(target)) {
          Neko.audio.play('select');
          Neko.ui.closeTop();
          window.setTimeout(() => go(target), 140);
        }
      }
    });

    if (topbar) {
      topbar.addEventListener('click', event => {
        if (event.target.closest('[data-notifications]')) { Neko.audio.play('select'); Neko.ui.notificationsSheet(); return; }
        if (event.target.closest('[data-open-leaderboard]')) { Neko.audio.play('select'); Neko.ui.leaderboardSheet(); return; }
        if (event.target.closest('[data-top-audio]')) { Neko.audio.setSound(!Neko.audio.soundOn); return; }
        if (event.target.closest('[data-top-music]')) { Neko.audio.setMusic(!Neko.audio.musicOn); return; }
        if (event.target.closest('[data-open-theme]')) { Neko.audio.play('select'); Neko.ui.themeSheet(); return; }
        const nav = event.target.closest('[data-nav]');
        if (nav) { Neko.audio.play('select'); go(nav.dataset.nav); }
      });
    }

    if (dock) {
      dock.addEventListener('click', event => {
        const nav = event.target.closest('[data-nav]');
        if (!nav) return;
        Neko.audio.play('select');
        go(nav.dataset.nav);
      });
    }

    document.addEventListener('neko:xp', () => { if (started) shellHTML(); });
    document.addEventListener('neko:profile', () => { if (started) shellHTML(); });
    document.addEventListener('neko:notifications', () => { if (started) shellHTML(); });
    document.addEventListener('neko:community', () => { if (started) shellHTML(); });

    window.addEventListener('popstate', route);
    window.addEventListener('hashchange', route);
  }

  function route() {
    if (!started) return;
    const target = viewFromLocation();
    if (!target || target === current) return;
    current = target;
    render();
  }

  /* ---------------- Render ---------------- */

  function render() {
    if (!started) return;
    const info = views[current] || views.home;
    shellHTML();
    if (!viewRoot) return;
    let html = '';
    try {
      html = info.render();
    } catch (error) {
      html = '<div class="empty-state"><span class="empty-ic">' + icon('warning') + '</span><h3>Layar gagal dimuat</h3><p>' + esc(error.message) + '</p></div>';
    }
    viewRoot.innerHTML = '<div class="view on" data-view="' + current + '">' + html + '</div>';
    const node = viewRoot.firstElementChild;
    try {
      info.bind(node);
    } catch (error) {
      /* biarkan layar tetap tampil walau pengikatan gagal */
    }
    document.title = 'NEKO · ' + info.label;
    if (Neko.fx) Neko.fx.unlock();
    document.dispatchEvent(new CustomEvent('neko:view', { detail: { view: current } }));
  }

  function refresh() {
    if (!started) return;
    render();
  }

  function refreshTheme() {
    if (!started) return;
    render();
  }

  function go(view, options = {}) {
    if (!valid(view)) return false;
    if (!Neko.store.profile) return false;
    if (view === current && !options.force) {
      window.scrollTo({ top: 0, behavior: Neko.util.reducedMotion() ? 'auto' : 'smooth' });
      return true;
    }
    current = view;
    Neko.store.patchPrefs({ lastView: view });
    if (location.hash !== '#' + view) {
      try { history.pushState({ view }, '', '#' + view); } catch (error) { location.hash = view; }
    }
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
    return true;
  }

  function start(options = {}) {
    if (!app) return;
    const profile = Neko.store.profile;
    if (!profile) { Neko.auth.show(); return; }
    started = true;
    app.hidden = false;
    Neko.auth.hide();
    applySidebar();
    Neko.theme.applyDom(Neko.store.prefs);
    Neko.scenes.render(Neko.store.prefs.theme, Neko.store.prefs.mode);
    current = viewFromLocation() || (valid(Neko.store.prefs.lastView) ? Neko.store.prefs.lastView : 'home');
    bindShell();
    render();
    Neko.mascot.mount();
    if (Neko.community) Neko.community.submitSelf();
    if (Neko.api) Neko.api.startEvents();
    if (options.intro) {
      window.setTimeout(() => {
        if (Neko.auth && Neko.auth.intro) Neko.auth.intro(profile.displayName);
      }, 320);
    }
    document.dispatchEvent(new CustomEvent('neko:app-start'));
  }

  document.addEventListener('neko:logout', () => {
    started = false;
    if (Neko.api) Neko.api.stopEvents();
    if (Neko.live) Neko.live.unsubscribe();
    Neko.mascot.unmount();
    if (viewRoot) viewRoot.innerHTML = '';
  });

  function boot() {
    Neko.icons.hydrate(document);
    Neko.theme.init();
    Neko.scenes.render(Neko.store.prefs.theme, Neko.store.prefs.mode);
    Neko.audio.init();
    if (Neko.community) Neko.community.init();
    if (Neko.fx) Neko.fx.init();
    Neko.auth.init();
    bootLoader();
  }

  Neko.app = {
    boot, start, render, refresh, refreshTheme, go,
    get currentView() { return current; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
