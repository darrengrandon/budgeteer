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
   name, date, amount, a quiet bar. Sheets are surfaces. Nothing else gets a box.
5. **Thumb first.** The main action ("I got paid") sits at the bottom, in reach of a thumb,
   and stays put. Messages about what just happened ("Paycheck added. Undo") appear right
   above it.
6. **Numbers line up.** All digits use tabular numerals, so amounts don't jiggle as they change.
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
| `--type-title` | 1.5rem (24px) | 1.2 | 700 | "Nice.", sheet titles |
| `--type-heading` | 1.125rem (18px) | 1.3 | 600 | Goal names, section headings, the spend line |
| `--type-body` | 1.0625rem (17px) | 1.45 | 400 | Everything else |
| `--type-small` | 0.9375rem (15px) | 1.4 | 400 | Quiet lines: amounts, help, explanations |

Inputs are 18px or more, so iPhone doesn't zoom in. At 320px the display step drops to 2rem.

## Space and shape
| Token | Value |
|---|---|
| `--space-1` … `--space-7` | 4, 8, 12, 16, 24, 32, 48px |
| `--radius-s` | 10px: inputs, small boxes |
| `--radius-m` | 14px: buttons |
| `--radius-l` | 20px: goal cards, sheet tops |
| `--radius-full` | 999px: chips, progress bars |

The page has a 16px side margin plus the safe areas. Every tap target is at least 44 by 44px,
and the main button is 60px tall. Everything works at 320px wide.

## Motion
- **Only one moment:** when a goal becomes fully saved, its card's green tint fades out over
  1.2s and "You can buy it!" rises 6px into place over 0.6s, once. It plays when Home is in
  view (after the paycheck sheet closes), never on page load.
- With `prefers-reduced-motion: reduce` nothing moves; the goal just shows its new state.
- No other animation or transition: sheets appear without sliding, and switches change
  without sliding.

## Screens
- **Home**, top to bottom: the top goal (name, "Ready around Dec 19" with the date in the
  display size, "(in about 7 weeks)", "$40 of $300", a thin bar, "Buy it" when funded); the
  other goals as cards; "+ Add a goal"; one quiet line "Spend about $78 a week" with the pay
  line under it; then "I got paid" at the bottom. Undo messages appear just above it.
- **Paycheck result:** "Nice." as a title, then one sentence about where the money went, then
  each goal's new date, then "Done".
- **Settings:** a list of sections separated by space and a hairline. A heading, one quiet
  line of help, then the control.
- Numbers that explain themselves have a dotted underline. A tap opens one quiet sentence
  under the number.
