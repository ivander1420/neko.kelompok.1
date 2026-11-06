export default async function run(page, ui) {
  const out = {};
  // Login
  await page.waitForSelector('#auth', { state: 'visible', timeout: 20000 }).catch(() => { });
  const user = 'testv' + Date.now().toString(36);
  await page.click('[data-auth-tab="register"]').catch(() => { });
  await page.waitForTimeout(400);
  await page.fill('#authDisplayName', 'Tester Verifikasi');
  await page.fill('#authUsername', user);
  await page.fill('#authPin', '123456');
  await page.click('#authSubmit');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  // Lewati intro
  await page.evaluate(() => {
    const skip = [...document.querySelectorAll('button')].find(b => /Lewati/i.test(b.textContent));
    if (skip) skip.click();
  });
  await page.waitForTimeout(600);
  // 1. Cek tombol dark/light di topbar
  out.modeBtn = await page.evaluate(() => {
    const btn = document.querySelector('[data-top-mode]');
    return btn ? { mode: document.documentElement.dataset.mode, icon: btn.innerHTML.includes('sun') ? 'sun' : 'moon' } : 'TIDAK ADA';
  });
  // 2. Klik tombol mode → harus berubah (pakai JS click supaya tidak diblok overlay)
  await page.evaluate(() => document.querySelector('[data-top-mode]').click());
  await page.waitForTimeout(1200);
  out.modeAfter = await page.evaluate(() => document.documentElement.dataset.mode);
  // 3. Musik toggle
  await page.evaluate(() => document.querySelector('[data-top-music]').click());
  await page.waitForTimeout(300);
  out.musicPressed = await page.evaluate(() => document.querySelector('[data-top-music]').getAttribute('aria-pressed'));
  // 4. Maskot: label "Tanya" harus hilang
  out.petLabel = await page.evaluate(() => {
    const label = document.querySelector('.mascot-pet-label');
    return label ? label.textContent : 'HILANG (benar)';
  });
  // 5. Buka chat maskot, cek tombol mute
  await page.evaluate(() => { document.querySelector('.mascot-pet')?.click(); });
  await page.waitForTimeout(800);
  out.muteBtn = await page.evaluate(() => {
    const m = document.querySelector('[data-chat-mute]');
    if (!m) return 'TIDAK ADA';
    const before = m.getAttribute('aria-pressed');
    m.click();
    return { before, after: m.getAttribute('aria-pressed') };
  });
  await page.waitForTimeout(300);
  // 6. Chat: tanya topik baru (wifi) ke Neksya via tab
  out.chatTest = await page.evaluate(() => {
    const tab = document.querySelector('[data-chat-tab="neksya"]');
    if (!tab) return 'tab tidak ada';
    tab.click();
    return 'tab neksya diklik';
  });
  await page.waitForTimeout(400);
  await page.fill('[data-chat-input]', 'bagaimana cara kerja wifi?');
  await page.press('[data-chat-input]', 'Enter');
  await page.waitForTimeout(1500);
  out.chatReply = await page.evaluate(() => {
    const msgs = [...document.querySelectorAll('.bot-bubble')];
    const last = msgs[msgs.length - 1];
    return last ? last.textContent.slice(0, 120) : 'tidak ada balasan';
  });
  return out;
}
