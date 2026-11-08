import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateToGoals, goalProjections, weeklyGoalsCents, projectGoals, trialSplit, whatIf, buyGoal,
} from '../src/goals.js';
import {
  emptyState, newState, addPaycheck, addGoal, balances, removeGoalPurchase, exportBackup, importBackup,
} from '../src/storage.js';

const phone = { id: 'g1', name: 'Phone', targetCents: 10000 };
const tickets = { id: 'g2', name: 'Concert', targetCents: 10000 };

// allocateToGoals: Goals-bucket money fills goals top to bottom (SPEC.md Decisions 2)

test('allocateToGoals fills the first goal before the next one gets anything', () => {
  assert.deepEqual(allocateToGoals(15000, [phone, tickets]), [10000, 5000]);
  assert.deepEqual(allocateToGoals(3000, [phone, tickets]), [3000, 0]);
});

test('allocateToGoals stops at each target; extra money stays unassigned', () => {
  assert.deepEqual(allocateToGoals(50000, [phone, tickets]), [10000, 10000]);
});

test('allocateToGoals with nothing saved, or no goals', () => {
  assert.deepEqual(allocateToGoals(0, [phone, tickets]), [0, 0]);
  assert.deepEqual(allocateToGoals(5000, []), []);
});

test('allocateToGoals never hands out more than is in the bucket', () => {
  const goals = [{ id: 'g1', name: 'A', targetCents: 333 }, { id: 'g2', name: 'B', targetCents: 777 }, { id: 'g3', name: 'C', targetCents: 1 }];
  for (const bucket of [0, 1, 332, 333, 334, 1110, 1111, 5000]) {
    const saved = allocateToGoals(bucket, goals);
    assert.equal(saved.reduce((a, b) => a + b, 0), Math.min(bucket, 1111), String(bucket));
    saved.forEach((cents, i) => assert.ok(cents >= 0 && cents <= goals[i].targetCents));
  }
});

test('allocateToGoals rejects a bucket that is not whole, non-negative cents', () => {
  assert.throws(() => allocateToGoals(-1, [phone]), RangeError);
  assert.throws(() => allocateToGoals(10.5, [phone]), RangeError);
});

// weeklyGoalsCents: average weekly income times the Goals percent

test('weeklyGoalsCents takes the Goals percent of weekly income, in whole cents', () => {
  assert.equal(weeklyGoalsCents(10000, 20), 2000);
  assert.equal(weeklyGoalsCents(9, 20), 2); // 1.8 rounds to 2
  assert.equal(weeklyGoalsCents(2, 20), 0); // 0.4 rounds to 0
  assert.equal(weeklyGoalsCents(10000, 0), 0);
});

// goalProjections: weeks to go for each goal, filling top to bottom

test('goalProjections: a later goal waits for the ones above it', () => {
  // 25.00 saved, 15.00 a week. Phone needs 75.00 more: 5 weeks.
  // Concert finishes when the bucket reaches 200.00: 175.00 more, 11.67 weeks -> 12.
  assert.deepEqual(goalProjections({ goalsBalanceCents: 2500, goals: [phone, tickets], weeklyCents: 1500 }), [
    { savedCents: 2500, weeks: 5 },
    { savedCents: 0, weeks: 12 },
  ]);
});

test('goalProjections: a finished goal is 0 weeks, and nothing coming in is Infinity', () => {
  assert.deepEqual(goalProjections({ goalsBalanceCents: 12000, goals: [phone, tickets], weeklyCents: 0 }), [
    { savedCents: 10000, weeks: 0 },
    { savedCents: 2000, weeks: Infinity },
  ]);
});

test('goalProjections: moving a goal to the top makes it sooner', () => {
  const before = goalProjections({ goalsBalanceCents: 0, goals: [phone, tickets], weeklyCents: 1000 });
  const after = goalProjections({ goalsBalanceCents: 0, goals: [tickets, phone], weeklyCents: 1000 });
  assert.equal(before[1].weeks, 20);
  assert.equal(after[0].weeks, 10);
});

// projectGoals: everything together, from the records

test('projectGoals uses the last 28 days of pay and the Goals percent', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-06', cents: 20000 });
  state = addPaycheck(state, { date: '2026-10-23', cents: 20000 });
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  // Goals bucket: 4000 + 4000 = 8000. Average weekly pay: 40000 / 4 = 10000. 20% -> 2000 a week.
  // Phone needs 22000 more: 11 weeks.
  const result = projectGoals(state, '2026-11-07');
  assert.equal(result.weeklyCents, 2000);
  assert.equal(result.averageWeeklyCents, 10000);
  assert.equal(result.unassignedCents, 0);
  assert.deepEqual(result.goals.map((g) => [g.goal.name, g.savedCents, g.weeks]), [['Phone', 8000, 11]]);
});

