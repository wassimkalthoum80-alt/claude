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

  // A new session (pause menu → main menu → module → entry) starts at 00:00 again.
  await page.evaluate(() => window.__resusEngine?.runFor(90));
  await expect(timer).toHaveText(/^01:3\d$/);
  await page.keyboard.press('p');
  await page.getByTestId('menu-home').click();
  await page.getByTestId('module-resus').click();
  await page.getByTestId('entry-vf-anaesthesia').click();
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

test('phone layout: tabs, floating CPR button, ALS panel inline, desktop layout forced from the menu', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&debug');
  await expect(page.getByTestId('mobile-layout')).toBeVisible();
  await page.getByTestId('cpr-button').tap();
  await expect(page.getByTestId('cpr-button')).toHaveText(/STOP CPR/);
  for (const tab of ['patient', 'vent', 'pumps', 'actions', 'monitor']) {
    await page.getByTestId(`tab-${tab}`).tap();
  }
  await page.getByTestId('tab-actions').tap();
  await page.getByTestId('action-rhythm').tap();
  await expect(page.getByTestId('panel-rhythm')).toBeVisible();
  // Force the desktop layout from the pause menu (kept as a preference).
  await page.getByRole('button', { name: /PAUSE/i }).first().tap();
  await page.getByTestId('layout-switch').getByRole('button', { name: 'Desktop' }).tap();
  await expect(page.getByTestId('mobile-layout')).toHaveCount(0);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('patient banner shows age, weight and height at all times and opens the history', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&debug');
  await expect(page.getByTestId('pt-age')).toHaveText(/58/);
  await expect(page.getByTestId('pt-weight')).toHaveText(/80/);
  await expect(page.getByTestId('pt-height')).toHaveText(/178/);
  // The banner follows instructor changes of the patient.
  await page.evaluate(() =>
    window.__resusEngine?.dispatch({ type: 'SET_PATIENT_AGE', ageYears: 81 }, 'instructor'),
  );
  await expect(page.getByTestId('pt-age')).toHaveText(/81/);
  await page.getByTestId('history-button').click();
  await expect(page.getByTestId('history-panel')).toBeVisible();
  await expect(page.getByTestId('history-conditions')).toContainText('hypertension');
  expect(errors).toEqual([]);
});

test('navigation: HOME → module menu → session intro → workspace → pause → end session → HOME', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?debug');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('home-screen')).toContainText('For education only');
  // The patient does not run behind the menus.
  expect(await page.evaluate(() => window.__resusEngine?.getSnapshot().control.paused)).toBe(true);
  // Daily challenge hidden until validated cases exist; My progress available.
  await expect(page.getByTestId('module-daily')).toHaveCount(0);
  await expect(page.getByTestId('module-progress')).toBeEnabled();

  // Scored module: difficulty, entries in preparation cannot start.
  await page.getByTestId('module-resus').click();
  await expect(page.getByTestId('module-menu')).toBeVisible();
  await expect(page.getByTestId('entry-tamponade-arrest')).toBeDisabled();
  await page.getByTestId('difficulty-expert').click();
  await page.getByTestId('entry-vf-anaesthesia').click();
  await expect(page.getByTestId('session-line')).toHaveText(/RESUSCITATION · EXPERT/);
  expect(await page.evaluate(() => window.__resusEngine?.getSnapshot().scenario.id)).toBe(
    'vf-under-anaesthesia',
  );
  await page.getByTestId('start-button').click();
  // Scored session: no instructor panel, not even with the hotkey.
  await expect(page.getByTestId('instructor-toggle')).toHaveCount(0);
  await page.keyboard.press('Backquote');
  await expect(page.getByTestId('instructor-panel')).toHaveCount(0);
  await expect(page.getByTestId('cpr-button')).toBeVisible();

  // Pause menu: no case list any more; ending before anything happened returns to the module menu (no debrief).
  await page.keyboard.press('p');
  await expect(page.getByTestId('menu-restart')).toBeVisible();
  await page.getByTestId('menu-end-session').click();
  await expect(page.getByTestId('module-menu')).toBeVisible();
  expect(await page.evaluate(() => window.__resusEngine?.getSnapshot().control.paused)).toBe(true);
  await page.getByTestId('menu-back').click();

  // Instructor mode: the instructor panel is available.
  await page.getByTestId('module-instructor').click();
  await page.getByTestId('entry-sandbox').click();
  await page.getByTestId('start-button').click();
  await page.getByTestId('instructor-toggle').click();
  await expect(page.getByTestId('instructor-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('p');
  await page.getByTestId('menu-home').click();
  await expect(page.getByTestId('home-screen')).toBeVisible();

  // The difficulty choice is remembered.
  await page.getByTestId('module-skills').click();
  await expect(page.getByTestId('difficulty-expert')).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});

test('phone layout: HOME and module menus fit the screen and start a session', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?debug&lang=de');
  await expect(page.getByTestId('module-lab')).toContainText('Physiologie-Labor');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
  await page.getByTestId('module-lab').tap();
  await page.getByTestId('entry-vent-free').tap();
  await page.getByTestId('start-button').tap();
  await expect(page.getByTestId('mobile-layout')).toBeVisible();
  await expect(page.getByTestId('instructor-toggle')).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});

