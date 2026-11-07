import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitIncome, weeksToGoal, averageWeeklyIncome } from '../src/budget.js';

const SPLIT = { spend: 50, save: 30, goals: 20 };
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

// splitIncome

test('splitIncome divides a paycheck by percent', () => {
  assert.deepEqual(splitIncome(10000, SPLIT), { spend: 5000, save: 3000, goals: 2000 });
});

test('splitIncome gives the spare cent to the largest remainder', () => {
  // 10001 cents: raw 5000.5 / 3000.3 / 2000.2, floors total 10000, spare cent goes to spend
  assert.deepEqual(splitIncome(10001, SPLIT), { spend: 5001, save: 3000, goals: 2000 });
});

test('splitIncome never loses or invents a cent', () => {
  for (const cents of [0, 1, 7, 99, 1234, 4250, 99999]) {
    assert.equal(sum(splitIncome(cents, { spend: 33, save: 33, goals: 34 })), cents);
  }
});

test('splitIncome breaks ties in favor of the bucket listed first', () => {
  assert.deepEqual(splitIncome(1, { spend: 50, save: 50, goals: 0 }), { spend: 1, save: 0, goals: 0 });
});

test('splitIncome of zero is all zeros', () => {
  assert.deepEqual(splitIncome(0, SPLIT), { spend: 0, save: 0, goals: 0 });
});

test('splitIncome rejects percents that do not total 100', () => {
  assert.throws(() => splitIncome(1000, { spend: 50, save: 30, goals: 30 }), { name: 'RangeError', message: /100/ });
});

test('splitIncome rejects amounts that are not whole non-negative cents', () => {
  assert.throws(() => splitIncome(10.5, SPLIT), RangeError);
  assert.throws(() => splitIncome(-1, SPLIT), RangeError);
  assert.throws(() => splitIncome(Number.NaN, SPLIT), RangeError);
});

// weeksToGoal

test('weeksToGoal is 0 when the goal is already reached', () => {
  assert.equal(weeksToGoal({ targetCents: 10000, savedCents: 10000, weeklyCents: 0 }), 0);
  assert.equal(weeksToGoal({ targetCents: 10000, savedCents: 12000, weeklyCents: 500 }), 0);
});

test('weeksToGoal divides what is left by the weekly amount', () => {
  assert.equal(weeksToGoal({ targetCents: 10000, savedCents: 2500, weeklyCents: 1500 }), 5);
});

test('weeksToGoal rounds partial weeks up', () => {
  assert.equal(weeksToGoal({ targetCents: 10000, savedCents: 2499, weeklyCents: 1500 }), 6);
});

test('weeksToGoal is Infinity when nothing is coming in', () => {
  assert.equal(weeksToGoal({ targetCents: 10000, savedCents: 0, weeklyCents: 0 }), Infinity);
  assert.equal(weeksToGoal({ targetCents: 10000, savedCents: 0, weeklyCents: -5 }), Infinity);
});

// averageWeeklyIncome

test('averageWeeklyIncome averages the last 28 days over 4 weeks', () => {
  const paychecks = [
    { date: '2026-11-06', cents: 20000 },
    { date: '2026-10-23', cents: 20000 },
    { date: '2026-09-01', cents: 99999 }, // too old, ignored
  ];
  assert.equal(averageWeeklyIncome(paychecks, '2026-11-07'), 10000);
});

test('averageWeeklyIncome window edge: exactly 28 days ago is out, 27 is in', () => {
  const paychecks = [
    { date: '2026-10-10', cents: 100 },
    { date: '2026-10-11', cents: 400 },
  ];
  assert.equal(averageWeeklyIncome(paychecks, '2026-11-07'), 100);
});

test('averageWeeklyIncome ignores paychecks dated in the future', () => {
  assert.equal(averageWeeklyIncome([{ date: '2026-11-08', cents: 5000 }], '2026-11-07'), 0);
});

test('averageWeeklyIncome is 0 with no paychecks and rounds to whole cents', () => {
  assert.equal(averageWeeklyIncome([], '2026-11-07'), 0);
  assert.equal(averageWeeklyIncome([{ date: '2026-11-07', cents: 9 }], '2026-11-07'), 2);
});
