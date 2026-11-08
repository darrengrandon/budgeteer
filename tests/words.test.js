import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  paycheckSentence, splitTotalHint, overspendMessage, purchaseSentence, shortDate, spendAvailable,
  spendHeadline, moneyShort, goalAmounts, shortDateFrom, readyLine, goalTimeline, buySentence, payBasis, leftToSpend,
  lastPaycheckNote, bigAmountWarning, missedChip,
} from '../src/words.js';

test('paycheckSentence says the split in plain words, exactly as in SPEC.md', () => {
  assert.equal(
    paycheckSentence(4250, { spend: 2125, save: 1275, goals: 850 }),
    'Your $42.50 became $21.25 to spend, $12.75 saved, $8.50 for goals.',
  );
});

test('paycheckSentence handles big and tiny amounts', () => {
  assert.equal(
    paycheckSentence(123450, { spend: 61725, save: 37035, goals: 24690 }),
    'Your $1,234.50 became $617.25 to spend, $370.35 saved, $246.90 for goals.',
  );
  assert.equal(
    paycheckSentence(1, { spend: 1, save: 0, goals: 0 }),
    'Your $0.01 became $0.01 to spend, $0.00 saved, $0.00 for goals.',
  );
});

test('splitTotalHint says what to fix when the split does not total 100', () => {
  assert.equal(splitTotalHint({ spend: 50, save: 30, goals: 20 }), 'Adds up to 100%. Good to go.');
  assert.equal(splitTotalHint({ spend: 60, save: 30, goals: 20 }), 'Adds up to 110%. Take away 10.');
  assert.equal(splitTotalHint({ spend: 40, save: 30, goals: 20 }), 'Adds up to 90%. Add 10 more.');
});

test('splitTotalHint asks for whole numbers when a box is empty or not a whole number', () => {
  const hint = 'Use whole numbers from 0 to 100 in each box.';
  assert.equal(splitTotalHint({ spend: Number.NaN, save: 30, goals: 20 }), hint);
  assert.equal(splitTotalHint({ spend: 50.5, save: 29.5, goals: 20 }), hint);
  assert.equal(splitTotalHint({ spend: -10, save: 90, goals: 20 }), hint);
});

// Purchases (ticket 004)

test('overspendMessage says how much is available', () => {
  assert.equal(overspendMessage(1240), "That's more than you have. You have $12.40 left to spend.");
  assert.equal(overspendMessage(0), 'Your Spend bucket is empty right now. Log a paycheck to fill it up.');
});

test('purchaseSentence says what came out and what is left', () => {
  assert.equal(purchaseSentence(500, 1625), 'Logged. $5.00 came out of Spend. You have $16.25 left to spend.');
  assert.equal(purchaseSentence(500, 0), 'Logged. $5.00 came out of Spend. Your Spend bucket is now empty.');
});

test('shortDate shows a date like "Nov 7, 2026" without time-zone surprises', () => {
  assert.equal(shortDate('2026-11-07'), 'Nov 7, 2026');
  assert.equal(shortDate('2026-01-01'), 'Jan 1, 2026');
  assert.equal(shortDate('2025-12-31'), 'Dec 31, 2025');
});

// Goals (ticket 005)

test('spendAvailable says what is left, and does not say "first" once paychecks exist', () => {
  assert.equal(spendAvailable(1250, true), 'You have $12.50 to spend.');
  assert.equal(spendAvailable(0, false), 'Your Spend bucket is empty. Log a paycheck first.');
  assert.equal(spendAvailable(0, true), 'Your Spend bucket is empty. Log your next paycheck to add more.');
});

// Ticket 014: wording for the phone screens (SPEC.md "Screens" and "The numbers")

test('spendHeadline says what to spend a week, in whole dollars, or asks for the first paycheck', () => {
  assert.equal(spendHeadline(null), 'Log your first paycheck');
  assert.equal(spendHeadline(5000), 'Spend about $50 a week');
  assert.equal(spendHeadline(4751), 'Spend about $48 a week');
  assert.equal(spendHeadline(123449), 'Spend about $1,234 a week');
  assert.equal(spendHeadline(425), 'Spend about $4.25 a week'); // small amounts keep their cents
  assert.equal(spendHeadline(0), 'Spend about $0 a week');
});

test('moneyShort drops ".00" but never rounds', () => {
  assert.equal(moneyShort(30000), '$300');
  assert.equal(moneyShort(850), '$8.50');
  assert.equal(moneyShort(29960), '$299.60');
  assert.equal(moneyShort(123400), '$1,234');
});

test('goalAmounts shows saved out of price', () => {
  assert.equal(goalAmounts(4000, 30000), '$40 of $300');
  assert.equal(goalAmounts(29960, 30000), '$299.60 of $300');
});

test('shortDateFrom adds the year only when it is not this year', () => {
  assert.equal(shortDateFrom('2027-01-09', '2026-11-07'), 'Jan 9, 2027');
  assert.equal(shortDateFrom('2026-12-25', '2026-11-07'), 'Dec 25');
});

test('readyLine: weeks and a date, or that it can be bought', () => {
  const base = { savedCents: 4000, targetCents: 30000, hasPay: true, goalsPercent: 20, todayISO: '2026-11-07' };
  assert.equal(readyLine({ ...base, weeks: 9 }), 'Ready in about 9 weeks (around Jan 9, 2027)');
  assert.equal(readyLine({ ...base, weeks: 3 }), 'Ready in about 3 weeks (around Nov 28)');
  assert.equal(readyLine({ ...base, weeks: 1 }), 'Ready in about 1 week (around Nov 14)');
  assert.equal(readyLine({ ...base, savedCents: 30000, weeks: 0 }), 'You can buy it!');
});

