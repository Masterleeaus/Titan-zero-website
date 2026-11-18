// Consent-gated Front Desk measurement (issue #90). Default is no tracking; no request is made
// before consent; events carry only an upgrade id; canonical URLs carry no UTM or query string.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { createAnalytics, sanitise, EVENTS, KEY } = require('../assets/analytics-consent.js');
const source = readFileSync(join(ROOT, 'assets/analytics-consent.js'), 'utf8');

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data,
  };
}

test('default is no tracking: an unset visitor records nothing', () => {
  const a = createAnalytics({ storage: memoryStorage() });
  assert.equal(a.consent(), 'unset');
  assert.equal(a.track('frontdesk_view'), false);
  assert.equal(a.track('upgrade_compare', { upgrade: 'assistant' }), false);
});

test('a denied visitor records nothing, and a stored denial is honoured', () => {
  const storage = memoryStorage({ [KEY]: 'denied' });
  const a = createAnalytics({ storage, dataLayer: [] });
  assert.equal(a.consent(), 'denied');
  assert.equal(a.track('upgrade_enquiry', { upgrade: 'sorted' }), false);
  assert.equal(a.setConsent('maybe'), false, 'invalid values are rejected');
  assert.equal(a.consent(), 'denied');
});

test('no network request is made before consent, and the module makes none at all', () => {
  const calls = [];
  const saved = { fetch: globalThis.fetch };
  globalThis.fetch = (...x) => calls.push(['fetch', x]);
  try {
    const a = createAnalytics({ storage: memoryStorage(), dataLayer: [] });
    a.track('frontdesk_view');
    a.track('upgrade_compare', { upgrade: 'assistant' });
    assert.deepEqual(calls, []);
  } finally {
    globalThis.fetch = saved.fetch;
  }
  assert.doesNotMatch(source, /\b(fetch|sendBeacon|XMLHttpRequest|new Image|WebSocket)\b/);
});

test('after consent, only the three planned events are pushed, with an upgrade id only', () => {
  const dataLayer = [];
  const a = createAnalytics({ storage: memoryStorage(), dataLayer });
  assert.equal(a.setConsent('granted'), true);
  assert.equal(a.track('frontdesk_view'), true);
  assert.equal(a.track('upgrade_compare', { upgrade: 'agent-team', email: 'x@example.com', selection: ['a', 'b'] }), true);
  assert.equal(a.track('upgrade_enquiry', { upgrade: 'made-up' }), true);
  assert.equal(a.track('some_other_event'), false);
  assert.deepEqual(dataLayer, [
    { event: 'frontdesk_view' },
    { event: 'upgrade_compare', upgrade: 'agent-team' },
    { event: 'upgrade_enquiry' },
  ]);
  assert.deepEqual(Object.keys(EVENTS).sort(), ['frontdesk_view', 'upgrade_compare', 'upgrade_enquiry']);
});

test('consent withdrawn stops events straight away', () => {
  const dataLayer = [];
  const storage = memoryStorage();
  const a = createAnalytics({ storage, dataLayer });
  a.setConsent('granted');
  a.track('frontdesk_view');
  a.setConsent('denied');
  assert.equal(a.track('frontdesk_view'), false);
  assert.equal(dataLayer.length, 1);
  assert.equal(storage.data[KEY], 'denied');
});

test('sanitise keeps only catalogue upgrade ids', () => {
  assert.deepEqual(sanitise({ upgrade: 'assistant', x: 1 }), { upgrade: 'assistant' });
  assert.deepEqual(sanitise({ upgrade: '../../x' }), {});
  assert.deepEqual(sanitise(undefined), {});
});

test('canonical URLs carry no query string or UTM parameters on any public page', () => {
  const files = [join(ROOT, 'index.html')];
  for (const d of readdirSync(join(ROOT, 'pages'))) if (d.endsWith('.html')) files.push(join(ROOT, 'pages', d));
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const canon = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(html);
    if (!canon) continue;
    assert.doesNotMatch(canon[1], /[?#]|utm_/, `${file} canonical has a query or UTM`);
  }
});
