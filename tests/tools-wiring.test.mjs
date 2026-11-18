// Tests for wiring the shared engine into the live calculators (#42, #23, #43, #44).
// Pure Node checks: engine results, parity with the live formula module, and the wiring
// contract in assets/tools.js. Page behaviour is covered by scripts/tools-dom-smoke.cjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const E = require('../assets/tools-engine.js');
const C = require('../assets/tool-calcs.js');
const source = readFileSync(new URL('../assets/tools.js', import.meta.url), 'utf8');
// The engine rounds money to whole cents (half up), so a headline may differ from the unrounded live value by at most half a cent.
const HALF_CENT = 0.005 + 1e-9;

test('wiring: the live controller calls the engine for break-even, validation and profile migration', () => {
  assert.match(source, /const engine=globalThis\.TitanToolsEngine;/);
  assert.match(source, /if\(!data\|\|!engine\)return;/, 'pages without the engine must not run the controller');
  assert.match(source, /engine\.calculators\.breakeven\(/);
  assert.match(source, /engine\.validate\(active,Object\.fromEntries\(new FormData\(form\)\.entries\(\)\)\)/);
  assert.match(source, /engine\.migrateProfile\(/);
  assert.match(source, /schema:engine\.PROFILE_VERSION/);
  assert.match(source, /removeItem\(engine\.LEGACY_PROFILE_KEY\)/);
  assert.doesNotMatch(source, /Math\.ceil\(v\.fixed\/contribution\)/, 'the float-based break-even formula is gone');
});

test('break-even (#23): one cent of contribution on A$1 fixed costs is 10 jobs, not 11', () => {
  // Main's float maths gave Math.ceil(1 / 0.0999999...) = 11. Exact cents give 10.
  assert.equal(Math.ceil(1 / (100.1 - 100)), 11, 'the old live formula gave 11');
  assert.equal(E.calculators.breakeven({ fixed: 1, price: 100.1, variable: 100 }).metric, 10);
});

test('hire (changed output): A$81,250.50 salary with 16% on-cost is A$7,854.22 a month, rounded half up', () => {
  // Exact value is 81250.5 x 1.16 / 12 = 7854.215. Main's float rounding showed A$7,854.21.
  const engineValue = E.calculators.hire({ salary: 81250.5, oncost: 16, margin: 133.33 }).metric;
  assert.equal(engineValue, 7854.22);
  const liveValue = C.hiringCost({ salary: 81250.5, oncost: 16, margin: 133.33 }).monthlyCost;
  assert.ok(Math.abs(liveValue - engineValue) <= HALF_CENT, 'differs from main only by the sub-cent rounding');
});

test('parity: engine headline values match the live formula module on a fixture grid', () => {
  const grid = [
    { adminHours: 0, adminRate: 0 },
    { adminHours: 10, adminRate: 45 },
    { adminHours: 7.5, adminRate: 52.35 },
    { adminHours: 168, adminRate: 120.5 },
  ];
  for (const v of grid) {
    const live = C.adminCost({ ...v, reclaimPct: 25 }).metric;
    assert.ok(Math.abs(E.calculators.admin(v).metric - live) <= HALF_CENT, JSON.stringify(v));
  }
  const calls = [
    { calls: 120, missed: 12, convert: 30, jobValue: 350 },
    { calls: 77, missed: 13.5, convert: 41.25, jobValue: 289.99 },
    { calls: 0, missed: 0, convert: 0, jobValue: 0 },
  ];
  for (const v of calls) {
    const live = C.missedEnquiry(v).opportunity;
    assert.ok(Math.abs(E.calculators.calls(v).metric - live) <= HALF_CENT, JSON.stringify(v));
  }
  const hires = [
    { salary: 65000, oncost: 18, margin: 180 },
    { salary: 62000, oncost: 20, margin: 95 },
    { salary: 0, oncost: 0, margin: 0 },
  ];
  for (const v of hires) {
    const live = C.hiringCost(v).monthlyCost;
    assert.ok(Math.abs(E.calculators.hire(v).metric - live) <= HALF_CENT, JSON.stringify(v));
  }
});

test('capacity: whole-job count is unchanged on the default fixture', () => {
  const v = { workers: 4, hours: 30, duration: 2.5, currentJobs: 150, daysPerWeek: 5, leaveDays: 0, nonbillPct: 0, travelMin: 0, cancelPct: 0 };
  assert.equal(C.capacityPlanner(v).bookableJobs, E.calculators.capacity({ workers: 4, hours: 30, duration: 2.5, currentJobs: 150 }).metric);
});

test('validation (#42): the six calculators with matching fields refuse invalid input before a result', () => {
  const bad = [
    ['admin', { adminHours: 169, adminRate: 45 }],
    ['hire', { salary: 65000, oncost: 101, margin: 180 }],
    ['breakeven', { fixed: 12000, price: 450.005, variable: 180 }],
    ['profit', { jobRevenue: 650, labour: -1, materials: 110, travel: 45 }],
    ['capacity', { workers: 4, hours: 30, duration: 0.05, currentJobs: 150 }],
    ['calls', { calls: 120, missed: 120, convert: 30, jobValue: 350 }],
  ];
  for (const [tool, input] of bad) {
    assert.equal(E.validate(tool, input).ok, false, tool + ' ' + JSON.stringify(input));
  }
});

test('leads and invoice (#105): engine rules describe the live funnel and ageing fields, and the controller applies them', () => {
  const leadKeys = ['leads', 'value', 'contribPct', 'base_contacted', 'base_qualified', 'base_booked', 'base_completed',
    'alt_contacted', 'alt_qualified', 'alt_booked', 'alt_completed'];
  const invoiceKeys = ['invoices', 'avg', 'age_d0_30', 'age_d31_60', 'age_d61_90', 'age_d90',
    'collect_d0_30', 'collect_d31_60', 'collect_d61_90', 'collect_d90', 'chase'];
  assert.deepEqual(Object.keys(E.RULES.leads), leadKeys);
  assert.deepEqual(Object.keys(E.RULES.invoice), invoiceKeys);
  for (const key of [...leadKeys, ...invoiceKeys]) {
    assert.match(source, new RegExp("\\['" + key + "',"), key + ' must be a live form field');
  }
  assert.match(source, /Object\.keys\(rules\)\.every\(key=>key in values\)/);
  assert.match(source, /engine\.validate\(active,Object\.fromEntries\(new FormData\(form\)\.entries\(\)\)\)/, 'blanks are validated as raw strings');
});

test('leads and invoice (#105): engine headline values match the live funnel and ageing calculators', () => {
  const leadInput = { leads: 100, value: 450, contribPct: 100, base_contacted: 90, base_qualified: 50, base_booked: 60, base_completed: 80,
    alt_contacted: 92, alt_qualified: 50, alt_booked: 62, alt_completed: 80 };
  const invoiceInput = { invoices: 80, avg: 520, age_d0_30: 0, age_d31_60: 10, age_d61_90: 5, age_d90: 3,
    collect_d0_30: 95, collect_d31_60: 80, collect_d61_90: 50, collect_d90: 20, chase: 7 };
  assert.ok(Math.abs(E.calculators.leads(leadInput).metric - C.leadConversion(leadInput).revenueDelta) <= HALF_CENT);
  assert.ok(Math.abs(E.calculators.invoice(invoiceInput).metric - C.invoiceCollection(invoiceInput).beyondTerms) <= HALF_CENT);
});

test('profile migration (#43): every assumption a live tool persists survives V2 to V3', () => {
  const v2 = {
    verticals: ['cleaning'], activeVertical: 'cleaning', businessName: 'Acme',
    adminHours: 12, reclaimPct: 30, cashPct: 10, reinvestPct: 5, superPct: 11, leavePct: 2,
    base_contacted: 90, alt_completed: 85, age_d31_60: 10, collect_d90: 20, chase: 7,
    taxRate: 10, discountPct: 4, targetMarginPct: 30, daysPerWeek: 5, cancelPct: 3, reachPct: 20,
    evil: 'x', ghost: 1,
  };
  const r = E.migrateProfile({ v2, industryIds: ['cleaning'] });
  assert.equal(r.migratedFromV2, true);
  const kept = r.profile.assumptions.cleaning;
  for (const key of ['adminHours', 'reclaimPct', 'cashPct', 'reinvestPct', 'superPct', 'leavePct', 'base_contacted', 'alt_completed',
    'age_d31_60', 'collect_d90', 'chase', 'taxRate', 'discountPct', 'targetMarginPct', 'daysPerWeek', 'cancelPct', 'reachPct']) {
    assert.equal(kept[key] !== undefined, true, key + ' should survive migration');
  }
  assert.equal('evil' in kept, false);
  assert.equal('ghost' in kept, false);
});

test('profile migration (#43): a saved V3 profile keeps its values and schema when read again', () => {
  const first = E.migrateProfile({ v2: { verticals: ['cleaning'], activeVertical: 'cleaning', reclaimPct: 30 }, industryIds: ['cleaning'] }).profile;
  const saved = JSON.parse(JSON.stringify({ schema: E.PROFILE_VERSION, ...first }));
  const again = E.migrateProfile({ v3: saved, v2: null, industryIds: ['cleaning'] });
  assert.equal(again.migratedFromV2, false);
  assert.equal(again.profile.assumptions.cleaning.reclaimPct, 30);
});

test('profile keys stay versioned: V3 key and the legacy V2 key the controller removes', () => {
  assert.equal(E.PROFILE_KEY, 'titanBusinessToolProfileV3');
  assert.equal(E.LEGACY_PROFILE_KEY, 'titanBusinessToolProfileV2');
  assert.match(source, /const storageKey='titanBusinessToolProfileV3';/);
});