test('projectGoals with a trial split changes only the weeks, not what is saved', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-06', cents: 40000 });
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  const real = projectGoals(state, '2026-11-07');
  const trial = projectGoals(state, '2026-11-07', { spend: 30, save: 30, goals: 40 });
  assert.equal(real.goals[0].savedCents, 8000);
  assert.equal(trial.goals[0].savedCents, 8000);
  assert.equal(real.goals[0].weeks, 11); // 22000 / 2000
  assert.equal(trial.goals[0].weeks, 6); // 22000 / 4000 = 5.5 -> 6
});

test('projectGoals reports money in Goals that no goal needs', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-06', cents: 100000 }); // 20000 to goals
  state = addGoal(state, { name: 'Shoes', targetCents: 5000 });
  assert.equal(projectGoals(state, '2026-11-07').unassignedCents, 15000);
});

test('projectGoals with no recent pay gives Infinity weeks, not a crash', () => {
  let state = addPaycheck(emptyState(), { date: '2026-01-01', cents: 10000 }); // long ago
  state = addGoal(state, { name: 'Car', targetCents: 500000 });
  const result = projectGoals(state, '2026-11-07');
  assert.equal(result.averageWeeklyCents, 0);
  assert.equal(result.goals[0].weeks, Infinity);
});

// What-if (ticket 006)

test('trialSplit moves percent between Spend and Goals and keeps Save fixed', () => {
  const split = { spend: 50, save: 30, goals: 20 };
  assert.deepEqual(trialSplit(split, 35), { spend: 35, save: 30, goals: 35 });
  assert.deepEqual(trialSplit(split, 0), { spend: 70, save: 30, goals: 0 });
  assert.deepEqual(trialSplit(split, 70), { spend: 0, save: 30, goals: 70 });
  assert.deepEqual(trialSplit(split, 20), split);
});

test('trialSplit refuses a Goals percent outside what Spend and Goals share', () => {
  const split = { spend: 50, save: 30, goals: 20 };
  assert.throws(() => trialSplit(split, 71), RangeError);
  assert.throws(() => trialSplit(split, -1), RangeError);
  assert.throws(() => trialSplit(split, 20.5), RangeError);
});

test('whatIf projects every goal for a trial split without touching the state', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-06', cents: 40000 }); // 8000 to goals, $100 a week
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  state = addGoal(state, { name: 'Car', targetCents: 100000 });
  const snapshot = structuredClone(state);

  const result = whatIf(state, '2026-11-07', 40);
  assert.deepEqual(result.split, { spend: 30, save: 30, goals: 40 });
  assert.equal(result.trial.weeklyCents, 4000);
  assert.deepEqual(result.trial.goals.map((g) => g.weeks), [6, 31]); // 22000/4000 = 5.5; 122000/4000 = 30.5
  assert.deepEqual(result.current.goals.map((g) => g.weeks), [11, 61]); // at 20%: 2000 a week
  assert.deepEqual(state, snapshot);
});

// Fresh-eyes review C4: weeks were worked out from a twice-rounded weekly amount.

test('C4: weeks to go use the exact weekly amount; only the shown amount is rounded', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-07', cents: 4250 });
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  const result = projectGoals(state, '2026-11-07');
  // $42.50 / 4 = $10.625 a week, 20% = $2.125. ($300 - $8.50) / $2.125 = 137.2, so 138.
  assert.equal(result.goals[0].weeks, 138);
  assert.equal(result.weeklyCents, 213); // shown as "about $2.13 a week"
});

test('C4: second example from the review, a lower goal', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-07', cents: 4250 });
  state = addPaycheck(state, { date: '2026-10-20', cents: 10000 });
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  state = addGoal(state, { name: 'Tickets', targetCents: 8500 });
  // Weekly to goals: $142.50 / 4 x 20% = $7.125. ($385 - $28.50) / $7.125 = 50.04, so 51.
  assert.equal(projectGoals(state, '2026-11-07').goals[1].weeks, 51);
});

test('C4: goalProjections takes an exact fraction for the weekly amount', () => {
  // $2.125 a week, given exactly as 2125 / 10 cents.
  const [result] = goalProjections({ goalsBalanceCents: 850, goals: [{ id: 'g1', name: 'Phone', targetCents: 30000 }], weeklyCents: 2125, per: 10 });
  assert.equal(result.weeks, 138);
});

test('C4: what-if trial weeks are exact too', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-07', cents: 4250 });
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  // At 25%: $10.625 x 25% = $2.65625 a week. $291.50 / 2.65625 = 109.7, so 110.
  assert.equal(whatIf(state, '2026-11-07', 25).trial.goals[0].weeks, 110);
});

