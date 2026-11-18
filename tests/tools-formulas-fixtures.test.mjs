// Before/after regression for the live calculator formulas (#104).
// tests/fixtures/live-formulas.json was recorded from the formulas that the live pages
// used before they moved into assets/tools-engine.js. Every case must still produce the
// same output, deep-equal, and every error case must keep its message.
// The jobcost/* entries were re-recorded for #32: job-cost money is now whole cents per line
// (as the service pricing tool) and the target price is rounded up to the cent.
// The quote-record/save entry was re-recorded for #31: saved records now carry a history list of
// earlier versions (empty for a first save).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { formulaCases } from './fixtures/live-formula-cases.mjs';

const require = createRequire(import.meta.url);
const E = require('../assets/tools-engine.js');
const before = JSON.parse(readFileSync(new URL('./fixtures/live-formulas.json', import.meta.url), 'utf8'));
const cases = formulaCases(E.formulas);

// JSON cannot hold NaN or Infinity; the fixture stores them as text, so compare in the same form.
const normalise = (value) => JSON.parse(JSON.stringify(value, (key, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'non-finite:' + String(v) : v)));

test('fixtures cover every case in the grid and nothing extra', () => {
  assert.deepEqual(Object.keys(cases).sort(), Object.keys(before).sort());
});

for (const name of Object.keys(before)) {
  test('formula output is unchanged after the move: ' + name, () => {
    const expected = before[name];
    if (!expected.ok) {
      assert.throws(() => cases[name](), (error) => error.message === expected.error, 'error message must stay the same');
      return;
    }
    assert.deepEqual(normalise(cases[name]()), expected.result);
  });
}

test('the old engine quote and jobCost are gone; the live quote and job-cost formulas are the engine API', () => {
  assert.equal(E.quote, undefined);
  assert.equal(E.jobCost, undefined);
  assert.equal(typeof E.formulas.quoteTotals, 'function');
  assert.equal(typeof E.formulas.jobCostSheet, 'function');
});
