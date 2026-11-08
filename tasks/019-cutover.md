---
id: 019
title: Switch to the phone UI and retire the old one
depends_on: [018]
status: done
---

## Goal
First write the full teen flow for the new UI (`e2e/phone/teen-flow.spec.js`) at iPhone
and Pixel sizes. Then `phone.html` becomes `index.html` (same for the CSS and script), the
old page and its browser tests are removed, wording no screen uses is removed with its
tests (SPEC.md decision 10), and the contrast test checks the new colors. README updated.

## Done when
Every behavior an old browser test checked that still exists has a phone test. No
`tests/` logic test changed; `tests/budget.test.js` untouched. `./check.sh` passes.
