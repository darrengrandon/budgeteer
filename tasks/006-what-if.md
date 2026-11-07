---
id: 006
title: What-if slider
depends_on: [005]
status: todo
---

## Goal
A slider that moves percent between Spend and Goals (Save stays fixed) and updates
every goal's "weeks to go" live. A "Use this split" button applies it to future
paychecks only.

## Done when
- A pure function computes the projection for a trial split. Tests first.
- Moving the slider changes nothing in stored data until the button is pressed.
- `./check.sh` passes, and it feels responsive in a real browser.
