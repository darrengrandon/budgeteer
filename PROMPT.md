# Kickoff prompt (paste this into Claude Code)

Goal: build Budgeteer as described in SPEC.md by working through tasks/ in
dependency order.

Before writing any code, read SPEC.md and ask me the "Open questions" in one batch
with your question tool. Record my answers under "Decisions" in SPEC.md and update
any ticket they affect. Then start.

For each ticket:
1. Write the tests first, or confirm the existing ones fail for the right reason.
2. Implement until ./check.sh passes.
3. Open the app in a browser and use the feature the way a teen would. Fix anything
   that feels broken or confusing.
4. Set `status: done` in the ticket's front matter and commit with the ticket id.

Done when every ticket is done, ./check.sh passes, and the Playwright flow from
ticket 008 passes against the real page. Take as long as you need.

Stop and ask me only if a test looks wrong, a ticket contradicts SPEC.md, or you
would need network access beyond installing dev dependencies.
