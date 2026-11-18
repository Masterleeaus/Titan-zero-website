import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(ROOT, 'pages/workforce.html'), 'utf8');
const copy = readFileSync(resolve(ROOT, 'workforce/index.html'), 'utf8');

test('the workforce copy is in step with its published copy', () => {
  assert.equal(copy, source);
});

test('the predictive level is marked as not yet available', () => {
  assert.match(source, /Predictive \+ Autonomous<\/h3>[\s\S]*?<strong>Planned\.<\/strong> Not available yet\./);
});

test('predictive roles are labelled Planned', () => {
  assert.match(source, /Predictive Growth Specialist \(Planned\)/);
  assert.match(source, /Demand Forecast Worker \(Planned\)/);
});

test('the availability note explains what Planned means', () => {
  assert.match(source, /Roles marked Planned are not available yet\./);
});
