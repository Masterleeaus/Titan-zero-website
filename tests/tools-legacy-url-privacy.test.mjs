import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const site = readFileSync(new URL('../assets/site.js', import.meta.url), 'utf8');
const start = site.indexOf('const query=new URLSearchParams(documentUrl.search);',
  site.indexOf('const documentUrl=new URL(document.baseURI);'));
const end = site.indexOf("\ndocument.documentElement.classList.add('js');", start);
assert.ok(start >= 0 && end > start, 'legacy sanitizer must precede page initialization');

function initialiseUrl(href, historyEnabled = true) {
  let replaced;
  const window = { history: {
    state: { route: 'pricing' },
    replaceState(_state, _title, value) {
      if (!historyEnabled) throw new Error('replaceState unavailable');
      replaced = value;
    }
  } };
  const documentUrl = new URL(href);
  const query = runInNewContext(site.slice(start, end) + '\nquery', {
    URL, URLSearchParams, documentUrl, window
  });
  return { query, replaced };
}

test('legacy sensitive business and quote URL context is dropped from history', () => {
  const privateData = JSON.stringify({
    tool: 'Quote builder', business: 'PRIVATE-BUSINESS', service: 'PRIVATE-SERVICE'
  });
  const original = new URL('https://titanzero.io/pricing/?app=sorted&tool_context=' +
    encodeURIComponent(privateData) + '#calculator');
  const { query, replaced } = initialiseUrl(original.href);
  assert.equal(query.has('tool_context'), false);
  assert.equal(query.get('app'), 'sorted');
  assert.equal(replaced, '/pricing/?app=sorted#calculator');
  assert.ok(!replaced.includes('PRIVATE-'));
});

test('support parameters and hash survive removal of the retired context', () => {
  const { query, replaced } = initialiseUrl(
    'https://titanzero.io/support/?industry=cleaning&tool_context=%7B%22customer%22%3A%22PRIVATE%22%7D&level=free#contact');
  assert.equal(query.has('tool_context'), false);
  assert.equal(query.get('industry'), 'cleaning');
  assert.equal(query.get('level'), 'free');
  assert.equal(replaced, '/support/?industry=cleaning&level=free#contact');
});

test('safe URLs are not rewritten unnecessarily', () => {
  const { query, replaced } = initialiseUrl('https://titanzero.io/pricing/?app=skilled');
  assert.equal(query.get('app'), 'skilled');
  assert.equal(replaced, undefined);
});

test('a restrictive history environment does not break the page or restore the old context', () => {
  const { query } = initialiseUrl(
    'https://titanzero.io/support/?tool_context=PRIVATE-SERVICE', false);
  assert.equal(query.has('tool_context'), false);
});

test('pricing and support cannot replay tool context into a second URL or form', () => {
  assert.doesNotMatch(site, /searchParams\.set\(\s*['"]tool_context['"]/);
  assert.doesNotMatch(site, /query\.get\(\s*['"]tool_context['"]/);
  assert.doesNotMatch(site, /readToolContext|pricingToolContext/);
  assert.doesNotMatch(site, /supportUrl\.searchParams\.set\(\s*['"]tool_context['"]/);
});
