import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { summarise, formatLine } = require('../assets/upgrade-selector.js');
const catalogue = JSON.parse(readFileSync(new URL('../assets/upgrade-catalogue.json', import.meta.url), 'utf8'));

test('selector prices match the approved catalogue', () => {
  const assistant = catalogue.upgrades.find((u) => u.id === 'assistant');
  const agent = catalogue.upgrades.find((u) => u.id === 'agent-team');
  assert.equal(summarise(['assistant']).aiMonthly, assistant.priceMonthly);
  assert.equal(summarise(['agent-team']).aiMonthly, agent.priceMonthly);
  assert.equal(summarise(['agent-team']).aiMonthly, catalogue.bands.Standard.agentTeam);
});

test('no selection means Front Desk Free only', () => {
  const s = summarise([]);
  assert.deepEqual(s.ai, []);
  assert.equal(s.aiMonthly, 0);
  assert.deepEqual(s.apps, []);
  assert.match(s.notes[0], /Front Desk Free only/);
});

test('Agent Team plus Assistant is billed once at the Agent Team price', () => {
  const s = summarise(['assistant', 'agent-team']);
  assert.deepEqual(s.ai.map((a) => a.id), ['agent-team']);
  assert.equal(s.aiMonthly, 99);
  assert.ok(s.notes.some((n) => /billed once/.test(n)));
});

test('app choices are independent, carry no price and add nothing to the total', () => {
  const s = summarise(['supercharged', 'scheduled', 'sorted', 'skilled']);
  assert.equal(s.apps.length, 4);
  assert.equal(s.aiMonthly, 0);
  assert.match(formatLine(s), /Price on request/);
});

test('all six options combine without double counting', () => {
  const s = summarise(['assistant', 'agent-team', 'supercharged', 'scheduled', 'sorted', 'skilled']);
  assert.equal(s.ai.length, 1);
  assert.equal(s.apps.length, 4);
  assert.equal(s.aiMonthly, 99);
});

test('unknown or duplicate ids are ignored and never produce a checkout', () => {
  const s = summarise(['pro', 'assistant', 'assistant', '<script>']);
  assert.deepEqual(s.ai.map((a) => a.id), ['assistant']);
  assert.equal(s.aiMonthly, 29);
  assert.equal(s.apps.length, 0);
});

test('summary never says checkout, order or payment completed', () => {
  const text = formatLine(summarise(['assistant', 'supercharged']));
  assert.doesNotMatch(text, /checkout|order placed|paid|provisioned/i);
});
