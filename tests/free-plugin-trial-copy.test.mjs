import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, freePluginCopyProblems } from '../scripts/site-gate.mjs';

// Issue #69: the free plugin must never read as a trial or sandbox.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skip = (src) => !/\/\.git(\/|$)/.test(src);

function copyRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'free-plugin-copy-'));
  cpSync(REPO, dir, { recursive: true, filter: skip });
  return dir;
}

test('the real repository passes the free plugin copy rules', () => {
  const { problems } = check(REPO);
  assert.deepEqual(problems, []);
});

test('Front Desk and plugin pages that call the free plugin a trial or sandbox fail', () => {
  assert.equal(freePluginCopyProblems('<p>Try the free trial today.</p>', 'frontdesk/index.html').length, 1);
  assert.equal(freePluginCopyProblems('<p>A sandbox version of the plugin.</p>', 'plugins/index.html').length, 1);
  assert.equal(freePluginCopyProblems('<p>Trialware is not allowed.</p>', 'apps/desk/index.html').length, 1);
});

test('trial words in scripts and markup attributes do not count as visible copy', () => {
  const html = '<script>const trialDays = 14;</script><p class="sandbox-note">Bookings are free.</p>';
  assert.deepEqual(freePluginCopyProblems(html, 'frontdesk/index.html'), []);
});

test('pages outside the free plugin set are not checked by this rule', () => {
  assert.deepEqual(freePluginCopyProblems('<p>No paid trial is offered.</p>', 'pricing/index.html'), []);
});

test('a Front Desk hub that drops the no-licence-key promise fails the gate', () => {
  const dir = copyRepo();
  try {
    const hub = join(dir, 'pages/frontdesk.html');
    const html = readFileSync(hub, 'utf8').replace(/no licence key/gi, 'no account');
    writeFileSync(hub, html);
    writeFileSync(join(dir, 'frontdesk/index.html'), html);
    const { problems } = check(dir);
    assert.ok(problems.some((p) => /no licence key/.test(p)), problems.join('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('trial framing added to the Front Desk hub fails the gate', () => {
  const dir = copyRepo();
  try {
    const hub = join(dir, 'pages/frontdesk.html');
    const html = readFileSync(hub, 'utf8').replace('<p class="lede">', '<p class="lede">Start a free trial of the plugin. ');
    writeFileSync(hub, html);
    writeFileSync(join(dir, 'frontdesk/index.html'), html);
    const { problems } = check(dir);
    assert.ok(problems.some((p) => /must not describe a trial or sandbox/.test(p)), problems.join('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
