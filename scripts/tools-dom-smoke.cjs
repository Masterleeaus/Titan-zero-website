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
  for (const script of ['assets/site-data.js', 'assets/site.js', 'assets/tools-engine.js', 'assets/tools.js']) {
    const tag = new RegExp('src="/' + script.replace(/[.]/g, '\\.') + '\\?');
    if (!tag.test(html)) continue;
    try { window.eval(fs.readFileSync(path.join(ROOT, script), 'utf8')); } catch (error) { errors.push(script + ': ' + error.message); }
  }
  const doc = window.document;
  const app = doc.querySelector('[data-tools-app]');
  if (app && tab) app.querySelector('[data-tool-tab="' + tab + '"]')?.dispatchEvent(new window.Event('click', { bubbles: true }));
  for (const [id, value] of Object.entries(fields)) {
    const control = doc.getElementById('tool-' + id);
    if (control) {
      control.value = String(value);
      // Fire change as a user would, so mode-dependent fields are shown or hidden (#29).
      control.dispatchEvent(new window.Event('change', { bubbles: true }));
    }
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

// 0c. Missed enquiries (#28): default opportunity is unchanged; recovery above likely conversion and
// SMS plus email above 100% are refused.
{
  const base = run('pages/tool-missed-calls.html', { fields: { calls: 120, missed: 12, convert: 30, jobValue: 350 } });
  check('missed default opportunity is A$1,512', /A\$1,512/.test(base.result), base.result.slice(0, 160));
  const recovery = run('pages/tool-missed-calls.html', { fields: { calls: 120, missed: 12, convert: 30, jobValue: 350, recoveryPct: 50 } });
  check('missed recovery above likely conversion refused', /cannot be higher than likely conversion/.test(recovery.result), recovery.result.slice(0, 160));
  const channels = run('pages/tool-missed-calls.html', { fields: { calls: 120, missed: 12, convert: 30, jobValue: 350, smsPct: 70, emailPct: 40 } });
  check('missed SMS plus email above 100% refused', /cannot add up to more than 100%/.test(channels.result), channels.result.slice(0, 160));
}

// 0d. Lead conversion (#29): simple mode uses one rate per response; funnel mode is the default.
{
  const simple = run('pages/tool-lead-conversion.html', { fields: { mode: 'simple', leads: 200, value: 400, contribPct: 50, simpleBase: 20, simpleAlt: 25 } });
  check('lead simple mode gives A$4,000 revenue difference', /A\$4,000/.test(simple.result), simple.result.slice(0, 160));
  const funnel = run('pages/tool-lead-conversion.html', { fields: {} });
  // Defaults come from the industry profile, so only the funnel result shape is asserted here.
  check('lead funnel default shows stage-based result', /Scenario revenue difference\/month/.test(funnel.result) && /Baseline lead-to-completed rate/.test(funnel.result), funnel.result.slice(0, 160));
  const bad = run('pages/tool-lead-conversion.html', { fields: { mode: 'simple', simpleBase: 120, simpleAlt: 25 } });
  // The input's max of 100 stops the submit, so no revenue difference is shown.
  check('lead simple rate above 100% gives no result', !/Scenario revenue difference/.test(bad.result), bad.result.slice(0, 160));
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

// 3b. Live funnel and ageing forms (#105): the shared rules refuse one input on each page.
// The values pass the browser's own min/max checks, so the engine is what refuses them.
{
  const leads = run('pages/tool-lead-conversion.html', { tab: 'leads', fields: { leads: 2000000 } });
  check('lead conversion refuses a lead count above the engine limit', /Leads per month must be between 0 and 1000000/.test(leads.result), leads.result.slice(0, 120));
  const invoice = run('pages/tool-invoice-collection.html', { tab: 'invoice', fields: { avg: 0.005 } });
  check('invoice collection refuses an average with three decimals', /Average invoice can have at most two decimal places/.test(invoice.result), invoice.result.slice(0, 120));
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

// 9. Job-cost sheet to quote builder (#106): the send button carries the price only. Business and
// service text typed into the job-cost form must not reach storage or the quote line.
function openPage(page, url, storage = {}) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/gi, ''), { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.HTMLFormElement.prototype.reportValidity = function reportValidity() { return this.checkValidity(); };
  window.print = () => {};
  window.confirm = () => true;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value);
  for (const script of ['assets/site-data.js', 'assets/site.js', 'assets/tools-engine.js', 'assets/tools.js']) {
    const tag = new RegExp('src="/' + script.replace(/[.]/g, '\\.') + '\\?');
    if (tag.test(html)) window.eval(fs.readFileSync(path.join(ROOT, script), 'utf8'));
  }
  return window;
}
{
  const jobWindow = openPage('pages/tool-job-cost-sheet.html', 'https://titanzero.io/tools/job-cost-sheet/');
  const doc = jobWindow.document;
  doc.querySelector('[name=business]').value = 'PRIVATE-BUSINESS';
  doc.querySelector('[name=service]').value = 'PRIVATE-SERVICE';
  doc.querySelector('[name=price]').value = '300';
  doc.querySelector('[data-job-cost-form]').dispatchEvent(new jobWindow.Event('submit', { bubbles: true, cancelable: true }));
  const send = [...doc.querySelectorAll('button')].find((b) => b.textContent === 'Send price to the quote builder');
  check('job-cost result offers a send button', Boolean(send));
  send?.dispatchEvent(new jobWindow.Event('click', { bubbles: true }));
  const transfer = jobWindow.localStorage.getItem('titanQuoteTransferV1') || '';
  check('transfer holds the ex-GST price', /"unitPrice":300/.test(transfer), transfer.slice(0, 160));
  check('transfer holds no business or service text', !/PRIVATE/.test(transfer), transfer.slice(0, 160));

  const quoteWindow = openPage('pages/tool-quote-builder.html', 'https://titanzero.io/tools/quote-builder/', { titanQuoteTransferV1: transfer });
  const priceInput = quoteWindow.document.querySelector('[data-quote-lines] [name=line-price]');
  check('quote builder adds the sent price as a line', Boolean(priceInput) && priceInput.value === '300', priceInput ? priceInput.value : 'no line');
  check('quote builder reads the transfer once', quoteWindow.localStorage.getItem('titanQuoteTransferV1') === null);
}

// 10. Assumptions file (#106): the download button reports the numbers it saved.
{
  const r = run('pages/tool-admin-cost.html', { fields: { adminHours: 12 } });
  const exportWindow = r.window;
  exportWindow.URL.createObjectURL = () => 'blob:titan-test';
  exportWindow.URL.revokeObjectURL = () => {};
  let downloaded = '';
  exportWindow.HTMLAnchorElement.prototype.click = function click() { downloaded = this.download; };
  const exportButton = exportWindow.document.querySelector('.assumptions-tools button');
  check('assumptions file has a download button', Boolean(exportButton));
  exportButton?.dispatchEvent(new exportWindow.Event('click', { bubbles: true }));
  const status = exportWindow.document.querySelector('.assumptions-tools [role=status]')?.textContent || '';
  check('download reports the saved values', /Downloaded \d+ saved values for/.test(status), status);
  check('download file is named for the service type', downloaded === 'titan-tool-assumptions-cleaning.json', downloaded);
}

// 7. Checklist generator (#33): drafts persist across a reload, a corrupt draft falls back to the
// template, the text download is local, and markup typed into a task stays plain text.
function runChecklist(rawDraft = null) {
  const page = 'pages/tool-checklist-generator.html';
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/gi, ''), {
    url: 'https://titanzero.io/tools/checklist-generator/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.print = () => {};
  window.confirm = () => true;
  window.alert = () => {};
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  window.URL.createObjectURL = () => 'blob:checklist-test';
  window.URL.revokeObjectURL = () => {};
  if (rawDraft !== null) window.localStorage.setItem('titanChecklistDraftV1', rawDraft);
  const errors = [];
  for (const script of ['assets/site-data.js', 'assets/site.js', 'assets/tools-engine.js', 'assets/tools.js']) {
    const tag = new RegExp('src="/' + script.replace(/[.]/g, '\\.') + '\\?');
    if (!tag.test(html)) continue;
    try { window.eval(fs.readFileSync(path.join(ROOT, script), 'utf8')); } catch (error) { errors.push(script + ': ' + error.message); }
  }
  return { window, doc: window.document, errors };
}

{
  const r = runChecklist();
  const select = r.doc.querySelector('[data-checklist-vertical]');
  const values = [...select.options].map((o) => o.value);
  check('checklist: eleven service types are offered, including painting and decorating', values.length === 11 && values.includes('painting-decorating'), values.join(','));
  check('checklist: page loads without script errors', r.errors.length === 0, r.errors.join('; '));
  check('checklist: export button is present', Boolean(r.doc.querySelector('[data-export-checklist]')));
}

{
  const r = runChecklist();
  const first = r.doc.querySelector('[data-generated-checklist] input[type="checkbox"]');
  first.checked = true;
  first.dispatchEvent(new r.window.Event('change', { bubbles: true }));
  const again = runChecklist(r.window.localStorage.getItem('titanChecklistDraftV1'));
  const restored = again.doc.querySelector('[data-generated-checklist] input[type="checkbox"]');
  check('checklist: a tick survives a reload from the saved draft', restored.checked === true);
  check('checklist: progress says one task is done after reload', /1 of \d+ tasks done/.test(again.doc.querySelector('[data-checklist-progress]').textContent));
}

{
  const r = runChecklist('{not json');
  const items = r.doc.querySelectorAll('[data-generated-checklist] li');
  check('checklist: a corrupt draft falls back to the cleaning template without errors', items.length > 0 && r.errors.length === 0, r.errors.join('; '));
}

{
  const r = runChecklist();
  const input = r.doc.querySelector('[data-custom-checklist-task]');
  input.value = '<img src=x onerror="alert(1)">';
  r.doc.querySelector('[data-add-checklist-task]').dispatchEvent(new r.window.Event('click', { bubbles: true }));
  const list = r.doc.querySelector('[data-generated-checklist]');
  check('checklist: markup typed into a task is shown as text, not as an element', list.querySelector('img') === null && list.textContent.includes('<img src=x'));
}

{
  const r = runChecklist();
  let downloaded = null;
  r.window.HTMLAnchorElement.prototype.click = function click() { downloaded = { name: this.download, href: this.href }; };
  r.doc.querySelector('[data-export-checklist]').dispatchEvent(new r.window.Event('click', { bubbles: true }));
  check('checklist: text download is named after the service type', downloaded !== null && downloaded.name === 'cleaning-checklist.txt', JSON.stringify(downloaded));
  check('checklist: download is announced as made in this browser', /not uploaded/.test(r.doc.querySelector('[data-checklist-progress]').textContent));
}

// 11. Storage failure (#107): a refused write is reported in the result, not hidden.
{
  const r = openPage('pages/tool-admin-cost.html', 'https://titanzero.io/tools/admin-cost/');
  r.Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
  r.document.querySelector('[data-tool-form]').dispatchEvent(new r.Event('submit', { bubbles: true, cancelable: true }));
  const shown = r.document.querySelector('[data-tool-result]').textContent;
  check('admin cost shows a result when storage is refused', /A\$/.test(shown), shown.slice(0, 80));
  check('storage refusal is reported in the result', /would not save your assumptions/.test(shown), shown.slice(-160));
}

// 12. Clear control (#107): the profile and the quote store are removed, and nothing is written back.
{
  const r = openPage('pages/tool-admin-cost.html', 'https://titanzero.io/tools/admin-cost/', {
    titanBusinessToolProfileV3: JSON.stringify({ schema: 3, verticals: ['cleaning'], activeVertical: 'cleaning', businessName: 'PRIVATE-BUSINESS', serviceName: '', assumptions: { cleaning: { adminHours: 12 } } }),
    titanBusinessToolProfileV2: JSON.stringify({ verticals: ['cleaning'], businessName: 'PRIVATE-BUSINESS' }),
    titanQuotesV1: JSON.stringify({ quotes: [{ reference: 'Q-1', customer: 'PRIVATE-CUSTOMER' }] }),
  });
  r.document.querySelector('[data-clear-profile]').dispatchEvent(new r.Event('click', { bubbles: true }));
  check('clear removes the V3 profile', r.localStorage.getItem('titanBusinessToolProfileV3') === null);
  check('clear removes the V2 profile', r.localStorage.getItem('titanBusinessToolProfileV2') === null);
  check('clear removes the quote store', r.localStorage.getItem('titanQuotesV1') === null);
}

// 8. Service pricing to Quote Builder and Job Cost Sheet (#34). Figures are saved only after a click,
// stay in this browser, are offered only when valid, and are applied only after a second click.
function loadPage(page, rawStorage = {}, scripts = ['assets/site-data.js', 'assets/site.js', 'assets/planner-calcs.js', 'assets/planner-ui.js', 'assets/tools-engine.js', 'assets/tools.js']) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/gi, ''), {
    url: 'https://titanzero.io/tools/x/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.print = () => {};
  window.confirm = () => true;
  window.alert = () => {};
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  window.URL.createObjectURL = () => 'blob:handoff-test';
  window.URL.revokeObjectURL = () => {};
  for (const [key, raw] of Object.entries(rawStorage)) window.localStorage.setItem(key, raw);
  const errors = [];
  for (const script of scripts) {
    const tag = new RegExp('src="/' + script.replace(/[.]/g, '\\.') + '\\?');
    if (!tag.test(html)) continue;
    try { window.eval(fs.readFileSync(path.join(ROOT, script), 'utf8')); } catch (error) { errors.push(script + ': ' + error.message); }
  }
  return { window, doc: window.document, errors };
}

