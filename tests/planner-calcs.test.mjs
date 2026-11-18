// Regression tests for the planners in issues #34-#41 (assets/planner-calcs.js).
// Pure functions only: no DOM, no network, no storage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const P = require('../assets/planner-calcs.js');

const cell = (result, label) => {
  for (const t of result.tables) {
    const row = t.rows.find((r) => (typeof r[0] === 'string' ? r[0] : r[0]) === label);
    if (row) return row;
  }
  throw new Error(`row not found: ${label}`);
};
const summary = (result, label) => {
  const item = result.summary.find((s) => s.label === label);
  assert.ok(item, `summary item not found: ${label}`);
  return item;
};

// ---- #34 service pricing ----------------------------------------------------
const basePricing = { role: '', labourHours: 0, labourRate: 0, materials: 0, travel: 0, equipment: 0, overhead: 0, contingencyPct: 0, targetMarginPct: 0, discountPct: 0, gst: 'no' };

test('service pricing: all-zero inputs give zero cost and zero prices, no NaN', () => {
  const r = P.servicePricing(basePricing);
  assert.equal(r.ok, true);
  assert.equal(r.headline.v, 0);
  assert.equal(summary(r, 'Recommended price at target margin').v, 0);
  assert.equal(summary(r, 'Margin at price after discount').v, null);
});

test('service pricing: 100% target margin is reported as not achievable, not Infinity', () => {
  const r = P.servicePricing({ ...basePricing, labourHours: 1, labourRate: 50, targetMarginPct: 100 });
  assert.equal(r.ok, true);
  assert.equal(summary(r, 'Recommended price at target margin').f, 'text');
  assert.doesNotMatch(JSON.stringify(r), /Infinity|NaN/);
});

test('service pricing: cost is counted once and contingency applies to direct cost only', () => {
  const r = P.servicePricing({ ...basePricing, labourHours: 2, labourRate: 45, materials: 20, travel: 10, contingencyPct: 10, overhead: 5 });
  // direct 120.00, contingency 12.00, overhead 5.00
  assert.equal(r.headline.v, 137);
});

test('service pricing: target price is rounded up so the margin is never below target', () => {
  const r = P.servicePricing({ ...basePricing, labourHours: 2, labourRate: 45, materials: 20, travel: 10, contingencyPct: 10, overhead: 5, targetMarginPct: 30 });
  // 137 / 0.7 = 195.714... -> 195.72
  assert.equal(summary(r, 'Recommended price at target margin').v, 195.72);
});

test('service pricing: price after discount still meets the target margin', () => {
  const r = P.servicePricing({ ...basePricing, labourHours: 2, labourRate: 45, materials: 20, travel: 10, contingencyPct: 10, overhead: 5, targetMarginPct: 30, discountPct: 10 });
  assert.ok(summary(r, 'Margin at price after discount').v >= 30);
});

test('service pricing: GST adds 10% to the including-GST column, rounded to cents', () => {
  const r = P.servicePricing({ ...basePricing, labourHours: 1, labourRate: 0.05, gst: 'yes' });
  const row = r.tables[0].rows[0];
  assert.equal(row[1].v, 0.05);
  assert.equal(row[2].v, 0.06); // GST on 5 cents is 0.5 cent, rounded to 1 cent, so 6 cents
});

test('service pricing (#34): extreme but valid inputs stay finite and in order', () => {
  const r = P.servicePricing({ ...basePricing, labourHours: 10000, labourRate: 1000000, materials: 1000000, travel: 1000000, equipment: 1000000, overhead: 1000000, contingencyPct: 100, targetMarginPct: 99.99, discountPct: 99.99 });
  assert.equal(r.ok, true);
  const cost = summary(r, 'True unit cost, excluding GST').v;
  const target = summary(r, 'Recommended price at target margin').v;
  assert.ok(Number.isFinite(cost) && Number.isFinite(target), 'no Infinity or NaN');
  assert.ok(target >= cost, 'target price is never below cost');
  const list = cell(r, 'List price before discount')[1].v;
  const after = cell(r, 'Price after discount')[1].v;
  assert.ok(after <= list && after > 0, 'discounted price stays below list and above zero');
});

test('service pricing (#34): contingency applies to direct cost only, and overhead is added once', () => {
  const r = P.servicePricing({ ...basePricing, labourHours: 1, labourRate: 100, materials: 50, contingencyPct: 100, overhead: 25 });
  // direct = 150, contingency = 150, overhead = 25, unit cost = 325
  assert.equal(summary(r, 'True unit cost, excluding GST').v, 325);
});

