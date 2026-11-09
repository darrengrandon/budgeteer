// What Home shows, worked out without a browser (ticket 015).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homePlan, backupDue } from '../src/plan.js';
import { newState, addPaycheck, addGoal, setSplit, balances } from '../src/storage.js';
import { addDays } from '../src/budget.js';
import { shortDateFrom } from '../src/words.js';

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
    [['$40 of $300', 'Ready around Feb 13, 2027 (in about 14 weeks)']]);
});

test('a funded goal can be bought, and the next goal waits its turn', () => {
  let state = addPaycheck(newState(), { date: TODAY, cents: 20000 }); // $40 to goals
  state = addGoal(state, { name: 'Tickets', targetCents: 3000 });
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  const [tickets, phone] = homePlan(state, TODAY).goals;
  assert.equal(tickets.funded, true);
  assert.equal(tickets.line, 'You can buy it!');
  assert.equal(phone.amounts, '$10 of $300');
  assert.equal(phone.line, 'Ready around Feb 27, 2027 (in about 16 weeks)'); // $290 left at $20 a week = 14.5
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

// Second review (REVIEW.md L4, L6, L10)

test('L10: Home counts the goal date from the last payday, so it does not slide', () => {
  let state = addPaycheck(newState(), { date: '2026-11-07', cents: 31247 });
  state = addGoal(state, { name: 'AirPods', targetCents: 25000 });
  assert.equal(homePlan(state, '2026-11-07').goals[0].line, 'Ready around Jan 2, 2027 (in about 8 weeks)');
  assert.equal(homePlan(state, '2026-11-20').goals[0].line, 'Ready around Jan 2, 2027 (in about 7 weeks)');
});

test('L6: a goal the Goals money could buy now, if it were first, says so', () => {
  let state = addPaycheck(newState(), { date: TODAY, cents: 31247 }); // $62.49 in Goals
  state = addGoal(state, { name: 'Car', targetCents: 500000 });
  state = addGoal(state, { name: 'Phone case', targetCents: 2000 });
  const [car, phoneCase] = homePlan(state, TODAY).goals;
  assert.match(car.line, /^Ready around /);
  assert.equal(phoneCase.line, "The money's already in Goals. Move it to the top to buy it now.");
  assert.equal(phoneCase.canMoveToBuy, true);
});

test('L4: a backup is due after 4 paychecks since the last one on this phone', () => {
  assert.equal(backupDue(3, null), false);
  assert.equal(backupDue(4, null), true);
  assert.equal(backupDue(7, 4), false);
  assert.equal(backupDue(8, 4), true);
});

// Overnight Phase 1, decision 1: "around <date>" is rounded up to the payday when the money
// will really be there, so it is never early.

test('the goal date is the payday when the money really arrives (REVIEW.md L10 example)', () => {
  let state = addPaycheck(newState(), { date: '2026-11-07', cents: 31247 });
  state = addGoal(state, { name: 'AirPods', targetCents: 25000 });
  // $62.49 to Goals each payday, every 2 weeks: $249.96 after Dec 19, so Jan 2 it is.
  assert.equal(homePlan(state, '2026-11-07').goals[0].line, 'Ready around Jan 2, 2027 (in about 8 weeks)');
  assert.equal(homePlan(state, '2026-11-20').goals[0].line, 'Ready around Jan 2, 2027 (in about 7 weeks)');
});

test('the goal date is never earlier than steady paychecks would really get there, nor a payday late', () => {
  for (const cents of [4250, 18000, 31247, 99999]) {
    for (const gap of [7, 14]) {
      for (const goalsPercent of [10, 20, 35]) {
        for (const target of [2500, 25000, 123456]) {
          const split = { spend: 80 - goalsPercent, save: 20, goals: goalsPercent };
          let state = setSplit(newState(), split);
          state = addPaycheck(state, { date: addDays('2026-11-07', -gap), cents });
          state = addPaycheck(state, { date: '2026-11-07', cents });
          state = addGoal(state, { name: 'Thing', targetCents: target });
          const line = homePlan(state, '2026-11-07').goals[0].line;
          if (line === 'You can buy it!') continue;
          const predicted = /around (\w+ \d+(?:, \d{4})?) \(/.exec(line)?.[1];
          // Simulate the paydays that would really come.
          let day = '2026-11-07';
          let real = state;
          while (balances(real).goals < target) {
            day = addDays(day, gap);
            real = addPaycheck(real, { date: day, cents });
          }
          const label = `${cents} every ${gap} days, ${goalsPercent}% to a ${target} goal`;
          assert.equal(predicted, shortDateFrom(day, '2026-11-07'), label);
        }
      }
    }
  }
});
