// How often the teen gets paid sets the usual gap (docs/adr/0007). Only "It's different
// every time" learns the gap from logged paydays (decision 9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payGap, weeklyPay, weeklySpendCents, gotPaidDue, missedPaydays } from '../src/pay.js';
import { homePlan } from '../src/plan.js';
import { newState, upgradeToV3, setPayFrequency, addPaycheck, addGoal } from '../src/storage.js';

/** @param {string[]} dates @param {number} cents */
const pays = (dates, cents) => dates.map((date) => ({ date, cents }));

/**
 * A version 3 state with these paychecks and this answer.
 * @param {import('../src/storage.js').PayFrequency} frequency
 * @param {{ date: string, cents: number }[]} paychecks
 */
function stateWith(frequency, paychecks) {
  let state = setPayFrequency(upgradeToV3(newState()), frequency);
  for (const p of paychecks) state = addPaycheck(state, p);
  return state;
}

// A weekly earner who forgot to log Nov 7.
const FORGOT_ONE = pays(['2026-10-24', '2026-10-31', '2026-11-14'], 10000);

test('(a) a weekly earner who forgets one paycheck keeps the right weekly Spend number', () => {
  const pay = weeklyPay(FORGOT_ONE, '2026-11-14', 'weekly');
  assert.equal(weeklySpendCents(pay, 50), 5000);
  assert.equal(homePlan(stateWith('weekly', FORGOT_ONE), '2026-11-14').headline, 'Spend about $50 a week');
});

test('(c) "It\'s different every time" still learns the gap from logged dates', () => {
  // Gaps of 7 and 14 days: the median is 10.5, rounded to 11.
  assert.deepEqual(payGap(FORGOT_ONE, '2026-11-14', 'varies'), { num: 11, den: 1 });
  assert.deepEqual(weeklyPay(FORGOT_ONE, '2026-11-14', 'varies'), { cents: 30000, days: 33 });
  assert.deepEqual(weeklyPay(FORGOT_ONE, '2026-11-14'), weeklyPay(FORGOT_ONE, '2026-11-14', 'varies'));
  assert.equal(homePlan(stateWith('varies', FORGOT_ONE), '2026-11-14').headline, 'Spend about $32 a week');
});

test('the stated answer sets the gap, even with many paydays that say otherwise', () => {
  const weekly = pays(['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07'], 10000);
  assert.deepEqual(payGap(weekly, '2026-11-07', 'biweekly'), { num: 14, den: 1 });
  assert.deepEqual(weeklyPay(weekly, '2026-11-07', 'biweekly'), { cents: 50000, days: 70 });
  assert.deepEqual(payGap(weekly, '2026-11-07', 'varies'), { num: 7, den: 1 });
});

test('with one paycheck, each answer gives its own weekly pay', () => {
  const one = pays(['2026-11-07'], 100000);
  const today = '2026-11-07';
  assert.deepEqual(weeklyPay(one, today, 'weekly'), { cents: 100000, days: 7 });
  assert.deepEqual(weeklyPay(one, today, 'biweekly'), { cents: 100000, days: 14 });
  assert.deepEqual(weeklyPay(one, today, 'twice-monthly'), { cents: 2400000, days: 365 }); // 24 a year
  assert.deepEqual(weeklyPay(one, today, 'monthly'), { cents: 1200000, days: 365 }); // 12 a year
  assert.deepEqual(weeklyPay(one, today, 'varies'), { cents: 100000, days: 14 });
  assert.equal(weeklySpendCents(weeklyPay(one, today, 'monthly'), 50), 11507); // $1,000 x 12 x 7 / 365 / 2
});

test('missed paydays follow the answer, with dates rounded up to a whole day', () => {
  assert.deepEqual(missedPaydays(pays(['2026-11-07'], 10000), '2026-11-21', 'weekly'), ['2026-11-14']);
  assert.deepEqual(missedPaydays(pays(['2026-11-07'], 10000), '2026-11-21', 'varies'), []);
  // Monthly: 365 / 12 = 30.4 days, so 31 and 61 days after Sep 15.
  assert.deepEqual(missedPaydays(pays(['2026-09-15'], 10000), '2026-12-16', 'monthly'), ['2026-10-16', '2026-11-15']);
});

test('"Got paid? Log it." waits the stated gap plus 2 days', () => {
  const one = pays(['2026-11-07'], 10000);
  assert.equal(gotPaidDue(one, '2026-11-16', 'weekly'), false); // 9 days
  assert.equal(gotPaidDue(one, '2026-11-17', 'weekly'), true); // 10 days
  const oct = pays(['2026-10-07'], 10000);
  assert.equal(gotPaidDue(oct, '2026-11-08', 'monthly'), false); // 32 days: under 30.4 + 2
  assert.equal(gotPaidDue(oct, '2026-11-10', 'monthly'), true); // 34 days
});

test('goal dates step by the answer and are never early', () => {
  // $1,000 once a month: $200 to Goals per payday. $300 still missing = 2 paydays = 61 days.
  let state = stateWith('monthly', pays(['2026-11-01'], 100000));
  state = addGoal(state, { name: 'Laptop', targetCents: 50000 });
  const plan = homePlan(state, '2026-11-07');
  assert.equal(plan.headline, 'Spend about $115 a week');
  assert.equal(plan.goals[0].line, 'Ready in about 8 weeks (around Jan 1, 2027)');
  assert.equal(plan.nudge, false);
});

test('Home uses the answer saved in the state', () => {
  const one = pays(['2026-11-07'], 20000);
  assert.equal(homePlan(stateWith('weekly', one), '2026-11-07').headline, 'Spend about $100 a week');
  assert.equal(homePlan(stateWith('biweekly', one), '2026-11-07').headline, 'Spend about $50 a week');
});
