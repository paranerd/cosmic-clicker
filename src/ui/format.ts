export const icons = {
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m16 10 5 5m0-5-5 5"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 19h16"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v5h5"/><path d="M5.4 16a8 8 0 1 0 .5-9L4 9"/></svg>',
  stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/></svg>',
  help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1-1.4 2.2M12 17h.01"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
  warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4m0 3h.01"/></svg>',
  // Eck-Ausbaubutton auf Automations-, Upgrade- und Reaktionskarten: feste
  // Zustandsfolge Schloss (freischalten) → Doppel-Caret (ausbauen) → Haken
  // (voll ausgebaut), unabhängig von der momentanen Bezahlbarkeit — die zeigt
  // nur noch der Glow/Fill des Buttons an, nicht mehr das Icon selbst.
  buildUp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 16 12 11 17 16M7 10 12 5 17 10" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke-linecap="round"/></svg>',
};

export const formatNumber = (value: number, maximumFractionDigits = 0): string =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits }).format(Math.max(0, value));

export const formatCompact = (value: number): string => value < 1_000_000
  ? formatNumber(value)
  : new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.round(value));
export const formatMatter = (value: number): string => formatCompact(Math.round(value));
export const formatSolarMasses = (value: number): string => `${formatNumber(value, 2)} M☉`;

// For small rates (e.g. a faint shell wind well under 1 ME/s), formatMatter's
// whole-ME rounding collapses the value to "0" while a sign is still shown
// next to it ("−0 ME/s"). Scale precision up for small values instead.
export const formatRate = (value: number): string => {
  if (value < 1) return formatNumber(value, 2);
  if (value < 10) return formatNumber(value, 1);
  return formatMatter(value);
};

export function formatTemperature(value: number): string {
  if (value >= 1_000_000_000) return `${formatNumber(value / 1_000_000_000, 2)} Mrd. K`;
  if (value >= 1_000_000) return `${formatNumber(value / 1_000_000, 2)} Mio. K`;
  return `${formatNumber(value, value < 100_000 ? 1 : 0)} K`;
}

export function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const matterPercent = (value: number, total: number): number => total <= 0 ? 0 : value / total * 100;
export const disabled = (condition: boolean): string => condition ? 'disabled aria-disabled="true"' : '';

export function temperatureScale(value: number): { max: number; label: string; progress: number } {
  const stops = [100_000, 1_000_000, 10_000_000, 100_000_000, 600_000_000, 1_200_000_000, 1_500_000_000, 2_700_000_000];
  const max = stops.find((stop) => value <= stop) ?? 10 ** Math.ceil(Math.log10(value));
  return { max, label: formatTemperature(max), progress: Math.min(100, value / max * 100) };
}

export function levelPips(level: number, max: number): string {
  return Array.from({ length: max }, (_, index) => `<i class="level-pip ${index < level ? 'is-filled' : ''}"></i>`).join('');
}
