// History's Undo: a removed paycheck or purchase goes back exactly where it was (lazy-v3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, addPaycheck, addPurchase, removePaycheck, removePurchase, putBack, setTrackSpending } from '../src/storage.js';

function sample() {
  let state = setTrackSpending(newState(), true);
  state = addPaycheck(state, { date: '2026-10-31', cents: 15600 });
  state = addPaycheck(state, { date: '2026-11-07', cents: 15600 });
  state = addPurchase(state, { date: '2026-11-07', cents: 500, note: 'Snack' });
  return addPurchase(state, { date: '2026-11-07', cents: 900, note: 'Movie' });
}

test('a removed paycheck goes back in the same place, so the state is exactly as before', () => {
  const before = sample();
  const record = before.paychecks[0];
  const after = putBack(removePaycheck(before, record.id), 'paycheck', record, 0);
  assert.deepEqual(after, before);
});

test('a removed purchase goes back in the same place', () => {
  const before = sample();
  const record = before.purchases[1];
  assert.deepEqual(putBack(removePurchase(before, record.id), 'purchase', record, 1), before);
});

test('putting back something that is already there is refused, and nothing changes', () => {
  const state = sample();
  const snapshot = structuredClone(state);
  assert.throws(() => putBack(state, 'paycheck', state.paychecks[0], 0), RangeError);
  assert.deepEqual(state, snapshot);
});
