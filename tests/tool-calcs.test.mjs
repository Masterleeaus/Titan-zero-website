// Deterministic tests for the calculation helpers behind issues #24-#33.
// Loads assets/tool-calcs.js into a clean VM context: no DOM, no network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = readFileSync(new URL('../assets/tool-calcs.js', import.meta.url), 'utf8');
const C = runInNewContext(source + '\n;globalThis.TitanToolCalcs', {});
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, message || `${actual} != ${expected}`);

// ---- #24 admin cost
test('admin: on-costs default to zero, so the original value is unchanged', () => {
  const r = C.adminCost({ adminHours: 10, adminRate: 45 });
  close(r.loadedRate, 45);
  close(r.capacityValue, 1950);
  close(C.adminCost({ adminHours: 10, adminRate: 45, oncostPct: 0 }).capacityValue, 1950);
});

test('admin: on-costs raise the loaded rate and every value that uses it', () => {
  const r = C.adminCost({ adminHours: 10, adminRate: 40, oncostPct: 25, reclaimPct: 50 });
  close(r.loadedRate, 50, 'A$40 wage plus 25% on-costs');
  close(r.capacityValue, 10 * 52 / 12 * 50);
  close(r.recoveredValue, 10 * 0.5 * 52 / 12 * 50);
});

test('admin: weeks convert to months with 52 / 12 (an average month, not a calendar month)', () => {
  const r = C.adminCost({ adminHours: 12, adminRate: 10 });
  close(r.weeksPerMonth, 52 / 12);
  close(r.capacityValue, 12 * 52 / 12 * 10);
});

test('admin: on-costs must be a number between 0 and 200 percent', () => {
  assert.throws(() => C.adminCost({ adminHours: 5, adminRate: 40, oncostPct: -1 }), /at least 0|must be/);
  assert.throws(() => C.adminCost({ adminHours: 5, adminRate: 40, oncostPct: 201 }), /must be 0 to 200/);
  assert.throws(() => C.adminCost({ adminHours: 5, adminRate: 40, oncostPct: 'x' }), /must be a number/);
});

test('admin: default inputs reproduce the original hours x 52/12 x rate value', () => {
  const r = C.adminCost({ adminHours: 10, adminRate: 45 });
  close(r.metric, 10 * 52 / 12 * 45);
  assert.equal(r.recoveredValue, 0, 'no reclaim share means no recovered value');
  assert.equal(r.cashSavings, 0, 'cash savings are never assumed');
});

test('admin: recovered capacity is separate from cash savings and reinvestment', () => {
  const r = C.adminCost({ adminHours: 10, adminRate: 40, reclaimPct: 50, cashPct: 25, reinvestPct: 25 });
  close(r.recoveredValue, 5 * 52 / 12 * 40);
  close(r.cashSavings, r.recoveredValue * 0.25);
  close(r.reinvestedValue, r.recoveredValue * 0.25);
  close(r.unassignedValue, r.recoveredValue * 0.5);
});

test('admin: cash plus reinvestment cannot exceed the recovered share', () => {
  assert.throws(() => C.adminCost({ adminHours: 5, adminRate: 40, cashPct: 70, reinvestPct: 40 }), /cannot exceed 100%/);
});

test('admin: rejects negative, non-numeric and over-100 percentages', () => {
  assert.throws(() => C.adminCost({ adminHours: -1, adminRate: 40 }), /at least 0/);
  assert.throws(() => C.adminCost({ adminHours: 'x', adminRate: 40 }), /must be a number/);
  assert.throws(() => C.adminCost({ adminHours: 5, adminRate: 40, reclaimPct: 101 }), /must be 0 to 100/);
});

test('admin: zero hours or zero rate gives zero value without error', () => {
  assert.equal(C.adminCost({ adminHours: 0, adminRate: 50 }).metric, 0);
  assert.equal(C.adminCost({ adminHours: 8, adminRate: 0 }).metric, 0);
});

