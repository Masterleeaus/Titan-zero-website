// Regression tests for the public break-even calculator (#23).
// Uses the pure engine in assets/tools-engine.js: no DOM, no network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const engine = require('../assets/tools-engine.js');
const calc = (values) => engine.calculators.breakeven(values);
const source = readFileSync(new URL('../assets/tools.js', import.meta.url), 'utf8');

test('normal contribution calculates rounded-up count', () => {
  const r = calc({ fixed: 12000, price: 450, variable: 180 });
  assert.equal(r.metric, 45);
  assert.equal(r.format, 'count');
});

test('non-positive contribution with positive fixed cost is impossible, not zero', () => {
  for (const [price, variable] of [[100, 100], [80, 100], [0, 0], [0, 5]]) {
    const r = calc({ fixed: 12000, price, variable });
    assert.equal(r.metric, null);
    assert.equal(r.format, 'unavailable');
    assert.equal(r.status, 'unavailable');
    assert.match(r.label, /No break-even/i);
  }
});

test('zero fixed costs require no jobs regardless of margin, and make no profit claim', () => {
  for (const [price, variable] of [[100, 100], [20, 100], [300, 100]]) {
    const r = calc({ fixed: 0, price, variable });
    assert.equal(r.metric, 0);
    assert.equal(r.format, 'count');
    assert.match(r.notes[0], /not a claim that the service is profitable/);
  }
});

test('one cent of contribution is computed exactly, not lost to float error', () => {
  // 100.10 - 100.00 = 0.10 exactly in cents. Float maths would give 0.0999... and 11 jobs.
  const r = calc({ fixed: 1, price: 100.1, variable: 100 });
  assert.equal(r.metric, 10);
});

test('fractional job counts round up to a whole job', () => {
  assert.equal(calc({ fixed: 1000, price: 100.03, variable: 100 }).metric, 33334);
  assert.equal(calc({ fixed: 100, price: 11, variable: 10 }).metric, 100);
});

test('very large amounts stay exact or are refused, never silently wrong', () => {
  const big = calc({ fixed: 1e9, price: 1e6, variable: 1 });
  // 1,000,000,000 / (1,000,000 - 1) = 1000.001, so the whole-job count is 1001.
  assert.equal(big.metric, 1001);
  const v = engine.validate('breakeven', { fixed: 1e10, price: 1, variable: 0 });
  assert.equal(v.ok, false, 'amounts above the input maximum are rejected before calculation');
});

test('invalid numeric states are rejected before any result is shown', () => {
  const cases = [
    { fixed: 'abc', price: 450, variable: 180 },
    { fixed: '', price: 450, variable: 180 },
    { fixed: Infinity, price: 450, variable: 180 },
    { fixed: NaN, price: 450, variable: 180 },
    { fixed: -1, price: 450, variable: 180 },
    { fixed: 12000, price: 1e10, variable: 180 },
    { fixed: 12000, price: 450.005, variable: 180 },
  ];
  for (const input of cases) {
    const v = engine.validate('breakeven', input);
    assert.equal(v.ok, false, JSON.stringify(input));
    assert.ok(v.errors.length >= 1);
  }
});

test('display uses words for the unavailable state, not a coerced zero', () => {
  assert.match(source, /outcome\.format==='unavailable'\?'Not achievable'/);
  assert.match(source, /displayed\+' — '/);
});
