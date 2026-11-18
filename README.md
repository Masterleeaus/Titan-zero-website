# Titan Zero — public website, product catalogue and business tools

**Repository:** `Masterleeaus/Titan-zero-website` · **Public domain:** [titanzero.io](https://titanzero.io) · **Documentation review:** 18 November 2026

This is Titan Zero's **static marketing and public tools website** (HTML, CSS, JavaScript). It communicates the Titan Zero WordPress ecosystem, the four connected At.Work applications, service levels, pricing/catalogue, industry use cases and browser-based business calculators. This repository **does not host the booking engines, user account backends, AI agents or subscription services**.

A source page or GitHub CI check is not proof its matching route is deployed, configured and accessible on the actual public host.

## Product catalogue: what the website should explain

| Customer-facing product | Installation or activation | Product source of truth |
| --- | --- | --- |
| Titan Zero WordPress plugin suite | WordPress-local plugin functionality, according to each individual plugin's packaging | Individual plugin repositories/specifications, not this marketing site |
| **Scheduling & Enquiries Manager** | **One** locally usable Free WordPress plugin | [Front Desk canonical architecture](https://github.com/Masterleeaus/Titan-Zero-Trades-Front-Desk/blob/main/docs/SINGLE-PLUGIN-AI-SERVICES-ARCHITECTURE.md) |
| **Titan Zero AI Assistant** | Optional paid **hosted service**, enabled inside the same plugin | Front Desk [#47](https://github.com/Masterleeaus/Titan-Zero-Trades-Front-Desk/issues/47) and Central entitlements |
| **Titan Zero AI Agent Team** | Optional paid **hosted service**, enabled inside the same plugin, no extra Pro ZIP | Front Desk [#48](https://github.com/Masterleeaus/Titan-Zero-Trades-Front-Desk/issues/48) |
| **ScheduledAt.Work** | Connected booking, website and landing-page application | [Scheduled](https://github.com/Masterleeaus/Scheduled) |
| **SortedAt.Work** | Connected field operations, jobs, quotes and invoicing application; internal product rebrand still under review | [Sorted](https://github.com/Masterleeaus/Sorted) |
| **SkilledAt.Work** | Connected training, curriculum and verified competencies application | [Skilled](https://github.com/Masterleeaus/Skilled) |
| **SuperchargedAt.Work** | Connected business communications, marketing and AI workforce application | [Supercharged](https://github.com/Masterleeaus/Supercharged) |

The six **optional upgrades around Front Desk** are AI Assistant, AI Agent Team and the **four** At.Work apps. Central is shared backend infrastructure, not an additional customer-facing optional app subscription. Historical `/frontdeskpro/` may be retained as a redirect/explanatory page only; **never offer a second Pro plugin for sale**. Keep official spelling **Enquiries**.

## Public site architecture

| Path | Role |
| --- | --- |
| `index.html` | Root homepage |
| `pages/*.html` | Canonical source for static secondary pages |
| `<clean-route>/index.html` | Generated published copies; must be byte/content synchronized with source where required |
| `assets/` | Site styles, accessible components, static JS and [upgrade catalogue](assets/upgrade-catalogue.json) |
| `apps/`, `plugins/`, `tools/`, `resources/`, `industries/` | Published route folders |
| `scripts/site-gate.mjs` | Source/published sync, URL/canonical/link/SEO/asset consistency gate |
| `tests/` | Business calculator, financial precision, safety/consent and publishing regressions |
| `docs/PUBLISHING.md` | Authoritative static build, hosting and rollback runbook |
| `sitemap.xml`, `robots.txt` | Public crawl metadata; must match real deployed routes |

This is intentionally **not** a Next.js/WordPress theme. No server-side PHP or `.htaccess` implementation is shipped in this repository. The hosting server must deliver clean URL folders, HTTPS and correct redirects without exposing hidden files.

## Pricing, marketing truth and legal status

Commercial rates and approved/upcoming plan states are maintained in `assets/upgrade-catalogue.json`. Marketing prose may summarize the approved catalogue but **must not invent amounts or claim hosted plan billing is already live merely because a price appears**. Site copy presently describes AUD prices inclusive of GST and existing **Light / Standard / Heavy** Assistant/Agent Team bands; independently check the catalogue and current commercial approval before changing prices. Connected-app prices remain unapproved/request-quote unless recorded otherwise.

Descriptions must distinguish **available static marketing**, **shipped locally usable plugin features**, **source code under test**, **hosted service features in development**, and **production deployed**. Legal pages marked draft require actual legal review. Do not represent conceptual agent screens or mock screenshots as production customer sessions.

## Make a site change

1. Update `pages/*.html` (or root `index.html`) and shared data/assets; do not separately hand-edit the generated clean URL counterpart.
2. Run the existing generator and the release gate.
3. Confirm sitemap, canonical URL, Open Graph, favicon/alt text, keyboard targets, privacy/consent, image performance and desktop/mobile visual layout.
4. Run all applicable tool calculations, money-input invalid-state and localStorage migration tests.
5. Verify the deployment with HTTPS, real clean URL routing, no unexpected external form submissions and a documented rollback. Passing static tests alone does not establish public host readiness.

```bash
node scripts/site-gate.mjs sync
node scripts/site-gate.mjs check
node --test tests/break-even.test.mjs tests/tools-handoff-privacy.test.mjs
```

For a wider run, supply test **file paths** to `node --test`; do not simply pass a `tests/` directory. Always inspect [docs/PUBLISHING.md](docs/PUBLISHING.md) for the authoritative release method and actual host requirements.

## Public tools and data protection

The site carries an evolving toolkit of calculators and document helpers: service pricing, job profitability, hiring, capacity, lead conversion, quote/invoice collection, missed enquiries, break-even, bookings and cash-flow scenarios.

- All tools must use deterministic, testable formulas with correct currency/rounding, bounded input, invalid-state handling and transparent assumptions. **No fake certainty or financial guarantees.**
- Business/customer/staff/quote details remain local **unless the user explicitly opts in** to an appropriate transfer. Do not put `tool_context` JSON or personal data into shareable URL query parameters, telemetry, referrers or logs.
- A narrow privacy URL leak was remediated, but import/legacy handoff, versioned browser storage, clear/export, CSP and accessibility remain in [#43](https://github.com/Masterleeaus/Titan-zero-website/issues/43). Calculation and publishing gates remain in [#42](https://github.com/Masterleeaus/Titan-zero-website/issues/42) and [#46](https://github.com/Masterleeaus/Titan-zero-website/issues/46).

## Priority issues and release boundary

- **Static source integrity and deploy:** [#21](https://github.com/Masterleeaus/Titan-zero-website/issues/21), [#19](https://github.com/Masterleeaus/Titan-zero-website/issues/19), [#7](https://github.com/Masterleeaus/Titan-zero-website/issues/7).
- **One-plugin marketing accuracy:** [#1](https://github.com/Masterleeaus/Titan-zero-website/issues/1), [#4](https://github.com/Masterleeaus/Titan-zero-website/issues/4), [#9](https://github.com/Masterleeaus/Titan-zero-website/issues/9), [#15](https://github.com/Masterleeaus/Titan-zero-website/issues/15), [#17](https://github.com/Masterleeaus/Titan-zero-website/issues/17).
- **19-tool programme and privacy:** [#22](https://github.com/Masterleeaus/Titan-zero-website/issues/22), [#43](https://github.com/Masterleeaus/Titan-zero-website/issues/43), [#46](https://github.com/Masterleeaus/Titan-zero-website/issues/46).

View [all open website issues](https://github.com/Masterleeaus/Titan-zero-website/issues?q=is%3Aissue+is%3Aopen). Each issue requires real implementation/test acceptance. **No task becomes complete merely because a README or product page now describes it accurately.**

## Find every README and developer guide

- **[Complete README directory](docs/README_DIRECTORY.md)** — direct links to every README-style file in this repository, including component, test, vendor and historical documentation.
- **[Documentation index](docs/README.md)** — curated entry point to the main technical guides and developer workflows.
- **[Seven-repository platform map](https://github.com/Masterleeaus/Central/blob/main/docs/PLATFORM_MAP.md)** — cross-product architecture, ownership and integration boundaries.
