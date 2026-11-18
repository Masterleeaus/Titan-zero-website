// Handoff and assumptions-file privacy (#106). Source and engine checks: no business, service,
// customer, staff or quote text may reach a handoff, an export or a URL. Page behaviour is covered
// by the handoff steps in scripts/tools-dom-smoke.cjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const E = require('../assets/tools-engine.js');
const source = readFileSync(new URL('../assets/tools.js', import.meta.url), 'utf8');
const IDS = ['cleaning'];
const SECRET = {
  businessName: 'PRIVATE-BUSINESS',
  serviceName: 'PRIVATE-SERVICE',
  customer: 'PRIVATE-CUSTOMER',
  staff: 'PRIVATE-STAFF',
  quote: 'PRIVATE-QUOTE-TEXT',
};

test('job-cost handoff to the quote builder sends a fixed line label, never the service or business name (#106)', () => {
  assert.match(source, /quoteTransferRecord\(c,'Service from job-cost sheet'/);
  assert.doesNotMatch(source, /quoteTransferRecord\(c,f\('service'\)/, 'the service field must not be sent');
  assert.doesNotMatch(source, /quoteTransferRecord\([^)]*business/i, 'the business name must not be sent');
});

test('the transfer record holds only a fixed label, a quantity and a unit price (#106)', () => {
  const cost = E.formulas.jobCostSheet({ roles: [{ hours: 2, rate: 45 }], price: 300 });
  const record = E.formulas.quoteTransferRecord(cost, 'Service from job-cost sheet', '2026-11-18T00:00:00Z');
  const text = JSON.stringify(record);
  for (const value of Object.values(SECRET)) assert.equal(text.includes(value), false, value);
  assert.deepEqual(Object.keys(record.line).sort(), ['description', 'quantity', 'unitPrice']);
});

test('assumptions export carries numbers for the active service type only (#106)', () => {
  const profile = {
    schema: 3, verticals: ['cleaning'], activeVertical: 'cleaning',
    businessName: SECRET.businessName, serviceName: SECRET.serviceName,
    assumptions: { cleaning: { adminHours: 12, reclaimPct: 30, evil: 1 } },
  };
  const doc = E.exportAssumptions(profile, 'cleaning', IDS);
  const text = JSON.stringify(doc);
  for (const value of Object.values(SECRET)) assert.equal(text.includes(value), false, value);
  assert.deepEqual(doc.assumptions, { adminHours: 12, reclaimPct: 30 });
});

test('an import with business or customer fields is refused as a whole and does not echo the value (#106)', () => {
  const doc = {
    format: E.PORTABLE_FORMAT, formatVersion: E.PORTABLE_VERSION, vertical: 'cleaning',
    assumptions: { adminHours: 12 }, customerName: SECRET.customer,
  };
  const checked = E.validateImport(JSON.stringify(doc), IDS);
  assert.equal(checked.ok, false);
  assert.equal(JSON.stringify(checked).includes(SECRET.customer), false, 'refusal must not echo customer text');
  assert.throws(() => E.applyImport({ assumptions: {} }, checked), /Only a validated import/, 'a refused import cannot be applied');
});

test('assumptions UI applies an import only after confirmation, through the engine checks (#106)', () => {
  assert.match(source, /function addAssumptionsTools\(root\)/);
  assert.match(source, /addAssumptionsTools\(root\);/);
  assert.match(source, /engine\.exportAssumptions\(profile,profile\.activeVertical,ids\)/);
  assert.match(source, /engine\.validateImport\(String\(reader\.result\|\|''\),ids\)/);
  assert.match(source, /engine\.applyImport\(profile,checked\)/);
  assert.match(source, /if\(checked\.value\.vertical!==profile\.activeVertical\)/, 'an import for another service type is not applied');
  assert.doesNotMatch(source, /\bfetch\s*\(/, 'no network calls');
});
