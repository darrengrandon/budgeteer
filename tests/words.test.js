import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paycheckSentence, splitTotalHint } from '../src/words.js';

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
