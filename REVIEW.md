# Fresh-eyes review
Reviewer: a separate agent with no memory of the build. Date: 2026-11-07.

## Part 1: Using the app (only SPEC.md and the running app)

How this part was done: Playwright + Chromium against http://127.0.0.1:8140/index.html,
clock fixed at 2026-11-07 10:00 America/Chicago unless noted, viewports 400px and 320px,
light and dark. Only SPEC.md was read. All scripts are in `.scratch/review/`.

Checked and fine, so not listed below: the split math (largest remainder, e.g.
$1,000.25 -> $500.13 / $300.07 / $200.05, $0.03 -> 1 / 1 / 1 cents, 33/33/34 on $10.01 ->
$3.30 / $3.30 / $3.41), running totals, old paychecks keeping their split after "Use this
split" and "Change my split", the 28-day window (today plus the 27 days before) in
Chicago, Honolulu, Tokyo and Auckland and across the DST change, overspend blocking with
"You have $12.40 left to spend.", about 60 hand-edited backups (every bad one rejected
with "nothing was changed"), HTML in names and notes shown as plain text, no external
requests, no sideways scroll at 320px, text contrast in both themes, visible focus rings,
and keyboard use of every control including the slider.

### U1. Two open tabs silently erase each other's entries
- Kind: bug
- What I did: Start budgeting, log a $100 paycheck. Open the app in a second tab (same
  browser). In tab 1 log a $50 paycheck. In tab 2 (not reloaded) log a $20 paycheck.
  Reload tab 1.
- What happened: Activity shows only +$20 and +$100. The $50 paycheck is gone, with no
  warning in either tab. Purchases behave the same way: buying $60 in each tab keeps only
  the second purchase. Each tab writes its own full copy, and the last one to save wins.
- What I expected: Entries from both tabs kept, or the stale tab refreshing (or at
  least refusing to save) when the other tab changed the data. Teens often leave an old
  tab open, and phone browsers restore old tabs.

### U2. A purchase note with a tab in it makes "Log purchase" do nothing
- Kind: bug
- What I did: Spend has $50. Amount `1`, "What was it for?" set to `Tab<TAB>here` (this
  happens when you paste text copied from a spreadsheet or notes app), press "Log purchase".
- What happened: Nothing visible. No purchase, no message, and the form keeps its values.
  The console shows an uncaught `RangeError: The note has characters that aren't allowed.`
  The goal form handles the same input correctly ("The name has characters that aren't
  allowed.").
- What I expected: A friendly error under the note field, or the tab quietly turned
  into a space, as the goal form does.

### U3. Only the 20 newest entries are shown; older ones can't be seen or removed
- Kind: bug
- What I did: Logged 30 paychecks dated Oct 1 to Oct 30.
- What happened: "Recent activity" lists 20 and says "Showing the 20 most recent of 30."
  There is no way to show the rest, so the 10 older entries can't be checked or removed.
  This hurts most with a typo in the year: a paycheck dated `1999-01-01` (accepted
  without any question) sorts to the very bottom. It drops out of view as soon as 20
  newer entries exist, but it still counts in every balance.
- What I expected: A "Show more" or "Show all" control, so every entry that affects the
  balances can be found and fixed. A gentle check on very old dates would also help.

### U4. "Weeks to go" can be off by a week
- Kind: bug
- What I did: Fresh start, 50/30/20. Goal "Phone" $300. Log a $42.50 paycheck today.
- What happened: "About 137 weeks to go." and "That's about $2.13 a week into Goals."
  By hand, per SPEC Decision 5: $42.50 / 4 = $10.625 a week, and 20% of that is $2.125 a
  week. $300 - $8.50 = $291.50 left, and $291.50 / $2.125 = 137.2, so 138 weeks. After 137
  weeks the goal would hold $8.50 + 137 x $2.125 = $299.63, which is short of $300. Second
  case: restore a backup with $42.50 today + $100 on Oct 20 and goals Phone $300, Tickets
  $85. Tickets shows "about 50 weeks". By hand it is (385 - 28.50) / 7.125 = 50.04, so 51.
- What I expected: Weeks worked out from the exact weekly amount, with rounding only
  for display. (Part 2, C4, explains the cause and how often it happens.)

### U5. "Log a paycheck to see a date" when paychecks are already logged
- Kind: confusing
- What I did: Goal "Phone" $300. Log a $500 paycheck dated 2026-09-01 (more than 4 weeks
  ago). Also: restore a backup whose only paycheck is dated a week in the future.
- What happened: The goal shows "$100.00 of $300.00 saved" and "Log a paycheck to see a
  date." The What if? box says "Log a paycheck to see dates." But the teen just logged
  one. Also, goals are measured in weeks, but this line talks about a "date".
- What I expected: Something like "No paychecks in the last 4 weeks, so there's no
  estimate yet. Log your next paycheck to see how many weeks to go."

### U6. No way to use goal money once a goal is reached
- Kind: confusing
- What I did: Goals "Tickets" $30 then "Phone" $300, log $200 (Goals gets $40). Tickets
  shows "Done! You saved enough for this." Then I tried to record buying the tickets.
- What happened: "Log a purchase" only takes from Spend, so the teen can't record that
  the $30 was spent. If they remove the goal, the dialog says "The money saved for it
  stays in your Goals bucket", and Phone jumps from $10 to $40. Phone's progress now
  counts money that was really spent. Moving Phone above Tickets also turns the "Done!"
  goal back to "$0.00 of $30.00 saved". This follows SPEC's top-to-bottom rule, but a
  first-time user will think the app is losing or inventing money.
- What I expected: A way to mark a goal as bought that takes its target out of the Goals
  bucket. At the least, the Remove dialog should say that the money moves to the next goal.

### U7. A backup can bring in future-dated entries that the forms refuse
- Kind: spec mismatch
- What I did: Restored a backup with a paycheck dated 2027-01-01 (and another dated
  2026-11-14).
- What happened: "Backup restored". The future paycheck counts in Spend/Save/Goals right
  away but not in "weeks to go" (see U5), and it sits at the top of Recent activity. The
  paycheck and purchase forms refuse the same dates: "That date hasn't happened yet.
  Pick today or an earlier day."
- What I expected: The same date rule for restore as for the forms (maybe with a day of
  slack for time zones), because SPEC says to treat backups as untrusted.

### U8. Saved data that can't be read: "started fresh", and no way back from the app
- Kind: bug
- What I did: Put unreadable data in the app's storage (key `budgeteer.v1`, e.g.
  `{not json`, or a record whose purchases add up to more than its paychecks), then
  reloaded. Part 2 (C3) shows a way to reach this state from the app alone.
