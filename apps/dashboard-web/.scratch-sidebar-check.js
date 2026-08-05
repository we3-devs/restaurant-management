const { chromium } = require('playwright');

const outDir = 'C:/Users/user/AppData/Local/Temp/claude/d--Projects-intresting-restaurant-management/ccb8a8f3-9c00-4dfa-b978-5498234f4cc4/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', err => console.log('PAGEERROR:', err.message.slice(0, 300)));

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@rms.local');
  await page.fill('input[type="password"]', 'Admin@12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  await page.screenshot({ path: `${outDir}/sidebar-expanded.png`, fullPage: false });

  // Click the collapse toggle (last button in the sidebar)
  await page.click('#dashboard-sidebar button[aria-label="Collapse sidebar"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/sidebar-collapsed.png`, fullPage: false });

  // Click a rail icon (e.g. Purchasing group) to confirm expand-on-click works
  const railButtons = await page.locator('#dashboard-sidebar nav button').all();
  if (railButtons.length > 3) {
    await railButtons[3].click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/sidebar-expanded-from-rail.png`, fullPage: false });
  }

  await browser.close();
  console.log('done');
})().catch((err) => { console.error(err); process.exit(1); });
