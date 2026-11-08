// App state: the records, the pure changes to them, saving to the device, and backups.
// Balances are always calculated from the records, never stored. All money is integer cents.

import { splitIncome, isISODate, dayNumber } from './budget.js';

/**
 * @typedef {{ spend: number, save: number, goals: number }} Split
 *   Whole-number percents that total 100, or cents per bucket.
 * @typedef {{ id: string, date: string, cents: number } & Split} Paycheck
 *   spend/save/goals are the percents in effect when the paycheck was logged.
 * @typedef {{ id: string, date: string, cents: number, note: string }} Purchase
 * @typedef {{ id: string, name: string, targetCents: number }} Goal
 * @typedef {{ id: string, date: string, cents: number, name: string }} GoalPurchase
 *   A funded goal that was bought: cents came out of Goals; name is the goal's name.
 * @typedef {{ trackSpending: boolean }} Settings
 * @typedef {{ version: 1 | 2, split: Split, paychecks: Paycheck[], purchases: Purchase[], goals: Goal[],
 *   settings?: Settings, goalPurchases?: GoalPurchase[] }} State
 *   Version 2 always has settings and goalPurchases (docs/adr/0003). The app uses version 2.
 * @typedef {{ getItem(key: string): string | null, setItem(key: string, value: string): void }} StorageLike
 * @typedef {{ ok: true, state: State } | { ok: false, error: string }} ValidationResult
 */

export const STORAGE_KEY = 'budgeteer.v1';
export const DAMAGED_KEY = `${STORAGE_KEY}.damaged`;

/** @type {Readonly<Split>} */
export const DEFAULT_SPLIT = Object.freeze({ spend: 50, save: 30, goals: 20 });

export const LIMITS = Object.freeze({
  /** Largest single amount: $1,000,000. Keeps every sum far inside safe integers. */
  maxCents: 100_000_000,
  maxRecords: 50_000,
  maxGoals: 50,
  maxNoteLength: 80,
  maxGoalNameLength: 40,
  /** A real backup is far smaller; browsers cap saved data at about 5 million characters. */
  maxBackupChars: 5_000_000,
});

export const NO_STORAGE_WARNING =
  "This browser won't let Budgeteer save, so your info will be gone when you close the page. " +
  'Download a backup before you leave.';
export const DAMAGED_WARNING =
  "Your saved info couldn't be read, so Budgeteer started fresh. " +
  'If you have a backup file, you can restore it.';

const SPLIT_KEYS = /** @type {const} */ (['spend', 'save', 'goals']);
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const ID_PATTERN = {
  paycheck: /^p[1-9]\d{0,8}$/,
  purchase: /^b[1-9]\d{0,8}$/,
  goal: /^g[1-9]\d{0,8}$/,
  goalPurchase: /^x[1-9]\d{0,8}$/,
};
const V1_KEYS = ['version', 'split', 'paychecks', 'purchases', 'goals'];
const V2_KEYS = ['version', 'split', 'settings', 'paychecks', 'purchases', 'goals', 'goalPurchases'];

// ---------------------------------------------------------------------------
// Field readers. Each one checks an untrusted value and returns a clean copy,
// or throws a RangeError with a plain-words reason.

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * Check that value is a plain object with exactly these keys.
 * @param {unknown} value
 * @param {readonly string[]} keys
 * @param {string} where
 * @returns {Record<string, unknown>}
 */
function readObject(value, keys, where) {
  if (!isPlainObject(value)) throw new RangeError(`${where} is not in the right format.`);
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new RangeError(`${where} has something unexpected in it ("${key.slice(0, 20)}").`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) throw new RangeError(`${where} is missing "${key}".`);
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} where
 * @returns {unknown[]}
 */
function readList(value, where) {
  if (!Array.isArray(value)) throw new RangeError(`${where} is not a list.`);
  if (value.length > LIMITS.maxRecords) throw new RangeError(`${where} has too many entries.`);
  return value;
}

/**
 * @param {unknown} value
 * @param {string} where
 * @returns {number}
 */
function readCents(value, where) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new RangeError(`${where} must be a whole number of cents.`);
  }
  if (value < 1) throw new RangeError(`${where} must be more than zero.`);
  if (value > LIMITS.maxCents) throw new RangeError(`${where} is too large.`);
  return value;
}

/**
 * @param {unknown} value
 * @param {string} where
 * @returns {string}
 */
