---
id: 012
title: Weekly pay from paycheck gaps, readiness dates, "Got paid?" rule
depends_on: [011]
status: done
---

## Goal
New `src/pay.js` (SPEC.md "The numbers", docs/adr/0004):
- `paydays(paychecks, todayISO)`, `usualGapDays(paychecks, todayISO)`,
  `weeklyPay(paychecks, todayISO)` → `{ cents, days }` or null,
  `weeklySpendCents(pay, spendPercent)`, `gotPaidDue(paychecks, todayISO)`.
- `projectGoals(state, today, split, pay)` in `src/goals.js` takes an optional exact
  weekly pay; without it, it behaves exactly as now (its tests stay).
- `addDays(iso, n)` in `src/budget.js` for "around <date>".

## Done when
Tests first: one payday (14-day gap), weekly and every-2-weeks pay, two paychecks on one
day, an irregular gap, future paychecks ignored, exact fractions, the nudge just before
and after its threshold. `./check.sh` passes.
