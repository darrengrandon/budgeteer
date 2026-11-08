// One spend number on the paycheck result (lazy-v2 step 3c, overnight report P7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paycheckSentence } from '../src/words.js';

test('the result names the weekly spend number in brackets, the same one as on Home', () => {
  assert.equal(paycheckSentence(31247, { spend: 15624, save: 9374, goals: 6249 }, 7812),
    'Your $312.47 became $156.24 to spend (about $78 a week), $93.74 saved, $62.49 for goals.');
});

test('under $10 a week the cents stay, like the headline', () => {
  assert.equal(paycheckSentence(1500, { spend: 750, save: 450, goals: 300 }, 375),
    'Your $15.00 became $7.50 to spend (about $3.75 a week), $4.50 saved, $3.00 for goals.');
});

test('no brackets when nothing goes to Spend', () => {
  assert.equal(paycheckSentence(10000, { spend: 0, save: 5000, goals: 5000 }, 0),
    'Your $100.00 became $0.00 to spend, $50.00 saved, $50.00 for goals.');
});
