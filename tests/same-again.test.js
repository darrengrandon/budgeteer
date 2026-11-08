// One-tap "Same as last time" on Home (lazy-v2 step 3b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameAgainCents } from '../src/plan.js';
import { newState, addPaycheck } from '../src/storage.js';

/** @param {[string, number][]} list */
function withPaychecks(list) {
  let state = newState();
  for (const [date, cents] of list) state = addPaycheck(state, { date, cents });
  return state;
}

test('offers the last paycheck added', () => {
  assert.equal(sameAgainCents(withPaychecks([['2026-11-01', 15000], ['2026-10-24', 9000]]), '2026-11-07'), 9000);
});

test('not offered before any paycheck', () => {
  assert.equal(sameAgainCents(newState(), '2026-11-07'), null);
});

test('not offered when that amount was logged today or yesterday (decision 13)', () => {
  assert.equal(sameAgainCents(withPaychecks([['2026-11-07', 15000]]), '2026-11-07'), null);
  assert.equal(sameAgainCents(withPaychecks([['2026-11-06', 15000]]), '2026-11-07'), null);
  assert.equal(sameAgainCents(withPaychecks([['2026-11-05', 15000]]), '2026-11-07'), 15000);
  // A different amount yesterday doesn't stop it.
  assert.equal(sameAgainCents(withPaychecks([['2026-11-06', 4000], ['2026-11-01', 15000]]), '2026-11-07'), 15000);
});
