// Theme System Tests
// Run with: node test/themes.test.js

import { THEMES, getTheme, getThemeIds, getSavedThemeId } from '../src/themes.js';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

function section(name) {
  console.log(`\n--- ${name} ---`);
}

// === THEME DEFINITIONS ===
section('Theme Definitions');

const themeIds = getThemeIds();
assert(themeIds.length === 1, `1 theme defined: got ${themeIds.length}`);
assert(themeIds.includes('phantom'), `Has phantom theme`);

// === REQUIRED THEME PROPERTIES ===
section('Theme Properties');

const requiredProps = [
  'name', 'primary', 'secondary', 'accent', 'dim', 'bg',
  'ring', 'ringWidth', 'indicatorRadius', 'tickCount',
  'canvasBorder', 'canvasBorderWidth', 'canvasRadius', 'ambientHue'
];

const t = getTheme('phantom');
for (const prop of requiredProps) {
  assert(t[prop] !== undefined, `phantom.${prop} exists`);
}

// === THEME PROPERTY TYPES ===
section('Theme Property Types');

assert(typeof t.name === 'string' && t.name.length > 0, `phantom.name is non-empty string`);
assert(typeof t.primary === 'string' && t.primary.startsWith('oklch'), `phantom.primary is oklch color`);
assert(typeof t.secondary === 'string' && t.secondary.startsWith('oklch'), `phantom.secondary is oklch color`);
assert(typeof t.accent === 'string' && t.accent.startsWith('oklch'), `phantom.accent is oklch color`);
assert(typeof t.ringWidth === 'number' && t.ringWidth > 0, `phantom.ringWidth is positive number`);
assert(typeof t.indicatorRadius === 'number' && t.indicatorRadius > 0, `phantom.indicatorRadius > 0`);
assert(typeof t.tickCount === 'number' && t.tickCount >= 0, `phantom.tickCount >= 0`);
assert(typeof t.canvasBorderWidth === 'number' && t.canvasBorderWidth > 0, `phantom.canvasBorderWidth > 0`);
assert(typeof t.canvasRadius === 'number' && t.canvasRadius >= 0, `phantom.canvasRadius >= 0`);
assert(typeof t.ambientHue === 'number' && t.ambientHue >= 0 && t.ambientHue <= 360, `phantom.ambientHue in [0,360]: ${t.ambientHue}`);

// === GETTHEME FALLBACK ===
section('getTheme Fallback');

const fallback = getTheme('nonexistent');
assert(fallback === THEMES.phantom, `Unknown themeId falls back to phantom`);

const direct = getTheme('phantom');
assert(direct === THEMES.phantom, `getTheme("phantom") returns phantom theme`);

// === ACCENT LEGIBILITY ===
section('Accent Legibility');

const match = t.accent.match(/oklch\(([\d.]+)/);
if (match) {
  const lightness = parseFloat(match[1]);
  assert(lightness >= 0.85, `phantom.accent lightness >= 0.85 for legibility: got ${lightness}`);
}

// === CANVAS BORDER ===
section('Canvas Border');

assert(t.canvasBorder.includes('oklch'), `phantom.canvasBorder is oklch color`);
assert(t.canvasBorder.includes('/'), `phantom.canvasBorder has alpha channel`);
assert(t.canvasRadius < 50, `phantom has rectangular canvas (radius ${t.canvasRadius})`);

// === DIAL THEME COMPATIBILITY ===
section('Dial Theme Compatibility');

assert(t.ring !== undefined, `phantom has ring color for dial`);
assert(t.ringWidth >= 3 && t.ringWidth <= 10, `phantom ringWidth in reasonable range [3-10]: ${t.ringWidth}`);
assert(t.indicatorRadius >= 10 && t.indicatorRadius <= 20, `phantom indicatorRadius in [10-20]: ${t.indicatorRadius}`);

// === SAVED THEME ===
section('Saved Theme');

assert(getSavedThemeId() === 'phantom', `getSavedThemeId returns phantom`);

// === RESULTS ===
section('Results');
console.log(`\n${'='.repeat(40)}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log(`${'='.repeat(40)}`);

if (failed > 0) process.exit(1);
