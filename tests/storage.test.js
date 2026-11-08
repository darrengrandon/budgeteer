import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  DEFAULT_SPLIT,
  emptyState,
  balances,
  addPaycheck,
  addPurchase,
  setSplit,
  validateState,
  loadState,
  saveState,
  exportBackup,
  importBackup,
  removePaycheck,
  removePurchase,
  OverspendError,
  recentActivity,
  addGoal,
  updateGoal,
  removeGoal,
  moveGoal,
  LIMITS,
  backupFileName,
  DAMAGED_KEY,
  readSaved,
  saveChecked,
  newState,
  upgradeState,
  setTrackSpending,
  removeGoalPurchase,
  GoalMoneyUsedError,
  nextId,
} from '../src/storage.js';

/** A fake localStorage that keeps items in a Map. */
function fakeStorage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
  };
}

/** A storage where every call throws, like a browser with storage turned off. */
const brokenStorage = {
  getItem() { throw new Error('SecurityError: storage is disabled'); },
  setItem() { throw new Error('QuotaExceededError'); },
  removeItem() { throw new Error('SecurityError: storage is disabled'); },
};

const sum = (o) => o.spend + o.save + o.goals;

/** A small, valid state with one of everything. */
function sampleState() {
  let state = emptyState();
  state = addPaycheck(state, { date: '2026-11-01', cents: 4250 });
  state = addPaycheck(state, { date: '2026-11-06', cents: 10001 });
  state = addPurchase(state, { date: '2026-11-06', cents: 1500, note: 'Movie' });
  return { ...state, goals: [{ id: 'g1', name: 'Phone', targetCents: 50000 }] };
}

// Starting state

test('emptyState uses the 50/30/20 split and has no records', () => {
  assert.deepEqual(DEFAULT_SPLIT, { spend: 50, save: 30, goals: 20 });
  assert.deepEqual(emptyState(), { version: 1, split: { spend: 50, save: 30, goals: 20 }, paychecks: [], purchases: [], goals: [] });
  assert.deepEqual(balances(emptyState()), { spend: 0, save: 0, goals: 0 });
});

test('emptyState takes a chosen split and rejects one that does not total 100', () => {
  assert.deepEqual(emptyState({ spend: 60, save: 20, goals: 20 }).split, { spend: 60, save: 20, goals: 20 });
  assert.throws(() => emptyState({ spend: 60, save: 30, goals: 20 }), RangeError);
});

// Balances

test('balances add up paychecks by their split and take purchases out of Spend', () => {
  const state = sampleState();
  // 4250 -> 2125 / 1275 / 850; 10001 -> 5001 / 3000 / 2000; minus 1500 from spend
  assert.deepEqual(balances(state), { spend: 5626, save: 4275, goals: 2850 });
  assert.equal(sum(balances(state)) + 1500, 4250 + 10001);
});

test('each paycheck stores the split it was logged with', () => {
  const state = addPaycheck(emptyState(), { date: '2026-11-07', cents: 4250 });
  assert.equal(state.paychecks.length, 1);
  const [p] = state.paychecks;
  assert.equal(typeof p.id, 'string');
  assert.deepEqual({ date: p.date, cents: p.cents, spend: p.spend, save: p.save, goals: p.goals },
    { date: '2026-11-07', cents: 4250, spend: 50, save: 30, goals: 20 });
});

test('changing the split does not rewrite old paychecks', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-01', cents: 10000 });
  state = setSplit(state, { spend: 40, save: 30, goals: 30 });
  state = addPaycheck(state, { date: '2026-11-07', cents: 10000 });
  assert.deepEqual(state.split, { spend: 40, save: 30, goals: 30 });
  assert.deepEqual([state.paychecks[0].spend, state.paychecks[0].save, state.paychecks[0].goals], [50, 30, 20]);
  assert.deepEqual([state.paychecks[1].spend, state.paychecks[1].save, state.paychecks[1].goals], [40, 30, 30]);
  assert.deepEqual(balances(state), { spend: 9000, save: 6000, goals: 5000 });
});

test('state changes return a new state and never mutate the old one', () => {
  const before = emptyState();
  const snapshot = structuredClone(before);
  addPaycheck(before, { date: '2026-11-07', cents: 100 });
  setSplit(before, { spend: 10, save: 10, goals: 80 });
  assert.deepEqual(before, snapshot);
});

