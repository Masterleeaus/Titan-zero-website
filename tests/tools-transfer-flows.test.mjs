// Explicit, user-chosen transfer flows between calculator tools (#44).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const E = require('../assets/tools-engine.js');
const IDS = ['cleaning', 'plumbing'];
const FLOWS = ['job-cost-to-quote', 'bookings-to-capacity', 'receivables-to-cash-flow', 'leads-to-follow-up'];
const file = (assumptions, vertical = 'cleaning') => E.validateImport(
  { format: E.PORTABLE_FORMAT, formatVersion: 1, vertical, assumptions }, IDS);
const profile = () => ({
  schema: 3, verticals: ['cleaning', 'plumbing'], activeVertical: 'cleaning', businessName: 'Example', serviceName: '',
  assumptions: { cleaning: { adminHours: 12, taxRate: 10 }, plumbing: { taxRate: 15, overhead: 40 } },
});

test('flows: the four named handoffs exist with a source, a target and a key list', () => {
  assert.deepEqual(Object.keys(E.TRANSFER_FLOWS).sort(), [...FLOWS].sort());
  for (const id of FLOWS) {
    const flow = E.TRANSFER_FLOWS[id];
    assert.ok(flow.label && flow.from && flow.to, id);
    assert.ok(flow.keys.length > 0, id);
  }
});

test('flows: every key is a known assumption and none names a person, business, quote or contact', () => {
  const sensitive = /name|customer|client|staff|employee|quote|email|phone|address|business|service$/i;
  for (const flow of Object.values(E.TRANSFER_FLOWS)) {
    for (const key of flow.keys) {
      assert.ok(E.ASSUMPTION_KEY_LIST.includes(key), key + ' is not a known assumption');
      assert.equal(sensitive.test(key), false, key);
    }
  }
});

test('flows: the contracts cannot be changed at run time', () => {
  assert.equal(Object.isFrozen(E.TRANSFER_FLOWS), true);
  assert.equal(Object.isFrozen(E.TRANSFER_FLOWS['job-cost-to-quote'].keys), true);
});

test('plan: a checked file for the same service type plans only the flow keys and lists the missing ones', () => {
  const plan = E.planTransfer('job-cost-to-quote', file({ overhead: 40, taxRate: 10, adminHours: 9 }), 'cleaning');
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.applied, [{ key: 'overhead', value: 40 }, { key: 'taxRate', value: 10 }]);
  assert.deepEqual(plan.missing, ['discountPct', 'targetMarginPct']);
  assert.equal(plan.applied.some((item) => item.key === 'adminHours'), false, 'keys outside the flow are never planned');
});

test('plan: refuses an unknown flow, an unchecked file, a different service type and prototype names', () => {
  assert.equal(E.planTransfer('nope', file({ overhead: 1 }), 'cleaning').ok, false);
  assert.equal(E.planTransfer('constructor', file({ overhead: 1 }), 'cleaning').ok, false);
  assert.equal(E.planTransfer('job-cost-to-quote', { format: 'raw', assumptions: { overhead: 1 } }, 'cleaning').ok, false);
  assert.equal(E.planTransfer('job-cost-to-quote', null, 'cleaning').ok, false);
  const other = E.planTransfer('job-cost-to-quote', file({ overhead: 1 }, 'plumbing'), 'cleaning');
  assert.equal(other.ok, false);
  assert.match(other.errors[0].message, /different service type/);
});

test('apply: writes only the planned keys to the target service type and leaves everything else alone', () => {
  const before = profile();
  const plan = E.planTransfer('job-cost-to-quote', file({ overhead: 40, taxRate: 10 }), 'cleaning');
  const { profile: next, applied } = E.applyTransfer(before, plan);
  assert.deepEqual(next.assumptions.cleaning, { adminHours: 12, taxRate: 10, overhead: 40 });
  assert.deepEqual(next.assumptions.plumbing, { taxRate: 15, overhead: 40 }, 'other service types are untouched');
  assert.equal(next.businessName, 'Example', 'business name is never changed');
  assert.equal(applied.length, 2, 'the applied values are returned for display');
  assert.deepEqual(before, profile(), 'the input profile is not mutated');
});

test('apply: refuses a plan that was not ok, so nothing is applied partially', () => {
  const bad = E.planTransfer('job-cost-to-quote', file({ overhead: 1 }, 'plumbing'), 'cleaning');
  assert.throws(() => E.applyTransfer(profile(), bad), TypeError);
  assert.throws(() => E.applyTransfer(profile(), { ok: true, vertical: 'cleaning', applied: undefined }), TypeError);
});

test('flows: a receivables transfer carries the ageing and collection shares used by cash flow', () => {
  const plan = E.planTransfer('receivables-to-cash-flow', file({ age_d31_60: 10, collect_d31_60: 80 }), 'cleaning');
  assert.deepEqual(plan.applied.map((item) => item.key).sort(), ['age_d31_60', 'collect_d31_60']);
  assert.equal(plan.missing.length, 6);
});
