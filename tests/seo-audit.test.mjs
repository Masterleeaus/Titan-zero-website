// Regression tests for the SEO and link audit (scripts/seo-audit.mjs).
// Builds small fixture sites in a temp folder and checks that each defect class is reported,
// then confirms the real repository passes.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { auditSite, decodeEntities, publicUrlFor, textLength } from '../scripts/seo-audit.mjs';

const DESC = 'A test description that is long enough to pass the fifty character minimum rule here.';

function page({ title = 'Home page for the test site', path = 'https://titanzero.io/', body = '<h1>Home</h1><a href="#top">Top</a><section id="top"></section>', ld = '{"@context":"https://schema.org","@type":"WebPage"}', extraHead = '', robots = 'index,follow' } = {}) {
  const desc = `${title}: ${DESC}`;
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><title>${title}</title>
<meta name="description" content="${desc}"><meta name="robots" content="${robots}"><link rel="canonical" href="${path}">
<meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:type" content="website">
<meta property="og:url" content="${path}"><meta property="og:image" content="https://titanzero.io/assets/social.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${desc}"><meta name="twitter:image" content="https://titanzero.io/assets/social.png">
${extraHead}<script type="application/ld+json">${ld}</script></head><body>${body}</body></html>`;
}

function site(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'seo-audit-'));
  const files = {
    'index.html': page(),
    'about/index.html': page({ title: 'About the test site', path: 'https://titanzero.io/about/', body: '<h1>About</h1><a href="/#top">Home top</a>' }),
    'sitemap.xml': '<urlset><url><loc>https://titanzero.io/</loc></url><url><loc>https://titanzero.io/about/</loc></url></urlset>',
    'robots.txt': 'User-agent: *\nAllow: /\n\nSitemap: https://titanzero.io/sitemap.xml\n',
    ...overrides,
  };
  for (const [name, text] of Object.entries(files)) {
    if (text === null) continue;
    const full = join(root, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
  }
  mkdirSync(join(root, 'assets'), { recursive: true });
  writeFileSync(join(root, 'assets/social.png'), 'png');
  return root;
}

test('entities are decoded before length is measured', () => {
  assert.equal(textLength('Marketing &amp; Promotions'), 22);
  assert.equal(decodeEntities('A &ndash; B &#169;'), 'A – B ©');
});

test('public URLs follow clean-URL routing', () => {
  assert.equal(publicUrlFor('index.html'), '/');
  assert.equal(publicUrlFor('about/index.html'), '/about/');
  assert.equal(publicUrlFor('404.html'), '/404.html');
});

test('a clean fixture site passes', () => {
  const { problems, indexable } = auditSite(site());
  assert.deepEqual(problems, []);
  assert.equal(indexable, 2);
});

test('defects are reported', () => {
  const cases = [
    ['over-long title', { 'index.html': page({ title: 'x'.repeat(60) }) }, /title is 60 characters/],
    ['missing Twitter image', { 'index.html': page().replace('<meta name="twitter:image" content="https://titanzero.io/assets/social.png">', '') }, /missing or duplicate twitter:image/],
    ['broken internal link', { 'index.html': page({ body: '<h1>Home</h1><a href="/nope/">x</a>' }) }, /broken a href "\/nope\/"/],
    ['dead fragment', { 'index.html': page({ body: '<h1>Home</h1><a href="/about/#gone">x</a>' }) }, /no matching id on about\/index.html/],
    ['invalid JSON-LD', { 'index.html': page({ ld: '{"@context":' }) }, /does not parse/],
    ['sitemap missing a page', { 'sitemap.xml': '<urlset><url><loc>https://titanzero.io/</loc></url></urlset>' }, /sitemap.xml is missing \/about\//],
    ['sitemap lists a noindex page', { 'private/index.html': page({ title: 'Private test page', path: 'https://titanzero.io/private/', robots: 'noindex,follow' }), 'sitemap.xml': '<urlset><url><loc>https://titanzero.io/</loc></url><url><loc>https://titanzero.io/about/</loc></url><url><loc>https://titanzero.io/private/</loc></url></urlset>' }, /lists noindex page \/private\//],
    ['robots without sitemap', { 'robots.txt': 'User-agent: *\nAllow: /\n' }, /robots.txt does not point/],
    ['duplicate title', { 'about/index.html': page({ title: 'Home page for the test site', path: 'https://titanzero.io/about/' }) }, /duplicate title/],
  ];
  for (const [name, overrides, pattern] of cases) {
    const { problems } = auditSite(site(overrides));
    assert.ok(problems.some((p) => pattern.test(p)), `${name}: expected ${pattern}, got ${JSON.stringify(problems)}`);
  }
});

test('the published repository passes the SEO audit', () => {
  const { problems } = auditSite(new URL('..', import.meta.url).pathname);
  assert.deepEqual(problems, []);
});
