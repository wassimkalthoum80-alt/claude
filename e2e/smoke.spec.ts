import { expect, test } from '@playwright/test';

test('loads, draws every trace, and starts CPR with Space in VF', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?autostart&debug');
  await expect(page.getByTestId('cpr-button')).toHaveText(/START CPR/);

  // Let a few seconds of signal accumulate, then check every trace canvas has painted pixels.
  await page.evaluate(() => window.__resusEngine?.runFor(6));
  await page.waitForTimeout(500);
  const painted = await page.$$eval('canvas', (canvases) =>
    canvases.map((c) => {
      const ctx = c.getContext('2d');
      if (!ctx || c.width === 0 || c.height === 0) return 0;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) > 0) lit++;
      return lit;
    }),
  );
  expect(painted).toHaveLength(8); // ECG, pleth, ART, CO2, EEG, Paw, flow, volume
  for (const lit of painted) expect(lit).toBeGreaterThan(200);

  // 5-electrode cable: an extra V5 trace with ST numerics.
  await page.getByTestId('ecg-leads-5').click();
  await page.evaluate(() => window.__resusEngine?.runFor(4));
  await expect(page.locator('canvas')).toHaveCount(9);
  await expect(page.getByText(/ST-V5/)).toBeVisible();
  await page.getByTestId('ecg-leads-3').click();
  await expect(page.locator('canvas')).toHaveCount(8);

  // Alarm limits: click the HR numeric, raise the upper HR limit by one step (120 → 125).
  await page.getByRole('button', { name: /HR/ }).first().click();
  await expect(page.getByTestId('alarm-limits')).toBeVisible();
  await page.getByTestId('limit-hr-high-up').click();
  await expect(page.getByTestId('limit-hr-high')).toHaveText('125');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('alarm-limits')).toBeHidden();

  // Instructor triggers VF, the player presses Space.
  await page.keyboard.press('Backquote');
  await page.getByTestId('rhythm-vf').click();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('cpr-button')).toHaveText(/STOP CPR/);
  await page.evaluate(() => window.__resusEngine?.runFor(10));
  await expect(page.getByTestId('ccf')).not.toHaveText(/--/);

  // Ventilator: switch to pressure control and to the loops view.
  await page.getByTestId('mode-PCV').click();
  await page.getByTestId('vent-view-loops').click();
  await expect(page.getByText('PC-AC').first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('perfusor rack: TIVA running, load rocuronium, soft vs hard limits, give a valid bolus', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?autostart&debug');
  const rack = page.getByTestId('perfusor-rack');
  await expect(rack).toBeVisible();
  await expect(page.getByTestId('pump-P1')).toHaveAttribute('data-state', 'run');
  await expect(page.getByTestId('pump-P1')).toContainText('Propofol');
  await expect(page.getByTestId('pump-INF1')).toBeVisible();

  await page.getByTestId('pump-P4').click();
  await page.getByTestId('pump-search').fill('rocuronium');
  await page.getByTestId('product-rocuronium-10').click();
  await page.getByTestId('pump-load').click();
  await expect(page.getByTestId('pump-P4')).toContainText('Rocuronium');

  // 0.65 mg/kg is above the protocol maximum (0.6): a soft limit that must be confirmed explicitly.
  await page.getByTestId('pump-bolus-dose').fill('0.65');
  await expect(page.getByTestId('pump-soft-limit').first()).toBeVisible();
  await expect(page.getByTestId('pump-give-bolus')).toHaveText(/Confirm above limit/);
  // More than the syringe holds: a hard limit, blocked.
  await page.getByTestId('pump-bolus-ml').fill('80');
  await expect(page.getByTestId('pump-error').first()).toBeVisible();
  await expect(page.getByTestId('pump-give-bolus')).toBeDisabled();

  await page.getByTestId('pump-bolus-dose').fill('0.6');
  await expect(page.getByTestId('pump-give-bolus')).toBeEnabled();
  await page.getByTestId('pump-give-bolus').click();
  await page.evaluate(() => window.__resusEngine?.runFor(180));
  await expect(page.getByTestId('tof')).toContainText('0/4');

  await page.getByTestId('add-syringe').click();
  await expect(page.getByTestId('pump-P6')).toBeVisible();
  expect(errors).toEqual([]);
});

test('propofol top-up bolus during TIVA maintenance and a confirmed rate above the maximum', async ({
  page,
}) => {
  await page.goto('/?autostart&debug');
  await page.getByTestId('pump-P1').click();
  await expect(page.getByTestId('pump-protocol')).toHaveValue('maintenance');
  await page.getByTestId('pump-bolus-ml').fill('5'); // 100 mg of propofol 2 %
  await page.getByTestId('pump-bolus-duration').fill('10');
  await expect(page.getByTestId('pump-give-bolus')).toHaveText(/Give bolus/);
  await page.getByTestId('pump-give-bolus').click();
  await expect(page.getByTestId('pump-P1')).toHaveAttribute('data-state', 'bolus');

  await page.getByTestId('pump-rate').fill('60'); // ≈ 15 mg/kg/h > 12
  await expect(page.getByTestId('pump-set-rate')).toHaveText(/Confirm above limit/);
  await page.getByTestId('pump-set-rate').click();
  await expect(page.getByTestId('pump-P1')).toContainText('60.0 mL/h');
  const confirmed = await page.evaluate(
    () =>
      window.__resusEngine?.eventLog.filter(
        (x) => x.kind === 'event' && x.event === 'SOFT_LIMIT_CONFIRMED',
      ).length,
  );
  expect(confirmed).toBe(1);
});

