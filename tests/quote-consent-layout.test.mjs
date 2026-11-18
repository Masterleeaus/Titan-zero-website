import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(ROOT, 'assets/styles.css'), 'utf8');
const page = readFileSync(resolve(ROOT, 'pages/tool-quote-builder.html'), 'utf8');

// Issue #111: the custom tool forms widen every input to 100%, which stretched the consent checkbox
// and pushed its label past the right edge at 768px. The checkbox rule must outrank that rule.
test('the consent checkbox keeps its size inside custom tool forms', () => {
  assert.match(css, /\.custom-tool-form \.check-card input\[type=checkbox\]\{width:22px;[^}]*flex:0 0 22px\}/);
  assert.match(css, /\.custom-tool-form input,[^{]*\{width:100%/);
});

test('the quote builder uses a check card for the customer consent', () => {
  assert.match(page, /<label class="check-card"><input name="consent" type="checkbox">/);
});
