// Deterministic fixtures for the shared calculator engine (#42, #43, #46).
// Covers the 11 public calculator tools in the repository, money precision,
// input validation, GST, and the V2 to V3 local profile migration.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const E = require('../assets/tools-engine.js');
const repoFile = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('admin cost: 10 hrs/week at A$45/hr uses 52 / 12 weeks', () => {
  const r = E.calculators.admin({ adminHours: 10, adminRate: 45 });
  assert.equal(r.metric, 1950);
  assert.equal(r.format, 'currency');
});

test('should I hire: salary with on-cost and job count rounds up', () => {
  const r = E.calculators.hire({ salary: 65000, oncost: 18, margin: 180 });
  assert.equal(r.metric, 6391.67);
  assert.match(r.notes[0], /about 36 additional jobs/);
});

test('should I hire: zero contribution gives no job count', () => {
  const r = E.calculators.hire({ salary: 65000, oncost: 18, margin: 0 });
  assert.match(r.notes[0], /Enter a positive contribution/);
});

test('break-even: default assumptions give 45 jobs', () => {
  const r = E.calculators.breakeven({ fixed: 12000, price: 450, variable: 180 });
  assert.equal(r.metric, 45);
});

test('job profitability: contribution and margin before overhead', () => {
  const r = E.calculators.profit({ jobRevenue: 650, labour: 220, materials: 110, travel: 45 });
  assert.equal(r.metric, 275);
  assert.equal(r.notes[0], 'Contribution margin: 42.3%.');
});

test('job profitability: zero revenue does not divide by zero', () => {
  const r = E.calculators.profit({ jobRevenue: 0, labour: 0, materials: 0, travel: 0 });
  assert.equal(r.metric, 0);
  assert.match(r.notes[0], /above zero/);
});

test('capacity: 4 workers x 30 hrs x 52 / 12 / 2.5 hrs per job', () => {
  const r = E.calculators.capacity({ workers: 4, hours: 30, duration: 2.5, currentJobs: 150 });
  assert.equal(r.metric, 208);
  assert.equal(r.notes[0], 'Approximate spare capacity: 58 jobs/month.');
});

test('capacity: whole job is not lost to binary floating point', () => {
  // 3 x 40 x 52 / 12 / 0.1 is 5,200 exactly in real arithmetic.
  const r = E.calculators.capacity({ workers: 3, hours: 40, duration: 0.1, currentJobs: 0 });
  assert.equal(r.metric, 5200);
});

test('missed calls: 120 enquiries, 12% missed, 30% converted, A$350', () => {
  const r = E.calculators.calls({ calls: 120, missed: 12, convert: 30, jobValue: 350 });
  assert.equal(r.metric, 1512);
  assert.match(r.notes[0], /14\.4 enquiries/);
});

// Live funnel (#105): the lead-to-completed rate is the product of four stage shares.
// Stages 100/100/100/20 give 20%; 100/100/100/23 give 23%.
const stages = (completed) => ({ base_contacted: 100, base_qualified: 100, base_booked: 100, base_completed: completed,
  alt_contacted: 100, alt_qualified: 100, alt_booked: 100, alt_completed: completed });

test('lead conversion: 100 leads moving from 20% to 23% at A$450', () => {
  const r = E.calculators.leads({ leads: 100, value: 450, ...stages(20), alt_completed: 23 });
  assert.equal(r.metric, 1350);
});

test('lead conversion: a lower scenario shows a negative difference with a true minus sign', () => {
  const r = E.calculators.leads({ leads: 100, value: 450, ...stages(25), alt_completed: 20 });
  assert.equal(r.metric, -2250);
  assert.equal(E.formatMoney(r.metric), '−A$2,250.00');
});

test('invoice collection: 80 invoices x A$520 with 18% beyond terms', () => {
  const r = E.calculators.invoice({ invoices: 80, avg: 520, age_d0_30: 0, age_d31_60: 10, age_d61_90: 5, age_d90: 3, chase: 7 });
  assert.equal(r.metric, 7488);
  assert.equal(r.notes[0], 'Monthly invoicing represented: A$41,600.00.');
});

test('quote builder: fractional quantity, discount and GST are rounded to cents', () => {
  const checked = E.validateLines([{ quantity: 2.5, unit: 45.1 }, { quantity: 1, unit: 100 }]);
  assert.equal(checked.ok, true);
  const q = E.quote({ lines: checked.lines, discountPercent: 10, includeGst: true });
  assert.equal(q.subtotal, 212.75);
  assert.equal(q.discount, -21.28);
  assert.equal(q.gst, 19.15);
  assert.equal(q.total, 210.62);
});

test('quote builder: zero discount and GST off leave the subtotal as the total', () => {
  const q = E.quote({ lines: [{ quantity: 3, unit: 0.1 }], discountPercent: 0, includeGst: false });
  assert.equal(q.total, 0.3);
});

