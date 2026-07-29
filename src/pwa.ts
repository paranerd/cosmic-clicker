import { registerSW } from 'virtual:pwa-register';
import { saveGame } from './game/storage';
import { showToast } from './ui/notifications';
import { getState } from './ui/store';

// Kein stiller Reload: Ein Idle-Spiel läuft im Hintergrund weiter, und ein
// Neustart mitten in einer Reaktion wirkt wie ein Absturz. Stattdessen ein
// Toast, der stehen bleibt, bis der Spieler entscheidet.
export function registerServiceWorker(): void {
  const updateServiceWorker = registerSW({
    onNeedRefresh() {
      showToast('Neue Version verfügbar.', {
        label: 'Neu laden',
        run: () => {
          // Der Reload verwirft den laufenden Frame — der Spielstand muss
          // vorher auf der Platte liegen.
          saveGame(getState());
          void updateServiceWorker(true);
        },
      });
    },
  });
}