- What happened: "Your saved info couldn't be read, so Budgeteer started fresh. If you
  have a backup file, you can restore it." and the first-run screen. "Start budgeting"
  then writes an empty budget over the main key. Added after reading the code in Part 2:
  a copy is kept under `budgeteer.v1.damaged`, so the data is not destroyed. But nothing
  in the app tells the teen about the copy or lets them download it.
- What I expected: A "Download what was saved" button next to this warning, so a parent
  or helper has a chance to recover it.

### U9. Removing a paycheck asks "You can't undo this" and then refuses
- Kind: confusing
- What I did: Log $24.80, buy $12.40 and $5, then press Remove on the paycheck.
- What happened: Dialog "Remove paycheck of $24.80 from Nov 7, 2026? You can't undo
  this." After OK: "You can't remove this paycheck because you've already spent part of
  it. Remove some purchases first."
- What I expected: The refusal before the dialog, not after the teen has agreed.

### U10. "Log a paycheck" is far down the page
- Kind: layout
- What I did: Used the app at 400px after adding a goal.
- What happened: The order is Your money, Goals, What if?, then Log a paycheck. With one
  or two goals, the form for the most common task is about two screens down on a phone.
- What I expected: Log a paycheck (and Log a purchase) near the top, close to the
  balances they change.

### U11. Error shown twice on the split screen; purchase error far from its field
- Kind: nit
- What I did: (a) First run, type 60 / 30 / 20, press "Start budgeting". (b) Spend has
  $50; type 500 in "Amount spent" and press "Log purchase".
- What happened: (a) "Adds up to 110%. Take away 10." appears twice: once as the grey
  hint and again right below it in the red box. (b) "That's more than you have..." shows
  below the Date field, two fields away from the amount it is about.
- What I expected: One message for (a). For (b), the message next to the amount field.

### U12. Small wording and focus nits
- Kind: nit
- What I did / what happened:
  - After spending Spend down to $0, the app says "Your Spend bucket is empty. Log a
    paycheck first." But the teen already has. "Log your next paycheck to add more." would
    read better.
  - Escape does not close "Change your split". Only Cancel does.
  - After "Save changes" on a goal edit, focus goes to the "Add goal" button, not back
    to the goal that was edited.
- What I expected: Wording that fits the situation, and focus returning to where the
  teen was.

## Part 2: Code review (git diff 475e08e..HEAD)

Checked and fine, so not listed below: `tests/budget.test.js` is unchanged since
475e08e (committed and working tree). The other test files only gained tests across the
commits, and no existing assertion was changed. `./check.sh` passes (unit tests plus 27
Playwright tests). Money is integer cents throughout: `parseDollars` uses string and
integer math only, and `splitIncome` is exact. There is no TypeScript, framework or
build step. There are no network APIs in `src/`, and the CSP in `index.html` sets
`default-src 'none'; connect-src 'none'`. All text goes in with `textContent`. Imported
backups are size-checked, parsed and fully validated (exact keys, types, plain objects
only, `__proto__` rejected, ids, dates, totals) before the confirm dialog, and nothing
changes on failure. Date handling uses `Date.UTC` day numbers and local "today", so it
is the same in every time zone.

### C1. Every tab saves its own stale copy over the others (data loss)
- Kind: bug
- Where: src/app.js:114-117 (state is read once at load), src/app.js:126-130 (`commit`
  writes the whole in-memory state). There is no `storage` event listener anywhere in `src/`.
- Problem: With two tabs open, the tab that saves last overwrites everything the other
  tab logged. To reproduce: log $100, open a second tab, log $50 in tab 1, log $20 in
  tab 2, reload tab 1. The $50 paycheck is gone (U1). Purchases, goals and split changes
  made in the other tab are lost the same way, and nothing on screen says so.
- Suggestion: Listen for `window.addEventListener('storage', ...)` on `STORAGE_KEY`,
  re-run `loadState` and `render()`. In `commit`, re-read storage first and refuse
  (with a "This changed in another tab, please try again" message) if it differs from
  what this tab last loaded or saved. Add a Playwright test with two pages in one context.

