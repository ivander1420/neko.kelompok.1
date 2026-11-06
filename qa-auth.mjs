export default async function run(page, ui) {
  const out = {};
  // Tunggu loader selesai
  await page.waitForFunction(() => !document.getElementById('loader') || document.getElementById('loader').classList.contains('is-done'), { timeout: 60000 });
  out.loader = 'selesai';
  out.authVisible = await page.evaluate(() => { const a = document.getElementById('auth'); return a ? !a.hidden : 'no-auth'; });
  // Buka tab daftar
  await page.evaluate(() => {
    const tab = document.querySelector('[data-auth-tab="register"]');
    if (tab) tab.click();
  });
  await page.waitForTimeout(500);
  out.nameVisible = await page.evaluate(() => { const f = document.getElementById('authNameField'); return f ? !f.hidden : 'no-field'; });
  out.domSnapshot = await page.evaluate(() => ({
    username: !!document.getElementById('authUsername'),
    pin: !!document.getElementById('authPin'),
    submit: !!document.getElementById('authSubmit')
  }));
  return out;
}
