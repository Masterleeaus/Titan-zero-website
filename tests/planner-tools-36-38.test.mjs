// Tests for issues #36-#38 (travel and route cost, recurring revenue, 13-week cash flow).
// Pure calculation tests plus static checks on the published source pages.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const P = require('../assets/planner-calcs.js');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = (name) => readFileSync(join(ROOT, 'pages', name), 'utf8');
const cell = (result, label) => {
  for (const t of result.tables) {
    const row = t.rows.find((r) => r[0] === label);
    if (row) return row;
  }
  throw new Error(`row not found: ${label}`);
};

// ---- #36 travel and route cost ---------------------------------------------
const travel = { jobsPerDay: 0, jobHours: 0, wageRate: 0, vehicleCostPerKm: 0, paidHoursPerDay: 0, daysPerWeek: 0, gapKm: 0, gapMinutes: 0, setupMinutes: 0 };

test('travel: extreme inputs stay finite and inside the validation limits', () => {
  const r = P.travelRoute({ jobsPerDay: 500, jobHours: 24, wageRate: 10000, vehicleCostPerKm: 100, paidHoursPerDay: 24, daysPerWeek: 7, gapKm: 1000, gapMinutes: 600, setupMinutes: 240 });
  assert.equal(r.ok, true);
  assert.ok(Number.isFinite(r.headline.v));
  assert.ok(r.headline.v > 0);
});

test('travel: out-of-range jobs and minutes are rejected', () => {
  assert.equal(P.travelRoute({ ...travel, jobsPerDay: 501 }).ok, false);
  assert.equal(P.travelRoute({ ...travel, gapMinutes: 601 }).ok, false);
  assert.equal(P.travelRoute({ ...travel, setupMinutes: -5 }).ok, false);
});

test('travel: rounding to the cent on a one-day figure', () => {
  // One gap of 10 minutes at $10/hour is $1.6667, which rounds to $1.67 for the day.
  const r = P.travelRoute({ ...travel, jobsPerDay: 2, jobHours: 1, wageRate: 10, paidHoursPerDay: 8, daysPerWeek: 1, gapMinutes: 10 });
  assert.equal(cell(r, 'Driver time for travel and setup')[1].v, 1.67);
  assert.equal(cell(r, 'Total travel and route cost')[1].v, 1.67);
});

test('travel: a single job with no driving gives no vehicle cost, however high the rate', () => {
  const r = P.travelRoute({ ...travel, jobsPerDay: 1, jobHours: 3, vehicleCostPerKm: 100, gapKm: 999, wageRate: 0, paidHoursPerDay: 8, daysPerWeek: 5 });
  assert.equal(cell(r, 'Vehicle cost for distance driven')[1].v, 0);
});

test('travel: the planner page links the capacity planner and the optional SortedAt.Work step', () => {
  const html = page('tool-travel-route-cost.html');
  assert.match(html, /href="\/tools\/capacity-planner\/"/);
  assert.match(html, /href="\/apps\/field\/"[^>]*>SortedAt\.Work</);
  assert.match(html, /Optional next steps, not required purchases/);
  assert.doesNotMatch(html, /optimised|optimized route|route optimi[sz]ation (is|has been) (done|applied)/i);
});
// ---- #37 recurring service revenue and retention ---------------------------
const recurring = { weeklyClients: 0, fortnightlyClients: 0, monthlyClients: 0, price: 0, variableCost: 0, cancelPct: 0, churnPct: 0, newClients: 0, newFrequency: 'monthly', collectedSamePct: 100, rateChangePct: 0, rateChangeMonth: 0 };

test('recurring: weekly, fortnightly and monthly clients are priced together by visit count', () => {
  const r = P.recurringRevenue({ ...recurring, weeklyClients: 10, monthlyClients: 5, price: 100 });
  assert.equal(r.tables[0].rows[0][3].v, 4833.33); // (10 x 52/12 + 5 x 12/12) x 100
  const f = P.recurringRevenue({ ...recurring, fortnightlyClients: 6, price: 50 });
  assert.equal(f.tables[0].rows[0][3].v, 650); // 6 x 26/12 x 50
});

test('recurring: cancellations reduce fulfilled revenue but not gross contract value', () => {
  const r = P.recurringRevenue({ ...recurring, weeklyClients: 10, price: 100, cancelPct: 25 });
  const row = r.tables[0].rows[0];
  assert.equal(row[3].v, 4333.33);
  assert.equal(row[4].v, 3250);
});

test('recurring: contribution is fulfilled revenue less variable delivery cost', () => {
  const r = P.recurringRevenue({ ...recurring, weeklyClients: 10, price: 100, variableCost: 40 });
  assert.equal(r.tables[0].rows[0][5].v, 2600);
});

test('recurring: churn is applied to each contract type at the same rate', () => {
  const r = P.recurringRevenue({ ...recurring, weeklyClients: 100, monthlyClients: 100, churnPct: 50 });
  assert.equal(r.tables[0].rows[1][1].v, 100); // 50 + 50
  assert.equal(r.tables[0].rows[2][1].v, 50); // 25 + 25
});

test('recurring: new clients join only the contract type chosen', () => {
  const r = P.recurringRevenue({ ...recurring, newClients: 4, newFrequency: 'weekly', price: 10 });
  const rows = r.tables[0].rows;
  assert.equal(rows[0][1].v, 0);
  assert.equal(rows[1][1].v, 4);
  assert.equal(rows[11][1].v, 44);
  assert.equal(rows[1][3].v, 173.33); // 4 weekly clients x 52/12 x $10
});

test('recurring: a new-client contract type outside the list is rejected', () => {
  assert.equal(P.recurringRevenue({ ...recurring, newFrequency: 'daily' }).ok, false);
});

test('recurring: maximum client numbers and price stay finite', () => {
  const r = P.recurringRevenue({ ...recurring, weeklyClients: 100000, fortnightlyClients: 100000, monthlyClients: 100000, price: 99999.99, newClients: 10000, newFrequency: 'weekly' });
  assert.equal(r.ok, true);
  assert.ok(Number.isFinite(r.headline.v));
});

test('recurring: the planner page names Front Desk Free and SortedAt.Work as optional steps', () => {
  const html = page('tool-recurring-service-revenue.html');
  assert.match(html, /href="\/frontdesk\/"/);
  assert.match(html, /href="\/apps\/field\/"/);
  assert.match(html, /Optional next steps, not required purchases/);
  assert.match(html, /Front Desk Free/);
});