### C2. Purchase note with a control character throws an uncaught error
- Kind: bug
- Where: src/app.js:278-285 (only `OverspendError` is caught; anything else is
  rethrown), src/storage.js:337 (`readText` runs on the raw note), index.html:186 (the
  note input has no `aria-describedby="purchase-error"`).
- Problem: `addPurchase(state, { ..., note: 'a\tb' })` throws
  `RangeError: The note has characters that aren't allowed.` The submit handler rethrows
  it, so the teen sees nothing happen (U2). Pasted text with a tab is enough to trigger
  it. The goal form (app.js:342-345) catches `RangeError` correctly. The purchase form
  does not.
- Suggestion: Write the failing test first (an e2e test that fills the note with `a\tb`
  and expects a message). Then either turn whitespace runs into a single space before
  validating (`note.replace(/\s+/g, ' ').trim()`), or catch `RangeError` and show it in
  `#purchase-error` with focus on the note. Wire the note input to `purchase-error`.

### C3. `nextId` can create an id the loader rejects, so the whole budget reads as "damaged"
- Kind: bug
- Where: src/storage.js:289-295 (`nextId` = highest number + 1) against
  src/storage.js:44 (`ID_PATTERN` allows at most 9 digits). Also src/app.js:126-130 and
  src/storage.js:510-518 (nothing is validated before saving).
- Problem: A backup with paycheck id `p999999999` passes `validateState` and restores
  fine. The next logged paycheck gets id `p1000000000`. That id is saved, but on the next
  load `importBackup` rejects it ("Paycheck 2 has a bad id"), and the app shows "Your saved
  info couldn't be read, so Budgeteer started fresh." I checked this in the browser
  (`.scratch/review/try36.mjs`). A backup downloaded from that state cannot be restored
  either. The deeper problem is that the mutation functions and `validateState` keep
  separate rules, and nothing checks that what `commit` saves will load again. For
  example, `addPaycheck`/`addPurchase` never enforce `LIMITS.maxRecords`, but loading does.
- Suggestion: In `commit` (or `saveState`), run `validateState(next)` and refuse the
  change with a message if it fails, so a bad state is never written. Make `ID_PATTERN`
  and `nextId` agree, for example by dropping the 9-digit cap or by reusing the lowest
  free number. Add a test that builds states with every mutation, including from a
  restored backup with high ids, and asserts `importBackup(exportBackup(state)).ok`.

### C4. Weeks to go are rounded twice and can be a week (or more) wrong
- Kind: bug
- Where: src/budget.js:135 (`averageWeeklyIncome` rounds to whole cents, which the
  protected test requires), src/goals.js:36-38 (`weeklyGoalsCents` rounds again), then
  src/goals.js:53 divides by that rounded amount. tests/goals.test.js:43 locks in the
  rounding up (`weeklyGoalsCents(9, 20) === 2 // 1.8 rounds to 2`).
- Problem: One 4250-cent paycheck today and a 30000-cent goal: average = round(1062.5) =
  1063, weekly Goals = round(212.6) = 213, weeks = ceil(29150 / 213) = 137. The exact
  answer is ceil(29150 / 212.5) = 138. I compared both methods for one paycheck from $50
  to $600 at Goals 5-40% with targets of $300 / $1,000 / $5,000. The app's number differs
  from the exact one in about 11% of cases, sometimes higher and sometimes lower. Most
  are off by 1 week, but the gap can reach dozens of weeks at low percents and big targets.
- Suggestion: Keep `averageWeeklyIncome` as it is (the protected test needs it), but
  don't build the projection on it. In `projectGoals`, add up the window's paycheck cents
  and use integer math: `weeks = ceil(left * 28 * 100 / (windowCents * 7 * goalsPercent))`.
  Round the weekly amount only to display it. Add a test for the 4250 / 30000 case
  expecting 138. Change `weeklyGoalsCents` and its test, or drop them. This changes the
  meaning of a test, so ask the owner first, per CLAUDE.md.

### C5. Restore accepts future dates, and such paychecks count in balances but not projections
- Kind: bug
- Where: src/storage.js:107-110 (`readDate` only checks the date is real), used by
  `validateState` at :202 and :214, and compared with src/forms.js:37-39, where the
  forms refuse future dates. `balances` (storage.js:261-271) counts every paycheck.
  `averageWeeklyIncome` (budget.js:133) skips future ones.
- Problem: A backup with a 2027-01-01 paycheck restores fine. Its money shows in the
  buckets, but projections ignore it, so the goal says "Log a paycheck to see a date"
  (U5, U7). The rule for typed input and for untrusted input differ.
- Suggestion: Pass today into `validateState`/`importBackup` (and `loadState`), and
  reject dates more than a day ahead, allowing for time zones. Add tests for +1 day
  (accepted) and +2 days (rejected).

### C6. Activity list is capped at 20 with no way to reach the rest
- Kind: bug
- Where: src/app.js:609 (`HISTORY_LIMIT = 20`), :633, :668-670.
- Problem: Entries past the 20th can't be seen or removed, but they still count in
  every balance (U3). Removing entries is the only way to fix a typo, and a wrong year
  (accepted with no lower bound) sends an entry straight to the hidden end of the list.
