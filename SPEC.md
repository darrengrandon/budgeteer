# Budgeteer

## Promise
"Log your paycheck. Budgeteer tells you what to spend and when you can buy your thing."

For teens (16-19) with a first job who want to start budgeting without effort. The only
habit the app may ask for is logging a paycheck. Everything else is optional.

No bank account, no login, no network. Everything stays on the phone.

## Platform
- Phone only. Designed for 360-430px wide. On a wider screen, the same narrow column is
  shown centered.
- An installable web app (PWA): web app manifest, icons, and a service worker so it
  opens and works with no connection. Plain HTML, CSS and JavaScript (ES modules), no
  frameworks, no build step, no network calls.
- iPhone has no install prompt, so a short "Add to Home Screen" help card explains how.
- Touch targets at least 44px. Safe areas respected (`env(safe-area-inset-*)`). Amounts
  use the numeric keypad (`inputmode="decimal"`). Nothing depends on hover.
- Light and dark theme from the phone's setting.

## Words
Plain and friendly, for 16-19 year olds: short sentences, everyday words, a little
warmth, no jokes or slang. See CONTEXT.md for the words the app and code use.

## Buckets and split
Each paycheck is split into three buckets by whole-number percents that total 100:
- **Spend**: money to spend.
- **Save**: general savings, no target.
- **Goals**: money for named goals (a phone, a car, concert tickets).

The split starts at 50 / 30 / 20 and can be changed in Settings. A new split applies to
paychecks logged from then on; each paycheck keeps the split it was logged with.

## Screens

### First run (no setup screen)
1. "What are you saving for?" Name and price. Can be skipped ("Skip for now" still keeps
   a goal that was fully typed in). A small "Restore a backup" link is here too.
2. "How much was your paycheck?" The paycheck sheet (below). "Not paid yet" closes it.

### Home (one screen, no tabs), top to bottom
0. Only when the "Got paid?" rule says so: one line, "Got paid? Log it." Tapping it
   opens the paycheck sheet.
1. "Spend about $X a week": the Spend percent times weekly pay (rule below), shown
   in whole dollars. Before the first paycheck: "Log your first paycheck", which can be
   tapped to open the paycheck sheet.
2. Goal cards. The top goal is big: name, progress bar, "$40 of $300", and either
   "Ready in about N weeks (around <date>)" or "You can buy it!" with a "Buy it"
   button. Other goals are smaller cards with the same line. A lower goal whose price is
   already in Goals says "The money's already in Goals. Move it to the top to buy it now."
   Each card has a button for its actions (edit, move up, move to top, remove). An "Add a
   goal" button follows.
3. Only when "Track my spending" is on: a Spending card (left to spend, "Log a
   purchase", the latest activity).
4. A large "I got paid" button fixed at the bottom, in the thumb zone.

A gear button at the top opens Settings. On iPhone in Safari (not installed), the
"Add to Home Screen" help card shows on Home until dismissed; it also says Safari may clear
the info if Budgeteer isn't opened for a week. A "Back up your info" card shows after every
4 paychecks since the last backup (or "Not now") on this phone.

Messages under the headline ("Added "Shoes".") fade after 10 seconds and clear as soon as
the data changes, so they never describe something that was undone.

### Paycheck sheet
A bottom sheet with the amount only (date is today) on the numeric keypad, and a
"Same as last time" chip when there is an earlier paycheck.
- If a paycheck was logged in the last 3 days, it says so: "You already logged $312.47
  yesterday."
- If a payday was clearly skipped (see "Missed paydays"), a chip offers "Also add the
  paycheck I missed (around Nov 21)"; with it on, the same amount is also logged on that date.
- The same amount as a paycheck already logged today asks first: "You already logged
  $212.40 today. Log another paycheck?" with "No, it's already logged" (where "Add paycheck"
  was) and "Yes, log another". The second tap of a double tap never saves, confirms or undoes.