// ---- #25 hiring cost
test('hiring: default on-cost (18%) keeps the original monthly cost', () => {
  const r = C.hiringCost({ salary: 65000, oncost: 18, margin: 180 });
  close(r.monthlyCost, 65000 * 1.18 / 12);
  assert.equal(r.onCostPct, 18);
});

test('hiring: super, leave and other on-costs add together', () => {
  const r = C.hiringCost({ salary: 60000, superPct: 10, leavePct: 5, oncost: 3, margin: 100 });
  assert.equal(r.onCostPct, 18);
  close(r.monthlyCost, 60000 * 1.18 / 12);
});

test('hiring: zero or negative contribution gives no job count instead of a number', () => {
  for (const margin of [0, -40]) {
    const r = C.hiringCost({ salary: 65000, oncost: 18, margin });
    assert.equal(r.jobsNeeded, null);
    assert.equal(r.jobsExact, null);
  }
});

test('hiring: fractional jobs round up to whole jobs and keep the exact figure', () => {
  const r = C.hiringCost({ salary: 52000, oncost: 0, margin: 100 });
  close(r.jobsExact, 52000 / 12 / 100);
  assert.equal(r.jobsNeeded, Math.ceil(52000 / 12 / 100));
});

test('hiring: contractor comparison uses the same billable hours', () => {
  const r = C.hiringCost({ salary: 65000, oncost: 18, margin: 100, paidHours: 38, utilisationPct: 80, contractorRate: 60 });
  close(r.billableHours, 38 * 0.8 * 52 / 12);
  close(r.contractorCost, 60 * r.billableHours);
  assert.equal(typeof r.contractorCheaper, 'boolean');
});

test('hiring: zero paid hours is refused rather than dividing by zero', () => {
  assert.throws(() => C.hiringCost({ salary: 65000, oncost: 18, margin: 100, paidHours: 0 }), /above zero/);
});

// ---- #26 job profitability
test('profit: default inputs keep the original direct contribution of 275', () => {
  const r = C.jobProfitability({ jobRevenue: 650, labour: 220, materials: 110, travel: 45 });
  assert.equal(r.contribution, 275);
  assert.equal(r.netProfit, 275);
});

test('profit: overhead is subtracted once and reconciles to net profit', () => {
  const r = C.jobProfitability({ jobRevenue: 500, labour: 150, materials: 50, travel: 25, overhead: 40 });
  assert.equal(r.directCost, 225);
  assert.equal(r.contribution, 275);
  assert.equal(r.netProfit, 235);
  assert.equal(r.reconciles, true);
});

test('profit: tax-inclusive revenue has GST removed before margins are calculated', () => {
  const r = C.jobProfitability({ jobRevenue: 110, taxMode: 'inclusive', taxRate: 10, labour: 50, materials: 0, travel: 0 });
  close(r.netRevenue, 100);
  close(r.taxInside, 10);
  close(r.grossMarginPct, 50);
});

test('profit: discount reduces revenue once and is not counted as cost', () => {
  const r = C.jobProfitability({ jobRevenue: 200, discountPct: 10, labour: 100, materials: 0, travel: 0 });
  close(r.discountAmount, 20);
  close(r.contribution, 80);
});

test('profit: markup and gross margin are labelled separately', () => {
  const r = C.jobProfitability({ jobRevenue: 150, labour: 100, materials: 0, travel: 0 });
  close(r.grossMarginPct, 100 / 3 * 1, '');
  close(r.markupPct, 50);
});

test('profit: target margin gives the price needed including overhead', () => {
  const r = C.jobProfitability({ jobRevenue: 300, labour: 100, materials: 0, travel: 0, overhead: 20, targetMarginPct: 40 });
  close(r.priceForTarget, 120 / 0.6);
});

test('profit: zero revenue and zero cost do not produce a margin number', () => {
  const r = C.jobProfitability({ jobRevenue: 0, labour: 0, materials: 0, travel: 0 });
  assert.equal(r.grossMarginPct, null);
  assert.equal(r.markupPct, null);
});