const pricingInputs = { role: 'Technician', labourHours: 2, labourRate: 45, materials: 20.5, travel: 10, equipment: 5, overhead: 12.25, contingencyPct: 10, targetMarginPct: 30, discountPct: 0, gst: 'no' };
{
  const r = loadPage('pages/tool-service-pricing.html');
  const form = r.doc.querySelector('[data-planner-form]');
  for (const [key, value] of Object.entries(pricingInputs)) {
    const control = form.elements.namedItem(key);
    if (control) control.value = String(value);
  }
  form.dispatchEvent(new r.window.Event('submit', { bubbles: true, cancelable: true }));
  const saveButton = [...r.doc.querySelectorAll('[data-planner-result] button')].find((b) => /Save these figures/.test(b.textContent));
  check('pricing: save button is a native button after a calculation', Boolean(saveButton) && saveButton.disabled === false);
  check('pricing: nothing is saved before the click', r.window.localStorage.getItem('titanPricingHandoffV1') === null);
  saveButton.dispatchEvent(new r.window.Event('click', { bubbles: true }));
  const saved = JSON.parse(r.window.localStorage.getItem('titanPricingHandoffV1') || 'null');
  check('pricing: saved target price is the cent-rounded ex-GST figure (A$214.72)', saved && saved.targetPrice === 214.72, JSON.stringify(saved));
  check('pricing: saved role and overhead are the entered values', saved && saved.role === 'Technician' && saved.overhead === 12.25, JSON.stringify(saved));
  check('pricing: no tabindex above zero on the planner page', ![...r.doc.querySelectorAll('[tabindex]')].some((el) => Number(el.getAttribute('tabindex')) > 0));
  check('pricing: no script errors on the planner page', r.errors.length === 0, r.errors.join('; '));
}

