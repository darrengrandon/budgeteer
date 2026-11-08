# 7. The teen says how often they get paid

Date: 2026-11-08. Status: accepted (owner, lazy-v2 step 2). Changes decision 9 and ADR 0004.

## Context
Learning the gap from paycheck dates (ADR 0004) gets week one wrong for weekly earners:
with one payday it assumes 14 days, so "Spend about $X a week" shows half the real
amount. It also gets worse when a teen forgets a paycheck, because the skipped week
stretches the gap and lowers the weekly number.

## Decision
- After the first paycheck, one tap answers "How often do you get paid?": Every week,
  Every 2 weeks, Twice a month, Once a month, It's different every time. It can be skipped
  ("It's different every time"), and changed any time in Settings.
- A stated answer sets the usual gap however many paydays there are: 7, 14, 365 ÷ 24 or
  365 ÷ 12 days. Only "It's different every time" learns the gap from paycheck dates, as
  before. Weekly pay, goal dates, "Got paid? Log it." and the missed-paycheck chip all use
  this one gap.
- The gap is an exact fraction `{ num, den }`. Weekly pay stays exact
  (`{ cents: total × den, days: paydays × num }`); dates are rounded up to a whole day.
- Saved data version 3 adds `settings.payFrequency`
  (`'weekly' | 'biweekly' | 'twice-monthly' | 'monthly' | 'varies'`). Versions 1 and 2 load
  and become version 3 with `'varies'`, so their numbers don't change. Backups are written as
  version 3. `newState()` and `upgradeState()` stay as they were because existing tests pin
  them; `upgradeToV3()` runs on load, on restore and at first run.

## Consequences
- A weekly earner sees the right number after the first paycheck, and keeps it when they
  forget one: the gap doesn't stretch, and the missed-paycheck chip offers the skipped week.
- If the stated answer is wrong (say "Every week" but two weeks' pay is logged at once every
  2 weeks), the weekly number is too high until the teen fixes the answer in Settings. The
  owner chose this over letting logged dates take over.
- An older copy of the app turns a version 3 backup away with "The backup is from a
  different version of Budgeteer." Six lines in four existing tests were updated, with the
  owner's OK, to expect version 3.
