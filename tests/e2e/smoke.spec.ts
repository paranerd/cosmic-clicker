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
