// Budgeteer page: connects the forms to the state and draws the numbers.
// Every piece of text goes in with textContent, never innerHTML, so typed or imported text can't run.

import {
  DEFAULT_SPLIT,
  NO_STORAGE_WARNING,
  emptyState,
  loadState,
  saveState,
  addPaycheck,
  addPurchase,
  removePaycheck,
  removePurchase,
  OverspendError,
  recentActivity,
  setSplit,
  balances,
  paycheckParts,
} from './storage.js';
import { formatCents } from './money.js';
import { localISODate } from './budget.js';
import { paycheckSentence, splitTotalHint, overspendMessage, purchaseSentence, shortDate } from './words.js';
import { readAmount, readPastDate, readSplitInputs, toPercent } from './forms.js';

/** @typedef {import('./storage.js').State} State */
/** @typedef {import('./storage.js').Split} Split */

// ---------------------------------------------------------------------------
// Small DOM helpers

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Budgeteer page is missing #${id}`);
  return node;
}

/**
 * @param {string} id
 * @returns {HTMLInputElement}
 */
function inputEl(id) {
  return /** @type {HTMLInputElement} */ (el(id));
}

/**
 * Show a form error and mark the boxes that need fixing.
 * @param {string} errorId
 * @param {string} message
 * @param {HTMLInputElement[]} inputs
 */
function showError(errorId, message, inputs) {
  el(errorId).textContent = message;
  for (const input of inputs) input.setAttribute('aria-invalid', 'true');
  inputs[0]?.focus();
}

/**
 * @param {string} errorId
 * @param {HTMLInputElement[]} inputs
 */
function clearError(errorId, inputs) {
  el(errorId).textContent = '';
  for (const input of inputs) input.removeAttribute('aria-invalid');
}

/** Clear every "done" and error message, so only the newest one is on screen. */
function clearMessages() {
  for (const node of document.querySelectorAll('.result, .error')) node.textContent = '';
  for (const node of document.querySelectorAll('[aria-invalid]')) node.removeAttribute('aria-invalid');
}

/** @param {string | null} text */
function showNotice(text) {
  const notice = el('notice');
  notice.textContent = text ?? '';
  notice.hidden = !text;
}

// ---------------------------------------------------------------------------
// State

/** @returns {Storage | null} */
function deviceStorage() {
  try {
    return window.localStorage;
  } catch {
    return null; // Some browsers throw just for looking when storage is turned off.
  }
}

const storage = deviceStorage();
const loaded = loadState(storage);
/** @type {State | null} */
let state = loaded.state;
/** True while the teen is changing an existing split. */
let editingSplit = false;
showNotice(loaded.warning);

/**
 * Replace the state, save it, and redraw.
 * @param {State} next
 */
function commit(next) {
  state = next;
  if (!saveState(storage, state)) showNotice(NO_STORAGE_WARNING);
  render();
}

// ---------------------------------------------------------------------------
// Split form (first run and "Change my split")

const splitInputs = {
  spend: inputEl('split-spend'),
  save: inputEl('split-save'),
  goals: inputEl('split-goals'),
};
const allSplitInputs = Object.values(splitInputs);

function splitValues() {
  return { spend: splitInputs.spend.value, save: splitInputs.save.value, goals: splitInputs.goals.value };
}

function updateSplitHint() {
  const values = splitValues();
  el('split-hint').textContent = splitTotalHint({
    spend: toPercent(values.spend),
    save: toPercent(values.save),
    goals: toPercent(values.goals),
  });
}

/** @param {Split} split */
function fillSplit(split) {
  splitInputs.spend.value = String(split.spend);
  splitInputs.save.value = String(split.save);
  splitInputs.goals.value = String(split.goals);
  clearError('split-error', allSplitInputs);
  updateSplitHint();
}

for (const input of allSplitInputs) {
  input.addEventListener('input', () => {
    clearError('split-error', allSplitInputs);
    updateSplitHint();
  });
}