test('records get unique ids', () => {
  let state = emptyState();
  for (let i = 0; i < 5; i++) state = addPaycheck(state, { date: '2026-11-07', cents: 100 });
  state = addPurchase(state, { date: '2026-11-07', cents: 10, note: '' });
  state = addPurchase(state, { date: '2026-11-07', cents: 10, note: '' });
  const ids = [...state.paychecks, ...state.purchases].map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('addPaycheck and addPurchase reject bad amounts and dates', () => {
  const state = emptyState();
  for (const cents of [0, -100, 10.5, Number.NaN, '100']) {
    assert.throws(() => addPaycheck(state, { date: '2026-11-07', cents }), RangeError, `paycheck ${cents}`);
  }
  assert.throws(() => addPaycheck(state, { date: '2026-02-30', cents: 100 }), RangeError);
  assert.throws(() => addPurchase(state, { date: '2026-11-07', cents: 0, note: '' }), RangeError);
});

test('setSplit rejects a split that is not three whole percents totaling 100', () => {
  const state = emptyState();
  assert.throws(() => setSplit(state, { spend: 50, save: 30, goals: 30 }), RangeError);
  assert.throws(() => setSplit(state, { spend: 50.5, save: 29.5, goals: 20 }), RangeError);
  assert.throws(() => setSplit(state, { spend: 100, save: 0 }), RangeError);
  assert.throws(() => setSplit(state, { spend: 120, save: -20, goals: 0 }), RangeError);
});

// Saving and loading

test('saveState then loadState gives back the same state', () => {
  const storage = fakeStorage();
  const state = sampleState();
  assert.equal(saveState(storage, state), true);
  assert.ok(storage.items.has(STORAGE_KEY));
  assert.deepEqual(loadState(storage), { state, warning: null });
});

test('loadState with nothing saved is a first run, not an error', () => {
  assert.deepEqual(loadState(fakeStorage()), { state: null, warning: null });
});

test('loadState and saveState keep working when storage throws', () => {
  const loaded = loadState(brokenStorage);
  assert.equal(loaded.state, null);
  assert.match(loaded.warning, /save/i);
  assert.equal(saveState(brokenStorage, emptyState()), false);
});

test('loadState and saveState cope with no storage at all', () => {
  const loaded = loadState(null);
  assert.equal(loaded.state, null);
  assert.equal(typeof loaded.warning, 'string');
  assert.equal(saveState(null, emptyState()), false);
});

test('loadState keeps damaged saved data aside instead of throwing it away', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: '{"version":1, oops' });
  const loaded = loadState(storage);
  assert.equal(loaded.state, null);
  assert.equal(typeof loaded.warning, 'string');
  assert.equal(storage.items.get(`${STORAGE_KEY}.damaged`), '{"version":1, oops');
});

test('loadState rejects saved data with a bad shape', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, split: { spend: 99, save: 0, goals: 0 } }) });
  const loaded = loadState(storage);
  assert.equal(loaded.state, null);
  assert.equal(typeof loaded.warning, 'string');
});

// Backup export and import

test('exportBackup then importBackup gives identical state and balances', () => {
  const state = sampleState();
  const result = importBackup(exportBackup(state));
  assert.equal(result.ok, true);
  assert.deepEqual(result.state, state);
  assert.deepEqual(balances(result.state), balances(state));
});

test('validateState accepts a valid state', () => {
  assert.deepEqual(validateState(sampleState()), { ok: true, state: sampleState() });
});

test('importBackup rejects text that is not a JSON object', () => {
  for (const text of ['', 'not json', '[]', 'null', '42', '"hello"', '{"version":1']) {
    const result = importBackup(text);
    assert.equal(result.ok, false, text);
    assert.equal(typeof result.error, 'string');
  }
});

test('importBackup rejects a huge file before parsing it', () => {
  const result = importBackup(' '.repeat(6_000_000));
  assert.equal(result.ok, false);
  assert.match(result.error, /big/i);
});

/**
 * Take a valid backup, break one thing, and check it is rejected.
 * @param {string} label
 * @param {(data: any) => void} breakIt
 */
function assertRejected(label, breakIt) {
  const data = JSON.parse(exportBackup(sampleState()));
  breakIt(data);
  const result = importBackup(JSON.stringify(data));
  assert.equal(result.ok, false, `should reject: ${label}`);
  assert.equal(typeof result.error, 'string', label);
  assert.ok(result.error.length > 0, label);
}

