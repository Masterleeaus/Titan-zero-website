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

## Removed in issue #89

The three unused files below were deleted on 2026-11-18. No page referenced them. Their colours did not match the approved palette, Pro is retired, and no provenance record existed.

- `assets/frontdesk-ai-hero.webp`
- `assets/frontdesk-agent-hero.webp`
- `assets/frontdesk-pro-hero.webp`

`tests/frontdesk-concept-images.test.mjs` now fails if any `assets/frontdesk-*.webp` file is not referenced by a page.

## Measurements (issue #89, 2026-11-18)

Measured in headless Chrome against a local server. The layout-shift value is the cumulative score from the `layout-shift` observer, read 4 seconds after load.

| Page | Cumulative layout shift | Concept image sizes (bytes) | Caption contrast |
|---|---|---|---|
| `/frontdeskai/` | 0.0000, 0 shift entries | 640 px 16,000; 960 px 28,478; 1280 px 39,964 | 11.34:1 |
| `/frontdeskagent/` | 0.0000, 0 shift entries | 640 px 14,342; 960 px 25,000; 1280 px 36,058 | 11.34:1 |

- Image payload: the concept image adds about 16 KB on a 390 px phone and about 28 KB at 960 px. The above-the-fold brand emblem is 23,520 bytes.
- No text is placed over an image. Captions sit below each image on a solid background, so no text-over-image contrast check applies.
- Snapshots at 1280 px and 390 px: `docs/qa/snapshots/frontdeskai-*.png` and `docs/qa/snapshots/frontdeskagent-*.png`.

## Still missing (issue #89)

- Verified UI captures of Front Desk Free from a released plugin build, with the build version recorded. No WordPress install or released build was available to this agent.
- Snapshots of Front Desk Free, because there is no captured Free screen yet.

## Former unused files (historical, removed in #89)

These three WebP files were unused before issue #89 removed them.

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
