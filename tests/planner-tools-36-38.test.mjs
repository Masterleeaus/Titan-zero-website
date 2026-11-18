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