test('importBackup rejects bad top-level shapes', () => {
  assertRejected('wrong version', (d) => { d.version = 2; });
  assertRejected('version as text', (d) => { d.version = '1'; });
  assertRejected('missing paychecks', (d) => { delete d.paychecks; });
  assertRejected('unexpected extra key', (d) => { d.admin = true; });
  assertRejected('paychecks not a list', (d) => { d.paychecks = { a: 1 }; });
  assertRejected('goals is null', (d) => { d.goals = null; });
});

test('importBackup rejects a bad split', () => {
  assertRejected('split does not total 100', (d) => { d.split.goals = 30; });
  assertRejected('split has a fraction', (d) => { d.split = { spend: 50.5, save: 29.5, goals: 20 }; });
  assertRejected('split has a negative', (d) => { d.split = { spend: 120, save: -20, goals: 0 }; });
  assertRejected('split has an extra bucket', (d) => { d.split.fun = 0; });
  assertRejected('split percent as text', (d) => { d.split.spend = '50'; });
});

test('importBackup rejects bad paychecks', () => {
  assertRejected('cents as text', (d) => { d.paychecks[0].cents = '4250'; });
  assertRejected('cents with a fraction', (d) => { d.paychecks[0].cents = 42.5; });
  assertRejected('negative cents', (d) => { d.paychecks[0].cents = -4250; });
  assertRejected('zero cents', (d) => { d.paychecks[0].cents = 0; });
  assertRejected('absurdly large cents', (d) => { d.paychecks[0].cents = 1e15; });
  assertRejected('impossible date', (d) => { d.paychecks[0].date = '2026-02-30'; });
  assertRejected('date with time', (d) => { d.paychecks[0].date = '2026-11-01T10:00:00Z'; });
  assertRejected('split does not total 100', (d) => { d.paychecks[0].goals = 21; });
  assertRejected('missing id', (d) => { delete d.paychecks[0].id; });
  assertRejected('duplicate ids', (d) => { d.paychecks[1].id = d.paychecks[0].id; });
  assertRejected('unexpected field', (d) => { d.paychecks[0].html = '<img src=x onerror=alert(1)>'; });
  assertRejected('paycheck is not an object', (d) => { d.paychecks[0] = 'paycheck'; });
});

test('importBackup rejects bad purchases', () => {
  assertRejected('note is not text', (d) => { d.purchases[0].note = 5; });
  assertRejected('note is far too long', (d) => { d.purchases[0].note = 'x'.repeat(500); });
  assertRejected('note has control characters', (d) => { d.purchases[0].note = 'a\u0000b'; });
  assertRejected('purchase cents negative', (d) => { d.purchases[0].cents = -1; });
  assertRejected('purchases spend more than was ever in Spend', (d) => { d.purchases[0].cents = 999999; });
});

test('importBackup rejects bad goals', () => {
  assertRejected('empty name', (d) => { d.goals[0].name = '   '; });
  assertRejected('name is not text', (d) => { d.goals[0].name = ['Phone']; });
  assertRejected('name is far too long', (d) => { d.goals[0].name = 'x'.repeat(500); });
  assertRejected('target of zero', (d) => { d.goals[0].targetCents = 0; });
  assertRejected('target as text', (d) => { d.goals[0].targetCents = '50000'; });
});

test('importBackup rejects a __proto__ key instead of copying it', () => {
  const text = `{"__proto__":{"polluted":true},${exportBackup(sampleState()).trimStart().slice(1)}`;
  const result = importBackup(text);
  assert.equal(result.ok, false);
  assert.equal(/** @type {any} */ ({}).polluted, undefined);
});

test('importBackup builds fresh objects in a fixed key order', () => {
  // Keys in an unusual order in the file must not change split tie-breaking.
  const data = JSON.parse(exportBackup(sampleState()));
  data.split = { goals: 20, save: 30, spend: 50 };
  const result = importBackup(JSON.stringify(data));
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.state.split), ['spend', 'save', 'goals']);
});

// Purchases and overspending (ticket 004)

test('a purchase can use up Spend exactly, down to zero', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-07', cents: 1000 }); // spend 500
  state = addPurchase(state, { date: '2026-11-07', cents: 500, note: 'Shoes' });
  assert.equal(balances(state).spend, 0);
  assert.deepEqual(balances(state), { spend: 0, save: 300, goals: 200 });
});

test('a purchase one cent over what is in Spend is blocked and changes nothing', () => {
  const state = addPaycheck(emptyState(), { date: '2026-11-07', cents: 1000 }); // spend 500
  const snapshot = structuredClone(state);
  assert.throws(
    () => addPurchase(state, { date: '2026-11-07', cents: 501, note: 'Shoes' }),
    (error) => error instanceof OverspendError && error instanceof RangeError && error.availableCents === 500,
  );
  assert.deepEqual(state, snapshot);
});

