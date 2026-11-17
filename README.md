# Titan Zero website

The public website for Titan Zero, the vendor brand behind the Titan Zero WordPress plugin suite and the Titan BOS apps. It is a static site: plain HTML, CSS and vanilla JavaScript, with no server-side code. The live host serves the files as they are.

Live domain: https://titanzero.io

## What the site covers

- **Home** (`/`) and the Titan BOS overview.
- **Plugins** (`/plugins/`): the nine WordPress plugins in the Titan Zero suite, each with its feature list and AI upgrade band price.
- **Front Desk** (`/frontdesk/`, `/frontdeskai/`, `/frontdeskagent/`): the Scheduling & Enquiries Manager plugin and its hosted AI upgrades. `/frontdeskpro/` is a retired page that redirects to `/frontdesk/`.
- **Apps**: the four connected apps, SuperchargedAt.Work, ScheduledAt.Work, SortedAt.Work and SkilledAt.Work.
- **Pricing** (`/pricing/`): free plugins, AI upgrade bands and app upgrades.
- **Tools, resources, industries, support and FAQ**.
- **Legal**: `/terms/`, `/fair-use/`, `/privacy/`, and a terms page for each plugin at `/<plugin>-terms/`.

Legal pages marked "Draft" are pending legal review.

## Pricing rules on the site

- All prices are in AUD and include GST.
- AI upgrades (AI Assistant and AI Agent Team) follow the approved bands:
  - Light: A$19 / A$79 per month
  - Standard: A$29 / A$99 per month
  - Heavy: A$39 / A$129 per month
- Scheduling & Enquiries Manager is Standard: A$29 Assistant, A$99 Agent Team.
- App upgrade prices are not set. Show "request quote" until they are approved.
- Do not publish a price that is not in the approved list.

## Repository layout

| Path | Purpose |
|---|---|
| `pages/*.html` | Source of every page. Edit content here. |
| `<clean-url>/index.html` | Copies of `pages/` files, one folder per clean URL. Generated; keep them in step with their source. |
| `index.html` | Homepage. |
| `assets/` | Shared CSS, JavaScript, images and icons. |
| `apps/`, `tools/`, `resources/`, `industries/` | Section pages and their folders. |
| `docs/PLUGIN-SPECS.md` | Build specification for the plugins, generated from the plugin data. |
| `docs/PUBLISHING.md` | Clean URL mapping and the publishing steps. |
| `downloads/` | Files offered for download. |
| `tests/`, `scripts/` | Node tests and helper scripts. |
| `sitemap.xml`, `robots.txt` | Search engine files. `robots.txt` points to the sitemap. |

Read `docs/PUBLISHING.md` before changing any page or URL.

## Making a change

1. Edit the source file in `pages/`.
2. Regenerate the clean-URL folders so each `index.html` matches its source.
3. Add any new public URL to `sitemap.xml`.
4. Check that every local link resolves.
5. Run the tests (see below) and check the page in a browser at mobile and desktop widths.
6. Commit to `main` and push.

## Tests

The Node tests are in `tests/` and run one file at a time:

```bash
node --test tests/break-even.test.mjs tests/tools-handoff-privacy.test.mjs
```

Running `node --test tests/` on the folder fails, because Node reads the folder as a module. Pass the file names.

## Related repositories

- `Masterleeaus/Titan-Zero-Trades-Front-Desk`: the Scheduling & Enquiries Manager WordPress plugin. Its `readme.txt`, `changelog.txt` and `docs/SINGLE-PLUGIN-AI-SERVICES-ARCHITECTURE.md` are the authoritative sources for the plugin.
- `Masterleeaus/Scheduled`, `Masterleeaus/Skilled`, `Masterleeaus/Sorted` and `Masterleeaus/Supercharged`: the four connected apps.

## Open items

- Legal review of all draft terms and the privacy policy.
- Issues #15, #16 and #41 still describe the earlier scope in their bodies. Dated update comments have been added; the bodies have not been edited.
- App upgrade prices.