test('service pricing (#34): a discount of 99.99% still gives a list price that is rounded to the cent', () => {
  const r = P.servicePricing({ ...basePricing, labourHours: 1, labourRate: 100, targetMarginPct: 20, discountPct: 99.99 });
  const list = cell(r, 'List price before discount')[1].v;
  assert.equal(Math.round(list * 100), list * 100, 'list price is whole cents');
  assert.ok(list > 0);
});

test('service pricing (#34): GST inclusive column is the ex-GST figure plus 10%, to the cent, with no drift on odd cents', () => {
  const r = P.servicePricing({ ...basePricing, labourHours: 1, labourRate: 0.01, gst: 'yes' });
  const floor = cell(r, 'Floor price (covers cost, no margin)');
  assert.equal(floor[1].v, 0.01);
  assert.equal(floor[2].v, 0.01, '10% of one cent rounds to zero cents');
});

test('service pricing: rejects money with more than two decimals and negative values', () => {
  assert.equal(P.servicePricing({ ...basePricing, labourRate: 45.555 }).ok, false);
  assert.equal(P.servicePricing({ ...basePricing, materials: -1 }).ok, false);
  assert.equal(P.servicePricing({ ...basePricing, discountPct: 100 }).ok, false);
});

// ---- #35 booking revenue ----------------------------------------------------
const booking = { bookingsPerWeek: 0, serviceValue: 0, costPerJob: 0, noShowPct: 0, cancelPct: 0, rebookPct: 0, depositPct: 0 };

test('booking revenue: zero bookings give zero everywhere', () => {
  const r = P.bookingRevenue(booking);
  assert.equal(r.ok, true);
  assert.equal(r.headline.v, 0);
});

test('booking revenue: 100% no-show leaves no completed revenue and no job cost', () => {
  const r = P.bookingRevenue({ ...booking, bookingsPerWeek: 10, serviceValue: 100, costPerJob: 40, noShowPct: 100 });
  assert.equal(r.headline.v, 0);
  assert.equal(cell(r, 'Completed revenue (includes rebooked jobs)')[1].v, 0);
});

test('booking revenue: no-show plus cancellation above 100% is rejected', () => {
  const r = P.bookingRevenue({ ...booking, bookingsPerWeek: 10, serviceValue: 100, noShowPct: 60, cancelPct: 50 });
  assert.equal(r.ok, false);
  assert.match(r.error, /cannot exceed 100%/);
});

test('booking revenue: rebooked and deposit-recovered value are not counted twice', () => {
  const r = P.bookingRevenue({ ...booking, bookingsPerWeek: 20, serviceValue: 200, costPerJob: 80, noShowPct: 10, cancelPct: 5, rebookPct: 50, depositPct: 20 });
  // weekly: completed 17 + rebooked 1.5 = 18.5 jobs -> 3,700; deposits on 1.5 unrecovered -> 60
  assert.equal(cell(r, 'Completed revenue (includes rebooked jobs)')[1].v, 3700);
  assert.equal(cell(r, 'Deposits or fees recovered')[1].v, 60);
  assert.equal(cell(r, 'Contribution after job cost')[1].v, 2280);
  assert.equal(r.headline.v, 9880); // 2,280 x 52 / 12, to the cent
});

test('booking revenue: rounding of the monthly figure is to the cent', () => {
  const r = P.bookingRevenue({ ...booking, bookingsPerWeek: 1, serviceValue: 0.01, costPerJob: 0 });
  assert.equal(Number.isInteger(Math.round(r.headline.v * 100)), true);
  assert.equal(r.headline.v, 0.04); // 0.01 x 52 / 12 = 0.0433 -> 0.04
});

test('booking revenue: pair reports the monthly contribution difference', () => {
  const a = P.bookingRevenue({ ...booking, bookingsPerWeek: 10, serviceValue: 100, costPerJob: 40 });
  const b = P.bookingRevenue({ ...booking, bookingsPerWeek: 10, serviceValue: 100, costPerJob: 40, noShowPct: 10 });
  const diff = P.pairBooking(a, b)[0];
  assert.equal(diff.f, 'money');
  assert.ok(diff.v < 0);
});

// ---- #36 travel and route cost ----------------------------------------------
const travel = { jobsPerDay: 0, jobHours: 0, wageRate: 0, vehicleCostPerKm: 0, paidHoursPerDay: 0, daysPerWeek: 0, gapKm: 0, gapMinutes: 0, setupMinutes: 0 };

// ---- #35 booking revenue: fixtures, extremes, GST and bounds
const bookingBase = { bookingsPerWeek: 0, serviceValue: 0, costPerJob: 0, noShowPct: 0, cancelPct: 0, rebookPct: 0, depositPct: 0 };

