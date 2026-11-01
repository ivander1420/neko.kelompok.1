/* =========================================================
   MIKO CONVERSATION ENGINE 2.0
   NETQUEST / NEKO

   Mempertahankan:
   window.NQ_MIKO_REPLY(message, knowledge)
   Hasil: { text, mood }

   Membutuhkan:
   window.NETQUEST_MIKO_MATERIALS
   window.NQ_MIKO_MEMORY (opsional)
========================================================= */

(() => {
  'use strict';

  const STORAGE_KEY = 'nq_miko_conversation_v1';
  const MAX_HISTORY = 80;

  const oldGetHistory = window.NQ_MIKO_GET_HISTORY;
  const oldClearHistory = window.NQ_MIKO_CLEAR_HISTORY;

  // =======================================================
  // 1. PEMBERSIH KALIMAT
  // =======================================================

  function clean(value) {
    return String(value ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalize(value) {
    return clean(value)
      .toLocaleLowerCase('id')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const fillerWords = new Set([
    'eum', 'eumm', 'eummm', 'emm', 'emmm',
    'hmm', 'hmmm', 'hmmmm', 'hmmmmm',
    'anu', 'eh', 'ehh', 'eee', 'ee',
    'apa', 'yaa', 'yah', 'huh', 'uh',
    'umm', 'ummm', 'hadeh'
  ]);

  const stopWords = new Set([
    'aku', 'saya', 'gue', 'gw', 'kamu', 'kau',
    'miko', 'dong', 'sih', 'nih', 'tuh', 'deh',
    'ya', 'yaa', 'yah', 'kan', 'kok', 'lah',
    'apa', 'apakah', 'itu', 'ini', 'yang',
    'dan', 'atau', 'di', 'ke', 'dari', 'pada',
    'untuk', 'dengan', 'tentang', 'adalah',
    'jadi', 'aja', 'saja', 'lebih', 'lagi',
    'tolong', 'please', 'bisa', 'bisakah',
    'mau', 'ingin', 'pengen', 'pengin',
    'dong', 'coba', 'dongg', 'plis',
    'jelaskan', 'jelasin', 'terangkan',
    'bagaimana', 'gimana', 'mengapa', 'kenapa',
    'caranya', 'cara', 'apakah', 'ada',
    'the', 'is', 'are', 'a', 'an', 'to',
    'how', 'what', 'why', 'can', 'please'
  ]);

  function removeFillers(text) {
    return normalize(text)
      .split(' ')
      .filter(word => !fillerWords.has(word))
      .join(' ');
  }

  function isOnlyFiller(text) {
    const words = normalize(text).split(' ').filter(Boolean);

    if (!words.length) return true;

    return words.every(word =>
      fillerWords.has(word) ||
      ['hai', 'halo', 'hello', 'hi'].includes(word)
    ) && words.every(word => fillerWords.has(word) ||
      ['hai', 'halo', 'hello', 'hi'].includes(word));
  }

  function getUsefulWords(text) {
    return removeFillers(text)
      .split(' ')
      .filter(word =>
        word.length > 1 &&
        !stopWords.has(word) &&
        !fillerWords.has(word)
      );
  }

  // =======================================================
  // 2. MEMORY PERCAKAPAN
  // =======================================================

  function getHistory() {
    try {
      if (typeof oldGetHistory === 'function') {
        const result = oldGetHistory();

        if (Array.isArray(result)) return result;
      }

      const data = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || '[]'
      );

      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function saveMessage(role, text) {
    const safeText = clean(text).slice(0, 1000);
    const history = getHistory();

    history.push({
      role,
      text: safeText,
      time: Date.now()
    });

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(history.slice(-MAX_HISTORY))
      );
    } catch (error) {
      console.warn('Miko: gagal menyimpan riwayat.', error);
    }

    const memory = window.NQ_MIKO_MEMORY;

    if (memory && typeof memory.saveMessage === 'function') {
      memory.saveMessage(role, safeText).catch(error => {
        console.warn('Miko: IndexedDB tidak tersedia.', error);
      });
    }
  }

  function getLastUserMessages(limit = 10) {
    return getHistory()
      .filter(item => item.role === 'user')
      .slice(-limit)
      .map(item => item.text);
  }

  function getPreviousTopic() {
    const messages = getLastUserMessages(15);

    for (let i = messages.length - 1; i >= 0; i--) {
      const text = removeFillers(messages[i]);

      if (
        text.length >= 3 &&
        !isOnlyFiller(text) &&
        !/^(hai|halo|hello|hi|pagi|siang|sore|malam)$/.test(text)
      ) {
        return messages[i];
      }
    }

    return '';
  }

  // =======================================================
  // 3. PENGENALAN MAKSUD KALIMAT
  // =======================================================

  function isFollowUp(text) {
  return isFollowUpText(normalize(text));
}

  // RegExp JavaScript tidak mendukung flag x.
  // Karena itu, pemeriksaan lanjutan menggunakan versi biasa.
  function isFollowUpText(text) {
    return /\b(lanjut|terus|contoh|contohnya|misalnya|maksudnya|jelasin lagi|ulang|perjelas|lebih gampang|lebih sederhana|lebih detail|kurang paham|belum paham|kenapa|mengapa|bagaimana|gimana|bagian itu|yang tadi|explain|example|continue|repeat|why|how)\b/.test(text);
  }

  function detectMoodIntent(text) {
    if (/\b(sedih|kecewa|capek|lelah|pusing|stres|cemas|khawatir|takut|gelisah)\b/.test(text)) {
      return 'gentle';
    }

    if (/\b(semangat|senang|bahagia|excited|gembira)\b/.test(text)) {
      return 'happy';
    }

    return null;
  }

  // =======================================================
  // 4. PENCARIAN MATERI YANG LEBIH PINTAR
  // =======================================================

  function getKnowledge(passedKnowledge) {
    const globalMaterials = Array.isArray(
      window.NETQUEST_MIKO_MATERIALS
    )
      ? window.NETQUEST_MIKO_MATERIALS
      : [];

    const extraMaterials = Array.isArray(passedKnowledge)
      ? passedKnowledge
      : [];

    if (!extraMaterials.length) return globalMaterials;

    if (extraMaterials === globalMaterials) {
      return globalMaterials;
    }

    const result = [];
    const seen = new Set();

    for (const entry of [
      ...globalMaterials,
      ...extraMaterials
    ]) {
      if (!Array.isArray(entry)) continue;

      const key = normalize(entry[0] || '');

      if (!key || seen.has(key)) continue;

      seen.add(key);
      result.push(entry);
    }

    return result;
  }

  function editDistanceOne(a, b) {
    if (Math.abs(a.length - b.length) > 1) {
      return false;
    }

    let i = 0;
    let j = 0;
    let differences = 0;

    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        i++;
        j++;
        continue;
      }

      differences++;

      if (differences > 1) return false;

      if (a.length > b.length) {
        i++;
      } else if (b.length > a.length) {
        j++;
      } else {
        i++;
        j++;
      }
    }

    if (i < a.length || j < b.length) {
      differences++;
    }

    return differences <= 1;
  }

  function similarityScore(query, entry) {
    const title = normalize(entry[0] || '');
    const content = normalize(entry[1] || '');

    const keywordText = Array.isArray(entry[2])
      ? entry[2].join(' ')
      : String(entry[2] || '');

    const keywords = normalize(keywordText);

    const queryWords = getUsefulWords(query);

    const titleWords = new Set(
      getUsefulWords(title)
    );

    const keywordWords = new Set(
      getUsefulWords(keywords)
    );

    const contentWords = new Set(
      getUsefulWords(content)
    );

    let score = 0;
    let matched = 0;

    const searchableWords = new Set([
      ...titleWords,
      ...keywordWords
    ]);

    for (const word of queryWords) {
      let found = false;

      if (titleWords.has(word)) {
        score += 9;
        found = true;
      } else if (keywordWords.has(word)) {
        score += 6;
        found = true;
      } else if (contentWords.has(word)) {
        score += 1.5;
        found = true;
      }

      // Koreksi typo ringan, hanya jika ada kecocokan jelas.
      if (!found && word.length >= 5) {
        const possible = [];

        for (const candidate of searchableWords) {
          if (
            candidate.length >= 5 &&
            editDistanceOne(word, candidate)
          ) {
            possible.push(candidate);
          }

          if (possible.length > 2) break;
        }

        if (possible.length === 1) {
          score += titleWords.has(possible[0]) ? 5 : 3;
          found = true;
        }
      }

      if (found) matched++;
    }

    if (title && query.includes(title)) {
      score += 20;
    }

    if (keywords && keywords.length > 2 && query.includes(keywords)) {
      score += 15;
    }

    const coverage = queryWords.length
      ? matched / queryWords.length
      : 0;

    score += coverage * 5;

    return {
      score,
      coverage,
      matched
    };
  }

  function findBestMaterial(query, knowledge) {
    if (!Array.isArray(knowledge) || !knowledge.length) {
      return null;
    }

    let best = null;
    let bestScore = 0;

    for (const entry of knowledge) {
      if (!Array.isArray(entry)) continue;

      const result = similarityScore(query, entry);

      if (result.score > bestScore) {
        bestScore = result.score;
        best = entry;
      }
    }

    const words = getUsefulWords(query);

    if (bestScore < 5 || !words.length) {
      return null;
    }

    return best;
  }

  function makeMaterialAnswer(entry, query) {
    const title = clean(entry[0] || 'Materi TJKT');
    const content = clean(entry[1] || '');

    if (!content) {
      return `Aku menemukan materi "${title}", tetapi penjelasannya belum tersedia.`;
    }

    const question = normalize(query);

    let intro = 'Aku menemukan materi yang cocok dengan pertanyaanmu.';

    if (/\b(apa itu|pengertian|definisi|arti)\b/.test(question)) {
      intro = 'Ini pengertian yang kamu cari.';
    } else if (/\b(cara kerja|bagaimana cara|proses)\b/.test(question)) {
      intro = 'Kita bahas cara kerjanya, ya.';
    } else if (/\b(fungsi|kegunaan|manfaat)\b/.test(question)) {
      intro = 'Ini penjelasan tentang fungsi dan kegunaannya.';
    } else if (/\b(bedanya|perbedaan|bandingkan)\b/.test(question)) {
      intro = 'Ini materi yang berkaitan dengan perbandingan tersebut.';
    } else if (/\b(contoh|contohnya|misalnya)\b/.test(question)) {
      intro = 'Kita lanjutkan pembahasan dari materi ini.';
    }

    const answer = content.length > 1800
      ? content.slice(0, 1800).trim() + '...'
      : content;

    return `${intro}\n\n📘 **${title}**\n\n${answer}\n\nAda bagian tertentu yang ingin kamu pahami lebih lanjut?`;
  }

  // =======================================================
  // 5. NAVIGASI HALAMAN NEKO
  // =======================================================

  const pages = [
    {
      key: 'home',
      name: 'Beranda',
      aliases: ['beranda', 'home', 'dashboard', 'halaman utama']
    },
    {
      key: 'profile',
      name: 'Profil',
      aliases: ['profil', 'profile', 'akun', 'profil pengguna', 'akun saya']
    },
    {
      key: 'missions',
      name: 'Misi',
      aliases: ['misi', 'missions', 'tantangan', 'daftar misi']
    },
    {
      key: 'materials',
      name: 'Materi',
      aliases: ['materi', 'pembelajaran', 'belajar', 'modul', 'pelajaran']
    },
    {
      key: 'games',
      name: 'Permainan',
      aliases: ['permainan', 'game', 'games', 'mini game']
    },
    {
      key: 'quiz',
      name: 'Kuis',
      aliases: ['kuis', 'quiz', 'latihan soal']
    },
    {
      key: 'certificates',
      name: 'Sertifikat',
      aliases: ['sertifikat', 'certificate', 'sertifikasi', 'sertifikat saya']
    },
    {
      key: 'leaderboard',
      name: 'Peringkat',
      aliases: ['peringkat', 'ranking', 'leaderboard', 'papan peringkat']
    },
    {
      key: 'settings',
      name: 'Pengaturan',
      aliases: ['pengaturan', 'settings', 'setelan', 'setting']
    },
    {
      key: 'arena',
      name: 'Arena',
      aliases: ['arena', 'arena class', 'kelas arena']
    },
    {
      key: 'help',
      name: 'Bantuan',
      aliases: ['bantuan', 'help', 'panduan', 'pusat bantuan']
    }
  ];

  function findPageIntent(text) {
    const normalized = normalize(text);

    const navigationWords =
      /\b(buka|bukain|tampilkan|lihat|masuk|pindah|ke halaman|menuju|pergi ke|akses|kunjungi|di mana|dimana|ada di mana|mau ke|bawa aku ke)\b/;

    const hasNavigationIntent =
      navigationWords.test(normalized);

    if (!hasNavigationIntent) return null;

    for (const page of pages) {
      for (const alias of page.aliases) {
        if (
          normalized.includes(normalize(alias))
        ) {
          return page;
        }
      }
    }

    return null;
  }

  function getClickableElements() {
    return Array.from(
      document.querySelectorAll(
        'a, button, [role="button"], [data-page], [data-nav], [data-route], [data-view]'
      )
    );
  }

  function findPageButton(page) {
    const aliases = page.aliases.map(normalize);

    const elements = getClickableElements();

    // Cari label tombol yang cocok terlebih dahulu.
    for (const element of elements) {
      const label = normalize([
        element.innerText,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('data-page'),
        element.getAttribute('data-nav'),
        element.getAttribute('data-route'),
        element.getAttribute('data-view')
      ].filter(Boolean).join(' '));

      if (!label) continue;

      if (aliases.some(alias => label === alias)) {
        return element;
      }
    }

    // Cari kecocokan sebagian jika tidak ada label yang sama persis.
    for (const element of elements) {
      const label = normalize([
        element.innerText,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('data-page'),
        element.getAttribute('data-nav'),
        element.getAttribute('data-route'),
        element.getAttribute('data-view')
      ].filter(Boolean).join(' '));

      if (!label) continue;

      if (aliases.some(alias =>
        alias.length >= 4 && label.includes(alias)
      )) {
        return element;
      }
    }

    return null;
  }

  function openPage(page) {
    if (!page) return false;

    // Integrasi khusus jika aplikasi menyediakan fungsi pembuka halaman.
    const openers = window.NQ_MIKO_PAGE_OPENERS;

    if (
      openers &&
      typeof openers[page.key] === 'function'
    ) {
      try {
        openers[page.key]();
        return true;
      } catch (error) {
        console.error('Miko navigation error:', error);
      }
    }

    // Coba mencari tombol atau tautan navigasi yang terlihat.
    const button = findPageButton(page);

    if (button && !button.disabled) {
      button.click();
      return true;
    }

    // Beri kesempatan app.js menangani event ini.
    try {
      document.dispatchEvent(
        new CustomEvent('nq:miko:navigate', {
          detail: {
            page: page.key,
            name: page.name,
            aliases: page.aliases
          }
        })
      );
    } catch (error) {
      console.warn('Miko navigation event gagal:', error);
    }

    return false;
  }

  // Fungsi navigasi yang dapat dipanggil aplikasi.
  window.NQ_MIKO_OPEN_PAGE = function(pageName) {
    const requested = normalize(pageName);

    const page = pages.find(item =>
      item.key === requested ||
      normalize(item.name) === requested ||
      item.aliases.some(alias =>
        normalize(alias) === requested
      )
    );

    return page ? openPage(page) : false;
  };

  window.NQ_MIKO_PAGES = pages;

  // =======================================================
  // 6. MEMAHAMI KALIMAT KASUAL
  // =======================================================

  function conversationalReply(text) {
    const value = removeFillers(text);

    if (!value) {
      return {
        text: 'Hehehe, santai saja. 😸 Miko mendengarkan. Kamu boleh mikir dulu, lalu lanjutkan kapan saja.',
        mood: 'gentle'
      };
    }

    if (/^(hai|halo|hello|hi|hei|hey|pagi|siang|sore|malam)$/.test(value)) {
      return {
        text: 'Haiii! 😸 Miko di sini. Mau ngobrol, belajar, atau mencari sesuatu di NetQuest?',
        mood: 'happy'
      };
    }

    if (/\b(eumm|hmm|anu|apa ya|gatau mau ngomong apa|bingung mau ngomong apa)\b/.test(normalize(text))) {
      return {
        text: 'Tidak apa-apa, kita santai saja. 🐱 Kamu bisa mulai dari apa pun, bahkan satu kata dulu. Miko akan coba memahami maksudmu.',
        mood: 'gentle'
      };
    }

    if (/\b(siapa kamu|kamu siapa|nama kamu|kenalan)\b/.test(value)) {
      return {
        text: 'Aku Miko! 😸 Asisten belajar NetQuest. Aku bisa bantu mencari materi TJKT, menjawab pertanyaan, mengingat percakapan di perangkatmu, dan membantu membuka halaman aplikasi.',
        mood: 'excited'
      };
    }

    if (/\b(apa kabar|gimana kabar|bagaimana kabarmu|kabar kamu)\b/.test(value)) {
      return {
        text: 'Miko baik dan siap menemanimu belajar! Meoww! 🐾 Kamu sedang ingin melakukan apa hari ini?',
        mood: 'happy'
      };
    }

    if (/\b(terima kasih|makasih|thanks|thank you|makasi)\b/.test(value)) {
      return {
        text: 'Sama-sama! 🐱 Senang bisa membantu. Ada hal lain yang ingin kamu cari?',
        mood: 'happy'
      };
    }

    if (/\b(dadah|sampai jumpa|bye|goodbye|aku pergi|aku mau pergi)\b/.test(value)) {
      return {
        text: 'Dadahhh! 😸 Sampai bertemu lagi di NetQuest. Tetap semangat belajar, ya!',
        mood: 'happy'
      };
    }

    if (/\b(wkwk|wkwkwk|haha|hahaha|hehe|ngakak)\b/.test(value)) {
      return {
        text: 'Wkwkwk! 😹 Sepertinya ada yang lucu. Miko ikut meramaikan suasana!',
        mood: 'happy'
      };
    }

    if (/\b(bosan|bosen|gabut|jenuh|mager)\b/.test(value)) {
      return {
        text: 'Lagi gabut, ya? 😸 Kita bisa ngobrol, mencari fakta teknologi, belajar materi singkat, atau mencoba permainan di NetQuest.',
        mood: 'happy'
      };
    }

    if (/\b(aku tidak paham|aku belum paham|masih bingung|gak paham|nggak paham|enggak paham|susah dimengerti)\b/.test(value)) {
      return {
        text: 'Tidak masalah. Kita coba dengan cara yang lebih sederhana. Kamu bisa sebutkan bagian yang membingungkan, atau tulis "ulang dari awal" agar Miko menjelaskan kembali.',
        mood: 'gentle'
      };
    }

    if (/\b(aku mau nanya|aku ingin bertanya|boleh tanya|mau tanya|ada pertanyaan)\b/.test(value)) {
      return {
        text: 'Tentu boleh! 😸 Silakan tanya saja. Tidak perlu menggunakan kalimat yang sempurna, Miko akan mencoba memahami maksudmu.',
        mood: 'happy'
      };
    }

    if (/\b(semangat|motivasi|menyerah|malas belajar)\b/.test(value)) {
      return {
        text: 'Pelan-pelan saja. Tidak harus langsung menguasai semuanya. Satu hal yang kamu pahami hari ini tetap merupakan kemajuan. 🐱',
        mood: 'gentle'
      };
    }

    if (/\b(lucu|lelucon|jokes|tebak tebakan)\b/.test(value)) {
      const jokes = [
        'Kenapa komputer selalu tenang? Karena punya banyak cache! 😹',
        'Kenapa router tidak pernah tersesat? Karena selalu punya routing table!',
        'Apa makanan kesukaan komputer? Mikrochip! 🐱',
        'Kenapa programmer suka memperbaiki bug? Karena bug tidak boleh betah tinggal!'
      ];

      return {
        text: jokes[Math.floor(Math.random() * jokes.length)],
        mood: 'dance'
      };
    }

    return null;
  }

  // =======================================================
  // 7. MENGENALI PERMINTAAN LANJUTAN
  // =======================================================

  function makeFollowUpAnswer(text, knowledge) {
    const previousTopic = getPreviousTopic();

    if (!previousTopic) {
      return {
        text: 'Miko belum menemukan topik sebelumnya. Coba sebutkan topiknya sedikit, nanti kita lanjutkan bersama.',
        mood: 'curious'
      };
    }

    const previousMaterial = findBestMaterial(
      previousTopic,
      knowledge
    );

    if (previousMaterial) {
      return {
        text:
          `Kita masih membahas **${clean(previousMaterial[0])}**, ya! 🐱\n\n` +
          `${clean(previousMaterial[1])}\n\n` +
          'Bagian mana yang ingin kamu perdalam?',
        mood: 'focused'
      };
    }

    return {
      text:
        `Kita sebelumnya membahas: "${clean(previousTopic)}".\n\n` +
        'Mau Miko menjelaskan ulang, memberi contoh, atau membahas bagian lainnya?',
      mood: 'curious'
    };
  }

  // =======================================================
  // 8. MESIN BALASAN UTAMA
  // =======================================================

  function buildReply(message, passedKnowledge) {
    const original = clean(message);
    const text = normalize(original);
    const searchText = removeFillers(original);

    const knowledge = getKnowledge(passedKnowledge);

    if (!text) {
      return {
        text: 'Ada yang ingin kamu tanyakan? Miko siap membantu! 🐱',
        mood: 'happy'
      };
    }

    // Kata pengisi tanpa pertanyaan yang jelas.
    if (isOnlyFiller(original)) {
      return {
        text: 'Hehehe, tidak apa-apa. 😸 Miko menunggu kamu menyusun kata-katanya. Tidak perlu buru-buru.',
        mood: 'gentle'
      };
    }

    // Obrolan santai dan sapaan.
    const chat = conversationalReply(original);

    if (chat) return chat;

    // Perintah membuka halaman.
    const page = findPageIntent(original);

    if (page) {
      const opened = openPage(page);

      if (opened) {
        return {
          text: `Siap! 😸 Miko membuka halaman **${page.name}** untukmu.`,
          mood: 'excited'
        };
      }

      return {
        text:
          `Aku memahami kamu ingin membuka halaman **${page.name}**. 🐱\n\n` +
          'Namun, tombol navigasi halaman itu belum berhasil ditemukan. Mungkin aplikasi menggunakan navigasi internal yang perlu dihubungkan melalui app.js.',
        mood: 'curious'
      };
    }

    // Pertanyaan tentang percakapan sebelumnya.
    if (/\b(apa yang tadi|ingat percakapan|percakapan sebelumnya|obrolan sebelumnya|ingat yang tadi)\b/.test(text)) {
      const recent = getLastUserMessages(6);

      if (recent.length) {
        return {
          text:
            'Ini beberapa hal yang terakhir kita bicarakan:\n\n' +
            recent.map(item => `• ${clean(item)}`).join('\n'),
          mood: 'focused'
        };
      }

      return {
        text: 'Belum ada percakapan sebelumnya yang tersimpan di riwayat lokal.',
        mood: 'curious'
      };
    }

    // Permintaan lanjutan.
    if (
      isFollowUpText(text) &&
      getPreviousTopic()
    ) {
      const followUp = makeFollowUpAnswer(
        searchText,
        knowledge
      );

      if (
        /\b(ulang|jelasin lagi|lebih gampang|lebih sederhana|kurang paham|belum paham)\b/.test(text)
      ) {
        return followUp;
      }

      if (
        /\b(contoh|contohnya|misalnya)\b/.test(text)
      ) {
        return {
          text:
            followUp.text +
            '\n\nContoh atau gambaran sederhananya bisa kita bahas berdasarkan bagian yang kamu maksud.',
          mood: 'curious'
        };
      }

      return followUp;
    }

    // Cari materi dengan kalimat lengkap.
    let query = searchText;

    // Bila kalimat merupakan pertanyaan singkat lanjutan,
    // gabungkan dengan topik sebelumnya.
    if (
      getPreviousTopic() &&
      getUsefulWords(query).length <= 2 &&
      isFollowUpText(text)
    ) {
      query = getPreviousTopic() + ' ' + query;
    }

    const material = findBestMaterial(
      query,
      knowledge
    );

    if (material) {
      return {
        text: makeMaterialAnswer(material, query),
        mood: 'focused'
      };
    }

    // Jika pengguna meminta pembahasan teknologi tetapi
    // istilahnya belum cocok, jangan asal mengarang materi.
    const usefulWords = getUsefulWords(searchText);

    if (usefulWords.length) {
      return {
        text:
          'Hmm, Miko menangkap kamu sedang menanyakan sesuatu, tetapi belum menemukan materi yang cocok. 🐱\n\n' +
          'Coba ceritakan dengan kalimat yang sedikit berbeda. Kamu juga boleh menyebut satu kata penting saja, misalnya "DNS", "router", "VLAN", atau "subnetting".',
        mood: 'curious'
      };
    }

    return {
      text:
        'Miko mendengarkan. 😸 Ceritakan sedikit lagi apa yang sedang kamu pikirkan. Tidak perlu takut salah mengetik.',
      mood: 'gentle'
    };
  }

  // =======================================================
  // 9. PUBLIC API
  // =======================================================

  window.NQ_MIKO_REPLY = function(message, knowledge) {
    const userMessage = clean(message).slice(0, 400);

    // Tetap sinkron untuk kompatibilitas app.js.
    const result = buildReply(
      userMessage,
      knowledge
    );

    saveMessage('user', userMessage);
    saveMessage('assistant', result.text);

    return {
      text: result.text,
      mood: result.mood || 'happy'
    };
  };

  window.NQ_MIKO_GET_HISTORY = getHistory;

  window.NQ_MIKO_CLEAR_HISTORY = function() {
    try {
      localStorage.removeItem(STORAGE_KEY);

      const memory = window.NQ_MIKO_MEMORY;

      if (
        memory &&
        typeof memory.clearMessages === 'function'
      ) {
        memory.clearMessages().catch(console.warn);
      }

      if (typeof oldClearHistory === 'function') {
        // Fungsi lama tidak perlu dipanggil lagi karena
        // riwayat sudah dibersihkan oleh fungsi ini.
      }

      return true;
    } catch (error) {
      console.warn('Gagal menghapus riwayat Miko:', error);
      return false;
    }
  };

  window.NQ_MIKO_GET_STATS = function() {
    const history = getHistory();
    const materials = getKnowledge([]);

    return {
      history: history.length,
      maxHistory: MAX_HISTORY,
      materials: materials.length,
      pages: pages.length,
      memoryAvailable: Boolean(window.NQ_MIKO_MEMORY)
    };
  };

  console.info(
    'Miko Conversation Engine 2.0 aktif.',
    window.NQ_MIKO_GET_STATS()
  );

})();