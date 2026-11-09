// "Backup restored: ..." says only what exists, in plain words (lazy-v3 small fixes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoredMessage } from '../src/words.js';

const counts = (paychecks = 0, purchases = 0, goals = 0, goalPurchases = 0) => ({ paychecks, purchases, goals, goalPurchases });

test('only the kinds that exist, joined in plain words', () => {
  assert.equal(restoredMessage(counts(3, 0, 3)), 'Backup restored: 3 paychecks and 3 goals.');
  assert.equal(restoredMessage(counts(1, 0, 1)), 'Backup restored: 1 paycheck and 1 goal.');
  assert.equal(restoredMessage(counts(1, 1, 1)), 'Backup restored: 1 paycheck, 1 purchase and 1 goal.');
  assert.equal(restoredMessage(counts(4)), 'Backup restored: 4 paychecks.');
});

test('goal buys are "bought goals", and only when there are some', () => {
  assert.equal(restoredMessage(counts(2, 0, 1, 1)), 'Backup restored: 2 paychecks, 1 goal and 1 bought goal.');
  assert.equal(restoredMessage(counts(2, 3, 0, 2)), 'Backup restored: 2 paychecks, 3 purchases and 2 bought goals.');
  assert.doesNotMatch(restoredMessage(counts(2, 0, 1, 0)), /goal buy|bought/);
});

test('an empty backup says so plainly', () => {
  assert.equal(restoredMessage(counts()), 'Backup restored. It was empty.');
});
