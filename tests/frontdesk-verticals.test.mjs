// Issue #8: vertical conversion copy and FAQs come from one source and make no unsafe or unshipped claims.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, renderVerticals, renderFaqs } from '../scripts/build-frontdesk-verticals.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const content = JSON.parse(read('assets/frontdesk-content.json'));
const hub = read('pages/frontdesk.html');

const generatedText = () => renderVerticals(content) + renderFaqs(content);

test('the hub matches the central content source', () => {
  assert.equal(build(hub, content), hub, 'run node scripts/build-frontdesk-verticals.mjs');
});

test('the source covers the six verticals named in the issue', () => {
  const labels = content.verticals.map((v) => v.label.toLowerCase());
  for (const word of ['cleaning', 'trades', 'handyman', 'gardening', 'beauty', 'mobile']) {
    assert.ok(labels.some((l) => l.includes(word)), `missing vertical ${word}`);
  }
});

test('every vertical and approval rule is rendered on the hub', () => {
  for (const v of content.verticals) assert.ok(hub.includes(`<strong>${v.label}:</strong>`), `label ${v.label}`);
  for (const a of content.approvals) assert.ok(hub.includes(a.replace(/&/g, '&amp;')), `approval ${a.slice(0, 40)}`);
});

test('data ownership, export and ending questions are answered', () => {
  const questions = content.faqs.map((f) => f.question).join(' | ');
  assert.match(questions, /owns the booking/);
  assert.match(questions, /export/);
  assert.match(questions, /stop using Front Desk/);
  assert.match(questions, /stop paying for it/);
});

test('no certified, healthcare or unsupported automation claims', () => {
  const banned = /certified|medical|healthcare|health care|diagnos|guarantee|fully automated|zero effort|100%|no human/i;
  assert.doesNotMatch(JSON.stringify(content), banned);
  assert.doesNotMatch(generatedText(), banned);
});

test('AI capabilities are conditional on availability, never stated as live', () => {
  const present = /(?<!is available, it )\b(The )?(Assistant|Agent Team) (can|will|sends?|collects?|answers?|guides?)\b/;
  assert.doesNotMatch(generatedText(), present);
  assert.doesNotMatch(hub, /\b(The Assistant|The Agent Team) can\b/);
});

test('only approved A$ amounts appear in the generated copy', () => {
  const amounts = [...generatedText().matchAll(/A\$(\d+)/g)].map((m) => Number(m[1]));
  for (const a of amounts) assert.ok([19, 29, 39, 79, 99, 129].includes(a), `unapproved A$${a}`);
});

test('the generator refuses a page without its markers', () => {
  assert.throws(() => build('<p>no markers</p>', content), /must appear once/);
});
