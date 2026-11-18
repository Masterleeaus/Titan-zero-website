// Redacted export and versioned, all-or-nothing import for portable tool assumptions (#43, #44).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const E = require('../assets/tools-engine.js');
const IDS = ['cleaning', 'plumbing', 'hvac'];
const profile = {
  schema: 3,
  verticals: ['cleaning', 'plumbing'],
  activeVertical: 'cleaning',
  businessName: 'Example Pty Ltd',
  serviceName: 'Sample service',
  assumptions: {
    cleaning: { adminHours: 12, adminRate: 50, reclaimPct: 20, missed: 10 },
    plumbing: { jobHours: 3, taxRate: 10 },
  },
};
const goodFile = () => ({ format: E.PORTABLE_FORMAT, formatVersion: 1, vertical: 'cleaning', assumptions: { adminHours: 12, adminRate: 50, reclaimPct: 20 } });

test('export: carries only numeric assumptions for one service type', () => {
  const out = E.exportAssumptions(profile, 'cleaning', IDS);
  assert.deepEqual(out, { format: E.PORTABLE_FORMAT, formatVersion: 1, vertical: 'cleaning', assumptions: { adminHours: 12, adminRate: 50, missed: 10, reclaimPct: 20 } });
  assert.equal(Object.keys(out).join(','), 'format,formatVersion,vertical,assumptions');
});

test('export: never includes business name, service name, other service types or the vertical list', () => {
  const text = JSON.stringify(E.exportAssumptions(profile, 'cleaning', IDS));
  for (const secret of ['Example Pty Ltd', 'Sample service', 'plumbing', 'jobHours', 'verticals', 'businessName', 'serviceName']) {
    assert.equal(text.includes(secret), false, 'export leaked ' + secret);
  }
});

test('export: unknown service type is refused, and a vertical with no saved values exports an empty set', () => {
  assert.throws(() => E.exportAssumptions(profile, 'roofing', IDS), RangeError);
  assert.deepEqual(E.exportAssumptions(profile, 'hvac', IDS).assumptions, {});
});

test('round trip: export, import and apply restores the values for that service type only', () => {
  const text = JSON.stringify(E.exportAssumptions(profile, 'cleaning', IDS));
  const checked = E.validateImport(text, IDS);
  assert.equal(checked.ok, true, JSON.stringify(checked.errors));
  const target = { schema: 3, verticals: ['hvac'], activeVertical: 'hvac', businessName: 'Other', serviceName: '', assumptions: { hvac: { jobHours: 2 } } };
  const { profile: next, applied } = E.applyImport(target, checked);
  assert.deepEqual(next.assumptions.cleaning, { adminHours: 12, adminRate: 50, missed: 10, reclaimPct: 20 });
  assert.deepEqual(next.assumptions.hvac, { jobHours: 2 }, 'other service types are untouched');
  assert.equal(next.businessName, 'Other', 'business name is never changed by an import');
  assert.equal(applied.length, 4);
  assert.deepEqual(applied.find((item) => item.key === 'adminRate'), { key: 'adminRate', value: 50 });
});

test('apply: does not mutate the profile it was given', () => {
  const before = JSON.stringify(profile);
  E.applyImport(profile, E.validateImport(goodFile(), IDS));
  assert.equal(JSON.stringify(profile), before);
});

test('import: accepts a parsed object and a JSON string equally', () => {
  assert.equal(E.validateImport(goodFile(), IDS).ok, true);
  assert.equal(E.validateImport(JSON.stringify(goodFile()), IDS).ok, true);
});

test('import: rejects wrong format, stale and newer versions, and a missing version', () => {
  assert.equal(E.validateImport({ ...goodFile(), format: 'other' }, IDS).ok, false);
  const stale = E.validateImport({ ...goodFile(), formatVersion: 0 }, IDS);
  assert.equal(stale.ok, false);
  assert.match(stale.errors[0].message, /older version/);
  const newer = E.validateImport({ ...goodFile(), formatVersion: 2 }, IDS);
  assert.match(newer.errors[0].message, /newer version/);
  const { formatVersion, ...noVersion } = goodFile();
  assert.equal(E.validateImport(noVersion, IDS).ok, false);
});

test('import: rejects an unknown or missing service type', () => {
  assert.equal(E.validateImport({ ...goodFile(), vertical: 'roofing' }, IDS).ok, false);
  const { vertical, ...noVertical } = goodFile();
  assert.equal(E.validateImport(noVertical, IDS).ok, false);
});

test('import: rejects business, customer, staff and quote fields at the top level and inside assumptions', () => {
  const top = E.validateImport({ ...goodFile(), businessName: 'Example Pty Ltd' }, IDS);
  assert.equal(top.ok, false);
  assert.match(top.errors.map((e) => e.message).join(' '), /business or customer details/);
  const nested = E.validateImport({ ...goodFile(), assumptions: { adminHours: 1, customerName: 'Pat' } }, IDS);
  assert.equal(nested.ok, false);
  assert.match(nested.errors.map((e) => e.message).join(' '), /business or customer details/);
  assert.equal(E.validateImport({ ...goodFile(), staffNotes: 'x' }, IDS).ok, false);
});

test('import: rejects unknown assumption keys instead of dropping them silently', () => {
  const result = E.validateImport({ ...goodFile(), assumptions: { adminHours: 12, invented: 5 } }, IDS);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].key, 'assumptions.invented');
});

test('import: rejects text, NaN, infinity, negatives, over-maximum and over-100 percentages', () => {
  const bad = [
    { adminHours: '12' }, { adminHours: NaN }, { adminHours: Infinity }, { adminHours: -1 },
    { adminHours: E.MAX_AMOUNT + 1 }, { reclaimPct: 120 }, { adminHours: null }, { adminHours: [1] },
  ];
  for (const assumptions of bad) {
    const result = E.validateImport({ ...goodFile(), assumptions }, IDS);
    assert.equal(result.ok, false, JSON.stringify(assumptions));
  }
});

test('import: a single bad value rejects the whole file (no partial application)', () => {
  const result = E.validateImport({ ...goodFile(), assumptions: { adminHours: 12, reclaimPct: 150 } }, IDS);
  assert.equal(result.ok, false);
  assert.throws(() => E.applyImport(profile, result), TypeError);
});

test('import: rejects non-object input, invalid JSON, oversized text and too many keys', () => {
  assert.equal(E.validateImport('not json', IDS).ok, false);
  assert.equal(E.validateImport('[]', IDS).ok, false);
  assert.equal(E.validateImport(null, IDS).ok, false);
  assert.equal(E.validateImport(['x'], IDS).ok, false);
  assert.match(E.validateImport('x'.repeat(E.PORTABLE_MAX_CHARS + 1), IDS).errors[0].message, /too large/);
  const many = {};
  for (const key of E.ASSUMPTION_KEY_LIST) many[key] = 1;
  const oversize = E.validateImport({ ...goodFile(), assumptions: { ...many, extra1: 1 } }, IDS);
  assert.equal(oversize.ok, false);
});

test('schema guard: no importable assumption key names a person, business, quote or contact field', () => {
  const sensitive = /name|customer|client|staff|employee|quote|email|phone|address|business|service$/i;
  assert.equal(E.ASSUMPTION_KEY_LIST.some((key) => sensitive.test(key)), false, E.ASSUMPTION_KEY_LIST.filter((key) => sensitive.test(key)).join(','));
  assert.equal(E.ASSUMPTION_KEY_LIST.includes('adminHours'), true);
});
