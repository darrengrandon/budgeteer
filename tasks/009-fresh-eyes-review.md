---
id: 009
title: Fresh-eyes review by a second agent
depends_on: [008]
status: done
---

## Goal
Start a separate agent with no memory of the build. Give it only SPEC.md and the
running app, and ask it to use the app as a teen with a first job would, then report
confusing wording, broken flows and anything that disagrees with the spec. Save its
report to `REVIEW.md`.

Also have that agent review the whole code change (the git diff since the scaffold)
for bugs, unclear code, missing tests, and anything that breaks the rules in
CLAUDE.md. Add its findings to `REVIEW.md`.

## Done when
Every real finding has a failing test first, then a fix. `./check.sh` passes.
Findings you decide not to fix are listed in `REVIEW.md` with a one-line reason.
