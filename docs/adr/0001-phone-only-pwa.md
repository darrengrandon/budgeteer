# 1. Phone-only installable web app

Date: 2026-11-07. Status: accepted.

## Context
The owner wants Budgeteer to feel like a phone app for teens who won't do setup work, but
the project allows only plain HTML, CSS and JavaScript, no frameworks, no build step and
no network calls.

## Decision
Make it a PWA: a web app manifest, PNG icons (made once from an SVG with a small script in
`tools/`; the PNGs are committed), and a plain-JavaScript service worker. Design only for
360-430px wide; wider screens show the same column centered. iPhone gets a help card for
"Add to Home Screen" because Safari has no install prompt.

## Consequences
- Installing needs HTTPS (or localhost). Hosting is outside this project.
- Safari on iPhone and the installed app can't be tested here; only Chromium with phone
  sizes can. SPEC.md lists what is untested.
