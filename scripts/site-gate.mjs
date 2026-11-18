#!/usr/bin/env node
// Static site gate (issue #21).
//
//   node scripts/site-gate.mjs sync    copy each pages/*.html to its clean-URL folder index.html
//   node scripts/site-gate.mjs check   fail (exit 1) on any drift or broken release rule
//
// No dependencies. Checks: source and published copies match; canonical tags; sitemap
// coverage and targets; local href/src targets exist; one h1 and no heading-level jumps;
// every img has alt; approved upgrade catalogue (assets/upgrade-catalogue.json) matches the
// Front Desk hub; only approved A$ amounts appear anywhere on published pages.
// Also runs scripts/seo-audit.mjs (titles, descriptions, Open Graph/Twitter, JSON-LD, anchors, robots).
// Rollback: see docs/PUBLISHING.md.

import { readFileSync, mkdirSync, readdirSync, existsSync, statSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditSite } from './seo-audit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://titanzero.io';
const APPROVED_AMOUNTS = new Set([19, 79, 29, 99, 39, 129]);
// Pages where every A$ figure is a plugin or Front Desk price. Titan BOS plan pages use other prices.
const PLUGIN_PRICE_PAGE = /^(frontdesk\w*|plugins|apps\/[^/]+)\/index\.html$/;

// Maps a pages/ source name to its public route, as in docs/PUBLISHING.md.
export function routeFor(name) {
  if (name === 'recommended-free-tools') return 'tools/free-tools';
  let m;
  if ((m = /^app-(.+)$/.exec(name))) return `apps/${m[1]}`;
  if ((m = /^article-(.+)$/.exec(name))) return `resources/${m[1]}`;
  if ((m = /^industry-(.+)$/.exec(name))) return `industries/${m[1]}`;
  if ((m = /^tool-(.+)$/.exec(name))) return `tools/${m[1]}`;
  return name;
}

export function pageEntries(root = ROOT) {
  return readdirSync(join(root, 'pages'))
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((f) => {
      const route = routeFor(f.slice(0, -5));
      return { source: `pages/${f}`, copy: `${route}/index.html`, publicUrl: `/${route}/` };
    });
}

function sync(root) {
  const entries = pageEntries(root);
  for (const e of entries) {
    mkdirSync(dirname(join(root, e.copy)), { recursive: true });
    copyFileSync(join(root, e.source), join(root, e.copy));
  }
  console.log(`synced ${entries.length} clean-URL copies from pages/`);
}

function publicFileFor(root, urlPath) {
  const clean = urlPath.split('#')[0].split('?')[0];
  const direct = join(root, clean);
  if (clean.endsWith('/')) return join(direct, 'index.html');
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  return join(direct, 'index.html');
}

function listHtml(root) {
  const out = [];
  const skip = new Set(['.git', 'node_modules', 'downloads', 'docs', 'scripts', 'tests', 'assets']);
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.html')) out.push(full);
    }
  };
  walk(root);
  return out;
}

