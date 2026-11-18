import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'pages/pricing.html'), 'utf8');

test('three-option summary sits above the calculator form (issue 71)', () => {
  const sectionAt = html.indexOf('<section class="section quote-section subtle-section" id="calculator"');
  const summaryAt = html.indexOf('class="fd-summary"');
  const formAt = html.indexOf('<form class="bos-configurator"');
  assert.ok(sectionAt > 0 && summaryAt > sectionAt, 'summary sits inside the calculator section');
  assert.ok(summaryAt < formAt, 'summary comes before the calculator form');
});

test('summary has Free, Assistant and Agent Team, each with a buyer', () => {
  const block = html.slice(html.indexOf('class="fd-summary"'), html.indexOf('class="quote-heading"'));
  for (const name of ['<h3>Free plugin</h3>', '<h3>AI Assistant</h3>', '<h3>AI Agent Team</h3>']) {
    assert.ok(block.includes(name), `missing ${name}`);
  }
  assert.equal((block.match(/<strong>Suits:<\/strong>/g) || []).length, 3);
});

test('exactly one option is marked recommended', () => {
  const block = html.slice(html.indexOf('class="fd-summary"'), html.indexOf('class="quote-heading"'));
  assert.equal((block.match(/fd-summary-card-recommended/g) || []).length, 1);
  assert.equal((block.match(/Recommended/g) || []).length, 1);
});
