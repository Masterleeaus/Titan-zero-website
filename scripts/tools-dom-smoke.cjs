// DOM smoke test for the live calculators (#46, #23, #43). Runs the real site scripts in jsdom,
// submits calculator forms and asserts the visible result. Needs jsdom, which is not a repository
// dependency. CI installs it into a temporary folder and passes that folder in JSDOM_DIR:
//   JSDOM_DIR=/path/with/node_modules node scripts/tools-dom-smoke.cjs
// Run from the repository root (or anywhere: paths resolve from this file).
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.SITE_ROOT || path.resolve(__dirname, '..');
const jsdomPath = process.env.JSDOM_DIR ? path.join(process.env.JSDOM_DIR, 'node_modules', 'jsdom') : 'jsdom';
const { JSDOM } = require(jsdomPath);

const failures = [];
let passed = 0;
function check(name, condition, detail = '') {
  if (condition) passed += 1;
  else failures.push(name + (detail ? ' :: ' + detail : ''));
}

// Loads one page, runs only the scripts that page loads, optionally seeds storage, fills fields and submits.
function run(page, { fields = {}, storage = {}, tab = '', submit = true } = {}) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/gi, ''), {
    url: 'https://titanzero.io/' + page.replace(/index\.html$/, '').replace(/^pages\/tool-(.+)\.html$/, 'tools/$1/'),
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.HTMLFormElement.prototype.reportValidity = function reportValidity() { return this.checkValidity(); };
  window.print = () => {};
  window.confirm = () => true;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  const alerts = [];
  window.alert = (message) => alerts.push(String(message));
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, JSON.stringify(value));
  const errors = [];
  for (const script of ['assets/site-data.js', 'assets/site.js', 'assets/tool-calcs.js', 'assets/tools-engine.js', 'assets/tools.js']) {
    const tag = new RegExp('src="/' + script.replace(/[.]/g, '\\.') + '\\?');
    if (!tag.test(html)) continue;
    try { window.eval(fs.readFileSync(path.join(ROOT, script), 'utf8')); } catch (error) { errors.push(script + ': ' + error.message); }
  }
  const doc = window.document;
  const app = doc.querySelector('[data-tools-app]');
  if (app && tab) app.querySelector('[data-tool-tab="' + tab + '"]')?.dispatchEvent(new window.Event('click', { bubbles: true }));
  for (const [id, value] of Object.entries(fields)) {
    const control = doc.getElementById('tool-' + id);
    if (control) control.value = String(value);
  }
  const form = app && app.querySelector('[data-tool-form]');
  let result = '';
  if (form && submit) {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    result = app.querySelector('[data-tool-result]').textContent.replace(/\s+/g, ' ').trim();
  }
  return { result, errors, alerts, window, stored: Object.keys(window.localStorage).sort() };
}

// 0. Job profitability (#26): write-off comes off net revenue once; discount plus write-off above 100% is refused.
{
  const wo = run('pages/tool-job-profitability.html', { fields: { jobRevenue: 650, labour: 220, materials: 110, travel: 45, writeOffPct: 10 } });
  check('profit write-off 10% gives A$210 contribution', /A\$210/.test(wo.result), wo.result.slice(0, 160));
  check('profit scenario row without write-off is shown', /Scenario: contribution with no discount or write-off/.test(wo.result), wo.result.slice(0, 160));
  const over = run('pages/tool-job-profitability.html', { fields: { jobRevenue: 650, labour: 220, materials: 110, travel: 45, discountPct: 60, writeOffPct: 50 } });
  check('profit discount plus write-off above 100% refused', /cannot exceed 100%/.test(over.result), over.result.slice(0, 160));
}

// 0b. Capacity planner (#27): skill coverage halves bookable jobs; zero job duration is refused.
{
  const half = run('pages/tool-capacity-planner.html', { fields: { workers: 4, hours: 30, duration: 2.5, currentJobs: 150, skillPct: 50 } });
  check('capacity 50% skill coverage gives 104 bookable jobs', /104 jobs\/month/.test(half.result), half.result.slice(0, 160));
  const zero = run('pages/tool-capacity-planner.html', { fields: { workers: 4, hours: 30, duration: 0, currentJobs: 150 } });
  // Native validation (min 0.1 hours) stops the submit, so no bookable figure is shown.
  check('capacity zero duration gives no bookable figure', !/jobs\/month/.test(zero.result), zero.result.slice(0, 160));
}

