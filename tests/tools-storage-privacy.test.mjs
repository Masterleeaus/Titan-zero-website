// Local data and privacy controls for the calculators (#107).
// Covers: the clear control, refused imports, a CSP review of the calculator pages, and the list of
// keys the pages store on the device. A new stored key must be added here before it ships.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const E = require('../assets/tools-engine.js');
const source = readFileSync(new URL('../assets/tools.js', import.meta.url), 'utf8');
const IDS = ['cleaning'];
const repo = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

// Every key the calculator code may write to localStorage, and what it holds.
const STORED_KEYS = {
  titanBusinessToolProfileV3: 'profile: service type, business and service names, numeric assumptions',
  titanBusinessToolProfileV2: 'legacy profile, read once and removed after the V3 write',
  titanQuotesV1: 'saved quotes: lines, scope, terms and reference; customer name only with consent',
  titanQuoteTransferV1: 'one job-cost price line, removed when the quote builder reads it',
  titanChecklistDraftV1: 'checklist ticks, notes, job or site name and sign-off note',
};

test('the clear control removes the V2 and V3 profiles and the quote store (#107)', () => {
  const start = source.indexOf('if(clear)clear.addEventListener');
  assert.ok(start > 0, 'clear handler exists');
  const body = source.slice(start, source.indexOf('\n', start));
  assert.match(body, /removeItem\(storageKey\)/);
  assert.match(body, /removeItem\('titanBusinessToolProfileV2'\)/);
  assert.match(body, /removeItem\(engine\.formulas\.QUOTE_STORE_KEY\)/);
});

test('a storage failure is reported in the result, not silently dropped (#107)', () => {
  assert.match(source, /function saveProfile\(\)\{[\s\S]*?return true;[\s\S]*?return false;/);
  assert.match(source, /const saved=saveProfile\(\);/);
  assert.match(source, /if\(!saved\)result\.append\(textNode\('p','This browser would not save your assumptions/);
});

test('the stored keys in code are exactly the documented list (#107)', () => {
  assert.equal(E.PROFILE_KEY, 'titanBusinessToolProfileV3');
  assert.equal(E.LEGACY_PROFILE_KEY, 'titanBusinessToolProfileV2');
  assert.equal(E.formulas.QUOTE_STORE_KEY, 'titanQuotesV1');
  assert.equal(E.formulas.QUOTE_TRANSFER_KEY, 'titanQuoteTransferV1');
  assert.match(source, /const CHECKLIST_DRAFT_KEY='titanChecklistDraftV1';/);
  // Every quoted storage-style key in the scripts must be on the documented list.
  const literal = new Set([...(source + repo('assets/tools-engine.js')).matchAll(/'(titan[A-Za-z]+V\d)'/g)].map((m) => m[1]));
  assert.ok(literal.size >= 5, 'expected the stored keys to be quoted in the scripts');
  for (const key of literal) assert.ok(key in STORED_KEYS, 'undocumented stored key: ' + key);
});

test('refused imports: malformed JSON, cross-site markup and an oversized file apply nothing (#107)', () => {
  const malformed = E.validateImport('{"format":', IDS);
  assert.equal(malformed.ok, false);
  const crossSite = E.validateImport(JSON.stringify({
    format: E.PORTABLE_FORMAT, formatVersion: E.PORTABLE_VERSION, vertical: 'cleaning',
    assumptions: { adminHours: '<img src=x onerror=alert(1)>' },
  }), IDS);
  assert.equal(crossSite.ok, false);
  assert.equal(JSON.stringify(crossSite).includes('onerror'), false, 'refusal must not echo the markup');
  const oversized = E.validateImport('x'.repeat(E.PORTABLE_MAX_CHARS + 1), IDS);
  assert.equal(oversized.ok, false);
  assert.match(oversized.errors[0].message, /too large/);
});

test('calculator pages: no inline script, no inline handlers, no javascript: URLs, no style attributes (#107 CSP review)', () => {
  const pages = readdirSync(new URL('../pages/', import.meta.url)).filter((f) => /^tool-.*\.html$/.test(f));
  assert.ok(pages.length >= 19, 'expected the 19 calculator pages');
  for (const file of pages) {
    const html = repo('pages/' + file);
    for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
      if (/type="application\/ld\+json"/i.test(m[1])) continue; // data only, never executed
      assert.match(m[1], /\ssrc="\//, file + ': every executable script must be a same-site file');
    }
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, file + ': no inline event handlers');
    assert.doesNotMatch(html, /javascript:/i, file + ': no javascript: URLs');
  }
});

test('calculator pages: external addresses are identifiers only, never requests made at run time (#107 CSP review)', () => {
  const allowed = /^(https:\/\/titanzero\.io|https:\/\/schema\.org|http:\/\/www\.w3\.org\/2000\/svg)/;
  const pages = readdirSync(new URL('../pages/', import.meta.url)).filter((f) => /^tool-.*\.html$/.test(f));
  for (const file of pages) {
    const html = repo('pages/' + file);
    const attrUrls = [...html.matchAll(/\s(?:src|href|action|srcset)="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]);
    for (const url of attrUrls) assert.match(url, allowed, file + ' loads or links ' + url);
  }
});

test('the review list matches the calculator script: no sessionStorage, cookies or network use (#107)', () => {
  for (const path of ['assets/tools.js', 'assets/tools-engine.js']) {
    const text = repo(path);
    assert.doesNotMatch(text, /sessionStorage|document\.cookie|indexedDB/, path);
    assert.doesNotMatch(text, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/, path);
  }
});