- Any paycheck over **$3,000** asks first, even the first one: "That's over $3,000. Is
  $3,500.00 right?", and the button becomes "Yes, add $3,500.00".
- An amount 4 times the biggest of the last 6 paychecks or more asks first: "That's a lot
  more than last time ($312.47). Is $31,247.00 right?" (or "...than your recent paychecks
  (the most was $210.00)..."), and the button becomes "Yes, add $31,247.00". Comparing with
  the biggest, not just the last, keeps normal irregular pay ($40, then $175) from asking.
After saving, the sheet shows where the money went ("Your $42.50 became $21.25 to spend,
$12.75 saved, $8.50 for goals.") and the updated timeline for each goal, with "Done" and
"Undo". After "Done", "Undo paycheck" stays on Home with "Paycheck added." for a while.

### Buy it
Only for a fully saved goal (its whole price is covered). A sheet asks what it really
cost, prefilled with the goal's price. What comes out of Goals is the real price, but
never more than the goal's price. If it cost less, the rest stays in Goals and goes to
the next goal. The goal is removed and the purchase is recorded ("Nice! $85.00 came out
of Goals for Concert tickets."). If it cost more and tracking is on, "Take $35.00 from
Spend" logs the extra as a purchase. It can be undone from History; "Add it back" then
returns the goal to the top, priced at what came out of Goals.

### Settings
- Your split: Spend / Save / Goals, must total 100. While editing, the goals' new
  dates show live. Nothing changes until "Save split"; closing Settings with a new, valid
  split asks "Save your new split (...)?" first.
- Your money: what is in Spend, Save and Goals. With tracking off, Spend is everything
  that went into it (purchases aren't taken out).
- Track my spending (switch).
- History: every paycheck, purchase and goal buy, newest first, each removable.
- Backup: download and restore a JSON file.
- Add to Home Screen help.

### Track my spending (off by default)
Off: no purchases, no left-to-spend, no balance check anywhere. On: Home shows the
Spending card; a purchase sheet (amount and optional note, date today) takes money out
of Spend, and a purchase bigger than what is left is blocked with "You have $12.40 left
to spend." Turning it off hides these but deletes nothing. Anyone whose data already has
purchases (from before this version, or from a backup) starts with it on.

## The numbers

### Weekly pay (learned from paycheck gaps)
- Paydays: paychecks grouped into paydays. A paycheck less than 4 days after the first
  paycheck of a payday joins it, so a duplicate, or a second job paying a few days apart,
  never fakes a 1-day gap. Dates after today are ignored.
- Recent paydays: the last 6.
- Usual gap: the median number of days between recent paydays, rounded to a whole day.
  With only one payday, 14 days (paid every 2 weeks).
- Weekly pay = (total of the recent paydays ÷ their number) × 7 ÷ usual gap.
  Worked out exactly in whole numbers; rounded only for display.
- It does not fall just because time passes without logging; the "Got paid?" line nudges.
  A skipped payday does stretch the gap, so the paycheck sheet offers to add it (below).

### Missed paydays
Expected paydays after the last one, every usual gap, that are at least half a gap in the
past (at most 6). Example: last payday Nov 7, every 2 weeks, today Dec 5: Nov 21 was missed.

### Spend about $X a week
Weekly pay × Spend percent ÷ 100, rounded to whole dollars.

### When can I buy it
Goals-bucket money fills goals top to bottom, each up to its price. A goal is reached
when the Goals bucket covers its price plus every price above it. The date is the payday
when the money will really be there, so it is never early: a typical payday (the recent
paydays' average, rounded down to the cent) is split the way the app splits it, and the
Goals part is counted again every usual gap after the last payday until what is still
missing is covered ("around Jan 2", with the year when it is not this year). It stays put
between paydays; the weeks shown count from today, rounded up. If that date has passed and
the goal still isn't funded: "Should be ready by now. Log your paycheck to check." Over 52
weeks it says "about a year", and from 78 weeks on, years ("about 3 years"). With no
paychecks: "Log a paycheck to see when." With 0% to Goals: "Your split puts nothing
into Goals. Change it in Settings."

### "Got paid? Log it."
Shown when the app opens, or comes back on screen, if there is at least one paycheck and
the last payday is more than the usual gap plus 2 days ago (with one payday: more than 16
days ago). Logging a paycheck makes it go away.

## Data
Stored on the device (localStorage) as version 2:
```
{ version: 2,
  split: { spend, save, goals },
  settings: { trackSpending },
  paychecks: [{ id, date, cents, spend, save, goals }],
  purchases: [{ id, date, cents, note }],
  goals: [{ id, name, targetCents }],
  goalPurchases: [{ id, date, cents, name }] }
```
Version 1 data and backups still load and are upgraded (`trackSpending` is on if there
are purchases; `goalPurchases` is empty). Backups are written as version 2.

## Rules that must always hold
- Money is integer cents everywhere. Never floats.
- A split never loses or invents a cent (largest-remainder rounding).
- Each paycheck keeps the split it was logged with.
- Balances are calculated from the records, never stored. No bucket goes below zero.
- Nobody loses data in an upgrade: every version 1 record is kept.
- No network requests. The service worker only fetches the app's own files.
- An imported backup is untrusted: every field is checked; text is never inserted as HTML.
- Two open tabs never overwrite each other's changes.

## Out of scope
Bank connections, accounts, multiple users, taxes and withholding (the teen enters
take-home pay), notifications, AI features, tablets and desktop layouts.

## Safety check ("choose two")
The app takes input only from the person using it, keeps data only on their device, and
makes no external calls. That is at most one of the three risky traits, so it is safe by
design. Keep it that way: no network requests, no secrets in the repo, and treat any
imported backup file as untrusted.

## What can't be tested here
Only Chromium can be driven on this machine. Safari on iPhone (rendering, the "Add to
Home Screen" flow, standalone mode, safe areas on a notched screen, the keypad) and the
service worker on a real installed phone are not tested automatically. The browser tests
emulate iPhone and Pixel screen sizes in Chromium.

## Decisions
Answered by the owner on 2026-11-07.

1. **Age and tone:** older teens, 16-19. Plain and friendly.
2. **Several goals:** fill top to bottom; the teen can reorder.
3. **Overspending:** blocked, with how much is available. (Now only when "Track my
   spending" is on.)
4. **Save target:** none.
5. **Weekly pay:** ~~28-day average~~ replaced by the paycheck-gap rule above
   (decision 9). The 28-day average function stays for its tests but no screen uses it.
6. **Backup:** JSON download and restore only. Nothing goes over the network.
7. **Buy it, when:** only when a goal is fully saved.
8. **Buy it, price:** the teen types the real price, prefilled with the goal's price.
   Less: the rest stays in Goals. More: only the goal's price comes out of Goals.
9. **Weekly pay rule:** learned from paycheck gaps, assuming every 2 weeks until there
   are two paydays.
10. **Old tests:** browser tests and wording tests for screens that no longer exist are
    replaced by new phone tests first, then removed. Logic tests stay.
    `tests/budget.test.js` is never changed.
11. **Docs:** CONTEXT.md is the glossary; docs/adr/ records the big decisions.
12. **Second review (REVIEW.md L1-L14):** the rules above now include close paychecks
    merging into one payday, missed paydays, dates counted from the last payday, years for
    long waits, the big-amount question and the backup nudge.
13. **Overnight decisions (owner, 2026-11-08):** goal dates are rounded up to the next likely
    payday so they are never early; a blocking "Log another paycheck?" step for a repeat of
    today's or yesterday's amount; and "Is that right?" for any paycheck over $3,000.
    Built so far: the repeat step for today only. Yesterday needs the owner's OK to change
    the review2 L1 test, which logs a repeat the next day on purpose.
