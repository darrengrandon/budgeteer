// Budgeteer page: connects the forms to the state and draws the numbers.
// Every piece of text goes in with textContent, never innerHTML, so typed or imported text can't run.

import {
  DEFAULT_SPLIT,
  NO_STORAGE_WARNING,
  emptyState,
  loadState,
  saveState,
  addPaycheck,
  setSplit,
  balances,
  paycheckParts,
} from './storage.js';
import { formatCents } from './money.js';
import { localISODate } from './budget.js';
import { paycheckSentence, splitTotalHint } from './words.js';
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

function resetPaycheckDate() {
  const today = localISODate();
  paycheckDate.value = today;
  paycheckDate.max = today;
}

for (const input of [paycheckAmount, paycheckDate]) {
  input.addEventListener('input', () => clearError('paycheck-error', [paycheckAmount, paycheckDate]));
}

el('paycheck-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state) return;
  el('paycheck-result').textContent = '';
  clearError('paycheck-error', [paycheckAmount, paycheckDate]);

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
  resetPaycheckDate();
});

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
}

fillSplit(state?.split ?? DEFAULT_SPLIT);
resetPaycheckDate();
render();
