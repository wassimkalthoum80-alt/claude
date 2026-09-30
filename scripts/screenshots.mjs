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

// Medications: pump editor for the propofol syringe, and the formulary browser loading rocuronium.
{
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
  page.on('pageerror', (e) => errors.push(`[meds] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`[meds] ${m.text()}`));
  const shot = (name) =>
    page.screenshot({ path: `${outDir}/meds-${name}.jpg`, type: 'jpeg', quality: 88 });
  await page.goto(`${base}/?autostart&debug`);
  await page.waitForFunction(() => window.__resusEngine !== undefined);
  await page.evaluate(() => window.__resusEngine.runFor(15));
  await page.click('[data-testid=pump-P1]');
  await page.waitForTimeout(400);
  await shot('1-pump-editor');
  await page.click('[aria-label=Close]');
  await page.click('[data-testid=pump-P4]');
  await page.fill('[data-testid=pump-search]', 'roc');
  await page.click('[data-testid=product-rocuronium-10]');
  await page.waitForTimeout(400);
  await shot('2-formulary');
  // Propofol top-up bolus under TIVA: BP falls, reflex tachycardia, minimal ST change (5-lead).
  await page.click('[aria-label=Close]');
  await page.click('[data-testid=ecg-leads-5]');
  await page.evaluate(() => window.__resusEngine.runFor(120));
  await page.click('[data-testid=pump-P1]');
  await page.fill('[data-testid=pump-bolus-ml]', '5');
  await page.fill('[data-testid=pump-bolus-duration]', '10');
  await page.click('[data-testid=pump-give-bolus]');
  await page.fill('[data-testid=pump-rate]', '60');
  await page.waitForTimeout(300);
  await shot('3-soft-limit');
  await page.click('[aria-label=Close]');
  await page.evaluate(() => window.__resusEngine.runFor(110));
  await page.waitForTimeout(1200);
  await shot('4-propofol-bolus-effect');
  // Same bolus in an 80-year-old hypovolaemic patient (instructor: age 80, volume status 0.6).
  await page.goto(`${base}/?autostart&debug`);
  await page.waitForFunction(() => window.__resusEngine !== undefined);
  await page.click('[data-testid=ecg-leads-5]');
  await page.keyboard.press('Backquote');
  await page.fill('[data-testid=patient-age]', '80');
  await page.fill('[data-testid=reserve-preloadReserve]', '0.6');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__resusEngine.runFor(180));
  await page.click('[data-testid=pump-P1]');
  await page.fill('[data-testid=pump-bolus-ml]', '5');
  await page.fill('[data-testid=pump-bolus-duration]', '10');
  await page.click('[data-testid=pump-give-bolus]');
  await page.click('[aria-label=Close]');
  await page.evaluate(() => window.__resusEngine.runFor(120));
  await page.waitForTimeout(1200);
  await shot('5-propofol-bolus-elderly-hypovolaemic');
  await page.close();
}

// Processed EEG: stable TIVA, burst suppression after a 100 mg propofol top-up (detail panel with trend),
// recovery with BSV memory, and sensor loss.
{
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
  page.on('pageerror', (e) => errors.push(`[bis] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`[bis] ${m.text()}`));
  const shot = (name) =>
    page.screenshot({ path: `${outDir}/bis-${name}.jpg`, type: 'jpeg', quality: 88 });
  const run = (s) => page.evaluate((sec) => window.__resusEngine.runFor(sec), s);
  await page.goto(`${base}/?autostart&debug`);
  await page.waitForFunction(() => window.__resusEngine !== undefined);
  await run(120);
  await page.waitForTimeout(700);
  await shot('1-stable-tiva');
  await page.evaluate(() =>
    window.__resusEngine.dispatch(
      { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 5, durationS: 10 },
      'user',
    ),
  );
  await run(150);
  await page.click('[data-testid=bis-numerics]');
  await page.click('[data-testid=bis-explain]');
  await page.waitForTimeout(700);
  await shot('2-burst-suppression-panel');
  await run(330);
  await page.waitForTimeout(700);
  await shot('3-recovery-bsv-memory');
  await page.click('[aria-label=Close]');
  await page.evaluate(() =>
    window.__resusEngine.dispatch({ type: 'BIS_SENSOR_FAULT', fault: 'disconnected' }, 'instructor'),
  );
  await run(5);
  await page.waitForTimeout(500);
  await shot('4-check-sensor');
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

// ECG cable: 3 electrodes (default) and 5 electrodes with V5 + ST; hypoxic ST depression in V5.
{
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
  page.on('console', (m) => m.type() === 'error' && errors.push(`[ecg] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[ecg] ${e.message}`));
  const run = (s) => page.evaluate((sec) => window.__resusEngine.runFor(sec), s);
  await page.goto(`${base}/?autostart&debug`);
  await page.waitForFunction(() => window.__resusEngine !== undefined);
  await run(12);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/ecg-1-three-lead.jpg`, type: 'jpeg', quality: 88 });
  await page.click('[data-testid=ecg-leads-5]');
  await run(12);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/ecg-2-five-lead.jpg`, type: 'jpeg', quality: 88 });
  await page.evaluate(() =>
    window.__resusEngine.dispatch({ type: 'SET_CIRCUIT', connected: false }, 'instructor'),
  );
  await run(290);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/ecg-3-hypoxic-st-depression.jpg`, type: 'jpeg', quality: 88 });
  await page.close();
}

// Alarm limits: small limits beside every numeric, and the limit editor (tightened HR limit → alarm).
{
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
  page.on('console', (m) => m.type() === 'error' && errors.push(`[limits] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[limits] ${e.message}`));
  const run = (s) => page.evaluate((sec) => window.__resusEngine.runFor(sec), s);
  await page.goto(`${base}/?autostart&debug`);
  await page.waitForFunction(() => window.__resusEngine !== undefined);
  await run(12);
  await page.getByRole('button', { name: /HR/ }).first().click();
  for (let i = 0; i < 10; i++) await page.getByTestId('limit-hr-high-down').click();
  await run(3);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/limits-1-editor.jpg`, type: 'jpeg', quality: 88 });
  await page.getByTestId('alarm-limits').screenshot({ path: `${outDir}/limits-2-panel.jpg`, type: 'jpeg', quality: 90 });
  await page.close();
}

await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Screenshots written to ${outDir}/ — no console errors.`);
}
