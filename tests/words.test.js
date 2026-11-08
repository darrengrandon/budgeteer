import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  paycheckSentence, splitTotalHint, overspendMessage, purchaseSentence, shortDate, goalStatus, goalProgress, unassignedNote, whatIfLine,
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