- Suggestion: Add a "Show all" toggle, or paginate. Consider a sanity check on dates far
  in the past (for example, more than a year ago: "Is the year right?"). Add an e2e
  test that removes the 21st entry.

### C7. The "damaged" copy is unreachable and gets overwritten
- Kind: bug
- Where: src/storage.js:494-501, src/app.js:115-120.
- Problem: `loadState` copies unreadable data to `budgeteer.v1.damaged`, which is good.
  But the app never mentions the copy and has no way to download it, and the warning
  says "started fresh". Each new damaged load overwrites the same key, so if it happens
  twice (for example via C3), the older copy is lost.
- Suggestion: When the warning is `DAMAGED_WARNING`, show a "Download the unreadable
  data" button that saves the raw text. Don't overwrite an existing damaged copy (use a
  dated key, or keep the first one). Add a unit test for two damaged loads in a row.

### C8. "No pay yet" and "no pay in the last 4 weeks" share one message
- Kind: unclear code
- Where: src/words.js:73 and :124, src/app.js:516-518. All of them branch on
  `averageWeeklyCents <= 0`.
- Problem: A teen whose paychecks are all older than 28 days (or dated in the future)
  is told "Log a paycheck to see a date" (U5). Ticket 005 asked for this text only "with
  no income yet".
- Suggestion: Pass `hasPaychecks` (`state.paychecks.length > 0`) into `goalStatus` and
  `whatIfLine`, and add a message for "no pay in the last 4 weeks". Add tests in
  tests/words.test.js.

### C9. Remove asks for confirmation before checking whether removal is allowed
- Kind: nit
- Where: src/app.js:617-626.
- Problem: `window.confirm("... You can't undo this.")` runs before `removePaycheck`,
  which then throws `OverspendError` (U9).
- Suggestion: `removePaycheck` is pure, so call it first. Show the refusal if it throws.
  Only then ask for confirmation and `commit` the result.

### C10. Split error is written twice
- Kind: nit
- Where: src/app.js:191 (puts `splitTotalHint(...)` text into `#split-error`) and
  src/app.js:146-153 / index.html:50-51 (`#split-hint` already shows the same text).
- Problem: After an invalid submit, the same sentence shows twice on screen, and both
  regions (`aria-live="polite"` and `role="alert"`) announce it (U11).
- Suggestion: On submit, put the text in the alert only (clear or hide the hint while
  the error shows), or keep the hint and give the alert a different, shorter message.

### C11. The test run depends on Python
- Kind: nit
- Where: playwright.config.js:34 (`python3 -m http.server`), playwright.config.js:1
  (`// @ts-check`).
- Problem: CLAUDE.md limits the project to HTML/CSS/JS. The README admits the Python
  one-liner, but it means `./check.sh` fails on a machine without `python3`.
  `// @ts-check` is a TypeScript-checker directive. It does nothing here, but it hints at
  tooling the rules leave out.
- Suggestion: Serve the folder with a ~15-line `node:http` static server bound to
  127.0.0.1 (still no dependencies). Remove the `@ts-check` line.

---

## Resolution (by the builder)

Every fix below had a failing test first (unit tests in `tests/`, browser tests in
`e2e/review.spec.js`), then the fix. Commit `7a7512a`. Two existing assertions in
`e2e/purchase.spec.js` were changed for U9 and U12, with the owner's OK (CLAUDE.md).

| Finding | Outcome | Test that failed first |
|---|---|---|
| U1 / C1 two tabs erase each other | Fixed. Other tabs reload on the `storage` event; `saveChecked` refuses to overwrite a save made elsewhere and the page shows the other tab's data with "Please try that again." | `saveChecked` unit tests; e2e "U1" (both) |
| U2 / C2 tab in a note does nothing | Fixed. Whitespace runs become one space in notes and goal names; any other bad note shows a message under the note box. | unit "U2"; e2e "U2" |
| C3 ids the loader rejects | Fixed. `nextId` reuses the lowest free number past 9 digits; record limits checked when adding; `saveChecked` never writes a state that would not load. | unit "C3" (four); e2e "C3" |
| U3 / C6 only 20 entries | Fixed. "Show all N" button; dates more than 2 years ago ask to check the year. | e2e "U3"; unit `readPastDate` |
| U4 / C4 weeks rounded twice | Fixed without changing any test: weeks now use the exact weekly amount (window pay × 7 × Goals% / 2800, in whole numbers). `averageWeeklyIncome` and the shown "$2.13 a week" are still rounded as their tests require. | unit "C4" (138 and 51 weeks) |
| U5 / C8 "Log a paycheck" when paychecks exist | Fixed. New message when there are paychecks but none in the last 4 weeks. | unit `goalStatus`, `whatIfLine`, `whatIfWeekly`; e2e "U5" |
| U7 / C5 future dates in backups | Fixed. Restore rejects dates more than one day after today. Loading saved data does not, so a changed device clock can't lock anyone out. | unit "U7"; e2e "U7" |
| U8 / C7 damaged data unreachable | Fixed. "Download the unreadable data" button; up to 5 damaged copies kept, never overwritten. | unit "C7" (two); e2e "U8" |
| U10 forms far down | Fixed. Order is now Your money, Log a paycheck, Log a purchase, Goals, What if?, Recent activity, Backup, Settings. | e2e "U10" |
| U11 / C10 error twice, error far away | Fixed. The split hint hides while its alert shows; every form error sits under its own box. | e2e "U11" |
| U12 Escape, focus after edit | Fixed. | e2e "U12" |
| U12 "Log a paycheck first" wording | Fixed after the owner agreed to update the expected text in `e2e/purchase.spec.js`. It now reads "Log your next paycheck to add more." once paychecks exist. | unit `spendAvailable`; updated e2e assertion |
| U9 / C9 confirm, then refuse | Fixed after the owner agreed to update `e2e/purchase.spec.js`. The removal is checked first, and a refused one shows its message with no dialog. The test now also checks that no dialog appears. | updated e2e "recent activity…" |
| U6 no way to use goal money | Partly fixed: the Remove dialog now names the goal that gets the money next. A "Bought it" action changes the data and backup format, so at the owner's request it is written up as `tasks/010-goal-bought.md` for approval and not built yet. | e2e "U6" |
| C11 Python and `@ts-check` | Not fixing. Ticket 008 asks for `python3 -m http.server` by name, and `// @ts-check` only lets an editor check the JSDoc types in plain JS (no build step, no TypeScript). | — |

