import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from '../scripts/site-gate.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skip = (src) => !/\/\.git(\/|$)/.test(src);

// Each test works on its own copy of the repository, so a deliberate break never touches the tree.
function copyRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'site-gate-'));
  cpSync(REPO, dir, { recursive: true, filter: skip });
  return dir;
}

test('the real repository passes the gate', () => {
  const { problems } = check(REPO);
  assert.deepEqual(problems, []);
});

test('a published copy that drifts from its source fails the gate', () => {
  const dir = copyRepo();
  try {
    const copy = join(dir, 'pricing/index.html');
    writeFileSync(copy, readFileSync(copy, 'utf8') + '\n<!-- drift -->\n');
    const { problems } = check(dir);
    assert.ok(problems.some((p) => /drift: pricing\/index\.html differs from pages\/pricing\.html/.test(p)), problems.join('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Front Desk hub must be listed in the sitemap', () => {
  const dir = copyRepo();
  try {
    const sitemap = join(dir, 'sitemap.xml');
    writeFileSync(sitemap, readFileSync(sitemap, 'utf8').replace('https://titanzero.io/frontdesk/', 'https://titanzero.io/frontdesk-removed/'));
    const { problems } = check(dir);
    assert.ok(problems.some((p) => p === 'sitemap.xml is missing /frontdesk/'), problems.join('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an in-page link with no matching id fails the gate', () => {
  const dir = copyRepo();
  try {
    const page = join(dir, 'pages/frontdesk.html');
    // Add a broken in-page link to the page itself; the page has no href="#services" to rewrite.
    writeFileSync(page, readFileSync(page, 'utf8').replace('</body>', '<a href="#no-such-section">Skip</a></body>'));
    // Keep the published copy in step so only the anchor rule fires.
    writeFileSync(join(dir, 'frontdesk/index.html'), readFileSync(page));
    const { problems } = check(dir);
    assert.ok(problems.some((p) => /in-page link #no-such-section has no matching id/.test(p)), problems.join('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
