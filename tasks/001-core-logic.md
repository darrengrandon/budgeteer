---
id: 001
title: Core budget logic
depends_on: []
status: todo
---

## Goal
Implement `splitIncome`, `weeksToGoal` and `averageWeeklyIncome` in `src/budget.js`.

## Done when
- `./check.sh` passes.
- `tests/budget.test.js` is unchanged.

## Notes
- Use integer math. Percents are whole numbers, so `Math.floor(amount * pct / 100)`
  is exact, and the leftover cents go out one at a time by largest remainder.
- Bad input throws a `RangeError`.
- Parse `YYYY-MM-DD` with `Date.UTC`, not `new Date(string)` in local time.