test('booking revenue (#35): a representative week matches the hand-worked figures', () => {
  // 20 bookings at A$180. 8% no-show and 4% cancelled leave 2.4 lost bookings. 40% are rebooked,
  // so 0.96 are rebooked and 1.44 are unrecovered. A quarter of the unrecovered value is recovered by deposit.
  // Completed = 17.6 + 0.96 = 18.56 jobs at A$180 = A$3,340.80. Deposits = 1.44 x 25% x A$180 = A$64.80.
  // Cash = A$3,405.60. Job cost = 18.56 x A$70 = A$1,299.20. Contribution = A$2,106.40 a week.
  const r = P.bookingRevenue({ ...bookingBase, bookingsPerWeek: 20, serviceValue: 180, costPerJob: 70, noShowPct: 8, cancelPct: 4, rebookPct: 40, depositPct: 25 });
  assert.equal(r.ok, true);
  assert.equal(cell(r, 'Booked value')[1].v, 3600);
  assert.equal(cell(r, 'Lost to no-show or cancellation')[1].v, 432);
  assert.equal(cell(r, 'Completed revenue (includes rebooked jobs)')[1].v, 3340.8);
  assert.equal(cell(r, 'Deposits or fees recovered')[1].v, 64.8);
  assert.equal(cell(r, 'Cash collected')[1].v, 3405.6);
  assert.equal(cell(r, 'Job cost for completed work')[1].v, 1299.2);
  assert.equal(cell(r, 'Contribution after job cost')[1].v, 2106.4);
  // Monthly = weekly x 52 / 12 = 9,127.73 (rounded to the cent)
  assert.equal(r.headline.v, 9127.73);
});

test('booking revenue (#35): 100% no-show with 100% rebooked recovers the whole booked value', () => {
  const r = P.bookingRevenue({ ...bookingBase, bookingsPerWeek: 10, serviceValue: 100, costPerJob: 40, noShowPct: 100, rebookPct: 100 });
  assert.equal(cell(r, 'Completed revenue (includes rebooked jobs)')[1].v, 1000);
  assert.equal(cell(r, 'Deposits or fees recovered')[1].v, 0);
  assert.equal(cell(r, 'Contribution after job cost')[1].v, 600);
});

test('booking revenue (#35): 100% deposit on unrecovered value with 100% no-show and 0% rebook counts the deposit once', () => {
  const r = P.bookingRevenue({ ...bookingBase, bookingsPerWeek: 10, serviceValue: 100, costPerJob: 40, noShowPct: 100, depositPct: 100 });
  assert.equal(cell(r, 'Completed revenue (includes rebooked jobs)')[1].v, 0);
  assert.equal(cell(r, 'Deposits or fees recovered')[1].v, 1000);
  assert.equal(cell(r, 'Cash collected')[1].v, 1000);
  assert.equal(cell(r, 'Job cost for completed work')[1].v, 0, 'no completed jobs means no job cost');
});

test('booking revenue (#35): extreme but valid inputs stay finite and in cents', () => {
  const r = P.bookingRevenue({ ...bookingBase, bookingsPerWeek: 100000, serviceValue: 1000000, costPerJob: 999999.99, noShowPct: 50, cancelPct: 50, rebookPct: 100, depositPct: 100 });
  assert.equal(r.ok, true);
  for (const value of [r.headline.v, ...r.summary.map((x) => x.v)]) {
    assert.ok(Number.isFinite(value), 'finite');
    assert.equal(Math.round(value * 100), value * 100, 'whole cents');
  }
});

test('booking revenue (#35): no GST is added to the service value, so cash is the value times completed jobs', () => {
  const r = P.bookingRevenue({ ...bookingBase, bookingsPerWeek: 5, serviceValue: 100, costPerJob: 0 });
  assert.equal(cell(r, 'Cash collected')[1].v, 500, 'no 10% added');
  assert.ok(r.notes.some((n) => /excluding GST/.test(n)), 'the result tells the user the figures exclude GST');
});

test('booking revenue (#35): rates outside 0 to 100 are refused, including the rebook and deposit shares', () => {
  for (const change of [{ rebookPct: 101 }, { depositPct: -1 }, { cancelPct: 100.5 }, { noShowPct: -0.1 }]) {
    const r = P.bookingRevenue({ ...bookingBase, bookingsPerWeek: 10, serviceValue: 100, costPerJob: 40, ...change });
    assert.equal(r.ok, false, JSON.stringify(change));
  }
});

