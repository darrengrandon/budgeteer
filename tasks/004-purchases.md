---
id: 004
title: Log a purchase from Spend
depends_on: [003]
status: done
---

## Goal
A purchase form (amount, note, date) that takes money out of the Spend bucket.

## Done when
- Tests first for the balance math, including exactly zero left and one cent over.
- Overspending is blocked with a message that says how much is available
  (unless SPEC.md "Decisions" says otherwise).
- `./check.sh` passes, and the feature works in a real browser.
