export default async function run(page, ui) {
  const out = {};
  await page.waitForFunction(() => {
    const l = document.getElementById('loader');
    return !l || l.classList.contains('is-done');
  }, { timeout: 60000 });
  // Daftar akun
  await page.evaluate(() => document.querySelector('[data-auth-tab="register"]')?.click());
  await page.waitForTimeout(400);
  const user = 'testv' + Date.now().toString(36);
  await page.evaluate(() => {
    const f = document.getElementById('authDisplayName');
    f.value = 'Tester Verifikasi';
    f.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.fill('#authUsername', user);
  await page.fill('#authPin', '123456');
  await page.evaluate(() => document.getElementById('authSubmit').click());
  await page.waitForFunction(() => !document.getElementById('app')?.hidden, { timeout: 30000 });
  out.loggedIn = true;
  // Lewati intro
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const skip = [...document.querySelectorAll('button')].find(b => /Lewati/i.test(b.textContent));
    if (skip) skip.click();
  });
  await page.waitForTimeout(700);

  // 1. Tombol dark/light
  out.modeBefore = await page.evaluate(() => document.documentElement.dataset.mode);
  await page.evaluate(() => document.querySelector('[data-top-mode]')?.click());
  await page.waitForTimeout(1400);
  out.modeAfter = await page.evaluate(() => document.documentElement.dataset.mode);
  out.modeBtnIcon = await page.evaluate(() => {
    const b = document.querySelector('[data-top-mode]');
    return b ? (b.innerHTML.includes('moon') ? 'moon' : 'sun/other') : 'MISSING';
  });

  // 2. Musik toggle
  await page.evaluate(() => document.querySelector('[data-top-music]')?.click());
  await page.waitForTimeout(300);
  out.musicPressedAfterOff = await page.evaluate(() => document.querySelector('[data-top-music]')?.getAttribute('aria-pressed'));

  // 3. Maskot: label Tanya hilang?
  out.petLabel = await page.evaluate(() => {
    const label = document.querySelector('.mascot-pet-label');
    return label ? 'MASIH ADA: ' + label.textContent : 'hilang (benar)';
  });

  // 4. Chat + tombol mute
  await page.evaluate(() => document.querySelector('.mascot-pet')?.click());
  await page.waitForTimeout(900);
  out.muteBtn = await page.evaluate(() => {
    const m = document.querySelector('[data-chat-mute]');
    if (!m) return 'MISSING';
    const before = m.getAttribute('aria-pressed');
    m.click();
    return { before, clicked: true };
  });
  await page.waitForTimeout(400);
  out.muteAfter = await page.evaluate(() => document.querySelector('[data-chat-mute]')?.getAttribute('aria-pressed'));

  // 5. Chat pintar: tanya wifi ke Neksya
  await page.evaluate(() => document.querySelector('[data-chat-tab="neksya"]')?.click());
  await page.waitForTimeout(500);
  await page.fill('[data-chat-input]', 'bagaimana cara kerja wifi?');
  await page.press('[data-chat-input]', 'Enter');
  await page.waitForTimeout(1600);
  out.chatReply = await page.evaluate(() => {
    const msgs = [...document.querySelectorAll('.bot-bubble')];
    const last = msgs[msgs.length - 1];
    return last ? last.textContent.slice(0, 150) : 'tidak ada balasan';
  });
  await page.screenshot({ path: 'verify-shot.png' });
  return out;
}