test('booking revenue (#35): a current and a scenario week are both computed and the difference is the monthly contribution gap', () => {
  const current = P.bookingRevenue({ ...bookingBase, bookingsPerWeek: 20, serviceValue: 180, costPerJob: 70, noShowPct: 8, cancelPct: 4 });
  const scenario = P.bookingRevenue({ ...bookingBase, bookingsPerWeek: 20, serviceValue: 180, costPerJob: 70, noShowPct: 8, cancelPct: 4, rebookPct: 40, depositPct: 25 });
  const [gap] = P.definitions['booking-revenue'].pair(current, scenario);
  assert.equal(gap.v, Math.round((scenario.headline.v - current.headline.v) * 100) / 100);
  assert.ok(gap.v > 0, 'recovery improves contribution in this fixture');
});

test('travel: zero jobs and zero rates give zero cost and no overrun', () => {
  const r = P.travelRoute(travel);
  assert.equal(r.ok, true);
  assert.equal(r.headline.v, 0);
  assert.equal(summary(r, 'Hours over (+) or under (−) the paid day').v, 0);
});

test('travel: one job means no driving gaps', () => {
  const r = P.travelRoute({ ...travel, jobsPerDay: 1, jobHours: 2, gapKm: 30, gapMinutes: 40, wageRate: 40, vehicleCostPerKm: 1, paidHoursPerDay: 8, daysPerWeek: 5 });
  assert.equal(summary(r, 'Driving distance per day').v, 0);
  assert.equal(r.headline.v, 0);
});

test('travel: daily, weekly and monthly costs add up exactly', () => {
  const r = P.travelRoute({ ...travel, jobsPerDay: 3, jobHours: 2, wageRate: 40, vehicleCostPerKm: 0.85, paidHoursPerDay: 8, daysPerWeek: 5, gapKm: 10, gapMinutes: 20, setupMinutes: 15 });
  const total = cell(r, 'Total travel and route cost');
  assert.equal(total[1].v, 73.67);
  assert.equal(total[2].v, 368.35); // weekly: driver 283.35 + vehicle 85.00
  assert.equal(total[3].v, 1596.18); // monthly: driver 1,227.85 + vehicle 368.33
  assert.equal(
    Math.round((cell(r, 'Driver time for travel and setup')[3].v + cell(r, 'Vehicle cost for distance driven')[3].v) * 100),
    Math.round(total[3].v * 100)
  );
});

test('travel: overrun is flagged when the day needs more hours than paid', () => {
  const r = P.travelRoute({ ...travel, jobsPerDay: 6, jobHours: 2, wageRate: 40, paidHoursPerDay: 8, daysPerWeek: 5, gapMinutes: 60 });
  assert.ok(summary(r, 'Hours over (+) or under (−) the paid day').v > 0);
  assert.match(r.notes.join(' '), /more hours than the paid day/);
});

test('travel: recovered hours are hypothetical and never negative', () => {
  const a = P.travelRoute({ ...travel, jobsPerDay: 3, jobHours: 2, gapKm: 10, gapMinutes: 20, setupMinutes: 15 });
  const b = P.travelRoute({ ...travel, jobsPerDay: 3, jobHours: 2, gapKm: 40, gapMinutes: 90, setupMinutes: 15 });
  const pairs = P.pairTravel(a, b);
  assert.equal(pairs[0].v, 0);
  const better = P.pairTravel(b, a);
  assert.ok(better[0].v > 0);
});

test('travel: rejects a negative wage and out-of-range days', () => {
  assert.equal(P.travelRoute({ ...travel, wageRate: -1 }).ok, false);
  assert.equal(P.travelRoute({ ...travel, daysPerWeek: 8 }).ok, false);
});

// ---- #37 recurring service revenue ------------------------------------------
const recurring = { weeklyClients: 0, fortnightlyClients: 0, monthlyClients: 0, price: 0, variableCost: 0, cancelPct: 0, churnPct: 0, newClients: 0, newFrequency: 'monthly', collectedSamePct: 100, rateChangePct: 0, rateChangeMonth: 0 };

test('recurring: zero clients give zero revenue, including the deferred figure', () => {
  const r = P.recurringRevenue(recurring);
  assert.equal(r.ok, true);
  assert.equal(r.headline.v, 0);
  assert.equal(summary(r, 'Deferred receipts at end of month 12').v, 0);
});

test('recurring: weekly clients use 52 visits a year, spread over 12 months', () => {
  const r = P.recurringRevenue({ ...recurring, weeklyClients: 10, price: 100 });
  assert.equal(r.headline.v, 51999.96); // 10 x 52/12 x 100 x 12
});

test('recurring: 100% churn with new clients leaves only the new clients in month 2 onward', () => {
  const r = P.recurringRevenue({ ...recurring, monthlyClients: 50, price: 10, churnPct: 100, newClients: 3 });
  const rows = r.tables[0].rows;
  assert.equal(rows[0][1].v, 50);
  assert.equal(rows[1][1].v, 3);
  assert.equal(rows[11][1].v, 3);
});