test('with nothing in Spend, every purchase is blocked', () => {
  assert.throws(
    () => addPurchase(emptyState(), { date: '2026-11-07', cents: 1, note: '' }),
    (error) => error instanceof OverspendError && error.availableCents === 0,
  );
});

test('earlier purchases count against what is left', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-07', cents: 1000 }); // spend 500
  state = addPurchase(state, { date: '2026-11-07', cents: 300, note: 'Lunch' });
  assert.throws(
    () => addPurchase(state, { date: '2026-11-07', cents: 201, note: 'Snacks' }),
    (error) => error instanceof OverspendError && error.availableCents === 200,
  );
  state = addPurchase(state, { date: '2026-11-07', cents: 200, note: 'Snacks' });
  assert.equal(balances(state).spend, 0);
});

test('a purchase note is trimmed and stored as plain text', () => {
  const state = addPaycheck(emptyState(), { date: '2026-11-07', cents: 1000 });
  const next = addPurchase(state, { date: '2026-11-07', cents: 100, note: '  <b>Pizza</b>  ' });
  assert.equal(next.purchases[0].note, '<b>Pizza</b>');
});

// Removing records to fix mistakes

test('removePurchase puts the money back in Spend', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-07', cents: 1000 });
  state = addPurchase(state, { date: '2026-11-07', cents: 300, note: 'Lunch' });
  state = removePurchase(state, state.purchases[0].id);
  assert.equal(state.purchases.length, 0);
  assert.equal(balances(state).spend, 500);
});

test('removePaycheck takes its money back out of every bucket', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-01', cents: 1000 });
  state = addPaycheck(state, { date: '2026-11-07', cents: 425000 }); // oops, meant 42.50
  state = removePaycheck(state, state.paychecks[1].id);
  assert.deepEqual(balances(state), { spend: 500, save: 300, goals: 200 });
});

test('removePaycheck is blocked if it would leave Spend below zero', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-01', cents: 1000 }); // spend 500
  state = addPaycheck(state, { date: '2026-11-07', cents: 1000 }); // spend 1000
  state = addPurchase(state, { date: '2026-11-07', cents: 600, note: 'Game' });
  const snapshot = structuredClone(state);
  assert.throws(() => removePaycheck(state, state.paychecks[1].id), (error) => error instanceof OverspendError);
  assert.deepEqual(state, snapshot);
});

test('removing an id that does not exist is an error', () => {
  assert.throws(() => removePaycheck(emptyState(), 'p9'), RangeError);
  assert.throws(() => removePurchase(emptyState(), 'b9'), RangeError);
});

test('ids stay unique after the newest record is removed and another is added', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-07', cents: 1000 });
  state = addPaycheck(state, { date: '2026-11-07', cents: 1000 });
  const removedId = state.paychecks[1].id;
  state = removePaycheck(state, removedId);
  state = addPaycheck(state, { date: '2026-11-07', cents: 1000 });
  assert.equal(state.paychecks.length, 2);
  assert.equal(new Set(state.paychecks.map((p) => p.id)).size, 2);
});

// Recent activity list

test('recentActivity lists paychecks and purchases, newest date first', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-01', cents: 10000 });
  state = addPaycheck(state, { date: '2026-11-07', cents: 2000 });
  state = addPurchase(state, { date: '2026-11-03', cents: 500, note: 'Movie' });
  state = addPurchase(state, { date: '2026-11-07', cents: 300, note: 'Snack' });
  state = addPurchase(state, { date: '2026-11-07', cents: 200, note: 'Drink' });
  const { items, total } = recentActivity(state, 20);
  assert.equal(total, 5);
  assert.deepEqual(items.map((i) => [i.kind, i.date, i.cents]), [
    ['purchase', '2026-11-07', 200], // same day: purchases first, latest logged first
    ['purchase', '2026-11-07', 300],
    ['paycheck', '2026-11-07', 2000],
    ['purchase', '2026-11-03', 500],
    ['paycheck', '2026-11-01', 10000],
  ]);
  assert.equal(items[0].note, 'Drink');
});

