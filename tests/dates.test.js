import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayNumber, isISODate, localISODate, weeksToGoal, averageWeeklyIncome, addDays } from '../src/budget.js';

test('localISODate writes the local calendar day as YYYY-MM-DD', () => {
  assert.equal(localISODate(new Date(2026, 10, 7, 23, 59)), '2026-11-07'); // late evening stays the same day
  assert.equal(localISODate(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
  assert.equal(localISODate(new Date(987, 11, 31)), '0987-12-31');
});

test('dayNumber counts whole UTC days from 1970-01-01', () => {
  assert.equal(dayNumber('1970-01-01'), 0);
  assert.equal(dayNumber('1970-01-02'), 1);
  assert.equal(dayNumber('2026-11-07') - dayNumber('2026-10-10'), 28);
});

test('dayNumber handles leap days and rejects impossible dates', () => {
  assert.equal(dayNumber('2028-03-01') - dayNumber('2028-02-28'), 2);
  assert.throws(() => dayNumber('2026-02-29'), RangeError);
  assert.throws(() => dayNumber('2026-13-01'), RangeError);
  assert.throws(() => dayNumber('2026-04-31'), RangeError);
});

test('dayNumber rejects anything that is not YYYY-MM-DD', () => {
  for (const bad of ['2026-1-07', '07/11/2026', '2026-11-07T00:00', '', 20261107, null, undefined]) {
    assert.throws(() => dayNumber(/** @type {any} */ (bad)), RangeError, String(bad));
  }
});

test('isISODate is a non-throwing check', () => {
  assert.equal(isISODate('2026-11-07'), true);
  assert.equal(isISODate('2026-02-30'), false);
  assert.equal(isISODate({}), false);
});

test('weeksToGoal rejects amounts that are not whole cents', () => {
  assert.throws(() => weeksToGoal({ targetCents: 100.5, savedCents: 0, weeklyCents: 10 }), RangeError);
  assert.throws(() => weeksToGoal({ targetCents: 100, savedCents: Number.NaN, weeklyCents: 10 }), RangeError);
  assert.throws(() => weeksToGoal({ targetCents: -1, savedCents: 0, weeklyCents: 10 }), RangeError);
});

test('averageWeeklyIncome rejects bad dates, bad cents and bad windows', () => {
  assert.throws(() => averageWeeklyIncome([], 'today'), RangeError);
  assert.throws(() => averageWeeklyIncome([{ date: '2026-11-31', cents: 1 }], '2026-11-07'), RangeError);
  assert.throws(() => averageWeeklyIncome([{ date: '2026-11-07', cents: 1.5 }], '2026-11-07'), RangeError);
  assert.throws(() => averageWeeklyIncome([], '2026-11-07', 0), RangeError);
});

test('averageWeeklyIncome honours a custom window', () => {
  // 7-day window: a paycheck 6 days ago counts in full, one 7 days ago does not
  const paychecks = [
    { date: '2026-11-01', cents: 7000 },
    { date: '2026-10-31', cents: 9999 },
  ];
  assert.equal(averageWeeklyIncome(paychecks, '2026-11-07', 7), 7000);
});

// Ticket 012: "around <date>"

test('addDays moves a date by whole days across months, years and leap days', () => {
  assert.equal(addDays('2026-11-07', 7), '2026-11-14');
  assert.equal(addDays('2026-12-28', 7), '2027-01-04');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-11-07', -7), '2026-10-31');
  assert.throws(() => addDays('2026-11-07', 1.5), RangeError);
});
