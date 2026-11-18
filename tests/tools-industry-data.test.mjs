// Validates the industry starter data behind the calculators and checklists (#46).
// Every starter value must pass the same rules a user's input passes, and every checklist must be usable.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const E = require('../assets/tools-engine.js');
const src = readFileSync(new URL('../assets/site-data.js', import.meta.url), 'utf8');
const data = JSON.parse(src.slice('window.TITAN_SITE_CONTENT='.length).replace(/;\s*$/, ''));
const industries = data.industries;
const knownKeys = new Set(E.ASSUMPTION_KEY_LIST);
const LEGACY_PERCENT_KEYS = new Set(['current', 'overdue']);
const ruleFor = (key) => Object.values(E.RULES).map((rules) => rules[key]).find(Boolean);

test('industries have unique ids and slugs, each with a name, summary and route (at least ten)', () => {
  assert.ok(industries.length >= 10, 'expected at least ten industries, got ' + industries.length);
  assert.equal(new Set(industries.map((i) => i.id)).size, industries.length);
  assert.equal(new Set(industries.map((i) => i.slug)).size, industries.length);
  for (const i of industries) {
    assert.ok(/^[a-z-]+$/.test(i.id), 'id ' + i.id);
    assert.ok(i.name.trim() && i.summary.trim() && i.route.startsWith('/'), i.id);
  }
});

test('every starter default is a known assumption key and passes its engine rule', () => {
  for (const i of industries) {
    for (const [key, value] of Object.entries(i.defaults)) {
      // 'current' and 'overdue' are legacy starter percentages kept for the checklist and migration tests.
      if (LEGACY_PERCENT_KEYS.has(key)) {
        assert.ok(value >= 0 && value <= 100, i.id + '.' + key + ' is a percentage');
        continue;
      }
      assert.ok(knownKeys.has(key), i.id + ': unknown assumption ' + key);
      assert.equal(typeof value, 'number', i.id + '.' + key + ' must be a number');
      assert.ok(Number.isFinite(value), i.id + '.' + key + ' must be finite');
      const rule = ruleFor(key);
      if (!rule) continue; // share and stage keys are checked by the engine's own profile rules
      assert.ok(value >= rule.min && value <= rule.max, i.id + '.' + key + ' = ' + value + ' is outside ' + rule.min + ' to ' + rule.max);
      if (rule.kind === 'money') assert.ok(Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, i.id + '.' + key + ' has more than two decimals');
    }
  }
});

test('every industry has a checklist of 3 to 30 tasks, each a short non-empty sentence', () => {
  for (const i of industries) {
    const list = data.checklists[i.id];
    assert.ok(Array.isArray(list), i.id + ' checklist');
    assert.ok(list.length >= 3 && list.length <= 30, i.id + ' has ' + list.length + ' tasks');
    for (const task of list) {
      assert.equal(typeof task, 'string', i.id);
      assert.ok(task.trim().length > 0 && task.length <= 240, i.id + ' task: ' + task.slice(0, 40));
    }
    assert.equal(new Set(list).size, list.length, i.id + ' repeats a task');
  }
});

test('no checklist or industry copy uses pressure wording', () => {
  const pressure = /limited time|act now|hurry|last chance|guarantee|guaranteed|today only|don.t miss/i; // "urgent call-outs" describes a service, not a sales push
  for (const i of industries) assert.doesNotMatch(i.summary + ' ' + i.description, pressure, i.id);
  for (const [id, list] of Object.entries(data.checklists)) for (const task of list) assert.doesNotMatch(task, pressure, id);
});
