// Saved data version 3: how often the teen gets paid (docs/adr/0007).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAY_FREQUENCIES,
  newState,
  emptyState,
  upgradeState,
  upgradeToV3,
  setPayFrequency,
  setTrackSpending,
  addPaycheck,
  addPurchase,
  addGoal,
  validateState,
  exportBackup,
  importBackup,
} from '../src/storage.js';
import { buyGoal } from '../src/goals.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });

function sampleV3() {
  return {
    version: 3,
    split: { spend: 50, save: 30, goals: 20 },
    settings: { trackSpending: false, payFrequency: 'weekly' },
    paychecks: [P('p1', '2026-11-06', 20000)],
    purchases: [],
    goals: [{ id: 'g1', name: 'Phone', targetCents: 30000 }],
    goalPurchases: [],
  };
}

test('the five pay frequencies are stored with these values, in this order', () => {
  assert.deepEqual(PAY_FREQUENCIES, ['weekly', 'biweekly', 'twice-monthly', 'monthly', 'varies']);
});

test('version 3 is accepted with each pay frequency', () => {
  for (const payFrequency of PAY_FREQUENCIES) {
    const data = { ...sampleV3(), settings: { trackSpending: true, payFrequency } };
    assert.deepEqual(validateState(data), { ok: true, state: data });
  }
});

test('version 3 rejects a missing, unknown or extra pay frequency setting', () => {
  const bad = [
    (/** @type {any} */ d) => { delete d.settings.payFrequency; },
    (/** @type {any} */ d) => { d.settings.payFrequency = 'daily'; },
    (/** @type {any} */ d) => { d.settings.payFrequency = 7; },
    (/** @type {any} */ d) => { d.settings.admin = true; },
    (/** @type {any} */ d) => { delete d.goalPurchases; },
  ];
  for (const change of bad) {
    const data = structuredClone(sampleV3());
    change(data);
    assert.equal(validateState(data).ok, false);
  }
});

test('a version 4 backup says it is from a different version', () => {
  const result = validateState({ ...sampleV3(), version: 4 });
  assert.deepEqual(result, { ok: false, error: 'The backup is from a different version of Budgeteer.' });
});

test('upgradeToV3 turns version 1 into version 3 with nothing lost and "It\'s different every time"', () => {
  let v1 = addPaycheck(emptyState(), { date: '2026-11-06', cents: 20000 });
  v1 = addPurchase(v1, { date: '2026-11-06', cents: 500, note: 'Snack' });
  v1 = addGoal(v1, { name: 'Phone', targetCents: 30000 });
  const v3 = upgradeToV3(v1);
  assert.equal(v3.version, 3);
  assert.deepEqual(v3.settings, { trackSpending: true, payFrequency: 'varies' });
  assert.deepEqual(v3.paychecks, v1.paychecks);
  assert.deepEqual(v3.purchases, v1.purchases);
  assert.deepEqual(v3.goals, v1.goals);
  assert.deepEqual(v3.goalPurchases, []);
});

test('upgradeToV3 keeps a version 2 tracking setting and goal buys', () => {
  const v2 = { ...upgradeState(emptyState()), settings: { trackSpending: true },
    goalPurchases: [{ id: 'x1', date: '2026-11-06', cents: 100, name: 'Hat' }] };
  const v3 = upgradeToV3(v2);
  assert.equal(v3.version, 3);
  assert.deepEqual(v3.settings, { trackSpending: true, payFrequency: 'varies' });
  assert.deepEqual(v3.goalPurchases, v2.goalPurchases);
});

test('upgradeToV3 passes version 3 through unchanged', () => {
  assert.deepEqual(upgradeToV3(sampleV3()), sampleV3());
});

test('setPayFrequency changes only the answer and does not change the old state', () => {
  const before = upgradeToV3(newState());
  const after = setPayFrequency(before, 'monthly');
  assert.deepEqual(after.settings, { trackSpending: false, payFrequency: 'monthly' });
  assert.equal(before.settings?.payFrequency, 'varies');
});

test('setPayFrequency rejects an unknown answer and version 2 data', () => {
  assert.throws(() => setPayFrequency(upgradeToV3(newState()), /** @type {any} */ ('daily')), RangeError);
  assert.throws(() => setPayFrequency(newState(), 'weekly'), RangeError);
});

test('a version 3 backup restores exactly', () => {
  const state = sampleV3();
  const result = importBackup(exportBackup(state));
  assert.deepEqual(result, { ok: true, state });
});

test('tracking and Buy it work on version 3 data', () => {
  let state = upgradeToV3(newState());
  state = setTrackSpending(state, true);
  assert.equal(state.settings?.trackSpending, true);
  state = addPaycheck(state, { date: '2026-11-06', cents: 200000 }); // $400 to Goals
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  const bought = buyGoal(state, state.goals[0].id, { cents: 30000, date: '2026-11-07' });
  assert.equal(bought.version, 3);
  assert.equal(bought.goalPurchases?.length, 1);
});
