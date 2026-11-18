// Issue #6 / #89: Front Desk concept images must be labelled, responsive and accessible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const CASES = [
  { page: 'pages/frontdeskai.html', prefix: 'frontdesk-ai-concept' },
  { page: 'pages/frontdeskagent.html', prefix: 'frontdesk-agent-concept' },
];

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const { page, prefix } of CASES) {
  test(`${page} shows a labelled responsive concept image`, () => {
    const html = read(page);
    const fig = /<figure class="concept-figure">([\s\S]*?)<\/figure>/.exec(html);
    assert.ok(fig, 'concept figure present');
    const body = fig[1];
    // Labelled on the page, next to the image.
    assert.match(body, /<figcaption><strong>Conceptual demonstration\.<\/strong>/);
    // Responsive set with srcset, sizes, explicit size and lazy loading.
    const img = /<img\b[^>]*>/.exec(body)[0];
    assert.match(img, /width="1280" height="800"/);
    assert.match(img, /loading="lazy"/);
    assert.match(img, /sizes="[^"]+"/);
    const srcset = /srcset="([^"]+)"/.exec(img)[1].split(',').map((s) => s.trim());
    assert.equal(srcset.length, 3, 'three widths in srcset');
    for (const entry of srcset) {
      const [file, w] = entry.split(' ');
      assert.match(w, /^\d+w$/);
      assert.ok(existsSync(join(ROOT, file.slice(1))), `${file} exists`);
      assert.ok(statSync(join(ROOT, file.slice(1))).size < 60_000, `${file} stays small`);
    }
    // Alt text describes the illustration and never presents it as a live screen.
    const alt = /alt="([^"]*)"/.exec(img)[1];
    assert.ok(alt.length > 40, 'alt text describes the image');
    assert.match(alt, /Conceptual illustration/);
    assert.doesNotMatch(alt, /live (product|screen|dashboard)/i);
    assert.ok(srcset.some((s) => s.includes(prefix)), 'uses the matching asset prefix');
  });
}

test('concept caption text meets WCAG AA contrast on its background', () => {
  const css = read('assets/styles.css');
  const rule = /\.concept-figure figcaption\{[^}]*color:(#[0-9a-f]{6});[^}]*background:(#[0-9a-f]{6})/i.exec(css);
  assert.ok(rule, 'caption colour rule present');
  assert.ok(contrast(rule[1], rule[2]) >= 4.5, `contrast ${contrast(rule[1], rule[2]).toFixed(2)} >= 4.5`);
});

test('the retired Pro page does not show a concept image', () => {
  assert.doesNotMatch(read('pages/frontdeskpro.html'), /concept-figure|frontdesk-(pro|ai|agent)-concept/);
});
