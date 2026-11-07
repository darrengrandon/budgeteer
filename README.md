# Budgeteer

A budgeting tool for teens with a first job. Type in a paycheck, it splits into
Spend / Save / Goals, and shows how many weeks until each goal. Runs in the browser,
stores data on the device, needs no account or bank.

## Start building (Kubuntu)

```
node -v               # needs 20 or newer
git init && git add -A && git commit -m "Scaffold"
./check.sh            # fails on purpose: the logic tests have no implementation yet
claude                # then paste the contents of PROMPT.md
```

## Why it is laid out this way

- **SPEC.md** is the use case in Markdown, with open questions Claude Code asks you
  first so the work is front-loaded.
- **CLAUDE.md** is five lines. Only add a line after the AI makes a mistake.
- **check.sh** is the single feedback loop the AI runs to check its own work.
- **tests/budget.test.js** is written before the code. Claude Code makes it pass and
  may not edit it.
- **tasks/** are small tickets with dependencies and "done when" checks. Each one ends
  with using the real app in a browser.
- **Ticket 009** has a second agent try the app cold and check the first one's work.

## Languages

Only HTML, CSS and plain JavaScript. The logic, the unit tests (Node's built-in test
runner), the page and the browser test (Playwright) are all JavaScript, so there is
one language to read and no build step. The only other code is the ten-line
`check.sh`. Python appears only as the one-line command that serves the page for the
browser test. TypeScript is left out on purpose because it needs a compile step or a
type checker, and the tests plus JSDoc comments cover what it would catch here.

## Optional extras from the talks

- Install the speaker's skills (github.com/schneidenbach/skills), but read each
  `SKILL.md` first. A skill is instructions your agent will follow, so treat it like
  code you are about to run.
- Use the context7 tool for current library docs if you have it.
- Use the biggest model you can for the build.

## Safety

The app has no network calls and no accounts. Still run Claude Code in a sandbox or a
throwaway folder, not somewhere with your keys and personal files. Docker is not
needed here because there is no database.