---

# Second review: the phone app, as a lazy teenager
Reviewer: a separate agent with no memory of the build, given only SPEC.md and the running app at phone size (Chromium with iPhone 15 and Pixel 9 screens). Date: 2026-11-07.

Unless a finding says otherwise: iPhone 15 screen (393x852), light theme, timezone America/Chicago, "today" = 2026-11-07 10:00, fresh browser context, and "reload" means a reload in the same context.

**Checked and fine.** First run with and without a goal, "Skip for now", "Next" with both boxes empty (acts as skip), "Not paid yet". Amount parsing: "$1,200", "$249.99", "$ 250", ".5" and "50." are accepted. "12,50", "1,20", "1 200", "1e3", "+50", "(50)", "50$", negatives, 0, three decimals and anything over $1,000,000 are all rejected with clear messages. Largest-remainder split: $312.47 became $156.24 / $93.74 / $62.49, as I worked out by hand. I hand-checked weekly pay and "Spend about $X a week" for one payday ($156 pay / $78 spend), every two weeks, weekly with three paydays ($200 / $100), two paychecks on the same day counting as one payday, and a 26-paycheck backup. "Ready in about N weeks (around <date>)" is right, including rounding up, the year on dates in other years, "Log a paycheck to see when." and the 0% Goals message. The "Got paid? Log it." line works: with one payday it is hidden on Nov 23 and shown on Nov 24. For a weekly payer it is hidden at day 9 and shown at day 10, also across the March DST change. It goes away when you log and comes back after Undo. "Same as last time" works, and so does Undo on the paycheck sheet. Buy it at the same price, a lower price and a higher price works, and an amount left over goes to the next goal. History removal asks first. It refuses to remove a paycheck whose money already paid for a purchase or a goal buy, so no bucket can go negative. Backup download (version 2 JSON) works, and restoring asks before it replaces anything. Every bad file I tried was rejected with "nothing was changed": truncated, not JSON, empty, an array, version 3, negative cents, fractional cents, Feb 31, duplicate ids, a future date, purchases bigger than Spend, and goal buys bigger than Goals. A version 1 backup upgrades with tracking on. HTML in names shows as plain text. Corrupt local data gives a friendly message and lets you download the unreadable data. Two tabs stay in sync and don't overwrite each other. Reloading offline and opening a new tab offline both work after one visit, and I saw no request to any other host. Every button is at least 44px. Text contrast is at least 4.5:1 in light and dark. Nothing scrolls sideways at 320px. Sheets scroll in landscape. With the screen cut to 393x420 to stand in for the keyboard, the sheet's main button stays visible. Escape closes sheets and gives focus back, and Enter submits. Paychecks logged near midnight, in Chicago, Los Angeles or Tokyo time, get the right local date. The Add to Home Screen card shows only with the iPhone user agent, and "Got it" sticks after a reload.

### L1. Logging a paycheck again the next day (or twice the same day) wrecks every number, with no warning
- Kind: bug
- What I did: Set up a goal "AirPods" for $250, logged a $312.47 paycheck, then tapped Done. Set today to 2026-11-08 and reloaded. Tapped "I got paid", then "Same as last time ($312.47)", then "Add paycheck", then Done. This is a teen who forgot they already logged it, or who has a second job paying a day apart. Variant: the same second paycheck logged at 18:00 on Nov 7 instead.
- What happened: Next-day version: Home says "Spend about $1,094 a week", "Out of about $2,187 a week of pay." and "AirPods ... Ready in about 1 week (around Nov 15)". Same-day version: "Spend about $156 a week", "Out of about $312 a week of pay." and "Ready in about 3 weeks (around Nov 28)". The sheet never says when the last paycheck was logged. Only the chip shows up, and it invites the duplicate.
  Hand calculation (next day): paydays are Nov 7 and Nov 8, so the usual gap is 1 day. Weekly pay = (31,247 + 31,247) / 2 x 7 / 1 = 218,729 cents = $2,187.29. Spend = 50% = $1,093.65, which shows as $1,094. That is 14 times the real $78. The app follows the gap rule to the letter, but the rule turns one extra tap into nonsense.
