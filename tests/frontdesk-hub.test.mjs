// Front Desk hub (issues #9, #11): one free plugin with two optional hosted AI services.
// No separate Pro product, the customer journey is shown, and connected apps are not claimed as live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const hub = readFileSync(join(ROOT, 'pages/frontdesk.html'), 'utf8');
const catalogue = JSON.parse(readFileSync(join(ROOT, 'assets/upgrade-catalogue.json'), 'utf8'));

test('hub has one h1 and the hero offers both free and upgrade actions', () => {
  assert.equal((hub.match(/<h1\b/gi) || []).length, 1);
  assert.match(hub, /href="\/support\/">Get the free plugin</);
  assert.match(hub, /href="#upgrades">Explore upgrades</);
});

test('hub never offers a separate Pro plugin, Pro ZIP or Pro subscription', () => {
  assert.doesNotMatch(hub, /\bPro\b/);
  assert.doesNotMatch(hub, /frontdeskpro/);
  assert.doesNotMatch(hub, /Pro (plugin|download|subscription|plan)/i);
});

test('hub shows the enquiry, booking and job delivery journey with honest status', () => {
  const journey = /<section[^>]+id="journey"[\s\S]*?<\/section>/.exec(hub);
  assert.ok(journey, 'journey section exists');
  for (const stage of ['Enquiry:', 'Booking:', 'Job delivery:']) {
    assert.ok(journey[0].includes(stage), `journey has stage ${stage}`);
  }
  assert.match(journey[0], /not live yet/);
  assert.match(journey[0], /planned future integrations/);
});

test('hub links every catalogue upgrade route and shows approved hosted prices', () => {
  for (const u of catalogue.upgrades) {
    assert.ok(hub.includes(`href="${u.route}"`), `hub links ${u.route}`);
  }
  assert.ok(hub.includes('A$29 per month'));
  assert.ok(hub.includes('A$99 per month'));
});

test('hub does not claim the connected apps are live or priced', () => {
  for (const u of catalogue.upgrades.filter((x) => x.type === 'connected-app')) {
    assert.equal(u.priceMonthly, null, `${u.id} has no approved price`);
  }
  assert.doesNotMatch(hub, /Connections? (are|is) live now/i);
});
