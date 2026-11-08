---
id: 014
title: Wording for the phone screens
depends_on: [012, 013]
status: done
---

## Goal
New functions in `src/words.js`: `spendHeadline`, `readyLine`, `shortDateFrom` (adds the
year only when it is not this year), `buySentence`, `moneyRounded` (whole dollars), and
the goal timeline line used after logging a paycheck.

## Done when
Tests first in `tests/words.test.js` (added only) for every message in SPEC.md, including
1 week vs N weeks, no paychecks, 0% to Goals, funded, and a date in next year.
`./check.sh` passes.
