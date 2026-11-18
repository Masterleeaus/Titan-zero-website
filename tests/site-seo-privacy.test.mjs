// Issue #7: site-wide SEO metadata, no tracking before consent, UTM policy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const sources = readdirSync(join(ROOT, 'pages')).filter((f) => f.endsWith('.html')).map((f) => `pages/${f}`);
const pages = [...sources, 'index.html'];

// Shared meta tags every public page must carry (title, description, canonical, Open Graph, Twitter).
const REQUIRED = [
  /<title>[^<]+<\/title>/,
  /<meta name="description" content="[^"]+"/,
  /<link rel="canonical" href="https:\/\/titanzero\.io\/[^"]*"/,
  /<meta property="og:title" content="[^"]+"/,
  /<meta property="og:description" content="[^"]+"/,
  /<meta property="og:url" content="https:\/\/titanzero\.io\/[^"]*"/,
  /<meta property="og:type" content="[^"]+"/,
  /<meta property="og:image" content="[^"]+"/,
  /<meta name="twitter:card" content="[^"]+"/,
];

test('every public page carries the shared SEO and Open Graph tags', () => {
  for (const p of pages) {
    const html = read(p);
    for (const re of REQUIRED) assert.match(html, re, `${p} is missing ${re.source.slice(0, 40)}`);
  }
});

test('no analytics or tracking scripts are shipped before consent', () => {
  const banned = /gtag\(|googletagmanager|google-analytics|plausible|fbq\(|hotjar|clarity\.ms|segment\.com|connect\.facebook/i;
  const files = [...pages];
  for (const dir of ['assets', 'tools']) {
    const walk = (d) => {
      for (const name of readdirSync(join(ROOT, d))) {
        const full = join(d, name);
        if (statSync(join(ROOT, full)).isDirectory()) walk(full);
        else if (['.js', '.mjs', '.html'].includes(extname(name))) files.push(full);
      }
    };
    walk(dir);
  }
  for (const f of files) assert.doesNotMatch(read(f), banned, `${f} contains a tracking snippet`);
});

test('internal links carry no UTM parameters (UTMs are for inbound links only)', () => {
  for (const p of pages) {
    const hrefs = [...read(p).matchAll(/\bhref="(\/[^"]*)"/g)].map((m) => m[1]);
    for (const href of hrefs) assert.doesNotMatch(href, /[?&]utm_/, `${p} links to ${href} with UTM parameters`);
  }
});

test('canonical links never carry UTM parameters', () => {
  for (const p of pages) assert.doesNotMatch(read(p), /rel="canonical" href="[^"]*utm_/, `${p} canonical has UTM`);
});

test('robots.txt points at the sitemap and sitemap lists the homepage', () => {
  assert.match(read('robots.txt'), /Sitemap: https:\/\/titanzero\.io\/sitemap\.xml/);
  assert.match(read('sitemap.xml'), /<loc>https:\/\/titanzero\.io\/<\/loc>/);
});
