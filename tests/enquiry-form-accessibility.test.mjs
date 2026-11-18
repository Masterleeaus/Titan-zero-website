import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const html = read('pages/support.html');
const form = /<form data-enquiry-form\b[^>]*>[\s\S]*?<\/form>/.exec(html)[0];
const controls = [...form.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)]
  .map((m) => ({ tag: m[1], attrs: m[2] }))
  .filter((c) => !/type="(hidden|submit|button)"/i.test(c.attrs));
const labelFor = (id) => {
  const m = new RegExp(`<label\\b[^>]*for="${id}"[^>]*>([\\s\\S]*?)<\\/label>|<label\\b[^>]*for="${id}"[^>]*>([\\s\\S]*?)<(input|select|textarea)`).exec(form);
  return m ? (m[1] ?? m[2]) : null;
};

test('enquiry form no longer asks for a business name (issue 73)', () => {
  assert.doesNotMatch(form, /name="business"/);
});

test('only the reply email and the message are required (issue 73)', () => {
  const required = controls.filter((c) => /\brequired\b/.test(c.attrs)).map((c) => /name="([^"]+)"/.exec(c.attrs)[1]);
  assert.deepEqual(required.sort(), ['email', 'message']);
});

test('every enquiry control has a visible label linked to it (issue 74)', () => {
  for (const c of controls) {
    const id = /\bid="([^"]+)"/.exec(c.attrs)[1];
    assert.ok(labelFor(id), `no label for #${id}`);
  }
});

test('required fields say (required) in their label text (issue 74)', () => {
  for (const c of controls.filter((x) => /\brequired\b/.test(x.attrs))) {
    const id = /\bid="([^"]+)"/.exec(c.attrs)[1];
    assert.match(labelFor(id), /\(required\)/, `label for #${id} must say (required)`);
  }
});

test('error messages name the field and give a fix in words (issue 74)', () => {
  const js = read('assets/site.js');
  assert.match(js, /Reply email: enter the address we should reply to/);
  assert.match(js, /Reply email: check the address\. It needs an @ and a domain/);
  assert.match(js, /What are you trying to improve\? Write a sentence or two/);
  assert.doesNotMatch(js, /Please enter more than spaces/);
});
