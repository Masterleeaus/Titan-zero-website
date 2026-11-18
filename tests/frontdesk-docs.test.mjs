// Front Desk documentation route (issue #14): every topic exists, contents links resolve,
// canonical support URLs are used, and no unapproved price, rating or live status claim appears.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const docs = readFileSync(join(ROOT, 'pages/frontdesk-docs.html'), 'utf8');
const published = readFileSync(join(ROOT, 'frontdesk-docs/index.html'), 'utf8');
const APPROVED = new Set([19, 29, 39, 79, 99, 129]);

const TOPICS = ['install', 'compatibility', 'assistant', 'agent-team', 'privacy', 'billing', 'troubleshooting', 'status'];

test('published copy matches the source page', () => {
  assert.equal(published, docs);
});

test('one h1 and canonical URL for the documentation route', () => {
  assert.equal((docs.match(/<h1\b/gi) || []).length, 1);
  assert.match(docs, /<link rel="canonical" href="https:\/\/titanzero\.io\/frontdesk-docs\/">/);
});

test('every documentation topic has a section with an id and appears in the contents', () => {
  for (const id of TOPICS) {
    assert.ok(docs.includes(`id="${id}"`), `section #${id} exists`);
    assert.ok(docs.includes(`href="#${id}"`), `contents links #${id}`);
  }
});

test('in-page links resolve to ids on the page', () => {
  for (const m of docs.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(docs.includes(`id="${m[1]}"`), `anchor #${m[1]} resolves`);
  }
});

test('support is linked through the canonical support URL', () => {
  assert.ok(docs.includes('href="/support/"'));
});

test('only approved A$ amounts appear and no ratings or reviews are claimed', () => {
  for (const m of docs.matchAll(/A\$(\d+)/g)) {
    assert.ok(APPROVED.has(Number(m[1])), `A$${m[1]} is approved`);
  }
  assert.doesNotMatch(docs, /aggregateRating|"review"|\breviews?\b/i);
});

test('no Pro product is offered and status is not claimed as live', () => {
  assert.doesNotMatch(docs, /(buy|get|download|subscribe to|upgrade to) (the )?Pro\b/i);
  assert.match(docs, /There is no Pro plugin or Pro download/);
  assert.match(docs, /No live status feed is published yet/);
  assert.match(docs, /No billing is live yet/);
});

test('the Front Desk hub links to the documentation from its body, not the shared footer', () => {
  const hub = readFileSync(join(ROOT, 'pages/frontdesk.html'), 'utf8');
  assert.match(hub, /href="\/frontdesk-docs\/"/);
});
