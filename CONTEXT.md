# Context: the words Budgeteer uses

The same words appear on screen, in SPEC.md, in tickets and in code. If you add a word,
add it here.

| Word | Meaning | In code |
|---|---|---|
| **Paycheck** | Take-home pay the teen logs: an amount in cents and a date (today when logged in the app). Keeps the split it was logged with. | `state.paychecks`, `addPaycheck` |
| **Payday** | One or more paychecks less than 4 days apart, dated by the first. A duplicate or a second job a few days apart is one payday. | `paydays()` in `src/pay.js` |
| **Pay frequency** | The answer to "How often do you get paid?": Every week, Every 2 weeks, Twice a month, Once a month or It's different every time. Asked once after the first paycheck; changeable in Settings. | `state.settings.payFrequency`, `setPayFrequency()` |
| **Usual gap** | Days between paydays. Set by the pay frequency (7, 14, 365 ÷ 24, 365 ÷ 12). For "It's different every time" only: the median number of days between the last 6 paydays, or 14 with one payday. Kept as a fraction `{ num, den }`. | `payGap()`, `usualGapDays()` |
| **Weekly pay** | Average payday amount × 7 ÷ usual gap. Kept as an exact fraction `{ cents, days }` (cents earned per that many days) so nothing is rounded early. | `weeklyPay()` |
| **Split** | Three whole percents for Spend, Save and Goals that total 100. Starts at 50/30/20. | `state.split` |
| **Bucket** | Spend, Save or Goals. Its balance is always calculated from the records. | `balances()` |
| **Spend about $X a week** | The home headline: weekly pay × Spend percent, in whole dollars. | `spendHeadline()` |
| **Goal** | Something the teen saves for: a name and a price (`targetCents`). Goals are in priority order. | `state.goals` |
| **Top goal** | The first goal. It gets Goals money first and is shown big on Home. | `state.goals[0]` |
| **Funded** | A goal whose whole price is covered by Goals money (after the goals above it). | `allocateToGoals()` |
| **Ready around <date>** | The payday when a goal will be funded at the current pay and Goals percent, then the weeks from today, rounded up: "Ready around Dec 19 (in about 7 weeks)". | `readyLine()` |
| **Buy it** | Recording that a funded goal was bought: the real price (at most the goal's price) leaves Goals, the goal is removed, a goal purchase is kept. | `buyGoal()`, `state.goalPurchases` |
| **Goal purchase** | The record a Buy it leaves behind: date, cents, goal name. Undoing it puts the money back in Goals. | `removeGoalPurchase()` |
| **Track my spending** | A setting, off by default. When on, the teen can log purchases from Spend and see what is left. | `state.settings.trackSpending` |
| **Purchase** | Money spent from Spend, only logged while tracking is on. Never more than what is left. | `state.purchases`, `addPurchase` |
| **Got paid? Log it.** | The nudge shown when the last payday is more than the usual gap plus 2 days ago. | `gotPaidDue()` |
| **Sheet** | A panel that slides up from the bottom (paycheck, buy it, purchase, goal). Built on `<dialog>`. | `.sheet` |
| **History** | Every paycheck, purchase and goal purchase, newest first, in Settings. The place to fix mistakes. | `recentActivity()` |
| **Version 1 / 2 / 3** | The saved-data format. The app upgrades versions 1 and 2 to version 3 on load and restore. | `upgradeToV3()` |
| **Missed payday** | An expected payday (last payday + usual gap, repeated) at least half a gap in the past with nothing logged. The paycheck sheet offers to add it. | `missedPaydays()` |
| **Backup nudge** | The "Back up your info" card after every 4 paychecks since the last backup or "Not now" on this phone. | `backupDue()` |
