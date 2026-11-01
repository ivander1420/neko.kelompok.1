# Neko TJKT

Versi aplikasi: **1.4.13**. Katalog memuat 500 materi TJKT untuk pencarian dan Miko dari `miko/catalog.js` serta `miko/catalog-extra.js`; penyimpanan percakapan lokal IndexedDB berada terpisah di `miko/memory.js`. Aplikasi web menggunakan `assets/app.css` dan `assets/app.js`, bukan kode inline di `index.html`.

## Membuka di web dan memasang di HP

1. Unggah file proyek ini ke repository GitHub.
2. Di Render, pilih **New > Blueprint** lalu pilih repository tersebut. `render.yaml` menjalankan `npm start`, yang memulai `server.js` di root. Server yang sama menyajikan situs dan room WebSocket.
3. Deploy. Buka URL HTTPS dari Render di Chrome Android, lalu pilih **Pasang aplikasi** atau **Tambahkan ke layar utama**.

Setiap deploy baru diperiksa service worker dan diterapkan saat browser memuat ulang aplikasi. PC tetap membuka situs web biasa. XP, check-in harian tujuh hari, misi, dan tema tersimpan lokal di browser/perangkat masing-masing.

Musik belajar mulai setelah login dan dapat dimatikan lewat tombol **Musik**; tingkat volumenya bisa diatur pada **Tampilan**. Miko/Miki memakai ilustrasi SVG yang digambar di aplikasi, dengan beragam ekspresi dan efek CSS. Pengaturan mencakup transparansi maskot dan bahasa antarmuka Indonesia/Inggris. Percakapan Miki/Miko hanya menggunakan teks; tidak ada keluaran suara atau input mikrofon untuk maskot. Maskot disembunyikan saat Arena Game aktif. Tombol X kecil di atas kepala menyembunyikan maskot.

Chat Miko memiliki area percakapan yang dapat digulir. Arena Game menyertakan **Who Is the Spy?** untuk 3–30 pemain di satu perangkat. Peran ditampilkan satu per satu dengan kategori dan clue; layar peran Spy memakai tampilan merah. Timer diskusi dapat dipilih sebelum ronde, disusul voting privat dan pengungkapan hasil. Nama dan peran hanya tersimpan sementara di memori halaman; jangan membuka kembali layar peran setelah ronde dimulai.

## Kelas Live

Guru dapat membuat room, membagikan ID enam digit, memantau peserta, avatar bergambar, dan peringkat, lalu memulai kuis. Siswa memilih nama dan avatar bergaya ilustrasi 3D sebelum masuk; layar room mereka berfokus pada kuis dan reaksi serta hanya menerima skor pribadi. Room mencoba membuka fullscreen setelah aksi Buat/Gabung dan tetap memakai tata letak fokus bila browser tidak mendukung fullscreen. Avatar hanya disimpan sementara di sesi browser/server. Soal, jawaban, skor, dan reaksi dikirim melalui WebSocket. Room berada di memori server (tanpa database) dan akan hilang saat server dimulai ulang atau setelah sesi kedaluwarsa. Server harus tetap aktif dan dapat dijangkau semua peserta; gunakan HTTPS/WSS untuk situs publik.

Room ini adalah fitur kuis kelas orisinal Neko dan tidak menggunakan kode atau aset Kahoot.

## Batasan aplikasi klien

Pemisahan JavaScript, CSS, dan katalog ke beberapa file membuat pengelolaan lebih rapi, tetapi tidak menyembunyikan kode yang dikirim ke browser. Akun anggota dan sesi disimpan lokal; PIN anggota disimpan sebagai hash, dan akun admin Ivander dikonfigurasi di `assets/app.js`. Tambahkan akun guru yang dikelola sekolah ke daftar `AUTHORIZED_ACCOUNTS` dengan `role: 'teacher'`. Tanpa server, pemeriksaan admin tidak dapat dianggap aman karena kode dan penyimpanan browser dapat diperiksa atau diubah. Jangan memakai login lokal ini untuk melindungi data rahasia atau sistem produksi. Tidak ada Firebase; login dan katalog dapat digunakan offline pada perangkat yang sama.

Di **Pengaturan**, pilih tema melalui kartu visual (termasuk tema hutan hijau sejuk), pilih gaya Miki/Miko dari ilustrasi, dan atur ukuran, transparansi, animasi, musik, bahasa, serta notifikasi. Pilihan bahasa menerjemahkan antarmuka; sejumlah isi materi dan pertanyaan pembelajaran tetap menggunakan bahasa sumbernya. Katalog mencakup 500 materi TJKT dan mendukung pencarian teks serta suara. Browser hanya meminta izin notifikasi setelah tombolnya ditekan; notifikasi saat aplikasi dibuka hanya berfungsi setelah izin diberikan dan aplikasi tersedia lewat HTTPS/localhost.

## Menjalankan lokal

Gunakan Node.js 18 atau lebih baru, lalu jalankan:

```powershell
node server.js
```

Buka `http://127.0.0.1:8080`.

Navigasi bawah meratakan semua item pada layar lebar dan dapat digeser mendatar pada ponsel agar label tetap terbaca. Saat halaman dipilih, item aktif digulir otomatis ke tengah. Tata letak menyesuaikan layar kecil, tablet, orientasi pendek, serta area aman perangkat.

## Ikon dan pemasangan

`favicon.svg` digunakan sebagai ikon web dan PWA. PWA memberi ikon aplikasi di Android, tetapi bukan file APK bertanda tangan.