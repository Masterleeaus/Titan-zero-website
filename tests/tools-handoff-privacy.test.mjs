// Regression for Website issue #43: pricing/support links must never leak tool data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/tools.js', import.meta.url), 'utf8');
const start = source.indexOf('function toolContextUrl(route){');
const end = source.indexOf('\nfunction textNode(', start);
assert.ok(start !== -1 && end > start, 'Privacy-safe handoff functions must exist');

const snippet = source.slice(start, end) +
  '\n({ toolContextUrl, safeHandoffSummary, addHandoffButtons })';

function element(tag) {
  return {
    tag, children: [], listeners: {}, attributes: {},
    append(...children) { this.children.push(...children); },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { this.focused = true; },
    select() { this.selected = true; }
  };
}

function environment(clipboard) {
  const context = {
    URL,
    navigator: { clipboard },
    document: { createElement: element },
    pageUrl: route => new URL(route, 'https://titanzero.io/').href,
    escContext: value => String(value || '').trim().slice(0, 240),
    createLink(text, href, className = 'text-link') {
      const node = element('a');
      node.href = href;
      node.textContent = text;
      node.className = className;
      return node;
    },
    textNode(tag, text, className) {
      const node = element(tag);
      node.textContent = text;
      node.className = className;
      return node;
    },
    window: { print() {} }
  };
  return runInNewContext(snippet, context);
}

const sensitive = {
  tool: 'Quote builder',
  vertical: 'Cleaning',
  business: 'PRIVATE-CUSTOMER-BUSINESS',
  customer: 'PRIVATE-CUSTOMER-NAME',
  service: 'PRIVATE-CUSTOMER-SERVICE',
  staff: 'PRIVATE-STAFF-NAME',
  result: 'Quote total A$123',
  calculation: 'Subtotal A$100; GST A$10.'
};

test('pricing/support URLs contain no tool_context or private calculation fields', () => {
  const { toolContextUrl } = environment();
  for (const route of ['pricing/', 'support/']) {
    const uri = new URL(toolContextUrl(route, sensitive));
    assert.equal(uri.origin, 'https://titanzero.io');
    assert.equal(uri.pathname, '/' + route);
    assert.equal(uri.search, '');
    assert.equal(uri.hash, '');
    for (const value of Object.values(sensitive)) {
      assert.equal(uri.href.includes(String(value)), false);
    }
  }
  assert.doesNotMatch(source, /searchParams\.set\(\s*['"]tool_context['"]/);
});

test('manual summary excludes business, customer, service and staff identifiers', () => {
  const { safeHandoffSummary } = environment();
  const text = safeHandoffSummary(sensitive);
  assert.match(text, /Quote total A\$123/);
  assert.match(text, /Cleaning/);
  for (const key of ['business', 'customer', 'service', 'staff']) {
    assert.equal(text.includes(sensitive[key]), false, 'must exclude ' + key);
  }
});

test('handoff buttons never transmit context and copy only on explicit click', async () => {
  let written;
  const { addHandoffButtons } = environment({
    async writeText(value) { written = value; }
  });
  const parent = element('section');
  addHandoffButtons(parent, sensitive);
  const row = parent.children.find(node => node.tag === 'div');
  const links = row.children.filter(node => node.tag === 'a');
  assert.equal(links.length, 2);
  for (const link of links) assert.equal(new URL(link.href).search, '');
  assert.equal(written, undefined, 'no automatic clipboard or network handoff');
  const button = row.children.find(node => node.textContent === 'Copy calculation for manual sharing');
  assert.ok(button);
  await button.listeners.click();
  assert.match(written, /Quote total A\$123/);
  assert.doesNotMatch(written, /PRIVATE-/);
});

test('clipboard denial falls back to selectable local text without external transfer', async () => {
  const { addHandoffButtons } = environment(undefined);
  const parent = element('section');
  addHandoffButtons(parent, sensitive);
  const button = parent.children[0].children.find(
    node => node.textContent === 'Copy calculation for manual sharing'
  );
  await button.listeners.click();
  const fallback = parent.children.find(node => node.tag === 'textarea');
  assert.ok(fallback, 'manual copy field exists');
  assert.equal(fallback.readOnly, true);
  assert.equal(fallback.focused, true);
  assert.equal(fallback.selected, true);
  assert.match(fallback.value, /Quote total A\$123/);
  assert.doesNotMatch(fallback.value, /PRIVATE-/);
});
