/* ============================================================
   NEKO · js/admin.js
   Panel Developer / President / Admin: mengubah papan informasi,
   mengirim pengumuman global, dan mengelola daftar pengumuman.
   ============================================================ */
(function () {
  'use strict';

  const Neko = window.Neko = window.Neko || {};
  const { esc, timeAgo } = Neko.util;
  const { icon } = Neko.icons;
  const TYPES = [
    { id: 'info', label: 'Informasi' },
    { id: 'event', label: 'Acara' },
    { id: 'update', label: 'Pembaruan' },
    { id: 'reward', label: 'Hadiah' },
    { id: 'warning', label: 'Penting' }
  ];

  function canManage() {
    return Neko.community && Neko.community.manager();
  }

  function typeLabel(type) {
    const found = TYPES.find(item => item.id === type);
    return found ? found.label : 'Informasi';
  }

  function announcementList() {
    const list = Neko.community.announcements || [];
    if (!list.length) {
      return '<div class="empty-state admin-empty"><span class="empty-ic">' + icon('megaphone') + '</span><h3>Belum ada pengumuman</h3><p>Tulis pengumuman pertama untuk seluruh pengguna NEKO.</p></div>';
    }
    return '<div class="admin-ann-list">' + list.map(item => (
      '<article class="admin-ann" data-ann-id="' + esc(item.id) + '">' +
      '<div class="admin-ann-head"><span class="pill pill-accent">' + esc(typeLabel(item.type)) + '</span>' +
      '<b>' + esc(item.title) + '</b>' +
      '<span class="admin-ann-time">' + esc(timeAgo(item.time)) + '</span>' +
      '<button type="button" class="btn btn-ghost btn-sm admin-ann-del" data-ann-delete="' + esc(item.id) + '" aria-label="Hapus pengumuman">' + icon('trash') + '</button>' +
      '</div>' +
      '<p>' + esc(item.body) + '</p>' +
      '<small>' + esc(item.author || 'Admin') + ' · ' + esc(item.authorRole || 'Admin') + '</small>' +
      '</article>'
    )).join('') + '</div>';
  }

  function render() {
    const session = Neko.store.session || { displayName: 'Admin', role: 'Admin' };
    const info = Neko.community ? Neko.community.info : { title: '', body: '' };
    const players = Neko.community ? Neko.community.leaderboard().length : 0;
    const active = Neko.community ? Neko.community.activeCount() : 0;
    return (
      '<div class="page-head admin-head">' +
      '<div><span class="kicker">PANEL ' + esc(String(session.role).toUpperCase()) + '</span><h1>Pusat komunitas</h1>' +
      '<p>Semua perubahan di sini langsung tampil untuk seluruh pengguna NEKO yang terhubung.</p></div>' +
      '<div class="page-head-actions">' +
      '<button type="button" class="btn btn-soft" data-open-leaderboard>' + icon('ranking') + 'Leaderboard</button>' +
      '<button type="button" class="btn btn-ghost" data-admin-refresh>' + icon('refresh') + 'Muat ulang</button>' +
      '</div></div>' +
      '<div class="admin-stats">' +
      '<div class="admin-stat"><span>' + icon('users') + '</span><div><b>' + players + '</b><small>Peringkat terpantau</small></div></div>' +
      '<div class="admin-stat"><span>' + icon('bolt') + '</span><div><b>' + active + '</b><small>Aktif 5 menit terakhir</small></div></div>' +
      '<div class="admin-stat"><span>' + icon('megaphone') + '</span><div><b>' + (Neko.community.announcements.length) + '</b><small>Pengumuman tersimpan</small></div></div>' +
      '</div>' +
      '<div class="admin-grid">' +
      '<section class="card admin-card">' +
      '<div class="card-title">' + icon('note') + 'Papan informasi</div>' +
      '<p class="card-sub">Tampil di beranda dan halaman profil semua pengguna.</p>' +
      '<form class="admin-form" data-admin-info>' +
      '<label class="field"><span>Judul informasi</span><input name="title" maxlength="80" required value="' + esc(info.title || '') + '" placeholder="Contoh: Jadwal praktikum minggu ini"></label>' +
      '<label class="field"><span>Isi informasi</span><textarea name="body" maxlength="500" required placeholder="Tulis informasi singkat dan jelas…">' + esc(info.body || '') + '</textarea></label>' +
      '<button class="btn btn-primary" type="submit">' + icon('check') + 'Simpan informasi</button>' +
      '</form>' +
      '</section>' +
      '<section class="card admin-card">' +
      '<div class="card-title">' + icon('megaphone') + 'Pengumuman baru</div>' +
      '<p class="card-sub">Muncul sebagai notifikasi di perangkat pengguna dan di kotak masuk NEKO.</p>' +
      '<form class="admin-form" data-admin-announce>' +
      '<label class="field"><span>Judul</span><input name="title" maxlength="80" required placeholder="Contoh: Turnamen arena Jumat"></label>' +
      '<label class="field"><span>Isi pesan</span><textarea name="body" maxlength="400" required placeholder="Tulis pesan untuk semua pengguna…"></textarea></label>' +
      '<label class="field"><span>Jenis</span><select name="type">' + TYPES.map(item => '<option value="' + item.id + '">' + item.label + '</option>').join('') + '</select></label>' +
      '<button class="btn btn-primary" type="submit">' + icon('send') + 'Kirim ke semua</button>' +
      '</form>' +
      '</section>' +
      '</div>' +
      '<section class="card admin-card admin-list-card">' +
      '<div class="card-title">' + icon('banner') + 'Daftar pengumuman</div>' +
      '<div data-admin-list>' + announcementList() + '</div>' +
      '</section>'
    );
  }

  function bind(root) {
    if (!root) return;
    const infoForm = root.querySelector('[data-admin-info]');
    if (infoForm) {
      infoForm.addEventListener('submit', async event => {
        event.preventDefault();
        const data = new FormData(infoForm);
        const button = infoForm.querySelector('button[type="submit"]');
        button.disabled = true;
        const result = await Neko.community.updateInfo({ title: data.get('title'), body: data.get('body') });
        button.disabled = false;
        if (result.ok) {
          Neko.audio.play('success');
          Neko.ui.toast('Informasi diperbarui', 'Papan informasi baru sudah tayang untuk semua pengguna.', 'success', 'note');
        } else {
          Neko.audio.play('error');
          Neko.ui.toast('Gagal menyimpan', 'Periksa judul dan isi informasi, lalu coba lagi.', 'error', 'warning');
        }
      });
    }

    const annForm = root.querySelector('[data-admin-announce]');
    if (annForm) {
      annForm.addEventListener('submit', async event => {
        event.preventDefault();
        const data = new FormData(annForm);
        const button = annForm.querySelector('button[type="submit"]');
        button.disabled = true;
        const result = await Neko.community.announce({
          title: data.get('title'),
          body: data.get('body'),
          type: data.get('type')
        });
        button.disabled = false;
        if (result.ok) {
          annForm.reset();
          Neko.audio.play('notify');
          Neko.ui.toast('Pengumuman terkirim', 'Pesanmu langsung muncul di kotak masuk semua pengguna.', 'success', 'megaphone');
          const list = root.querySelector('[data-admin-list]');
          if (list) list.innerHTML = announcementList();
        } else {
          Neko.audio.play('error');
          Neko.ui.toast('Gagal mengirim', 'Isi judul dan pesan terlebih dahulu.', 'error', 'warning');
        }
      });
    }

    root.addEventListener('click', async event => {
      const del = event.target.closest('[data-ann-delete]');
      if (del) {
        const id = del.dataset.annDelete;
        Neko.ui.dialog({
          title: 'Hapus pengumuman?',
          body: 'Pengumuman ini akan hilang untuk semua pengguna.',
          icon: 'trash',
          confirmText: 'Hapus',
          danger: true
        }).then(async ok => {
          if (!ok) return;
          await Neko.community.remove(id);
          Neko.audio.play('error');
          Neko.ui.toast('Pengumuman dihapus', 'Pesan sudah tidak tampil lagi.', 'info', 'trash');
          const list = root.querySelector('[data-admin-list]');
          if (list) list.innerHTML = announcementList();
        });
      }
      if (event.target.closest('[data-admin-refresh]')) {
        await Neko.community.refresh({ force: true });
        Neko.app.refresh();
      }
    });
  }

  Neko.admin = { canManage, render, bind };
})();
