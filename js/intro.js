/* ============================================================
   NEKO · js/intro.js
   Intro sinematik saat pertama kali aplikasi dibuka di
   perangkat ini: perkenalan wordmark, review halaman penting,
   dan Miki / Miko / Neksya. Suara memakai efek Web Audio yang
   sudah ada ditambah narasi bahasa Indonesia bila perangkat
   punya suara TTS. Bisa dilewati dan bisa diputar ulang.
   ============================================================ */
(function () {
  'use strict';

  const Neko = window.Neko = window.Neko || {};
  const { esc, reducedMotion } = Neko.util;
  const { icon } = Neko.icons;

  const SEEN_KEY = 'neko_cine_intro_v1';

  const TOUR = [
    { view: 'home', icon: 'home', tint: 'var(--accent)', title: 'Beranda', line: 'XP hari ini, check-in, dan pintasan ke semua dunia.' },
    { view: 'materials', icon: 'books', tint: 'var(--warn)', title: 'Perpustakaan', line: 'Materi TJKT per bab, catatan, dan kuis yang tersimpan.' },
    { view: 'arena', icon: 'gamepad', tint: 'var(--accent-2)', title: 'Arena', line: 'Belasan game adu paham: Memory, Spy, Kabel LAN, dan lainnya.' },
    { view: null, icon: 'live', tint: 'var(--danger)', title: 'Kelas Langsung', line: 'Satu PIN, sekelas berlomba bersamaan seperti kuis besar.' },
    { view: 'messages', icon: 'chat', tint: 'var(--success)', title: 'Pesan & Teman', line: 'Tambah teman, ngobrol, dan lihat siapa paling rajin.' },
    { view: 'profile', icon: 'profile', tint: 'var(--accent-3)', title: 'Profil', line: 'Badge, season, koleksi bacaan, dan pengaturan tampilan.' }
  ];

  const CAST = [
    { id: 'miki', tint: 'var(--accent)', line: 'Pemandu aplikasi: fitur, tema, check-in, dan akun.' },
    { id: 'miko', tint: 'var(--accent-2)', line: 'Partner arena: pilih game, hitung XP, dan semangat.' },
    { id: 'neksya', tint: 'var(--warn)', line: 'Penjaga rak: istilah jaringan dan rekomendasi bacaan.' }
  ];

  let current = null;

  function readFlag(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : raw === '1';
    } catch (error) {
      return fallback;
    }
  }

  function writeFlag(key, value) {
    try { localStorage.setItem(key, value ? '1' : '0'); } catch (error) { /* penyimpanan opsional */ }
  }

  function isSeen() { return readFlag(SEEN_KEY, false); }
  function resetSeen() { writeFlag(SEEN_KEY, false); }

  function narrationOn() { return !Neko.voice || Neko.voice.enabled(); }

  function sfx(kind) {
    try { Neko.audio.play(kind); } catch (error) { /* audio opsional */ }
  }

  function haptic() {
    try { if (Neko.fx && Neko.fx.haptic) Neko.fx.haptic('soft'); } catch (error) { /* getaran opsional */ }
  }

  function say(text, persona) {
    if (!current || !Neko.voice) return;
    Neko.voice.say(text, persona || 'narrator');
  }

  function markup(name) {
    const letters = 'NEKO'.split('').map((ch, index) =>
      '<span style="--d:' + (120 + index * 130) + '">' + esc(ch) + '</span>').join('');
    const sparks = Array.from({ length: 16 }, (_, i) =>
      '<b style="left:' + ((i * 37) % 96 + 2) + '%;top:' + ((i * 53) % 92 + 3) + '%;animation-delay:' + (i % 7) * .42 + 's"></b>').join('');
    const tiles = TOUR.map((tile, index) =>
      '<button type="button" class="cine-tile" data-tile="' + index + '" style="--tc:' + tile.tint + ';--d:' + (index * 110) + '"' + (tile.view ? ' data-goto="' + tile.view + '"' : '') + '>' +
      '<span class="cine-tile-ic">' + icon(tile.icon) + '</span>' +
      '<span><b>' + esc(tile.title) + '</b><small>' + esc(tile.line) + '</small></span></button>').join('');
    const cats = CAST.map((who, index) => {
      const info = (Neko.mascot && Neko.mascot.cast && Neko.mascot.cast[who.id]) || { name: who.id, role: '' };
      return '<div class="cine-cat" data-cat="' + who.id + '" style="--cc:' + who.tint + ';--d:' + (index * 150) + '">' +
        Neko.mascot.svg(who.id, index === 1 ? 'cheer' : 'happy') +
        '<b>' + esc(info.name) + '</b><i>' + esc(info.role) + '</i><small>' + esc(who.line) + '</small></div>';
    }).join('');

    return (
      '<div class="cine-aura" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="cine-sparks" aria-hidden="true">' + sparks + '</div>' +
      '<div class="cine-beam" aria-hidden="true"></div>' +
      '<div class="cine-rail" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
      '<button type="button" class="cine-voice" data-cine-voice aria-pressed="' + String(narrationOn()) + '" aria-label="Narasi suara">' + icon(narrationOn() ? 'volume' : 'volume-off') + '</button>' +
      '<button type="button" class="cine-skip" data-cine-skip>Lewati ' + icon('arrow-right') + '</button>' +
      '<div class="cine-stage">' +
      '<section class="cine-scene" data-scene="0">' +
      '<div class="cine-mark"><span class="logo-mask"></span></div>' +
      '<div class="cine-word">' + letters + '</div>' +
      '<p class="cine-tag">Belajar TJKT Sambil Bermain</p>' +
      '<p class="cine-by">Kelompok 1 · XI TJKT 2</p>' +
      '</section>' +
      '<section class="cine-scene" data-scene="1">' +
      '<p class="cine-tiles-head">Enam tempat yang akan kamu pakai</p>' +
      '<div class="cine-tiles">' + tiles + '</div>' +
      '</section>' +
      '<section class="cine-scene" data-scene="2">' +
      '<p class="cine-tiles-head">Tiga asisten yang menemani belajarmu</p>' +
      '<div class="cine-cats">' + cats + '</div>' +
      '</section>' +
      '<section class="cine-scene" data-scene="3">' +
      '<div class="cine-go">' +
      '<p class="cine-go-title">Siap belajar, ' + esc(name || 'kamu') + '?</p>' +
      '<p class="cine-go-sub">Semua progres tersimpan di akunmu. Mulai dari Beranda, atau langsung buka Kelas Langsung saat guru memberi PIN.</p>' +
      '<button type="button" class="cine-go-btn" data-cine-go>' + icon('rocket') + 'Mulai belajar</button>' +
      '<div class="cine-go-chips">' +
      '<span>' + icon('flame') + 'Check-in harian</span>' +
      '<span>' + icon('bolt') + 'XP & badge</span>' +
      '<span>' + icon('live') + 'Kelas Langsung</span>' +
      '</div></div></section></div>' +
      '<p class="cine-caption" role="status" aria-live="polite"><span></span></p>'
    );
  }

  function play(options = {}) {
    if (current) current.close('replace');
    const rm = reducedMotion();
    const node = document.createElement('div');
    node.className = 'cine';
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-label', 'Perkenalan NEKO');
    node.innerHTML = markup(options.name || '');
    document.body.appendChild(node);
    document.documentElement.classList.add('cine-open');

    const scenes = [...node.querySelectorAll('.cine-scene')];
    const dots = [...node.querySelectorAll('.cine-rail i')];
    const caption = node.querySelector('.cine-caption span');
    const timers = [];
    let index = -1;
    let closed = false;
    let finish;
    const done = new Promise(resolve => { finish = resolve; });

    const wait = (ms, fn) => { timers.push(window.setTimeout(fn, ms)); };

    function show(n) {
      index = n;
      scenes.forEach((scene, i) => scene.classList.toggle('on', i === n));
      dots.forEach((dot, i) => dot.classList.toggle('on', i <= n));
      sfx('whoosh');
    }

    function setCaption(text, spoken, persona) {
      caption.textContent = text;
      caption.style.animation = 'none';
      void caption.offsetWidth;
      caption.style.animation = '';
      if (spoken === false) return;
      say(typeof spoken === 'string' ? spoken : text, persona);
    }

    function highlight(selector, list, onChoose) {
      const items = [...node.querySelectorAll(selector)];
      list.forEach((item, i) => {
        const step = i * (rm ? 320 : 780);
        wait(step, () => {
          items.forEach(el => el.classList.remove('hot'));
          items[i].classList.add('hot');
          sfx(i === items.length - 1 ? 'success' : 'tick');
          onChoose(item, i);
        });
      });
      return list.length * (rm ? 320 : 780);
    }

    function markScene() {
      show(0);
      setCaption('NEKO — belajar TJKT sambil bermain. Aplikasi ini dibuat Kelompok 1, XI TJKT 2.');
      sfx('login');
      wait(rm ? 900 : 2400, tourScene);
    }

    function tourScene() {
      show(1);
      const span = highlight('.cine-tile', TOUR, (tile) => setCaption(tile.title + ' — ' + tile.line));
      wait(span + (rm ? 260 : 520), castScene);
    }

    function castScene() {
      show(2);
      const span = highlight('.cine-cat', CAST, (who) => {
        const info = (Neko.mascot && Neko.mascot.cast && Neko.mascot.cast[who.id]) || { name: who.id, greeting: who.line };
        setCaption(info.name + ' — ' + who.line, info.greeting, who.id);
      });
      wait(span + (rm ? 260 : 520), goScene);
    }

    function goScene() {
      show(3);
      setCaption('Tekan Mulai belajar, atau ketuk layar untuk masuk.', false);
      sfx('levelup');
      haptic();
      wait(rm ? 4200 : 9000, () => close('auto'));
    }

    function close(reason) {
      if (closed) return;
      closed = true;
      timers.forEach(window.clearTimeout);
      document.removeEventListener('keydown', onKey);
      if (Neko.voice) Neko.voice.cancel();
      if (reason !== 'replace') writeFlag(SEEN_KEY, true);
      node.classList.add('is-leaving');
      document.documentElement.classList.remove('cine-open');
      window.setTimeout(() => { if (node.isConnected) node.remove(); }, rm ? 60 : 700);
      current = null;
      if (reason !== 'replace') finish(true);
    }

    node.addEventListener('click', event => {
      const voice = event.target.closest('[data-cine-voice]');
      if (voice) {
        const next = !narrationOn();
        if (Neko.voice) Neko.voice.setEnabled(next);
        voice.setAttribute('aria-pressed', String(next));
        voice.innerHTML = icon(next ? 'volume' : 'volume-off');
        sfx('toggle');
        if (next) setCaption(caption.textContent);
        return;
      }
      if (event.target.closest('[data-cine-skip]')) { close('skip'); return; }
      if (event.target.closest('[data-cine-go]')) { close('go'); return; }
      const tile = event.target.closest('[data-goto]');
      if (tile) {
        close('goto');
        const view = tile.dataset.goto;
        window.setTimeout(() => { try { Neko.app.go(view); } catch (error) { /* layar lain */ } }, 120);
        return;
      }
      if (event.target.closest('.cine-cat')) {
        const id = event.target.closest('.cine-cat').dataset.cat;
        close('chat');
        window.setTimeout(() => { try { Neko.mascot.openChat(id); } catch (error) { /* maskot belum siap */ } }, 160);
        return;
      }
      /* ketuk area mana pun: lompat ke babak berikutnya */
      if (index < 3) {
        timers.forEach(window.clearTimeout);
        timers.length = 0;
        if (index === 0) tourScene();
        else if (index === 1) castScene();
        else goScene();
      } else {
        close('tap');
      }
    });

    function onKey(event) {
      if (event.key === 'Escape') { close('key'); return; }
      if (event.key === ' ' || event.key === 'Enter') {
        if (index === 3) { close('key'); return; }
        event.preventDefault();
        timers.forEach(window.clearTimeout);
        timers.length = 0;
        if (index === 0) tourScene(); else if (index === 1) castScene(); else goScene();
      }
    }

    document.addEventListener('keydown', onKey);
    current = { close: (reason) => close(reason || 'api') };
    window.setTimeout(markScene, 90);
    return done;
  }

  Neko.intro = { play, isSeen, resetSeen, get open() { return Boolean(current); } };
})();
