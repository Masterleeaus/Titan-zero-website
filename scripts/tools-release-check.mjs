// One reproducible release check for the business tools (#46).
// Run from the repository root:
//   node scripts/tools-release-check.mjs
// Optional, for the browser-based steps (CI installs both into a temporary folder):
//   JSDOM_DIR=/path/with/jsdom PUPPETEER_DIR=/path/with/puppeteer-core CHROME_PATH=/usr/bin/google-chrome \
//     node scripts/tools-release-check.mjs
// Steps run in order and stop at the first failure. A failing step blocks deployment.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const steps = [
  ['JavaScript syntax (engine, controller, directory, site)', ['node', ['--check', 'assets/tools-engine.js', 'assets/tools.js', 'assets/site.js', 'assets/tools-directory.js']]],
  ['Unit tests: formulas, validation, fixtures, data and copy', ['node', ['--test', ...readdirSync(resolve(ROOT, 'tests')).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => 'tests/' + f)]]],
  ['Source and published copies, links, sitemap, canonicals', ['node', ['scripts/site-gate.mjs', 'check']]],
  ['Calculator parity: copies match sources, engine loads first', ['node', ['scripts/check-tool-parity.mjs']]],
  ['Static accessibility: live regions, labels, print styles', ['node', ['scripts/check-tool-a11y.mjs']]],
  ['Break-even edge cases', ['node', ['scripts/test-break-even.mjs']]],
];
if (process.env.JSDOM_DIR) steps.push(['DOM smoke test of the live calculators (jsdom)', ['node', ['scripts/tools-dom-smoke.cjs']]]);
else steps.push(['DOM smoke test of the live calculators (jsdom)', null]);
if (process.env.PUPPETEER_DIR) steps.push(['Browser smoke test at four widths, focus, print and storage quota', ['node', ['scripts/tools-browser-smoke.mjs']]]);
else steps.push(['Browser smoke test at four widths, focus, print and storage quota', null]);

const report = [];
let failed = null;
for (const [name, command] of steps) {
  if (failed) { report.push({ name, status: 'not run (earlier step failed)' }); continue; }
  if (!command) { report.push({ name, status: 'FAILED: dependency folder not set' }); failed = name; continue; }
  const [cmd, args] = command;
  const started = Date.now();
  const result = spawnSync(cmd, args, { cwd: ROOT, env: process.env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const output = ((result.stdout || '') + (result.stderr || '')).trim().split('\n').slice(-3).join(' | ');
  if (result.status === 0) report.push({ name, status: 'PASS (' + seconds + 's)', output });
  else { report.push({ name, status: 'FAILED (' + seconds + 's)', output }); failed = name; }
}

console.log('Titan Zero business tools release check');
console.log('Commit: ' + (spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout || 'unknown').trim());
console.log('');
for (const row of report) {
  console.log(row.status + '  ' + row.name);
  if (row.output && !row.status.startsWith('not run')) console.log('    ' + row.output.slice(0, 300));
}
console.log('');
if (failed) {
  console.error('RELEASE BLOCKED: ' + failed + '. Fix the failure, then rerun this command. See docs/tools-release.md.');
  process.exit(1);
}
console.log('RELEASE CHECK PASSED: all ' + steps.length + ' steps.');
