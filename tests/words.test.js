import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paycheckSentence, splitTotalHint, overspendMessage, purchaseSentence, shortDate } from '../src/words.js';

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
