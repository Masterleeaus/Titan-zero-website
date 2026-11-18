# Browser QA report

Date: 2026-11-18
Scope: every published page listed by `scripts/site-gate.mjs` (69 pages, including the homepage and `/frontdeskpro/`, which is `noindex` and not in the sitemap by design).
Method: local static server on the repo root, headless Google Chrome via Playwright. Pages were loaded at 320px, 768px and 1280px. Keyboard checks ran on fresh pages. Calculator tools were filled with sample values and submitted. No site pages were edited.

## Result

- Pages checked: 69
- Defect groups: 3 (all P1). No P0 found.
- Passed on every page: no console errors, no failed or 4xx/5xx requests, no broken internal links (every internal link on every page resolved), every image has an `alt` attribute, every form field has a label, the skip link works, the main navigation is reachable by Tab, and the mobile menu toggle at 320px opens.
- Calculators: 20 calculator pages were exercised (19 with forms, plus the checklist generator). Every one showed a result after sample input, and none threw an error.

## Defects by type

### 1. Horizontal scroll at 320px (P1)

Pages: `/`, `/apps/build/`, `/apps/desk/`, `/platform/`, `/pricing/`, `/tools/quote-builder/`

- Page width is 343px to 384px at a 320px viewport. The page scrolls sideways (confirmed: `scrollX` reaches 64px on `/platform/`).
- Overflowing elements include the comparison table on the homepage, the flow strip items on `/platform/`, and the quote workspace and quote step blocks on `/pricing/`.

Reproduce: open the page at 320px wide and try to scroll sideways.

### 2. Horizontal scroll at 768px on the quote builder (P1)

Page: `/tools/quote-builder/`

- Page width is 818px at a 768px viewport, a 50px overflow. The overflowing text is in a `span` and a `strong` at about 810px to 818px.

Reproduce: open `/tools/quote-builder/` at 768px wide and scroll sideways.

### 3. Text below WCAG AA contrast on dark backgrounds (P1)

Pages: `/`, `/apps/build/`, `/apps/desk/`, `/how-it-works/`, `/platform/`, `/workforce/`

- Brand purple (`rgb(166,72,249)`) and brand red (`rgb(243,34,56)`) text on near-black navy backgrounds measures 4.09:1 to 4.50:1. The AA minimum for this text size is 4.5:1.
- Affected text includes the suite link labels on the homepage, "ScheduledAt.Work" and "SuperchargedAt.Work" on `/platform/`, the step numbers on `/how-it-works/`, the section labels on `/workforce/`, and the record and section labels on `/apps/desk/`.
- Method note: this was measured from computed colours against the nearest opaque background. Gradients and background images were not sampled, so the figures are estimates. They are still close enough to the threshold to fix.

Reproduce: open the page at 1280px, zoom into the coloured labels named above, and check them with a contrast tool.

## Checks with no defects found

- Console errors and page errors: none on any page at any width tested.
- Failed or 4xx/5xx requests: none.
- Internal links: all resolved, checked with HTTP status on every unique target.
- Images without `alt`: none.
- Form fields without a label: none.
- Buttons and links without an accessible name: none.
- Skip link: present on all 69 pages, first in tab order, and moves focus to `#main` on Enter.
- Main navigation: reachable by Tab on every page after the skip link.
- Focus indicator: every tab stop checked had a visible outline or box-shadow on focus.
- Mobile menu at 320px: the toggle is visible and sets `aria-expanded="true"` on every page.
- Calculators: the `/tools/` search returns a count, and all 19 calculators with forms showed results. The checklist generator (no submit button) updated its output when its inputs changed.

## Limits of this run

- Keyboard-only use was checked with Tab and Enter. Screen reader output was not tested.
- Focus-visible was judged from computed outline and box-shadow only.
- Contrast was sampled from computed styles, not from rendered pixels.
- Calculators were checked with one sample set of inputs, not with expected numbers.