test('recurring: a rate change applies only from the chosen month', () => {
  const r = P.recurringRevenue({ ...recurring, monthlyClients: 1, price: 100, rateChangePct: 10, rateChangeMonth: 7 });
  const rows = r.tables[0].rows;
  assert.equal(rows[5][2].v, 100);
  assert.equal(rows[6][2].v, 110);
});

test('recurring: unpaid share is deferred, not counted as cash received', () => {
  const r = P.recurringRevenue({ ...recurring, monthlyClients: 1, price: 100, collectedSamePct: 50 });
  assert.equal(summary(r, 'Deferred receipts at end of month 12').v, 50);
  assert.equal(r.tables[0].rows[0][6].v, 50); // month 1 cash received is half
});

test('recurring: invalid rate change month and percentages are rejected', () => {
  assert.equal(P.recurringRevenue({ ...recurring, rateChangeMonth: 13 }).ok, false);
  assert.equal(P.recurringRevenue({ ...recurring, churnPct: 101 }).ok, false);
  assert.equal(P.recurringRevenue({ ...recurring, rateChangeMonth: 2.5 }).ok, false);
});

// ---- #38 thirteen-week cash flow ------------------------------------------
const blankWeeks = () => Array.from({ length: 13 }, () => ({ receipts: 0, overdue: 0, wages: 0, suppliers: 0, tax: 0, oneOff: 0 }));

test('cash flow: all zero gives zero close and no gap', () => {
  const r = P.cashFlow({ opening: 0, sensitivityPct: 0, rows: blankWeeks() });
  assert.equal(r.ok, true);
  assert.equal(r.headline.v, 0);
  assert.equal(r.tables[0].rows.length, 13);
});

test('cash flow: must have exactly 13 weeks', () => {
  assert.equal(P.cashFlow({ opening: 0, sensitivityPct: 0, rows: blankWeeks().slice(0, 12) }).ok, false);
});

test('cash flow: negative gap is the lowest close below zero, and the first negative week is reported', () => {
  const rows = blankWeeks();
  rows[0].receipts = 100; rows[0].wages = 50;
  rows[1].wages = 200; // week 2 close = 150 - 200 = -50
  rows[2].receipts = 500;
  const r = P.cashFlow({ opening: 100, sensitivityPct: 0, rows });
  assert.equal(r.headline.v, 50); // week 1 closes at 150, week 2 at -50
  assert.equal(summary(r, 'First week below zero (base case)').v, 'Week 2');
  assert.equal(summary(r, 'Lowest week (base case)').v, 'Week 2');
});

test('cash flow: sensitivity cut applies to money in only and rounds to cents', () => {
  const rows = blankWeeks();
  rows[0].receipts = 0.1; rows[0].overdue = 0.2; // 0.30
  const r = P.cashFlow({ opening: 0, sensitivityPct: 10, rows });
  assert.equal(r.tables[0].rows[0][5].v, 0.27); // 0.30 x 0.9 = 0.27 at cent precision
});

test('cash flow: 100% sensitivity removes all money in', () => {
  const rows = blankWeeks();
  rows[0].receipts = 1000;
  const r = P.cashFlow({ opening: 0, sensitivityPct: 100, rows });
  assert.equal(r.tables[0].rows[0][5].v, 0);
});

test('cash flow: rejects fractions of a cent and negative outgoings', () => {
  const rows = blankWeeks();
  rows[3].wages = 10.005;
  assert.equal(P.cashFlow({ opening: 0, sensitivityPct: 0, rows }).ok, false);
  const rows2 = blankWeeks();
  rows2[3].wages = -5;
  assert.equal(P.cashFlow({ opening: 0, sensitivityPct: 0, rows: rows2 }).ok, false);
});

test('cash flow: a negative opening balance (overdraft) is allowed', () => {
  const r = P.cashFlow({ opening: -300, sensitivityPct: 0, rows: blankWeeks() });
  assert.equal(r.ok, true);
  assert.equal(r.headline.v, 300);
});

// ---- #39 staff utilisation -------------------------------------------------
const row = (over = {}) => ({ role: 'Field', headcount: 0, contractedHours: 0, leaveHours: 0, trainingHours: 0, travelHours: 0, contribPerHour: 0, ...over });

test('staff: zero headcount and zero hours give zero and no utilisation figure', () => {
  const r = P.staffUtilisation({ targetUtilPct: 75, rows: [row(), row(), row()] });
  assert.equal(r.ok, true);
  assert.equal(r.headline.v, null);
  assert.equal(r.summary[0].v, 0);
});

