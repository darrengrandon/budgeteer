---
id: 013
title: Buy it (logic)
depends_on: [011, 012]
status: todo
---

## Goal
`buyGoal(state, goalId, { cents, date })` in `src/goals.js` (SPEC.md "Buy it", decisions
7 and 8): only a funded goal; takes min(real price, goal price) out of Goals; removes the
goal; records a goal purchase with the goal's name. Typed price must be whole cents > 0.

## Done when
Tests first: not funded is refused, lower price leaves the rest for the next goal, higher
price takes only the goal's price, undo puts the money back, the result loads again.
`./check.sh` passes.
