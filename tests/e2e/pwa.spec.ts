import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Der Dev-Server liefert unter /, der Produktions-Build unter /cosmic-clicker/.
// Diese Tests laufen bewusst gegen den Preview-Build, weil Scope und
// start_url nur dort ihren echten Wert haben.
const BASE = '/cosmic-clicker/';

async function waitForServiceWorker(page: Page): Promise<void> {
  await page.goto(BASE);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
}

test('liefert ein installierbares Manifest', async ({ page, request }) => {
  await page.goto(BASE);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe(`${BASE}manifest.webmanifest`);

  const response = await request.get(href!);
  expect(response.status()).toBe(200);
  const manifest = await response.json();

  // Ein falscher Scope schickt die installierte App auf die Domain-Wurzel,
  // wo unter GitHub Pages nichts liegt.
  expect(manifest.start_url).toBe(BASE);
  expect(manifest.scope).toBe(BASE);
  expect(manifest.display).toBe('standalone');
  expect(manifest.name).toContain('Cosmic Clicker');

  const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
  expect(purposes).toContain('maskable');
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');

  for (const icon of manifest.icons as { src: string }[]) {
    const iconResponse = await request.get(new URL(icon.src, new URL(href!, 'http://127.0.0.1:4173')).pathname);
    expect(iconResponse.status(), `Icon ${icon.src} fehlt`).toBe(200);
  }
});

test('registriert einen Service Worker im richtigen Scope', async ({ page }) => {
  await waitForServiceWorker(page);
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.scope ?? '';
  });
  expect(new URL(scope).pathname).toBe(BASE);
});

test('startet ohne Netzwerk aus dem Cache', async ({ page, context }) => {
  await waitForServiceWorker(page);
  // Der Precache füllt sich beim Aktivieren; erst danach trägt der Offline-Test.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();

  // Reicht als Nachweis, dass Dokument, Skript und Styles aus dem Cache kamen:
  // ohne JavaScript bliebe #app leer.
  await expect(page.locator('#app')).not.toBeEmpty();
  await expect(page.locator('body')).toContainText('Urwolke');
  await context.setOffline(false);
});