test('recentActivity stops at the limit but reports the full count', () => {
  let state = emptyState();
  for (let day = 1; day <= 9; day++) state = addPaycheck(state, { date: `2026-11-0${day}`, cents: 100 });
  const { items, total } = recentActivity(state, 3);
  assert.equal(total, 9);
  assert.deepEqual(items.map((i) => i.date), ['2026-11-09', '2026-11-08', '2026-11-07']);
});

test('recentActivity orders ids by number, so p10 comes after p9', () => {
  let state = emptyState();
  for (let i = 0; i < 10; i++) state = addPaycheck(state, { date: '2026-11-07', cents: 100 + i });
  assert.deepEqual(recentActivity(state, 2).items.map((i) => i.cents), [109, 108]);
});

// Goals (ticket 005)

test('addGoal adds a goal at the bottom with a trimmed name', () => {
  let state = addGoal(emptyState(), { name: '  New phone ', targetCents: 30000 });
  state = addGoal(state, { name: 'Concert', targetCents: 8000 });
  assert.deepEqual(state.goals.map((g) => [g.name, g.targetCents]), [['New phone', 30000], ['Concert', 8000]]);
  assert.equal(new Set(state.goals.map((g) => g.id)).size, 2);
});

test('addGoal rejects an empty or too-long name and a bad target', () => {
  const state = emptyState();
  assert.throws(() => addGoal(state, { name: '   ', targetCents: 100 }), RangeError);
  assert.throws(() => addGoal(state, { name: 'x'.repeat(41), targetCents: 100 }), RangeError);
  assert.throws(() => addGoal(state, { name: 'Car', targetCents: 0 }), RangeError);
  assert.throws(() => addGoal(state, { name: 'Car', targetCents: 99.5 }), RangeError);
});

test('there is a limit on how many goals you can have', () => {
  let state = emptyState();
  for (let i = 0; i < LIMITS.maxGoals; i++) state = addGoal(state, { name: `Goal ${i}`, targetCents: 100 });
  assert.throws(() => addGoal(state, { name: 'One more', targetCents: 100 }), RangeError);
  assertRejected('too many goals', (d) => {
    d.goals = Array.from({ length: LIMITS.maxGoals + 1 }, (_, i) => ({ id: `g${i + 1}`, name: 'G', targetCents: 1 }));
  });
});

test('updateGoal renames a goal and changes its target', () => {
  let state = addGoal(emptyState(), { name: 'Phone', targetCents: 30000 });
  const { id } = state.goals[0];
  state = updateGoal(state, id, { name: 'Better phone', targetCents: 45000 });
  assert.deepEqual(state.goals, [{ id, name: 'Better phone', targetCents: 45000 }]);
  assert.throws(() => updateGoal(state, 'g99', { name: 'X', targetCents: 1 }), RangeError);
  assert.throws(() => updateGoal(state, id, { name: '', targetCents: 1 }), RangeError);
});

test('removeGoal takes a goal off the list', () => {
  let state = addGoal(emptyState(), { name: 'Phone', targetCents: 30000 });
  state = addGoal(state, { name: 'Concert', targetCents: 8000 });
  state = removeGoal(state, state.goals[0].id);
  assert.deepEqual(state.goals.map((g) => g.name), ['Concert']);
  assert.throws(() => removeGoal(state, 'g99'), RangeError);
});

test('moveGoal moves a goal up or down, and does nothing past the ends', () => {
  let state = emptyState();
  for (const name of ['A', 'B', 'C']) state = addGoal(state, { name, targetCents: 100 });
  const names = (s) => s.goals.map((g) => g.name).join('');
  const id = (name) => state.goals.find((g) => g.name === name).id;
  assert.equal(names(moveGoal(state, id('C'), -1)), 'ACB');
  assert.equal(names(moveGoal(state, id('A'), 1)), 'BAC');
  assert.equal(names(moveGoal(state, id('A'), -1)), 'ABC');
  assert.equal(names(moveGoal(state, id('C'), 1)), 'ABC');
  assert.throws(() => moveGoal(state, 'g99', 1), RangeError);
});

// Backup file name (ticket 007)

test('backupFileName puts the date in the name so backups sort in order', () => {
  assert.equal(backupFileName('2026-11-07'), 'budgeteer-backup-2026-11-07.json');
});

// Fresh-eyes review findings (ticket 009, REVIEW.md)

