// Weekly pay learned from paycheck gaps (ticket 012, SPEC.md "The numbers", docs/adr/0004).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paydays, usualGapDays, weeklyPay, weeklySpendCents, gotPaidDue, missedPaydays } from '../src/pay.js';

const TODAY = '2026-11-07';
/** @param {string} date @param {number} cents */
const pay = (date, cents) => ({ date, cents });

test('paydays groups paychecks by date, oldest first, and ignores future dates', () => {
  const list = [pay('2026-11-07', 5000), pay('2026-10-31', 15000), pay('2026-11-07', 10000), pay('2026-11-09', 999)];
  assert.deepEqual(paydays(list, TODAY), [{ date: '2026-10-31', cents: 15000 }, { date: '2026-11-07', cents: 15000 }]);
  assert.deepEqual(paydays([], TODAY), []);
});

test('with one payday, the usual gap is 14 days (paid every 2 weeks)', () => {
  assert.equal(usualGapDays([pay('2026-11-07', 20000)], TODAY), 14);
  assert.deepEqual(weeklyPay([pay('2026-11-07', 20000)], TODAY), { cents: 20000, days: 14 }); // $100 a week
});

test('weekly pay for someone paid every week', () => {
  const list = ['2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07'].map((d) => pay(d, 20000));
  assert.equal(usualGapDays(list, TODAY), 7);
  assert.deepEqual(weeklyPay(list, TODAY), { cents: 80000, days: 28 }); // $200 a week
});

test('weekly pay for someone paid every 2 weeks', () => {
  const list = ['2026-10-10', '2026-10-24', '2026-11-07'].map((d) => pay(d, 20000));
  assert.equal(usualGapDays(list, TODAY), 14);
  assert.deepEqual(weeklyPay(list, TODAY), { cents: 60000, days: 42 }); // $100 a week
});

test('two paychecks on the same day count as one payday', () => {
  const list = [pay('2026-10-31', 15000), pay('2026-11-07', 10000), pay('2026-11-07', 5000)];
  assert.equal(usualGapDays(list, TODAY), 7);
  assert.deepEqual(weeklyPay(list, TODAY), { cents: 30000, days: 14 }); // $150 a week
});

test('one long gap (forgot to log) does not change the usual gap', () => {
  const dates = ['2026-08-01', '2026-08-08', '2026-08-15', '2026-09-14', '2026-09-21', '2026-09-28'];
  assert.equal(usualGapDays(dates.map((d) => pay(d, 100)), TODAY), 7); // gaps 7, 7, 30, 7, 7
});

test('the usual gap rounds a half day up', () => {
  const list = [pay('2026-10-23', 100), pay('2026-10-30', 100), pay('2026-11-07', 100)]; // gaps 7 and 8
  assert.equal(usualGapDays(list, TODAY), 8);
});

test('only the last 6 paydays count', () => {
  const old = [pay('2026-09-12', 900000), pay('2026-09-19', 900000)];
  const recent = ['2026-09-26', '2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31'].map((d) => pay(d, 10000));
  assert.deepEqual(weeklyPay([...old, ...recent], TODAY), { cents: 60000, days: 42 });
});

test('no paychecks, or only future ones, means no weekly pay yet', () => {
  assert.equal(weeklyPay([], TODAY), null);
  assert.equal(weeklyPay([pay('2026-11-20', 5000)], TODAY), null);
});

test('weekly pay does not shrink when the teen forgets to log', () => {
  const list = [pay('2026-08-01', 20000), pay('2026-08-15', 20000)];
  assert.deepEqual(weeklyPay(list, TODAY), { cents: 40000, days: 28 });
});

test('weeklySpendCents is weekly pay times the Spend percent, in whole cents', () => {
  assert.equal(weeklySpendCents({ cents: 20000, days: 14 }, 50), 5000);
  assert.equal(weeklySpendCents({ cents: 4250, days: 14 }, 50), 1063); // 1062.5 rounds up
  assert.equal(weeklySpendCents({ cents: 20000, days: 14 }, 0), 0);
  assert.equal(weeklySpendCents(null, 50), null);
});

test('"Got paid? Log it." shows once the last payday is more than the usual gap plus 2 days ago', () => {
  const one = [pay('2026-10-22', 100)]; // gap 14, so due after 16 days
  assert.equal(gotPaidDue(one, '2026-11-07'), false); // 16 days
  assert.equal(gotPaidDue(one, '2026-11-08'), true); // 17 days
  const weekly = [pay('2026-10-25', 100), pay('2026-11-01', 100)]; // gap 7, so due after 9 days
  assert.equal(gotPaidDue(weekly, '2026-11-10'), false); // 9 days
  assert.equal(gotPaidDue(weekly, '2026-11-11'), true); // 10 days
  assert.equal(gotPaidDue([], TODAY), false);
});

// Second review (REVIEW.md L1, L2)

test('L1: paychecks less than 4 days apart count as one payday, so a duplicate cannot fake a 1-day gap', () => {
  const list = [pay('2026-11-07', 31247), pay('2026-11-08', 31247)];
  assert.deepEqual(paydays(list, '2026-11-08'), [{ date: '2026-11-07', cents: 62494 }]);
  assert.equal(usualGapDays(list, '2026-11-08'), 14);
});

test('L1: two jobs paying on different days of the week still give the right weekly pay', () => {
  // Job A pays $100 on Mondays, job B $50 on Thursdays.
  const dates = ['2026-10-19', '2026-10-22', '2026-10-26', '2026-10-29', '2026-11-02', '2026-11-05'];
  const list = dates.map((d, i) => pay(d, i % 2 === 0 ? 10000 : 5000));
  assert.equal(usualGapDays(list, TODAY), 7);
  assert.deepEqual(weeklyPay(list, TODAY), { cents: 45000, days: 21 }); // $150 a week
});

test('L2: missedPaydays lists the paydays the teen clearly skipped', () => {
  const one = [pay('2026-11-07', 100)]; // every 2 weeks
  assert.deepEqual(missedPaydays(one, '2026-11-23'), []); // just late
  assert.deepEqual(missedPaydays(one, '2026-12-05'), ['2026-11-21']);
  assert.deepEqual(missedPaydays(one, '2026-12-19'), ['2026-11-21', '2026-12-05']);
  const weekly = [pay('2026-10-25', 100), pay('2026-11-01', 100)];
  assert.deepEqual(missedPaydays(weekly, '2026-11-15'), ['2026-11-08']);
  assert.deepEqual(missedPaydays([], TODAY), []);
});

test('L2: logging the missed payday keeps weekly pay where it was', () => {
  const list = [pay('2026-11-07', 31247), pay('2026-11-21', 31247), pay('2026-12-05', 31247)];
  assert.deepEqual(weeklyPay(list, '2026-12-05'), { cents: 93741, days: 42 }); // $156.24 a week, as before
});
