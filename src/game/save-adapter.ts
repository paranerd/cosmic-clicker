// Einziger Berührungspunkt zwischen Spielstand und Plattform-Speicher.
// Im Browser liegt der Spielstand in localStorage. Eine native Hülle
// (Capacitor) tauscht die Implementierung über `setSaveAdapter` aus, bevor
// `loadGame` das erste Mal läuft — der WebView-localStorage ist dort nicht
// zuverlässig, iOS räumt ihn bei Speicherdruck weg.
//
// Die Schnittstelle ist bewusst synchron, weil das Spiel nach jeder Aktion
// speichert. Ein asynchroner Unterbau (Capacitor Preferences) hält den Wert
// im Speicher und schreibt im Hintergrund durch; das Einlesen passiert dann
// einmalig beim App-Start, bevor der Adapter gesetzt wird.
export type SaveAdapter = {
  read(key: string): string | null;
  write(key: string, value: string): void;
  clear(key: string): void;
};

// Zugriff bewusst erst zur Laufzeit, nicht beim Import: Tests ersetzen
// `localStorage` global, und in einer nativen Hülle kann der Zugriff vor dem
// Austausch des Adapters fehlschlagen.
const localStorageAdapter: SaveAdapter = {
  read: (key) => localStorage.getItem(key),
  write: (key, value) => localStorage.setItem(key, value),
  clear: (key) => localStorage.removeItem(key),
};

let adapter: SaveAdapter = localStorageAdapter;

export const setSaveAdapter = (next: SaveAdapter): void => { adapter = next; };

export const getSaveAdapter = (): SaveAdapter => adapter;
