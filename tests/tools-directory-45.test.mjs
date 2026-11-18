// Tests for the redesigned tool directory (#45): data and card consistency, the upgrade block
// against the approved catalogue, neutral copy, keyboard anchors, and canonical/sitemap coverage.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8');
const page = read('pages/tools.html');
const siteData = JSON.parse(read('assets/site-data.js').slice('window.TITAN_SITE_CONTENT='.length).replace(/;\s*$/, ''));
const catalogue = JSON.parse(read('assets/upgrade-catalogue.json'));
const calcs = siteData.calculators;
const slugs = calcs.map((c) => c.slug);
const cardFor = (slug) => {
  const m = page.match(new RegExp('<article class="hub-tool-card tool-entry" id="tool-' + slug + '"[\\s\\S]*?</article>'));
  return m ? m[0] : null;
};

test('site data holds the 19 Titan Zero calculators, each once, each with a directory card', () => {
  assert.equal(calcs.length, 19);
  assert.equal(new Set(slugs).size, 19);
  for (const slug of slugs) {
    assert.ok(cardFor(slug), 'no directory card for ' + slug);
    assert.ok(existsSync(new URL('tools/' + slug + '/index.html', root)), 'no published copy for ' + slug);
  }
});

test('every related tool is another Titan calculator in the directory (two each, no self links)', () => {
  for (const calc of calcs) {
    assert.equal(calc.related.length, 2, calc.slug);
    assert.ok(!calc.related.includes(calc.slug), calc.slug + ' links to itself');
    for (const target of calc.related) assert.ok(slugs.includes(target), calc.slug + ' -> unknown ' + target);
  }
});

test('each Titan card shows exactly the next tools its site data lists', () => {
  for (const calc of calcs) {
    const card = cardFor(calc.slug);
    const next = card.match(/<p class="tool-next">([\s\S]*?)<\/p>/);
    assert.ok(next, 'no next-step line on ' + calc.slug);
    const shown = [...next[1].matchAll(/href="\/tools\/([\w-]+)\/"/g)].map((m) => m[1]);
    assert.deepEqual(shown, calc.related, calc.slug);
  }
});

test('upgrade block: Front Desk Free and seven SaaS upgrade links, each to a real page', () => {
  const block = page.match(/<section class="tool-upgrades"[\s\S]*?<\/section>/);
  assert.ok(block, 'upgrade block missing');
  const links = [...block[0].matchAll(/<a href="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(links, ['/frontdesk/', '/frontdeskai/', '/frontdeskagent/', '/apps/desk/', '/apps/build/', '/apps/field/', '/apps/skilled/', '/apps/synced/']);
  assert.equal(links.length - 1, 7, 'seven SaaS upgrade links besides Front Desk Free');
  for (const href of links) assert.ok(existsSync(new URL('.' + href.replace(/\/$/, '/index.html'), root)) || existsSync(new URL('.' + href.replace(/\/$/, ''), root)), 'missing page ' + href);
});

test('upgrade prices match the approved catalogue, and apps are not priced', () => {
  const block = page.match(/<section class="tool-upgrades"[\s\S]*?<\/section>/)[0];
  for (const item of catalogue.upgrades.filter((u) => u.priceMonthly !== null)) {
    assert.ok(block.includes('A$' + item.priceMonthly + ' per month'), item.name + ' price');
    assert.ok(block.includes(item.route), item.name + ' route');
  }
  assert.doesNotMatch(block, /A\$\d+ per month[^<]*<\/small><\/li><li><a href="\/apps/, 'apps must not carry a price');
  assert.equal((block.match(/Request a quote/g) || []).length, 5, 'five connected apps request a quote');
});

test('copy avoids pressure and urgency wording', () => {
  const pressure = /limited time|act now|hurry|last chance|only \d+ left|countdown|don.t miss|urgent|today only|expires|lose out|fear of missing/i;
  const copy = page.replace(/<script[\s\S]*?<\/script>/g, '');
  assert.doesNotMatch(copy, pressure);
});

test('category navigation points at real section ids, and every section has a tool', () => {
  const navTargets = [...page.matchAll(/<nav class="tool-category-nav"[\s\S]*?<\/nav>/g)][0][0].matchAll(/href="#([\w-]+)"/g);
  for (const [, id] of navTargets) {
    assert.ok(page.includes('id="' + id + '"'), 'anchor target missing: ' + id);
    const section = page.match(new RegExp('<section class="tool-directory-section"[^>]*aria-labelledby="' + id + '"[\\s\\S]*?</section>'));
    assert.ok(section && /data-tool /.test(section[0]), 'empty section for ' + id);
  }
});

test('the search field has a visible label and the form is a search landmark', () => {
  assert.match(page, /<label for="tool-search-input">Search tools by keyword<\/label>/);
  assert.match(page, /<input id="tool-search-input" type="search"/);
  assert.match(page, /<form class="tool-search" role="search"/);
});

test('every linked tool page has canonical metadata that points at itself and is in the sitemap', () => {
  const sitemap = read('sitemap.xml');
  for (const slug of slugs) {
    const html = read('tools/' + slug + '/index.html');
    assert.match(html, new RegExp('<link rel="canonical" href="https://titanzero\\.io/tools/' + slug + '/">'), slug);
    assert.ok(sitemap.includes('<loc>https://titanzero.io/tools/' + slug + '/</loc>'), 'sitemap misses ' + slug);
  }
});
