---
id: 007
title: Phone layout, dark mode, backup buttons
depends_on: [003, 004, 005, 006]
status: done
---

## Goal
- Works at 400px wide with no sideways scrolling. Light and dark theme.
- Visible keyboard focus, labels on every input, readable contrast.
- "Download backup" and "Restore backup" buttons using the validation from ticket 002.

## Done when
`./check.sh` passes. In a real browser at phone width: no horizontal scroll, both
themes readable, a backup downloaded and restored gives identical balances, and a
corrupted file is rejected with a clear message.