test('readyLine with no paychecks, or nothing going to Goals', () => {
  const base = { savedCents: 0, targetCents: 30000, weeks: Infinity, todayISO: '2026-11-07' };
  assert.equal(readyLine({ ...base, hasPay: false, goalsPercent: 20 }), 'Log a paycheck to see when.');
  assert.equal(readyLine({ ...base, hasPay: true, goalsPercent: 0 }), 'Your split puts nothing into Goals. Change it in Settings.');
});

test('goalTimeline is the line under "where your money went"', () => {
  const base = { savedCents: 4000, targetCents: 30000, hasPay: true, goalsPercent: 20, todayISO: '2026-11-07' };
  assert.equal(goalTimeline({ ...base, name: 'Phone', weeks: 9 }), 'Phone: ready in about 9 weeks (around Jan 9, 2027)');
  assert.equal(goalTimeline({ ...base, name: 'Tickets', savedCents: 30000, weeks: 0 }), 'Tickets: you can buy it!');
});

test('buySentence says what came out of Goals', () => {
  assert.equal(buySentence(8500, 'Concert tickets'), 'Nice! $85.00 came out of Goals for Concert tickets.');
});

test('payBasis says what the headline is based on', () => {
  assert.equal(payBasis(10000), 'Out of about $100 a week of pay.');
  assert.equal(payBasis(850), 'Out of about $8.50 a week of pay.');
});

test('buySentence explains when it cost more than the goal', () => {
  assert.equal(buySentence(3000, 'Tickets', 4500), "Nice! $30.00 came out of Goals for Tickets. The extra $15.00 didn't come from Goals.");
  assert.equal(buySentence(2500, 'Tickets', 2500), 'Nice! $25.00 came out of Goals for Tickets.');
});

// Ticket 018: the Spending card

test('leftToSpend is the big number on the Spending card', () => {
  assert.equal(leftToSpend(6000), '$60.00 left to spend');
  assert.equal(leftToSpend(0), '$0.00 left to spend');
});

// Second review (REVIEW.md L1, L2, L5, L10, L14)

test('L10: readyLine counts from the last payday, so the date stays put between paydays', () => {
  const base = { savedCents: 6249, targetCents: 25000, hasPay: true, goalsPercent: 20, weeks: 7, fromISO: '2026-11-07' };
  assert.equal(readyLine({ ...base, todayISO: '2026-11-07' }), 'Ready in about 7 weeks (around Dec 26)');
  assert.equal(readyLine({ ...base, todayISO: '2026-11-20' }), 'Ready in about 6 weeks (around Dec 26)');
  assert.equal(readyLine({ ...base, todayISO: '2026-11-23' }), 'Ready in about 5 weeks (around Dec 26)');
});

test('L10: when the date has passed without enough money, it asks for the paycheck', () => {
  const line = readyLine({ savedCents: 6249, targetCents: 9000, hasPay: true, goalsPercent: 20, weeks: 1, fromISO: '2026-11-07', todayISO: '2026-12-05' });
  assert.equal(line, 'Should be ready by now. Log your paycheck to check.');
});

test('L14: long waits are said in years', () => {
  const base = { savedCents: 0, targetCents: 500000, hasPay: true, goalsPercent: 20, todayISO: '2026-11-07' };
  assert.equal(readyLine({ ...base, weeks: 52 }), 'Ready in about 52 weeks (around Nov 6, 2027)');
  assert.equal(readyLine({ ...base, weeks: 60 }), 'Ready in about a year (around Jan 1, 2028)');
  assert.equal(readyLine({ ...base, weeks: 159 }), 'Ready in about 3 years (around Nov 24, 2029)');
  assert.match(readyLine({ ...base, weeks: 32322 }), /^Ready in about 622 years \(around /);
});

test('L1: lastPaycheckNote reminds the teen of a paycheck logged in the last 3 days', () => {
  assert.equal(lastPaycheckNote('2026-11-07', 31247, '2026-11-07'), 'You already logged $312.47 today.');
  assert.equal(lastPaycheckNote('2026-11-07', 31247, '2026-11-08'), 'You already logged $312.47 yesterday.');
  assert.equal(lastPaycheckNote('2026-11-05', 31247, '2026-11-08'), 'You already logged $312.47 on Nov 5.');
  assert.equal(lastPaycheckNote('2026-11-04', 31247, '2026-11-08'), '');
});

test('L5: bigAmountWarning asks about an amount 4 times the last paycheck or more', () => {
  assert.equal(bigAmountWarning(3124700, 31247), "That's a lot more than last time ($312.47). Is $31,247.00 right?");
  assert.equal(bigAmountWarning(124988, 31247), "That's a lot more than last time ($312.47). Is $1,249.88 right?");
  assert.equal(bigAmountWarning(124987, 31247), '');
  assert.equal(bigAmountWarning(3124700, null), '');
});

test('L2: missedChip offers to add the skipped paydays', () => {
  assert.equal(missedChip(['2026-11-21'], '2026-12-05'), 'Also add the paycheck I missed (around Nov 21)');
  assert.equal(missedChip(['2026-11-21', '2026-12-05'], '2026-12-19'), 'Also add the 2 paychecks I missed (around Nov 21 and Dec 5)');
});