el('split-preset').addEventListener('click', () => fillSplit(DEFAULT_SPLIT));

el('split-cancel').addEventListener('click', () => {
  editingSplit = false;
  render();
  el('change-split').focus();
});

el('change-split').addEventListener('click', () => {
  if (!state) return;
  editingSplit = true;
  fillSplit(state.split);
  render();
  splitInputs.spend.focus();
});

el('split-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const result = readSplitInputs(splitValues());
  if (!result.ok) {
    showError('split-error', result.error, allSplitInputs);
    return;
  }
  clearError('split-error', allSplitInputs);
  const firstRun = state === null;
  editingSplit = false;
  commit(state === null ? emptyState(result.split) : setSplit(state, result.split));
  if (firstRun) {
    inputEl('paycheck-amount').focus();
  } else {
    el('settings-result').textContent = 'Saved. Your new split will be used for paychecks you log from now on.';
    el('change-split').focus();
  }
});

// ---------------------------------------------------------------------------
// Paycheck form

const paycheckAmount = inputEl('paycheck-amount');
const paycheckDate = inputEl('paycheck-date');

/**
 * Put today's date in a date box, and stop the picker from offering future days.
 * @param {HTMLInputElement} input
 */
function resetDate(input) {
  const today = localISODate();
  input.value = today;
  input.max = today;
}

for (const input of [paycheckAmount, paycheckDate]) {
  input.addEventListener('input', () => clearError('paycheck-error', [paycheckAmount, paycheckDate]));
}

el('paycheck-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state) return;
  clearMessages();

  const amount = readAmount(paycheckAmount.value);
  if (!amount.ok) {
    showError('paycheck-error', amount.error, [paycheckAmount]);
    return;
  }
  const date = readPastDate(paycheckDate.value, localISODate());
  if (!date.ok) {
    showError('paycheck-error', date.error, [paycheckDate]);
    return;
  }

  const next = addPaycheck(state, { date: date.date, cents: amount.cents });
  const added = next.paychecks[next.paychecks.length - 1];
  commit(next);
  el('paycheck-result').textContent = `Nice. ${paycheckSentence(added.cents, paycheckParts(added))}`;
  paycheckAmount.value = '';
  resetDate(paycheckDate);
});

// ---------------------------------------------------------------------------
// Purchase form

const purchaseAmount = inputEl('purchase-amount');
const purchaseNote = inputEl('purchase-note');
const purchaseDate = inputEl('purchase-date');

for (const input of [purchaseAmount, purchaseNote, purchaseDate]) {
  input.addEventListener('input', () => clearError('purchase-error', [purchaseAmount, purchaseDate]));
}

el('purchase-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state) return;
  clearMessages();

  const amount = readAmount(purchaseAmount.value);
  if (!amount.ok) {
    showError('purchase-error', amount.error, [purchaseAmount]);
    return;
  }
  const date = readPastDate(purchaseDate.value, localISODate());
  if (!date.ok) {
    showError('purchase-error', date.error, [purchaseDate]);
    return;
  }

  let next;
  try {
    next = addPurchase(state, { date: date.date, cents: amount.cents, note: purchaseNote.value });
  } catch (error) {
    if (!(error instanceof OverspendError)) throw error;
    showError('purchase-error', overspendMessage(error.availableCents), [purchaseAmount]);
    return;
  }
  commit(next);
  el('purchase-result').textContent = purchaseSentence(amount.cents, balances(next).spend);
  purchaseAmount.value = '';
  purchaseNote.value = '';
  resetDate(purchaseDate);
});

// ---------------------------------------------------------------------------
// Recent activity, with Remove buttons to fix mistakes

const HISTORY_LIMIT = 20;

