---
id: 015
title: Phone shell, first run, Home and the paycheck sheet
depends_on: [014]
status: todo
---

## Goal
Beside the old page (docs/adr/0006): `phone.html`, `phone.css`, `src/phone.js`.
- Narrow centered column, safe-area padding, 44px targets, no hover, light and dark.
- First run: "What are you saving for?" (skippable, with "Restore a backup" link), then
  the paycheck sheet titled "How much was your paycheck?" with "Not paid yet".
- Home: "Got paid? Log it." when due, the headline, goal cards (display only), and the
  "I got paid" button fixed at the bottom.
- Paycheck sheet (`<dialog>`): amount on `inputmode="decimal"`, friendly errors under the
  box, "Same as last time" chip, then the result (where the money went and each goal's
  timeline) with "Done" and "Undo".
- Saves through `saveChecked`; reloads when another tab saves.
- Playwright projects for iPhone 15 and Pixel 9 sizes (Chromium) run `e2e/phone/`.

## Done when
Phone tests first: first run with and without a goal, headline before and after a
paycheck, bad amounts change nothing, Same as last time, Undo, reload keeps data, two
tabs, nudge, no sideways scroll, every target at least 44px, no outside requests.
`./check.sh` passes; checked by screenshots at both sizes in both themes.
