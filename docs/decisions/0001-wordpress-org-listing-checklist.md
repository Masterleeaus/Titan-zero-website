# Decision record 0001: WordPress.org plugin listing checklist

**Status:** Partly complete. Issue #87 stays open.
**Date:** 18 November 2026
**Scope:** The Titan Zero Trades plugin listing on WordPress.org: readme, admin screens and trademark use.

## What was read

- The WordPress.org plugin guidelines index (github.com/WordPress/wporg-plugin-guidelines) was read. It lists 18 numbered guidelines.
- The full text of each guideline file was not read. The source was not reachable from this session, so each item below needs the full text checked before submission.

## Guideline list and status

Status key: **Not yet checked** means the plugin code or readme has not been audited. **Permitted** means the rule does not block the approach.

1. GPL v2 compatibility: not yet checked (licence in plugin readme and files).
2. Developers responsible for plugin contents and actions: noted; no action.
3. A stable version available from the directory page: not yet checked (release step).
4. Code mostly human readable: not yet checked.
5. Trialware not permitted: not yet checked. The free plugin must work without a paid tier.
6. Software as a service permitted: permitted. Hosted AI upgrades are a service, and the terms say so.
7. No tracking without user consent: not yet checked. Must be audited in the plugin.
8. No executable code sent through third-party systems: not yet checked.
9. Nothing illegal, dishonest or morally offensive: noted; no action.
10. No external links or credits on the public site without permission: not yet checked. Must be audited in the plugin's public output.
11. Do not hijack the admin dashboard: not yet checked. Must be audited in the admin screens.
12. Readmes must not spam: not yet checked. Must be checked in the plugin readme.
13. Use WordPress default libraries: not yet checked.
14. Avoid frequent commits: noted; a release-process item.
15. Increment version numbers for each release: noted; a release-process item.
16. A complete plugin at submission: noted; a release-process item.
17. Respect trademarks, copyrights and project names: not yet checked. Needs a trademark and project-name check before submission.
18. Directory maintenance: noted; no action.

## Decisions made in this record (for review)

- No paid-upgrade banner or notice appears in any admin screen. The paid AI upgrades are offered on the website and in the plugin's readme only, not as banners.
- No tracking runs without user consent. Any analytics must be opt-in and off by default.
- The readme does not name third-party trade software brands unless the directory rules allow it. The readme uses only the plugin's own name.
- Trademark and project-name use is checked before submission. Until that check is done, the listing is not submitted.

## Open items before submission

- Read the full text of guidelines 1 to 18 and record the result for each item.
- Audit the plugin's admin screens for banners and dashboard changes (guidelines 10 and 11).
- Audit the plugin for tracking and external calls (guidelines 7 and 8).
- Check the readme for spam and third-party brand names (guideline 12).
- Complete the trademark and project-name check (guideline 17).

The plugin code and readme are in the plugin repository. This record covers the site side and the decisions only.