// ---- #27 capacity planner
test('capacity: default inputs match the original theoretical jobs figure', () => {
  const r = C.capacityPlanner({ workers: 4, hours: 30, duration: 2.5, currentJobs: 150 });
  assert.equal(r.theoreticalJobs, Math.floor(4 * 30 * 52 / 12 / 2.5));
  assert.equal(r.bookableJobs, r.theoreticalJobs);
});

test('capacity: leave, non-billable time, buffers and cancellations reduce bookable jobs', () => {
  const r = C.capacityPlanner({
    workers: 3, hours: 40, duration: 2, currentJobs: 100,
    travelMin: 30, nonbillPct: 10, cancelPct: 5, daysPerWeek: 5, leaveDays: 25
  });
  assert.ok(r.bookableJobs < r.theoreticalJobs);
  close(r.perJobHours, 2.5);
  const expected = 3 * 40 * 0.9 * ((260 - 25) / 260) * 52 / 12 * 0.95 / 2.5;
  assert.equal(r.bookableJobs, Math.floor(expected));
});

test('capacity: partial hours and a half-day week are allowed', () => {
  const r = C.capacityPlanner({ workers: 1, hours: 7.5, duration: 1.5, currentJobs: 0, daysPerWeek: 2.5 });
  assert.ok(r.bookableJobs > 0);
});

test('capacity: zero or negative duration is refused', () => {
  assert.throws(() => C.capacityPlanner({ workers: 2, hours: 30, duration: 0, currentJobs: 10 }), /at least 0.1/);
  assert.throws(() => C.capacityPlanner({ workers: 2, hours: 30, duration: -1, currentJobs: 10 }), /at least 0.1/);
});

test('capacity: negative spare is shown as over-capacity, not hidden', () => {
  const r = C.capacityPlanner({ workers: 1, hours: 10, duration: 2, currentJobs: 500 });
  assert.ok(r.spare < 0);
});

test('capacity: leave cannot exceed the available days in a year', () => {
  assert.throws(() => C.capacityPlanner({ workers: 1, hours: 30, duration: 2, currentJobs: 1, daysPerWeek: 5, leaveDays: 300 }), /cannot exceed/);
});

test('capacity: monthly conversion is the fixed 52/12 weeks, not a calendar or clock calculation', () => {
  assert.equal(C.WEEKS_PER_MONTH, 52 / 12);
  const r = C.capacityPlanner({ workers: 1, hours: 12, duration: 1, currentJobs: 0 });
  assert.equal(r.theoreticalJobs, Math.floor(12 * 52 / 12));
});

// ---- #28 missed enquiries
test('missed: default opportunity keeps the original definition', () => {
  const r = C.missedEnquiry({ calls: 70, missed: 10, convert: 35, jobValue: 220 });
  close(r.opportunity, 70 * 0.1 * 0.35 * 220);
  assert.equal(r.recoverable, 0, 'no follow-up reach means nothing assumed recoverable');
});

test('missed: recoverable share and contribution are separate from opportunity', () => {
  const r = C.missedEnquiry({ calls: 100, missed: 20, convert: 50, jobValue: 200, reachPct: 50, contribPct: 40, commsPerEnquiry: 1 });
  close(r.opportunity, 2000);
  close(r.recoverable, 1000);
  close(r.recoverableContribution, 400);
  close(r.commsCost, 20 * 0.5 * 1);
});

test('missed: 0% and 100% limits are accepted, beyond them is refused', () => {
  assert.equal(C.missedEnquiry({ calls: 10, missed: 0, convert: 100, jobValue: 1 }).opportunity, 0);
  assert.equal(C.missedEnquiry({ calls: 10, missed: 100, convert: 100, jobValue: 1, reachPct: 100 }).recoverable, 10);
  assert.throws(() => C.missedEnquiry({ calls: 10, missed: 101, convert: 1, jobValue: 1 }), /must be 0 to 100/);
  assert.throws(() => C.missedEnquiry({ calls: 10, missed: 10, convert: 1, jobValue: 1, reachPct: -5 }), /must be 0 to 100/);
});

