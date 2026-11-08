import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  paycheckSentence, splitTotalHint, overspendMessage, purchaseSentence, shortDate, goalStatus, goalProgress, unassignedNote, whatIfLine, whatIfWeekly, spendAvailable,
  spendHeadline, moneyShort, goalAmounts, shortDateFrom, readyLine, goalTimeline, buySentence, payBasis,
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

test('goalStatus says how many weeks are left in plain words', () => {
  const base = { savedCents: 2500, targetCents: 10000, averageWeeklyCents: 5000, goalsPercent: 20 };
  assert.equal(goalStatus({ ...base, weeks: 5 }), 'About 5 weeks to go.');
  assert.equal(goalStatus({ ...base, weeks: 1 }), 'About 1 week to go.');
});

test('goalStatus with no recent pay asks for a paycheck instead of showing Infinity', () => {
  const status = goalStatus({ savedCents: 0, targetCents: 10000, weeks: Infinity, averageWeeklyCents: 0, goalsPercent: 20 });
  assert.equal(status, 'Log a paycheck to see a date.');
});

test('goalStatus when the split sends nothing to Goals', () => {
  const status = goalStatus({ savedCents: 0, targetCents: 10000, weeks: Infinity, averageWeeklyCents: 5000, goalsPercent: 0 });
  assert.equal(status, "Your split puts 0% into Goals, so this won't fill up. Change your split to get here.");
});

test('goalStatus when recent pay is too small to give a date', () => {
  const status = goalStatus({ savedCents: 0, targetCents: 10000, weeks: Infinity, averageWeeklyCents: 1, goalsPercent: 20 });
  assert.equal(status, 'Your recent pay is too small to give a date yet.');
});

test('goalStatus says when a goal is finished', () => {
  const status = goalStatus({ savedCents: 10000, targetCents: 10000, weeks: 0, averageWeeklyCents: 0, goalsPercent: 20 });
  assert.equal(status, 'Done! You saved enough for this.');
});

test('goalProgress shows saved out of target', () => {
  assert.equal(goalProgress(2500, 10000), '$25.00 of $100.00 saved');
});

test('unassignedNote points out Goals money that no goal is using', () => {
  assert.equal(unassignedNote(0, true), '');
  assert.equal(unassignedNote(1500, true), 'You have $15.00 in Goals that no goal needs right now. Add a goal to put it to work.');
  assert.equal(unassignedNote(1500, false), 'You have $15.00 in Goals. Add a goal to start filling it.');
});

test('goalStatus adds years when the wait is long, so big numbers make sense', () => {
  const base = { savedCents: 0, targetCents: 10000, averageWeeklyCents: 5000, goalsPercent: 20 };
  assert.equal(goalStatus({ ...base, weeks: 51 }), 'About 51 weeks to go.');
  assert.equal(goalStatus({ ...base, weeks: 52 }), "About 52 weeks to go. That's about a year.");
  assert.equal(goalStatus({ ...base, weeks: 80 }), "About 80 weeks to go. That's over a year.");
  assert.equal(goalStatus({ ...base, weeks: 223 }), "About 223 weeks to go. That's about 4 years.");
});

// What-if (ticket 006)

test('whatIfLine compares the trial weeks with now', () => {
  const base = { name: 'Phone', done: false, averageWeeklyCents: 10000, trialGoalsPercent: 30 };
  assert.equal(whatIfLine({ ...base, trialWeeks: 9, currentWeeks: 11 }), 'Phone: about 9 weeks (2 weeks sooner)');
  assert.equal(whatIfLine({ ...base, trialWeeks: 12, currentWeeks: 11 }), 'Phone: about 12 weeks (1 week later)');
  assert.equal(whatIfLine({ ...base, trialWeeks: 11, currentWeeks: 11 }), 'Phone: about 11 weeks (same as now)');
  assert.equal(whatIfLine({ ...base, trialWeeks: 1, currentWeeks: Infinity }), 'Phone: about 1 week');
});

test('whatIfLine for finished goals, no pay, and 0% to Goals', () => {
  const base = { name: 'Phone', trialWeeks: Infinity, currentWeeks: Infinity };
  assert.equal(whatIfLine({ ...base, done: true, averageWeeklyCents: 0, trialGoalsPercent: 20 }), 'Phone: done already');
  assert.equal(whatIfLine({ ...base, done: false, averageWeeklyCents: 0, trialGoalsPercent: 20 }), 'Phone: log a paycheck to see a date');
  assert.equal(whatIfLine({ ...base, done: false, averageWeeklyCents: 5000, trialGoalsPercent: 0 }), "Phone: never, with 0% to Goals");
});

// Fresh-eyes review C8 / U5: paychecks exist, but none in the last 4 weeks.

test('goalStatus when the only paychecks are older than 4 weeks', () => {
  const status = goalStatus({ savedCents: 10000, targetCents: 30000, weeks: Infinity, averageWeeklyCents: 0, goalsPercent: 20, hasPaychecks: true });
  assert.equal(status, "No paychecks in the last 4 weeks, so there's no estimate yet. Log your next one to see the weeks to go.");
});

test('whatIfLine when the only paychecks are older than 4 weeks', () => {
  const line = whatIfLine({ name: 'Phone', done: false, trialWeeks: Infinity, currentWeeks: Infinity, averageWeeklyCents: 0, trialGoalsPercent: 20, hasPaychecks: true });
  assert.equal(line, 'Phone: no paychecks in the last 4 weeks');
});

test('whatIfWeekly says what goes into Goals each week, or why it cannot', () => {
  assert.equal(whatIfWeekly({ averageWeeklyCents: 5000, weeklyCents: 1000, hasPaychecks: true }), "That's about $10.00 a week into Goals.");
  assert.equal(whatIfWeekly({ averageWeeklyCents: 0, weeklyCents: 0, hasPaychecks: false }), 'Log a paycheck to see dates.');
  assert.equal(whatIfWeekly({ averageWeeklyCents: 0, weeklyCents: 0, hasPaychecks: true }), 'No paychecks in the last 4 weeks, so there are no estimates yet.');
});

// Review U12: the line above the purchase form.

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
