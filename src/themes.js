// Theme system — single phantom theme

export const THEMES = {
  phantom: {
    name: 'PHANTOM',
    primary:   'oklch(0.72 0.18 280)',  // electric purple
    secondary: 'oklch(0.80 0.16 200)',  // ice blue
    accent:    'oklch(0.92 0.10 280)',  // bright violet
    dim:       'oklch(0.25 0.04 280)',
    bg:        'oklch(0.04 0.04 280)',
    ring:      'oklch(0.70 0.18 280)',
    ringWidth: 4,
    indicatorRadius: 12,
    tickCount: 21,                      // fine grid ticks
    canvasBorder: 'oklch(0.70 0.18 280 / 0.25)',
    canvasBorderWidth: 1,
    canvasRadius: 12,                   // rounded rect — full width/height
    ambientHue: 280,
  },
};

export function getTheme(id) {
  return THEMES.phantom;
}

export function getThemeIds() {
  return ['phantom'];
}

export function getSavedThemeId() {
  return 'phantom';
}

export function saveThemeId(id) {
  // no-op — single theme
}