// ---- #29 lead conversion
function leadInput(overrides = {}) {
  return {
    leads: 100, value: 450, contribPct: 40,
    base_contacted: 90, base_qualified: 50, base_booked: 60, base_completed: 80,
    alt_contacted: 92, alt_qualified: 50, alt_booked: 62, alt_completed: 80,
    ...overrides
  };
}

test('lead: funnel multiplies the four stage rates for baseline and scenario', () => {
  const r = C.leadConversion(leadInput());
  close(r.baseRate, 0.9 * 0.5 * 0.6 * 0.8);
  close(r.scenRate, 0.92 * 0.5 * 0.62 * 0.8);
  close(r.revenueDelta, 100 * (r.scenRate - r.baseRate) * 450);
  close(r.contributionDelta, r.revenueDelta * 0.4);
});

test('lead: negative uplift is reported as a reduction, not clamped to zero', () => {
  const r = C.leadConversion(leadInput({ alt_contacted: 80 }));
  assert.ok(r.deltaCompleted < 0);
  assert.equal(r.direction, 'reduction');
});

test('lead: stage rates above 100 or below 0 are refused', () => {
  assert.throws(() => C.leadConversion(leadInput({ alt_booked: 120 })), /must be 0 to 100/);
  assert.throws(() => C.leadConversion(leadInput({ base_qualified: -1 })), /must be 0 to 100/);
});

test('lead: identical baseline and scenario show no change', () => {
  const r = C.leadConversion(leadInput({ alt_contacted: 90, alt_qualified: 50, alt_booked: 60, alt_completed: 80 }));
  assert.equal(r.revenueDelta, 0);
  assert.equal(r.direction, 'no change');
});

// ---- #30 invoice collection
function invoiceInput(overrides = {}) {
  return {
    invoices: 100, avg: 500, chase: 6,
    age_d0_30: 0, age_d31_60: 10, age_d61_90: 5, age_d90: 3,
    collect_d0_30: 100, collect_d31_60: 80, collect_d61_90: 50, collect_d90: 20,
    ...overrides
  };
}

test('invoice: beyond-terms value sums the 31+ day buckets', () => {
  const r = C.invoiceCollection(invoiceInput());
  close(r.billed, 50000);
  close(r.beyondTerms, 50000 * 0.18);
});

test('invoice: expected 13-week cash uses only the collection shares entered', () => {
  const r = C.invoiceCollection(invoiceInput());
  close(r.cashIn13Weeks, 5000 * 0.8 + 2500 * 0.5 + 1500 * 0.2);
  close(r.notCollectedIn13Weeks, 50000 * 0.18 - (4000 + 1250 + 300));
});

test('invoice: ageing shares cannot exceed 100% in total', () => {
  assert.throws(() => C.invoiceCollection(invoiceInput({ age_d0_30: 60, age_d31_60: 50 })), /more than 100%/);
});

test('invoice: zero invoices produce zero value and no hours per thousand', () => {
  const r = C.invoiceCollection(invoiceInput({ invoices: 0 }));
  assert.equal(r.beyondTerms, 0);
  assert.equal(r.hoursPerThousandBeyondTerms, null);
});

test('invoice: default terms are 30 days and the 31+ buckets are beyond them', () => {
  const r = C.invoiceCollection(invoiceInput());
  assert.equal(r.terms, 30);
  close(r.beyondTerms, r.outstanding.d31_60 + r.outstanding.d61_90 + r.outstanding.d90);
});

test('invoice: longer terms count fewer buckets as beyond terms', () => {
  // 45 days: the 31-60 bucket starts before the due day, so only 61+ counts.
  const r45 = C.invoiceCollection(invoiceInput({ terms: 45 }));
  close(r45.beyondTerms, r45.outstanding.d61_90 + r45.outstanding.d90);
  // 14 days: every bucket except 0-30 starts after the due day.
  const r14 = C.invoiceCollection(invoiceInput({ terms: 14 }));
  close(r14.beyondTerms, r14.outstanding.d31_60 + r14.outstanding.d61_90 + r14.outstanding.d90);
});

