import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Issue #18: reciprocal Front Desk sections on the four At.Work application pages.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APPS = ['app-desk', 'app-build', 'app-field', 'app-skilled'];

const section = (html) => {
  const m = /<section class="section subtle-section" id="front-desk"[\s\S]*?<\/section>/.exec(html);
  return m ? m[0] : '';
};
const text = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

for (const app of APPS) {
  test(`${app}: Front Desk section links back to /frontdesk/ and says no connection is live`, () => {
    const html = readFileSync(join(ROOT, 'pages', `${app}.html`), 'utf8');
    const s = section(html);
    assert.ok(s, `${app} has the Front Desk section`);
    assert.match(s, /href="\/frontdesk\/"/, 'links back to /frontdesk/');
    assert.match(text(s), /Front Desk Free/);
    assert.match(text(s), /No connection is live yet/);
    assert.match(text(s), /Consent:/);
  });

  test(`${app}: Front Desk section makes no claim of live sync`, () => {
    const html = readFileSync(join(ROOT, 'pages', `${app}.html`), 'utf8');
    const t = text(section(html));
    assert.doesNotMatch(t, /syncs? (automatically|in real time)/i);
    assert.doesNotMatch(t, /data use shown/i, 'no reference to data use that is not shown on the page');
  });

  test(`${app}: published copy matches source`, () => {
    const folder = { 'app-desk': 'desk', 'app-build': 'build', 'app-field': 'field', 'app-skilled': 'skilled' }[app];
    const src = readFileSync(join(ROOT, 'pages', `${app}.html`), 'utf8');
    const copy = readFileSync(join(ROOT, 'apps', folder, 'index.html'), 'utf8');
    assert.equal(copy, src);
  });
}
