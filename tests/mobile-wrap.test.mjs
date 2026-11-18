import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(ROOT, 'assets/styles.css'), 'utf8');

// Issue #110: at phone widths, text may break inside long words so that brand names cannot widen the page.
test('phone widths let text break inside long words', () => {
  const rule = /@media \(max-width:600px\)\{([^{}]*)\{overflow-wrap:anywhere\}\}/.exec(css);
  assert.ok(rule, 'the max-width:600px overflow-wrap rule exists');
  for (const selector of ['h1', 'h2', 'h3', 'p', 'a', 'span', 'strong', 'small', 'label', 'td']) {
    assert.ok(rule[1].split(',').includes(selector), `${selector} is covered`);
  }
});
