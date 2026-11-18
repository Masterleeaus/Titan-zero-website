# Business tools release check and QA

This is the release gate for the 19 Titan Zero calculators and their directory (#46). Run it before any change to the calculators, the shared engine, the tool pages or the tool styles is merged or deployed.

## Build and check command

Run from the repository root:

```bash
node scripts/tools-release-check.mjs
```

For the browser-based steps, install the two helpers into a folder outside the repository and point the command at them:

```bash
npm install --prefix "$HOME/tools-deps" jsdom@24 puppeteer-core@23
JSDOM_DIR="$HOME/tools-deps" PUPPETEER_DIR="$HOME/tools-deps" CHROME_PATH=/usr/bin/google-chrome \
  node scripts/tools-release-check.mjs
```

The command runs eight steps in order and stops at the first failure:

1. JavaScript syntax for the engine, the controller, the directory script and the site script.
2. Unit tests: formulas against the recorded fixtures, seeded property tests, validation, industry data, directory data and copy, and the wiring contract.
3. Site gate: source and published copies match, canonicals, sitemap, links, headings and image alt text.
4. Parity: every calculator copy matches its source, and the engine loads before the controller.
5. Static accessibility: live regions, labels and print styles on each calculator.
6. Break-even edge cases.
7. jsdom smoke test of the live calculators (31 checks).
8. Browser smoke test in headless Chrome: 19 calculator pages at 320, 390, 768 and 1280 pixels. It checks for horizontal scrolling, script errors, labelled fields, focus moving to the result after a submit, the print layout, and a result when browser storage is full (249 checks).

The result is printed as one line per step. A failing step prints `RELEASE BLOCKED` and exits with status 1.

## Where the gate runs

- `tools-regression.yml`, job `release-check`: runs on pull requests and on pushes to `main` that touch the calculators.
- `interserver-marketing.yml`, job `validate`: runs before the release archive is built, so a failing check stops the deploy job.

Repository owners should also mark the `release-check` job as a required status check in branch protection. That setting is outside the repository.

## Test report

Last full run: 8 of 8 steps passed (unit tests 470 pass, 0 fail; DOM smoke 31 checks; browser smoke 249 checks). The CI run for each pull request is the record. Browser findings from the earlier manual pass are in `docs/qa/browser-qa-report.md`.

## Manual QA checklist

Run this after the automated gate passes, on a real phone or tablet where possible.

- [ ] Open each calculator from `/tools/` on a phone-width screen. No sideways scrolling.
- [ ] Fill in the default values and select Calculate. The result heading takes focus, and the screen reader reads the result.
- [ ] Enter an invalid value (blank, negative, or more than two decimals on money). An error message appears and takes focus.
- [ ] Use Tab only. Every field and button can be reached, and each field has a visible label.
- [ ] Print or save as PDF. The site header, footer and buttons are hidden, and the result is kept.
- [ ] Turn off JavaScript. The directory still lists all 27 tools with their descriptions, and every link works.
- [ ] Search the directory for `quote`, then clear it. The count message updates.
- [ ] Quote builder: change a price, a discount and the GST mode. The total updates and adds up.
- [ ] Job-cost sheet: the result matches the figures entered, and costs are kept apart from price and GST.
- [ ] Clear browser storage and reload. The calculators still work and show a result.
- [ ] The upgrade block shows Front Desk Free and the seven upgrade links, with the approved AI prices and "Request a quote" for the apps.

## Rollback guidance

- Do not force-push `main` and do not revert a merged pull request in place. Open a new branch and a new pull request that restores the earlier file contents, and let the release check run on it.
- If a deploy has already happened, redeploy the last release whose commit passed `tools-release-check`. Each release archive carries a `SHA256SUMS` file for its exact contents.
- Saved assumptions stay in the browser and a rollback does not delete them. Known limit: an older page that cannot read a newer saved profile starts from starter values, and its first save replaces that profile. After a rollback that changes the profile format, users may need to clear their saved profile.
- After a rollback, rerun the check command on the restored commit and repeat the manual checklist on one calculator from each group.
