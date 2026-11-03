
/* ============================================================
   NEKO · js/voice.js
   Indonesian Text-to-Speech Character System
   - Tetap berbicara meskipun voice Indonesia belum terdeteksi
   - Memprioritaskan suara Indonesia
   - Memiliki karakter suara berbeda
   - Mendukung Miki, Miko, Neksya, dan Narrator
   ============================================================ */

(function () {
  'use strict';

  const Neko = window.Neko = window.Neko || {};

  const PERSONAS = {
    narrator: {
      gender: 'female',
      pitch: 1.08,
      rate: 0.91
    },

    miki: {
      gender: 'female',
      pitch: 1.20,
      rate: 0.92
    },

    miko: {
      gender: 'male',
      pitch: 1.40,
      rate: 0.98
    },

    neksya: {
      gender: 'female',
      pitch: 1.90,
      rate: 0.90
    }
  };

  let voiceCache = {};
  let lastSpeech = {};
  let voicesLoaded = false;
  let speechQueueTimer = null;

  function speech() {
    return window.speechSynthesis || null;
  }

  function voiceList() {
    const engine = speech();

    if (!engine) return [];

    try {
      return engine.getVoices() || [];
    } catch (error) {
      return [];
    }
  }

  function isIndonesia(voice) {
    const lang = String(voice.lang || '').toLowerCase();
    const name = String(voice.name || '').toLowerCase();

    return (
      lang === 'id' ||
      lang.startsWith('id-') ||
      name.includes('indonesia') ||
      name.includes('indonesian')
    );
  }

  function voiceLabel(voice) {
    return (
      String(voice.name || '') +
      ' ' +
      String(voice.lang || '')
    ).toLowerCase();
  }

  function isFemale(voice) {
    return /female|woman|wanita|perempuan|zira|samantha|aria|jenny|heera|nadia|gadis/i
      .test(voiceLabel(voice));
  }

  function isMale(voice) {
    return /male|man|pria|cowok|david|mark|guy|fred|ardi|andika/i
      .test(voiceLabel(voice));
  }

  function chooseVoice(persona) {
    const all = voiceList();

    if (!all.length) return null;

    const spec = PERSONAS[persona] || PERSONAS.miki;

    // Utamakan suara Indonesia.
    const indonesian = all.filter(isIndonesia);

    // Jika ada suara Indonesia, gunakan itu.
    // Jika tidak ada, jangan memaksakan suara bahasa Inggris.
    const pool = indonesian.length ? indonesian : [];

    if (!pool.length) return null;

    const matching = pool.filter(voice => {
      if (spec.gender === 'female') return isFemale(voice);
      return isMale(voice);
    });

    const neutral = pool.filter(voice => {
      return !isFemale(voice) && !isMale(voice);
    });

    return matching[0] || neutral[0] || pool[0] || null;
  }

  function getVoice(persona) {
    if (voiceCache[persona] !== undefined) {
      return voiceCache[persona];
    }

    const selected = chooseVoice(persona);

    voiceCache[persona] = selected;

    return selected;
  }

  function refreshVoices() {
    voicesLoaded = true;
    voiceCache = {};

    return voiceList();
  }

  function setupVoiceListener() {
    const engine = speech();

    if (!engine) return;

    try {
      engine.addEventListener('voiceschanged', refreshVoices);
    } catch (error) {
      // Browser tidak mendukung event ini.
    }

    refreshVoices();
  }

  function clean(raw) {
    return String(raw || '')
      .replace(/[\r\n]+/g, '. ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 380);
  }

  function enabled() {
    const prefs = (Neko.store && Neko.store.prefs) || {};

    return prefs.charVoice !== false;
  }

  function setEnabled(on) {
    const value = Boolean(on);

    if (
      Neko.store &&
      typeof Neko.store.patchPrefs === 'function'
    ) {
      Neko.store.patchPrefs({
        charVoice: value
      });
    }

    if (!value) {
      cancel();
    }
  }

  function cancel() {
    const engine = speech();

    if (!engine) return;

    if (speechQueueTimer) {
      window.clearTimeout(speechQueueTimer);
      speechQueueTimer = null;
    }

    try {
      engine.cancel();
    } catch (error) {
      // Abaikan.
    }
  }

  function getTone(persona, voice) {
    const spec = PERSONAS[persona] || PERSONAS.miki;

    let pitch = spec.pitch;

    // Sedikit penyesuaian berdasarkan voice perangkat.
    if (voice) {
      if (spec.gender === 'female' && isMale(voice)) {
        pitch += 0.10;
      }

      if (spec.gender === 'male' && isFemale(voice)) {
        pitch -= 0.08;
      }
    }

    return {
      pitch: Math.max(0.5, Math.min(2, pitch)),
      rate: spec.rate,
      volume: 1
    };
  }

  function say(raw, persona) {
    const engine = speech();

    if (!engine || !enabled()) return;

    const text = clean(raw);

    if (!text) return;

    const key = PERSONAS[persona] ? persona : 'miki';

    const now = Date.now();

    // Hindari kalimat identik dibacakan berulang.
    if (
      lastSpeech[key] &&
      lastSpeech[key].text === text &&
      now - lastSpeech[key].time < 2600
    ) {
      return;
    }

    lastSpeech[key] = {
      text: text,
      time: now
    };

    // Cari suara Indonesia jika tersedia.
    const voice = getVoice(key);

    const tone = getTone(key, voice);

    let utterance;

    try {
      utterance = new SpeechSynthesisUtterance(text);

      // Tetapkan bahasa Indonesia.
      utterance.lang = 'id-ID';

      // Voice bersifat opsional.
      // Jika belum tersedia, browser tetap mencoba membaca.
      if (voice) {
        utterance.voice = voice;
      }

      utterance.pitch = tone.pitch;
      utterance.rate = tone.rate;
      utterance.volume = tone.volume;

    } catch (error) {
      console.error('[NEKO Voice] Gagal membuat ucapan:', error);
      return;
    }

    // Hentikan ucapan sebelumnya agar tidak bertumpuk.
    try {
      engine.cancel();
    } catch (error) {
      // Abaikan.
    }

    if (speechQueueTimer) {
      window.clearTimeout(speechQueueTimer);
    }

    // Beri waktu Chromium menyelesaikan cancel().
    speechQueueTimer = window.setTimeout(function () {
      speechQueueTimer = null;

      if (!enabled()) return;

      try {
        engine.speak(utterance);
      } catch (error) {
        console.error('[NEKO Voice] Gagal memutar suara:', error);
      }
    }, 120);
  }

  function available() {
    return Boolean(speech());
  }

  function indonesiaAvailable() {
    return voiceList().some(isIndonesia);
  }

  function getCharacters() {
    return Object.keys(PERSONAS);
  }

  // Siapkan daftar suara.
  setupVoiceListener();

  // Beberapa browser baru memuat daftar suara setelah halaman siap.
  window.addEventListener('load', refreshVoices);

  // API publik NEKO.
  Neko.voice = {
    say: say,
    cancel: cancel,
    enabled: enabled,
    setEnabled: setEnabled,
    refresh: refreshVoices,
    getCharacters: getCharacters,

    get available() {
      return available();
    },

    get indonesiaAvailable() {
      return indonesiaAvailable();
    },

    get voicesLoaded() {
      return voicesLoaded;
    }
  };

})();