test('GST inclusive totals split into ex-GST and GST amounts', () => {
  assert.deepEqual(E.splitGstInclusive(110), { net: 100, gst: 10, total: 110 });
  assert.deepEqual(E.splitGstInclusive(33), { net: 30, gst: 3, total: 33 });
});

test('job cost sheet: labour, overhead, negative contribution and target price', () => {
  const v = E.validate('jobcost', {
    workers: 2, hours: 8, rate: 60, materials: 150, travel: 30, other: 20, overhead: 100, price: 900, target: 40,
  });
  assert.equal(v.ok, true);
  const c = E.jobCost(v.values);
  assert.equal(c.labour, 960);
  assert.equal(c.direct, 1160);
  assert.equal(c.total, 1260);
  assert.equal(c.contribution, -360);
  assert.equal(c.marginPercent, -40);
  assert.equal(c.targetPrice, 2100);
});

test('all 11 public calculator tools have validation rules or a calculator', () => {
  const tools = ['admin', 'hire', 'breakeven', 'profit', 'capacity', 'calls', 'leads', 'invoice', 'jobcost'];
  for (const key of tools) assert.ok(E.RULES[key], key + ' rules');
  for (const key of ['admin', 'hire', 'breakeven', 'profit', 'capacity', 'calls', 'leads', 'invoice']) {
    assert.equal(typeof E.calculators[key], 'function', key + ' calculator');
  }
  assert.equal(typeof E.quote, 'function');
  assert.equal(typeof E.jobCost, 'function');
  const pages = ['admin-cost', 'should-i-hire', 'break-even', 'job-profitability', 'capacity-planner', 'missed-calls',
    'lead-conversion', 'invoice-collection', 'quote-builder', 'job-cost-sheet', 'checklist-generator'];
  assert.equal(pages.length, 11);
  for (const slug of pages) assert.ok(repoFile('pages/tool-' + slug + '.html').includes('tools.js'), slug);
});

test('validation rejects blanks, NaN, infinity, negatives, out-of-range and over-precise money', () => {
  const bad = [
    { adminHours: '', adminRate: 45 },
    { adminHours: 'NaN', adminRate: 45 },
    { adminHours: 'Infinity', adminRate: 45 },
    { adminHours: -1, adminRate: 45 },
    { adminHours: 169, adminRate: 45 },
    { adminHours: 10, adminRate: 1.005 },
    { adminHours: 10, adminRate: 1e10 },
  ];
  for (const input of bad) {
    const r = E.validate('admin', input);
    assert.equal(r.ok, false, JSON.stringify(input));
    assert.ok(r.errors.every((e) => e.message.length > 0));
  }
  const ok = E.validate('admin', { adminHours: '10', adminRate: '45.50' });
  assert.deepEqual(ok, { ok: true, values: { adminHours: 10, adminRate: 45.5 } });
});

test('validation of quote lines and discount bounds', () => {
  assert.equal(E.validateLines([{ quantity: 10001, unit: 1 }]).ok, false);
  assert.equal(E.validateLines([{ quantity: 1, unit: 1.005 }]).ok, false);
  assert.equal(E.validateLines([{ quantity: -1, unit: 1 }]).ok, false);
  assert.equal(E.validateLines([{ quantity: 1, unit: 'x' }]).ok, false);
});

test('very large amounts that cannot be exact are refused rather than rounded', () => {
  assert.throws(() => E.quote({
    lines: Array.from({ length: 10 }, () => ({ quantity: 10000, unit: 1e9 })),
  }), RangeError);
});

test('money formatting: en-AU grouping, two decimals, true minus sign', () => {
  assert.equal(E.formatMoney(1234567.5), 'A$1,234,567.50');
  assert.equal(E.formatMoney(-0.5), '−A$0.50');
  assert.equal(E.formatMoney(NaN), 'Not available');
});

test('cents conversion rounds half up and avoids binary artefacts', () => {
  assert.equal(E.toCents(1.005), 101);
  assert.equal(E.toCents(0.1 + 0.2), 30);
  assert.throws(() => E.toCents(Infinity), RangeError);
});

test('profile migration: V2 flat assumptions move under the active vertical only', () => {
  const r = E.migrateProfile({
    v2: { verticals: ['cleaning', 'hvac'], activeVertical: 'hvac', businessName: 'Acme', serviceName: 'Service', price: 420, evil: 'x', fixed: 'NaN' },
    industryIds: ['cleaning', 'hvac', 'plumbing'],
  });
  assert.equal(r.migratedFromV2, true);
  assert.equal(r.profile.schema, 3);
  assert.equal(r.profile.activeVertical, 'hvac');
  assert.deepEqual(r.profile.verticals, ['cleaning', 'hvac']);
  assert.deepEqual(r.profile.assumptions, { hvac: { price: 420 } });
});

