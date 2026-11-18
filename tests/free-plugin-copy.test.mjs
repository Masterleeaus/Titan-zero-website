import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Issue #20: Front Desk Free (standalone plugin, not yet on WordPress.org) must not be
// confused with Titan Zero Core (shared free foundation) or the paid SaaS apps and AI services.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const pages = [
  'index.html',
  ...readdirSync(join(ROOT, 'pages')).filter((f) => f.endsWith('.html')).map((f) => `pages/${f}`),
];

test('no page calls the shared core "Free Titan Zero core" or merges it with Front Desk Free', () => {
  for (const p of pages) {
    assert.doesNotMatch(text(read(p)), /free titan zero core/i, p);
  }
});

test('no page claims Front Desk Free is available on or installed from WordPress.org', () => {
  for (const p of pages) {
    const t = text(read(p));
    assert.doesNotMatch(t, /(available|download|install|get it) (on|from) wordpress\.org/i, p);
    assert.doesNotMatch(t, /wordpress\.org[^.]{0,40}(is live|now available|listed and available)/i, p);
  }
});

test('no page offers a trial of Front Desk or the AI services', () => {
  for (const p of pages) {
    assert.doesNotMatch(text(read(p)), /free trial|try (it )?free for|\d+[- ]day trial/i, p);
  }
});

test('homepage and pricing say Front Desk Free is not yet on WordPress.org', () => {
  for (const p of ['index.html', 'pages/pricing.html']) {
    assert.match(text(read(p)), /not yet listed on WordPress\.org/i, p);
  }
});

test('homepage says Titan Zero Core is separate from Front Desk Free', () => {
  assert.match(text(read('index.html')), /Titan Zero Core, which is free\. Front Desk Free is a separate WordPress plugin/);
});

test('plugin licence and sign-in statements stay consistent across terms and FAQ', () => {
  for (const p of ['pages/faq.html', 'pages/scheduling-enquiries-terms.html']) {
    assert.match(text(read(p)), /GPL-2\.0-only/, `${p} names GPL-2.0-only`);
  }
  for (const p of ['pages/frontdesk.html', 'pages/privacy.html']) {
    assert.match(text(read(p)), /(does not|do not) (create an account|create accounts)/i, `${p} says no account is created`);
  }
});

test('pricing states free plugin status with the support route, not a checkout', () => {
  const html = read('pages/pricing.html');
  assert.match(html, /<a class="button[^"]*" href="\/support\/">Get the free plugin<\/a>/);
});
