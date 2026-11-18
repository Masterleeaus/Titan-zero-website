import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(ROOT, 'assets/styles.css'), 'utf8');

// Issue #112: brand purple, red and blue text must reach WCAG AA (4.5:1) on the dark backgrounds the pages use.
const BACKGROUNDS = ['#101722', '#142033', '#0d131e', '#111927', '#101a29', '#1c2a3f', '#0c1420', '#1b1017', '#090c12', '#1c2a3f'];

function luminance(hex) {
  const channel = (i) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const inks = [...css.matchAll(/--accent-ink:(#[0-9A-Fa-f]{6})/g)].map((m) => m[1]);

test('every hard-coded accent text colour meets 4.5:1 on the dark backgrounds', () => {
  assert.ok(inks.length >= 4, 'accent text colours are defined');
  for (const ink of new Set(inks)) {
    for (const bg of BACKGROUNDS) {
      assert.ok(ratio(ink, bg) >= 4.5, `${ink} on ${bg} is ${ratio(ink, bg).toFixed(2)}:1`);
    }
  }
});

test('the brand purple, red and blue are kept for fills, and text uses the tint variable', () => {
  assert.match(css, /\.accent-build\{--accent:var\(--build\);--accent-ink:#B570FF\}/);
  assert.match(css, /\.accent-desk\{--accent:var\(--desk\);--accent-ink:#FF6573\}/);
  assert.match(css, /\.accent-solo\{--accent:var\(--solo\);--accent-ink:#5AA0FF\}/);
  assert.match(css, /\.suite-card-top \.icon,\.suite-link\{color:var\(--accent-ink,var\(--accent\)\)\}/);
});
