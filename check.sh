#!/usr/bin/env bash
# The one command that says whether the project is healthy. Keep it fast.
set -euo pipefail
cd "$(dirname "$0")"

echo "== syntax =="
for f in src/*.js; do node --check "$f"; done

echo "== unit tests =="
node --test tests/*.test.js

# Ticket 008 adds Playwright. Once it is installed, the browser flow runs too.
if [ -d node_modules/@playwright/test ]; then
  echo "== browser flow =="
  npx playwright test
fi

echo "check passed"
