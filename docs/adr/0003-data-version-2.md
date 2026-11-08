# 3. Saved data version 2

Date: 2026-11-07. Status: accepted.

## Context
"Buy it" needs a new kind of record, and "Track my spending" needs a setting. Version 1
data and backups must keep working, and the version 1 logic tests must keep passing
unchanged.

## Decision
Add `settings: { trackSpending }` and `goalPurchases: []` in version 2. `validateState`
accepts both versions exactly as written; `upgradeState` turns version 1 into version 2
(tracking on if there are purchases). The app upgrades on every load and restore and
always saves version 2. Balances subtract goal purchases from Goals.

## Consequences
- Old phones and old backups load with nothing lost.
- A version 2 backup can't be restored by the old version 1 app.
