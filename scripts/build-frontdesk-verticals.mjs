#!/usr/bin/env node
// Builds the Front Desk vertical list, approval boundaries and data FAQs from assets/frontdesk-content.json
// into pages/frontdesk.html (issue #8). The copy lives in one place, so the hub cannot drift from it.
//
//   node scripts/build-frontdesk-verticals.mjs          write the generated blocks into pages/frontdesk.html
//   node scripts/build-frontdesk-verticals.mjs --check  exit 1 if the page does not match the source
//
// After a write, run: node scripts/site-gate.mjs sync

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'assets/frontdesk-content.json';
const PAGE = 'pages/frontdesk.html';

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CHEVRON = '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

export function renderVerticals(content) {
  const items = content.verticals.map((v) => `<li><strong>${escape(v.label)}:</strong> ${escape(v.text)}</li>`).join('');
  const approvals = content.approvals.map((a) => `<li>${escape(a)}</li>`).join('');
  return `<ul class="industry-list" style="padding-left:20px;line-height:1.7;margin-top:24px">${items}</ul>`
    + `<h3 style="margin-top:32px">Approval boundaries</h3>`
    + `<ul class="approval-list" style="padding-left:20px;line-height:1.7;margin-top:16px">${approvals}</ul>`;
}

export function renderFaqs(content) {
  return content.faqs
    .map((f) => `<details class="faq-item"><summary>${escape(f.question)}${CHEVRON}</summary><div><p>${escape(f.answer)}</p></div></details>`)
    .join('');
}

function replaceBetween(html, start, end, body) {
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a < 0 || b < 0 || b < a || html.indexOf(start, a + 1) >= 0) throw new Error(`markers ${start} / ${end} must appear once, in order`);
  return html.slice(0, a + start.length) + body + html.slice(b);
}

export function build(html, content) {
  let out = replaceBetween(html, '<!-- fd-verticals:start -->', '<!-- fd-verticals:end -->', renderVerticals(content));
  out = replaceBetween(out, '<!-- fd-faq:start -->', '<!-- fd-faq:end -->', renderFaqs(content));
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const content = JSON.parse(readFileSync(join(ROOT, SOURCE), 'utf8'));
  const html = readFileSync(join(ROOT, PAGE), 'utf8');
  const next = build(html, content);
  if (process.argv.includes('--check')) {
    if (next !== html) {
      console.error(`${PAGE} does not match ${SOURCE} (run: node scripts/build-frontdesk-verticals.mjs)`);
      process.exit(1);
    }
    console.log(`${PAGE} matches ${SOURCE}`);
  } else {
    writeFileSync(join(ROOT, PAGE), next);
    console.log(`wrote ${PAGE} from ${SOURCE}`);
  }
}