test('C3: after restoring a backup with very high ids, new records still load again', () => {
  const data = JSON.parse(exportBackup(sampleState()));
  data.paychecks[1].id = 'p999999999';
  data.purchases[0].id = 'b999999999';
  data.goals[0].id = 'g999999999';
  const restored = importBackup(JSON.stringify(data));
  assert.equal(restored.ok, true);
  let state = restored.state;
  state = addPaycheck(state, { date: '2026-11-07', cents: 100 });
  state = addPurchase(state, { date: '2026-11-07', cents: 10, note: '' });
  state = addGoal(state, { name: 'Bike', targetCents: 100 });
  const reloaded = importBackup(exportBackup(state));
  assert.equal(reloaded.ok, true, reloaded.ok ? '' : reloaded.error);
});

test('C3: every kind of change gives a state that loads again', () => {
  let state = emptyState({ spend: 34, save: 33, goals: 33 });
  const steps = [
    (s) => addPaycheck(s, { date: '2026-11-01', cents: 10001 }),
    (s) => addPaycheck(s, { date: '2026-11-07', cents: 99 }),
    (s) => addPurchase(s, { date: '2026-11-07', cents: 3400, note: '  Shoes  ' }),
    (s) => addGoal(s, { name: 'Phone', targetCents: 30000 }),
    (s) => addGoal(s, { name: 'Car', targetCents: 500000 }),
    (s) => updateGoal(s, s.goals[0].id, { name: 'New phone', targetCents: 25000 }),
    (s) => moveGoal(s, s.goals[1].id, -1),
    (s) => setSplit(s, { spend: 10, save: 10, goals: 80 }),
    (s) => removePurchase(s, s.purchases[0].id),
    (s) => removeGoal(s, s.goals[0].id),
    (s) => removePaycheck(s, s.paychecks[0].id),
  ];
  for (const [i, step] of steps.entries()) {
    state = step(state);
    const result = importBackup(exportBackup(state));
    assert.equal(result.ok, true, `step ${i + 1}: ${result.ok ? '' : result.error}`);
  }
});

test('C3: adding past the record limit is refused instead of saved and then rejected on load', () => {
  const full = {
    ...emptyState(),
    paychecks: Array.from({ length: LIMITS.maxRecords }, (_, i) => ({ id: `p${i + 1}`, date: '2026-11-07', cents: 100, spend: 50, save: 30, goals: 20 })),
  };
  assert.throws(() => addPaycheck(full, { date: '2026-11-07', cents: 100 }), { name: 'RangeError', message: /too many/i });
});

test('U2: tabs and line breaks in a note or goal name become plain spaces', () => {
  let state = addPaycheck(emptyState(), { date: '2026-11-07', cents: 1000 });
  state = addPurchase(state, { date: '2026-11-07', cents: 100, note: 'Tab\there\nand\r\nthere' });
  assert.equal(state.purchases[0].note, 'Tab here and there');
  state = addGoal(state, { name: 'New\tphone', targetCents: 100 });
  assert.equal(state.goals[0].name, 'New phone');
  state = updateGoal(state, state.goals[0].id, { name: 'Old\nphone', targetCents: 100 });
  assert.equal(state.goals[0].name, 'Old phone');
  assert.throws(() => addPurchase(state, { date: '2026-11-07', cents: 1, note: 'a\u0000b' }), RangeError);
});

test('U7: restoring checks dates against today, with one day of slack for time zones', () => {
  const data = JSON.parse(exportBackup(sampleState()));
  data.paychecks[1].date = '2026-11-08';
  assert.equal(importBackup(JSON.stringify(data), '2026-11-07').ok, true);

  data.paychecks[1].date = '2026-11-09';
  const paycheck = importBackup(JSON.stringify(data), '2026-11-07');
  assert.equal(paycheck.ok, false);
  assert.match(paycheck.error, /Paycheck 2's date is in the future/);

  data.paychecks[1].date = '2026-11-06';
  data.purchases[0].date = '2027-01-01';
  const purchase = importBackup(JSON.stringify(data), '2026-11-07');
  assert.equal(purchase.ok, false);
  assert.match(purchase.error, /Purchase 1's date is in the future/);
});

test('C7: a second damaged load keeps the first damaged copy', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: 'first {' });
  loadState(storage);
  storage.setItem(STORAGE_KEY, 'second {');
  loadState(storage);
  assert.equal(storage.items.get(DAMAGED_KEY), 'first {');
  assert.equal(storage.items.get(`${DAMAGED_KEY}.2`), 'second {');
});

test('C7: loading the same damaged data again does not pile up copies', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: 'same {' });
  loadState(storage);
  loadState(storage);
  assert.deepEqual([...storage.items.keys()].sort(), [DAMAGED_KEY, STORAGE_KEY].sort());
});

