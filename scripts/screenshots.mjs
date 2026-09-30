// Visual QA: screenshots of the running app in three clinical states and two resolutions.
// Usage: npm run dev (in another shell), then: node scripts/screenshots.mjs [baseUrl]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
const outDir = 'docs/screenshots';
mkdirSync(outDir, { recursive: true });

const sizes = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1536x1024', width: 1536, height: 1024 },
];

const browser = await chromium.launch();
const errors = [];
for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${size.name}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${size.name}] ${e.message}`));
  await page.goto(`${base}/?autostart&debug`);
  await page.waitForFunction(() => window.__resusEngine !== undefined);
  // Fast-forward in engine time so each state has settled (the canvases draw the last seconds).
  const run = (s) => page.evaluate((sec) => window.__resusEngine.runFor(sec), s);
  await run(12);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${outDir}/${size.name}-1-stable-sinus.jpg`,
    type: 'jpeg',
    quality: 88,
  });

  await page.evaluate(() =>
    window.__resusEngine.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor'),
  );
  await run(20);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${outDir}/${size.name}-2-vf-no-cpr.jpg`,
    type: 'jpeg',
    quality: 88,
  });

  await page.keyboard.press('Space');
  await run(20);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/${size.name}-3-vf-cpr.jpg`, type: 'jpeg', quality: 88 });
  await page.close();
}
// Interactive states at 1536×1024: briefing, instructor panel, German UI during CPR, end-of-case card.
{
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
  page.on('console', (m) => m.type() === 'error' && errors.push(`[flows] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[flows] ${e.message}`));
  const shot = (name) =>
    page.screenshot({ path: `${outDir}/flow-${name}.jpg`, type: 'jpeg', quality: 88 });
  const run = (s) => page.evaluate((sec) => window.__resusEngine.runFor(sec), s);
  await page.goto(`${base}/?debug`);
  await page.waitForTimeout(1500);
  await shot('1-briefing');
  await page.click('[data-testid=start-button]');
  await page.keyboard.press('Backquote');
  await page.click('[data-testid=rhythm-vf]');
  await run(8);
  await page.waitForTimeout(500);
  await shot('2-instructor-panel');
  await page.keyboard.press('Escape');
  await page.keyboard.press('p');
  await page.getByRole('button', { name: 'DE', exact: true }).first().click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.keyboard.press('Space');
  await run(12);
  await page.waitForTimeout(500);
  await shot('3-german-cpr');
  await page.keyboard.press('p');
  await page.getByRole('button', { name: /Kammerflimmern in Narkose/ }).click();
  await page.click('[data-testid=start-button]');
  await run(26); // VF at 20 s → 6 s no-flow
  await page.keyboard.press('Space');
  await run(60);
  await page.keyboard.press('Space'); // an 8 s interruption
  await run(8);
  await page.keyboard.press('Space');
  await run(60);
  await page.waitForTimeout(600);
  await shot('4-case-summary');
  await page.close();
}

// Ventilator: PRVC with ARDS + spontaneous breathing (loops), and a disconnected CPAP/PS patient desaturating.
{
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
  page.on('pageerror', (e) => errors.push(`[vent] ${e.message}`));
  const run = (s) => page.evaluate((sec) => window.__resusEngine.runFor(sec), s);
  await page.goto(`${base}/?autostart&debug`);
  await page.waitForFunction(() => window.__resusEngine !== undefined);
  await page.click('[data-testid=mode-PRVC]');
  await page.evaluate(() => {
    const e = window.__resusEngine;
    e.dispatch({ type: 'SET_LUNG', preset: 'ards' }, 'instructor');
    e.dispatch({ type: 'SET_RESP_DRIVE', drive: 'normal' }, 'instructor');
  });
  await run(40);
  await page.click('[data-testid=vent-view-loops]');
  await page.waitForTimeout(5500);
  await page.screenshot({
    path: `${outDir}/vent-1-prvc-ards-loops.jpg`,
    type: 'jpeg',
    quality: 88,
  });
  await page.click('[data-testid=vent-view-curves]');
  await page.evaluate(() => {
    const e = window.__resusEngine;
    e.dispatch({ type: 'SET_LUNG', preset: 'normal' }, 'instructor');
    e.dispatch({ type: 'SET_RESP_DRIVE', drive: 'none' }, 'instructor');
  });
  await page.click('[data-testid=mode-PSV]');
  await run(40);
  await page.evaluate(() =>
    window.__resusEngine.dispatch({ type: 'SET_CIRCUIT', connected: false }, 'instructor'),
  );
  await run(170);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${outDir}/vent-2-psv-disconnected.jpg`,
    type: 'jpeg',
    quality: 88,
  });
  await page.close();
}

// Heart–lung interaction: breath stacking (instructor panel with the live model), and a hypoxic PEA arrest.
{
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
  page.on('console', (m) => m.type() === 'error' && errors.push(`[heart-lung] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[heart-lung] ${e.message}`));
  const run = (s) => page.evaluate((sec) => window.__resusEngine.runFor(sec), s);
  await page.goto(`${base}/?autostart&debug`);
  await page.waitForFunction(() => window.__resusEngine !== undefined);
  await page.keyboard.press('Backquote');
  await page.getByRole('button', { name: /Breath stacking/ }).click();
  await run(110); // the instructor panel stays open after loading a case without a briefing
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/hl-1-asthma-stacking.jpg`, type: 'jpeg', quality: 88 });
  await page.getByTestId('heart-lung-panel').screenshot({
    path: `${outDir}/hl-2-instructor-heart-lung.jpg`,
    type: 'jpeg',
    quality: 90,
  });
  await page.getByRole('button', { name: /Silent disconnection/ }).click();
  await page.click('[data-testid=start-button]');
  await run(300);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${outDir}/hl-3-hypoxaemia-tachycardia.jpg`,
    type: 'jpeg',
    quality: 88,
  });
  for (let i = 0; i < 12; i++) {
    const rhythm = await page.evaluate(
      () => window.__resusEngine.getSnapshot().patient.cardio.rhythm,
    );
    if (rhythm === 'pea') break;
    await run(10);
  }
  await run(15);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/hl-4-hypoxic-pea.jpg`, type: 'jpeg', quality: 88 });
  await page.close();
}

await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Screenshots written to ${outDir}/ — no console errors.`);
}
