---
id: 005
title: Goals with progress and weeks to go
depends_on: [002, 003]
status: todo
---

## Goal
- Add, rename and delete goals (name, target amount).
- `src/goals.js` with `allocateToGoals(goalsBucketCents, goals)`: fills goals top to
  bottom, each up to its target, and returns the saved cents per goal. Tests first.
- Each goal shows a progress bar and "about N weeks to go", using
  `averageWeeklyIncome` times the Goals percent, then `weeksToGoal`.
- With no income yet, say "Log a paycheck to see a date" instead of showing Infinity.
- A finished goal says so.

## Done when
`./check.sh` passes, and in a real browser the weeks change as paychecks are added.