test('U1: readSaved returns what is stored, null when empty, undefined when unreadable', () => {
  assert.equal(readSaved(fakeStorage({ [STORAGE_KEY]: 'x' })), 'x');
  assert.equal(readSaved(fakeStorage()), null);
  assert.equal(readSaved(brokenStorage), undefined);
  assert.equal(readSaved(null), undefined);
});

test('U1: saveChecked saves when nothing changed since this tab last looked', () => {
  const storage = fakeStorage();
  const first = saveChecked(storage, emptyState(), null);
  assert.equal(first.status, 'saved');
  assert.equal(storage.items.get(STORAGE_KEY), first.raw);
  const second = saveChecked(storage, sampleState(), first.raw);
  assert.equal(second.status, 'saved');
  assert.equal(storage.items.get(STORAGE_KEY), exportBackup(sampleState()));
});

test('U1: saveChecked refuses to overwrite changes made in another tab', () => {
  const storage = fakeStorage();
  const mine = saveChecked(storage, emptyState(), null);
  storage.setItem(STORAGE_KEY, exportBackup(sampleState())); // another tab saved
  const result = saveChecked(storage, emptyState(), mine.raw);
  assert.equal(result.status, 'changed');
  assert.equal(storage.items.get(STORAGE_KEY), exportBackup(sampleState()));
});

test('C3: saveChecked never writes a state that would not load again', () => {
  const storage = fakeStorage();
  const broken = { ...emptyState(), purchases: [{ id: 'b1', date: '2026-11-07', cents: 100, note: '' }] }; // Spend below zero
  assert.equal(saveChecked(storage, broken, null).status, 'invalid');
  assert.equal(storage.items.has(STORAGE_KEY), false);
});

test('U1: saveChecked reports failure when storage is off', () => {
  assert.equal(saveChecked(brokenStorage, emptyState(), null).status, 'failed');
  assert.equal(saveChecked(null, emptyState(), null).status, 'failed');
});

// Saved data version 2 (ticket 011, docs/adr/0003)

/** A valid version 2 state: the v1 sample, upgraded, with one goal purchase. */
function sampleV2() {
  const state = upgradeState(sampleState());
  return { ...state, goalPurchases: [{ id: 'x1', date: '2026-11-06', cents: 500, name: 'Shoes' }] };
}

test('newState is an empty version 2 state with tracking off', () => {
  assert.deepEqual(newState(), {
    version: 2,
    split: { spend: 50, save: 30, goals: 20 },
    settings: { trackSpending: false },
    paychecks: [],
    purchases: [],
    goals: [],
    goalPurchases: [],
  });
});

test('upgradeState keeps every version 1 record and turns tracking on if there are purchases', () => {
  const v1 = sampleState();
  const v2 = upgradeState(v1);
  assert.equal(v2.version, 2);
  assert.deepEqual(v2.settings, { trackSpending: true });
  assert.deepEqual(v2.split, v1.split);
  assert.deepEqual(v2.paychecks, v1.paychecks);
  assert.deepEqual(v2.purchases, v1.purchases);
  assert.deepEqual(v2.goals, v1.goals);
  assert.deepEqual(v2.goalPurchases, []);
  assert.deepEqual(balances(v2), balances(v1));
});

test('upgradeState leaves tracking off when there are no purchases, and passes version 2 through', () => {
  const v2 = upgradeState(addPaycheck(emptyState(), { date: '2026-11-07', cents: 100 }));
  assert.deepEqual(v2.settings, { trackSpending: false });
  assert.deepEqual(upgradeState(sampleV2()), sampleV2());
});

test('a version 1 backup restores and upgrades with nothing lost', () => {
  const result = importBackup(exportBackup(sampleState()));
  assert.equal(result.ok, true);
  const upgraded = upgradeState(result.state);
  assert.equal(upgraded.paychecks.length, 2);
  assert.equal(upgraded.purchases.length, 1);
  assert.equal(upgraded.goals.length, 1);
});

test('version 2 validates, round-trips through a backup, and loads from storage', () => {
  assert.deepEqual(validateState(sampleV2()), { ok: true, state: sampleV2() });
  assert.deepEqual(importBackup(exportBackup(sampleV2())), { ok: true, state: sampleV2() });
  const storage = fakeStorage();
  assert.equal(saveChecked(storage, sampleV2(), null).status, 'saved');
  assert.deepEqual(loadState(storage), { state: sampleV2(), warning: null });
});

