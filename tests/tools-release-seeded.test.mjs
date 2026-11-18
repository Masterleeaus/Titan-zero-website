// Seeded property tests for the calculator formulas (#46).
// A fixed pseudo-random generator (mulberry32) produces the same inputs on every run, so a failure
// can be reproduced exactly from the seed printed in the test name. No external randomness is used.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const E = require('../assets/tools-engine.js');
const F = E.formulas;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, min, max, step) => {
  const n = Math.floor(rand() * (Math.round((max - min) / step) + 1));
  return Math.round((min + n * step) * 100) / 100;
};
const SEEDS = [1, 7, 42, 2026, 11118];

for (const seed of SEEDS) {
  test(`seed ${seed}: quote totals are whole cents and add up in every GST mode`, () => {
    const rand = mulberry32(seed);
    for (let run = 0; run < 200; run++) {
      const lines = Array.from({ length: 1 + Math.floor(rand() * 5) }, () => ({
        description: 'Item', quantity: pick(rand, 0, 50, 0.25), unitPrice: pick(rand, 0, 500, 0.01),
      }));
      const taxMode = ['none', 'exclusive', 'inclusive'][Math.floor(rand() * 3)];
      const q = F.quoteTotals({ lines, discountPct: pick(rand, 0, 100, 0.5), taxMode, taxRate: pick(rand, 0, 25, 0.5) });
      for (const key of ['subtotalCents', 'discountCents', 'exTaxCents', 'gstCents', 'totalCents']) {
        assert.ok(Number.isSafeInteger(q[key]), `seed ${seed} run ${run}: ${key} is not whole cents`);
      }
      assert.ok(q.discountCents >= 0 && q.discountCents <= q.subtotalCents, `seed ${seed} run ${run}: discount out of range`);
      assert.ok(q.totalCents >= 0, `seed ${seed} run ${run}: negative total`);
      if (taxMode === 'none') assert.equal(q.gstCents, 0);
      if (taxMode === 'exclusive') assert.equal(q.totalCents, q.exTaxCents + q.gstCents, `seed ${seed} run ${run}: exclusive does not add up`);
      if (taxMode === 'inclusive') assert.equal(q.totalCents, q.exTaxCents + q.gstCents, `seed ${seed} run ${run}: inclusive does not add up`);
      if (taxMode !== 'none') {
        const after = q.subtotalCents - q.discountCents;
        const expected = taxMode === 'exclusive' ? after * q.taxRate / 100 : after * q.taxRate / (100 + q.taxRate);
        assert.ok(Math.abs(q.gstCents - expected) <= 0.5 + 1e-9, `seed ${seed} run ${run}: GST ${q.gstCents} vs ${expected}`);
      }
    }
  });

  test(`seed ${seed}: the same inputs always give the same quote and job cost`, () => {
    const rand = mulberry32(seed);
    const quoteInput = { lines: [{ description: 'A', quantity: 2.5, unitPrice: pick(rand, 0, 300, 0.01) }], discountPct: 7.5, taxMode: 'inclusive', taxRate: 10 };
    assert.deepEqual(F.quoteTotals(quoteInput), F.quoteTotals(JSON.parse(JSON.stringify(quoteInput))));
    const jobInput = { roles: [{ hours: pick(rand, 0, 40, 0.5), rate: pick(rand, 0, 120, 0.5) }], materials: pick(rand, 0, 900, 0.01), price: pick(rand, 0, 2000, 1), targetMarginPct: 30 };
    assert.deepEqual(F.jobCostSheet(jobInput), F.jobCostSheet(JSON.parse(JSON.stringify(jobInput))));
  });

  test(`seed ${seed}: job cost margin and totals reconcile`, () => {
    const rand = mulberry32(seed);
    for (let run = 0; run < 100; run++) {
      const input = {
        roles: [{ hours: pick(rand, 0, 30, 0.5), rate: pick(rand, 0, 90, 0.5) }],
        materials: pick(rand, 0, 800, 0.5), equipment: pick(rand, 0, 200, 1), km: pick(rand, 0, 300, 1), kmRate: pick(rand, 0, 1.2, 0.01),
        travel: pick(rand, 0, 100, 1), contingencyPct: pick(rand, 0, 20, 0.5), overhead: pick(rand, 0, 300, 1),
        price: pick(rand, 0, 2500, 1), targetMarginPct: pick(rand, 0, 80, 1),
      };
      const c = F.jobCostSheet(input);
      assert.ok(Math.abs(c.totalCost - (c.directCost + c.contingency + c.overhead)) < 1e-6, `seed ${seed} run ${run}: total does not reconcile`);
      assert.ok(Math.abs(c.margin - (input.price - c.totalCost)) < 1e-6, `seed ${seed} run ${run}: margin does not reconcile`);
      assert.ok(Number.isFinite(c.labour) && Number.isFinite(c.totalCost), `seed ${seed} run ${run}: non-finite output`);
    }
  });

  test(`seed ${seed}: admin value is hours x 52/12 x rate, and shares never exceed 100%`, () => {
    const rand = mulberry32(seed);
    for (let run = 0; run < 100; run++) {
      const hours = pick(rand, 0, 60, 0.5);
      const rate = pick(rand, 0, 150, 0.5);
      const cash = pick(rand, 0, 100, 1);
      const reinvest = pick(rand, 0, 100, 1);
      const reclaim = pick(rand, 0, 100, 1);
      let r;
      try { r = F.adminCost({ adminHours: hours, adminRate: rate, reclaimPct: reclaim, cashPct: cash, reinvestPct: reinvest }); }
      catch (error) {
        assert.ok(cash + reinvest > 100, `seed ${seed} run ${run}: refused a valid split`);
        assert.match(error.message, /cannot exceed 100%/);
        continue;
      }
      assert.ok(Math.abs(r.capacityValue - hours * 52 / 12 * rate) < 1e-6, `seed ${seed} run ${run}: admin value`);
      assert.ok(cash + reinvest <= 100, `seed ${seed} run ${run}: accepted an invalid split`);
    }
  });
}
