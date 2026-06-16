---
status: in-jira: FHS-332
date: 2026-06-16
found-by: oduniyi (manual exploration)
severity: high (core feature visuals broken)
---

# World Flags images broken — CSP blocks flag / map / landmark hosts

## What the user sees

In World Flags → Explore facts panel (e.g. Angola): the flag shows as an
emoji instead of a real flag, the capital map is a grey box with a
broken map-marker image, and the landmark photo is a broken-image
placeholder.

## Root cause

The app's `Content-Security-Policy` (meta tag in `apps/web/index.html`,
FHS-170) only allows images from `'self' data: blob:` and restricts
`connect-src` to our own hosts. The World Flags feature pulls images and
data from public services that were never added to the policy:

- `flagcdn.com` — real flag images (so flags fell back to emoji).
- `*.tile.openstreetmap.org` — Leaflet map tiles (grey box).
- `unpkg.com` — Leaflet's default marker icon (broken marker image).
- `upload.wikimedia.org` — landmark photos.
- `en.wikipedia.org` — the landmark-photo lookup `fetch()` (a
  `connect-src`, silently blocked → placeholder).

## The fix

1. Extend the CSP `img-src` to allow `https://flagcdn.com`,
   `https://*.tile.openstreetmap.org`, `https://upload.wikimedia.org`,
   `https://*.wikimedia.org`.
2. Extend `connect-src` to allow `https://en.wikipedia.org` (the
   landmark lookup).
3. Bundle Leaflet's marker icons through Vite (`leaflet/dist/images/*`)
   so they're served from our own origin — no `unpkg` host needed in the
   CSP, and the pin works even if a CDN is down.

The emoji / placeholder fallbacks stay as the safety net for when a host
is genuinely unreachable.

## Acceptance criteria

**Scenario: facts panel images load**

- Given the Explore facts panel for a country
- When it is shown
- Then the real flag image, the capital map with a visible marker, and
  the landmark photo all load

**Scenario: real flag on the flashcard**

- Given a flag flashcard
- When it is shown
- Then the real flag image renders (not the emoji fallback)

**Scenario: graceful fallback still works**

- Given an image host is genuinely unreachable
- Then the emoji / placeholder fallback shows (no broken-image icon)
