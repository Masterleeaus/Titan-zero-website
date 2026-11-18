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

test('quote follow-up cadence has two steps, stop rules and a pending legal review note (issue 84)', () => {
  const t = text(read('pages/article-quote-follow-up.html'));
  assert.match(t, /Two follow-ups, then stop/);
  assert.match(t, /not now/);
  assert.match(t, /Pending legal review/);
  assert.match(t, /has not consented to receive marketing messages/);
  assert.match(t, /honoured within five working days/);
});

test('invoice follow-up guide links to the quote follow-up guide (issue 84)', () => {
  assert.match(read('pages/article-invoice-follow-up.html'), /href="\/resources\/quote-follow-up\/"/);
  assert.match(read('sitemap.xml'), /resources\/quote-follow-up\//);
});

test('profile photo guide covers leave-out rules, consent form, removal and APP 7 wording (issue 88)', () => {
  const t = text(read('pages/article-google-profile-photos.html'));
  assert.match(t, /Faces, including the customer/);
  assert.match(t, /House numbers, street names/);
  assert.match(t, /Customer photo consent/);
  assert.match(t, /When a customer asks you to remove a photo/);
  assert.match(t, /Australian Privacy Principle 7 \(APP 7\)/);
  assert.match(t, /Privacy Act 1988/);
  assert.match(t, /Pending legal review/);
});

test('profile photo guide is linked from the resources hub and sitemap (issue 88)', () => {
  assert.match(read('pages/resources.html'), /href="\/resources\/google-profile-photos\/"/);
  assert.match(read('sitemap.xml'), /resources\/google-profile-photos\//);
});
