import { chromium, devices } from '@playwright/test';
const out = process.argv[2];
const browser = await chromium.launch();
for (const [name, vp] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: vp });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('http://localhost:5173/?autostart&debug');
  await page.waitForFunction(() => window.__resusEngine !== undefined);
  await page.evaluate(() => { window.__resusEngine.runFor(5); window.__resusEngine.dispatch({type:'SET_RHYTHM',rhythm:'vf'},'instructor'); });
  await page.tap('[data-testid=cpr-button]');
  await page.evaluate(() => window.__resusEngine.runFor(20));
  await page.waitForTimeout(500);
  for (const tab of ['monitor', 'patient', 'vent', 'pumps', 'actions']) {
    await page.tap(`[data-testid=tab-${tab}]`);
    if (tab === 'actions') await page.tap('[data-testid=action-defib]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/m-${name}-${tab}.png` });
  }
  await page.tap('[data-testid=instructor-toggle]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/m-${name}-instructor.png` });
  console.log(name, errors);
  await ctx.close();
}
await browser.close();
