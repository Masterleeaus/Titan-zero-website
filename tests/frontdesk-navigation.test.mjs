import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Issue #19: Front Desk ancestry, header/footer navigation and sitemap coverage.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const sourcePages = readdirSync(join(ROOT, 'pages')).filter((f) => f.endsWith('.html'));
const allPages = [...sourcePages.map((f) => `pages/${f}`), 'index.html', '404.html'];
const UPGRADE_ROUTES = ['/frontdeskai/', '/frontdeskagent/', '/apps/desk/', '/apps/build/', '/apps/field/', '/apps/skilled/'];

const breadcrumb = (html) => (/<nav class="breadcrumbs[^"]*"[\s\S]*?<\/nav>/.exec(html) || [''])[0];

test('every page links the Front Desk hub from header or footer', () => {
  for (const p of allPages) {
    assert.match(read(p), /href="\/frontdesk\/"/, `${p} links /frontdesk/`);
  }
});

test('every page exposes the six optional upgrade links', () => {
  for (const p of allPages) {
    for (const route of UPGRADE_ROUTES) {
      assert.match(read(p), new RegExp(`href="${route.replace(/\//g, '\\/')}"`), `${p} links ${route}`);
    }
  }
});

test('Front Desk pages and the two AI upgrades use Front Desk as breadcrumb parent, not /platform/', () => {
  for (const f of ['frontdesk.html', 'frontdeskai.html', 'frontdeskagent.html']) {
    const crumb = breadcrumb(read(`pages/${f}`));
    assert.match(crumb, /<a href="\/frontdesk\/">Front Desk<\/a>/, `${f} parent is /frontdesk/`);
    assert.doesNotMatch(crumb, /href="\/platform\/"[^>]*>Front Desk/, `${f} does not label /platform/ as Front Desk`);
  }
});

test('connected At.Work app pages sit under Front Desk in the breadcrumb', () => {
  for (const f of ['app-desk.html', 'app-build.html', 'app-field.html', 'app-skilled.html']) {
    assert.match(breadcrumb(read(`pages/${f}`)), /<a href="\/frontdesk\/">Front Desk<\/a>/, `${f} ancestry`);
  }
});

test('no page labels /platform/ as a Front Desk parent anywhere', () => {
  for (const p of allPages) {
    assert.doesNotMatch(read(p), /href="\/platform\/"[^>]*>\s*Front Desk\s*</, `${p}`);
  }
});

test('retired Front Desk Pro page is noindex and points canonical to /frontdesk/', () => {
  const html = read('pages/frontdeskpro.html');
  assert.match(html, /<meta name="robots" content="noindex/);
  assert.match(html, /<link rel="canonical" href="https:\/\/titanzero\.io\/frontdesk\/">/);
});

test('sitemap lists the Front Desk hub with a trailing slash', () => {
  assert.match(read('sitemap.xml'), /<loc>https:\/\/titanzero\.io\/frontdesk\/<\/loc>/);
});

test('six At.Work app navigation entries stay in the header', () => {
  for (const p of ['pages/frontdesk.html', 'pages/app-desk.html']) {
    const html = read(p);
    for (const name of ['ScheduledAt.Work', 'SuperchargedAt.Work', 'SortedAt.Work', 'SyncedAt.Work', 'SkilledAt.Work', 'SoloAt.Work']) {
      assert.ok(html.includes(name), `${p} shows ${name}`);
    }
  }
});
