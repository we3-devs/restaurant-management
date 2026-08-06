const { chromium } = require('playwright');
const SS_DIR = 'C:/Users/user/AppData/Local/Temp/claude/d--Projects-intresting-restaurant-management/0600a9a9-8499-4efc-8584-fc1163ddd8ec/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });
  page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));

  await page.goto('http://localhost:3100/login', { waitUntil: 'networkidle' });
  await page.locator('input[name="email"], input[type="email"]').first().fill('admin@rms.local');
  await page.locator('input[name="password"], input[type="password"]').first().fill('Admin@12345');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  const cookies = await context.cookies();
  console.log('cookies after login:', cookies.map((c) => c.name).join(','));

  console.log('Going to POS...');
  await page.goto('http://localhost:3100/staff/waiter/pos', { waitUntil: 'commit' }).catch((e) => console.log('goto err (ignored):', e.message));
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log('URL at POS:', page.url());
  if (!page.url().includes('/staff/waiter/pos')) {
    console.log('retrying goto...');
    await page.goto('http://localhost:3100/staff/waiter/pos', { waitUntil: 'commit' }).catch((e) => console.log('goto err2 (ignored):', e.message));
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    console.log('URL at POS retry:', page.url());
  }
  await page.screenshot({ path: `${SS_DIR}/10-pos.png` });

  console.log('Clicking Start sale...');
  await page.getByRole('button', { name: /start sale/i }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SS_DIR}/11-start-sale-dialog.png` });

  console.log('Opening order type combobox...');
  const orderTypeCombo = page.getByRole('combobox').first();
  await orderTypeCombo.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SS_DIR}/11a-ordertype-open.png` });
  const options = page.getByRole('option');
  const optCount = await options.count();
  console.log('option count', optCount);
  for (let i = 0; i < optCount; i++) {
    console.log('option', i, await options.nth(i).innerText().catch(() => ''));
  }
  const grabOption = page.getByRole('option', { name: /grab|takeaway|walk/i }).first();
  await grabOption.click().catch((e) => console.log('grab option click err', e.message));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SS_DIR}/11b-dialog-detail.png` });

  console.log('Clicking Start sale submit button in dialog...');
  const submitBtn = page.getByRole('button', { name: /^start sale$/i }).last();
  await submitBtn.click({ timeout: 10000 }).catch((e) => console.log('submit click err', e.message));
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  console.log('URL after start sale:', page.url());
  await page.waitForTimeout(2500);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  console.log('URL after start sale (settled):', page.url());
  await page.screenshot({ path: `${SS_DIR}/12-after-start-sale.png` });

  console.log('Looking for food grid...');
  await page.waitForSelector('input[placeholder*="Search food" i]', { timeout: 15000 }).catch((e) => console.log('search input not found', e.message));
  await page.screenshot({ path: `${SS_DIR}/13-food-grid.png` });

  const foodTiles = page.locator('main').getByRole('button');
  const tileCount = await foodTiles.count();
  console.log('button-ish tile count in main', tileCount);
  // Click first tile that looks like a food card (has a price-like $ or currency text)
  let clicked = false;
  for (let i = 0; i < Math.min(tileCount, 20); i++) {
    const t = foodTiles.nth(i);
    const txt = (await t.innerText().catch(() => '')) || '';
    if (/\d/.test(txt) && txt.length < 60 && !/search|cart|filter/i.test(txt)) {
      console.log('clicking food tile:', JSON.stringify(txt));
      await t.click().catch((e) => console.log('tile click err', e.message));
      clicked = true;
      break;
    }
  }
  console.log('clicked a food tile:', clicked);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SS_DIR}/14-after-add-item.png` });

  console.log('Opening cart...');
  const cartBtn = page.getByRole('button', { name: /open cart/i }).first();
  await cartBtn.click({ timeout: 10000 }).catch((e) => console.log('cart click err', e.message));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SS_DIR}/15-cart.png` });

  console.log('Placing order...');
  const placeOrderBtn = page.getByRole('button', { name: /place order/i }).first();
  await placeOrderBtn.click({ timeout: 10000 }).catch((e) => console.log('place order click err', e.message));
  await page.waitForTimeout(1500);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: `${SS_DIR}/16-after-place-order.png` });

  console.log('Navigating to /staff/kitchen with data...');
  await page.goto('http://localhost:3100/staff/kitchen', { waitUntil: 'commit' }).catch((e) => console.log('goto kitchen err', e.message));
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('URL:', page.url());
  await page.screenshot({ path: `${SS_DIR}/17-staff-kitchen-with-ticket.png`, fullPage: true });

  await browser.close();
  console.log('Done');
})();