test('profile migration: V3 saved before a schema field existed is still read', () => {
  const r = E.migrateProfile({
    v3: { verticals: ['cleaning'], activeVertical: 'cleaning', businessName: 'B', assumptions: { cleaning: { price: 300, adminRate: '9e99' } } },
    industryIds: ['cleaning'],
  });
  assert.equal(r.migratedFromV2, false);
  assert.deepEqual(r.profile.assumptions, { cleaning: { price: 300 } });
});

test('profile migration: unknown verticals, long or control-character text and malformed storage are dropped', () => {
  const r = E.migrateProfile({
    v3: { schema: 3, verticals: ['nope', 'cleaning', 'cleaning'], activeVertical: 'nope', businessName: 'A\u0000B' + 'x'.repeat(300), assumptions: { ghost: { price: 1 } } },
    industryIds: ['cleaning'],
  });
  assert.deepEqual(r.profile.verticals, ['cleaning']);
  assert.equal(r.profile.activeVertical, 'cleaning');
  assert.equal(r.profile.businessName.length, 120);
  assert.equal(r.profile.businessName.includes('\u0000'), false);
  assert.deepEqual(r.profile.assumptions, {});
  const malformed = E.migrateProfile({ v3: 'text', v2: [1, 2], industryIds: ['cleaning'] });
  assert.deepEqual(malformed.profile.verticals, ['cleaning']);
  assert.equal(malformed.migratedFromV2, false);
});

// #105: every funnel stage and ageing bucket refuses blanks, NaN, infinity, negatives and out-of-range values.
const LIVE_PERCENT_KEYS = {
  leads: ['contribPct', 'base_contacted', 'base_qualified', 'base_booked', 'base_completed',
    'alt_contacted', 'alt_qualified', 'alt_booked', 'alt_completed'],
  invoice: ['age_d0_30', 'age_d31_60', 'age_d61_90', 'age_d90', 'collect_d0_30', 'collect_d31_60', 'collect_d61_90', 'collect_d90'],
};
const LIVE_DEFAULTS = {
  leads: { leads: '100', value: '450', contribPct: '100', base_contacted: '90', base_qualified: '50', base_booked: '60',
    base_completed: '80', alt_contacted: '92', alt_qualified: '50', alt_booked: '62', alt_completed: '80' },
  invoice: { invoices: '80', avg: '520', age_d0_30: '0', age_d31_60: '10', age_d61_90: '5', age_d90: '3',
    collect_d0_30: '95', collect_d31_60: '80', collect_d61_90: '50', collect_d90: '20', chase: '7' },
};

test('live funnel and ageing fields (#105) reject blanks, NaN, infinity, negatives and out-of-range values', () => {
  for (const [tool, keys] of Object.entries(LIVE_PERCENT_KEYS)) {
    for (const key of keys) {
      for (const bad of ['', '   ', 'NaN', 'Infinity', '-1', '100.5', '101']) {
        const input = { ...LIVE_DEFAULTS[tool], [key]: bad };
        const checked = E.validate(tool, input);
        assert.equal(checked.ok, false, tool + '.' + key + ' must refuse ' + JSON.stringify(bad));
        assert.ok(checked.errors.some((error) => error.key === key), tool + '.' + key + ' error names the field');
      }
    }
  }
  for (const bad of ['', 'NaN', 'Infinity', '-5', '1000001']) {
    assert.equal(E.validate('leads', { ...LIVE_DEFAULTS.leads, leads: bad }).ok, false, 'leads count ' + bad);
  }
  for (const bad of ['', 'NaN', '-0.01', '1000000000.01']) {
    assert.equal(E.validate('invoice', { ...LIVE_DEFAULTS.invoice, avg: bad }).ok, false, 'invoice average ' + bad);
  }
});

test('live funnel and ageing defaults (#105) still validate, and boundary values 0 and 100 are accepted', () => {
  assert.equal(E.validate('leads', LIVE_DEFAULTS.leads).ok, true);
  assert.equal(E.validate('invoice', LIVE_DEFAULTS.invoice).ok, true);
  assert.equal(E.validate('leads', { ...LIVE_DEFAULTS.leads, alt_booked: '0', base_completed: '100' }).ok, true);
  assert.equal(E.validate('invoice', { ...LIVE_DEFAULTS.invoice, age_d90: '100' }).ok, true);
});

test('engine and tools page code make no network or beacon calls with calculation data', () => {
  for (const path of ['assets/tools-engine.js', 'assets/tools.js']) {
    const text = repoFile(path);
    assert.doesNotMatch(text, /\bfetch\s*\(/, path);
    assert.doesNotMatch(text, /XMLHttpRequest|sendBeacon|WebSocket|new Image\(/, path);
  }
});
