# Budgeteer design

The one thing a teen wants to know is **"when can I buy my thing?"** Every screen answers
that first and keeps everything else quiet. This file is the reference for colors, type,
spacing and motion; `styles.css` uses exactly these tokens.

## Principles
1. **One answer, big.** Home opens on the top goal and its date, in the largest type in the
   app. Everything else is smaller and quieter.
2. **One large number, one quiet sentence.** A big value is followed by at most one plain
   line that says what it means. No labels above it, no units to decode.
3. **Calm by default.** Space separates things, not lines or boxes. Color is rare: one accent
   for the action you can take, and state colors only when something is right, wrong or due.
4. **Cards only for objects.** A goal you are saving for (other than the top one) is a card:
   name, amount, a quiet bar, then the date. Sheets are surfaces. Nothing else gets a box.
5. **Thumb first.** The main action ("I got paid") sits at the bottom, in reach of a thumb,
   and stays put. Messages about what just happened ("Paycheck added. Undo") appear right
   above it.
6. **Numbers line up, unmarked.** All digits use tabular numerals, so amounts don't jiggle as
   they change. Numbers carry no underlines or other marks; a goal card's "?" explains them.
7. **Nothing moves, except once.** The only motion is the moment a goal becomes fully saved.

## Not this
No purple or blue gradients. No cream background with a serif and a terracotta accent. No
neon on black. No emoji as decoration. No glass or blur. No left accent bars. No shadows, and
no rounded box around every block. Not everything centered. No confetti.

## Color
One accent, a deep petrol (blue-green). Neutrals carry a slight petrol tint. Green, red and
amber appear only for states: saved, wrong, due. Every text pair is at least 4.5:1 and every
control edge or bar at least 3:1, in both themes (`tests/contrast.test.js`,
`tests/phone-css.test.js`).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f2f5f6` | `#0e1416` | Page |
| `--card` | `#ffffff` | `#162024` | Goal cards, sheets |
| `--text` | `#141c1f` | `#e4ecef` | Text |
| `--muted` | `#55636a` | `#9aaab1` | Quiet lines, help |
| `--border` | `#dce3e6` | `#26333a` | Hairlines between rows |
| `--input-bg` | `#ffffff` | `#1b272c` | Inputs |
| `--input-border` | `#76858c` | `#6f818a` | Input and control edges |
| `--accent` | `#0f5f73` | `#7cc6d6` | The one accent: the main button, links, chosen chips |
| `--accent-text` | `#ffffff` | `#072530` | Text on the accent |
| `--focus` | `#0f5f73` | `#7cc6d6` | Focus ring (same as the accent) |
| `--goals` | `#0f5f73` | `#7cc6d6` | Progress bar fill (same as the accent) |
| `--track` | `#dce3e6` | `#2a383e` | Progress bar track |
| `--ok` / `--ok-bg` | `#1e6b3a` / `#e4f2e8` | `#8fd3a6` / `#15301f` | State: saved, funded, done |
| `--error` / `--error-bg` | `#b3261e` / `#fcebe9` | `#ffb4ab` / `#3a1b18` | State: something is wrong |
| `--notice-text` / `--notice-bg` | `#5a4000` / `#fdf1d3` | `#f5d98a` / `#33290e` | State: something is due ("Got paid? Log it.") |

Contrast (lowest pairs): muted text 5.7:1 light and 6.9:1 dark; input edges 3.8:1 and 3.8:1.

## Type
The system font only (`system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif`),
no web fonts. Three weights: 400, 600, 700. Digits are tabular everywhere.

| Step | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `--type-display` | 2.5rem (40px) | 1.05 | 700 | The top goal's date, "You can buy it!" |
| `--type-title` | 1.5rem (24px) | 1.2 | 700 | The payoff on the paycheck result, sheet titles |
| `--type-heading` | 1.125rem (18px) | 1.3 | 600 | Goal names, section headings (the spend line uses this size at 400) |
| `--type-body` | 1.0625rem (17px) | 1.45 | 400 | Everything else |
| `--type-small` | 0.9375rem (15px) | 1.4 | 400 | Quiet lines: amounts, where the money went, help, explanations |

Inputs are 18px or more, so iPhone doesn't zoom in. At 320px the display step drops to 2rem.

