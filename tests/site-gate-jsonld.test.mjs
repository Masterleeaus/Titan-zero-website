import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonLdProblems } from '../scripts/site-gate.mjs';

const block = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

test('valid structured data with no ratings passes', () => {
  assert.deepEqual(jsonLdProblems(block({ '@type': 'WebPage', name: 'Front Desk' }), 'pages/frontdesk.html'), []);
});

test('unparseable JSON-LD fails', () => {
  const html = '<script type="application/ld+json">{"@type": </script>';
  assert.equal(jsonLdProblems(html, 'pages/x.html').length, 1);
});

test('aggregateRating and review claims fail, even nested', () => {
  const html = block({ '@type': 'SoftwareApplication', name: 'Front Desk', aggregateRating: { ratingValue: 5 } })
    + block({ '@graph': [{ '@type': 'Review', review: {} }] });
  const problems = jsonLdProblems(html, 'pages/frontdesk.html');
  assert.equal(problems.length, 2);
  assert.match(problems[0], /aggregateRating/);
});

test('plugin pages reject unapproved prices and accept approved ones', () => {
  assert.equal(jsonLdProblems(block({ offers: { price: 49 } }), 'frontdesk/index.html').length, 1);
  assert.deepEqual(jsonLdProblems(block({ offers: { price: 29 } }), 'frontdesk/index.html'), []);
  assert.deepEqual(jsonLdProblems(block({ offers: { price: 49 } }), 'pricing/index.html'), []);
});
