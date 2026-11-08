// Tap-to-explain: one plain sentence for every number on Home (lazy-v2 step 3a).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  explainHeadline, explainBasis, explainGoalAmounts, explainReady, explainLeftToSpend, explainActivity,
} from '../src/words.js';
import { homePlan, spendingExplain } from '../src/plan.js';
import { newState, upgradeToV3, setPayFrequency, addPaycheck, addGoal, addPurchase, setTrackSpending } from '../src/storage.js';

test('the headline says where "Spend about $X a week" comes from', () => {
  assert.equal(explainHeadline(10000, 50, 5000),
    'You get about $100 a week and 50% of each paycheck goes to Spend, so about $50 a week is yours to spend.');
  assert.equal(explainHeadline(10000, 0, 0),
    'Your split puts 0% of each paycheck into Spend, so there is nothing to spend each week. You can change that in Settings.');
});

test('the pay line says how weekly pay was worked out, in plain words', () => {
  const base = { averageCents: 20000, weeklyPayCents: 10000 };
  assert.equal(explainBasis({ ...base, paydayCount: 1, frequency: 'varies', gapDays: 14 }),
    'Your payday was $200.00, and until you log another one Budgeteer guesses you get paid every 2 weeks, so that\'s about $100 a week.');
  assert.equal(explainBasis({ ...base, paydayCount: 4, frequency: 'varies', gapDays: 14 }),
    'Your last 4 paydays average $200.00 and they come about every 14 days, so that\'s about $100 a week.');
  assert.equal(explainBasis({ ...base, paydayCount: 1, frequency: 'biweekly', gapDays: 14 }),
    'Your payday was $200.00 and you get paid every 2 weeks, so that\'s about $100 a week.');
  assert.equal(explainBasis({ averageCents: 10000, weeklyPayCents: 10000, paydayCount: 3, frequency: 'weekly', gapDays: 7 }),
    'Your last 3 paydays average $100.00 and you get paid every week, so that\'s about $100 a week.');
  assert.match(explainBasis({ ...base, paydayCount: 2, frequency: 'twice-monthly', gapDays: 15 }), /you get paid twice a month/);
  assert.match(explainBasis({ ...base, paydayCount: 2, frequency: 'monthly', gapDays: 30 }), /you get paid once a month/);
});

test('a goal\'s "$40 of $300" says what is saved and what is left', () => {
  assert.equal(explainGoalAmounts({ name: 'Phone', savedCents: 4000, targetCents: 30000, first: true }),
    'You have $40 saved toward Phone, which costs $300, so $260 to go.');
  assert.equal(explainGoalAmounts({ name: 'Shoes', savedCents: 0, targetCents: 5000, first: false }),
    'Goals money fills your goals from the top, so Shoes has $0 of its $50 so far, with $50 to go.');
  assert.equal(explainGoalAmounts({ name: 'Hat', savedCents: 2000, targetCents: 2000, first: false }),
    'Your Goals money covers all $20 for Hat.');
});

test('a goal\'s ready line says how the date was found', () => {
  assert.equal(explainReady({ perPaydayCents: 4000, neededCents: 26000, dateISO: '2027-02-13', todayISO: '2026-11-07', first: true }),
    'About $40 of each paycheck goes to Goals, so the $260 still needed should be there by the payday around Feb 13, 2027.');
  assert.equal(explainReady({ perPaydayCents: 4000, neededCents: 31000, dateISO: '2026-12-26', todayISO: '2026-11-07', first: false }),
    'About $40 of each paycheck goes to Goals, and the $310 needed for this goal and the ones above it should be there by the payday around Dec 26.');
});

test('"left to spend" says what went in and what came out', () => {
  assert.equal(explainLeftToSpend(10000, 500),
    "Your paychecks put $100.00 into Spend and you've logged $5.00 of purchases, so $95.00 is left.");
  assert.equal(explainLeftToSpend(10000, 0), "Your paychecks put $100.00 into Spend and you haven't logged any purchases yet.");
});

test('each latest amount says what it was', () => {
  assert.equal(explainActivity({ kind: 'paycheck', cents: 20000 }, { spend: 10000, save: 6000, goals: 4000 }),
    'This $200.00 paycheck put $100.00 into Spend, $60.00 into Save and $40.00 into Goals.');
  assert.equal(explainActivity({ kind: 'purchase', cents: 500 }), 'This $5.00 purchase came out of Spend.');
  assert.equal(explainActivity({ kind: 'goalPurchase', cents: 8500, name: 'Concert tickets' }),
    'This $85.00 came out of Goals when you bought Concert tickets.');
});

/** One $200 paycheck on Nov 7, goals Phone ($300) and Shoes ($50). */
function twoGoals(frequency = /** @type {const} */ ('varies')) {
  let state = setPayFrequency(upgradeToV3(newState()), frequency);
  state = addPaycheck(state, { date: '2026-11-07', cents: 20000 });
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  return addGoal(state, { name: 'Shoes', targetCents: 5000 });
}

test('homePlan gives an explanation for every number it shows', () => {
  const plan = homePlan(twoGoals(), '2026-11-07');
  assert.equal(plan.explain.headline,
    'You get about $100 a week and 50% of each paycheck goes to Spend, so about $50 a week is yours to spend.');
  assert.equal(plan.explain.basis,
    "Your payday was $200.00, and until you log another one Budgeteer guesses you get paid every 2 weeks, so that's about $100 a week.");
  assert.deepEqual(plan.goals.map((g) => [g.amountsExplain, g.lineExplain]), [
    ['You have $40 saved toward Phone, which costs $300, so $260 to go.',
      'About $40 of each paycheck goes to Goals, so the $260 still needed should be there by the payday around Feb 13, 2027.'],
    ['Goals money fills your goals from the top, so Shoes has $0 of its $50 so far, with $50 to go.',
      'About $40 of each paycheck goes to Goals, and the $310 needed for this goal and the ones above it should be there by the payday around Feb 27, 2027.'],
  ]);
});

test('homePlan explains the stated pay frequency', () => {
  assert.equal(homePlan(twoGoals('weekly'), '2026-11-07').explain.basis,
    "Your payday was $200.00 and you get paid every week, so that's about $200 a week.");
});

test('lines without a number get no explanation, and nothing is explained before any pay', () => {
  let state = addGoal(upgradeToV3(newState()), { name: 'Phone', targetCents: 30000 });
  const before = homePlan(state, '2026-11-07');
  assert.deepEqual(before.explain, { headline: '', basis: '' });
  assert.equal(before.goals[0].lineExplain, ''); // "Log a paycheck to see when."
  state = addPaycheck(state, { date: '2026-11-07', cents: 200000 }); // $400 to Goals: funded
  assert.equal(homePlan(state, '2026-11-07').goals[0].lineExplain, ''); // "You can buy it!"
});

test('spendingExplain adds up the Spend parts and the purchases', () => {
  let state = setTrackSpending(twoGoals(), true);
  state = addPurchase(state, { date: '2026-11-07', cents: 500, note: 'Snack' });
  assert.equal(spendingExplain(state), "Your paychecks put $100.00 into Spend and you've logged $5.00 of purchases, so $95.00 is left.");
});
