/* ============================================================
   NEKO · server/cek-supabase.js
   Alat cek koneksi Supabase untuk server NEKO.

   Jalankan   : node server/cek-supabase.js
   Kirim data : node server/cek-supabase.js --kirim

   --kirim TIDAK menimpa apa pun: snapshot lokal naik ke baris
   key='main' hanya kalau Supabase masih kosong, atau digabung
   (data lokal menang) kalau sudah ada isinya.
   ============================================================ */
'use strict';

const path = require('node:path');
const sync = require('./supabase-sync.js');

const ROOT = path.join(__dirname, '..');
const DB_FILE = path.join(ROOT, 'server', 'db.json');

function bacaLokal() {
  try {
    return JSON.parse(require('node:fs').readFileSync(DB_FILE, 'utf8'));
  } catch (error) {
    console.error('server/db.json tidak terbaca:', error.message);
    return null;
  }
}

function ringkas(state) {
  if (!state) return '(kosong)';
  const akun = Object.keys(state.users || {}).length;
  const teman = Object.keys(state.friends || {}).length;
  const chat = Object.keys(state.chats || {}).length;
  const pengumuman = ((state.community || {}).announcements || []).length;
  return akun + ' akun · ' + teman + ' pertemanan · ' + chat + ' chat · ' + pengumuman + ' pengumuman';
}

(async () => {
  console.log('==================================================');
  console.log('  CEK SINKRONISASI SUPABASE NEKO');
  console.log('==================================================');
  const st = sync.status();
  if (!st.enabled) {
    console.log('MATI  :', st.detail);
    console.log('      : server tetap jalan normal, hanya belum tersimpan ke cloud.');
    return;
  }
  console.log('URL   :', st.url);
  console.log('Tabel :', st.table);
  console.log('Kunci :', st.key, '(nilai lengkap tidak pernah ditampilkan)');
  console.log('.env  :', st.dotenv.found ? 'dibaca, berisi ' + st.dotenv.keys.join(', ') : 'tidak ditemukan');
  console.log('--------------------------------------------------');
  const lokal = bacaLokal();
  console.log('server/db.json   :', ringkas(lokal));
  try {
    const snap = await sync.pull();
    console.log('Supabase         :', snap && snap.empty ? '(kosong / belum ada barisnya)' : ringkas(snap.value));
    if (snap && !snap.empty) console.log('revision         :', snap.revision, '· terakhir diubah', snap.updatedAt || '-');
    if (process.argv.includes('--kirim')) {
      console.log('--------------------------------------------------');
      if (snap && !snap.empty && Object.keys(snap.value).length) {
        console.log('Sudah ada data di Supabase. Jalankan server biasa (Mulai-NEKO.bat) agar datanya DIGABUNG, bukan ditimpa.');
      } else {
        const ok = await sync.pushNow(lokal || {});
        console.log(ok ? 'OK  : data lokal berhasil dikirim naik (rev ' + sync.status().revision + ').' : 'GAGAL: lihat pesan error di atas.');
      }
    } else if (snap && snap.empty && lokal) {
      console.log('TIPS: Supabase masih kosong padahal data lokal ada. Jalankan: node server/cek-supabase.js --kirim');
    }
  } catch (error) {
    console.log('GAGAL connects   :', error.message);
    console.log('                  (server NEKO tetap bisa dipakai seperti biasa)');
  }
})();