test('staff: utilisation is productive over available, per team', () => {
  const r = P.staffUtilisation({ targetUtilPct: 75, rows: [row({ headcount: 2, contractedHours: 40, leaveHours: 0, trainingHours: 4, travelHours: 6, contribPerHour: 60 })] });
  // available 80, productive 2 x 30 = 60 -> 75%
  assert.equal(r.headline.v, 75);
  assert.equal(r.summary[1].v, 3600);
});

test('staff: leave above contracted hours floors available time at zero', () => {
  const r = P.staffUtilisation({ targetUtilPct: 75, rows: [row({ headcount: 1, contractedHours: 10, leaveHours: 30 })] });
  assert.equal(r.ok, true);
  assert.equal(r.headline.v, null);
  assert.equal(r.summary[0].v, 0);
});

test('staff: training plus travel larger than available time cannot make productive hours negative', () => {
  const r = P.staffUtilisation({ targetUtilPct: 75, rows: [row({ headcount: 1, contractedHours: 10, trainingHours: 8, travelHours: 8 })] });
  assert.equal(r.summary[0].v, 0);
  assert.equal(r.headline.v, 0);
});

test('staff: rejects hours above one week and more than 100% target', () => {
  assert.equal(P.staffUtilisation({ targetUtilPct: 75, rows: [row({ contractedHours: 169 })] }).ok, false);
  assert.equal(P.staffUtilisation({ targetUtilPct: 101, rows: [row()] }).ok, false);
});

test('staff: makes no competency claim from training hours', () => {
  const r = P.staffUtilisation({ targetUtilPct: 75, rows: [row({ headcount: 1, contractedHours: 40, trainingHours: 10 })] });
  assert.match(r.notes.join(' '), /does not infer skills or competence/);
});

test('staff: scenario minus current gives hour, contribution and utilisation differences', () => {
  const current = P.staffUtilisation({ targetUtilPct: 75, rows: [row({ headcount: 2, contractedHours: 40, trainingHours: 4, travelHours: 6, contribPerHour: 60 })] });
  const scenario = P.staffUtilisation({ targetUtilPct: 75, rows: [row({ headcount: 2, contractedHours: 40, trainingHours: 0, travelHours: 6, contribPerHour: 60 })] });
  const diff = P.pairStaff(current, scenario);
  assert.equal(diff[0].v, 8); // 2 people x 4 training hours returned to productive time
  assert.equal(diff[1].v, 480); // 8 hours x A$60
  assert.equal(diff[2].v, 10); // 75% to 85%
});

test('staff: pairing returns nothing when either scenario is refused', () => {
  const ok = P.staffUtilisation({ targetUtilPct: 75, rows: [row({ headcount: 1, contractedHours: 40 })] });
  const bad = P.staffUtilisation({ targetUtilPct: 75, rows: [row({ contractedHours: 500 })] });
  assert.deepEqual(P.pairStaff(ok, bad), []);
});

test('staff: no available hours in one scenario is shown as not available, not zero', () => {
  const none = P.staffUtilisation({ targetUtilPct: 75, rows: [row({ headcount: 1, contractedHours: 0 })] });
  const some = P.staffUtilisation({ targetUtilPct: 75, rows: [row({ headcount: 1, contractedHours: 40 })] });
  assert.equal(typeof P.pairStaff(none, some)[2].v, 'string');
});

test('staff: handoff lists productive hours per person, with zero-headcount teams left out', () => {
  const r = P.staffUtilisation({ targetUtilPct: 75, rows: [row({ role: 'Cleaner', headcount: 3, contractedHours: 38, leaveHours: 2, trainingHours: 3, travelHours: 5 }), row({ role: 'Empty' })] });
  assert.deepEqual(r.handoff, [{ role: 'Cleaner', people: 3, productivePerPerson: 28 }]);
});

// ---- #40 customer response ---------------------------------------------------
const cust = {
  enquiries: 0, sharePhone: 100, shareWeb: 0, shareEmail: 0, avgJobValue: 0, jobVariableCost: 0,
  reachPhone: 0, reachWeb: 0, reachEmail: 0, timelyPct: 100, consentPct: 0, followUps: 0, recoveryPct: 0,
  qualifiedPct: 0, bookPct: 0, completionPct: 100, costPerMessage: 0, touchesPerEnquiry: 0, minutesPerTouch: 0
};

test('customer response: zero enquiries give zero funnel, workload and contribution', () => {
  const r = P.customerResponse(cust);
  assert.equal(r.ok, true);
  assert.equal(r.headline.v, 0);
  assert.equal(r.summary[0].v, 0);
});

