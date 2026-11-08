---
id: 017
title: Settings on the phone
depends_on: [016]
status: done
---

## Goal
A full-height Settings sheet: split editor (total must be 100, live top-goal date, saved
only on "Save split", old paychecks keep theirs), Your money, the tracking switch (wired in
018), History with Remove for every kind of record (blocked removals explain why, before
asking), Backup download and restore (v1 and v2 files, untrusted, future dates refused),
the unreadable-data download, and Add to Home Screen help.

## Done when
Phone tests first for each part, including a v1 backup restoring with nothing lost and a
corrupted file changing nothing. `./check.sh` passes; screenshots.