test('invoice: a bucket that straddles the due day is not counted as beyond terms', () => {
  const r = C.invoiceCollection(invoiceInput({ terms: 14, age_d0_30: 20, age_d31_60: 0, age_d61_90: 0, age_d90: 0 }));
  close(r.beyondTerms, 0);
});

test('invoice: cash splits into weeks 1-4 and 5-13 and adds back to the 13-week figure', () => {
  const r = C.invoiceCollection(invoiceInput({ within4: 50 }));
  close(r.cashIn4Weeks, r.cashIn13Weeks * 0.5);
  close(r.cashWeeks5To13, r.cashIn13Weeks * 0.5);
  close(r.cashIn4Weeks + r.cashWeeks5To13, r.cashIn13Weeks);
});

test('invoice: cash timing share defaults to 60% and terms and shares are range checked', () => {
  const r = C.invoiceCollection(invoiceInput());
  close(r.cashIn4Weeks, r.cashIn13Weeks * 0.6);
  assert.throws(() => C.invoiceCollection(invoiceInput({ within4: 101 })), /must be 0 to 100/);
  assert.throws(() => C.invoiceCollection(invoiceInput({ terms: -1 })), /at least 0/);
  assert.throws(() => C.invoiceCollection(invoiceInput({ terms: 121 })), /120 days or fewer/);
});

test('invoice: no unpaid balances gives zero value, zero cash and no error', () => {
  const r = C.invoiceCollection(invoiceInput({ age_d31_60: 0, age_d61_90: 0, age_d90: 0 }));
  close(r.beyondTerms, 0);
  assert.equal(r.hoursPerThousandBeyondTerms, null);
});

// ---- #31 quote builder
test('quote: tax-exclusive GST is applied after the discount, in cents', () => {
  const t = C.quoteTotals({
    lines: [{ description: 'Service', quantity: 1, unitPrice: 100 }, { description: 'Parts', quantity: 3, unitPrice: 33.33 }],
    discountPct: 10, taxMode: 'exclusive', taxRate: 10
  });
  assert.equal(t.subtotalCents, 10000 + 9999);
  assert.equal(t.discountCents, 2000, '10% of 19999 cents rounds to 2000');
  assert.equal(t.exTaxCents, 17999);
  assert.equal(t.gstCents, 1800);
  assert.equal(t.totalCents, 19799);
});

test('quote: tax-inclusive prices split GST out without double counting', () => {
  const t = C.quoteTotals({ lines: [{ description: 'Job', quantity: 1, unitPrice: 110 }], taxMode: 'inclusive', taxRate: 10 });
  assert.equal(t.totalCents, 11000);
  assert.equal(t.gstCents, 1000);
  assert.equal(t.exTaxCents, 10000);
  assert.equal(t.exTaxCents + t.gstCents, t.totalCents);
});

test('quote: no tax mode leaves the total equal to the discounted subtotal', () => {
  const t = C.quoteTotals({ lines: [{ description: 'A', quantity: 2, unitPrice: 10.1 }], discountPct: 0, taxMode: 'none' });
  assert.equal(t.totalCents, 2020);
  assert.equal(t.gstCents, 0);
});

test('quote: fractional quantities round each line to cents', () => {
  const t = C.quoteTotals({ lines: [{ description: 'Hours', quantity: 1.5, unitPrice: 33.33 }], taxMode: 'none' });
  assert.equal(t.lines[0].lineCents, Math.round(1.5 * 3333));
});

test('quote: discount above 100 or negative quantity is refused', () => {
  assert.throws(() => C.quoteTotals({ lines: [], discountPct: 101 }), /must be 0 to 100/);
  assert.throws(() => C.quoteTotals({ lines: [{ description: 'x', quantity: -1, unitPrice: 5 }] }), /at least 0/);
});