// Ticket 012: projections can use weekly pay learned from paycheck gaps.

test('projectGoals uses an exact weekly pay when one is given', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-07', cents: 4250 });
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  // One payday: $42.50 every 14 days = $21.25 a week. 20% = $4.25. ($300 - $8.50) / $4.25 = 68.6, so 69.
  const result = projectGoals(state, '2026-11-07', state.split, { cents: 4250, days: 14 });
  assert.equal(result.averageWeeklyCents, 2125);
  assert.equal(result.weeklyCents, 425);
  assert.equal(result.goals[0].weeks, 69);
});

test('projectGoals with no weekly pay (null) gives Infinity weeks', () => {
  const state = addGoal(emptyState(), { name: 'Phone', targetCents: 30000 });
  const result = projectGoals(state, '2026-11-07', state.split, null);
  assert.equal(result.averageWeeklyCents, 0);
  assert.equal(result.goals[0].weeks, Infinity);
});

// Ticket 013: Buy it (SPEC.md "Buy it", decisions 7 and 8)

/** Goals bucket $40: Tickets ($30) is funded, Phone ($300) has $10. */
function twoGoals() {
  let state = addPaycheck(newState(), { date: '2026-11-07', cents: 20000 }); // $40 to Goals
  state = addGoal(state, { name: 'Tickets', targetCents: 3000 });
  return addGoal(state, { name: 'Phone', targetCents: 30000 });
}

test('Buy it takes the price out of Goals, removes the goal and records the buy', () => {
  const before = twoGoals();
  const after = buyGoal(before, before.goals[0].id, { cents: 3000, date: '2026-11-07' });
  assert.deepEqual(after.goals.map((g) => g.name), ['Phone']);
  assert.deepEqual(after.goalPurchases, [{ id: 'x1', date: '2026-11-07', cents: 3000, name: 'Tickets' }]);
  assert.equal(balances(after).goals, 1000);
  assert.equal(importBackup(exportBackup(after)).ok, true);
});

test('Buy it at a lower price leaves the rest in Goals for the next goal', () => {
  const before = twoGoals();
  const after = buyGoal(before, before.goals[0].id, { cents: 2500, date: '2026-11-07' });
  assert.equal(after.goalPurchases[0].cents, 2500);
  assert.equal(balances(after).goals, 1500);
  assert.deepEqual(allocateToGoals(balances(after).goals, after.goals), [1500]); // Phone got the $5
});

test('Buy it at a higher price takes only the goal price out of Goals', () => {
  const before = twoGoals();
  const after = buyGoal(before, before.goals[0].id, { cents: 4500, date: '2026-11-07' });
  assert.equal(after.goalPurchases[0].cents, 3000);
  assert.equal(balances(after).goals, 1000);
});

test('Buy it is refused for a goal that is not fully saved, and nothing changes', () => {
  const before = twoGoals();
  const snapshot = structuredClone(before);
  assert.throws(() => buyGoal(before, before.goals[1].id, { cents: 30000, date: '2026-11-07' }),
    { name: 'RangeError', message: /isn't fully saved/ });
  assert.deepEqual(before, snapshot);
});

test('a lower goal can be bought once it is funded too', () => {
  let state = addPaycheck(newState(), { date: '2026-11-07', cents: 200000 }); // $400 to Goals
  state = addGoal(state, { name: 'Tickets', targetCents: 3000 });
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  const after = buyGoal(state, state.goals[1].id, { cents: 30000, date: '2026-11-07' });
  assert.deepEqual(after.goals.map((g) => g.name), ['Tickets']);
  assert.equal(balances(after).goals, 10000);
});

test('undoing a buy puts the money back', () => {
  const before = twoGoals();
  const after = buyGoal(before, before.goals[0].id, { cents: 3000, date: '2026-11-07' });
  assert.equal(balances(removeGoalPurchase(after, 'x1')).goals, 4000);
});

test('Buy it rejects a bad price, an unknown goal and a version 1 state', () => {
  const state = twoGoals();
  const id = state.goals[0].id;
  assert.throws(() => buyGoal(state, id, { cents: 0, date: '2026-11-07' }), RangeError);
  assert.throws(() => buyGoal(state, id, { cents: 12.5, date: '2026-11-07' }), RangeError);
  assert.throws(() => buyGoal(state, id, { cents: 3000, date: '2026-02-30' }), RangeError);
  assert.throws(() => buyGoal(state, 'g99', { cents: 3000, date: '2026-11-07' }), RangeError);
  const v1 = { ...addGoal(addPaycheck(emptyState(), { date: '2026-11-07', cents: 20000 }), { name: 'T', targetCents: 100 }) };
  assert.throws(() => buyGoal(v1, v1.goals[0].id, { cents: 100, date: '2026-11-07' }), RangeError);
});
