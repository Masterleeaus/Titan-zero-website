// Publishing check for the calculator pages (#46). Run from the repository root:
//   node scripts/check-tool-parity.mjs
// Fails when a clean-URL copy differs from its source page, or when a page with
// calculator roots does not load the engine before tools.js.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

const root = new URL('../', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');
const calculatorRoot = /data-tools-app|data-quote-builder|data-job-cost|data-checklist-tool/;
const failures = [];

const sources = readdirSync(join(root, 'pages')).filter((name) => /^tool-.*\.html$/.test(name));
assert.ok(sources.length >= 11, 'expected the 11 calculator source pages');
for (const file of sources) {
  const slug = file.replace(/^tool-/, '').replace(/\.html$/, '');
  const copy = join(root, 'tools', slug, 'index.html');
  if (!existsSync(copy)) { failures.push('missing clean-URL copy for ' + file); continue; }
  if (read('pages/' + file) !== read('tools/' + slug + '/index.html')) failures.push('copy differs from source: ' + file);
}

const pagesWithCalculators = [...sources.map((f) => 'pages/' + f), ...sources.map((f) => 'tools/' + f.replace(/^tool-/, '').replace(/\.html$/, '') + '/index.html')];
for (const path of pagesWithCalculators) {
  const html = read(path);
  if (!calculatorRoot.test(html)) continue;
  const engine = html.indexOf('/assets/tools-engine.js');
  const tools = html.indexOf('/assets/tools.js');
  if (engine < 0 || tools < 0 || engine > tools) failures.push('engine must load before tools.js: ' + path);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('PASS: ' + sources.length + ' calculator pages match their clean-URL copies and load the engine first');
