#!/usr/bin/env node
// SEO and link audit for every published page.
//
//   node scripts/seo-audit.mjs check   fail (exit 1) on any defect
//
// Imported by scripts/site-gate.mjs, so `site-gate.mjs check` runs it too.
// No dependencies. Checks: one h1; one title under 60 characters, unique across the site;
// one meta description of 50 to 160 characters, unique across the site; canonical matches the
// clean URL on indexable pages; Open Graph and Twitter card tags; local og:image files exist;
// JSON-LD blocks parse and carry @context and @type; every internal href/src resolves and every
// #fragment has a matching id on its target page; no duplicate ids; sitemap.xml lists exactly the
// indexable pages, each once, with no noindex page and no dead URL; robots.txt names the sitemap.
// Lengths are measured on decoded text, so &amp; counts as one character.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE = 'https://titanzero.io';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['.git', 'node_modules', 'downloads', 'docs', 'scripts', 'tests', 'assets', 'pages']);
const TITLE_MAX = 59; // "under 60 characters"
const DESC_MIN = 50;
const DESC_MAX = 160;
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…',
};

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    const named = NAMED_ENTITIES[entity.toLowerCase()];
    return named === undefined ? match : named;
  });
}

// Length in characters (code points) of the text a reader sees.
export function textLength(text) {
  return [...decodeEntities(text).trim()].length;
}

