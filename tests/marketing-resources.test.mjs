// Marketing resource guides (issues 80-88): content rules that must not regress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('google review reply guide is published with the three templates', () => {
  assert.ok(existsSync(join(ROOT, 'resources/google-review-replies/index.html')));
  const t = text(read('pages/article-google-review-replies.html'));
  assert.match(t, /Template 1: thank-you/);
  assert.match(t, /Template 2: complaint/);
  assert.match(t, /Template 3: no written review/);
});

test('google review reply guide states reviews are never removed or hidden and replies need approval', () => {
  const t = text(read('pages/article-google-review-replies.html'));
  assert.match(t, /never deletes, hides or suppresses a review/);
  assert.match(t, /nothing is posted until a person has read and approved that reply/);
});

test('google review reply templates contain no customer personal details placeholders beyond business contact', () => {
  const t = text(read('pages/article-google-review-replies.html'));
  // Templates may only use [business name] and [phone or email] placeholders.
  const placeholders = [...t.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  for (const p of placeholders) assert.ok(['business name', 'phone or email'].includes(p), `unexpected placeholder [${p}]`);
});

test('resources hub and sitemap list the review reply guide', () => {
  assert.match(read('pages/resources.html'), /href="\/resources\/google-review-replies\/"/);
  assert.match(read('sitemap.xml'), /resources\/google-review-replies\//);
});

test('enquiry guide explains response tracking and publishes no response promise (issue 81)', () => {
  const t = text(read('pages/article-handling-service-enquiries.html'));
  assert.match(t, /Set a response promise only when you can keep it/);
  assert.match(t, /How the business tracks response time/);
  assert.match(t, /What counts as a first reply/);
  assert.match(t, /Pending legal review/);
});

test('no published page makes a fixed one-hour reply promise (issue 81)', async () => {
  const { readdirSync } = await import('node:fs');
  const promise = /\b(we|we'll|we will|our team will)\b[^.<]{0,40}\b(reply|respond|answer|call back)\w*\b[^.<]{0,30}\bwithin (one|1|an) (business )?hour\b/i;
  for (const f of readdirSync(join(ROOT, 'pages'))) {
    if (!f.endsWith('.html')) continue;
    assert.doesNotMatch(text(read(join('pages', f))), promise, `${f} makes a response promise`);
  }
});
