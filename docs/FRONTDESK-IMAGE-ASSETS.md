# Front Desk images and assets (issue #6)

Status as of 2026-11-18. Source of truth for what images the Front Desk pages use.

## Concept images added (issue #6)

| Page | Image files | Source | Licence |
|---|---|---|---|
| `pages/frontdeskai.html` | `assets/frontdesk-ai-concept-{640,960,1280}.webp` | `docs/frontdesk-images-src/assistant-concept.html`, rendered in headless Chrome | Original work by this repository. No third-party assets. |
| `pages/frontdeskagent.html` | `assets/frontdesk-agent-concept-{640,960,1280}.webp` | `docs/frontdesk-images-src/agent-team-concept.html`, rendered in headless Chrome | Original work by this repository. No third-party assets. |

- Both are labelled "Conceptual demonstration" in the caption and in the image. They show a planned pattern, not a live product screen.
- Colours: AI teal `#00CFD2` for the Assistant, Agent violet `#A648F9` for the Agent Team, deep blue `#286cdc` for the primary button and the Free plugin.
- Pro: `pages/frontdeskpro.html` says Front Desk Pro is no longer offered, so it gets no image. The "Pro deep blue" colour is applied to the free plugin.
- Snapshots of the Assistant page at 1280 px and 390 px are in `docs/qa/snapshots/`. Built on 2026-11-18.
- Still missing: verified UI captures of Front Desk Free from a released plugin build. No WordPress install or released build was available when these were made.

## What the pages use

| Page | Images | Notes |
|---|---|---|
| `pages/frontdesk.html` | 8 emblem images | All are brand emblems with `alt=""` (decorative). No product screenshot. |
| `pages/frontdeskai.html` | 8 emblem images | Same as above. |
| `pages/frontdeskagent.html` | 8 emblem images | Same as above. |

No product screenshot, UI capture or diagram is published on any Front Desk page.

## Unused files in `assets/`

These three WebP files exist but no page references them (checked with a repository-wide search).

| File | What it shows (by inspection) | Fit with the approved palette |
|---|---|---|
| `assets/frontdesk-ai-hero.webp` | Dark desk scene with a red lamp and a laptop with a blank screen. Not a product UI. | Red accent. Assistant is specified as teal. Does not match. |
| `assets/frontdesk-agent-hero.webp` | Teal-toned desk scene with a laptop showing a calendar-style grid. Looks like a stock or generated scene. | Teal. Agent Team is specified as violet. Does not match. |
| `assets/frontdesk-pro-hero.webp` | Violet abstract scene with a phone map pin and a calendar grid. | Violet. Pro is retired, so this image must not be used for a live offer. |

No provenance or licence record exists for these files in the repository. They are not verified UI captures. Do not publish them as product screenshots.

## Gap list

1. No verified UI captures of Front Desk Free (booking form, admin calendar, reports). Needed before any screenshot is shown.
2. No captures of the hosted Assistant or Agent Team. Both are in development, so a screenshot must be labelled as a conceptual demonstration.
3. No responsive WebP set. The existing files are single 1600 px images with no `srcset`.
4. Colour mapping in the specification (Pro deep blue, AI teal, Agent violet) does not match the three unused files.
5. No recorded image payload, contrast or layout shift test.

## Rules for any future image

- Alt text must describe what the image shows, or be empty when it is decorative. Never describe a feature that is not released.
- Label conceptual images as conceptual on the page, next to the image.
- Record the source and licence in this file before publishing.
- Add `width` and `height`, and `loading="lazy"` below the fold.

The site gate already rejects any `<img>` with no `alt` attribute (`scripts/site-gate.mjs`, check 4).
