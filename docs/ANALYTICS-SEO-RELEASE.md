# Analytics, SEO, structured data and release verification (issue #7)

Status as of 2026-11-18. Covers what is implemented, what is planned, and how a release is checked.

## 1. Analytics: current state

- No analytics script is installed. A repository search for `gtag`, `googletagmanager`, `google-analytics`, `plausible` and `utm_` finds nothing in the HTML or JavaScript.
- No tracking runs before consent. Nothing is sent to a third party when a page loads.
- Consent module: `assets/analytics-consent.js` (issue #90). It makes no network request, records nothing by default, and pushes events to `window.dataLayer` only after consent. It is **not yet included on any page**; no `frontdesk*` event fires until the owner signs off and the routes are verified.
- Consent decision: default is no tracking. Owner sign-off is **pending**.

## 2. Planned CTA funnel (not implemented)

Stages: view, compare, connect, checkout.

| Stage | Example page | Event name (planned) | Sent only when |
|---|---|---|---|
| View | `/frontdesk/` | `frontdesk_view` | Consent given |
| Compare | `/pricing/#front-desk-offers`, `/frontdesk/#selector` | `upgrade_compare` | Consent given |
| Connect | `/support/` opened from the selector | `upgrade_enquiry` | Consent given |
| Checkout | None. No checkout exists yet. | none | Not applicable |

Rules:
- Events carry the upgrade id from `assets/upgrade-catalogue.json` and nothing personal.
- The selector's choices are not sent anywhere. The support link opens without the selection being recorded.
- No `frontdesk*` event fires until the server routes are verified (see `docs/PUBLISHING.md`).

## 3. UTM convention (planned)

- `utm_source`: the channel, for example `wordpress_org`, `email`, `search`.
- `utm_medium`: `cpc`, `email`, `social`, `referral`.
- `utm_campaign`: lower-case, hyphenated, for example `front-desk-launch`.
- Use UTMs on inbound links only. Never add them to canonical URLs or to links inside the site.

## 4. Structured data review

| Page | Schema in use | Status |
|---|---|---|
| All pages | `Organization`, `WebSite`, `WebPage` | Present. Checked by the gate for valid JSON. |
| `/frontdesk/` | `WebPage` with `about: SoftwareApplication` | Accurate. No rating, offer or price is declared. |
| `/pricing/` | `WebPage` | Accurate. Name updated to "Titan Zero Core". |

Rules enforced by the gate (`jsonLdProblems` in `scripts/site-gate.mjs`):
- Every JSON-LD block must parse.
- No `aggregateRating`, `review` or `reviews` key. No ratings or testimonials are approved.
- On plugin and Front Desk pages, any `price` must be an approved amount (A$19, A$29, A$39, A$79, A$99, A$129).

`SoftwareApplication` offers are not declared. Add them only after the price is approved in `assets/upgrade-catalogue.json`.

## 5. Crawl, sitemap and robots

- `sitemap.xml` lists every indexable public page. The gate checks each one resolves to a file.
- Each page has a canonical link that matches its public URL with a trailing slash.
- `robots.txt` references the sitemap.

## 6. Hosting publication map and rollback

- Clean-URL mapping and hosting requirements: `docs/PUBLISHING.md`.
- The repository has no `.php` or `.htaccess`. The live host must serve folder `index.html` files for trailing-slash URLs.
- Rollback: restore the previous commit of `pages/` and the clean-URL folders, run `node scripts/site-gate.mjs check`, then copy the repository to the host without `.git`.

## 7. Deployment smoke test

Run after each publish. Replace `HOST` with the live origin.

1. `node scripts/site-gate.mjs check` passes on the commit being published.
2. `curl -sI https://HOST/frontdesk/` returns `200`.
3. `curl -s https://HOST/sitemap.xml` includes `https://titanzero.io/frontdesk/`.
4. Open `/frontdesk/#selector` at 320 px and at desktop width. Tick two upgrades and confirm the summary updates. Confirm no console errors.
5. Confirm `/frontdesk/` canonical is `https://titanzero.io/frontdesk/`.

Items 2 to 5 were not run against the live host in this change. Repository checks only.

Issue #90 attempt (2026-11-18): `curl` to `https://titanzero.io/` and `/frontdesk/` failed with connection resets from the agent proxy (`recentRelayFailures` for `titanzero.io:443`). Step 4 needs a browser. Re-run the full list from an unrestricted network after merge.