test('quote: unknown tax mode and over-long descriptions are refused', () => {
  assert.throws(() => C.quoteTotals({ lines: [], taxMode: 'vat' }), /Tax mode/);
  assert.throws(() => C.quoteTotals({ lines: [{ description: 'x'.repeat(161), quantity: 1, unitPrice: 1 }] }), /too long/);
});

test('quote: save keeps the customer name only with recorded consent', () => {
  const base = { reference: 'q-101', business: 'Acme', customer: 'Sam', lines: [{ description: 'A', quantity: 1, unitPrice: 5 }] };
  const without = C.saveQuoteRecord({ quotes: [] }, base, '2026-11-18T00:00:00Z');
  assert.equal(without.saved.customer, '');
  const withConsent = C.saveQuoteRecord({ quotes: [] }, { ...base, consentToStoreCustomer: true }, '2026-11-18T00:00:00Z');
  assert.equal(withConsent.saved.customer, 'Sam');
});

test('quote: saving the same reference again increments the version', () => {
  const quote = { reference: 'Q-7', lines: [] };
  const first = C.saveQuoteRecord({ quotes: [] }, quote, 't1');
  const second = C.saveQuoteRecord({ quotes: first.quotes }, quote, 't2');
  assert.equal(second.saved.version, 2);
  assert.equal(second.quotes.length, 1);
});

test('quote: reference is cleaned and a blank reference is refused', () => {
  assert.equal(C.quoteRecordId(' q 1/a<b> '), 'Q1AB');
  assert.throws(() => C.saveQuoteRecord({ quotes: [] }, { reference: ' <> ' }, 't'), /reference/);
});

test('quote: stored records are capped at the limit', () => {
  let store = { quotes: [] };
  for (let i = 0; i < C.QUOTE_LIMIT + 5; i++) store = C.saveQuoteRecord(store, { reference: 'R' + i }, 't');
  assert.equal(store.quotes.length, C.QUOTE_LIMIT);
});

test('quote: stored text is kept as data, not interpreted', () => {
  const r = C.saveQuoteRecord({ quotes: [] }, { reference: 'X1', service: '<img src=x onerror=alert(1)>' }, 't');
  assert.equal(r.saved.service, '<img src=x onerror=alert(1)>');
  assert.equal(JSON.stringify(r.saved).includes('<img'), true, 'data stays inert until the UI sets textContent');
});

// ---- #32 job cost sheet
test('job cost: several labour lines add up and costs stay separate from price', () => {
  const r = C.jobCostSheet({
    roles: [{ hours: 2, rate: 60 }, { hours: 1.5, rate: 45 }],
    materials: 100, materialMarkupPct: 20, equipment: 10, km: 30, kmRate: 0.5, travel: 5,
    contingencyPct: 10, overhead: 20, price: 400
  });
  close(r.labour, 120 + 67.5);
  close(r.mileage, 15);
  close(r.directCost, 187.5 + 100 + 10 + 15 + 5);
  close(r.contingency, r.directCost * 0.1);
  close(r.totalCost, r.directCost + r.contingency + 20);
  close(r.margin, 400 - r.totalCost);
  close(r.materialMarkupValue, 20, 'markup shown separately from the material cost');
});

test('job cost: zero cost gives a 100% margin and no divide-by-zero', () => {
  const r = C.jobCostSheet({ roles: [], price: 50 });
  assert.equal(r.totalCost, 0);
  assert.equal(r.marginPct, 100);
  const free = C.jobCostSheet({ roles: [], price: 0 });
  assert.equal(free.marginPct, null);
});

test('job cost: target price is cost divided by one minus target margin', () => {
  const r = C.jobCostSheet({ roles: [{ hours: 2, rate: 50 }], targetMarginPct: 25 });
  close(r.targetPrice, 100 / 0.75);
});

