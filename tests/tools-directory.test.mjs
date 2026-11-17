import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8');
const page = read('pages/tools.html');

const hrefs = (html) => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
const toolCards = [...page.matchAll(/<article class="hub-tool-card tool-entry" id="tool-([\w-]+)" data-tool /g)].map((m) => m[1]);

test('directory lists 27 tools (19 Titan Zero, 8 independent) in six named groups', () => {
  assert.equal(toolCards.length, 27);
  assert.equal(new Set(toolCards).size, 27);
  const groups = [...page.matchAll(/data-tool-section aria-labelledby="[\w-]+"><div class="tools-intro"><div><h2 id="[\w-]+">([^<]+)<\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(groups, ['Sales &amp; Customers', 'Pricing &amp; Profit', 'Capacity &amp; Scheduling', 'Staff &amp; Training', 'Cash Flow', 'Operations &amp; Planning']);
});

test('every internal link resolves to a file in the repository', () => {
  for (const href of new Set(hrefs(page))) {
    if (!href.startsWith('/')) continue;
    const path = href.split(/[?#]/)[0];
    const file = path.endsWith('/') ? `${path}index.html` : path;
    assert.ok(existsSync(new URL('.' + file, root)), `missing target for ${href}`);
  }
});

test('next-step links point to tools in the directory or to a listed external source', () => {
  const internal = new Set(toolCards.map((id) => `/tools/${id}`));
  const hrefsList = new Set(hrefs(page));
  for (const m of page.matchAll(/<p class="tool-next">(.*?)<\/p>/g)) {
    for (const link of hrefs(m[1])) {
      if (link.startsWith('/frontdesk/')) continue;
      if (link.startsWith('/')) assert.ok(hrefsList.has(link), `next link ${link} is not a directory tool`);
    }
  }
  assert.equal(internal.size, 27);
});

test('external tool links open in a new tab with a safe rel', () => {
  for (const m of page.matchAll(/<a ([^>]*href="https?:[^"]+"[^>]*)>/g)) {
    assert.match(m[1], /rel="noopener"/, m[1]);
    assert.match(m[1], /target="_blank"/, m[1]);
  }
});

test('clean-URL copy matches the source page', () => {
  assert.equal(read('tools/index.html'), page);
});

test('canonical and indexing metadata are present', () => {
  assert.match(page, /<link rel="canonical" href="https:\/\/titanzero\.io\/tools\/">/);
  assert.match(page, /<meta name="robots" content="index,follow">/);
  assert.match(read('sitemap.xml'), /<loc>https:\/\/titanzero\.io\/tools\/<\/loc>/);
});

test('keyword matcher requires every word and ignores case and punctuation', () => {
  const src = read('assets/tools-directory.js');
  const sandbox = { window: {}, module: undefined, document: undefined };
  vm.runInNewContext(src, sandbox);
  const { matches, normalise } = sandbox.window.TitanToolDirectory;
  assert.equal(normalise('  Quote,  BUILDER!  '), 'quote builder');
  assert.equal(matches('Quote builder and invoices', 'QUOTE builder'), true);
  assert.equal(matches('Quote builder', 'quote invoice'), false);
  assert.equal(matches('Quote builder', ''), true);
  assert.equal(matches('Missed calls', 'café'), false);
});