test('processed EEG: BIS row, detail panel with trend, sensor loss shows "Check sensor"', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?autostart&debug');
  await page.evaluate(() => window.__resusEngine?.runFor(90));
  await expect(page.getByTestId('bis-numerics')).toContainText('Simulated BIS');
  await expect(page.getByTestId('bis-value')).toHaveText(/^\d+$/);
  await expect(page.getByTestId('bsv')).toHaveAttribute('title', /preceding 63 seconds/);

  await page.getByTestId('bis-numerics').click();
  await expect(page.getByTestId('bis-panel')).toBeVisible();
  await page.getByTestId('bis-smoothing').selectOption('30');
  await page.getByTestId('bis-explain').click();
  await expect(page.getByTestId('bis-why')).toContainText('Propofol');

  await page.keyboard.press('Backquote');
  await page.getByTestId('fault-disconnected').click();
  await page.evaluate(() => window.__resusEngine?.runFor(5));
  await expect(page.getByTestId('bis-status')).toHaveText('Check sensor');
  expect(errors).toEqual([]);
});

test('case timer next to the instructor button counts from 00:00 and restarts on reset and a new case', async ({
  page,
}) => {
  await page.goto('/?autostart&debug');
  const timer = page.getByTestId('case-timer');
  await expect(timer).toBeVisible();
  const box = await timer.boundingBox();
  const instr = await page.getByTestId('instructor-toggle').boundingBox();
  expect(box && instr && box.x > instr.x && box.x - (instr.x + instr.width) < 20).toBe(true);

  await page.evaluate(() => window.__resusEngine?.runFor(125));
  await expect(timer).toHaveText(/^02:0[5-9]$/);
  await page.evaluate(() => window.__resusEngine?.dispatch({ type: 'RESET' }, 'instructor'));
  await expect(timer).toHaveText(/^00:0\d$/);

  // A new case from the pause menu starts at 00:00 again.
  await page.evaluate(() => window.__resusEngine?.runFor(90));
  await expect(timer).toHaveText(/^01:3\d$/);
  await page.keyboard.press('p');
  await page.getByRole('button', { name: /VF under anaesthesia/ }).click();
  await expect(timer).toHaveText('00:00');
});

test('fluid balance: panel shows intake and urine; emptying the bag keeps the balance', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?autostart&debug&lang=de');
  await page.evaluate(() => window.__resusEngine?.runFor(1800));
  await page.getByTestId('balance-button').click();
  const panel = page.getByTestId('balance-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('EINFUHR');
  await expect(panel).toContainText('GESCHÄTZTE VERLUSTE');
  const net = await page.getByTestId('bal-net-measured').textContent();
  await expect(page.getByTestId('bal-bag')).not.toHaveText('0 mL');
  await page.getByTestId('bal-empty-bag').click();
  await expect(page.getByTestId('bal-bag')).toHaveText('0 mL');
  await expect(page.getByTestId('bal-net-measured')).toHaveText(net ?? '');
  await page.getByTestId('bal-model-toggle').click();
  await expect(page.getByTestId('bal-distribution')).toBeVisible();
  expect(errors).toEqual([]);
});

test('ALS panels: rhythm check → shockable → defibrillator shock; ultrasound and airway findings', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?autostart&debug');
  await page.evaluate(() => {
    window.__resusEngine?.runFor(3);
    window.__resusEngine?.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
  });
  await page.keyboard.press('Space');
  await page.evaluate(() => window.__resusEngine?.runFor(30));

  await page.getByTestId('action-rhythm').click();
  await page.getByTestId('rc-start').click();
  await expect(page.getByTestId('cpr-button')).toHaveText(/START CPR/);
  await page.evaluate(() => window.__resusEngine?.runFor(3));
  await expect(page.getByTestId('rc-handsoff')).toHaveText('3 s');
  await page.getByTestId('rc-shockable').click();
  // Compressions resume and the defibrillator panel opens.
  await expect(page.getByTestId('cpr-button')).toHaveText(/STOP CPR/);
  await expect(page.getByTestId('panel-defib')).toBeVisible();
  await page.getByTestId('defib-pads').click();
  await page.getByTestId('defib-charge').click();
  await page.evaluate(() => window.__resusEngine?.runFor(5));
  await expect(page.getByTestId('defib-lcd')).toContainText('CHARGED');
  await page.keyboard.press('Space'); // hands off
  await page.getByTestId('defib-shock').click();
  const shocks = await page.evaluate(
    () => window.__resusEngine?.getSnapshot().devices.defib.shocks,
  );
  expect(shocks).toBe(1);

  await page.getByTestId('action-ultrasound').click();
  await page.getByTestId('us-cardiac').click();
  await expect(page.getByTestId('us-canvas')).toBeVisible();
  await expect(page.getByTestId('us-finding')).not.toBeEmpty();

  await page.getByTestId('action-airway').click();
  await page.getByTestId('auscultate').click();
  await expect(page.getByTestId('auscultation')).toContainText('breath sounds');
  expect(errors).toEqual([]);
});
