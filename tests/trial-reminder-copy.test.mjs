import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('pricing page states the trial reminder commitment (issue 70)', () => {
  const html = read('pages/pricing.html');
  assert.match(html, /No paid trial is offered at the moment\. If a paid trial is offered, Titan Zero will send a reminder before the trial ends\./);
});

test('free plugin page does not ask for a card (issue 70)', () => {
  const html = read('pages/frontdesk.html');
  assert.doesNotMatch(html, /credit card|card number|card details/i);
});
