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
  expect(painted).toHaveLength(7); // ECG, pleth, ART, CO2, Paw, flow, volume
  for (const lit of painted) expect(lit).toBeGreaterThan(200);

  // 5-electrode cable: an extra V5 trace with ST numerics.
  await page.getByTestId('ecg-leads-5').click();
  await page.evaluate(() => window.__resusEngine?.runFor(4));
  await expect(page.locator('canvas')).toHaveCount(8);
  await expect(page.getByText(/ST-V5/)).toBeVisible();
  await page.getByTestId('ecg-leads-3').click();
  await expect(page.locator('canvas')).toHaveCount(7);

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
