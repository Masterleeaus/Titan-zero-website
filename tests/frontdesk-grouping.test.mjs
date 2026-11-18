import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const catalogue = JSON.parse(read('assets/upgrade-catalogue.json'));
const SITE = 'https://titanzero.io';

// Every published HTML page: the homepage, the 404 page and each clean-URL folder copy.
const published = [
  { file: 'index.html', url: '/' },
  { file: '404.html', url: null },
  ...readdirSync(join(ROOT, 'pages'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => {
      const name = f.slice(0, -5);
      const route = name === 'recommended-free-tools' ? 'tools/free-tools' : name.replace(/^app-/, 'apps/').replace(/^article-/, 'resources/').replace(/^industry-/, 'industries/').replace(/^tool-/, 'tools/');
      return { file: `${route}/index.html`, url: `/${route}/` };
    }),
];

// Returns the inner HTML of the footer column titled "Front Desk".
function frontDeskFooter(html) {
  const m = /<div class="footer-col"><h2>Front Desk<\/h2>([\s\S]*?)<\/div>/.exec(html);
  return m ? m[1] : null;
}

// Returns the Front Desk header menu panel as a list of hrefs.
function frontDeskMenuLinks(html) {
  const start = html.indexOf('frontdesk-menu');
  if (start < 0) return null;
  const end = html.indexOf('</details>', start);
  return [...html.slice(start, end).matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

test('every published page has the same Front Desk footer column', () => {
  const reference = frontDeskFooter(read('pages/frontdesk.html'));
  assert.ok(reference, 'hub footer column must exist');
  for (const p of published) {
    assert.equal(frontDeskFooter(read(p.file)), reference, `${p.file} footer Front Desk column differs`);
  }
});

test('the connected apps stay in the Business apps footer column, not the Front Desk column', () => {
  const column = frontDeskFooter(read('pages/frontdesk.html'));
  for (const app of catalogue.upgrades.filter((u) => u.type === 'connected-app')) {
    assert.doesNotMatch(column, new RegExp(`href="${app.route}"`), `${app.name} should not be in the Front Desk footer column`);
  }
  const apps = read('pages/frontdesk.html');
  for (const app of catalogue.upgrades.filter((u) => u.type === 'connected-app')) {
    assert.match(apps, new RegExp(`href="${app.route}"`), `${app.name} should still be linked from the hub`);
  }
});

test('the 404 page header Front Desk menu matches the hub header menu', () => {
  const hub = frontDeskMenuLinks(read('pages/frontdesk.html'));
  const notFound = frontDeskMenuLinks(read('404.html'));
  assert.ok(hub && hub.length > 0, 'hub must have a Front Desk header menu');
  assert.deepEqual(notFound, hub);
});

test('every upgrade route is published with its own canonical', () => {
  for (const u of catalogue.upgrades) {
    const html = read(join(u.route.slice(1), 'index.html'));
    const canon = /<link rel="canonical" href="([^"]+)"/.exec(html);
    assert.ok(canon, `${u.route} has no canonical`);
    assert.equal(canon[1], `${SITE}${u.route}`, `${u.route} canonical must match its URL`);
  }
});

