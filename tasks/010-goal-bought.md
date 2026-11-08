---
id: 010
title: "Bought it": spend a finished goal's money
depends_on: [009]
status: todo
needs_owner_approval: true
---

## Why
From the fresh-eyes review (REVIEW.md, U6). Once a goal is reached, a teen can't record
buying the thing. The money stays in the Goals bucket. If they remove the goal, the money
moves to the next goal, so the next goal's progress includes money that was really spent.
To a first-time user, it looks like the app is inventing money.

## Goal
- A finished goal ("Done! You saved enough for this.") gets a "Bought it" button.
- Pressing it asks to confirm, then takes the goal's target out of the Goals bucket,
  removes the goal, and shows "Nice! $85.00 came out of Goals for Concert tickets."
- Recent activity shows it like a purchase: "Bought: Concert tickets −$85.00", with a
  Remove button that puts the money back into Goals (the goal itself is not re-created).
- Goals never go below $0 (the same rule as Spend).

## Data and backup format change (the reason this needs approval)
State goes from version 1 to version 2 with one new list:
```
goalPurchases: [{ id, date, cents, name }]   // id like "x1"; name is the goal's name
```
- Balances: Goals = paychecks' goals parts − goalPurchases. Spend and Save are unchanged.
- Version 1 saved data and version 1 backups still load: they get `goalPurchases: []`.
- Validation follows ticket 002: exact keys, whole cents, real dates, name rules as for goals,
  unique ids, Goals never below zero.
- Download backup writes version 2. Older copies of the app can't read version 2 backups.

## Open questions for the owner
1. Only when a goal is fully saved, or also earlier (for example, buying it on sale)?
2. If the item cost less than the target, should the teen type the real price?

## Done when
- Tests first: balances with goal purchases, migration from version 1, validation of the new
  list, the Remove button, and an e2e test for the whole "Bought it" flow.
- SPEC.md "Decisions" records the answers to the open questions.
- `./check.sh` passes, and it works in a real browser at phone width in both themes.
