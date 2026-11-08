// Readable contrast in both themes (ticket 007), checked against the colors in styles.css.
// Text needs 4.5:1 (WCAG AA). Boundaries of controls and progress bars need 3:1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

/**
 * Every ":root { ... }" block in order: the first is the light theme, the second the dark one.
 * @returns {Record<string, string>[]}
 */
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
  assert.ok(a && b, 'a color used in the check is missing from styles.css');
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS = [
  ['text', 'bg'], ['text', 'card'], ['text', 'input-bg'], ['muted', 'bg'], ['muted', 'card'],
  ['accent-text', 'accent'], ['error', 'error-bg'], ['error', 'card'], ['ok', 'ok-bg'], ['ok', 'card'],
  ['notice-text', 'notice-bg'],
];
const UI_PAIRS = [
  ['input-border', 'card'], ['input-border', 'input-bg'], ['focus', 'card'], ['focus', 'bg'],
  ['goals', 'track'], ['ok', 'track'], ['goals', 'card'],
];

test('styles.css defines a light and a dark theme with the same color names', () => {
  const [light, dark] = themes();
  assert.ok(light && dark, 'expected two :root blocks');
  assert.deepEqual(Object.keys(dark).sort(), Object.keys(light).sort());
});

for (const [index, name] of ['light', 'dark'].entries()) {
  test(`${name} theme: text is readable (at least 4.5:1)`, () => {
    const theme = themes()[index];
    for (const [fg, bg] of TEXT_PAIRS) {
      const ratio = contrast(theme[fg], theme[bg]);
      assert.ok(ratio >= 4.5, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
    }
  });

  test(`${name} theme: control edges and progress bars stand out (at least 3:1)`, () => {
    const theme = themes()[index];
    for (const [fg, bg] of UI_PAIRS) {
      const ratio = contrast(theme[fg], theme[bg]);
      assert.ok(ratio >= 3, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
    }
  });
}
