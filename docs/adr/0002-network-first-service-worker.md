# 2. Service worker: network first, cache as fallback

Date: 2026-11-07. Status: accepted.

## Context
A cache-first service worker can keep serving an old version after an update unless a
version number is bumped by hand, and there is no build step to do it.

## Decision
The service worker precaches the app's own files on install. For every same-origin GET
it tries the network first and falls back to the cache when offline, updating the cache
when the network answers. It never fetches anything from another origin.

## Consequences
- Online, the teen always gets the latest files; offline, the last ones they had.
- On a slow connection, opening waits for the network. Acceptable for a tiny app.
- A test checks that every file the page needs is in the precache list.