test('customer response: channel shares must add up to 100%', () => {
  const r = P.customerResponse({ ...cust, enquiries: 10, sharePhone: 50, shareWeb: 20 });
  assert.equal(r.ok, false);
  assert.match(r.error, /must add up to 100%/);
});

test('customer response: zero consent means no follow-up messages and no recovery', () => {
  const r = P.customerResponse({ ...cust, enquiries: 100, reachPhone: 40, consentPct: 0, followUps: 3, recoveryPct: 50, costPerMessage: 0.1 });
  assert.equal(cell(r, 'Automated follow-up messages')[1].v, 0);
  assert.equal(cell(r, 'Recovered by consented follow-up')[1].v, 0);
});

test('customer response: 100% reach leaves nothing for follow-up to recover', () => {
  const r = P.customerResponse({ ...cust, enquiries: 100, reachPhone: 100, consentPct: 100, followUps: 2, recoveryPct: 100, costPerMessage: 0.1 });
  assert.equal(cell(r, 'Automated follow-up messages')[1].v, 0);
  assert.equal(cell(r, 'Reached by first contact (in window)')[1].v, 100);
});

test('customer response: late first contact does not count as reached', () => {
  const r = P.customerResponse({ ...cust, enquiries: 100, reachPhone: 100, timelyPct: 50 });
  assert.equal(cell(r, 'Reached by first contact (in window)')[1].v, 50);
});

test('customer response: funnel, workload and contribution are reported separately', () => {
  const r = P.customerResponse({ ...cust, enquiries: 100, reachPhone: 50, consentPct: 100, followUps: 2, recoveryPct: 10, qualifiedPct: 50, bookPct: 50, completionPct: 100, avgJobValue: 200, jobVariableCost: 80, costPerMessage: 0.5, touchesPerEnquiry: 2, minutesPerTouch: 6 });
  assert.equal(r.tables.length, 3);
  assert.equal(cell(r, 'Staff hours')[1].v, 20); // 200 touches x 6 minutes
  // unreached 50, consented 50, recovered 5, reached 50 -> leads 55, qualified 27.5, booked 13.75, completed 13.75
  assert.equal(cell(r, 'Completed')[1].v, 13.75);
  // revenue 2,750.00; variable 1,100.00; messages 50 x 2 = 100 x 0.50 = 50.00; contribution 1,600.00
  assert.equal(cell(r, 'Contribution before staff time')[1].v, 1600);
});

test('customer response: pairing reports differences for bookings and staff hours', () => {
  const a = P.customerResponse({ ...cust, enquiries: 100, reachPhone: 50, touchesPerEnquiry: 2, minutesPerTouch: 6, qualifiedPct: 50, bookPct: 50 });
  const b = P.customerResponse({ ...cust, enquiries: 100, reachPhone: 50, touchesPerEnquiry: 1, minutesPerTouch: 6, qualifiedPct: 50, bookPct: 50 });
  const pairs = P.pairCustomer(a, b);
  assert.equal(pairs.length, 2);
  assert.equal(pairs[1].v, -10);
});

test('customer response: opt-out, quiet-hours and Spam Act narrative is shown with every result', () => {
  const r = P.customerResponse({ ...cust, enquiries: 10 });
  const notes = r.notes.join(' ');
  assert.match(notes, /opt-out/);
  assert.match(notes, /quiet hours/);
  assert.match(notes, /Spam Act 2003/);
  assert.match(notes, /No AI benefit is assumed or guaranteed/);
});

test('customer response: extremes are accepted at the limit and refused above it', () => {
  assert.equal(P.customerResponse({ ...cust, enquiries: 1000000 }).ok, true);
  assert.equal(P.customerResponse({ ...cust, enquiries: 1000001 }).ok, false);
  assert.equal(P.customerResponse({ ...cust, enquiries: 10, followUps: 6 }).ok, false);
});

test('customer response: money is rounded to the cent once, with no float drift', () => {
  // 3 completed bookings at A$19.99 less A$0.10 variable cost each = A$59.67; no consent, so no messages
  const r = P.customerResponse({ ...cust, enquiries: 3, reachPhone: 100, consentPct: 0, qualifiedPct: 100, bookPct: 100, avgJobValue: 19.99, jobVariableCost: 0.1, costPerMessage: 0.1 });
  assert.equal(r.summary[0].v, 59.67);
});

// ---- #41 upgrade configurator -----------------------------------------------
const none = { assistant: false, agent: false, supercharged: false, scheduled: false, sorted: false, skilled: false, assistantBand: 'standard', agentBand: 'standard', hoursSavedPerWeek: 0, valuePerHour: 0 };

const catalogue = JSON.parse(readFileSync(new URL('../assets/upgrade-catalogue.json', import.meta.url), 'utf8'));