function readDate(value, where) {
  if (!isISODate(value)) throw new RangeError(`${where} must be a real date written as YYYY-MM-DD.`);
  return /** @type {string} */ (value);
}

/**
 * @param {unknown} value
 * @param {string} where
 * @param {number} maxLength
 * @returns {string}
 */
function readText(value, where, maxLength) {
  if (typeof value !== 'string') throw new RangeError(`${where} must be text.`);
  if (value.length > maxLength) throw new RangeError(`${where} is longer than ${maxLength} characters.`);
  if (CONTROL_CHARS.test(value)) throw new RangeError(`${where} has characters that aren't allowed.`);
  return value;
}

/**
 * @param {unknown} value
 * @param {string} where
 * @returns {string}
 */
function readName(value, where) {
  const name = readText(value, where, LIMITS.maxGoalNameLength);
  if (name.trim() === '') throw new RangeError(`${where} can't be empty.`);
  return name;
}

/**
 * @param {unknown} value
 * @param {RegExp} pattern
 * @param {Set<string>} seen
 * @param {string} where
 * @returns {string}
 */
function readId(value, pattern, seen, where) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new RangeError(`${where} has a bad id.`);
  if (seen.has(value)) throw new RangeError(`${where} has the same id as another entry.`);
  seen.add(value);
  return value;
}

/**
 * Read three whole percents that total 100, always returned in spend/save/goals order.
 * @param {unknown} value
 * @param {string} where
 * @returns {Split}
 */
function readSplit(value, where) {
  const obj = readObject(value, SPLIT_KEYS, where);
  return readSplitFields(obj, where);
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string} where
 * @returns {Split}
 */
function readSplitFields(obj, where) {
  for (const key of SPLIT_KEYS) {
    const pct = obj[key];
    if (typeof pct !== 'number' || !Number.isInteger(pct) || pct < 0 || pct > 100) {
      throw new RangeError(`${where}: each percent must be a whole number from 0 to 100.`);
    }
  }
  const split = { spend: /** @type {number} */ (obj.spend), save: /** @type {number} */ (obj.save), goals: /** @type {number} */ (obj.goals) };
  const total = split.spend + split.save + split.goals;
  if (total !== 100) throw new RangeError(`${where}: the percents add up to ${total}, not 100.`);
  return split;
}

// ---------------------------------------------------------------------------
// Validation of a whole state (used for saved data and for backup files).

/**
 * Check an untrusted value and return a clean copy of the state, or a plain-words reason.
 * Rejects unknown fields, wrong types, impossible dates, bad splits, duplicate ids, and
 * purchases that spend more than ever went into Spend. With todayISO, it also rejects
 * dates more than one day after today (one day of slack for time zones).
 * @param {unknown} data
 * @param {string} [todayISO]
 * @returns {ValidationResult}
 */
