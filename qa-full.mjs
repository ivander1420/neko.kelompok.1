/* QA lengkap: login → beranda → chat Miko → kuis → kartu memori */
export default async function run(page, ui) {
  const out = { steps: [] };

  // Tunggu loader selesai (auth muncul)
  await page.waitForSelector('#auth:not([hidden])', { timeout: 20000 }).catch(() => { });
  out.steps.push({ step: 'auth-visible', ok: await page.isVisible('#auth') });

  // Daftar akun uji unik
  const stamp = Date.now().toString(36).slice(-6);
  const user = 'qa' + stamp;
  await page.click('[data-auth-tab="register"]');
  await page.fill('#authDisplayName', 'QA Tester');
  await page.fill('#authUsername', user);
  await page.fill('#authPin', '123456');
  await page.click('#authSubmit');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 }).catch(() => { });
  out.steps.push({ step: 'login', ok: await page.isVisible('#app'), user });

  await page.waitForTimeout(1200);

  // Screenshot beranda
  await page.screenshot({ path: 'qa-home.png' });

  // Buka chat maskot (Miko AI)
  const petBtn = await page.$('.mascot-pet');
  if (petBtn) { await petBtn.click(); await page.waitForTimeout(900); }
  const chatVisible = await page.isVisible('[data-chat]');
  out.steps.push({ step: 'chat-open', ok: chatVisible });
  await page.screenshot({ path: 'qa-chat.png' });

  // Tanya Miko sesuatu
  if (chatVisible) {
    await page.fill('[data-chat-input]', 'apa itu subnetting?');
    await page.press('[data-chat-input]', 'Enter');
    await page.waitForTimeout(1600);
    const bubbles = await page.$$eval('.bot-bubble', els => els.map(e => e.textContent.slice(0, 60)));
    out.steps.push({ step: 'miko-answer', bubbles });
    // mulai kuis
    await page.fill('[data-chat-input]', 'kuis');
    await page.press('[data-chat-input]', 'Enter');
    await page.waitForTimeout(1600);
    const quiz = await page.$$eval('.bot-bubble', els => els[els.length - 1]?.textContent.slice(0, 80));
    out.steps.push({ step: 'quiz-start', quiz });
    await page.screenshot({ path: 'qa-quiz.png' });
    // jawab angka 1
    await page.fill('[data-chat-input]', '1');
    await page.press('[data-chat-input]', 'Enter');
    await page.waitForTimeout(1600);
    const grade = await page.$$eval('.bot-bubble', els => els[els.length - 1]?.textContent.slice(0, 80));
    out.steps.push({ step: 'quiz-grade', grade });
  }

  // Tutup chat, buka arena → Kartu Memori
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.evaluate(() => { location.hash = '#arena'; });
  await page.waitForTimeout(900);
  const memBtn = await page.$('[data-game="memory"]');
  out.steps.push({ step: 'memory-card-found', ok: Boolean(memBtn) });
  if (memBtn) {
    await memBtn.click();
    await page.waitForTimeout(800);
    // tombol mulai jika ada
    const start = await page.$('[data-start], .btn-primary');
    if (start) { await start.click(); await page.waitForTimeout(2400); }
    const cards = await page.$$('[data-mem]');
    out.steps.push({ step: 'memory-cards', count: cards.length });
    if (cards.length >= 2) {
      await cards[0].click();
      await page.waitForTimeout(300);
      await cards[1].click();
      await page.waitForTimeout(500);
      const flipped = await page.$$eval('.mem-card.flip', els => els.length);
      out.steps.push({ step: 'memory-flip', flipped });
      await page.screenshot({ path: 'qa-memory.png' });
    }
  }

  out.consoleErrors = [];
  return out;
}
