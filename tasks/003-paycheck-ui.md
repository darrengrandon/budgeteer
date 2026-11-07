---
id: 003
title: Split setup, log a paycheck, show balances
depends_on: [002]
status: todo
---

## Goal
`index.html`, `styles.css`, `src/app.js` and `src/money.js`.

- First run: choose the split (default 50/30/20). Cannot continue until it totals 100.
- Log a paycheck (amount in dollars, date defaulting to today). Show the three
  balances and the plain sentence from SPEC.md.
- `src/money.js` converts text to cents and back, with tests first:
  "19.99" is 1999, "0.1" is 10, "$1,234.50" is 123450, "12.345" and "abc" are errors.

## Done when
- `./check.sh` passes.
- In a real browser: log three paychecks, reload, and the data is still there.
- Empty, negative, non-numeric and three-decimal amounts each show a friendly
  message and change nothing.
