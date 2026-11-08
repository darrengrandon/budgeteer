---
id: 008
title: Playwright end-to-end flow
depends_on: [007]
status: done
---

## Goal
Add `@playwright/test` as a dev dependency and install Chromium. Serve the folder
with `python3 -m http.server` through Playwright's `webServer` option. One test
follows the whole teen flow:

set the split, log a paycheck, add a goal and read its weeks, move the what-if slider,
log a purchase, try to overspend and see it blocked, reload and confirm everything
persisted.

## Notes
- Write the test in plain JavaScript, not TypeScript.
- Before using Playwright's API, check its current docs (use the context7 tool if it
  is installed, otherwise the official docs) instead of relying on memory.
- `python3 -m http.server` is only a command to serve files. Do not write any Python.

## Done when
`./check.sh` runs it automatically (it already does once Playwright is installed) and
passes. Do not weaken an assertion to make it pass.
