import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages liefert das Spiel unter /cosmic-clicker/ aus, der Dev-Server
// unter /. Eine native Hülle (Capacitor) lädt dagegen aus der Wurzel des
// WebViews und bringt die Dateien schon mit — dafür genügt
// `BASE_PATH=/ DISABLE_PWA=1 npm run build`, ohne das Pages-Deployment
// anzufassen. Der Service Worker wäre dort nicht nur nutzlos, sondern würde
// dem nativen Update-Mechanismus in die Quere kommen.
const resolveBase = (command: string, isPreview: boolean): string => {
  if (process.env.BASE_PATH) return process.env.BASE_PATH;
  return command === 'build' || isPreview ? '/cosmic-clicker/' : '/';
};

export default defineConfig(({ command, isPreview }) => {
  const base = resolveBase(command, isPreview ?? false);
  return {
    base,
    plugins: [
      VitePWA({
        disable: process.env.DISABLE_PWA === '1',
        registerType: 'prompt',
        includeAssets: ['favicon.ico', 'favicon.svg', 'favicon-32x32.png', 'apple-touch-icon.png'],
        manifest: {
          id: base,
          start_url: base,
          scope: base,
          name: 'Cosmic Clicker — Stellar Forge',
          short_name: 'Cosmic Clicker',
          description: 'Forme aus einer Urwolke deinen ersten Stern.',
          lang: 'de',
          display: 'standalone',
          // Das UI ist eine einspaltige Panel-Ansicht; eine Drehung mitten im
          // Klicken reißt den Spielfluss nur auseinander.
          orientation: 'portrait',
          theme_color: '#070b14',
          background_color: '#060910',
          categories: ['games'],
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Das Spiel lädt zur Laufzeit nichts nach: Sound wird synthetisiert,
          // der Spielstand liegt lokal. Ein vollständiger Precache genügt
          // deshalb für den Offline-Betrieb.
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          // Ohne `clientsClaim` steuert der Worker den ersten Seitenaufruf noch
          // nicht — wer einmal lädt, schließt und offline zurückkommt, stünde
          // vor einer leeren Seite. `skipWaiting` bleibt bewusst aus: ein
          // Update übernimmt erst, wenn der Spieler den Toast bestätigt.
          clientsClaim: true,
        },
      }),
    ],
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});