export function validateState(data, todayISO) {
  const latestDay = todayISO === undefined ? Infinity : dayNumber(todayISO) + 1;
  /** @param {unknown} value @param {string} where */
  const readRecordDate = (value, where) => {
    const date = readDate(value, where);
    if (dayNumber(date) > latestDay) throw new RangeError(`${where} is in the future.`);
    return date;
  };
  try {
    if (!isPlainObject(data)) throw new RangeError('The backup is not in the right format.');
    const { version } = data;
    if (version !== 1 && version !== 2) throw new RangeError('The backup is from a different version of Budgeteer.');
    const top = readObject(data, version === 1 ? V1_KEYS : V2_KEYS, 'The backup');

    const split = readSplit(top.split, 'The split');

    const paycheckIds = new Set();
    const paychecks = readList(top.paychecks, 'The paychecks').map((item, i) => {
      const where = `Paycheck ${i + 1}`;
      const p = readObject(item, ['id', 'date', 'cents', 'spend', 'save', 'goals'], where);
      return {
        id: readId(p.id, ID_PATTERN.paycheck, paycheckIds, where),
        date: readRecordDate(p.date, `${where}'s date`),
        cents: readCents(p.cents, `${where}'s amount`),
        ...readSplitFields(p, `${where}'s split`),
      };
    });

    const purchaseIds = new Set();
    const purchases = readList(top.purchases, 'The purchases').map((item, i) => {
      const where = `Purchase ${i + 1}`;
      const b = readObject(item, ['id', 'date', 'cents', 'note'], where);
      return {
        id: readId(b.id, ID_PATTERN.purchase, purchaseIds, where),
        date: readRecordDate(b.date, `${where}'s date`),
        cents: readCents(b.cents, `${where}'s amount`),
        note: readText(b.note, `${where}'s note`, LIMITS.maxNoteLength),
      };
    });

    const goalIds = new Set();
    const goalList = readList(top.goals, 'The goals');
    if (goalList.length > LIMITS.maxGoals) throw new RangeError(`The backup has more than ${LIMITS.maxGoals} goals.`);
    const goals = goalList.map((item, i) => {
      const where = `Goal ${i + 1}`;
      const g = readObject(item, ['id', 'name', 'targetCents'], where);
      return {
        id: readId(g.id, ID_PATTERN.goal, goalIds, where),
        name: readName(g.name, `${where}'s name`),
        targetCents: readCents(g.targetCents, `${where}'s target`),
      };
    });

    /** @type {State} */
    let state = { version: 1, split, paychecks, purchases, goals };
    if (version === 2) {
      const settings = readObject(top.settings, ['trackSpending'], 'The settings');
      if (typeof settings.trackSpending !== 'boolean') throw new RangeError('The tracking setting must be true or false.');
      const goalPurchaseIds = new Set();
      const goalPurchases = readList(top.goalPurchases, 'The goal buys').map((item, i) => {
        const where = `Goal buy ${i + 1}`;
        const x = readObject(item, ['id', 'date', 'cents', 'name'], where);
        return {
          id: readId(x.id, ID_PATTERN.goalPurchase, goalPurchaseIds, where),
          date: readRecordDate(x.date, `${where}'s date`),
          cents: readCents(x.cents, `${where}'s amount`),
          name: readName(x.name, `${where}'s name`),
        };
      });
      state = {
        version: 2, split, settings: { trackSpending: settings.trackSpending }, paychecks, purchases, goals, goalPurchases,
      };
    }
    const totals = balances(state);
    if (totals.spend < 0) throw new RangeError('The purchases add up to more than was ever in Spend.');
    if (totals.goals < 0) throw new RangeError('The goal buys add up to more than was saved for goals.');
    return { ok: true, state };
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, error: error.message };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// State and balances.

/**
 * A fresh version 2 state: no records, tracking off. This is what the app starts with.
 * @param {Split} [split]
 * @returns {State}
 */
export function newState(split = DEFAULT_SPLIT) {
  return upgradeState(emptyState(split));
}

/**
 * Turn version 1 into version 2, keeping every record. Tracking starts on if there are
 * purchases, so nobody who logged purchases loses sight of them. Version 2 passes through.
 * @param {State} state
 * @returns {State}
 */
export function upgradeState(state) {
  if (state.version === 2) return state;
  return {
    version: 2,
    split: state.split,
    settings: { trackSpending: state.purchases.length > 0 },
    paychecks: state.paychecks,
    purchases: state.purchases,
    goals: state.goals,
    goalPurchases: [],
  };
}

/**
 * Turn "Track my spending" on or off. Hides or shows purchases; never deletes them.
 * @param {State} state a version 2 state
 * @param {boolean} on
 * @returns {State}
 */
export function setTrackSpending(state, on) {
  if (state.version !== 2) throw new RangeError('Upgrade the state to version 2 first.');
  if (typeof on !== 'boolean') throw new RangeError('Tracking must be true or false.');
  return { ...state, settings: { ...state.settings, trackSpending: on } };
}

/**
 * Undo a goal buy: its money goes back into Goals.
 * @param {State} state
 * @param {string} id
 * @returns {State}
 */
export function removeGoalPurchase(state, id) {
  const list = state.goalPurchases ?? [];
  if (!list.some((x) => x.id === id)) throw new RangeError(`No goal buy with id ${id}`);
  return { ...state, goalPurchases: list.filter((x) => x.id !== id) };
}

/**
 * A fresh version 1 state with no records (kept for version 1 callers and tests).
 * @param {Split} [split]
 * @returns {State}
 */
export function emptyState(split = DEFAULT_SPLIT) {
  return { version: 1, split: readSplit({ ...split }, 'The split'), paychecks: [], purchases: [], goals: [] };
}

/**
 * Cents in each bucket, calculated from the records.
 * Spend is paychecks' spend parts minus purchases. Save and Goals are paychecks' parts.
 * @param {State} state
 * @returns {Split}
 */
export function balances(state) {
  const total = { spend: 0, save: 0, goals: 0 };
  for (const p of state.paychecks) {
    const parts = paycheckParts(p);
    total.spend += parts.spend;
    total.save += parts.save;
    total.goals += parts.goals;
  }
  for (const b of state.purchases) total.spend -= b.cents;
  for (const x of state.goalPurchases ?? []) total.goals -= x.cents;
  return total;
}

/**
 * How one paycheck was split into cents, using the split it was logged with.
 * @param {Paycheck} paycheck
 * @returns {Split}
 */
export function paycheckParts(paycheck) {
  const parts = splitIncome(paycheck.cents, { spend: paycheck.spend, save: paycheck.save, goals: paycheck.goals });
  return { spend: parts.spend, save: parts.save, goals: parts.goals };
}

/** Ids have at most 9 digits (see ID_PATTERN). */
const MAX_ID_NUMBER = 999_999_999;

/**
 * The next free id like "p4" for a list of records: one more than the highest, or, if that
 * would be too long (only possible after restoring a hand-edited backup), the lowest unused.
 * @param {'p' | 'b' | 'g' | 'x'} prefix
 * @param {{ id: string }[]} records
 * @returns {string}
 */
export function nextId(prefix, records) {
  const used = new Set();
  let max = 0;
  for (const { id } of records) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(1)) || 0;
    used.add(n);
    max = Math.max(max, n);
  }
  if (max < MAX_ID_NUMBER) return `${prefix}${max + 1}`;
  let n = 1;
  while (used.has(n)) n += 1;
  return `${prefix}${n}`;
}