{
  const r = loadPage('pages/tool-service-pricing.html');
  const form = r.doc.querySelector('[data-planner-form]');
  for (const [key, value] of Object.entries({ ...pricingInputs, targetMarginPct: 100 })) {
    const control = form.elements.namedItem(key);
    if (control) control.value = String(value);
  }
  form.dispatchEvent(new r.window.Event('submit', { bubbles: true, cancelable: true }));
  const saveButton = [...r.doc.querySelectorAll('[data-planner-result] button')].find((b) => /Save these figures/.test(b.textContent));
  check('pricing: at a 100% target margin the save button is disabled, never saving Infinity', Boolean(saveButton) && saveButton.disabled === true);
}

{
  const saved = JSON.stringify({ role: 'Technician', labourHours: 2, labourRate: 45, materials: 20.5, travel: 10, equipment: 5, overhead: 12.25, contingencyPct: 10, targetMarginPct: 30, targetPrice: 214.72 });
  const r = loadPage('pages/tool-quote-builder.html', { titanPricingHandoffV1: saved });
  const box = r.doc.querySelector('[data-pricing-handoff]');
  check('quote: the saved figures are offered on the quote page', box && box.hidden === false);
  const lineBefore = r.doc.querySelectorAll('[data-quote-lines] .quote-line-row').length;
  box.querySelector('button').dispatchEvent(new r.window.Event('click', { bubbles: true }));
  const price = r.doc.querySelector('[data-quote-lines] input[name="line-price"]');
  check('quote: applying the figures sets one line at the saved ex-GST price', price && price.value === '214.72' && r.doc.querySelectorAll('[data-quote-lines] .quote-line-row').length === 1 && lineBefore >= 1, price && price.value);
  check('quote: applying the figures switches the quote to prices excluding GST', r.doc.querySelector('select[name="taxMode"]').value === 'exclusive');
  check('quote: no script errors on the quote page', r.errors.length === 0, r.errors.join('; '));
}