test('upgrades: AI bands match the approved catalogue, so the planner cannot drift from it', () => {
  const names = Object.keys(catalogue.bands).map((k) => k.toLowerCase()).sort();
  assert.deepEqual(Object.keys(P.AI_BANDS).sort(), names);
  for (const [name, band] of Object.entries(catalogue.bands)) {
    assert.equal(P.AI_BANDS[name.toLowerCase()].assistant, band.assistant, `${name} Assistant`);
    assert.equal(P.AI_BANDS[name.toLowerCase()].agent, band.agentTeam, `${name} Agent Team`);
  }
});

test('upgrades: every app upgrade in the catalogue has no price, so the planner shows request quote', () => {
  const apps = catalogue.upgrades.filter((u) => u.type === 'connected-app');
  assert.equal(apps.length, 4);
  for (const app of apps) assert.equal(app.priceMonthly, null, app.id);
  const r = P.upgradePlan({ ...none, supercharged: true, scheduled: true, sorted: true, skilled: true });
  assert.equal(r.summary[2].v, 4);
});

test('upgrades: extremes are accepted at the limit and refused above it', () => {
  assert.equal(P.upgradePlan({ ...none, hoursSavedPerWeek: 168, valuePerHour: 10000 }).ok, true);
  assert.equal(P.upgradePlan({ ...none, hoursSavedPerWeek: 169 }).ok, false);
  assert.equal(P.upgradePlan({ ...none, valuePerHour: 10000.01 }).ok, false);
});

test('upgrades: scenario value is rounded to the cent once, and zero hours give zero', () => {
  const r = P.upgradePlan({ ...none, hoursSavedPerWeek: 1, valuePerHour: 33.33 });
  assert.equal(r.summary[3].v, 144.43); // 1 x 52/12 x 33.33 = 144.4333, rounded to the cent
  assert.equal(P.upgradePlan({ ...none, valuePerHour: 50 }).summary[3].v, 0);
});

test('upgrades: nothing selected is a free foundation with no fees', () => {
  const r = P.upgradePlan(none);
  assert.equal(r.ok, true);
  assert.equal(r.headline.v, 0);
  assert.equal(r.summary[2].v, 0);
});

test('upgrades: approved AI bands are used exactly, including GST', () => {
  const light = P.upgradePlan({ ...none, assistant: true, assistantBand: 'light' });
  assert.equal(light.headline.v, 19);
  const heavy = P.upgradePlan({ ...none, agent: true, agentBand: 'heavy' });
  assert.equal(heavy.headline.v, 129);
  assert.equal(heavy.summary[0].v, 117.27); // 129 / 1.1 = 117.2727
  assert.equal(heavy.summary[1].v, 11.73);
});

test('upgrades: Agent Team includes the Assistant and does not charge it twice', () => {
  const r = P.upgradePlan({ ...none, assistant: true, agent: true, assistantBand: 'standard', agentBand: 'standard' });
  assert.equal(r.headline.v, 99);
});

test('upgrades: app upgrades show request quote and are never added to the total', () => {
  const r = P.upgradePlan({ ...none, supercharged: true, scheduled: true, sorted: true, skilled: true, assistant: true });
  assert.equal(r.headline.v, 29);
  assert.equal(r.summary[2].v, 4);
  assert.equal(cell(r, 'SkilledAt.Work')[1].v, 'Request quote');
});

test('upgrades: choosing one upgrade does not change another', () => {
  const a = P.upgradePlan({ ...none, sorted: true });
  const b = P.upgradePlan({ ...none, sorted: true, assistant: true });
  assert.equal(a.headline.v, 0);
  assert.equal(b.headline.v, 29);
});

test('upgrades: user scenario value is kept separate from fees and is not an ROI', () => {
  const r = P.upgradePlan({ ...none, assistant: true, hoursSavedPerWeek: 2, valuePerHour: 50 });
  assert.equal(r.headline.v, 29);
  assert.equal(summary(r, 'Your scenario value per month (your figures, not a forecast)').v, 433.33);
  assert.match(r.notes.join(' '), /not a return on investment/);
});

test('upgrades: rejects unknown bands and non-boolean selections', () => {
  assert.equal(P.upgradePlan({ ...none, assistantBand: 'premium' }).ok, false);
  assert.equal(P.upgradePlan({ ...none, sorted: 'yes' }).ok, false);
});

// ---- registry ----------------------------------------------------------------
test('every planner has a definition with a calculation and a unique slug', () => {
  const slugs = Object.keys(P.definitions);
  assert.equal(slugs.length, 8);
  for (const slug of slugs) {
    assert.equal(P.definitions[slug].slug, slug);
    assert.equal(typeof P.definitions[slug].calc, 'function');
  }
});
