// Deterministic fixture matrix for the shared engine (#42).
// For every calculator rule in assets/tools-engine.js this file checks a known-good baseline,
// refuses each kind of bad input (blank, text, NaN, Infinity, negative, out of range,
// over-precise money), accepts the zero and limit values, and runs each calculator
// on zero-valued inputs without throwing or producing a non-finite number.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const E = require('../assets/tools-engine.js');

// Known-good baselines, matching the public tool defaults.
const BASE = {
  admin: { adminHours: 10, adminRate: 45 },
  hire: { salary: 65000, oncost: 18, margin: 180 },
  breakeven: { fixed: 12000, price: 450, variable: 180 },
  profit: { jobRevenue: 650, labour: 220, materials: 110, travel: 45 },
  capacity: { workers: 4, hours: 30, duration: 2.5, currentJobs: 150 },
  calls: { calls: 120, missed: 12, convert: 30, jobValue: 350 },
  leads: { leads: 100, current: 20, target: 23, value: 450 },
  invoice: { invoices: 80, avg: 520, overdue: 18, chase: 7 },
};
const BAD_TEXT = ['', '   ', 'abc', 'NaN', 'Infinity', '-Infinity', '1e400'];

for (const [tool, base] of Object.entries(BASE)) {
  const rules = E.RULES[tool];

  test(`fixture ${tool}: the baseline is accepted and returns the same values`, () => {
    const checked = E.validate(tool, base);
    assert.equal(checked.ok, true, JSON.stringify(checked.errors));
    for (const key of Object.keys(base)) assert.equal(checked.values[key], base[key]);
  });

  test(`fixture ${tool}: non-numeric, NaN and infinite text is refused for every field`, () => {
    for (const key of Object.keys(rules)) {
      for (const bad of BAD_TEXT) {
        const result = E.validate(tool, { ...base, [key]: bad });
        assert.equal(result.ok, false, `${tool}.${key} accepted ${JSON.stringify(bad)}`);
        assert.ok(result.errors.some((e) => e.key === key), `${tool}.${key} error not attributed`);
      }
    }
  });

  test(`fixture ${tool}: values below the minimum and above the maximum are refused`, () => {
    for (const [key, spec] of Object.entries(rules)) {
      const below = spec.min - 1;
      assert.equal(E.validate(tool, { ...base, [key]: below }).ok, false, `${tool}.${key} accepted ${below}`);
      const above = spec.max === undefined ? null : spec.max + 1;
      if (above !== null) assert.equal(E.validate(tool, { ...base, [key]: above }).ok, false, `${tool}.${key} accepted ${above}`);
    }
  });

  test(`fixture ${tool}: the minimum of each field is accepted, and zero where the minimum is zero`, () => {
    for (const [key, spec] of Object.entries(rules)) {
      const ok = E.validate(tool, { ...base, [key]: spec.min });
      assert.equal(ok.ok, true, `${tool}.${key} refused its minimum ${spec.min}: ${JSON.stringify(ok.errors)}`);
    }
  });

  test(`fixture ${tool}: money fields refuse more than two decimal places`, () => {
    for (const [key, spec] of Object.entries(rules)) {
      if (spec.kind !== 'money') continue;
      const result = E.validate(tool, { ...base, [key]: 10.001 });
      assert.equal(result.ok, false, `${tool}.${key} accepted 10.001`);
      assert.equal(E.validate(tool, { ...base, [key]: 10.5 }).ok, true);
    }
  });

  test(`fixture ${tool}: zero-valued inputs run through the calculator with finite or null results`, () => {
    const calc = E.calculators[tool];
    if (!calc) return; // leads and invoice have calculators; others are checked via their own tests
    const zeroed = {};
    for (const [key, spec] of Object.entries(rules)) zeroed[key] = spec.min;
    const checked = E.validate(tool, zeroed);
    assert.equal(checked.ok, true);
    const out = calc(checked.values);
    assert.ok(out.metric === null || Number.isFinite(out.metric), `${tool} produced ${out.metric}`);
    assert.equal(typeof out.label, 'string');
    assert.equal(typeof out.math, 'string');
  });
}

test('fixture: every calculator in the engine has a baseline fixture here', () => {
  for (const tool of Object.keys(E.calculators)) assert.ok(BASE[tool], `no baseline for ${tool}`);
});

test('fixture: job cost sheet baseline keeps costs and price separate and refuses NaN', () => {
  const rules = E.RULES.jobcost;
  const base = { workers: 2, hours: 2, rate: 45, materials: 0, travel: 0, other: 0, overhead: 0, price: 300, target: 30 };
  assert.equal(E.validate('jobcost', base).ok, true);
  assert.equal(E.validate('jobcost', { ...base, rate: NaN }).ok, false);
  // Two workers for 2 hours at A$45 is one labour line of 4 hours (#104: engine.formulas.jobCostSheet).
  const out = E.formulas.jobCostSheet({ roles: [{ hours: 4, rate: 45 }], materials: 0, travel: 0, equipment: 0, overhead: 0, price: 300, targetMarginPct: 30 });
  assert.equal(out.directCost, 180);
  assert.equal(out.totalCost, 180);
  assert.equal(out.margin, 120);
  // Target price is rounded up to the cent, as the service pricing tool does (#32). 180 / 0.7 = 257.142...
  assert.equal(out.targetPrice, 257.15);
  assert.ok(Object.keys(rules).every((k) => k in base));
});
