# NetQuest TJKT

## Membuka di web dan memasang di HP

1. Unggah file proyek ini ke repository GitHub.
2. Di Render, pilih **New > Blueprint** lalu pilih repository tersebut. `render.yaml` membuat satu web service Node dan Render menyediakan HTTPS.
3. Deploy. Buka URL HTTPS dari Render di Chrome Android, lalu pilih **Pasang aplikasi** atau **Tambahkan ke layar utama**.

Setiap deploy baru diperiksa service worker dan diterapkan saat browser memuat ulang aplikasi. PC tetap membuka situs web biasa. XP, misi, dan tema tersimpan lokal di browser/perangkat masing-masing; tanpa database, data tidak tersinkron antarperangkat.

## Menjalankan lokal

Gunakan Node.js 18 atau lebih baru, lalu jalankan:

```powershell
node server.js
```

Buka `http://127.0.0.1:8080`.

## Ikon dan pemasangan

`favicon.svg` digunakan sebagai ikon web dan PWA. PWA memberi ikon aplikasi di Android, tetapi bukan file APK bertanda tangan. APK asli memerlukan pembungkus Android seperti Capacitor serta proses build dan signing.