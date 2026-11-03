/* ============================================================
   NEKO · games/spy.js — Who Is The Spy 
   ============================================================ */
(function () {
  'use strict';
  const Neko = window.Neko = window.Neko || {};
  Neko.games = Neko.games || {};
  const { esc, pick, shuffle, initials } = Neko.util;
  const { icon } = Neko.icons;

  function defaultNames(ctx) {
    const total = Math.max(3, ctx.config.players || 3);
    const base = ctx.store.session?.displayName || 'Kamu';
    const names = [base];
    const extras = ['pemain', 'pemain', 'pemain', 'pemain', 'pemain', 'pemain'];
    for (let i = 1; i < total; i += 1) names.push(extras[(i - 1) % extras.length]);
    return names;
  }

  Neko.games.spy = {
    mount(ctx) {
      const rounds = Math.max(1, ctx.config.rounds || 1);
      const categories = window.NEK_SPY?.categories || [];
      let round = 1;
      let score = 0;
      let results = [];
      let roster = null;

      ctx.cleanup(() => {});

      async function playRound() {
        if (!categories.length) {
          ctx.finish({ title: 'Data kata belum ada', message: 'Komponen Who Is The Spy tidak termuat.', score: 0, won: false, xp: 0, stats: [] });
          return;
        }
        const category = pick(categories);
        const pair = pick(category.pairs);
        const names = roster;
        const spyIndex = Math.floor(Math.random() * names.length);
        const mainWord = pair[0];
        const decoyWord = pair[1];
        ctx.setSub('Putaran ' + round + ' dari ' + rounds);
        ctx.setHUD([{ icon: 'users', label: names.length + ' pemain' }, { icon: 'spy', label: 'Rahasia' }]);

        for (let i = 0; i < names.length; i += 1) {
          const isSpy = i === spyIndex;
          await ctx.pass(
            'Oper ke <strong>' + esc(names[i]) + '</strong>',
            names[i],
            'Jangan sampai pemain lain melihat layar. Ketuk siap untuk melihat kata rahasiamu.'
          );
          await revealWord(names[i], isSpy ? decoyWord : mainWord, isSpy, category.name, i === 0);
        }

        ctx.setStage(
          '<div class="g-panel g-center">' +
          '<span class="g-center-icon">' + icon('chat') + '</span>' +
          '<h2>Diskusi dimulai</h2>' +
          '<p>Semua sudah melihat kata. Beri satu petunjuk tentang kata itu — jangan terlalu jelas. Cari siapa yang kata rahasianya berbeda.</p>' +
          '<div class="spy-hint">Kategori: ' + esc(category.name) + ' · ' + names.length + ' pemain · 1 penyusup</div>' +
          '<button type="button" class="btn btn-primary" data-vote-start>' + icon('spy') + 'Mulai voting</button>' +
          '</div>'
        );
        await new Promise(resolve => {
          ctx.frame.querySelector('[data-vote-start]').addEventListener('click', resolve, { once: true });
        });
        Neko.audio.play('select');
        await voting(names, spyIndex, mainWord, decoyWord, category.name);
      }

      function revealWord(name, word, isSpy, categoryName, isSelf) {
        return new Promise(resolve => {
          ctx.setStage(
            '<div class="g-panel g-center">' +
            '<span class="spy-name-tag">' + icon(isSelf ? 'profile' : 'users') + esc(name) + (isSelf ? '<small>pemain perangkat ini</small>' : '') + '</span>' +
            '<span class="g-sub">Kartu rahasia untuk ' + esc(name) + '</span>' +
            '<button type="button" class="spy-card" data-spy-card aria-label="Buka kartu rahasia">' +
            '<span class="spy-card-inner">' +
            '<span class="spy-face"><span class="spy-icon">' + icon('spy') + '</span><small>Kartu rahasia</small><strong>Ketuk untuk buka</strong><span>Pastikan pemain lain tidak melihat</span></span>' +
            '<span class="spy-face back"><span class="spy-icon">' + icon(isSpy ? 'alien' : 'cat') + '</span><small>' + esc(categoryName) + '</small><strong>' + esc(word) + '</strong><span class="spy-role-badge">' + (isSpy ? 'Who Is The Spy' : 'Kru Jaringan') + '</span></span>' +
            '</span></button>' +
            '<p class="spy-hint">Ingat katamu. Jangan ucapkan langsung.</p>' +
            '<div class="g-actions" data-spy-actions></div>' +
            '</div>'
          );
          const card = ctx.frame.querySelector('[data-spy-card]');
          card.addEventListener('click', () => {
            card.classList.add('revealed');
            Neko.audio.play('reveal');
            const actions = ctx.frame.querySelector('[data-spy-actions]');
            actions.innerHTML = '<button type="button" class="btn btn-primary" data-spy-done>' + icon('check') + 'Sudah hafal, lanjut</button>';
            actions.querySelector('[data-spy-done]').addEventListener('click', () => {
              Neko.audio.play('tap');
              resolve();
            }, { once: true });
          }, { once: true });
        });
      }

      function voting(names, spyIndex, mainWord, decoyWord, categoryName) {
        return new Promise(resolve => {
          ctx.setStage(
            '<div class="g-panel">' +
            '<div class="g-title"><div><span class="g-sub">VOTING BERSAMA</span><h2>Siapa penyusupnya?</h2></div></div>' +
            '<p class="spy-hint" style="margin-top:8px">Diskusikan petunjuk tiap pemain, lalu ketuk satu nama yang paling mencurigakan.</p>' +
            '<div class="spy-vote-grid">' + names.map((name, index) => (
              '<button type="button" class="spy-vote" data-vote="' + index + '"><i>' + esc(initials(name)) + '</i><span>' + esc(name) + '</span>' + (index === 0 ? '<em class="spy-kamu">kamu</em>' : '') + '</button>'
            )).join('') + '</div>' +
            '</div>'
          );
          ctx.frame.querySelectorAll('[data-vote]').forEach(button => {
            button.addEventListener('click', () => {
              const accused = Number(button.dataset.vote);
              ctx.frame.querySelectorAll('[data-vote]').forEach(node => { node.disabled = true; });
              button.classList.add('on');
              Neko.audio.play(accused === spyIndex ? 'win' : 'lose');
              const found = accused === spyIndex;
              if (found) score += 100;
              results.push({ name: names[accused], score: found ? 100 : 0, win: found });
              window.setTimeout(() => {
                ctx.setStage(
                  '<div class="g-panel g-center">' +
                  '<span class="g-center-icon">' + icon(found ? 'shield-check' : 'alien') + '</span>' +
                  '<h2>' + (found ? 'Penyusup tertangkap!' : 'Penyusup lolos!') + '</h2>' +
                  '<p>' + (found ? esc(names[accused]) + ' memang penyusup. Kru jaringan menang.' : esc(names[accused]) + ' bukan penyusup. Penyusup sebenarnya adalah ' + esc(names[spyIndex]) + '.') + '</p>' +
                  '<div class="spy-reveal"><span class="spy-word">' + esc(mainWord) + '</span><small>Kata kru · kategori ' + esc(categoryName) + '</small></div>' +
                  '<div class="spy-reveal"><span class="spy-word">' + esc(decoyWord) + '</span><small>Who Is The Spy</small></div>' +
                  '<div class="g-actions"><button type="button" class="btn btn-primary" data-round-next>' + (round >= rounds ? 'Lihat hasil' : 'Putaran berikutnya') + icon('arrow-right') + '</button></div>' +
                  '</div>'
                );
                ctx.frame.querySelector('[data-round-next]').addEventListener('click', () => {
                  round += 1;
                  if (round > rounds) finish();
                  else playRound();
                });
                resolve();
              }, 500);
            });
          });
        });
      }

      function finish() {
        const won = score >= 50;
        const xp = 18 + Math.round(score / 5);
        ctx.finish({
          title: won ? 'Kru jaringan menang' : 'Penyusup berjaya',
          message: 'Who Is The Spy menguji seberapa tepat kamu memberi petunjuk tanpa membocorkan rahasia.',
          won, score, xp,
          stats: [
            { label: 'Putaran', value: String(rounds) },
            { label: 'Poin kru', value: String(score) },
            { label: 'Pemain', value: String(roster.length) }
          ],
          list: results
        });
      }

      function askRoster() {
        roster = defaultNames(ctx);
        return new Promise(resolve => {
          const paint = () => {
            ctx.setSub('Nama pemain');
            ctx.setHUD([{ icon: 'users', label: roster.length + ' pemain' }, { icon: 'spy', label: 'Atur nama' }]);
            ctx.setStage(
              '<div class="g-panel">' +
              '<div class="g-title"><div><span class="g-sub">SEBELUM MULAI</span><h2>Siapa saja yang bermain?</h2></div></div>' +
              '<p class="spy-hint" style="margin-top:8px">Tulis nama masing-masing pemain. Nama itu yang muncul di layar oper, kartu rahasia, dan hasil voting.</p>' +
              '<div class="spy-roster">' + roster.map((name, index) => (
                '<div class="spy-roster-row">' +
                '<span class="spy-roster-no">' + (index === 0 ? icon('profile') : index + 1) + '</span>' +
                '<input class="spy-roster-input" data-roster="' + index + '" maxlength="14" autocomplete="off" value="' + esc(name) + '" aria-label="Nama pemain ' + (index + 1) + '">' +
                (index === 0 ? '<em class="spy-kamu">kamu</em>' : '<button type="button" class="spy-roster-del" data-del="' + index + '" aria-label="Hapus ' + esc(name) + '">' + icon('close') + '</button>') +
                '</div>'
              )).join('') + '</div>' +
              '<div class="g-actions">' +
              (roster.length < 8 ? '<button type="button" class="btn btn-ghost" data-roster-add>' + icon('plus') + 'Tambah pemain</button>' : '') +
              '<button type="button" class="btn btn-primary" data-roster-go>' + icon('play') + 'Mulai putaran</button>' +
              '</div>' +
              '</div>'
            );
            const frame = ctx.frame;
            frame.querySelectorAll('[data-roster]').forEach(input => input.addEventListener('input', () => { roster[Number(input.dataset.roster)] = input.value; }));
            const add = frame.querySelector('[data-roster-add]');
            if (add) add.addEventListener('click', () => { roster.push('Pemain ' + (roster.length + 1)); Neko.audio.play('tap'); paint(); });
            frame.querySelectorAll('[data-del]').forEach(button => button.addEventListener('click', () => {
              if (roster.length <= 3) { Neko.ui.toast('Minimal tiga pemain', 'Who Is The Spy seru dimainkan tiga pemain atau lebih.', 'error', 'warning'); return; }
              roster.splice(Number(button.dataset.del), 1);
              Neko.audio.play('tap');
              paint();
            }));
            frame.querySelector('[data-roster-go]').addEventListener('click', () => {
              const used = {};
              roster = roster.map((raw, index) => {
                let value = String(raw).trim().slice(0, 14) || (index === 0 ? 'Kamu' : 'Pemain ' + (index + 1));
                const key = value.toLowerCase();
                if (used[key]) { used[key] += 1; value += ' ' + used[key]; } else { used[key] = 1; }
                return value;
              });
              Neko.audio.play('select');
              resolve();
            });
          };
          paint();
        });
      }

      askRoster().then(playRound);
    }
  };
})();
