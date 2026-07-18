import { expect, test } from '@playwright/test';

test('player can accrete matter and see the stellar data update', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Stellarer Kern' })).toBeVisible();
  await expect(page.getByText('Urwolke', { exact: true }).first()).toBeVisible();
  const star = page.getByRole('button', { name: 'Materie akkretieren' });
  await star.click();
  await expect(page.getByText('+120 ME')).toBeVisible();
  await expect(page.getByText('120', { exact: true }).first()).toBeVisible();
});

test('desktop cockpit fits and exposes the separated control tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  await expect(page.getByRole('tab', { name: 'Reaktionen 0' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Upgrades 0' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Automationen 0' })).toBeVisible();
  await expect(page.locator('[data-ui="temperature-max"]')).toHaveText('1 Mio. K');

  const dimensions = await page.evaluate(() => ({ documentHeight: document.body.scrollHeight, viewportHeight: window.innerHeight }));
  expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight);
});

test('restart uses an inline confirmation instead of a browser dialog', async ({ page }) => {
  await page.goto('/');
  const reset = page.getByRole('button', { name: 'Runde neu starten' });
  await reset.click();
  await expect(reset).toContainText('Runde neu starten?');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
