# Tool calculations (issues #24-#33)

Pure calculation code lives in `assets/tool-calcs.js` and is tested by `tests/tool-calcs.test.mjs`.
The tool pages (`pages/tool-*.html`) and their UI code (`assets/tools.js`) call it. Nothing is sent to a server.
All rates, shares and costs are entered by the user. No statutory rate, price, ROI or savings figure is built in.

## Shared rules
- Monthly conversion uses 52 weeks / 12 months. Daylight-saving changes are not modelled.
- Percentages are limited to 0-100 and rejected outside that range.
- Negative money, hours or counts are rejected with a message.
- Quotes and job costs are stored or shown in whole cents (quotes) or as floating-point values rounded only for display (job cost).
- Saved data stays in `localStorage` on the device. Quotes and checklist drafts never go in a URL.

## Per tool
| Issue | Page | What changed | Known gaps |
|---|---|---|---|
| #24 | tool-admin-cost | Admin value (hours x 52/12 x rate, unchanged default). Reclaim, cash and reinvestment shares; cash only counted when entered. | No comparison scenarios; no Supercharged/Agent scenario text. |
| #25 | tool-should-i-hire | On-cost split (super, leave, other; defaults keep the old 18% total). Roster utilisation, contractor comparison at equal billable hours, jobs needed (rounded up, exact shown). | Extra-hours threshold is computed but not shown. |
| #26 | tool-job-profitability | Overhead, GST-inclusive or exclusive revenue, discount, gross margin and markup labelled separately, target price, reconciliation test. | Not linked to the job-cost sheet. |
| #27 | tool-capacity-planner | Theoretical and bookable jobs; leave, days, non-billable time, travel buffer, cancellations. Zero and negative duration refused. | No staff/skill coverage; no link to ScheduledAt.Work. Route feasibility not inferred. |
| #28 | tool-missed-calls | Opportunity (unchanged default), recoverable share, contribution, messaging cost. Results labelled assumed, not guaranteed. | No weighted scenarios; no channel split; no product link. |
| #29 | tool-lead-conversion | Four-stage funnel (contacted, qualified, booked, completed), baseline vs scenario, revenue and contribution. Over-100 refused, negative uplift shown as reduction. | Simple single-rate mode removed; no product link. |
| #30 | tool-invoice-collection | Ageing buckets (0-30, 31-60, 61-90, 90+), payment terms in days (default 30) deciding which buckets are beyond terms, 13-week expected cash split into weeks 1-4 and 5-13 by one user share, hours per A$1,000 beyond terms, link to the 13-week cash flow forecast. Not guaranteed; collection is not revenue. | No real invoice dates or per-invoice schedule; the 4-week share is one assumption; no separate simple-mode toggle (the first inputs are the simple entry). |
| #31 | tool-quote-builder | Quote reference, validity counted from the saved date (until date shown), scope, exclusions, terms, GST modes (none, exclusive, inclusive), cent rounding, local save with the latest version and up to five earlier versions, reopen any stored version, delete, JSON download, print. Customer name stored only with consent and removed from every stored version when consent is withdrawn. Saved values are validated before storage. | Only single-user local storage; no PDF file generation beyond print; the JSON download still includes any customer name typed, by the user's choice. |
| #32 | tool-job-cost-sheet | Multiple labour lines, materials with markup, equipment, mileage, travel, contingency, overhead, target price. Costs kept separate from GST and price. | No live transfer to the quote builder (`costToQuoteLine` is ready). |
| #33 | tool-checklist-generator | Stable task keys; ticks, notes and custom tasks survive re-rendering and template revisions; reorder, edit, remove; local draft; explicit confirmation before a service-type switch; sign-off note; print. | No file export; the site has 10 industries, not 11. |

## Decisions made without asking
- #31: earlier versions are kept up to five per quote on this device. Withdrawing consent removes the customer name from all stored versions.
- #31: handoff links carry no quote data. The optional copy button copies a totals summary only, without customer, scope or line detail.
- #30: a bucket counts as beyond terms only when it starts after the terms day, so a bucket that straddles the due day is not counted. Default terms are 30 days, which keeps the 31+ day rule.
- #30: "simple mode" is kept as the first inputs (invoices, average, ageing shares, hours). New terms and cash-timing inputs have defaults, so the simple entry still works without changes.
- Admin cash share defaults to 0 so no cash saving is counted until the user enters one.
- Missed-call reach defaults to 0 so no recovery is assumed by default.
- Lead and invoice stage/collection defaults are starter values for illustration; the page says so.
- #31: quote validity runs from the saved date of the version (UTC calendar days). Unsaved drafts use today. Re-saving starts a new validity period.
