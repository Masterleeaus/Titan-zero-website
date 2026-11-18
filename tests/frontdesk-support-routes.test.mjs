import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Issue #91: one static support route per Front Desk topic, linked from the hub and footer.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const ROUTES = [
  'frontdesk-compatibility',
  'frontdesk-billing',
  'frontdesk-troubleshooting',
  'frontdesk-status',
  'frontdesk-privacy',
];

for (const slug of ROUTES) {
  test(`${slug}: source and published copy exist and match`, () => {
    const src = read(`pages/${slug}.html`);
    assert.equal(read(`${slug}/index.html`), src);
  });

  test(`${slug}: one h1, canonical to its trailing-slash route, and listed in the sitemap`, () => {
    const html = read(`pages/${slug}.html`);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    assert.ok(html.includes(`<link rel="canonical" href="https://titanzero.io/${slug}/">`));
    assert.ok(read('sitemap.xml').includes(`<loc>https://titanzero.io/${slug}/</loc>`));
  });

  test(`${slug}: linked from the Front Desk hub and the footer`, () => {
    assert.ok(read('pages/frontdesk.html').includes(`href="/${slug}/"`), 'hub link');
    assert.ok(read('index.html').includes(`href="/${slug}/"`), 'footer link on homepage');
  });

  test(`${slug}: points help to /support/ and names no WordPress.org listing or checkout`, () => {
    const html = read(`pages/${slug}.html`);
    assert.ok(html.includes('href="/support/"'), 'links /support/');
    assert.doesNotMatch(html, /wordpress\.org\/plugins/i, 'no WordPress.org plugin listing');
    const anchors = [...html.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)].map((m) => text(m[1]));
    for (const label of anchors) assert.doesNotMatch(label, /(buy now|add to cart|checkout|pay now)/i, 'no checkout link: ' + label);
  });
}

test('compatibility page records the released version it was checked against', () => {
  assert.match(text(read('pages/frontdesk-compatibility.html')), /released version 3\.0\.128/);
  assert.match(text(read('pages/frontdesk-compatibility.html')), /WordPress 6\.6 or later/);
});

test('billing page says no billing is live and does not invent a cancel flow', () => {
  const t = text(read('pages/frontdesk-billing.html'));
  assert.match(t, /No billing is live/);
  assert.match(t, /drafts pending legal review/);
});

test('status page does not claim a live status feed or uptime figures', () => {
  const t = text(read('pages/frontdesk-status.html'));
  assert.match(t, /no public status page/i);
  assert.doesNotMatch(t, /\d{2,3}(\.\d+)?\s?%\s*(uptime|availability)/i);
  assert.match(t, /not live/i);
});

test('privacy page keeps the verified erase and sign-in timings', () => {
  const t = text(read('pages/frontdesk-privacy.html'));
  assert.match(t, /expire after 20 minutes/);
  assert.match(t, /last 2 hours/);
  assert.match(t, /STOP/);
});