/**
 * Turn tabs, line breaks and runs of spaces into single spaces (pasted text often has them).
 * @param {unknown} text
 * @returns {unknown}
 */
function oneLine(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ') : text;
}

/**
 * @param {unknown[]} list
 * @param {string} what
 */
function checkRoomFor(list, what) {
  if (list.length >= LIMITS.maxRecords) {
    throw new RangeError(`You have too many ${what} logged. Remove some old ones first.`);
  }
}

/**
 * Log a paycheck. It keeps the current split forever.
 * @param {State} state
 * @param {{ date: string, cents: number }} paycheck
 * @returns {State}
 */
export function addPaycheck(state, { date, cents }) {
  checkRoomFor(state.paychecks, 'paychecks');
  const record = {
    id: nextId('p', state.paychecks),
    date: readDate(date, 'The date'),
    cents: readCents(cents, 'The amount'),
    ...state.split,
  };
  return { ...state, paychecks: [...state.paychecks, record] };
}

/**
 * Thrown when a change would leave the Spend bucket below zero (SPEC.md Decisions 3).
 * availableCents is what is in Spend right now.
 */
export class OverspendError extends RangeError {
  /** @param {number} availableCents */
  constructor(availableCents) {
    super(`Only ${availableCents} cents are available to spend.`);
    this.name = 'OverspendError';
    this.availableCents = availableCents;
  }
}

/**
 * Log a purchase, which comes out of Spend. Throws an OverspendError if Spend can't cover it.
 * @param {State} state
 * @param {{ date: string, cents: number, note: string }} purchase
 * @returns {State}
 */
export function addPurchase(state, { date, cents, note }) {
  checkRoomFor(state.purchases, 'purchases');
  const record = {
    id: nextId('b', state.purchases),
    date: readDate(date, 'The date'),
    cents: readCents(cents, 'The amount'),
    note: readText(oneLine(note), 'The note', LIMITS.maxNoteLength).trim(),
  };
  const available = balances(state).spend;
  if (record.cents > available) throw new OverspendError(available);
  return { ...state, purchases: [...state.purchases, record] };
}

/**
 * Remove a purchase logged by mistake. Its money goes back into Spend.
 * @param {State} state
 * @param {string} id
 * @returns {State}
 */
export function removePurchase(state, id) {
  if (!state.purchases.some((b) => b.id === id)) throw new RangeError(`No purchase with id ${id}`);
  return { ...state, purchases: state.purchases.filter((b) => b.id !== id) };
}

/**
 * Remove a paycheck logged by mistake. Throws an OverspendError if part of it was already
 * spent (Spend would drop below zero), or a GoalMoneyUsedError if its goal money already
 * bought a goal (Goals would drop below zero).
 * @param {State} state
 * @param {string} id
 * @returns {State}
 */
