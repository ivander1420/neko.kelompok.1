/* ============================================================
   NEKO · js/mascot.js
   Miki, Miko, Neksya: maskot SVG dengan ekspresi, teman
   mengobrol, dan pemahaman pertanyaan TJKT dalam bahasa santai.
   ============================================================ */
(function () {
  'use strict';

  const Neko = window.Neko = window.Neko || {};
  const { esc } = Neko.util;
  const { icon } = Neko.icons;

  const tint = (token, pct, toward) => 'color-mix(in oklab, var(' + token + ') ' + pct + '%, ' + toward + ')';

  const cast = {
    miki: {
      id: 'miki', name: 'Miki', role: 'Pemandu NEKO', icon: 'cat',
      colors: { fur: 'var(--accent)', shade: tint('--accent', 66, '#04101c'), cheek: tint('--danger', 55, '#fff'), inner: tint('--danger', 32, '#fff') },
      greeting: 'Halo, aku Miki, pemandu NEKO. Tanyakan cara pakai aplikasi, tema, check-in, atau fitur akun. Untuk materi buku ada Neksya, untuk arena ada Miko.',
      voice: 'Aku bantu pelan-pelan, ya.'
    },
    miko: {
      id: 'miko', name: 'Miko', role: 'Partner Arena', icon: 'paw',
      colors: { fur: 'var(--accent-2)', shade: tint('--accent-2', 64, '#04101c'), cheek: tint('--danger', 55, '#fff'), inner: tint('--accent-2', 30, '#fff') },
      greeting: 'Miko di sini! Siap bantu pilih game, hitung XP, dan semangat sebelum bertanding. Mau tanya apa?',
      voice: 'Kita bisa selesaikan ini cepat!'
    },
    neksya: {
      id: 'neksya', name: 'Neksya', role: 'Penjaga Perpustakaan', icon: 'book',
      colors: { fur: 'var(--warn)', shade: tint('--warn', 64, '#04101c'), cheek: tint('--danger', 55, '#fff'), inner: tint('--warn', 30, '#fff') },
      greeting: 'Aku Neksya, penjaga rak buku. Tanyakan istilah jaringan atau minta rekomendasi bacaan, ya.',
      voice: 'Ada catatan bagus di buku materi.'
    }
  };

  /* Setiap topik punya satu penanggung jawab. Topik dengan nilai '' boleh
     dijawab maskot mana pun; sisanya diserahkan ke yang berwenang. */
  const owner = {
    subnet: 'neksya', osi: 'neksya', vlan: 'neksya', cable: 'neksya', ip: 'neksya',
    troubleshoot: 'neksya', security: 'neksya', basic: 'neksya', book: 'neksya',
    game: 'miko', live: 'miko', xp: 'miko', motivation: 'miko',
    theme: 'miki', checkin: 'miki', message: 'miki',
    help: '', identity: '', thanks: '', greeting: '', farewell: ''
  };

  const territory = {
    neksya: 'rak buku dan materi TJKT',
    miko: 'arena, Kelas Langsung, dan XP',
    miki: 'fitur NEKO dan panduan aplikasi'
  };

  function ownTopics(charId) {
    return order.filter(id => owner[id] === charId);
  }

  const books = () => (window.NEK_MATERIALS?.books || []);

  function palette(id) {
    const info = cast[id] || cast.miki;
    return '--m-fur:' + info.colors.fur + ';--m-shade:' + info.colors.shade + ';--m-cheek:' + info.colors.cheek + ';--m-inner:' + info.colors.inner;
  }

  function accessory(id, mood) {
    if (id === 'miko') {
      return (
        '<path d="M34 37.5q26 7 52 0" fill="none" stroke="var(--m-shade)" stroke-width="8" stroke-linecap="round"/>' +
        '<path d="M60 30.5l5.2 8.5h-4l2.6 7.5-6.4-9.5h4z" fill="var(--warn)" stroke="#0b1220" stroke-width="1.1" stroke-linejoin="round"/>' +
        '<path d="M22 26l3.6 5M98 26l-3.6 5" stroke="var(--m-shade)" stroke-width="3" stroke-linecap="round" opacity=".5"/>' +
        (mood === 'cheer' ? '<path d="M14 44l3 3-3 3M106 44l-3 3 3 3" stroke="var(--warn)" stroke-width="2.6" fill="none" stroke-linecap="round"/>' : '')
      );
    }
    if (id === 'neksya') {
      return (
        '<g fill="none" stroke="#0b1220" stroke-width="2.6"><circle cx="48" cy="50" r="10.4"/><circle cx="72" cy="50" r="10.4"/><path d="M58.4 50h3.2M37.6 48 30 45M82.4 48 90 45"/></g>' +
        '<circle cx="48" cy="50" r="10.4" fill="var(--accent)" opacity=".22"/><circle cx="72" cy="50" r="10.4" fill="var(--accent)" opacity=".22"/>' +
        '<path d="M44 79h32l-3 8H47z" fill="var(--m-shade)" opacity=".85"/>' +
        '<path d="M47 79h26" stroke="#fff" stroke-width="2" opacity=".5"/>'
      );
    }
    return (
      '<path d="M60 79c-6 0-9 3-9 3l3 6h12l3-6s-3-3-9-3z" fill="var(--m-shade)" opacity=".9"/>' +
      '<circle cx="60" cy="86" r="3.2" fill="var(--warn)" stroke="#0b1220" stroke-width="1"/>' +
      '<path d="M26 44q6-10 16-12" stroke="var(--m-shade)" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/>'
    );
  }

  function svg(id = 'miki', mood = 'happy', className = '') {
    const info = cast[id] || cast.miki;
    const eyes =
      mood === 'cheer' ? '<path d="M41 51q7-9 14 0M65 51q7-9 14 0" stroke="#0b1220" stroke-width="4.5" fill="none" stroke-linecap="round"/>' :
      mood === 'sad' ? '<path d="M41 48q7 7 14 0M65 48q7 7 14 0" stroke="#0b1220" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="46" cy="57" r="2.2" fill="var(--accent)"/><circle cx="74" cy="57" r="2.2" fill="var(--accent)"/>' :
      mood === 'sleepy' ? '<path d="M41 51q7 6 14 0M65 51q7 6 14 0" stroke="#0b1220" stroke-width="4" fill="none" stroke-linecap="round"/>' :
      mood === 'thinking' ? '<circle cx="48" cy="50" r="5.4" fill="#0b1220"/><path d="M66 51q6-5 12 0" stroke="#0b1220" stroke-width="4" fill="none" stroke-linecap="round"/>' :
      mood === 'surprised' ? '<circle cx="48" cy="50" r="7.2" fill="#0b1220"/><circle cx="72" cy="50" r="7.2" fill="#0b1220"/><circle cx="45.6" cy="47" r="2.2" fill="#fff"/><circle cx="69.6" cy="47" r="2.2" fill="#fff"/>' :
      '<circle cx="48" cy="50" r="5.8" fill="#0b1220"/><circle cx="72" cy="50" r="5.8" fill="#0b1220"/><circle cx="46" cy="47.5" r="2" fill="#fff"/><circle cx="70" cy="47.5" r="2" fill="#fff"/>';
    const mouth =
      mood === 'cheer' ? '<ellipse cx="60" cy="67" rx="8" ry="6" fill="#3b1220"/><path d="M55 70q5 4 10 0" stroke="var(--m-cheek)" stroke-width="2" fill="none" stroke-linecap="round"/>' :
      mood === 'sad' ? '<path d="M53 71q7-8 14 0" stroke="#0b1220" stroke-width="3.2" fill="none" stroke-linecap="round"/>' :
      mood === 'surprised' ? '<ellipse cx="60" cy="68" rx="4.2" ry="5" fill="#3b1220"/>' :
      mood === 'thinking' ? '<path d="M54 67q6 4 11 0" stroke="#0b1220" stroke-width="3" fill="none" stroke-linecap="round"/>' :
      '<path d="M53 65q7 8 14 0" stroke="#0b1220" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M58 63h4" stroke="#0b1220" stroke-width="2.4" stroke-linecap="round"/>';
    return (
      '<svg class="mascot-svg ' + className + '" viewBox="0 0 120 120" style="' + palette(info.id) + '" aria-hidden="true" focusable="false">' +
      '<path d="M91 88c17 1 20-15 10-23" fill="none" stroke="var(--m-shade)" stroke-width="9" stroke-linecap="round"/>' +
      '<ellipse cx="60" cy="88" rx="27" ry="22" fill="var(--m-fur)"/>' +
      '<ellipse cx="60" cy="92" rx="16" ry="14" fill="#fff" opacity=".55"/>' +
      '<ellipse cx="38" cy="92" rx="8" ry="6" fill="var(--m-fur)"/>' +
      '<ellipse cx="82" cy="92" rx="8" ry="6" fill="var(--m-fur)"/>' +
      '<path d="M35 31 39 8l20 15z" fill="var(--m-fur)"/>' +
      '<path d="M85 31 81 8 61 23z" fill="var(--m-fur)"/>' +
      '<path d="M41 27 43 15l11 8z" fill="var(--m-inner)"/>' +
      '<path d="M79 27 77 15 66 23z" fill="var(--m-inner)"/>' +
      '<circle cx="60" cy="53" r="30" fill="var(--m-fur)"/>' +
      '<ellipse cx="47" cy="33" rx="10" ry="5" fill="#fff" opacity=".35"/>' +
      '<circle cx="38" cy="61" r="6" fill="var(--m-cheek)" opacity=".55"/>' +
      '<circle cx="82" cy="61" r="6" fill="var(--m-cheek)" opacity=".55"/>' +
      eyes +
      '<path d="M60 58l-4 3.4h8z" fill="var(--m-cheek)"/>' +
      mouth +
      '<path d="M30 54h-9M31 60l-9 3M90 54h9M89 60l9 3" stroke="var(--m-shade)" stroke-width="2" stroke-linecap="round" opacity=".65"/>' +
      accessory(info.id, mood) +
      '</svg>'
    );
  }

  /* ---------------- Pengetahuan singkat ---------------- */

  const knowledge = {
    subnet: {
      keywords: ['subnet', 'subnetting', 'cidr', 'prefix', 'netmask', 'subnet mask', 'network address', 'broadcast', 'jumlah host', 'host usable'],
      book: 'ip-subnetting', game: 'subnet',
      answer: 'Subnetting membagi satu jaringan besar menjadi blok yang lebih kecil.\n• Network address = IP AND subnet mask.\n• Broadcast = semua bit host diisi 1.\n• Host usable = 2^(32 − prefix) − 2.\nContoh /26 punya 64 alamat, jadi 62 host bisa dipakai.'
    },
    osi: {
      keywords: ['osi', 'lapisan', 'layer', 'application', 'presentation', 'session', 'transport', 'data link', 'datalink', 'physical'],
      book: 'dasar-jaringan', game: 'osi',
      answer: 'Tujuh lapisan OSI dari atas ke bawah:\n1 Application, 2 Presentation, 3 Session, 4 Transport, 5 Network, 6 Data Link, 7 Physical.\nIngat singkatan: All People Seem To Need Data Processing.'
    },
    vlan: {
      keywords: ['vlan', 'trunk', 'access port', 'switching', 'switch', 'segmentasi'],
      book: 'vlan-switching', game: 'osi',
      answer: 'VLAN memisahkan satu switch menjadi beberapa jaringan logis. Port access melayani satu VLAN, port trunk membawa banyak VLAN antar-switch memakai tag 802.1Q. VLAN mengurangi domain broadcast dan menambah keamanan.'
    },
    cable: {
      keywords: ['kabel', 'konektor', 'rj45', 'rj11', 'utp', 'stp', 'fiber', 'fo', 'coaxial', 'krimping', 'crimp', 't568'],
      book: 'hardware-kabel', game: 'cable',
      answer: 'Media jaringan yang sering dipakai:\n• UTP/STP dengan konektor RJ45 untuk LAN.\n• Fiber optic untuk jarak jauh dan bandwidth besar.\n• Coaxial untuk TV kabel dan kamera analog.\nUrutan T568B: putih oranye, oranye, putih hijau, biru, putih biru, hijau, putih cokelat, cokelat.'
    },
    ip: {
      keywords: ['ip', 'ipv4', 'alamat ip', 'dhcp', 'dns', 'gateway', 'apipa', '169.254'],
      book: 'ip-subnetting', game: 'subnet',
      answer: 'IPv4 terdiri dari 32 bit dan ditulis empat oktet. Rentang privat: 10.0.0.0/8, 172.16.0.0/12, dan 192.168.0.0/16. DHCP membagikan IP otomatis, DNS menerjemahkan nama domain, gateway menjadi pintu keluar jaringan.'
    },
    troubleshoot: {
      keywords: ['troubleshooting', 'rusak', 'tidak bisa', 'gak bisa', 'gabisa', 'gagal', 'lambat', 'lemot', 'putus', 'ping', 'lampu', 'mati', 'error', 'bermasalah', 'no internet'],
      book: 'troubleshooting', game: 'detective',
      answer: 'Urutan troubleshooting yang aman:\n1 Cek fisik: kabel, lampu indikator, dan daya.\n2 Cek IP, gateway, dan DNS.\n3 Uji ping ke gateway lalu ke 8.8.8.8.\n4 Baru periksa konfigurasi switch, router, atau firewall.\nUbah satu hal lalu uji lagi agar penyebabnya jelas.'
    },
    security: {
      keywords: ['keamanan', 'security', 'firewall', 'password', 'sandi', 'hacker', 'malware', 'serangan', 'enkripsi', 'phishing'],
      book: 'keamanan-jaringan', game: 'detective',
      answer: 'Dasar keamanan jaringan: gunakan password kuat dan berbeda, aktifkan firewall, perbarui firmware, matikan port yang tidak dipakai, serta waspadai tautan phishing. Enkripsi seperti WPA2/WPA3 melindungi data di jaringan nirkabel.'
    },
    basic: {
      keywords: ['jaringan', 'lan', 'wan', 'man', 'topologi', 'router', 'dasar jaringan', 'pengertian jaringan', 'internet'],
      book: 'dasar-jaringan', game: 'quiz',
      answer: 'Jaringan komputer menghubungkan perangkat agar bisa bertukar data. LAN mencakup area kecil seperti lab, WAN menghubungkan lokasi jauh, dan internet adalah jaringan jaringan global. Topologi umum: star, bus, ring, dan mesh.'
    },
    game: {
      keywords: ['main', 'game', 'arena', 'kuis', 'quiz', 'tantangan', 'skor', 'rekor', 'bermain'],
      book: '', game: 'quiz',
      answer: 'Arena NEKO punya delapan game solo — Kuis Kilat, Kata Penyusup, Lab Kabel, Kartu Memori, Subnet Master, Menara OSI, Detektif Jaringan, Refleks Neko — plus satu mode online bernama Kelas Langsung. Pilih kartu game, atur kesulitan, lalu tekan Mulai.'
    },
    live: {
      keywords: ['live class', 'kelas langsung', 'kahoot', 'pin kelas', 'main bareng', 'multiplayer', 'lawan teman'],
      book: '', game: '',
      answer: 'Kelas Langsung adalah mode bergaya Kahoot: guru menekan Buat Kelas, layar menampilkan PIN enam angka, lalu siswa join dari HP masing-masing. Jawaban lebih cepat memberi poin lebih besar, dan XP akhir sesi langsung tersimpan ke akun.'
    },
    message: {
      keywords: ['chat', 'mengobrol', 'pesan', 'teman', 'friend', 'add friend', 'sms'],
      book: '', game: '',
      answer: 'Buka tab Pesan untuk mencari akun lain, mengirim permintaan berteman, lalu chatting real-time. Semua percakapan tersimpan di server, jadi riwayat ikut pindah saat kamu login di perangkat lain.'
    },
    xp: {
      keywords: ['xp', 'season', 'level', 'gelar', 'rank', 'naik tingkat', 'naik season', 'badge'],
      book: '', game: 'quiz',
      answer: 'Ada lima season: Pemula 0–600 XP, Penjelajah 600–1600, Arsitek 1600–3000, Penjaga 3000–5000, dan Legenda 5000+. Setiap season penuh memberi gelar, badge, dan bingkai profil baru. XP didapat dari check-in, halaman buku baru, dan game.'
    },
    book: {
      keywords: ['buku', 'materi', 'baca', 'halaman', 'rekomendasi', 'rak', 'perpustakaan'],
      book: '', game: '',
      answer: 'Perpustakaan NEKO punya enam buku: Dasar Jaringan, IP & Subnetting, VLAN & Switching, Hardware & Kabel, Troubleshooting, dan Keamanan Jaringan. Setiap buku punya tabel, gambar, dan kuis kecil.'
    },
    checkin: {
      keywords: ['checkin', 'check in', 'absen', 'hadiah harian', 'streak', 'login harian'],
      book: '', game: '',
      answer: 'Check-in harian ada di beranda. Semakin panjang streak, hadiah XP makin besar: 20 sampai 80 XP. Check-in juga membuka badge Api Semangat saat mencapai tujuh hari.'
    },
    theme: {
      keywords: ['tema', 'tampilan', 'warna', 'mode', 'gelap', 'terang', 'mobil', 'balap', 'astronot', 'hutan', 'laut', 'pink'],
      book: '', game: '',
      answer: 'Ada delapan dunia: Neon Lab, Hutan Rimba, Samudra, Permen Manis, Crimson Core, Velocity, Orbit NEKO, dan Paper Quest. Velocity khusus balap dan selalu gelap; dunia lain punya mode terang dan gelap. Semua tema mengubah latar, ikon, font, dan suara.'
    },
    identity: {
      keywords: ['siapa kamu', 'kamu siapa', 'namamu', 'nama kamu', 'miki', 'miko', 'neksya', 'sasha', 'mochi'],
      book: '', game: '',
      answer: 'Kita bertiga punya tugas masing-masing: Miki pemandu NEKO (fitur, tema, check-in, akun), Miko partner arena (game, Kelas Langsung, XP), dan Neksya penjaga perpustakaan (materi TJKT dan rekomendasi bacaan).'
    },
    thanks: {
      keywords: ['makasih', 'terima kasih', 'thanks', 'thx', 'terimakasih'],
      book: '', game: '',
      answer: 'Sama-sama! Senang bisa membantu. Kalau ada istilah yang masih mengganjal, tanyakan lagi ya.'
    },
    motivation: {
      keywords: ['semangat', 'capek', 'lelah', 'bosan', 'malas', 'takut', 'sulit', 'susah', 'bingung', 'pusing', 'cara belajar', 'tips belajar', 'belajar yang baik', 'fokus', 'ngantuk'],
      book: '', game: '',
      answer: 'Tidak apa-apa merasa berat. Istirahat sebentar, tarik napas, lalu pilih satu langkah kecil: satu halaman buku atau satu game singkat. Kemajuan kecil tetap kemajuan.'
    },
    greeting: {
      keywords: ['halo', 'hai', 'hi', 'hello', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum', 'assalam', 'apa kabar', 'kabar'],
      book: '', game: '',
      answer: 'Halo juga! Mau belajar materi, memilih game, atau sekadar mengobrol? Aku siap menemani.'
    },
    help: {
      keywords: ['bantuan', 'bantu', 'bisa apa', 'fitur', 'panduan', 'cara pakai', 'cara main'],
      book: '', game: '',
      answer: 'Aku bisa menjelaskan materi (subnet, OSI, VLAN, kabel, IP, troubleshooting, keamanan), merekomendasikan buku, membantu memilih game, menjelaskan XP season, dan memberi semangat. Klik salah satu saran di bawah untuk mulai.'
    },
    farewell: {
      keywords: ['bye', 'dadah', 'sampai jumpa', 'selamat tinggal', 'good night', 'selamat malam'],
      book: '', game: '',
      answer: 'Sampai jumpa! Simpan energimu, dan kembali lagi saat siap belajar. Miki, Miko, dan Neksya menunggu.'
    }
  };

  const order = ['subnet', 'osi', 'vlan', 'cable', 'ip', 'troubleshoot', 'security', 'basic', 'game', 'live', 'message', 'xp', 'book', 'checkin', 'theme', 'identity', 'thanks', 'motivation', 'help', 'greeting', 'farewell'];

  const suggestionsByChar = {
    miki: ['Cara ganti tema', 'Di mana check-in harian?', 'Cara ajak teman ngobrol', 'Siapa kamu?'],
    miko: ['How to Kelas Langsung?', 'Game apa yang seru?', 'Cara cepat dapat XP?', 'Aku lagi bosen'],
    neksya: ['Apa itu subnet?', 'Urutan kabel T568B', 'Rekomendasi buku', 'Bedanya VLAN dan trunk?']
  };

  function normalize(text) {
    const clean = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    return ' ' + clean + ' ';
  }

  function scoreIntent(text, spec) {
    return (spec.keywords || []).reduce((score, keyword) => {
      const needle = ' ' + keyword.toLowerCase() + ' ';
      if (text.includes(needle)) return score + (keyword.includes(' ') ? 3 : 1.4);
      return score;
    }, 0);
  }

  function pickIntent(text) {
    let best = null;
    let bestScore = 0;
    order.forEach(id => {
      const score = scoreIntent(text, knowledge[id]);
      if (score > bestScore) { bestScore = score; best = id; }
    });
    return bestScore >= 1.4 ? best : null;
  }

  const flavorCursor = new Map();

  const opener = {
    miki: ['Baik, sini kujelaskan pelan-pelan. ', 'Oke, kita urai satu-satu ya. ', '','Aku rangkumkan supaya gampang diingat. '],
    miko: ['Gas! ', 'Nih, versi cepatnya! ', 'Aku suka pertanyaan begini! ', 'Langsung ke intinya, ya: '],
    neksya: ['Catatan rak nomor satu. ', 'Sudah kubaca di buku materi. ', 'Ini yang biasanya keluar di ujian. ', '']
  };

  function flavor(charId, topicId, text) {
    const list = opener[charId] || opener.miki;
    const key = String(topicId || '') + ':' + charId;
    let index = flavorCursor.get(key);
    if (index === undefined) { index = Math.floor(Math.random() * list.length); }
    flavorCursor.set(key, (index + 1) % list.length);
    const lead = list[index] || '';
    if (charId === 'miko' && topicId === 'game') return lead + text + ' Kalau mau adu cepat, ajak teman lewat Kelas Langsung.';
    if (charId === 'neksya' && (topicId === 'book' || topicId === 'basic' || topicId === 'subnet')) return lead + text + ' Halaman lengkapnya ada di Perpustakaan.';
    return lead + text;
  }

  function topicReply(topicId, charId) {
    const info = knowledge[topicId];
    const actions = [];
    if (info.book) {
      const book = books().find(item => item.id === info.book);
      if (book) actions.push({ type: 'book', id: book.id, label: 'Baca ' + book.title, icon: 'books' });
    }
    if (info.game) actions.push({ type: 'game', id: info.game, label: 'Coba di arena', icon: 'gamepad' });
    if (topicId === 'theme') actions.push({ type: 'theme', label: 'Pilih tema', icon: 'palette' });
    if (topicId === 'xp') actions.push({ type: 'guide', label: 'Lihat panduan season', icon: 'trophy' });
    if (topicId === 'checkin') actions.push({ type: 'go', view: 'home', label: 'Ke beranda', icon: 'home' });
    if (topicId === 'book') actions.push({ type: 'go', view: 'materials', label: 'Buka perpustakaan', icon: 'books' });
    if (topicId === 'game') actions.push({ type: 'go', view: 'arena', label: 'Buka arena', icon: 'gamepad' });
    if (topicId === 'live') actions.push({ type: 'live', label: 'Buka Kelas Langsung', icon: 'live' });
    if (topicId === 'message') actions.push({ type: 'go', view: 'messages', label: 'Buka Pesan', icon: 'chat' });
    return { text: flavor(charId, topicId, info.answer), actions };
  }

  function recommendBook(charId) {
    const profile = Neko.store.profile;
    const states = Object.entries(profile?.books || {}).filter(([, state]) => state && !state.finished && state.maxPage > 0);
    const finished = new Set(Object.entries(profile?.books || {}).filter(([, state]) => state?.finished).map(([id]) => id));
    const next = books().find(book => !finished.has(book.id) && !states.some(([id]) => id === book.id)) || books().find(book => !finished.has(book.id));
    if (!next) return { text: 'Semua buku sudah kamu tamatkan. Hebat! Sekarang uji pemahamanmu di arena atau ulangi buku favoritmu.', actions: [{ type: 'go', view: 'arena', label: 'Ke arena', icon: 'gamepad' }] };
    const started = states.find(([id]) => id === next.id);
    const hint = started ? 'Kamu sudah mulai buku ini. Lanjutkan dari halaman terakhir.' : 'Buku ini cocok sebagai langkah berikutnya.';
    const voice = charId === 'neksya' ? 'Aku sudah memeriksa raknya. ' : charId === 'miko' ? 'Ini pilihan cepatku. ' : '';
    return {
      text: voice + hint + ' Rekomendasiku: ' + next.title + ' — ' + next.subtitle,
      actions: [
        { type: 'book', id: next.id, label: 'Baca ' + next.title, icon: 'books' },
        { type: 'go', view: 'materials', label: 'Lihat semua buku', icon: 'books' }
      ]
    };
  }

  function seasonReply() {
    const profile = Neko.store.profile;
    const snap = Neko.seasons.seasonForXP(profile ? profile.xp : 0);
    const line = snap.next
      ? 'Sekarang kamu di ' + snap.season.name + ' sebagai ' + snap.season.title + '. Butuh ' + Neko.util.formatNumber(snap.xpToNext) + ' XP lagi untuk mencapai ' + snap.next.short + '.'
      : 'Kamu sudah berada di puncak Legenda. Gelar Network Legend ada di namamu.';
    return {
      text: line + ' Cara cepat menambah XP: check-in harian, buka halaman buku baru, dan menangkan game di arena.',
      actions: [{ type: 'guide', label: 'Buka panduan', icon: 'trophy' }, { type: 'go', view: 'arena', label: 'Cari XP', icon: 'bolt' }]
    };
  }

  const topicTitle = {
    subnet: 'subnetting', osi: 'lapisan OSI', vlan: 'VLAN dan switching', cable: 'kabel dan konektor',
    ip: 'alamat IP', troubleshoot: 'troubleshooting', security: 'keamanan jaringan', basic: 'dasar jaringan',
    book: 'rekomendasi bacaan', game: 'game arena', live: 'Kelas Langsung', xp: 'XP dan season',
    motivation: 'semangat belajar', theme: 'tema dan tampilan', checkin: 'check-in harian', message: 'chat dan teman'
  };

  function fallback(charId) {
    const who = cast[charId] || cast.miki;
    return {
      text: who.voice + ' Aku belum menangkap maksudnya. Aku memegang ' + territory[who.id] +
        ' — coba sebutkan salah satu itu, atau tanyakan ke maskot lain lewat tab di atas.',
      actions: []
    };
  }

  function handoff(topicId, charId) {
    const boss = owner[topicId];
    const who = cast[boss];
    const from = cast[charId] || cast.miki;
    return {
      text: 'Wah, itu bukan tugasanku. Yang pegang ' + (topicTitle[topicId] || topicId) + ' adalah ' + who.name +
        ' (' + who.role.toLowerCase() + '). Aku ' + from.name + ', bagianku ' + territory[from.id] + '.' +
        ' Ketuk tombol di bawah, pertanyaanmu langsung kubawakan ke dia.',
      actions: [{ type: 'ask', id: boss, label: 'Tanya ' + who.name, icon: 'chat' }]
    };
  }

  function identityReply(charId) {
    const who = cast[charId] || cast.miki;
    return {
      text: 'Aku ' + who.name + ', ' + who.role + '. Bagianku ' + territory[who.id] + '. ' + knowledge.identity.answer,
      actions: Object.keys(cast).filter(id => id !== who.id).map(id => ({
        type: 'ask', id, label: 'Ganti ke ' + cast[id].name, icon: 'chat'
      }))
    };
  }

  function helpReply(charId) {
    const who = cast[charId] || cast.miki;
    const list = ownTopics(who.id).map(id => topicTitle[id] || id);
    const others = Object.keys(cast).filter(id => id !== who.id).map(id => cast[id].name);
    return {
      text: 'Aku ' + who.name + ' — ' + who.role.toLowerCase() + '. Yang bisa kujawab: ' + list.join(', ') +
        '. Untuk soal di luar itu, ' + others.join(' atau ') + ' yang bertugas; tanyakan saja lewat tab di atas.',
      actions: Object.keys(cast).filter(id => id !== who.id).map(id => ({
        type: 'ask', id, label: 'Ganti ke ' + cast[id].name, icon: 'chat'
      }))
    };
  }

  function renameNote(charId) {
    const who = cast[charId] || cast.miki;
    return {
      text: who.name + ' di sini. Penjaga perpustakaan kami sekarang bernama Neksya — nama lamanya Sasha (sebelum itu Mochi). ' +
        knowledge.identity.answer,
      actions: [{ type: 'ask', id: 'neksya', label: 'Buka chat Neksya', icon: 'chat' }]
    };
  }

  function replyFor(rawText, charId) {
    const text = normalize(rawText);
    if (!text.trim()) return fallback(charId);
    if (/mochi/.test(text) || /(^|\s)sasha(\s|$)/.test(text)) return renameNote(charId);
    let topicId = null;
    if (/(mau|ingin|pengen).*(buku|materi|baca)/.test(text) || /(rekomendasi|saran|pilih).*(buku|bacaan)/.test(text)) topicId = 'book';
    else if (/(cara|gimana|bagaimana).*(naik|tambah|dapat).*(xp|season|level)/.test(text) || /(berapa|sisa).*(xp|season)/.test(text)) topicId = 'xp';
    else topicId = pickIntent(text);
    if (!topicId) return fallback(charId);
    const boss = owner[topicId];
    if (boss && boss !== charId) return handoff(topicId, charId);
    if (topicId === 'identity') return identityReply(charId);
    if (topicId === 'help') return helpReply(charId);
    if (topicId === 'book') return recommendBook(charId);
    if (topicId === 'xp') return seasonReply();
    return topicReply(topicId, charId);
  }

  /* ---------------- Percakapan ---------------- */

  const history = { miki: [], miko: [], neksya: [] };
  let activeId = 'miki';
  let sheetEntry = null;
  let typingTimer = null;
  let lastQuestion = '';

  function pushMessage(who, text, actions = []) {
    history[who].push({ role: 'bot', text, actions, time: Date.now() });
    if (history[who].length > 60) history[who].shift();
  }

  function ensureGreeting(who) {
    if (!history[who].length) pushMessage(who, cast[who].greeting, []);
  }

  function timeLabel(time) {
    return new Date(time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  function messagesHTML(who) {
    return history[who].map(message => {
      if (message.role === 'user') {
        return '<div class="chat-row user"><div class="chat-bubble user-bubble">' + esc(message.text).replace(/\n/g, '<br>') + '<time>' + timeLabel(message.time) + '</time></div></div>';
      }
      const actions = message.actions && message.actions.length
        ? '<div class="chat-actions">' + message.actions.map(action => (
          '<button type="button" data-chat-action="' + action.type + ':' + (action.id || action.view || '') + '">' + icon(action.icon || 'arrow-right') + esc(action.label) + '</button>'
        )).join('') + '</div>'
        : '';
      return '<div class="chat-row bot"><span class="chat-avatar" style="' + palette(who) + '">' + svg(who, 'happy') + '</span><div class="chat-bubble bot-bubble">' + esc(message.text).replace(/\n/g, '<br>') + '<time>' + timeLabel(message.time) + '</time></div>' + actions + '</div>';
    }).join('');
  }

  function renderMessages(chatEl, who) {
    const box = chatEl.querySelector('[data-chat-messages]');
    if (!box) return;
    box.innerHTML = messagesHTML(who);
    const typing = chatEl.querySelector('[data-chat-typing]');
    if (typing) box.appendChild(typing);
    box.scrollTop = box.scrollHeight;
    chatEl.querySelectorAll('[data-chat-tab]').forEach(button => {
      const on = button.dataset.chatTab === who;
      button.classList.toggle('on', on);
      button.setAttribute('aria-selected', String(on));
    });
    const title = sheetEntry?.sheet?.querySelector('.sheet-head h3');
    const sub = sheetEntry?.sheet?.querySelector('.sheet-head p');
    if (title) title.textContent = 'Ngobrol dengan ' + cast[who].name;
    if (sub) sub.textContent = cast[who].role;
    const input = chatEl.querySelector('[data-chat-input]');
    if (input) input.placeholder = 'Tulis pesan untuk ' + cast[who].name + '…';
    const chips = chatEl.querySelector('[data-chat-suggest]');
    if (chips) {
      chips.innerHTML = (suggestionsByChar[who] || suggestionsByChar.miki)
        .map(text => '<button type="button" data-chat-suggest="' + esc(text) + '">' + esc(text) + '</button>').join('');
    }
  }

  function showTyping(chatEl) {
    const box = chatEl.querySelector('[data-chat-messages]');
    let node = chatEl.querySelector('[data-chat-typing]');
    if (!node) {
      node = document.createElement('div');
      node.className = 'chat-typing';
      node.setAttribute('data-chat-typing', '');
      node.innerHTML = '<i></i><i></i><i></i>';
    }
    if (box) {
      box.appendChild(node);
      box.scrollTop = box.scrollHeight;
    }
  }

  function send(chatEl, raw) {
    const text = String(raw || '').trim();
    if (!text) return;
    const who = activeId;
    lastQuestion = text;
    history[who].push({ role: 'user', text, time: Date.now() });
    if (history[who].length > 60) history[who].shift();
    const input = chatEl.querySelector('[data-chat-input]');
    if (input) { input.value = ''; input.focus(); }
    renderMessages(chatEl, who);
    Neko.audio.play('tap');
    showTyping(chatEl);
    window.clearTimeout(typingTimer);
    typingTimer = window.setTimeout(() => {
      const reply = replyFor(text, who);
      pushMessage(who, reply.text, reply.actions);
      renderMessages(chatEl, who);
      Neko.audio.play('select');
      typingTimer = null;
    }, 520 + Math.random() * 520);
  }

  function closeSheet() {
    window.clearTimeout(typingTimer);
    typingTimer = null;
    if (sheetEntry) {
      try { sheetEntry.close(); } catch (error) { /* abaikan */ }
      sheetEntry = null;
    }
  }

  function switchTo(id, reask) {
    if (!cast[id]) return;
    const chat = sheetEntry && sheetEntry.layer ? sheetEntry.layer.querySelector('[data-chat]') : null;
    activeId = id;
    ensureGreeting(id);
    Neko.audio.play('select');
    if (chat) {
      renderMessages(chat, id);
      if (reask && lastQuestion) window.setTimeout(() => send(chat, lastQuestion), 260);
    }
  }

  function runAction(action) {
    const [type, id] = String(action || '').split(':');
    if (type === 'ask') { switchTo(id, true); return; }
    closeSheet();
    window.setTimeout(() => {
      if (type === 'book' && id) { Neko.book.open(id); return; }
      if (type === 'game' && id) { Neko.arena.setupSheet(id); return; }
      if (type === 'live') { if (Neko.live) Neko.live.openChooser(); return; }
      if (type === 'theme') { Neko.ui.themeSheet(); return; }
      if (type === 'guide') {
        Neko.profile.setTab('guide');
        Neko.app.go('profile');
        return;
      }
      if (type === 'go' && id) { Neko.app.go(id); }
    }, 280);
  }

  function openChat(characterId) {
    const who = cast[characterId] ? characterId : activeId;
    activeId = who;
    ensureGreeting(who);
    if (sheetEntry) {
      const current = sheetEntry.layer;
      const chat = current?.querySelector('[data-chat]');
      if (chat) renderMessages(chat, who);
      return sheetEntry;
    }
    const entry = Neko.ui.sheet({
      kicker: 'TEMAN BELAJAR',
      title: 'Ngobrol dengan ' + cast[who].name,
      sub: cast[who].role,
      className: 'chat-sheet',
      layerClass: 'chat-layer',
      body:
        '<div class="mascot-chat" data-chat>' +
        '<div class="chat-tabs" role="tablist" aria-label="Pilih maskot">' +
        Object.values(cast).map(item => (
          '<button type="button" role="tab" data-chat-tab="' + item.id + '" class="' + (item.id === who ? 'on' : '') + '" aria-selected="' + String(item.id === who) + '" style="' + palette(item.id) + '">' +
          '<span class="chat-tab-avatar">' + svg(item.id, 'happy') + '</span><span><b>' + item.name + '</b><small>' + item.role + '</small></span>' +
          '</button>'
        )).join('') + '</div>' +
        '<div class="mascot-messages" data-chat-messages aria-live="polite"></div>' +
        '<div class="chat-suggest" data-chat-suggest></div>' +
        '<form class="chat-composer" data-chat-form>' +
        '<input type="text" data-chat-input maxlength="280" autocomplete="off" enterkeyhint="send" aria-label="Tulis pesan" placeholder="Tulis pesan untuk ' + cast[who].name + '…">' +
        '<button type="submit" class="chat-send" aria-label="Kirim pesan">' + icon('send') + '</button>' +
        '</form>' +
        '<p class="chat-note">' + icon('lock') + 'Percakapan hanya ada di perangkat ini dan tidak dikirim ke mana pun.</p>' +
        '</div>',
      onMount(el) {
        chatBind(el);
      },
      onClose() {
        window.clearTimeout(typingTimer);
        typingTimer = null;
        sheetEntry = null;
      }
    });
    sheetEntry = entry;
    return entry;
  }

  function chatBind(el) {
    renderMessages(el, activeId);
    el.addEventListener('click', event => {
      const tab = event.target.closest('[data-chat-tab]');
      if (tab) {
        activeId = tab.dataset.chatTab;
        ensureGreeting(activeId);
        Neko.audio.play('select');
        renderMessages(el, activeId);
        return;
      }
      const suggest = event.target.closest('[data-chat-suggest]');
      if (suggest) {
        send(el, suggest.dataset.chatSuggest);
        return;
      }
      const action = event.target.closest('[data-chat-action]');
      if (action) {
        Neko.audio.play('select');
        runAction(action.dataset.chatAction);
      }
    });
    el.addEventListener('submit', event => {
      if (!event.target.matches('[data-chat-form]')) return;
      event.preventDefault();
      const input = el.querySelector('[data-chat-input]');
      send(el, input ? input.value : '');
    });
    window.setTimeout(() => {
      const input = el.querySelector('[data-chat-input]');
      if (input) input.focus();
    }, 320);
  }

  /* ---------------- Maskot mengambang ---------------- */

  const pet = {
    root: null,
    node: null,
    body: null,
    bubble: null,
    id: 'miki',
    mood: 'happy',
    mounted: false,
    wanderTimer: null,
    swapTimer: null,
    bubbleTimer: null,
    reactTimer: null,
    comfortTimer: null
  };

  const WIN_LINES = [
    'Yeay, menang! Kerja bagus, lanjutkan!',
    'Keren! Jawabanmu cepat dan tepat.',
    'Mantap! Miko sampai ikut bangga.'
  ];
  const LOSE_LINES = [
    'Yah, belum menang. Tidak apa-apa, semangat!',
    'Belum beruntung, tapi kamu sudah berusaha. Semangat!',
    'Satu sesi selesai. Tarik napas, lalu coba lagi ya!'
  ];
  const IDLE_LINES = [
    'Aku di sini kalau kamu butuh teman belajar.',
    'Mau baca satu halaman atau main satu game?',
    'Pelan-pelan saja, yang penting terus jalan.'
  ];

  function randomOf(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function paintPet() {
    if (!pet.node || !pet.body) return;
    const name = cast[pet.id].name;
    pet.body.innerHTML = svg(pet.id, pet.mood);
    const label = pet.node.querySelector('.mascot-pet-label');
    if (label) label.innerHTML = icon('chat') + 'Tanya ' + name;
    pet.node.setAttribute('aria-label', 'Ngobrol dengan ' + name);
  }

  function hideBubble() {
    if (!pet.bubble) return;
    pet.bubble.classList.remove('on');
  }

  function showBubble(text, ms = 4200) {
    if (!pet.bubble || !text) return;
    pet.bubble.innerHTML = esc(text);
    pet.bubble.classList.add('on');
    window.clearTimeout(pet.bubbleTimer);
    pet.bubbleTimer = window.setTimeout(hideBubble, ms);
  }

  function react(kind, detail = {}) {
    if (!pet.mounted || !pet.node) return;
    pet.node.classList.remove('is-react');
    void pet.node.offsetWidth;
    pet.node.classList.add('is-react');
    window.clearTimeout(pet.reactTimer);
    pet.reactTimer = window.setTimeout(() => { if (pet.node) pet.node.classList.remove('is-react'); }, 700);

    if (kind === 'win') {
      pet.mood = 'cheer';
      paintPet();
      showBubble(randomOf(WIN_LINES));
      return;
    }
    if (kind === 'lose') {
      pet.mood = 'sad';
      paintPet();
      showBubble(randomOf(LOSE_LINES), 2600);
      window.clearTimeout(pet.comfortTimer);
      pet.comfortTimer = window.setTimeout(() => {
        if (!pet.mounted) return;
        pet.mood = 'cheer';
        paintPet();
        showBubble('Semangat! Aku yakin kamu bisa lebih baik di percobaan berikutnya. ' + (detail.name ? 'Ayo coba ' + detail.name + ' lagi!' : ''), 5600);
      }, 2700);
      return;
    }
    if (kind === 'announcement') {
      pet.mood = 'surprised';
      paintPet();
      showBubble('Kabar baru dari ' + (detail.author || 'admin') + ': ' + (detail.title || 'ada pengumuman baru.'));
      window.setTimeout(() => {
        if (pet.mounted && pet.mood === 'surprised') { pet.mood = 'happy'; paintPet(); }
      }, 4200);
      return;
    }
    pet.mood = 'cheer';
    paintPet();
    showBubble(detail.message || 'Semangat terus, ya!');
  }

  function wander() {
    if (!pet.mounted || !pet.node) return;
    const spread = window.innerWidth < 760 ? 10 : 34;
    const dx = Math.round((Math.random() * 2 - 1) * spread);
    const dy = Math.round((Math.random() * 2 - 1) * 12);
    pet.node.style.setProperty('--wx', dx + 'px');
    pet.node.style.setProperty('--wy', dy + 'px');
    if (Math.random() < .55 && !(pet.bubble && pet.bubble.classList.contains('on')) && !sheetEntry) {
      pet.mood = randomOf(['happy', 'thinking', 'cheer']);
      paintPet();
    }
    scheduleWander();
  }

  function scheduleWander() {
    window.clearTimeout(pet.wanderTimer);
    pet.wanderTimer = window.setTimeout(wander, 5200 + Math.random() * 5200);
  }

  function swapCharacter() {
    if (!pet.mounted || !pet.node || sheetEntry) return;
    pet.node.classList.add('is-swapping');
    window.setTimeout(() => {
      if (!pet.mounted) return;
      const rotation = ['miki', 'miko', 'neksya'];
      pet.id = rotation[(rotation.indexOf(pet.id) + 1) % rotation.length];
      pet.mood = 'happy';
      paintPet();
      window.setTimeout(() => { if (pet.node) pet.node.classList.remove('is-swapping'); }, 180);
    }, 170);
  }

  function mount() {
    const root = document.getElementById('mascotRoot');
    if (!root || root.querySelector('.mascot-pet')) return;
    pet.root = root;
    pet.id = 'miki';
    pet.mood = 'happy';
    pet.mounted = true;

    const bubble = document.createElement('div');
    bubble.className = 'mascot-bubble';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');
    root.appendChild(bubble);
    pet.bubble = bubble;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mascot-pet';
    button.style.setProperty('--wx', '0px');
    button.style.setProperty('--wy', '0px');
    button.innerHTML = '<span class="mascot-pet-body" style="' + palette('miki') + '">' + svg('miki', 'happy') + '</span><span class="mascot-pet-label">' + icon('chat') + 'Tanya Miki</span>';
    button.addEventListener('click', () => {
      Neko.audio.play('select');
      hideBubble();
      button.classList.add('is-chatting');
      window.setTimeout(() => button.classList.remove('is-chatting'), 600);
      openChat(pet.id);
    });
    pet.node = button;
    pet.body = button.querySelector('.mascot-pet-body');
    root.appendChild(button);

    window.setTimeout(() => { if (pet.mounted) showBubble(randomOf(IDLE_LINES), 5000); }, 1400);
    scheduleWander();
    window.clearInterval(pet.swapTimer);
    pet.swapTimer = window.setInterval(swapCharacter, 17000);
  }

  function unmount() {
    closeSheet();
    pet.mounted = false;
    window.clearTimeout(pet.wanderTimer);
    window.clearTimeout(pet.bubbleTimer);
    window.clearTimeout(pet.reactTimer);
    window.clearTimeout(pet.comfortTimer);
    window.clearInterval(pet.swapTimer);
    pet.wanderTimer = pet.bubbleTimer = pet.reactTimer = pet.comfortTimer = pet.swapTimer = null;
    pet.root = pet.node = pet.body = pet.bubble = null;
    const root = document.getElementById('mascotRoot');
    if (root) root.innerHTML = '';
  }

  Neko.mascot = {
    cast, svg, openChat, close: closeSheet, mount, unmount, react,
    ask(text, characterId) { return replyFor(text, characterId || 'miki'); }
  };
})();