test('job cost: negative inputs and a 100% target margin are refused or treated as no target', () => {
  assert.throws(() => C.jobCostSheet({ roles: [{ hours: -1, rate: 10 }] }), /at least 0/);
  assert.equal(C.jobCostSheet({ roles: [{ hours: 1, rate: 10 }], targetMarginPct: 100 }).targetPrice, null);
});

test('job cost: converts to one quote line with the same ex-GST price', () => {
  const cost = C.jobCostSheet({ roles: [{ hours: 1, rate: 10 }], price: 123.456 });
  const line = C.costToQuoteLine(cost, 'Fence repair');
  assert.equal(line.unitPrice, 123.46);
  assert.equal(line.quantity, 1);
  const total = C.quoteTotals({ lines: [line], taxMode: 'exclusive', taxRate: 10 });
  assert.equal(total.exTaxCents, 12346);
});

// ---- #33 checklist state
const templates = {
  cleaning: ['Confirm access', 'Clean rooms', 'Check work'],
  plumbing: ['Isolate supply', 'Replace fitting', 'Test flow']
};

test('checklist: template ids are stable and created unticked', () => {
  const tasks = C.templateTasks('cleaning', templates, 1);
  assert.equal(tasks.length, 3);
  assert.ok(tasks.every(task => task.done === false));
  assert.equal(tasks[0].key, 'cleaning:0');
});

test('checklist: re-rendering with the same template keeps completed tasks', () => {
  let state = { ...C.emptyChecklist('cleaning'), tasks: C.templateTasks('cleaning', templates, 1) };
  state = C.setTaskDone(state, state.tasks[1].id, true);
  state = C.setTaskNote(state, state.tasks[1].id, 'Done on site');
  const again = C.reconcileChecklist(state, 'cleaning', templates, 1);
  assert.equal(again.tasks[1].done, true);
  assert.equal(again.tasks[1].note, 'Done on site');
});

test('checklist: custom tasks and ticks survive a template revision', () => {
  let state = { ...C.emptyChecklist('cleaning'), tasks: C.templateTasks('cleaning', templates, 1) };
  state = C.addCustomTask(state, 'Photograph the stove', 1);
  state = C.setTaskDone(state, state.tasks[3].id, true);
  const revised = C.reconcileChecklist(state, 'cleaning', { cleaning: ['Confirm access', 'Clean rooms', 'Check work', 'Lock up'] }, 2);
  assert.equal(revised.tasks.find(task => task.custom).done, true);
  assert.equal(revised.tasks.at(-1).custom, true);
});

test('checklist: reorder, edit and remove act on stable IDs', () => {
  let state = { ...C.emptyChecklist('cleaning'), tasks: C.templateTasks('cleaning', templates, 1) };
  const first = state.tasks[0].id;
  state = C.moveTask(state, first, 1);
  assert.equal(state.tasks[1].id, first);
  state = C.editTask(state, first, 'Confirm access and keys');
  assert.equal(state.tasks[1].text, 'Confirm access and keys');
  state = C.removeTask(state, first);
  assert.equal(state.tasks.length, 2);
  assert.equal(C.moveTask(state, state.tasks[0].id, -1).tasks[0].id, state.tasks[0].id, 'cannot move above the top');
});

test('checklist: switching service type asks first when work is ticked', () => {
  let state = { ...C.emptyChecklist('cleaning'), tasks: C.templateTasks('cleaning', templates, 1) };
  state = C.setTaskDone(state, state.tasks[0].id, true);
  const asked = C.switchIndustry(state, 'plumbing', templates, false);
  assert.equal(asked.needsConfirm, true);
  assert.equal(asked.state.industry, 'cleaning', 'state is unchanged until confirmed');
  const confirmed = C.switchIndustry(state, 'plumbing', templates, true);
  assert.equal(confirmed.state.industry, 'plumbing');
  assert.ok(confirmed.state.tasks.every(task => task.done === false), 'switch resets ticks explicitly');
});

