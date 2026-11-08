# 4. Weekly pay is learned from the gaps between paydays

Date: 2026-11-07. Status: accepted (owner, decision 9). Replaces decision 5. The gap rule
now applies only to "It's different every time": see docs/adr/0007.

## Context
"Spend about $X a week" is now the headline. The 28-day average shows a quarter of the
real amount after a first weekly paycheck and drifts to $0 when the teen forgets to log.

## Decision
Weekly pay = average payday amount × 7 ÷ usual gap, over the last 6 paydays. The usual gap
is the median gap; with one payday it is 14 days. Kept as an exact fraction until display.
`averageWeeklyIncome` stays because `tests/budget.test.js` tests it, but no screen uses it.

## Consequences
- A first paycheck already gives a sensible number (right for every-2-weeks pay).
- Forgetting to log does not shrink the numbers; the "Got paid? Log it." line nudges.

## Update after the second review (REVIEW.md L1, L2)
- Paychecks less than 4 days apart are one payday, so a duplicate can't fake a 1-day gap.
- A skipped payday stretches the gap, so the paycheck sheet offers to add it on its
  expected date instead of the rule guessing.