test('sim time ×5: physiology runs five times faster, the monitor sweep stays real-time', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&debug');
  await page.waitForFunction(() => (window.__resusDisplay?.time ?? 0) > 1);
  await page.getByTestId('sim-speed-5').click();
  await expect(page.getByTestId('sim-speed-5')).toHaveAttribute('aria-pressed', 'true');
  const t0 = await page.evaluate(() => ({
    sim: window.__resusEngine?.getSnapshot().time ?? 0,
    display: window.__resusDisplay?.time ?? 0,
    wall: performance.now(),
  }));
  await page.waitForTimeout(3000);
  const t1 = await page.evaluate(() => ({
    sim: window.__resusEngine?.getSnapshot().time ?? 0,
    display: window.__resusDisplay?.time ?? 0,
    wall: performance.now(),
  }));
  const wall = (t1.wall - t0.wall) / 1000;
  const display = t1.display - t0.display;
  const sim = t1.sim - t0.sim;
  expect(display).toBeGreaterThan(wall * 0.8);
  expect(display).toBeLessThan(wall * 1.1);
  expect(sim / display).toBeGreaterThan(3.5);
  await expect(page.getByText(/SIM TIME ×5/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('Advance time: 5 minutes run in a few seconds, then live ×1 with a notice; stop works', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&debug');
  await page.waitForFunction(() => (window.__resusDisplay?.time ?? 0) > 0.5);
  await page.getByTestId('advance-button').click();
  await page.getByTestId('advance-5').click();
  await expect(page.getByTestId('advance-running')).toBeVisible();
  await expect(page.getByTestId('time-notice')).toContainText('Advanced 05:00', {
    timeout: 30_000,
  });
  const t = await page.evaluate(() => window.__resusEngine?.getSnapshot().time ?? 0);
  expect(t).toBeGreaterThan(300);
  await expect(page.getByTestId('sim-speed-1')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('advance-button').click();
  await page.getByTestId('advance-60').click();
  await page.getByTestId('advance-stop').click();
  await expect(page.getByTestId('advance-running')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Event Director: blood gas with turnaround, passive lab notice, critical SpO₂ alert', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&debug');
  await page.getByTestId('action-labs').click();
  await page.getByTestId('order-abg').click();
  await expect(page.getByTestId('abg-pending')).toContainText('Pending');
  await page.getByTestId('action-labs').click();
  await page.evaluate(() => window.__resusEngine?.runFor(185));
  await expect(page.getByTestId('passive-notice')).toContainText('Arterial blood gas available');
  await page.getByRole('button', { name: 'Open result' }).click();
  await expect(page.getByTestId('abg-1')).toContainText('PaCO₂');
  await expect(page.getByTestId('abg-pending')).toHaveCount(0);

  await page.evaluate(() => {
    window.__resusEngine?.dispatch({ type: 'SET_CIRCUIT', connected: false }, 'instructor');
    window.__resusEngine?.runFor(200);
  });
  await expect(page.getByTestId('critical-alert')).toContainText('Saturation');
  await page.getByTestId('critical-ok').click();
  await expect(page.getByTestId('critical-alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('session tools: timeline with before → after, trend charts, progressive hints (asthma lab)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?debug');
  await page.getByTestId('module-lab').click();
  await page.getByTestId('entry-vent-asthma').click();
  await page.getByTestId('start-button').click();
  await page.evaluate(() => {
    const e = window.__resusEngine;
    e?.runFor(30);
    e?.dispatch({ type: 'SET_VENT_SETTING', key: 'rr', value: 10 }, 'user');
    e?.runFor(200);
  });
  await page.getByTestId('tool-timeline').click();
  await expect(page.getByTestId('timeline')).toContainText('RR 10');
  await expect(page.getByTestId('timeline')).toContainText('MAP');
  await page.getByTestId('tool-trends').click();
  await expect(page.getByTestId('trends').locator('canvas')).toHaveCount(5);
  await page.getByTestId('trend-range-5').click();
  await page.getByTestId('tool-hint').click();
  await page.getByTestId('hint-next-falling-bp').click();
  await expect(page.getByTestId('drawer-hint')).toContainText('expiratory flow');
  const hints = await page.evaluate(
    () => window.__resusEngine?.eventLog.filter((x) => x.kind === 'command').length ?? 0,
  );
  expect(hints).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('Physiology Lab cases: experiment card, new asthma patient on restart, call the surgeon', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?debug');
  await page.getByTestId('module-lab').click();
  await page.getByTestId('entry-vent-free').click();
  await page.getByTestId('start-button').click();
  await page.evaluate(() => window.__resusEngine?.runFor(20));
  await page.getByTestId('tool-experiments').click();
  await page.getByTestId('exp-start-peep-15').click();
  await page.evaluate(() => {
    window.__resusEngine?.dispatch({ type: 'SET_VENT_SETTING', key: 'peep', value: 15 }, 'user');
  });
  await expect(page.getByTestId('exp-settling')).toBeVisible();
  await page.evaluate(() => window.__resusEngine?.runFor(130));
  await expect(page.getByTestId('exp-result')).toContainText('MAP');
  await expect(page.getByTestId('exp-peep-15')).toContainText('venous return');

  // Severe asthma: a restart brings another patient (new seed each time).
  await page.keyboard.press('p');
  await page.getByTestId('menu-home').click();
  await page.getByTestId('module-lab').click();
  await page.getByTestId('entry-vent-asthma').click();
  await page.getByTestId('start-button').click();
  const seeds = new Set<number>();
  for (let i = 0; i < 3; i++) {
    seeds.add(await page.evaluate(() => window.__resusEngine?.getSnapshot().scenario.seed ?? 0));
    await page.keyboard.press('p');
    await page.getByTestId('menu-restart').click();
  }
  expect(seeds.size).toBe(3);

  // Hypovolaemia: the surgeon can be called from the procedures panel.
  await page.keyboard.press('p');
  await page.getByTestId('menu-home').click();
  await page.getByTestId('module-lab').click();
  await page.getByTestId('entry-haemo-hypovolaemia').click();
  await page.getByTestId('start-button').click();
  await page.getByTestId('action-procedures').click();
  await page.getByTestId('case-action-call-surgeon').click();
  await expect(page.getByTestId('case-actions')).toContainText('requested');
  expect(errors).toEqual([]);
});

test('scored session → debrief with stars and decisions → My progress, kept after reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?debug');
  await page.evaluate(() => window.localStorage.removeItem('resussim.progress.v1'));
  await page.getByTestId('module-progress').click();
  await expect(page.getByTestId('progress-screen')).toContainText('No scored sessions yet');
  await expect(page.getByTestId('progress-screen')).toContainText(
    'do not imply medical competence',
  );
  await page.getByTestId('progress-back').click();

  // Clinical challenge: the intubated asthmatic. Give time to breathe out after 30 s.
  await page.getByTestId('module-challenges').click();
  await page.getByTestId('difficulty-beginner').click();
  await page.getByTestId('entry-asthma').click();
  await page.getByTestId('start-button').click();
  await page.evaluate(() => {
    const e = window.__resusEngine;
    e?.runFor(30);
    e?.dispatch({ type: 'SET_VENT_SETTING', key: 'rr', value: 10 }, 'user');
    e?.dispatch({ type: 'SET_VENT_SETTING', key: 'vt', value: 450 }, 'user');
    e?.runFor(400);
  });
  await page.keyboard.press('p');
  await page.getByTestId('menu-end-session').click();

  const debrief = page.getByTestId('debrief-screen');
  await expect(debrief).toBeVisible();
  const stars = Number(await debrief.locator('[data-stars]').first().getAttribute('data-stars'));
  expect(stars).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('debrief-decisions')).toContainText('Ventilator');
  await expect(page.getByTestId('debrief-decisions')).toContainText('MAP');
  await expect(page.getByTestId('score-diagnosis')).toContainText('coming');
  await expect(page.getByTestId('debrief-xp')).toContainText('XP');
  await expect(debrief).toContainText('Key learning point');

  await page.getByTestId('debrief-progress').click();
  await expect(page.getByTestId('progress-history')).toContainText('falling blood pressure');
  await expect(page.getByTestId('mastery-ventilation')).toContainText(/\d/);
  await expect(page.getByTestId('achievement-first-session')).toHaveAttribute(
    'data-earned',
    'true',
  );

  // Stored on the device: still there after a reload; the module menu shows the best result.
  await page.reload();
  await page.getByTestId('module-progress').click();
  await expect(page.getByTestId('progress-history')).toContainText('falling blood pressure');
  await page.getByTestId('progress-back').click();
  await page.getByTestId('module-challenges').click();
  await expect(page.getByTestId('entry-asthma').locator('[data-stars]')).toHaveCount(1);
  await page.getByTestId('menu-back').click();

  // A resuscitation case that ends by itself opens the debrief with the CPR figures.
  await page.getByTestId('module-resus').click();
  await page.getByTestId('entry-vf-anaesthesia').click();
  await page.getByTestId('start-button').click();
  await page.evaluate(() => {
    const e = window.__resusEngine;
    e?.runFor(22);
    e?.dispatch({ type: 'CPR_START' }, 'user');
    e?.runFor(130);
  });
  await expect(page.getByTestId('debrief-screen')).toContainText('CPR performance');
  await expect(page.getByTestId('score-recognition')).toContainText('100');
  await page.getByTestId('debrief-menu').click();
  await expect(page.getByTestId('module-menu')).toBeVisible();
  expect(errors).toEqual([]);
});