// 1. Break-even: a one-cent contribution with A$1 fixed costs needs 10 jobs, not 11 (#23).
{
  const r = run('pages/tool-break-even.html', { fields: { fixed: 1, price: 100.1, variable: 100 } });
  check('break-even one cent needs 10 jobs', /^Break-even ?10 jobs\/month/.test(r.result), r.result.slice(0, 80));
  check('break-even page loads without script errors', r.errors.length === 0, r.errors.join('; '));
}

// 2. Break-even: zero fixed costs and negative contribution keep their distinct states (#23).
{
  const zero = run('pages/tool-break-even.html', { fields: { fixed: 0, price: 100, variable: 180 } });
  check('zero fixed costs need 0 jobs', /^Break-even ?0 jobs\/month/.test(zero.result), zero.result.slice(0, 80));
  const impossible = run('pages/tool-break-even.html', { fields: { fixed: 12000, price: 100, variable: 180 } });
  check('negative contribution is not achievable', /Break-even ?Not achievable/.test(impossible.result), impossible.result.slice(0, 80));
}

// 3. Validation before results (#42): hours above 168 and money with three decimals are refused.
{
  const hours = run('pages/tool-admin-cost.html', { fields: { adminHours: 200, adminRate: 45 } });
  check('admin hours above 168 refused', /must be between 0 and 168/.test(hours.result), hours.result.slice(0, 120));
  const money = run('pages/tool-job-profitability.html', { fields: { jobRevenue: 650.555, labour: 220, materials: 110, travel: 45 } });
  check('three-decimal money refused', /at most two decimal places/.test(money.result), money.result.slice(0, 120));
}

// 4. Default results on every calculator tab show a number, not a validation error.
for (const [page, tab] of [
  ['pages/tool-admin-cost.html', 'admin'], ['pages/tool-should-i-hire.html', 'hire'], ['pages/tool-break-even.html', 'breakeven'],
  ['pages/tool-job-profitability.html', 'profit'], ['pages/tool-capacity-planner.html', 'capacity'],
  ['pages/tool-missed-calls.html', 'calls'], ['pages/tool-lead-conversion.html', 'leads'], ['pages/tool-invoice-collection.html', 'invoice'],
]) {
  const r = run(page, { tab: tab, fields: {} });
  check('default result shown for ' + tab, /A\$|jobs\/month|Not achievable/.test(r.result) && !/Check your numbers/.test(r.result), r.result.slice(0, 100));
  check('no script errors on ' + tab, r.errors.length === 0, r.errors.join('; '));
}

// 5. Saved profile: V2 migrates to V3, live-only fields survive, V2 copy is removed (#43).
{
  const r = run('pages/tool-admin-cost.html', {
    fields: {},
    storage: { titanBusinessToolProfileV2: { verticals: ['cleaning'], activeVertical: 'cleaning', businessName: 'Acme', adminHours: 12, reclaimPct: 30, evil: 'x' } },
  });
  const v3 = JSON.parse(r.window.localStorage.getItem('titanBusinessToolProfileV3') || 'null');
  check('V2 profile migrated to V3 with schema 3', v3 && v3.schema === 3 && v3.businessName === 'Acme', JSON.stringify(v3).slice(0, 120));
  check('live-only field reclaimPct survives migration', v3 && v3.assumptions.cleaning.reclaimPct === 30, JSON.stringify(v3 && v3.assumptions).slice(0, 160));
  check('unknown legacy key is dropped', v3 && !('evil' in v3.assumptions.cleaning));
  check('V2 copy removed after V3 is saved', !r.stored.includes('titanBusinessToolProfileV2'), r.stored.join(','));
}

// 6. Pages that load tools.js without the engine do nothing and write nothing (#43).
{
  const r = run('tools/free-tools/index.html', { submit: false });
  check('non-calculator page has no script errors', r.errors.length === 0, r.errors.join('; '));
  check('non-calculator page writes no profile', r.stored.length === 0, r.stored.join(','));
}

if (failures.length) {
  console.error('FAIL: ' + failures.length + ' check(s) failed, ' + passed + ' passed');
  for (const f of failures) console.error('- ' + f);
  process.exit(1);
}
console.log('PASS: ' + passed + ' DOM smoke checks on the live calculators');
