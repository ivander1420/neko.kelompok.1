export default async function run(page, ui) {
  const out = {};
  // Tunggu layar auth muncul
  await page.waitForSelector('#auth', { state: 'visible', timeout: 20000 }).catch(() => { });
  out.auth = await page.evaluate(() => !document.getElementById('auth')?.hidden);
  // Login dengan akun preset lokal (mode lokal tanpa server? server jalan, jadi pakai register akun baru)
  const user = 'testmem' + Date.now().toString(36);
  await page.fill('#authUsername', user);
  await page.fill('#authPin', '123456');
  // klik tab buat akun dulu jika ada
  const tabRegister = await page.$('[data-auth-tab="register"]');
  if (tabRegister) await tabRegister.click();
  const nameField = await page.$('#authDisplayName');
  if (nameField && await nameField.isVisible()) await page.fill('#authDisplayName', 'Tester Memori');
  await page.click('#authSubmit');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 }).catch(() => { });
  out.appVisible = await page.evaluate(() => !document.getElementById('app')?.hidden);
  // Buka arena
  await page.evaluate(() => { window.location.hash = '#arena'; });
  await page.waitForTimeout(1200);
  out.arenaText = await page.evaluate(() => document.querySelector('#view')?.innerText.slice(0, 400) || '');
  return out;
}
