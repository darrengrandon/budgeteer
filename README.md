# Budgeteer

"Log your paycheck. Budgeteer tells you what to spend and when you can buy your thing."

A phone-only budgeting app for teens with a first job. It's an installable web app that
works offline, with no account, no bank and no network calls; data stays on the phone.
SPEC.md is the product, CONTEXT.md the glossary, docs/adr/ the big decisions.

To try it: `python3 -m http.server 8000 --bind 127.0.0.1`, then open
http://127.0.0.1:8000 (use your browser's phone view, about 390px wide).

## Start building (Kubuntu)

```
node -v               # needs 20 or newer
git init && git add -A && git commit -m "Scaffold"
./check.sh            # fails on purpose: the logic tests have no implementation yet
claude                # then paste the contents of PROMPT.md
```

## Browser tests

`./check.sh` also runs the Playwright tests in `e2e/` once they are installed:

```
npm install
npm run setup:browsers   # downloads Chromium into .playwright-browsers/
npm run icons            # only after changing icons/icon.svg: remakes the PNG icons
```

npm's cache (`.npm-cache/`), the browsers, and Playwright's temporary files
(`.playwright-tmp/`) all stay inside this folder and are gitignored. The test server
listens on 127.0.0.1 only. Every browser test runs twice, at an iPhone 15 size and a
Pixel 9 size. Only Chromium can run here, so "iPhone" means Chromium with an iPhone
screen and user agent, not Safari; SPEC.md lists what that leaves untested.
`e2e/teen-flow.spec.js` is the whole lazy-teen flow in one test.

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
