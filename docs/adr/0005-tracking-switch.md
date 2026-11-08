# 5. Spending tracking is optional

Date: 2026-11-07. Status: accepted.

## Context
Logging every purchase is the habit lazy teens drop first. The product may require only
logging paychecks. Existing users may already have purchases.

## Decision
Purchases, left-to-spend, recent activity on Home and the overspend check live behind
"Track my spending" in Settings, off by default. Data that already has purchases starts
with it on. Turning it off hides, never deletes.

## Consequences
- With tracking off, "Spend about $X a week" is guidance, not a balance.
- History in Settings always lists everything, so mistakes can be fixed either way.
