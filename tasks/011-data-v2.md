---
id: 011
title: Saved data version 2 (settings and goal purchases)
depends_on: [009]
status: todo
---

## Goal
In `src/storage.js` (see docs/adr/0003):
- `validateState` accepts version 1 exactly as before and version 2 with
  `settings: { trackSpending: boolean }` and `goalPurchases: [{ id, date, cents, name }]`
  (ids like `x1`, names follow the goal-name rules).
- `upgradeState(state)`: version 1 to version 2; `trackSpending` is on if there are
  purchases. Version 2 passes through unchanged.
- `newState()`: an empty version 2 state with the 50/30/20 split, tracking off.
- `balances` subtracts goal purchases from Goals. Validation rejects Goals below zero.
- `setTrackSpending(state, on)`, `removeGoalPurchase(state, id)`.
- `removePaycheck` is blocked if it would leave Goals below zero (money already used to
  buy a goal), with its own error.

## Done when
Tests first in `tests/storage.test.js` (added, none changed): v2 validation (good and bad
shapes), upgrade keeps every v1 record, tracking default, balances with goal purchases,
the new remove rules, round trip through backup. `./check.sh` passes. No UI change.
