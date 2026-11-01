/* MIKO ASSISTANT - NETQUEST
   Kompatibel dengan app.js:
   window.NQ_MIKO_REPLY(message, knowledge)
   Mengembalikan { text, mood } secara sinkron.
*/
(() => {
  'use strict';

  const STORAGE_KEY = 'nq_miko_conversation_v1';
  const MAX_HISTORY = 80;

  const clean = value => String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalize = value => clean(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const stopWords = new Set([
    'apa','apakah','itu','ini','yang','dan','di','ke','dari','untuk',
    'dengan','cara','bagaimana','jelaskan','tolong','dong','sih',
    'ya','nih','aku','saya','kamu','nya','adalah','bisa','dapat',
    'lebih','lanjut','tentang','pada','dalam','sebuah','the','what',
    'is','how','can','in','of','a','to','and','please','explain'
  ]);
  const commonVocabulary = [
    'jelaskan','jelasin','subnetting','jaringan','internet','komputer',
    'vlan','router','switch','dhcp','dns','wifi','kabel','materi',
    'apa','bagaimana','kenapa','contoh','caranya','halo','hai','hello',
    'miki','miko','terima','kasih','makasih','bingung','maksudnya'
  ];
  const vocabularyCache = new WeakMap();

  function editDistanceWithinOne(left, right) {
    if (Math.abs(left.length - right.length) > 1) return false;
    if (left.length === right.length) {
      const differences = [];
      for (let index = 0; index < left.length; index++) {
        if (left[index] !== right[index]) differences.push(index);
      }
      if (differences.length === 2 &&
          differences[1] === differences[0] + 1 &&
          left[differences[0]] === right[differences[1]] &&
          left[differences[1]] === right[differences[0]]) return true;
    }
    let row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i++) {
      const next = [i];
      for (let j = 1; j <= right.length; j++) {
        next[j] = Math.min(
          row[j] + 1,
          next[j - 1] + 1,
          row[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
        );
      }
      row = next;
    }
    return row[right.length] <= 1;
  }

  function correctCommonTypos(text, knowledge) {
    let vocabulary = Array.isArray(knowledge) ? vocabularyCache.get(knowledge) : null;
    if (!vocabulary) {
      vocabulary = new Set(commonVocabulary);
    }
    if (Array.isArray(knowledge) && !vocabularyCache.has(knowledge)) {
      for (const entry of knowledge) {
        if (Array.isArray(entry)) {
          for (const value of entry) {
            const words = normalize(Array.isArray(value) ? value.join(' ') : value).split(' ');
            words.forEach(word => { if (word.length >= 4) vocabulary.add(word); });
          }
        }
      }
      vocabularyCache.set(knowledge, vocabulary);
    }

    return text.split(' ').map(word => {
      if (word.length < 4 || vocabulary.has(word)) return word;
      const matches = [];
      for (const candidate of vocabulary) {
        if (candidate.length < 4 || !editDistanceWithinOne(word, candidate)) continue;
        matches.push(candidate);
      }
      if (matches.length === 1) return matches[0];
      const likelyMissingLetter = matches.filter(candidate => candidate.length === word.length + 1);
      return likelyMissingLetter.length === 1 ? likelyMissingLetter[0] : word;
    }).join(' ');
  }

  function getHistory() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(history.slice(-MAX_HISTORY))
      );
    } catch (error) {
      console.warn('Riwayat Miko tidak dapat disimpan:', error);
    }
  }

  function remember(role, text) {
    const history = getHistory();
    history.push({
      role,
      text: clean(text).slice(0, 1000),
      time: Date.now()
    });
    saveHistory(history);
  }

  function getLastUserMessage(history) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') return history[i].text;
    }
    return '';
  }

  function getLastAssistantMessage(history) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'assistant') return history[i].text;
    }
    return '';
  }

  function findMaterial(query, knowledge) {
    if (!Array.isArray(knowledge)) return null;

    const words = correctCommonTypos(normalize(query), knowledge)
      .split(' ')
      .filter(word => word.length > 1 && !stopWords.has(word));

    if (!words.length) return null;

    let best = null;
    let bestScore = 0;

    for (const entry of knowledge) {
      if (!Array.isArray(entry)) continue;

      const title = normalize(entry[0] || '');
      const content = normalize(entry[1] || '');
      const keywords = normalize(
        Array.isArray(entry[2]) ? entry[2].join(' ') : entry[2] || ''
      );

      let score = 0;

      for (const word of words) {
        if (title.includes(word)) score += 5;
        if (keywords.includes(word)) score += 4;
        if (content.includes(word)) score += 1;
      }

      if (title && normalize(query).includes(title)) score += 10;

      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }

    return bestScore >= 2 ? best : null;
  }

  function makeMaterialAnswer(entry, english = false) {
    const title = clean(entry[0] || 'Materi TJKT');
    const content = clean(entry[1] || '');

    if (!content) {
      return `Aku menemukan materi "${title}", tetapi isi materinya belum tersedia.`;
    }

    const excerpt = content.length > 1400
      ? content.slice(0, 1400).trim() + '...'
      : content;

    return english
      ? `📘 **${title}**\n\n${excerpt}\n\nThis lesson is currently written in Indonesian. If something is unclear, tell me which part and I will help explain it.`
      : `📘 **${title}**\n\n${excerpt}\n\nKalau ada bagian yang belum jelas, sebutkan bagian tersebut. Kita bahas satu per satu, ya!`;
  }

  function isFollowUp(text) {
    return /\b(lanjut|lanjutkan|lebih detail|lebih lengkap|jelaskan lagi|maksudnya|contohnya|contoh|kenapa|mengapa|bagaimana|terus|yang tadi|itu tadi|ulang|perjelas|continue|more detail|explain again|what do you mean|example|why|how|repeat|clarify)\b/i.test(text);
  }

  function buildReply(message, knowledge) {
    const text = correctCommonTypos(normalize(message), knowledge);
    const english = document.documentElement.lang === 'en';
    const history = getHistory();
    const previousQuestion = getLastUserMessage(history);
    const previousAnswer = getLastAssistantMessage(history);

    if (!text) {
      return {
        text: english
          ? 'What would you like to ask? I am ready to help you learn TJKT. 🐱'
          : 'Ada yang mau kamu tanyakan? Aku siap membantu belajar TJKT. 🐱',
        mood: 'happy'
      };
    }
// Obrolan santai
if (/\b(bosen|bosan|jenuh|gabut)\b/.test(text)) {
  return {
    text: english
      ? 'Feeling bored? 😹 We can chat, share a fun technology fact, or play a guessing game!'
      : 'Waduh, lagi bosan ya? 😹 Kita ngobrol santai saja! Mau dengar fakta unik tentang teknologi, main tebak-tebakan, atau cerita hal random?',
    mood: 'happy'
  };
}

if (/\b(sedih|capek|lelah|pusing|stres)\b/.test(text)) {
  return {
    text: english
      ? 'Sounds like you could use a break. That is okay—we can take it slowly. Want to talk about something light? 🐱'
      : 'Sepertinya kamu sedang kurang bersemangat. Tidak apa-apa, kita santai dulu. Mau cerita atau ngobrol tentang hal ringan? 🐱',
    mood: 'gentle'
  };
}

if (/\b(ngobrol|cerita|temani|temenin)\b/.test(text)) {
  return {
    text: english
      ? 'Of course! 😸 I am here to chat. Did anything interesting happen today?'
      : 'Tentu! 😸 Aku siap ngobrol. Hari ini ada hal menarik yang terjadi?',
    mood: 'happy'
  };
}

if (/\b(haha|wkwk|hahaha|hehe)\b/.test(text)) {
  return {
    text: english ? 'Haha 😹 Something funny?' : 'Wkwkwk 😹 Ada yang lucu, nih?',
    mood: 'happy'
  };
}
    if (/^(hai|halo|hello|hi|p|hei|hey)$/.test(text)) {
      return {
        text: english
          ? 'Hi! 🐱 What would you like to learn today? We can explore networking, computers, servers, Linux, or other TJKT topics.'
          : 'Hai! 🐱 Ada yang ingin kamu pelajari hari ini? Kita bisa bahas jaringan, komputer, server, Linux, atau materi TJKT lainnya.',
        mood: 'happy'
      };
    }

    if (/\b(terima kasih|makasih|thanks|thank you)\b/.test(text)) {
      return {
        text: english
          ? 'You are welcome! I am glad I could help. Ask me if anything is still unclear. 🐱'
          : 'Sama-sama! Senang bisa membantu. Kalau masih ada yang membingungkan, tanyakan saja, ya! 🐱',
        mood: 'happy'
      };
    }

    if (/\b(siapa kamu|kamu siapa|nama kamu|kenalan)\b/.test(text)) {
      return {
        text: english
          ? 'I am Miko, your learning buddy in Neko! 🐱 I can help explain TJKT topics, find lessons, and explore networking concepts with you.'
          : 'Aku Miko, teman belajar di Neko! 🐱 Aku bisa membantu menjelaskan materi TJKT, mencari materi, dan menemanimu memahami konsep jaringan komputer.',
        mood: 'excited'
      };
    }

    if (/\b(apa kabar|bagaimana kabarmu|kabar kamu)\b/.test(text)) {
      return {
        text: 'Aku baik dan siap menemanimu belajar! Kamu sendiri, sudah siap menjelajahi dunia TJKT? 😸',
        mood: 'happy'
      };
    }

    if (/\b(lucu|lelucon|jokes|tebak tebakan)\b/.test(text)) {
      return {
        text: 'Kenapa komputer jarang kehujanan? Karena selalu punya firewall! 😹',
        mood: 'dance'
      };
    }

    if (/\b(ingat|mengingat|percakapan sebelumnya|obrolan sebelumnya|yang pernah kita bahas|apa yang tadi)\b/.test(text)) {
      const recent = history
        .filter(item => item.role === 'user')
        .slice(-6)
        .map(item => '• ' + item.text);

      if (recent.length) {
        return {
          text: 'Ini beberapa hal yang terakhir kita bicarakan:\n\n' + recent.join('\n') +
            '\n\nAku menyimpan riwayat ini di perangkatmu agar bisa menjadi konteks obrolan berikutnya.',
          mood: 'focused'
        };
      }
    }

    let query = message;

    if (isFollowUp(text) && previousQuestion) {
      query = previousQuestion + ' ' + text;
    }

    let material = findMaterial(query, knowledge);

    if (!material && isFollowUp(text) && previousQuestion) {
      material = findMaterial(previousQuestion, knowledge);
    }

    if (material) {
      return {
        text: makeMaterialAnswer(material, english),
        mood: 'focused'
      };
    }

    if (isFollowUp(message) && previousAnswer) {
      return {
        text: (english ? 'From our previous discussion:\n\n' : 'Dari pembahasan kita sebelumnya:\n\n') +
          previousAnswer.slice(0, 1000) +
          (english ? '\n\nWhat would you like to explore further? I can try to explain it more simply.' : '\n\nBagian mana yang ingin kamu perdalam? Aku akan coba menjelaskannya dengan cara yang lebih sederhana.'),
        mood: 'curious'
      };
    }

    if (/\b(misi|mission|tantangan)\b/.test(text)) {
      return {
        text: english
          ? 'Open Missions in Neko to solve networking cases. Look at the symptoms and choose the most sensible troubleshooting step. 🐱'
          : 'Kamu bisa membuka bagian Misi di Neko untuk menyelesaikan kasus jaringan. Perhatikan gejala masalahnya, lalu pilih langkah pemeriksaan yang paling masuk akal. 🐱',
        mood: 'excited'
      };
    }

    if (/\b(game|permainan|bermain|main apa)\b/.test(text)) {
      return {
        text: english
          ? 'Neko has several learning games! Open the Games section and choose a challenge to play.'
          : 'Ada beberapa permainan belajar di Neko! Coba buka bagian permainan dan pilih tantangan yang ingin kamu selesaikan.',
        mood: 'dance'
      };
    }

    return {
      text: english
        ? 'I could not find a matching answer in Neko’s local lessons. 🐱\n\nTry a more specific topic, such as “What is subnetting?”, “Explain VLANs”, or “How does DHCP work?”.'
        : 'Aku belum menemukan jawaban yang cocok di materi lokal Neko. 🐱\n\nCoba tulis topiknya lebih spesifik, misalnya: "Apa itu subnetting?", "Jelaskan VLAN", atau "Bagaimana cara kerja DHCP?".',
      mood: 'curious'
    };
  }

  window.NQ_MIKO_REPLY = function(message, knowledge) {
    const userMessage = clean(message).slice(0, 400);
    const result = buildReply(userMessage, knowledge);

    // Simpan pertanyaan dan jawaban untuk konteks percakapan berikutnya.
    remember('user', userMessage);
    remember('assistant', result.text);

    return result;
  };

  // Fungsi opsional untuk melihat dan menghapus riwayat Miko.
  window.NQ_MIKO_GET_HISTORY = getHistory;

  window.NQ_MIKO_CLEAR_HISTORY = function() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      return false;
    }
  };

})();