- What I expected: A warning before saving, such as "You already logged a paycheck today/yesterday ($312.47). Log another one?". Also, the weekly-pay rule should not trust a gap of 1 day. For example, paychecks a few days apart could count as one payday.

### L2. Forgetting one paycheck halves "Spend about" and nearly doubles every goal time (SPEC says it must not fall)
- Kind: spec mismatch
- What I did: Set up AirPods for $250 and logged $312.47 on Nov 7. Didn't open the app again until 2026-12-05, so the Nov 21 paycheck was never logged. "Got paid? Log it." was showing. I tapped it, then "Same as last time", then "Add paycheck". Variant: the teen remembers the missed one too and logs $312.47 twice on Dec 5.
- What happened: "Spend about $39 a week", "Out of about $78 a week of pay." and "AirPods $124.98 of $250, Ready in about 9 weeks (around Feb 6, 2027)". In the variant: "Spend about $59 a week" and "Out of about $117 a week of pay."
  Hand calculation: paydays are Nov 7 and Dec 5, so the gap is 28 days. Weekly pay = 31,247 x 7 / 28 = 7,811.75 cents = $78. In the variant: (31,247 + 62,494) / 2 x 7 / 28 = 11,717.6 cents = $117. The teen still earns $156 a week. The wrong figure stays until enough later paydays push it out of the median. A paycheck's date is always today, so the teen has no way to log the missed paycheck on its real date.
- What I expected: SPEC "Weekly pay": "It does not fall when the teen forgets to log". Forgetting to log is exactly what the target user does, and right now the most common way of forgetting halves the advice. The rule could ignore a gap that is about twice the usual gap, or the "Got paid?" flow could ask "You may have missed one. Did you get paid twice?" and let the teen log the missed one on an earlier date.

### L3. Coming back to an already-open app doesn't refresh Home, so "Got paid? Log it." can't show
- Kind: bug
- What I did: Set up AirPods for $250, logged $312.47 and tapped Done, then left the page open. I moved the clock to 2026-11-27 (20 days later) without reloading. Then I fired the events a phone sends when you switch back to an open app: `visibilitychange` (hidden, then visible), `focus` and `pageshow` (persisted). After that I opened and cancelled the paycheck sheet.
- What happened: Home stayed as it was. There was no "Got paid? Log it." line, and the goal still said "Ready in about 7 weeks (around Dec 26)", which was worked out from Nov 7. Only a full reload showed the line.
- What I expected: The app should re-check the "Got paid?" rule and the dates whenever it comes back on screen, not only on a cold load. On phones, and especially for an iPhone Home Screen app, a page is often resumed from memory instead of reloaded, so the app's only reminder may never show. (I simulated this in Chromium. Please confirm it on a real phone.)

### L4. A teen who opens it in Safari "once in a while" can lose everything, and nothing ever suggests a backup
- Kind: lazy-teen friction
- What I did: Looked through every screen for any prompt to back up or to install, iPhone 15 user agent, light and dark.
- What happened: Backup lives only in Settings → Backup, below the split, Your money, Track my spending and History. With a year of data, "Download backup" is 3.7 screens down inside Settings. Nothing reminds the teen to back up. The Home Screen help card is gone for good after "Got it". It says the app "works without internet" but doesn't say data can be lost if it isn't installed. Safari on iPhone (not the Home Screen app) deletes a site's script-written storage, localStorage included, after 7 days of Safari use without visiting that site. That is exactly the "opens it once in a while" teen. I couldn't test this here (Chromium only).
- What I expected: The help card, or a one-time note after the first paycheck, should explain that adding to the Home Screen keeps the data safe. There should also be an occasional gentle "Download a backup" nudge, for example after every few paychecks, that can be dismissed.

### L5. Obvious typos are saved without a question (a missing dot gives a 100x paycheck)
- Kind: lazy-teen friction
- What I did: Set up a goal "Car" for $5,000 and logged $312.47 on Nov 7. On 2026-11-21: "I got paid", typed `31247` (forgot the dot), "Add paycheck", Done.
- What happened: "Nice. Your $31,247.00 became $15,623.50 to spend..." and "Car: you can buy it!". Home then says "Spend about $3,945 a week" and offers "Buy it" for the car. Hand calculation: (31,247 + 3,124,700) / 2 x 7 / 14 = 788,986.75 cents, so $7,890 a week of pay and $3,945 to spend. Buy it also takes `8500` for an $85 goal ("The extra $8,415.00 didn't come from Goals."). Undo is on the summary, but the big Done button sits exactly where "Add paycheck" was. A quick double tap on "Add paycheck" saves the paycheck and closes the summary, Undo included. After that the only fix is Settings → History → Remove ("You can't undo this") and logging it again.
- What I expected: A check like "That's a lot more than last time ($312.47). Is $31,247.00 right?" before saving, when an amount is many times the last paycheck or the goal price.

