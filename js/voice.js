
/* ============================================================
   NEKO VOICE SYSTEM
   Indonesian TTS • Character Personas • Queue Manager
   ============================================================ */

(() => {
  'use strict';

  const PERSONAS = {
    narrator: {
      gender: 'female',
      pitch: 1.02,
      rate: 0.91,
      volume: 1
    },

    // Miki: ceria, imut, energik, suara perempuan muda
    miki: {
      gender: 'female',
      pitch: 1.24,
      rate: 0.96,
      volume: 1
    },

    // Miko: ceria, ramah, suara laki-laki muda
    miko: {
      gender: 'male',
      pitch: 0.98,
      rate: 0.97,
      volume: 1
    },

    // Neksya: manis, ekspresif, bernada lebih tinggi
    neksya: {
      gender: 'female',
      pitch: 1.38,
      rate: 0.95,
      volume: 1
    }
  };

  const MAX_QUEUE = 6;
  const DUPLICATE_DELAY = 2600;

  let voices = [];
  let queue = [];
  let speaking = false;
  let enabled = true;
  let voicesLoaded = false;
  let lastText = '';
  let lastTime = 0;
  let currentUtterance = null;

  const synth = window.speechSynthesis;

  if (!('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined') {
    console.warn('[NEKO Voice] Browser tidak mendukung Speech Synthesis.');
    return;
  }

  /* ============================================================
     VOICE LIST
     ============================================================ */

  function refreshVoices() {
    voices = synth.getVoices() || [];
    voicesLoaded = voices.length > 0;

    return voices;
  }

  function isIndonesia(voice) {
    const lang = String(voice?.lang || '').toLowerCase();

    return lang === 'id' || lang.startsWith('id-');
  }

  function isFemale(voice) {
    const name = String(voice?.name || '').toLowerCase();

    return /female|woman|perempuan|gadis|google indonesia female/i.test(name);
  }

  function isMale(voice) {
    const name = String(voice?.name || '').toLowerCase();

    return /male|man|laki|pria|boy/i.test(name);
  }

  function getIndonesianVoices() {
    return voices.filter(isIndonesia);
  }

  /* ============================================================
     VOICE SELECTION
     Tidak memilih voice Inggris untuk teks Indonesia.
     ============================================================ */

  function chooseVoice(persona = 'miki') {
    const spec = PERSONAS[persona] || PERSONAS.miki;
    const indonesian = getIndonesianVoices();

    if (!indonesian.length) {
      return null;
    }

    const matching = indonesian.filter(voice => {
      if (spec.gender === 'female') {
        return isFemale(voice);
      }

      if (spec.gender === 'male') {
        return isMale(voice);
      }

      return false;
    });

    const neutral = indonesian.filter(voice => {
      return !isFemale(voice) && !isMale(voice);
    });

    return matching[0] || neutral[0] || indonesian[0];
  }

  function getVoice(persona) {
    return chooseVoice(persona);
  }

  /* ============================================================
     CHARACTER TONE
     ============================================================ */

  function getTone(persona) {
    const spec = PERSONAS[persona] || PERSONAS.miki;

    return {
      pitch: spec.pitch,
      rate: spec.rate,
      volume: spec.volume
    };
  }

  /* ============================================================
     UTTERANCE
     ============================================================ */

  function createUtterance(item) {
    const utterance = new SpeechSynthesisUtterance(item.text);
    const voice = getVoice(item.persona);
    const tone = getTone(item.persona);

    // Paksa bahasa Indonesia.
    utterance.lang = 'id-ID';

    // Jangan pernah memasang voice non-Indonesia.
    if (voice && isIndonesia(voice)) {
      utterance.voice = voice;
    }

    utterance.pitch = tone.pitch;
    utterance.rate = tone.rate;
    utterance.volume = tone.volume;

    utterance.onstart = () => {
      speaking = true;
      currentUtterance = utterance;
    };

    utterance.onend = () => {
      speaking = false;
      currentUtterance = null;
      processQueue();
    };

    utterance.onerror = (event) => {
      console.warn('[NEKO Voice] TTS error:', event.error);

      speaking = false;
      currentUtterance = null;
      processQueue();
    };

    return utterance;
  }

  /* ============================================================
     QUEUE MANAGER
     ============================================================ */

  function processQueue() {
    if (!enabled || speaking || !queue.length) {
      return;
    }

    const item = queue.shift();

    if (!item || !item.text) {
      processQueue();
      return;
    }

    const utterance = createUtterance(item);

    speaking = true;
    currentUtterance = utterance;

    try {
      synth.speak(utterance);
    } catch (error) {
      console.error('[NEKO Voice] Gagal memulai suara:', error);

      speaking = false;
      currentUtterance = null;

      processQueue();
    }
  }

  /* ============================================================
     SAY
     ============================================================ */

  function say(text, persona = 'miki', options = {}) {
    if (!enabled || typeof text !== 'string') {
      return false;
    }

    const cleanText = text.trim();

    if (!cleanText) {
      return false;
    }

    const now = Date.now();

    // Hindari ucapan yang sama berulang terlalu cepat.
    if (
      cleanText === lastText &&
      now - lastTime < DUPLICATE_DELAY
    ) {
      return false;
    }

    lastText = cleanText;
    lastTime = now;

    const normalizedPersona = PERSONAS[persona]
      ? persona
      : 'miki';

    const item = {
      text: cleanText,
      persona: normalizedPersona,
      priority: options.priority || false
    };

    if (item.priority) {
      queue.unshift(item);
    } else {
      if (queue.length >= MAX_QUEUE) {
        queue.shift();
      }

      queue.push(item);
    }

    processQueue();

    return true;
  }

  /* ============================================================
     CANCEL
     ============================================================ */

  function cancel() {
    queue = [];
    speaking = false;
    currentUtterance = null;

    try {
      synth.cancel();
    } catch (error) {
      console.warn('[NEKO Voice] Cancel gagal:', error);
    }
  }

  /* ============================================================
     ENABLE / DISABLE
     ============================================================ */

  function setEnabled(value) {
    enabled = Boolean(value);

    if (!enabled) {
      cancel();
    }

    return enabled;
  }

  function isEnabled() {
    return enabled;
  }

  /* ============================================================
     CHARACTER INFORMATION
     ============================================================ */

  function getCharacters() {
    return {
      narrator: {
        name: 'Narrator',
        description: 'Tenang, jelas, dan nyaman didengar.'
      },

      miki: {
        name: 'Miki',
        description: 'Ceria, imut, energik, dan ekspresif.'
      },

      miko: {
        name: 'Miko',
        description: 'Ramah, ceria, ringan, dan bersahabat.'
      },

      neksya: {
        name: 'Neksya',
        description: 'Manis, ceria, ekspresif, dan bernada tinggi.'
      }
    };
  }

  function getVoiceInfo() {
    const indonesian = getIndonesianVoices();

    return {
      supported: true,
      enabled,
      speaking,
      queueLength: queue.length,
      voicesLoaded,
      totalVoices: voices.length,
      indonesiaAvailable: indonesian.length > 0,

      indonesiaVoices: indonesian.map(voice => ({
        name: voice.name,
        lang: voice.lang,
        default: voice.default
      }))
    };
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */

  window.Neko = window.Neko || {};

  window.Neko.voice = {
    say,
    cancel,
    enabled: isEnabled,
    setEnabled,
    refresh: refreshVoices,
    getCharacters,
    getVoiceInfo,

    get isSpeaking() {
      return speaking;
    },

    get queueLength() {
      return queue.length;
    },

    get indonesiaAvailable() {
      return getIndonesianVoices().length > 0;
    },

    get voicesLoaded() {
      return voicesLoaded;
    }
  };

  /* ============================================================
     INITIALIZATION
     ============================================================ */

  refreshVoices();

  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', refreshVoices);
  } else {
    synth.onvoiceschanged = refreshVoices;
  }

  // Beberapa browser baru memuat daftar voice setelah halaman aktif.
  window.addEventListener('load', refreshVoices);

  console.info('[NEKO Voice] Voice system initialized.');
})();
