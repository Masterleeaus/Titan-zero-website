// Wiring for the browser run and keyboard focus on the calculators (#108). The browser run itself is
// scripts/tools-browser-check.mjs (run in CI by the `browser` job). These checks keep its parts connected.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const repo = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('the browser run covers the 19 calculator pages at phone and desktop widths (#108)', () => {
  const script = repo('scripts/tools-browser-check.mjs');
  assert.ok(existsSync(new URL('../scripts/tools-browser-check.mjs', import.meta.url)));
  assert.match(script, /WIDTHS = \[\{ name: 'phone', width: 375/);
  assert.match(script, /name: 'desktop', width: 1280/);
  assert.match(script, /\/\^tool-\.\*\\\.html\$\//, 'routes come from the 19 tool-*.html sources');
  assert.match(script, /KNOWN_LAYOUT = new Map/, 'known layout issues are listed, not hidden');
});

test('the browser job runs in CI and uploads its report for the release checklist (#108)', () => {
  const workflow = repo('.github/workflows/tools-regression.yml');
  assert.match(workflow, /^  browser:$/m);
  assert.match(workflow, /node scripts\/tools-browser-check\.mjs/);
  assert.match(workflow, /name: tools-browser-report/);
  assert.match(workflow, /playwright@1\.63\.0/, 'the Playwright version is pinned');
  assert.match(repo('docs/PUBLISHING.md'), /tools-browser-report/);
});

test('print keeps the result and hides handoff buttons and assumptions controls (#108)', () => {
  const css = repo('assets/styles.css');
  assert.match(css, /@media print\{\.result-actions,\.handoff-review,\.handoff-offer,\.assumptions-tools\{display:none!important\}\}/);
});

test('keyboard focus: a refused input moves focus to its error, a result moves focus to the result (#108)', () => {
  const source = repo('assets/tools.js');
  assert.match(source, /const error=resultElement\.querySelector\('\.form-error'\);\s*if\(error\)\{error\.tabIndex=-1;error\.focus\(\);\}/);
  assert.match(source, /addHandoffButtons\(resultElement,context\);\nresultElement\.tabIndex=-1;resultElement\.focus\(\);/);
});
