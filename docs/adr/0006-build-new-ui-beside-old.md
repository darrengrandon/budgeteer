# 6. Build the new phone UI beside the old one, then switch

Date: 2026-11-07. Status: accepted.

## Context
The owner allowed old UI tests to be removed only after new tests cover every behavior
that still exists. Replacing `index.html` in one ticket would break the old tests before
the new ones exist.

## Decision
Build the new UI in `phone.html`, `phone.css` and `src/phone.js`, tested by
`e2e/phone/` at iPhone and Pixel sizes, while the old page and its tests keep passing.
A cutover ticket then makes the new UI `index.html`, removes the old page, its tests and
unused wording, and points the new tests at `index.html`.

## Consequences
- `./check.sh` stays green at every commit.
- For a few tickets the repo holds two UIs; the cutover ticket removes the old one.
