# Front Desk documentation and status (issue #14)

Status as of 2026-11-18. This file is the status record. All topics now live on one route, `/frontdesk-docs/`. Rows marked Open still need the plugin or billing work.

Version data: `assets/upgrade-catalogue.json` (version 2026-11-18). That file is the source for upgrade names, routes, AI prices and status.

| Topic | Where it is covered now | Public route | Status |
|---|---|---|---|
| Free installation | Documentation page and support link | `/frontdesk-docs/#install` | Plugin is not on WordPress.org. Download comes from support. |
| Plugin compatibility and upgrades | Own page, linked from the hub and footer | `/frontdesk-compatibility/` (overview: `/frontdesk-docs/#compatibility`) | Published. Checked against released version 3.0.128. Not on WordPress.org. |
| Hosted AI Assistant opt-in | Documentation page | `/frontdesk-docs/#assistant` | In development. Not available to buy. |
| Agent Team permissions | Documentation page | `/frontdesk-docs/#agent-team` | In development. Not available to buy. |
| Privacy and consent | Own page, linked from the hub and footer | `/frontdesk-privacy/` (overview: `/frontdesk-docs/#privacy`) | Published. Checked against version 3.0.128. Consent for hosted AI is described, not yet built. |
| Billing cancellation | Own page, linked from the hub and footer | `/frontdesk-billing/` (overview: `/frontdesk-docs/#billing`) | Published. Says no billing is live. Terms are drafts pending legal review. |
| Troubleshooting | Own page, linked from the hub and footer | `/frontdesk-troubleshooting/` (overview: `/frontdesk-docs/#troubleshooting`) | Published. Checked against version 3.0.128. |
| Service status | Own page, linked from the hub and footer | `/frontdesk-status/` (overview: `/frontdesk-docs/#status`) | Published. States that no status page exists and that hosted services are not live. |

Per-topic routes (issue #91): each page links to `/support/`, and each is linked from `/frontdesk/` and the footer. `/frontdesk-docs/` remains the overview.

Rules for any page in this set:
- Use the canonical support URL `/support/` for help.
- Do not link to a WordPress.org listing or a checkout until each one exists.
- Prices come only from `assets/upgrade-catalogue.json`.

Follow-up: see the issue comment for issue #14 for the list of routes to build.
