const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[name="email"], input[type="email"]', process.env.SEED_ADMIN_EMAIL);
  await page.fill('input[name="password"], input[type="password"]', process.env.SEED_ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|floor|pos|\//, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  await page.goto('http://localhost:3000/service', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'service-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'service-mobile.png', fullPage: true });

  await browser.close();
})();
