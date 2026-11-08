// The phone stylesheet: readable contrast in both themes, and the phone-only design rules.
// Reads styles.css (phone.css while ticket 015-018 built the phone UI beside the old page).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const file = existsSync(new URL('../phone.css', import.meta.url)) ? '../phone.css' : '../styles.css';
const css = readFileSync(new URL(file, import.meta.url), 'utf8');

/** @returns {Record<string, string>[]} light theme first, then dark */
function themes() {
  return [...css.matchAll(/:root\s*{([^}]*)}/g)].map(([, body]) =>
    Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(([, name, hex]) => [name, hex])));
}

/** @param {string} hex */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {string} a @param {string} b */
function contrast(a, b) {
  assert.ok(a && b, 'a color used in the check is missing');
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS = [
  ['text', 'bg'], ['text', 'card'], ['text', 'input-bg'], ['muted', 'bg'], ['muted', 'card'],
  ['accent-text', 'accent'], ['accent', 'card'], ['accent', 'bg'], ['error', 'error-bg'],
  ['ok', 'ok-bg'], ['ok', 'card'], ['notice-text', 'notice-bg'], ['error', 'card'],
];
const UI_PAIRS = [
  ['input-border', 'card'], ['input-border', 'input-bg'], ['focus', 'card'], ['focus', 'bg'],
  ['goals', 'track'], ['ok', 'track'],
];

test('light and dark themes define the same colors', () => {
  const [light, dark] = themes();
  assert.ok(light && dark);
  assert.deepEqual(Object.keys(dark).sort(), Object.keys(light).sort());
});

for (const [index, name] of ['light', 'dark'].entries()) {
  test(`${name} theme: text is readable (4.5:1) and controls stand out (3:1)`, () => {
    const theme = themes()[index];
    for (const [fg, bg] of TEXT_PAIRS) {
      const ratio = contrast(theme[fg], theme[bg]);
      assert.ok(ratio >= 4.5, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
    }
    for (const [fg, bg] of UI_PAIRS) {
      const ratio = contrast(theme[fg], theme[bg]);
      assert.ok(ratio >= 3, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
    }
  });
}

test('nothing depends on hover', () => {
  assert.doesNotMatch(css, /:hover/);
});

test('safe areas are respected and the column is phone width', () => {
  for (const side of ['top', 'right', 'bottom', 'left']) {
    assert.match(css, new RegExp(`env\\(safe-area-inset-${side}\\)`), side);
  }
  assert.match(css, /max-width:\s*430px/);
});
