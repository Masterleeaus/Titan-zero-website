// Static accessibility checks for the calculator source pages (#46). Run from the repository root:
//   node scripts/check-tool-a11y.mjs
// Checks markup that is present before JavaScript runs: document language, one h1, labelled
// form controls, named buttons, and a live region on each results container. Dynamically
// generated fields are checked by the DOM smoke test (scripts/tools-dom-smoke.cjs), not here.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');
const failures = [];
const fail = (file, message) => failures.push(file + ': ' + message);

const sources = readdirSync(join(root, 'pages')).filter((name) => /^tool-.*\.html$/.test(name)).sort();
const resultRoots = /data-tool-result|data-quote-result|data-job-cost-result|data-generated-checklist/;

for (const name of sources) {
  const file = 'pages/' + name;
  const html = read(file);
  if (!/<html[^>]*\slang="en/i.test(html)) fail(file, 'html element needs lang="en-AU" or lang="en"');
  const h1s = html.match(/<h1\b/gi) || [];
  if (h1s.length !== 1) fail(file, 'expected exactly one h1, found ' + h1s.length);

  // Controls: every input, select and textarea needs an accessible name (label for=, wrapping label or aria-label).
  for (const tag of html.match(/<(input|select|textarea)\b[^>]*>/gi) || []) {
    if (/type="hidden"/i.test(tag)) continue;
    const id = /\sid="([^"]+)"/i.exec(tag);
    const named = /aria-label="[^"]+"/i.test(tag) || /aria-labelledby=/i.test(tag);
    const forLabel = id && new RegExp('<label[^>]*\\sfor="' + id[1] + '"', 'i').test(html);
    if (!named && !forLabel) {
      // A control inside a label element is also named.
      const index = html.indexOf(tag);
      const before = html.slice(0, index).lastIndexOf('<label');
      const closed = html.slice(0, index).lastIndexOf('</label>');
      if (!(before > closed)) fail(file, 'form control without a label: ' + tag.slice(0, 90));
    }
  }

  // Buttons need visible text or an aria-label.
  for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)) {
    const attrs = m[0].slice(0, m[0].indexOf('>'));
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (!text && !/aria-label=/i.test(attrs)) fail(file, 'button without a name: ' + m[0].slice(0, 90));
  }

  // Results containers must announce changes.
  for (const tag of html.match(/<[a-z]+\b[^>]*(data-tool-result|data-quote-result|data-job-cost-result|data-generated-checklist)[^>]*>/gi) || []) {
    if (!/aria-live=|role="(status|alert|list)"/i.test(tag) && !/data-generated-checklist/.test(tag)) {
      fail(file, 'results container has no live region: ' + tag.slice(0, 90));
    }
  }
  if (resultRoots.test(html) && !/@media print/i.test(read('assets/styles.css'))) {
    fail(file, 'no print stylesheet found for calculator results');
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('PASS: ' + sources.length + ' calculator pages pass static accessibility checks');
