# Budgeteer

## Who and what
A budgeting tool for teens with a first job. They type in what they earned and it
splits the money into three buckets, keeps running totals, and says how many weeks
until each goal is reached. No bank account, no login, no network. Everything stays
on the device.

## Buckets
- **Spend**: free spending money. Purchases come out of here.
- **Save**: general savings. No target in v1.
- **Goals**: money set aside for named goals (a phone, a car, concert tickets).

Default split is 50 / 30 / 20 (Spend / Save / Goals). Percents are whole numbers
and must total 100.

## Core flow
1. First run: pick the split (preset 50/30/20, three inputs that must total 100).
2. Log a paycheck: amount (take-home, in dollars) and date (default today). It is
   split right away and added to the buckets. The page says it in plain words:
   "Your $42.50 became $21.25 to spend, $12.75 saved, $8.50 for goals."
3. Add goals: name and target amount. Goals-bucket money fills goals top to bottom.
4. Each goal shows a progress bar and "about N weeks to go", based on the average
   weekly income over the last 28 days and the Goals percent.
5. What-if slider: move percent between Spend and Goals and watch the weeks change.
   The real split only changes when the teen presses "Use this split".
6. Log a purchase: comes out of Spend.

## Rules that must always hold
- Money is stored as integer cents. Never floats.
- A split never loses or invents a cent (largest-remainder rounding).
- Each paycheck keeps the split it was logged with. Changing the split later does
  not rewrite old paychecks.
- Balances are calculated from the records, not stored.
- Plain words, no jargon. Works at phone width (about 400px). Light and dark theme.

## Out of scope for v1
Bank connections, accounts, multiple users, taxes and withholding (the teen enters
take-home pay), notifications, AI features.

## Safety check ("choose two")
The app takes input only from the person using it, keeps data only on their device,
and makes no external calls. That is at most one of the three risky traits, so it is
safe by design. Keep it that way: no network requests, no secrets in the repo, and
treat any imported backup file as untrusted.

## Open questions (ask the owner before coding)
1. Age range and tone: younger teens (14-15) or older (16-19)? Playful or plain?
2. When there are several goals, fill them top to bottom (default), split equally,
   or let the teen set a percent for each?
3. Can a purchase overspend the Spend bucket? Default: block it and say how much
   is available.
4. Should Save get its own target, such as an emergency fund?
5. Paychecks vary with hours. Is a 28-day average a good basis for projections?
6. Is a JSON backup (export and import) enough, or should it also be shareable
   with a parent?

## Decisions
Answered by the owner on 2026-11-07.

1. **Age and tone:** older teens, 16-19. Wording is plain and friendly: short
   sentences, everyday words, a little warmth, no jokes or slang.
   Example: "Nice. $8.50 went to your goals."
2. **Several goals:** fill top to bottom. Each goal fills to its target before the
   next one gets anything. The teen can move a goal up or down to set priority.
3. **Overspending:** blocked. The message says how much is available, for example
   "You have $12.40 left to spend."
4. **Save target:** none in v1. Save shows a running total only.
5. **Projection basis:** the 28-day average of paychecks (total over the window
   divided by 4 weeks), times the Goals percent. Known and accepted: it under-counts
   during a teen's first 4 weeks (one $200 paycheck reads as $50 a week).
6. **Backup:** JSON download and restore only. No sharing feature; the teen can send
   the file to a parent themselves. Nothing goes over the network.