test('checklist: switching with nothing ticked needs no confirmation', () => {
  const state = { ...C.emptyChecklist('cleaning'), tasks: C.templateTasks('cleaning', templates, 1) };
  assert.equal(C.switchIndustry(state, 'plumbing', templates, false).changed, true);
});

test('checklist: a service type without a template is refused', () => {
  assert.throws(() => C.templateTasks('roofing', templates, 1), /No checklist template/);
});

test('checklist: empty custom task is refused and long text is trimmed', () => {
  const state = C.emptyChecklist('cleaning');
  assert.throws(() => C.addCustomTask(state, '   ', 1), /Enter a task/);
  const long = C.addCustomTask(state, 'x'.repeat(400), 2).tasks[0].text;
  assert.equal(long.length, 240);
});

test('checklist: progress reports complete only when every task is ticked', () => {
  let state = { ...C.emptyChecklist('cleaning'), tasks: C.templateTasks('cleaning', templates, 1) };
  assert.equal(C.checklistProgress(state).complete, false);
  for (const task of state.tasks) state = C.setTaskDone(state, task.id, true);
  const progress = C.checklistProgress(state); assert.equal(progress.total, 3); assert.equal(progress.done, 3); assert.equal(progress.complete, true);
});

test('checklist: all ten shipped industries have a template in site-data', () => {
  const site = readFileSync(new URL('../assets/site-data.js', import.meta.url), 'utf8');
  const data = runInNewContext(site.replace('window.TITAN_SITE_CONTENT=', 'globalThis.DATA=') + '\n;globalThis.DATA', {});
  const ids = data.industries.map(item => item.id);
  assert.equal(ids.length, 10);
  for (const id of ids) assert.ok(Array.isArray(data.checklists[id]) && data.checklists[id].length > 0, id + ' template');
});

// ---- #34 pricing handoff: figures saved by Service pricing and read back by the Quote Builder and Job Cost Sheet
const savedPricing = {
  savedAt: '2026-11-18T00:00:00.000Z', role: 'Technician', labourHours: 2, labourRate: 45, materials: 20.5, travel: 10,
  equipment: 5, overhead: 12.25, contingencyPct: 10, targetMarginPct: 30, targetPrice: 186.35
};

test('pricing handoff (#34): a valid saved figure set is read back with cents and a trimmed role', () => {
  const figures = C.parsePricingHandoff(JSON.stringify({ ...savedPricing, role: '  Technician  ' }));
  assert.equal(figures.role, 'Technician');
  assert.equal(figures.labourHours, 2);
  assert.equal(figures.targetPrice, 186.35);
  assert.equal(figures.overhead, 12.25);
});

test('pricing handoff (#34): missing, corrupt or non-object saves give null', () => {
  assert.equal(C.parsePricingHandoff(null), null);
  assert.equal(C.parsePricingHandoff('{bad'), null);
  assert.equal(C.parsePricingHandoff('42'), null);
  assert.equal(C.parsePricingHandoff('null'), null);
});

test('pricing handoff (#34): any figure out of range or of the wrong type makes the whole save unusable', () => {
  const cases = [
    { targetPrice: -1 }, { targetPrice: 1000001 }, { labourRate: 'forty' }, { materials: Number.NaN },
    { contingencyPct: 100 }, { targetMarginPct: 100 }, { labourHours: 10001 }, { travel: null }
  ];
  for (const change of cases) {
    const raw = JSON.stringify({ ...savedPricing, ...change });
    assert.equal(C.parsePricingHandoff(raw), null, JSON.stringify(change));
  }
});

test('pricing handoff (#34): a role over 80 characters is capped and a non-text role becomes empty', () => {
  assert.equal(C.parsePricingHandoff(JSON.stringify({ ...savedPricing, role: 'r'.repeat(200) })).role.length, 80);
  assert.equal(C.parsePricingHandoff(JSON.stringify({ ...savedPricing, role: 7 })).role, '');
});

test('pricing handoff (#34): the storage key is versioned', () => {
  assert.equal(C.PRICING_HANDOFF_KEY, 'titanPricingHandoffV1');
});
