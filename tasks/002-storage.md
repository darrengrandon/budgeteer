---
id: 002
title: State, storage and backup validation
depends_on: [001]
status: todo
---

## Goal
`src/storage.js` holds the app state, saves it, and can export and import a backup.

State shape (version 1):
```
{ version: 1,
  split: { spend, save, goals },
  paychecks: [{ id, date, cents, spend, save, goals }],
  purchases: [{ id, date, cents, note }],
  goals: [{ id, name, targetCents }] }
```

## Rules
- Each paycheck stores the split it was logged with. Balances are calculated from
  records, never stored.
- Wrap `localStorage` in try/catch. If it throws or is empty, the app still runs
  from in-memory state.
- Import treats the file as untrusted: validate every field and type, reject
  anything unexpected, and never insert imported text as HTML.

## Done when
Tests written first in `tests/storage.test.js` (use a fake in-memory storage) cover:
balances after paychecks and purchases, a split change not rewriting old paychecks,
import rejecting bad shapes, and loading when storage throws. `./check.sh` passes.
