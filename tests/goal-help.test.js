// The "?" on each goal card: one plain sentence about its numbers (lazy-v3 review 1, item 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homePlan } from '../src/plan.js';
import { newState, upgradeToV3, addPaycheck, addGoal, setSplit } from '../src/storage.js';

/** $200 on Nov 7 ($40 to Goals), then these goals. @param {[string, number][]} goals */
function withGoals(goals, cents = 20000) {
  let state = upgradeToV3(newState());
  if (cents) state = addPaycheck(state, { date: '2026-11-07', cents });
  for (const [name, targetCents] of goals) state = addGoal(state, { name, targetCents });
  return state;
}

/** One sentence: a single full stop at the end, and no ". " or "? " inside. @param {string} text */
const oneSentence = (text) => /^[^]*[.!]$/.test(text) && !/[.!?]\s+\S/.test(text);

test('with a date: what is saved, what each paycheck adds, and the date', () => {
  const [phone, shoes] = homePlan(withGoals([['Phone', 30000], ['Shoes', 5000]]), '2026-11-07').goals;
  assert.equal(phone.explain, 'You have $40 of the $300 for Phone, and about $40 of each paycheck goes to Goals, '
    + 'so the rest should be there by the payday around Feb 13, 2027.');
  assert.equal(shoes.explain, 'Shoes has $0 of its $50 because goals higher up fill first, and about $40 of each '
    + 'paycheck goes to Goals, so the rest should be there by the payday around Feb 27, 2027.');
});

test('fully saved, no pay yet, nothing to Goals, already in Goals, and overdue', () => {
  assert.equal(homePlan(withGoals([['Tickets', 3000]]), '2026-11-07').goals[0].explain,
    'Your Goals money covers all $30 for Tickets, so you can buy it now.');
  assert.equal(homePlan(withGoals([['Phone', 30000]], 0), '2026-11-07').goals[0].explain,
    'You have $0 of the $300 for Phone, so log a paycheck and Budgeteer will work out when you can buy it.');
  const noGoals = setSplit(withGoals([['Phone', 30000]]), { spend: 50, save: 50, goals: 0 });
  assert.equal(homePlan(noGoals, '2026-11-07').goals[0].explain,
    'You have $40 of the $300 for Phone, but your split puts nothing into Goals, so change it in Settings to keep saving.');
  assert.equal(homePlan(withGoals([['Bike', 50000], ['Tickets', 3000]]), '2026-11-07').goals[1].explain,
    'Goals already holds the $30 for Tickets, but goals higher up come first, so move it to the top to buy it now.');
  assert.equal(homePlan(withGoals([['Phone', 30000]]), '2027-03-01').goals[0].explain,
    'You have $40 of the $300 for Phone, and it should be there by now, so log your paycheck to check.');
});

test('every explanation is one plain sentence', () => {
  const states = [
    [withGoals([['Phone', 30000], ['Shoes', 5000]]), '2026-11-07'],
    [withGoals([['Tickets', 3000]]), '2026-11-07'],
    [withGoals([['Phone', 30000]], 0), '2026-11-07'],
    [withGoals([['Bike', 50000], ['Tickets', 3000]]), '2026-11-07'],
    [withGoals([['Phone', 30000]]), '2027-03-01'],
  ];
  for (const [state, today] of states) {
    for (const goal of homePlan(/** @type {any} */ (state), /** @type {string} */ (today)).goals) {
      assert.ok(oneSentence(goal.explain), goal.explain);
    }
  }
});
