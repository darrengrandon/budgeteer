// What Home shows, worked out without a browser (ticket 015).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homePlan } from '../src/plan.js';
import { newState, addPaycheck, addGoal, setSplit } from '../src/storage.js';

const TODAY = '2026-11-07';

test('before the first paycheck: ask for it, and goals wait for pay', () => {
  const state = addGoal(newState(), { name: 'Phone', targetCents: 30000 });
  const plan = homePlan(state, TODAY);
  assert.equal(plan.headline, 'Log your first paycheck');
  assert.equal(plan.basis, '');
  assert.equal(plan.nudge, false);
  assert.deepEqual(plan.goals.map((g) => [g.name, g.amounts, g.line, g.funded]),
    [['Phone', '$0 of $300', 'Log a paycheck to see when.', false]]);
});

test('after one $200 paycheck: spend about $50 a week, and the goal has a date', () => {
  let state = addPaycheck(newState(), { date: TODAY, cents: 20000 });
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  const plan = homePlan(state, TODAY);
  // $200 every 2 weeks = $100 a week. 50% = $50. Goals: 20% = $20 a week; $260 left = 13 weeks.
  assert.equal(plan.headline, 'Spend about $50 a week');
  assert.equal(plan.basis, 'Out of about $100 a week of pay.');
  assert.deepEqual(plan.goals.map((g) => [g.amounts, g.line]),
    [['$40 of $300', 'Ready in about 13 weeks (around Feb 6, 2027)']]);
});

test('a funded goal can be bought, and the next goal waits its turn', () => {
  let state = addPaycheck(newState(), { date: TODAY, cents: 20000 }); // $40 to goals
  state = addGoal(state, { name: 'Tickets', targetCents: 3000 });
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  const [tickets, phone] = homePlan(state, TODAY).goals;
  assert.equal(tickets.funded, true);
  assert.equal(tickets.line, 'You can buy it!');
  assert.equal(phone.amounts, '$10 of $300');
  assert.equal(phone.line, 'Ready in about 15 weeks (around Feb 20, 2027)'); // $290 left at $20 a week = 14.5
});

test('the headline follows the Spend percent', () => {
  let state = addPaycheck(newState(), { date: TODAY, cents: 20000 });
  state = setSplit(state, { spend: 30, save: 30, goals: 40 });
  assert.equal(homePlan(state, TODAY).headline, 'Spend about $30 a week');
});

test('the "Got paid?" nudge shows after the usual gap plus 2 days', () => {
  const state = addPaycheck(newState(), { date: '2026-10-22', cents: 20000 });
  assert.equal(homePlan(state, '2026-11-07').nudge, false);
  assert.equal(homePlan(state, '2026-11-08').nudge, true);
});