export function removePaycheck(state, id) {
  if (!state.paychecks.some((p) => p.id === id)) throw new RangeError(`No paycheck with id ${id}`);
  const next = { ...state, paychecks: state.paychecks.filter((p) => p.id !== id) };
  const after = balances(next);
  if (after.spend < 0) throw new OverspendError(balances(state).spend);
  if (after.goals < 0) throw new GoalMoneyUsedError();
  return next;
}

/** Thrown when removing a paycheck would take back goal money that already bought a goal. */
export class GoalMoneyUsedError extends RangeError {
  constructor() {
    super('That goal money was already used to buy something.');
    this.name = 'GoalMoneyUsedError';
  }
}

/**
 * Change the split for future paychecks. Old paychecks keep theirs.
 * @param {State} state
 * @param {Split} split
 * @returns {State}
 */
export function setSplit(state, split) {
  return { ...state, split: readSplit({ ...split }, 'The split') };
}

// ---------------------------------------------------------------------------
// Goals. Their order is their priority: Goals-bucket money fills them top to bottom.

/**
 * @param {State} state
 * @param {string} id
 * @returns {number}
 */
function goalIndex(state, id) {
  const index = state.goals.findIndex((g) => g.id === id);
  if (index === -1) throw new RangeError(`No goal with id ${id}`);
  return index;
}

/**
 * Add a goal at the bottom of the list.
 * @param {State} state
 * @param {{ name: string, targetCents: number }} goal
 * @returns {State}
 */
export function addGoal(state, { name, targetCents }) {
  if (state.goals.length >= LIMITS.maxGoals) throw new RangeError(`You can have up to ${LIMITS.maxGoals} goals.`);
  const record = {
    id: nextId('g', state.goals),
    name: readName(oneLine(name), 'The name').trim(),
    targetCents: readCents(targetCents, 'The target'),
  };
  return { ...state, goals: [...state.goals, record] };
}

/**
 * Rename a goal and/or change its target.
 * @param {State} state
 * @param {string} id
 * @param {{ name: string, targetCents: number }} changes
 * @returns {State}
 */
export function updateGoal(state, id, { name, targetCents }) {
  const index = goalIndex(state, id);
  const record = { id, name: readName(oneLine(name), 'The name').trim(), targetCents: readCents(targetCents, 'The target') };
  return { ...state, goals: state.goals.map((g, i) => (i === index ? record : g)) };
}

/**
 * Delete a goal. Its money stays in the Goals bucket for the goals below it.
 * @param {State} state
 * @param {string} id
 * @returns {State}
 */
export function removeGoal(state, id) {
  goalIndex(state, id);
  return { ...state, goals: state.goals.filter((g) => g.id !== id) };
}

/**
 * Move a goal one place up (-1) or down (+1). Past either end, nothing changes.
 * @param {State} state
 * @param {string} id
 * @param {-1 | 1} direction
 * @returns {State}
 */
export function moveGoal(state, id, direction) {
  const from = goalIndex(state, id);
  const to = from + direction;
  if (to < 0 || to >= state.goals.length) return state;
  const goals = [...state.goals];
  [goals[from], goals[to]] = [goals[to], goals[from]];
  return { ...state, goals };
}

/**
 * @typedef {{ kind: 'paycheck', id: string, date: string, cents: number }
 *   | { kind: 'purchase', id: string, date: string, cents: number, note: string }
 *   | { kind: 'goalPurchase', id: string, date: string, cents: number, name: string }} ActivityItem
 */

/**
 * Paychecks, purchases and goal buys together, newest date first. On the same day, purchases
 * and goal buys come before paychecks (they usually happen after payday), and later-logged
 * records come first.
 * @param {State} state
 * @param {number} limit
 * @returns {{ items: ActivityItem[], total: number }}
 */
export function recentActivity(state, limit) {
  /** @type {ActivityItem[]} */
  const all = [
    ...state.paychecks.map((p) => ({ kind: /** @type {const} */ ('paycheck'), id: p.id, date: p.date, cents: p.cents })),
    ...state.purchases.map((b) => ({ kind: /** @type {const} */ ('purchase'), id: b.id, date: b.date, cents: b.cents, note: b.note })),
    ...(state.goalPurchases ?? []).map((x) => ({
      kind: /** @type {const} */ ('goalPurchase'), id: x.id, date: x.date, cents: x.cents, name: x.name,
    })),
  ];
  const kindOrder = { purchase: 0, goalPurchase: 0, paycheck: 1 };
  all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
    || kindOrder[a.kind] - kindOrder[b.kind]
    || Number(b.id.slice(1)) - Number(a.id.slice(1)));
  return { items: all.slice(0, limit), total: all.length };
}