## Space and shape
| Token | Value |
|---|---|
| `--space-1` … `--space-7` | 4, 8, 12, 16, 24, 32, 48px |
| `--radius-s` | 10px: inputs, small boxes |
| `--radius-m` | 14px: buttons |
| `--radius-l` | 20px: goal cards, sheet tops |
| `--radius-full` | 999px: chips, progress bars |

The page has a 16px side margin plus the safe areas. Home has one vertical rhythm: every block
and every goal card is `--space-4` (16px) apart. Every tap target is at least 44 by 44px, and
the main button is 60px tall. Everything works at 320px wide.

## Motion
- **Only one moment:** when a goal becomes fully saved, its card's green tint fades out over
  1.2s and "You can buy it!" rises 6px into place over 0.6s, once. It plays when Home is in
  view (after the paycheck sheet closes), never on page load.
- With `prefers-reduced-motion: reduce` nothing moves; the goal just shows its new state.
- No other animation or transition: sheets appear without sliding, and switches change
  without sliding.

## Controls
- **One main button per screen:** full width, the accent, 60px ("I got paid", "Next", "Add paycheck",
  "Done", "Save goal"). "Download backup" is the one bordered button: something we want done.
- **Quiet text actions** for everything else ("Cancel", "Skip for now", "Undo", "Not now",
  "+ Add a goal", "Log a purchase", "Move up", "Remove" in History): the accent color, 600 weight,
  no underline, no border, still 44px tall. A destructive one ("Remove this goal") uses the error
  color.
- **One focus ring:** 3px in the accent, 2px out from the edge, on everything. On a field with an
  error the same ring turns red, and the field's 1px border turns red too (no thicker border).
- **Choice chips:** pill-shaped, outlined; the chosen one is filled with the accent. One control
  for "How often do you get paid?" everywhere (the paycheck result and Settings). It is a radio
  group: a tap chooses, arrow keys move, and only the chosen chip is in the Tab order.
- **"?" on a goal card:** a small circled "?" in a 44px target, between the name and the "⋯"
  menu, and lighter than it (a hairline ring, a regular-weight mark). It opens one plain sentence
  about that card's numbers, under the date; a second tap closes it.

## Screens
- **Home**, top to bottom: the top goal (name, "?", "⋯"; "$40 of $300"; a thin bar; "Ready
  around Dec 19" with the date in the display size and "(in about 7 weeks)" quiet; "Buy it"
  when funded). The amount sits about 8px above its bar. Then the other goals as cards in the
  same order: amount, bar, date. Then
  directly under them one quiet line in regular weight, "Spend about $78 a week", with the pay
  line under it. Then "+ Add a goal". "I got paid" stays at the bottom, with Undo messages
  just above it, and the page leaves room so the last line scrolls fully above the bar.
- **Paycheck result:** the payoff first, each goal's new date ("AirPods: ready around Dec 19
  (in about 6 weeks)") in the title size. Then one short quiet line about where the money
  went, "From your $312.47: $156.24 to spend (about $78 a week), $93.74 saved, $62.49 for
  goals.", with a small "Undo" beside it. Then, after the first paycheck only, the "How often
  do you get paid?" chips. "Done" is pinned at the bottom of the sheet: only the content above
  it scrolls, so it is on screen at 320px and with large text.
- **Settings:** sections separated by space and a hairline, each a heading, one quiet line of
  help, then the control. "How often do you get paid?" comes first, above "Your split". All text
  other than headings and fields is the body size; help and dates are quiet by color, not size.
- **First run:** a title, one quiet line, the two fields, "Next", then "Skip for now" and
  "Restore a backup" side by side from the left edge.
- **Sheets** (paycheck, goal, buy, purchase): a title, the fields, the main button, then quiet
  text actions. A reminder ("You already logged $156.00 today.") is a quiet line; only a
  question that needs an answer ("Log another paycheck?") gets the amber state box.
- **The spending card** (only with Track my spending on): what is left, "Log a purchase", and the
  latest three under a hairline.
- Nothing covers content with a shadow or a fade: the "I got paid" bar is solid with a hairline
  above it, and sheets sit on a plain dimmed backdrop.