### L6. A cheap goal added after an expensive one is "ready in 162 weeks" even though the money is already there
- Kind: lazy-teen friction
- What I did: On first run, set up a goal "Car" for $5,000 and logged $312.47. Then "+ Add a goal" "Concert tickets" $85, and "+ Add a goal" "Phone case" $20.
- What happened: "Phone case $0 of $20, Ready in about 162 weeks (around Dec 15, 2029)" and "Concert tickets ... 161 weeks", while $62.49 sits in Goals. Hand calculation: Phone case needs $5,000 + $85 + $20 = $5,105. Missing: $5,042.51 / ($156.235 x 20% = $31.247 a week) = 161.4, so 162 weeks. The math follows SPEC. But to fix it the teen has to find ⋯ → "Move up" (the sheet closes), then ⋯ → "Move up" again. There is no "Move to top", no hint that order matters, and new goals always go to the bottom.
- What I expected: A one-line hint on a goal that could be bought now if it were first (for example "Move it up to buy it now"), or a "Move to top" action. Even better, ask "Save for this first?" when adding a goal that is cheaper than the money already in Goals.

### L7. "Undo" on a goal buy doesn't bring the goal back, and the next goal suddenly says "You can buy it!"
- Kind: confusing
- What I did: Set up a goal "Concert tickets" for $85, logged $500, then "+ Add a goal" "Shoes" $50. Tapped "Buy it", then "Yes, I bought it" ($85). Then Settings → History → "Bought: Concert tickets" → Undo → OK.
- What happened: The confirm says "The money goes back into Goals." The result is "Undone. $85.00 is back in Goals. Add the goal again if you still want it." Concert tickets is gone, and Shoes now shows "$50 of $50, You can buy it!". Home still shows the old "Nice! $85.00 came out of Goals for Concert tickets." banner.
- What I expected: SPEC says the buy "can be undone from History". A teen who tapped "Yes, I bought it" by mistake expects Undo to put the goal back where it was, with its money, not to have to type it in again and re-order it.

### L8. With Track my spending off, "Your money" says Spend is "everything that went into it", but it subtracts purchases
- Kind: bug
- What I did: "Skip for now", logged $312.47, Done. Settings → Track my spending on → Done. "Log a purchase" $12.40 → "Log purchase". Settings → Track my spending off.
- What happened: Your money says "Spend $143.84" and "Spend isn't tracked, so this is everything that went into it. Turn on Track my spending to see what's left." But $156.24 went into Spend, and $143.84 is the left-to-spend figure. History still lists the −$12.40 purchase. Home still shows "Logged. $12.40 came out of Spend. You have $143.84 left to spend."
- What I expected: SPEC "Off: no purchases, no left-to-spend, no balance check anywhere." Show $156.24 to match the sentence, or change the sentence. Also hide the purchase rows and the stale left-to-spend message while tracking is off.

### L9. Buying a goal for more than its price, with tracking on, leaves "left to spend" wrong and doesn't say where the extra came from
- Kind: confusing
- What I did: Set up a goal "Concert tickets" for $85, logged $500, turned Track my spending on. "Buy it", typed 120, "Yes, I bought it".
- What happened: "Nice! $85.00 came out of Goals for Concert tickets. The extra $35.00 didn't come from Goals." The Spending card still says "$250.00 left to spend". Its activity list shows "Bought: Concert tickets −$85.00" right under "left to spend", so the $85 looks like it came out of Spend when it didn't, and the $35 that did come from somewhere is missing.
- What I expected: With tracking on, offer to take the extra $35 out of Spend, or at least say "Log the extra $35.00 as a purchase". Goal buys in the Spending card should be marked as coming from Goals.

### L10. The goal date slides later every day between paydays and is about a week early
- Kind: confusing
- What I did: Set up AirPods for $250 and logged $312.47 on Nov 7. Reloaded on Nov 20 and Nov 23 without logging anything. Nov 21 is the next payday the app itself expects.
- What happened: Nov 7: "Ready in about 7 weeks (around Dec 26)". Nov 20: "Ready in about 7 weeks (around Jan 8, 2027)". Nov 23: "(around Jan 11, 2027)". Nothing changed except the day I looked, but the goal moved two weeks away. The date is also early. Paid every two weeks, Goals after the Nov 21, Dec 5 and Dec 19 paychecks is 4 x $62.49 = $249.96, still short of $250. The money arrives with the Jan 2 paycheck, a week after "around Dec 26". This follows SPEC's "today plus that many weeks", and that rule is the problem.
- What I expected: Count from the last payday (or the next expected payday) instead of from today, so the date stays put between paydays. Round up to a payday so "around" is never early.

### L11. Split changes are silently thrown away when you tap Done, and old messages contradict the boxes
- Kind: lazy-teen friction
- What I did: Settings → typed 10 / 10 / 80. The preview showed "Spend about $16 a week" and "AirPods: ready in about 2 weeks (around Nov 21)" (hand calculation: 80% of $156.235 is $124.99 a week; $187.51 missing / $124.99 = 1.5, so 2 weeks). Then I tapped "Done" at the top. In a second run: "Save split" with 60/30/10, then typed 70/30/0.
- What happened: Run 1: nothing was saved and nothing said so. Reopening Settings shows the old split. Run 2: under the boxes showing 70/30/0, it still says "Saved. Paychecks you log from now on will be split 60% Spend, 30% Save, 10% Goals." The preview inside Settings says "AirPods: your split puts nothing into Goals. Change it in Settings." while the teen is already in Settings.
- What I expected: SPEC says "Nothing changes until Save split", so at least warn on Done ("Save your new split?"). Clear the "Saved" message as soon as a box changes, and drop "Change it in Settings." inside Settings.

