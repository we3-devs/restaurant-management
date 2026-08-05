const { chromium } = require('playwright');

const outDir = 'C:/Users/user/AppData/Local/Temp/claude/d--Projects-intresting-restaurant-management/ccb8a8f3-9c00-4dfa-b978-5498234f4cc4/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@rms.local');
  await page.fill('input[type="password"]', 'Admin@12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const box1 = await page.locator('#dashboard-sidebar').boundingBox();
  console.log('aside bbox before collapse:', JSON.stringify(box1));
  console.log('scrollY before click:', await page.evaluate(() => window.scrollY));

  // Click without letting Playwright auto-scroll the page — use JS click instead.
  await page.locator('#dashboard-sidebar button[aria-label="Collapse sidebar"]').evaluate((el) => el.click());
  await page.waitForTimeout(400);

  console.log('scrollY after click:', await page.evaluate(() => window.scrollY));
  const box2 = await page.locator('#dashboard-sidebar').boundingBox();
  console.log('aside bbox after collapse:', JSON.stringify(box2));

  await page.screenshot({ path: `${outDir}/sidebar-collapsed-v2.png`, fullPage: false });

  await browser.close();
  console.log('done');
})().catch((err) => { console.error(err); process.exit(1); });