// Source file path (relative to the site root) to its public URL path.
export function publicUrlFor(file) {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`;
  return `/${file}`;
}

const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export function parseAttrs(text) {
  const out = {};
  for (const m of text.matchAll(ATTR)) {
    const key = m[1].toLowerCase();
    if (!(key in out)) out[key] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

// Returns every start tag as { name, attrs }. Comments and script/style bodies must be removed first.
export function startTags(html) {
  return [...html.matchAll(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g)].map((m) => ({ name: m[1].toLowerCase(), attrs: parseAttrs(m[2]) }));
}

// Parses one published page into the facts the checks need.
export function modelPage(html, file) {
  const raw = html.replace(/<!--[\s\S]*?-->/g, '');
  const skeleton = raw
    .replace(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi, '<script$1></script>')
    .replace(/<style\b([^>]*)>[\s\S]*?<\/style\s*>/gi, '<style$1></style>');
  const tags = startTags(skeleton);
  const meta = tags.filter((t) => t.name === 'meta');
  const metaValues = (key) => meta.filter((m) => m.attrs.property === key || m.attrs.name === key).map((m) => m.attrs.content ?? '');
  const titles = [...raw.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)].map((m) => m[1]);
  const ids = tags.map((t) => t.attrs.id).filter((v) => v !== undefined);
  const robots = metaValues('robots').join(' ');
  return {
    file,
    publicUrl: publicUrlFor(file),
    noindex: /noindex/i.test(robots),
    titles,
    descriptions: metaValues('description'),
    og: Object.fromEntries(['title', 'description', 'type', 'url', 'image'].map((k) => [k, metaValues(`og:${k}`)])),
    twitter: Object.fromEntries(['card', 'title', 'description', 'image'].map((k) => [k, metaValues(`twitter:${k}`)])),
    canonicals: tags.filter((t) => t.name === 'link' && (t.attrs.rel || '').toLowerCase().split(/\s+/).includes('canonical')).map((t) => t.attrs.href ?? ''),
    h1Count: tags.filter((t) => t.name === 'h1').length,
    ids,
    jsonLd: [...raw.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script\s*>/gi)].map((m) => m[1]),
    refs: tags.flatMap((t) => ['href', 'src'].filter((a) => t.attrs[a] !== undefined).map((a) => ({ tag: t.name, attr: a, value: t.attrs[a] }))),
  };
}

const one = (values) => (values.length === 1 ? values[0] : undefined);

// Checks that need only one page's own facts.
export function checkPage(page) {
  const problems = [];
  const at = (msg) => problems.push(`${page.file}: ${msg}`);
  const title = one(page.titles);
  if (title === undefined) at(`expected exactly one <title>, found ${page.titles.length}`);
  else {
    const len = textLength(title);
    if (len === 0 || len > TITLE_MAX) at(`title is ${len} characters, must be 1 to ${TITLE_MAX}`);
  }
  const desc = one(page.descriptions);
  if (desc === undefined) at(`expected exactly one meta description, found ${page.descriptions.length}`);
  else {
    const len = textLength(desc);
    if (len < DESC_MIN || len > DESC_MAX) at(`meta description is ${len} characters, must be ${DESC_MIN} to ${DESC_MAX}`);
  }
  if (page.h1Count !== 1) at(`expected exactly one h1, found ${page.h1Count}`);
  for (const key of ['title', 'description', 'type', 'image']) {
    if (page.og[key].length !== 1 || !page.og[key][0]) at(`missing or duplicate og:${key}`);
  }
  for (const key of ['card', 'title', 'description', 'image']) {
    if (page.twitter[key].length !== 1 || !page.twitter[key][0]) at(`missing or duplicate twitter:${key}`);
  }
  if (!page.noindex) {
    if (page.canonicals.length !== 1) at(`expected exactly one canonical, found ${page.canonicals.length}`);
    else if (page.canonicals[0] !== `${SITE}${page.publicUrl}`) at(`canonical ${page.canonicals[0]} does not match ${SITE}${page.publicUrl}`);
    if (page.og.url.length !== 1) at('missing og:url');
    else if (page.canonicals.length === 1 && page.og.url[0] !== page.canonicals[0]) at(`og:url ${page.og.url[0]} differs from canonical`);
    if (page.jsonLd.length === 0) at('no JSON-LD block');
  } else if (page.og.url.length > 1) {
    at('more than one og:url');
  }
  page.jsonLd.forEach((block, i) => {
    let data;
    try {
      data = JSON.parse(block);
    } catch (err) {
      at(`JSON-LD block ${i + 1} does not parse: ${err.message}`);
      return;
    }
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      if (!item || typeof item !== 'object' || !item['@context'] || !(item['@type'] || item['@graph'])) {
        at(`JSON-LD block ${i + 1} needs @context and @type or @graph`);
      }
    }
  });
  const seen = new Set();
  for (const id of page.ids) {
    if (seen.has(id)) at(`duplicate id "${id}"`);
    seen.add(id);
  }
  for (const ref of page.refs) {
    if (ref.value.startsWith('#') && ref.value.length > 1 && !seen.has(decodeURIComponent(ref.value.slice(1)))) {
      at(`${ref.tag} ${ref.attr} "${ref.value}" has no matching id on this page`);
    }
  }
  return problems;
}

// Maps an internal URL path to the file that serves it, relative to root.
function fileForPath(root, pathname) {
  const path = decodeURIComponent(pathname).replace(/^\//, '');
  if (path === '' || path.endsWith('/')) return join(path, 'index.html');
  const direct = join(root, path);
  if (existsSync(direct) && statSync(direct).isFile()) return path;
  return join(path, 'index.html');
}

function listPages(root, dir = root) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) && dir === root) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listPages(root, full));
    else if (name.endsWith('.html')) out.push(relative(root, full));
  }
  return out.sort();
}

export function auditSite(root = ROOT) {
  const problems = [];
  const fail = (msg) => problems.push(msg);
  const files = listPages(root);
  const pages = new Map(files.map((file) => [file, modelPage(readFileSync(join(root, file), 'utf8'), file)]));

  for (const page of pages.values()) problems.push(...checkPage(page));

  // Titles and descriptions must be unique across the site.
  const byTitle = new Map();
  const byDesc = new Map();
  for (const page of pages.values()) {
    const t = one(page.titles);
    const d = one(page.descriptions);
    if (t !== undefined) byTitle.set(decodeEntities(t).trim(), [...(byTitle.get(decodeEntities(t).trim()) || []), page.file]);
    if (d !== undefined) byDesc.set(decodeEntities(d).trim(), [...(byDesc.get(decodeEntities(d).trim()) || []), page.file]);
  }
  for (const [t, list] of byTitle) if (list.length > 1) fail(`duplicate title "${t}" on ${list.join(', ')}`);
  for (const [d, list] of byDesc) if (list.length > 1) fail(`duplicate meta description on ${list.join(', ')}`);

  // Internal links, anchors, and local og/twitter images.
  for (const page of pages.values()) {
    for (const ref of page.refs) {
      const value = ref.value.trim();
      if (value === '' || /^(mailto|tel|sms|javascript|data):/i.test(value)) continue;
      let url;
      try {
        url = new URL(value, `${SITE}${page.publicUrl}`);
      } catch {
        problems.push(`${page.file}: unparseable ${ref.attr} "${value}"`);
        continue;
      }
      if (url.origin !== SITE) continue; // external links are not fetched here
      const target = fileForPath(root, url.pathname);
      if (!existsSync(join(root, target))) {
        fail(`${page.file}: broken ${ref.tag} ${ref.attr} "${value}" (no file ${target})`);
        continue;
      }
      const fragment = url.hash.length > 1 ? decodeURIComponent(url.hash.slice(1)) : '';
      const targetPage = pages.get(target);
      if (fragment && targetPage && !targetPage.ids.includes(fragment)) {
        fail(`${page.file}: ${ref.tag} ${ref.attr} "${value}" has no matching id on ${target}`);
      }
    }
    for (const key of ['image']) {
      for (const image of [...page.og[key], ...page.twitter[key]]) {
        if (!image.startsWith(`${SITE}/`)) continue;
        if (!existsSync(join(root, decodeURIComponent(new URL(image).pathname.slice(1))))) {
          fail(`${page.file}: social image ${image} does not exist`);
        }
      }
    }
  }

  // Sitemap: exactly the indexable pages, each once, every entry served by a non-noindex page.
  const indexable = [...pages.values()].filter((p) => !p.noindex).map((p) => p.publicUrl);
  const sitemapXml = readFileSync(join(root, 'sitemap.xml'), 'utf8');
  const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const paths = locs.map((loc) => (loc.startsWith(`${SITE}/`) ? loc.slice(SITE.length) : null));
  locs.forEach((loc, i) => {
    if (paths[i] === null) return fail(`sitemap.xml entry ${loc} is not on ${SITE}`);
    const file = fileForPath(root, paths[i]);
    const page = pages.get(file);
    if (!existsSync(join(root, file))) fail(`sitemap.xml lists ${paths[i]} but no file serves it`);
    else if (page && page.noindex) fail(`sitemap.xml lists noindex page ${paths[i]}`);
  });
  for (const [i, path] of paths.entries()) if (path !== null && paths.indexOf(path) !== i) fail(`sitemap.xml lists ${path} more than once`);
  for (const url of indexable) if (!paths.includes(url)) fail(`sitemap.xml is missing ${url}`);

  // robots.txt must name the sitemap and must not block the whole site.
  const robots = readFileSync(join(root, 'robots.txt'), 'utf8');
  if (!/^Sitemap:\s*https:\/\/titanzero\.io\/sitemap\.xml\s*$/m.test(robots)) fail('robots.txt does not point to https://titanzero.io/sitemap.xml');
  if (/^Disallow:\s*\/\s*$/m.test(robots)) fail('robots.txt disallows the whole site');

  return { problems, pages: pages.size, indexable: indexable.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== 'check') {
    console.error('usage: node scripts/seo-audit.mjs check');
    process.exit(2);
  }
  const { problems, pages, indexable } = auditSite(ROOT);
  if (problems.length) {
    console.error(`seo audit failed with ${problems.length} problem(s):`);
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
  console.log(`seo audit passed: ${pages} pages, ${indexable} indexable`);
}