{
  const saved = JSON.stringify({ role: 'Technician', labourHours: 2, labourRate: 45, materials: 20.5, travel: 10, equipment: 5, overhead: 12.25, contingencyPct: 10, targetMarginPct: 30, targetPrice: 214.72 });
  const r = loadPage('pages/tool-job-cost-sheet.html', { titanPricingHandoffV1: saved });
  r.doc.querySelector('[data-pricing-handoff] button').dispatchEvent(new r.window.Event('click', { bubbles: true }));
  const hours = r.doc.querySelector('[data-job-roles] input[name="role-hours"]');
  const rate = r.doc.querySelector('[data-job-roles] input[name="role-rate"]');
  check('job cost: applying the figures sets labour hours and rate', hours && hours.value === '2' && rate && rate.value === '45');
  check('job cost: applying the figures sets the price and target margin', r.doc.querySelector('[name="price"]').value === '214.72' && r.doc.querySelector('[name="target"]').value === '30');
  check('job cost: applying the figures sets overhead and materials', r.doc.querySelector('[name="overhead"]').value === '12.25' && r.doc.querySelector('[name="materials"]').value === '20.5');
}

{
  const r = loadPage('pages/tool-quote-builder.html', { titanPricingHandoffV1: '{corrupt' });
  check('quote: a corrupt save is not offered', r.doc.querySelector('[data-pricing-handoff]').hidden === true);
  check('quote: a corrupt save does not throw', r.errors.length === 0, r.errors.join('; '));
}

