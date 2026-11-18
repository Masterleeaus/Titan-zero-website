// Real-browser smoke test for the 19 Titan Zero calculator pages (#46).
// Serves the repository on a local port, opens each published calculator copy in headless
// Chrome at four widths, and checks: no horizontal scrolling, no script errors, labelled fields,
// focus moved to the result after a submit, the print stylesheet, and a storage-quota fallback.
// Needs puppeteer-core (not a repository dependency). CI installs it into a temporary folder:
//   PUPPETEER_DIR=/path/with/node_modules CHROME_PATH=/usr/bin/google-chrome node scripts/tools-browser-smoke.mjs
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const puppeteerDir = process.env.PUPPETEER_DIR;
const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const puppeteerEntry = puppeteerDir
  ? join(puppeteerDir, 'node_modules', 'puppeteer-core', 'lib', 'esm', 'puppeteer', 'puppeteer-core.js')
  : null;
if (!puppeteerEntry || !existsSync(puppeteerEntry)) {
  console.error('FAIL: set PUPPETEER_DIR to a folder with puppeteer-core installed (see the header of this file).');
  process.exit(1);
}
const { default: puppeteer } = await import(pathToFileURL(puppeteerEntry).href);

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(ROOT, path));
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const BASE = 'http://127.0.0.1:' + server.address().port;

// Every published calculator copy (clean URLs), from the source list.
const slugs = readdirSync(join(ROOT, 'pages')).filter((f) => /^tool-.*\.html$/.test(f)).map((f) => f.replace(/^tool-/, '').replace(/\.html$/, ''));
// The calculators that take input and show a result on submit.
const submitForms = {
  'admin-cost': '[data-tool-form]', 'should-i-hire': '[data-tool-form]', 'break-even': '[data-tool-form]',
  'job-profitability': '[data-tool-form]', 'capacity-planner': '[data-tool-form]', 'missed-calls': '[data-tool-form]',
  'lead-conversion': '[data-tool-form]', 'invoice-collection': '[data-tool-form]', 'job-cost-sheet': '[data-job-cost-form]',
};
const WIDTHS = [[320, 640], [390, 844], [768, 1024], [1280, 800]];
const failures = [];
let passed = 0;
const check = (name, ok, detail = '') => { if (ok) passed += 1; else failures.push(name + (detail ? ' :: ' + detail : '')); };

const browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
try {
  for (const [width, height] of WIDTHS) {
    for (const slug of slugs) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.goto(BASE + '/tools/' + slug + '/', { waitUntil: 'load' });
      // Use a wide sans-serif face, so widths match the wider fallback fonts on CI runners.
      await page.addStyleTag({ content: '*{font-family:"DejaVu Sans",sans-serif !important}' });
      const label = slug + ' @' + width;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('no horizontal scroll: ' + label, overflow <= 1, 'overflow ' + overflow + 'px');
      const unlabelled = await page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]),select,textarea')]
        .filter((el) => el.offsetParent !== null && !(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))
        .map((el) => el.name || el.id || el.tagName));
      check('every visible field has a label: ' + label, unlabelled.length === 0, unlabelled.join(', '));
      if (submitForms[slug] && width === 390) {
        const selector = submitForms[slug];
        const resultSelector = slug === 'job-cost-sheet' ? '[data-job-cost-result]' : '[data-tool-result]';
        await page.click(selector + ' button[type=submit]');
        await page.waitForFunction((sel) => { const el = document.querySelector(sel); return el && el.textContent.trim().length > 40; }, { timeout: 5000 }, resultSelector).catch(() => {});
        const focusedOnResult = await page.evaluate((sel) => { const el = document.querySelector(sel); return !!el && document.activeElement === el; }, resultSelector);
        check('focus moves to the result after submit: ' + slug, focusedOnResult);
        const text = await page.$eval(resultSelector, (el) => el.textContent);
        check('result is shown after submit: ' + slug, !/Check your numbers/.test(text) && text.length > 40, text.slice(0, 80));
      }
      check('no script errors: ' + label, errors.length === 0, errors.join('; ').slice(0, 300));
      await page.close();
    }
  }

  // Tool directory (#45): fits every width, keyword search narrows the list, and the full list works without JavaScript.
  for (const [width, height] of WIDTHS) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(BASE + '/tools/', { waitUntil: 'load' });
    await page.addStyleTag({ content: '*{font-family:"DejaVu Sans",sans-serif !important}' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('directory: no horizontal scroll @' + width, overflow <= 1, 'overflow ' + overflow + 'px');
    if (width === 390) {
      const total = await page.$$eval('article[data-tool]', (els) => els.length);
      check('directory lists 27 tools', total === 27, String(total));
      await page.type('#tool-search-input', 'quote');
      await page.waitForFunction(() => /match/.test(document.querySelector('[data-tool-status]').textContent), { timeout: 3000 }).catch(() => {});
      const shown = await page.$$eval('article[data-tool]', (els) => els.filter((el) => !el.hidden).length);
      const status = await page.$eval('[data-tool-status]', (el) => el.textContent);
      check('keyword search narrows the directory', shown >= 1 && shown < total, shown + ' shown, status: ' + status);
      check('search status is announced politely', await page.$eval('[data-tool-status]', (el) => el.getAttribute('aria-live') === 'polite'));
    }
    check('no script errors on directory @' + width, errors.length === 0, errors.join('; ').slice(0, 300));
    await page.close();
  }
  {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(BASE + '/tools/', { waitUntil: 'load' });
    const listed = await page.$$eval('article[data-tool]', (els) => els.filter((el) => !el.hidden).length);
    const links = await page.$$eval('article[data-tool] a[href^="/tools/"]', (els) => new Set(els.map((el) => el.getAttribute('href'))).size);
    check('without JavaScript all 27 tools are listed', listed === 27, String(listed));
    check('without JavaScript each Titan calculator has a link', links >= 19, String(links));
    await page.close();
  }

  // Print/PDF: header and footer are hidden, the result stays visible.
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1000 });
    await page.goto(BASE + '/tools/admin-cost/', { waitUntil: 'load' });
    await page.emulateMediaType('print');
    const hidden = await page.evaluate(() => ['.site-header', '.site-footer'].map((sel) => getComputedStyle(document.querySelector(sel)).display === 'none'));
    check('print hides site header and footer', hidden.every(Boolean), JSON.stringify(hidden));
    await page.close();
  }

  // Storage quota: a full localStorage must not stop the calculator from showing a result.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluateOnNewDocument(() => {
      Storage.prototype.setItem = function quotaFull() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
    });
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(BASE + '/tools/admin-cost/', { waitUntil: 'load' });
    await page.click('[data-tool-form] button[type=submit]');
    await page.waitForFunction(() => document.querySelector('[data-tool-result]').textContent.includes('Calculation'), { timeout: 5000 }).catch(() => {});
    const shown = await page.$eval('[data-tool-result]', (el) => el.textContent.includes('Calculation'));
    check('result still shows when storage is full', shown);
    check('no script errors when storage is full', errors.length === 0, errors.join('; '));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error('FAIL: ' + failures.length + ' check(s) failed, ' + passed + ' passed');
  for (const f of failures) console.error('- ' + f);
  process.exit(1);
}
console.log('PASS: ' + passed + ' browser checks on ' + slugs.length + ' calculator pages and the tool directory at ' + WIDTHS.length + ' widths');
