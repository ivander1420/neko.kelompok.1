(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const status = $('#nqLiveStatus');
  const panel = $('#nqLiveRoom');
  if (!panel) return;

  const fields = {
    endpoint: $('#nqLiveServer'),
    title: $('#nqLiveRoomTitle'),
    roomId: $('#nqLiveRoomId'),
    name: $('#nqLiveName')
  };
  const avatarChoices = {
    gender: [{ value: 'neutral', label: 'Netral' }, { value: 'girl', label: 'Cewek' }, { value: 'boy', label: 'Cowok' }],
    hair: [{ value: 'curly', label: 'Keriting' }, { value: 'short', label: 'Pendek' }, { value: 'long', label: 'Panjang' }, { value: 'spiky', label: 'Runcing' }, { value: 'wavy', label: 'Bergelombang' }, { value: 'braids', label: 'Kepang' }, { value: 'fade', label: 'Fade' }, { value: 'bun', label: 'Sanggul' }],
    accessory: [{ value: 'none', label: 'Tanpa aksesori' }, { value: 'glasses', label: 'Kacamata' }, { value: 'cap', label: 'Topi' }, { value: 'headphones', label: 'Headphone' }, { value: 'ribbon', label: 'Pita' }],
    outfit: [{ value: 'uniform', label: 'Seragam sekolah' }, { value: 'hoodie', label: 'Hoodie' }, { value: 'sport', label: 'Olahraga' }, { value: 'lab', label: 'Jas lab' }]
  };
  const avatarLabels = Object.fromEntries(Object.entries(avatarChoices).map(([key, choices]) => [key, Object.fromEntries(choices.map(choice => [choice.value, choice.label]))]));
  const defaultAvatar = { gender: 'neutral', hair: 'curly', accessory: 'none', outfit: 'uniform' };
  let avatarState = { ...defaultAvatar };
  let avatarIllustrationId = 0;
  let socket = null;
  let roomState = null;
  let role = '';
  let roomId = '';
  let countdownTimer = null;
  let connectingAction = null;

  const storage = {
    get(key) { try { return sessionStorage.getItem(key) || ''; } catch (cause) { console.warn('Sesi room tidak dapat dibaca.', cause); return ''; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch (cause) { console.warn('Sesi room tidak dapat disimpan.', cause); } },
    clear() { try { sessionStorage.removeItem('nq_live_room'); sessionStorage.removeItem('nq_live_token'); } catch (cause) { console.warn('Sesi room tidak dapat dibersihkan.', cause); } }
  };

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function avatarSvg(avatar = defaultAvatar) {
    const illustrationId = ++avatarIllustrationId;
    const ids = {
      skin: `avatar-skin-${illustrationId}`,
      hair: `avatar-hair-${illustrationId}`,
      clothes: `avatar-clothes-${illustrationId}`,
      face: `avatar-face-${illustrationId}`
    };
    const gender = ['neutral', 'girl', 'boy'].includes(avatar.gender) ? avatar.gender : 'neutral';
    const hair = ['curly', 'short', 'long', 'spiky', 'wavy', 'braids', 'fade', 'bun'].includes(avatar.hair) ? avatar.hair : 'curly';
    const accessory = ['none', 'glasses', 'cap', 'headphones', 'ribbon'].includes(avatar.accessory) ? avatar.accessory : 'none';
    const outfit = ['uniform', 'hoodie', 'sport', 'lab'].includes(avatar.outfit) ? avatar.outfit : 'uniform';
    const skin = gender === 'girl' ? '#e9a978' : gender === 'boy' ? '#bd8058' : '#d79a6c';
    const hairColor = gender === 'boy' ? '#68412d' : '#765040';
    const clothes = { uniform: '#4d9fbd', hoodie: '#9063bd', sport: '#42a982', lab: '#e8eef1' }[outfit];
    const hairShapes = {
      curly: `<path d="M25 36q-3-21 14-25 4-10 15-6 10-10 19-1 13-1 15 13 11 8 7 20l-9-4-7-12q-12 7-32 4l-13 11z" fill="${hairColor}"/><circle cx="31" cy="27" r="7" fill="${hairColor}"/><circle cx="43" cy="16" r="7" fill="${hairColor}"/><circle cx="57" cy="12" r="7" fill="${hairColor}"/><circle cx="72" cy="17" r="7" fill="${hairColor}"/>`,
      short: `<path d="M25 36q-3-25 25-29 28-4 29 27l-8-5-3-10q-15 8-35 6z" fill="${hairColor}"/>`,
      long: `<path d="M25 43q-3-28 25-32 28-4 29 28l-1 40-12 4-3-37q-16 5-28-1l-2 37-12-5z" fill="${hairColor}"/>`,
      spiky: `<path d="m25 36 2-17 12 7-1-18 17 11 8-18 9 19 14-8-1 22-10-5-4-9q-17 8-35 5z" fill="${hairColor}"/>`,
      wavy: `<path d="M25 36q-2-26 24-29 27-4 30 25l-5 5q-5-7-1-13-9 5-16-1-12 9-25 4l-5 14z" fill="${hairColor}"/><path d="M28 34q5-7 2-13m10 11q6-7 3-14m12 13q6-7 3-14m12 14q5-5 4-11" fill="none" stroke="#b48b69" stroke-opacity=".5" stroke-width="2"/>`,
      braids: `<path d="M25 37q-3-27 25-31 28-4 29 29l-8-8-3-12q-15 9-35 6z" fill="${hairColor}"/><path d="M27 42q-6 8 0 15-6 7 1 14-5 7 2 13l8-3q-5-7 1-12-7-7-1-13-7-7-2-13m39-1q6 8 0 15 6 7-1 14 5 7-2 13l-8-3q5-7-1-12 7-7 1-13 7-7 2-13" fill="${hairColor}"/>`,
      fade: `<path d="M27 38q-4-24 23-30 27-5 28 27l-8-4-3-9q-14 8-34 6z" fill="${hairColor}"/><path d="M27 33q-4 4-2 13m49-13q4 4 2 13" fill="none" stroke="#a77f5f" stroke-opacity=".65" stroke-width="3"/>`,
      bun: `<path d="M25 37q-3-27 25-31 28-4 29 29l-8-7-3-12q-15 9-35 6z" fill="${hairColor}"/><circle cx="76" cy="17" r="10" fill="${hairColor}"/>`
    }[hair];
    const details = {
      uniform: `<path d="m37 75 13 8 10-8 12 8 6 36H22l5-36z" fill="#eef5f2"/><path d="m50 83 10 0 7 36H44z" fill="${clothes}"/><path d="m30 94 13-4m28 4-13-4" stroke="#77afc1" stroke-width="2"/>`,
      hoodie: `<path d="M34 76q16-10 32 0l17 12-7 31H24l-7-31z" fill="${clothes}"/><path d="M39 76q11 17 22 0m-11 13v13" fill="none" stroke="#c9afe1" stroke-width="3" stroke-linecap="round"/>`,
      sport: `<path d="m36 76 14 8 14-8 17 12-8 31H27l-8-31z" fill="${clothes}"/><path d="m35 81 15 9 15-9m-15 9v29" fill="none" stroke="#e9f6ec" stroke-width="3"/>`,
      lab: `<path d="m37 76 13 8 14-8 17 12-8 31H27l-8-31z" fill="${clothes}"/><path d="m50 84 7 10-7 25-7-25z" fill="#a9c5cc"/><path d="m37 78 13 8 14-8m-27 7 10 8m18-8-10 8" fill="none" stroke="#9eafb3" stroke-width="2"/>`
    }[outfit];
    const accessoryMarkup = {
      none: '',
      glasses: `<g fill="none" stroke="#263b55" stroke-width="2.5"><rect x="31" y="39" width="17" height="12" rx="5"/><rect x="53" y="39" width="17" height="12" rx="5"/><path d="M48 44h5"/></g>`,
      cap: `<path d="M26 34q3-24 25-24 22 0 25 24-24-11-50 0" fill="#5a84dc"/><path d="M23 34q24-9 55 0-2 6-16 5-19-2-39 1z" fill="#4169b8"/>`,
      headphones: `<path d="M27 41V34a24 24 0 0 1 48 0v7" fill="none" stroke="#66b8c5" stroke-width="5"/><rect x="23" y="39" width="9" height="17" rx="4" fill="#66b8c5"/><rect x="70" y="39" width="9" height="17" rx="4" fill="#66b8c5"/>`,
      ribbon: `<path d="M70 25q-13-13-16-5 0 6 14 8-13 4-10 10 3 6 13-5 12 10 15 5 3-6-10-10 14-1 13-7-2-8-15 4z" fill="#f08caf" stroke="#cb668b" stroke-width="1.5"/><circle cx="70" cy="28" r="3" fill="#ffe5aa"/>`
    }[accessory];
    return `<svg viewBox="0 0 100 124" role="img" aria-label="Ilustrasi avatar siswa bergaya 3D"><defs><linearGradient id="${ids.skin}" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#fff0d6"/><stop offset=".42" stop-color="${skin}"/><stop offset="1" stop-color="#a96e50"/></linearGradient><linearGradient id="${ids.hair}" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#a27652"/><stop offset=".5" stop-color="${hairColor}"/><stop offset="1" stop-color="#392b27"/></linearGradient><linearGradient id="${ids.clothes}" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#ffffff" stop-opacity=".5"/><stop offset=".4" stop-color="${clothes}"/><stop offset="1" stop-color="#263d50" stop-opacity=".42"/></linearGradient><radialGradient id="${ids.face}" cx=".34" cy=".24" r=".75"><stop stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><ellipse cx="50" cy="119" rx="27" ry="4" fill="#182a37" opacity=".18"/><path d="M43 69h14v14H43z" fill="url(#${ids.skin})"/><path d="M21 119q2-36 29-37 27 1 29 37z" fill="url(#${ids.clothes})"/><path d="M27 95q23 8 46 0" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="5"/><ellipse cx="50" cy="42" rx="24" ry="28" fill="url(#${ids.skin})"/><ellipse cx="50" cy="42" rx="24" ry="28" fill="url(#${ids.face})"/><ellipse cx="38" cy="52" rx="4" ry="2" fill="#e98082" opacity=".34"/><ellipse cx="62" cy="52" rx="4" ry="2" fill="#e98082" opacity=".34"/><path d="M42 43h1m14 0h1" stroke="#3b2b29" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="42" r="1" fill="#fff"/><circle cx="57" cy="42" r="1" fill="#fff"/><path d="M45 55q5 5 10 0" fill="none" stroke="#844b47" stroke-width="2" stroke-linecap="round"/>${hairShapes.replaceAll(hairColor, `url(#${ids.hair})`)}${accessoryMarkup}${details.replaceAll(clothes, `url(#${ids.clothes})`)}</svg>`;
  }

  function renderAvatarPicker() {
    const host = $('#nqAvatarCustomizer');
    const preview = $('#nqAvatarPreview');
    if (!host || !preview) return;
    preview.innerHTML = avatarSvg(avatarState);
    preview.setAttribute('aria-label', `Karakter ${avatarLabels.gender[avatarState.gender]} dengan rambut ${avatarLabels.hair[avatarState.hair]}, aksesori ${avatarLabels.accessory[avatarState.accessory]}, dan pakaian ${avatarLabels.outfit[avatarState.outfit]}`);
    host.replaceChildren();
    for (const [category, choices] of Object.entries(avatarChoices)) {
      const section = document.createElement('section');
      section.className = 'nq-avatar-choice-group';
      const heading = document.createElement('h4');
      heading.textContent = { gender: 'Karakter', hair: 'Gaya rambut', accessory: 'Aksesori', outfit: 'Pakaian' }[category];
      const options = document.createElement('div');
      options.className = `nq-avatar-options nq-avatar-options-${category}`;
      options.setAttribute('role', 'group');
      options.setAttribute('aria-label', heading.textContent);
      for (const choice of choices) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'nq-avatar-option';
        button.dataset.avatarCategory = category;
        button.dataset.avatarValue = choice.value;
        button.setAttribute('aria-pressed', String(avatarState[category] === choice.value));
        const figure = document.createElement('span');
        figure.className = 'nq-avatar-option-figure';
        figure.innerHTML = avatarSvg({ ...avatarState, [category]: choice.value });
        const name = document.createElement('span');
        name.className = 'sr-only';
        name.textContent = choice.label;
        button.append(figure, name);
        options.append(button);
      }
      section.append(heading, options);
      host.append(section);
    }
  }

  try {
    const savedAvatar = JSON.parse(sessionStorage.getItem('nq_live_avatar') || 'null');
    if (savedAvatar && Object.entries(avatarChoices).every(([key, choices]) => choices.some(choice => choice.value === savedAvatar[key]))) {
      avatarState = Object.fromEntries(Object.keys(defaultAvatar).map(key => [key, savedAvatar[key]]));
    }
  } catch (cause) {
    console.warn('Preferensi avatar tidak dapat dibaca.', cause);
  }
  renderAvatarPicker();

  function suggestedEndpoint() {
    if (location.protocol === 'https:' || location.protocol === 'http:') {
      return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/realtime`;
    }
    return '';
  }

  fields.endpoint.value = storage.get('nq_live_endpoint') || suggestedEndpoint();
  fields.endpoint.addEventListener('change', () => {
    try { localStorage.setItem('nq_live_endpoint', fields.endpoint.value.trim()); }
    catch (cause) { console.warn('Alamat server tidak dapat disimpan.', cause); }
  });

  function send(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setStatus('Koneksi terputus. Sambungkan kembali sebelum melanjutkan.', true);
      return false;
    }
    socket.send(JSON.stringify(message));
    return true;
  }

  function requestImmersive() {
    if (typeof document.documentElement.requestFullscreen !== 'function') return;
    document.documentElement.requestFullscreen().catch(() => {
      setStatus('Fullscreen browser tidak tersedia; mode layar fokus tetap digunakan.');
    });
  }

  function leaveImmersive() {
    document.body.classList.remove('nq-room-immersive');
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(cause => console.warn('Fullscreen tidak dapat ditutup.', cause));
    }
  }

  function closeRoomPanel(message, isError = false) {
    roomState = null;
    storage.clear();
    panel.hidden = true;
    leaveImmersive();
    setStatus(message, isError);
  }

  function endpointUrl() {
    let url;
    try { url = new URL(fields.endpoint.value.trim()); }
    catch { throw new Error('Masukkan URL server live yang valid.'); }
    if (url.protocol === 'https:') url.protocol = 'wss:';
    else if (url.protocol === 'http:') url.protocol = 'ws:';
    if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('URL server harus menggunakan https:// atau wss://.');
    if (url.pathname === '/' || !url.pathname) url.pathname = '/realtime';
    url.hash = '';
    url.search = '';
    return url.toString();
  }

  function connect(action) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      action();
      return;
    }
    if (socket && socket.readyState === WebSocket.CONNECTING) {
      setStatus('Sedang menyambungkan ke server…');
      return;
    }
    let url;
    try { url = endpointUrl(); }
    catch (cause) { setStatus(cause.message, true); return; }
    connectingAction = action;
    setStatus('Menyambungkan ke server live…');
    try { socket = new WebSocket(url); }
    catch (cause) { setStatus(`Koneksi gagal: ${cause.message}`, true); return; }
    socket.addEventListener('open', () => {
      setStatus('Terhubung. Menyiapkan room…');
      const pending = connectingAction;
      connectingAction = null;
      if (pending) pending();
    });
    socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); }
      catch { setStatus('Server mengirim data yang tidak dapat dibaca.', true); return; }
      handleMessage(message);
    });
    socket.addEventListener('close', () => {
      clearInterval(countdownTimer);
      socket = null;
      if (!roomState) leaveImmersive();
      setStatus(roomState ? 'Koneksi terputus. Coba muat ulang atau gabung kembali.' : 'Tidak tersambung ke server live.', true);
    });
    socket.addEventListener('error', () => setStatus('Tidak dapat tersambung. Periksa alamat server dan koneksi internet.', true));
  }

  function handleMessage(message) {
    if (message.type === 'error') {
      if (!roomState) leaveImmersive();
      setStatus(message.message, true);
      return;
    }
    if (message.type === 'created' || message.type === 'joined') {
      roomId = message.roomId;
      role = message.type === 'created' ? 'host' : 'player';
      storage.set('nq_live_room', roomId);
      storage.set('nq_live_token', message.token);
      return;
    }
    if (message.type === 'resumed') {
      role = message.role;
      roomId = message.roomId;
      return;
    }
    if (message.type === 'closed') {
      closeRoomPanel(message.message, true);
      return;
    }
    if (message.type === 'state') {
      roomState = message;
      roomId = message.roomId;
      role = message.role;
      render();
    }
  }

  function renderPlayers() {
    const host = $('#nqLivePlayers');
    const players = roomState.players || [];
    $('#nqLivePlayerCount').textContent = `${players.filter(item => item.connected).length} online • ${players.length} total`;
    host.replaceChildren();
    const rankedPlayers = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'id'));
    for (const [index, player] of rankedPlayers.entries()) {
      const card = document.createElement('div');
      card.className = `nq-live-player${player.connected ? '' : ' offline'}`;
      const rank = document.createElement('span');
      rank.className = 'nq-live-rank';
      rank.textContent = String(index + 1);
      const figure = document.createElement('span');
      figure.className = 'nq-live-player-avatar';
      figure.innerHTML = avatarSvg(player.avatar);
      const details = document.createElement('span');
      details.className = 'nq-live-player-details';
      const name = document.createElement('strong');
      name.textContent = `${player.name}${player.connected ? '' : ' • terputus'}`;
      details.append(name);
      const score = document.createElement('strong');
      score.textContent = `${player.score} poin`;
      card.append(rank, figure, details, score);
      host.append(card);
    }
    if (role === 'player') {
      host.replaceChildren();
      const score = document.createElement('div');
      score.className = 'nq-live-my-score';
      score.textContent = `Skor kamu: ${roomState.score || 0} poin`;
      host.append(score);
    } else if (!players.length) {
      const empty = document.createElement('p');
      empty.className = 'nq-live-empty';
      empty.textContent = 'Siswa yang bergabung akan muncul di sini.';
      host.append(empty);
    }
    const reactions = $('#nqLiveReactions');
    reactions.replaceChildren();
    for (const item of roomState.reactions || []) {
      const bubble = document.createElement('span');
      bubble.className = 'nq-live-reaction';
      bubble.textContent = `${item.emoji} ${item.name}`;
      reactions.append(bubble);
    }
  }

  function renderStage() {
    const stage = $('#nqLiveStage');
    stage.replaceChildren();
    if (roomState.phase === 'lobby') {
      const heading = document.createElement('h3');
      heading.textContent = role === 'host' ? 'Room siap dimainkan' : 'Menunggu guru memulai kuis';
      const hint = document.createElement('p');
      hint.textContent = role === 'host' ? 'Bagikan ID room kepada siswa, lalu mulai kuis.' : 'Kamu sudah bergabung. Kirim reaksi sambil menunggu.';
      stage.append(heading, hint);
    } else if (roomState.phase === 'question') {
      renderQuestion(stage);
    } else if (roomState.phase === 'result') {
      const question = roomState.question;
      const heading = document.createElement('h3');
      heading.textContent = `Jawaban: ${question.options[question.answer]}`;
      const explanation = document.createElement('p');
      explanation.textContent = question.explanation;
      const summary = document.createElement('p');
      summary.textContent = `${roomState.answered} dari ${roomState.playerCount} peserta menjawab.`;
      stage.append(heading, explanation, summary);
      if (role === 'host') {
        const scores = document.createElement('ol');
        scores.className = 'nq-live-results';
        [...roomState.players].sort((a, b) => b.score - a.score).slice(0, 5).forEach(player => {
          const row = document.createElement('li');
          row.textContent = `${player.name}: ${player.score} poin`;
          scores.append(row);
        });
        stage.append(scores);
      } else {
        const score = document.createElement('p');
        score.className = 'nq-live-my-score';
        score.textContent = `Skor kamu: ${roomState.score || 0} poin`;
        stage.append(score);
      }
    } else {
      const heading = document.createElement('h3');
      heading.textContent = role === 'host' ? 'Kuis selesai!' : 'Kuis selesai, hebat!';
      stage.append(heading);
      if (role === 'host') {
        const scores = document.createElement('ol');
        scores.className = 'nq-live-results';
        [...roomState.players].sort((a, b) => b.score - a.score).forEach(player => {
          const row = document.createElement('li');
          row.textContent = `${player.name}: ${player.score} poin`;
          scores.append(row);
        });
        stage.append(scores);
      } else {
        const score = document.createElement('p');
        score.className = 'nq-live-my-score';
        score.textContent = `Skor akhir kamu: ${roomState.score || 0} poin`;
        stage.append(score);
      }
    }
  }

  function renderQuestion(stage) {
    const question = roomState.question;
    const heading = document.createElement('div');
    heading.className = 'nq-live-question-meta';
    heading.textContent = `SOAL ${roomState.questionIndex + 1}/${roomState.questionCount} • WAKTU `;
    const countdown = document.createElement('strong');
    countdown.id = 'nqLiveCountdown';
    heading.append(countdown);
    const prompt = document.createElement('h3');
    prompt.className = 'nq-live-question';
    prompt.textContent = question.prompt;
    stage.append(heading, prompt);
    if (role === 'player') {
      const answers = document.createElement('div');
      answers.className = 'nq-live-answers';
      question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'nq-live-answer';
        button.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
        button.disabled = roomState.submitted;
        button.addEventListener('click', () => send({ type: 'answer', choice: index }));
        answers.append(button);
      });
      const message = document.createElement('p');
      message.textContent = roomState.submitted ? 'Jawaban terkirim. Tunggu hasilnya!' : 'Pilih satu jawaban sebelum waktu habis.';
      const score = document.createElement('p');
      score.className = 'nq-live-my-score';
      score.textContent = `Skor: ${roomState.score || 0} poin`;
      stage.append(answers, message, score);
    } else {
      const hint = document.createElement('p');
      hint.textContent = `${roomState.answered} dari ${roomState.playerCount} peserta sudah menjawab.`;
      stage.append(hint);
    }
  }

  function render() {
    document.body.classList.add('nq-room-immersive');
    panel.hidden = false;
    $('#nqLiveRole').textContent = role === 'host' ? 'PANEL GURU' : 'PESERTA';
    $('#nqLiveTitle').textContent = roomState.title;
    $('#nqLiveCode').textContent = roomId;
    $('#nqLiveRoomId').value = roomId;
    $('#nqLiveLeave').hidden = false;
    $('#nqLiveLeave').textContent = role === 'host' ? 'Akhiri room' : 'Keluar room';
    $('.nq-live-roster').hidden = role === 'player';
    $('#nqLiveColumns').classList.toggle('is-player', role === 'player');
    renderPlayers();
    renderStage();
    $('#nqLiveStart').hidden = !(role === 'host' && roomState.phase === 'lobby' && roomState.playerCount > 0);
    $('#nqLiveNext').hidden = !(role === 'host' && roomState.phase === 'result');
    $('#nqLiveNext').textContent = roomState.questionIndex + 1 >= roomState.questionCount ? 'Lihat hasil akhir' : 'Soal berikutnya';
    if (roomState.phase === 'question') {
      clearInterval(countdownTimer);
      const update = () => {
        const node = $('#nqLiveCountdown');
        if (node) node.textContent = `${Math.max(0, Math.ceil((roomState.deadline - Date.now()) / 1000))} detik`;
      };
      update();
      countdownTimer = setInterval(update, 250);
    } else {
      clearInterval(countdownTimer);
    }
    setStatus('Terhubung ke room. Sesi ini tidak disimpan setelah server dimulai ulang.');
  }

  $('#nqLiveCreate').addEventListener('click', () => {
    try { endpointUrl(); } catch (cause) { setStatus(cause.message, true); return; }
    requestImmersive();
    connect(() => send({ type: 'create', title: fields.title.value }));
  });
  $('#nqLiveJoin').addEventListener('click', () => {
    if (!/^\d{6}$/.test(fields.roomId.value.trim())) { setStatus('Masukkan ID room 6 digit dari guru.', true); return; }
    if (fields.name.value.trim().length < 2) { setStatus('Nama tampilan minimal 2 karakter.', true); fields.name.focus(); return; }
    try { endpointUrl(); } catch (cause) { setStatus(cause.message, true); return; }
    requestImmersive();
    const avatar = { ...avatarState };
    connect(() => send({ type: 'join', roomId: fields.roomId.value.trim(), name: fields.name.value.trim(), avatar }));
  });
  $('#nqAvatarCustomizer').addEventListener('click', event => {
    const button = event.target.closest('[data-avatar-category][data-avatar-value]');
    if (!button) return;
    avatarState[button.dataset.avatarCategory] = button.dataset.avatarValue;
    try { sessionStorage.setItem('nq_live_avatar', JSON.stringify(avatarState)); }
    catch (cause) { console.warn('Preferensi avatar tidak dapat disimpan.', cause); }
    renderAvatarPicker();
  });
  $('#nqLiveStart').addEventListener('click', () => send({ type: 'start' }));
  $('#nqLiveNext').addEventListener('click', () => send({ type: 'advance' }));
  $('#nqLiveLeave').addEventListener('click', () => {
    if (role === 'host') {
      send({ type: 'close' });
      return;
    }
    if (role === 'player') send({ type: 'leave' });
    if (socket) socket.close();
    closeRoomPanel('Keluar dari room.');
  });
  panel.querySelector('.nq-emoji-row').addEventListener('click', event => {
    const button = event.target.closest('[data-live-emoji]');
    if (button) send({ type: 'react', emoji: button.dataset.liveEmoji });
  });

  const previousRoom = storage.get('nq_live_room');
  const previousToken = storage.get('nq_live_token');
  if (previousRoom && previousToken) {
    connect(() => send({ type: 'resume', roomId: previousRoom, token: previousToken }));
  }
})();