### L12. First run drops a typed goal on "Skip for now", and the big "Log your first paycheck" text can't be tapped
- Kind: lazy-teen friction
- What I did: First run: typed "AirPods" and "250", then tapped "Skip for now" (thinking it skips the paycheck). Then "Not paid yet", then tapped the big headline "Log your first paycheck" and the goal line "Log a paycheck to see when."
- What happened: The goal was thrown away without a word. Home says "Saving for something? Add a goal...". Neither headline does anything when tapped. Only the "I got paid" button at the bottom opens the sheet.
- What I expected: Keep a goal that is fully typed in, or ask "Save AirPods?". Make the "Log your first paycheck" headline and "Log a paycheck to see when." open the paycheck sheet.

### L13. Status messages never go away and go stale
- Kind: confusing
- What I did: Any action that shows a green message on Home (add a goal, log a purchase, buy a goal), then waited, and then did the steps in L7 and L8.
- What happened: The message is still there after 12 seconds and stays until some other action replaces it. It sits between the headline and the goals and pushes the cards down. Messages also outlive what they describe: "Nice! $85.00 came out of Goals for Concert tickets." stays after that buy is undone, and "You have $143.84 left to spend." stays after tracking is turned off.
- What I expected: Messages fade after a few seconds, or at least clear when the data they describe changes.

### L14. Long goal times are shown as hundreds or thousands of weeks
- Kind: nit
- What I did: Set up a goal "Car" for $5,000 with $312.47 every two weeks. Separately, a goal priced at $1,000,000.
- What happened: "Ready in about 159 weeks (around Nov 24, 2029)" and "Ready in about 32322 weeks (around Apr 25, 2646)". The second has no thousands separator, and nobody can picture 159 weeks.
- What I expected: Switch to months or years past about a year ("about 3 years, around Nov 2029"), and maybe say gently that the goal is a long way off at this split.

---

## Resolution of the second review (by the builder)

Every fix had a failing test first: unit tests in `tests/pay.test.js`, `words.test.js`,
`plan.test.js` and `storage.test.js`, and browser tests in `e2e/review2.spec.js` at both phone
sizes. No existing test was changed. SPEC.md, CONTEXT.md and docs/adr/0004 were updated to
match.

| Finding | Outcome |
|---|---|
| L1 duplicate wrecks the numbers | Fixed in two parts. Paychecks less than 4 days apart now count as one payday, so the next-day duplicate gives $156 a week (2×, a real second paycheck's worth) instead of $1,094; this also makes two jobs paying a few days apart come out right. The sheet now says "You already logged $312.47 yesterday." A blocking "log another one?" step was **not** added: two existing tests log two paychecks on one day on purpose, and changing them needs the owner's OK. |
| L2 forgetting one paycheck halves the numbers | Fixed. When a payday was clearly skipped, the sheet offers "Also add the paycheck I missed (around Nov 21)"; with it, the example stays at $78 to spend. SPEC's "does not fall" sentence was wrong for this case and is reworded. |
| L3 an open app doesn't refresh | Fixed in Chromium: coming back on screen (`visibilitychange`, `pageshow`) re-checks the date and storage. Still needs a check on a real iPhone. |
| L4 Safari can clear data; no backup prompt | Fixed. The iPhone card says Safari may clear the info if Budgeteer isn't opened for a week, and Home shows "Back up your info" after every 4 paychecks since the last backup or "Not now". The 7-day clearing itself can't be tested here. |
| L5 missing dot saved without a question | Fixed for paychecks 4× the last one or more ("Is $31,247.00 right?" then "Yes, add $31,247.00"), and "Undo paycheck" stays on Home after "Done". **Not done:** a check on the very first paycheck (no last one to compare with; an existing test logs $1,000,000 as a first paycheck) and on Buy it prices (the extra never leaves Goals anyway). |
| L6 cheap goal under an expensive one | Fixed: "The money's already in Goals. Move it to the top to buy it now." and a "Move to top" action. |
| L7 Undo of a buy loses the goal | Fixed: "Add it back" returns the goal to the top. Its price is what came out of Goals, because older goal buys don't record the original price and adding a field would change an existing test. |
| L8 "Your money" Spend with tracking off | Fixed: it now shows everything that went into Spend, as the note says. Purchases stay listed in History (an existing test checks that), where they can still be removed. |
| L9 buying for more, with tracking on | Fixed: "Take $35.00 from Spend" logs the extra as a purchase, and goal buys show "from Goals" on the Spending card and in History. |
| L10 date slides and is early | Sliding fixed: the date is counted from the last payday, and a passed date says "Should be ready by now. Log your paycheck to check." **Not done:** rounding to a payday so "around" is never early, because it would change the expected dates in about ten existing tests; waiting for the owner (SPEC.md decision 12). |
| L11 split thrown away on Done | Fixed: closing Settings with a new split asks "Save your new split (...)?", an old "Saved." clears when a box changes, and the preview says "nothing goes to Goals with this split" instead of "Change it in Settings". |
| L12 Skip drops a goal; headline not tappable | Fixed: "Skip for now" keeps a fully typed goal, and "Log your first paycheck" opens the paycheck sheet. The goal line "Log a paycheck to see when." is still plain text. |
| L13 stale messages | Fixed: messages clear when the data changes and fade after 10 seconds. |
| L14 thousands of weeks | Fixed: "about a year" after 52 weeks, then years ("about 3 years"). |