// 9. Booking revenue (#35): the side-by-side comparison renders both weeks and the monthly gap, with no GST added.
{
  const page = loadPage('pages/tool-booking-revenue.html');
  const form = page.doc.querySelector('[data-planner-form]');
  const set = (name, prefix, value) => {
    const control = form.querySelector('[name="' + name + '"][data-prefix="' + prefix + '"]');
    if (control) control.value = String(value);
  };
  for (const [name, value] of [['bookingsPerWeek', 20], ['serviceValue', 180], ['costPerJob', 70]]) set(name, 's', value);
  for (const prefix of ['a', 'b']) {
    set('noShowPct', prefix, 8);
    set('cancelPct', prefix, 4);
  }
  set('rebookPct', 'b', 40);
  set('depositPct', 'b', 25);
  form.dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  const result = page.doc.querySelector('[data-planner-result]').textContent.replace(/\s+/g, ' ');
  check('booking: the comparison shows the difference section', /Difference between the two scenarios/.test(result), result.slice(0, 200));
  check('booking: the scenario week shows cash of A$3,405.60', /3,405\.60/.test(result), result.slice(0, 400));
  check('booking: the monthly gap is A$738.40 (9,127.73 less 8,389.33)', /Monthly contribution difference[^]*?738\.40/.test(result), result.slice(0, 400));
  check('booking: the page says no GST is added', /excluding GST/.test(result));
  check('booking: no script errors on the booking page', page.errors.length === 0, page.errors.join('; '));
}

if (failures.length) {
  console.error('FAIL: ' + failures.length + ' check(s) failed, ' + passed + ' passed');
  for (const f of failures) console.error('- ' + f);
  process.exit(1);
}
console.log('PASS: ' + passed + ' DOM smoke checks on the live calculators');