export function check(root = ROOT) {
  const problems = [];
  const fail = (msg) => problems.push(msg);
  const read = (p) => readFileSync(join(root, p), 'utf8');

  // 1. Source and published copies must be byte-identical.
  const entries = pageEntries(root);
  for (const e of entries) {
    if (!existsSync(join(root, e.copy))) {
      fail(`missing published copy ${e.copy} for ${e.source}`);
      continue;
    }
    if (!readFileSync(join(root, e.source)).equals(readFileSync(join(root, e.copy)))) {
      fail(`drift: ${e.copy} differs from ${e.source} (run: node scripts/site-gate.mjs sync)`);
    }
  }

  // Published pages: the source list plus the homepage.
  const published = [{ publicUrl: '/', file: 'index.html' }, ...entries.map((e) => ({ publicUrl: e.publicUrl, file: e.copy }))];

  // 2. Canonicals and noindex.
  const indexable = [];
  for (const p of published) {
    if (!existsSync(join(root, p.file))) {
      fail(`${p.file} is missing, so ${p.publicUrl} cannot be served`);
      continue;
    }
    const html = read(p.file);
    const noindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html);
    const canon = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(html);
    if (!canon) {
      fail(`${p.file}: no canonical link`);
      continue;
    }
    if (!noindex) {
      indexable.push(p.publicUrl);
      if (canon[1] !== `${SITE}${p.publicUrl}`) fail(`${p.file}: canonical ${canon[1]} does not match ${SITE}${p.publicUrl}`);
    }
    // 3. Headings: exactly one h1 on indexable pages, no skipped levels.
    const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
    if (!noindex && levels.filter((l) => l === 1).length !== 1) fail(`${p.file}: expected exactly one h1`);
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1) fail(`${p.file}: heading jumps from h${levels[i - 1]} to h${levels[i]}`);
    }
    // 4. Images need alt text.
    for (const img of html.match(/<img\b[^>]*>/gi) || []) {
      if (!/\balt=/.test(img)) fail(`${p.file}: image without alt: ${img.slice(0, 80)}`);
    }
    // 6. Plugin, Front Desk and At.Work app pages may only show approved A$ amounts.
    if (PLUGIN_PRICE_PAGE.test(p.file)) {
      for (const m of html.matchAll(/A\$(\d+)/g)) {
        if (!APPROVED_AMOUNTS.has(Number(m[1]))) fail(`${p.file}: unapproved price A$${m[1]}`);
      }
    }
  }

  // 5. Sitemap: every indexable page listed, every entry resolves to a file.
  const sitemap = read('sitemap.xml');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITE, ''));
  for (const url of indexable) if (!locs.includes(url)) fail(`sitemap.xml is missing ${url}`);
  for (const url of locs) {
    if (!existsSync(publicFileFor(root, url))) fail(`sitemap.xml lists ${url} but no file serves it`);
  }

  // 7. Local href/src targets must exist.
  for (const file of listHtml(root)) {
    const rel = file.slice(root.length + 1);
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const target = m[1];
      if (!target.startsWith('/') || target.startsWith('//')) continue;
      if (!existsSync(publicFileFor(root, target))) fail(`${rel}: broken local link ${target}`);
    }
  }

  // 8. Upgrade catalogue: routes must exist and the hub must show the approved offer.
  const catalogue = JSON.parse(read('assets/upgrade-catalogue.json'));
  const hub = read('pages/frontdesk.html');
  const hubUrl = catalogue.plugin.route;
  if (!existsSync(publicFileFor(root, hubUrl))) fail(`catalogue plugin route ${hubUrl} is not published`);
  for (const u of catalogue.upgrades) {
    if (!existsSync(publicFileFor(root, u.route))) fail(`catalogue route ${u.route} (${u.id}) is not published`);
    if (!hub.includes(`href="${u.route}"`)) fail(`hub ${hubUrl} does not link ${u.route} (${u.id})`);
    if (u.priceMonthly !== null) {
      const amount = `A$${u.priceMonthly} per month`;
      if (!hub.includes(amount)) fail(`hub does not show approved price "${amount}" for ${u.id}`);
    } else if (!hub.includes(u.priceLabel) && !hub.includes('Request a quote')) {
      fail(`hub does not say "${u.priceLabel}" for ${u.id}`);
    }
  }
  for (const [band, p] of Object.entries(catalogue.bands)) {
    for (const amount of [p.assistant, p.agentTeam]) {
      if (!APPROVED_AMOUNTS.has(amount)) fail(`catalogue band ${band} has unapproved amount ${amount}`);
    }
  }

  // 9. SEO and link audit (titles, descriptions, Open Graph/Twitter, JSON-LD, anchors, sitemap, robots).
  for (const problem of auditSite(root).problems) fail(problem);

  return { problems, pages: published.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  if (cmd === 'sync') {
    sync(ROOT);
  } else if (cmd === 'check') {
    const { problems, pages } = check(ROOT);
    if (problems.length) {
      console.error(`site gate failed with ${problems.length} problem(s):`);
      for (const p of problems) console.error(`- ${p}`);
      process.exit(1);
    }
    console.log(`site gate passed: ${pages} published pages checked`);
  } else {
    console.error('usage: node scripts/site-gate.mjs sync | check');
    process.exit(2);
  }
}
