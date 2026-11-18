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