test('balances take goal purchases out of Goals only', () => {
  // sampleState: spend 5626, save 4275, goals 2850. The goal purchase takes 500 from Goals.
  assert.deepEqual(balances(sampleV2()), { spend: 5626, save: 4275, goals: 2350 });
});

/**
 * @param {string} label
 * @param {(data: any) => void} breakIt
 */
function assertRejectedV2(label, breakIt) {
  const data = JSON.parse(exportBackup(sampleV2()));
  breakIt(data);
  const result = importBackup(JSON.stringify(data));
  assert.equal(result.ok, false, `should reject: ${label}`);
  assert.equal(typeof result.error, 'string', label);
}

test('version 2 rejects bad settings and bad goal purchases', () => {
  assertRejectedV2('missing settings', (d) => { delete d.settings; });
  assertRejectedV2('missing goalPurchases', (d) => { delete d.goalPurchases; });
  assertRejectedV2('settings has an extra key', (d) => { d.settings.admin = true; });
  assertRejectedV2('trackSpending is not true or false', (d) => { d.settings.trackSpending = 'yes'; });
  assertRejectedV2('settings is a list', (d) => { d.settings = [true]; });
  assertRejectedV2('goalPurchases is not a list', (d) => { d.goalPurchases = {}; });
  assertRejectedV2('goal purchase with a paycheck id', (d) => { d.goalPurchases[0].id = 'p1'; });
  assertRejectedV2('duplicate goal purchase ids', (d) => { d.goalPurchases.push({ ...d.goalPurchases[0] }); });
  assertRejectedV2('goal purchase cents as text', (d) => { d.goalPurchases[0].cents = '500'; });
  assertRejectedV2('goal purchase with an empty name', (d) => { d.goalPurchases[0].name = ' '; });
  assertRejectedV2('goal purchase with an extra field', (d) => { d.goalPurchases[0].html = '<b>'; });
  assertRejectedV2('goal buys use more than was saved for goals', (d) => { d.goalPurchases[0].cents = 2851; });
  assertRejectedV2('version 1 with version 2 fields', (d) => { d.version = 1; });
});

test('version 2 restore refuses goal purchases dated after tomorrow', () => {
  const data = JSON.parse(exportBackup(sampleV2()));
  data.goalPurchases[0].date = '2026-11-09';
  const result = importBackup(JSON.stringify(data), '2026-11-07');
  assert.equal(result.ok, false);
  assert.match(result.error, /Goal buy 1's date is in the future/);
});

test('setTrackSpending switches tracking without touching any record', () => {
  const before = sampleV2();
  const off = setTrackSpending(before, false);
  assert.equal(off.settings.trackSpending, false);
  assert.deepEqual(off.purchases, before.purchases);
  assert.equal(setTrackSpending(off, true).settings.trackSpending, true);
  assert.equal(before.settings.trackSpending, true); // not mutated
  assert.throws(() => setTrackSpending(before, 'on'), RangeError);
  assert.throws(() => setTrackSpending(sampleState(), true), RangeError); // version 1 must be upgraded first
});

test('removeGoalPurchase puts the money back in Goals', () => {
  const state = removeGoalPurchase(sampleV2(), 'x1');
  assert.deepEqual(state.goalPurchases, []);
  assert.equal(balances(state).goals, 2850);
  assert.throws(() => removeGoalPurchase(state, 'x1'), RangeError);
});

test('removePaycheck is blocked when its goal money was already used to buy a goal', () => {
  let state = addPaycheck(newState(), { date: '2026-11-01', cents: 10000 }); // 2000 to goals
  state = { ...state, goalPurchases: [{ id: 'x1', date: '2026-11-07', cents: 1500, name: 'Shoes' }] };
  const snapshot = structuredClone(state);
  assert.throws(() => removePaycheck(state, state.paychecks[0].id), (error) => error instanceof GoalMoneyUsedError);
  assert.deepEqual(state, snapshot);
});

test('new records in a version 2 state keep it version 2 and loadable', () => {
  let state = newState();
  state = addPaycheck(state, { date: '2026-11-07', cents: 10000 });
  state = addGoal(state, { name: 'Phone', targetCents: 30000 });
  state = setSplit(state, { spend: 40, save: 30, goals: 30 });
  assert.equal(state.version, 2);
  assert.equal(importBackup(exportBackup(state)).ok, true);
  assert.equal(nextId('x', [{ id: 'x1' }, { id: 'x7' }]), 'x8');
});