el('history').addEventListener('click', (event) => {
  const button = /** @type {HTMLElement} */ (event.target).closest('button[data-id]');
  if (!(button instanceof HTMLButtonElement) || !state) return;
  const { id, kind } = button.dataset;
  if (!id) return;
  clearMessages();
  if (!window.confirm(`${button.getAttribute('aria-label')}? You can't undo this.`)) return;

  try {
    commit(kind === 'paycheck' ? removePaycheck(state, id) : removePurchase(state, id));
  } catch (error) {
    if (!(error instanceof OverspendError)) throw error;
    el('history-error').textContent =
      "You can't remove this paycheck because you've already spent part of it. Remove some purchases first.";
    return;
  }
  el('history-result').textContent = kind === 'paycheck' ? 'Paycheck removed.' : 'Purchase removed. The money is back in Spend.';
  el('history-title').focus();
});

/** @param {State} current */
function renderHistory(current) {
  const { items, total } = recentActivity(current, HISTORY_LIMIT);
  const list = el('history');
  list.replaceChildren(...items.map((item) => {
    const isPaycheck = item.kind === 'paycheck';
    const what = isPaycheck ? 'Paycheck' : item.note || 'Purchase';
    const amount = `${isPaycheck ? '+' : '−'}${formatCents(item.cents)}`;

    const li = document.createElement('li');
    const text = document.createElement('span');
    text.className = 'history-text';
    const whatEl = document.createElement('span');
    whatEl.className = 'history-what';
    whatEl.textContent = what;
    const whenEl = document.createElement('span');
    whenEl.className = 'history-when';
    whenEl.textContent = shortDate(item.date);
    text.append(whatEl, whenEl);

    const amountEl = document.createElement('span');
    amountEl.className = isPaycheck ? 'history-amount in' : 'history-amount';
    amountEl.textContent = amount;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'small';
    remove.textContent = 'Remove';
    remove.dataset.id = item.id;
    remove.dataset.kind = item.kind;
    remove.setAttribute('aria-label',
      `Remove ${isPaycheck ? 'paycheck' : `purchase "${what}"`} of ${formatCents(item.cents)} from ${shortDate(item.date)}`);

    li.append(text, amountEl, remove);
    return li;
  }));
  el('history-empty').hidden = total > 0;
  const more = el('history-more');
  more.hidden = total <= HISTORY_LIMIT;
  more.textContent = `Showing the ${HISTORY_LIMIT} most recent of ${total}.`;
}

// ---------------------------------------------------------------------------
// Drawing

function render() {
  const choosingSplit = state === null || editingSplit;
  el('setup').hidden = !choosingSplit;
  el('main').hidden = choosingSplit;

  el('setup-title').textContent = state === null ? 'How should each paycheck be split?' : 'Change your split';
  el('setup-intro').textContent = state === null
    ? 'Pick how much of every paycheck goes into each bucket. You can change this later.'
    : 'This only changes paychecks you log from now on. The ones you already logged keep their split.';
  el('split-submit').textContent = state === null ? 'Start budgeting' : 'Save split';
  el('split-cancel').hidden = state === null;

  if (!state) return;
  const totals = balances(state);
  const { split } = state;
  el('balance-spend').textContent = formatCents(totals.spend);
  el('balance-save').textContent = formatCents(totals.save);
  el('balance-goals').textContent = formatCents(totals.goals);
  el('pct-spend').textContent = `${split.spend}% of each paycheck`;
  el('pct-save').textContent = `${split.save}% of each paycheck`;
  el('pct-goals').textContent = `${split.goals}% of each paycheck`;
  el('current-split').textContent = `${split.spend}% Spend, ${split.save}% Save, ${split.goals}% Goals`;
  el('purchase-available').textContent = totals.spend > 0
    ? `You have ${formatCents(totals.spend)} to spend.`
    : 'Your Spend bucket is empty. Log a paycheck first.';
  renderHistory(state);
}

fillSplit(state?.split ?? DEFAULT_SPLIT);
resetDate(paycheckDate);
resetDate(purchaseDate);
render();