// ---------------------------------------------------------------------------
// Saving on the device.

/**
 * Load the saved state. Never throws.
 * state is null on a first run, when storage is off, or when saved data is damaged
 * (damaged data is copied to DAMAGED_KEY so it is not lost).
 * @param {StorageLike | null | undefined} storage
 * @returns {{ state: State | null, warning: string | null }}
 */
export function loadState(storage) {
  if (!storage) return { state: null, warning: NO_STORAGE_WARNING };
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: null, warning: NO_STORAGE_WARNING };
  }
  if (raw === null || raw === undefined) return { state: null, warning: null };

  const result = importBackup(raw);
  if (result.ok) return { state: result.state, warning: null };
  keepDamagedCopy(storage, raw);
  return { state: null, warning: DAMAGED_WARNING };
}

/**
 * Save the state. Never throws. Returns false if it could not be saved.
 * @param {StorageLike | null | undefined} storage
 * @param {State} state
 * @returns {boolean}
 */
export function saveState(storage, state) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Backup files. An imported file is untrusted: it is size-checked, parsed, and
// fully validated, and its text is only ever shown with textContent.

/**
 * @param {State} state
 * @returns {string}
 */
export function exportBackup(state) {
  return JSON.stringify(state);
}

/**
 * @param {unknown} text
 * @param {string} [todayISO] when given, dates more than a day after it are rejected
 * @returns {ValidationResult}
 */
export function importBackup(text, todayISO) {
  if (typeof text !== 'string') return { ok: false, error: "That isn't a Budgeteer backup file." };
  if (text.length > LIMITS.maxBackupChars) return { ok: false, error: 'That file is too big to be a Budgeteer backup.' };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't a Budgeteer backup, or it's damaged." };
  }
  return validateState(data, todayISO);
}

/**
 * A file name for a backup, with the date so backups sort in order.
 * @param {string} todayISO
 * @returns {string}
 */
export function backupFileName(todayISO) {
  return `budgeteer-backup-${todayISO}.json`;
}

/** Up to this many damaged copies are kept. */
const DAMAGED_SLOTS = [DAMAGED_KEY, `${DAMAGED_KEY}.2`, `${DAMAGED_KEY}.3`, `${DAMAGED_KEY}.4`, `${DAMAGED_KEY}.5`];

/**
 * Put unreadable saved data aside without overwriting an earlier copy. Never throws.
 * @param {StorageLike} storage
 * @param {string} raw
 */
function keepDamagedCopy(storage, raw) {
  try {
    for (const key of DAMAGED_SLOTS) {
      const existing = storage.getItem(key);
      if (existing === raw) return;
      if (existing === null) {
        storage.setItem(key, raw);
        return;
      }
    }
    storage.setItem(DAMAGED_SLOTS[DAMAGED_SLOTS.length - 1], raw);
  } catch {
    // Nothing more we can do; the app still runs from memory.
  }
}

/**
 * The saved text exactly as stored: null if nothing is saved, undefined if storage can't be read.
 * @param {StorageLike | null | undefined} storage
 * @returns {string | null | undefined}
 */
export function readSaved(storage) {
  if (!storage) return undefined;
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
}

/**
 * Save, but only if it is safe to:
 * - 'invalid': the state would not load again, so nothing is written.
 * - 'changed': another tab saved since this one last read or wrote (expectedRaw), so
 *   nothing is written; reload and try again.
 * - 'failed': storage is off or full.
 * - 'saved': written; raw is the new saved text.
 * Pass expectedRaw as undefined to skip the other-tab check.
 * @param {StorageLike | null | undefined} storage
 * @param {State} state
 * @param {string | null | undefined} expectedRaw
 * @returns {{ status: 'saved', raw: string } | { status: 'invalid', error: string } | { status: 'changed' | 'failed' }}
 */
export function saveChecked(storage, state, expectedRaw) {
  const check = validateState(state);
  if (!check.ok) return { status: 'invalid', error: check.error };
  if (!storage) return { status: 'failed' };
  try {
    if (expectedRaw !== undefined && storage.getItem(STORAGE_KEY) !== expectedRaw) return { status: 'changed' };
    const raw = exportBackup(state);
    storage.setItem(STORAGE_KEY, raw);
    return { status: 'saved', raw };
  } catch {
    return { status: 'failed' };
  }
}
