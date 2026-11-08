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
  addGoal,
  updateGoal,
  removeGoal,
  moveGoal,
  setSplit,
  balances,
  paycheckParts,
} from './storage.js';
import { formatCents, centsToInput } from './money.js';
import { localISODate } from './budget.js';
import { projectGoals } from './goals.js';
import {
  paycheckSentence,
  splitTotalHint,
  overspendMessage,
  purchaseSentence,
  shortDate,
  goalStatus,
  goalProgress,
  unassignedNote,
} from './words.js';
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
// Goals: add, edit, remove, reorder

const goalName = inputEl('goal-name');
const goalTarget = inputEl('goal-target');
/** The id of the goal being edited, or null when the form adds a new goal. */
let editingGoalId = /** @type {string | null} */ (null);

for (const input of [goalName, goalTarget]) {
  input.addEventListener('input', () => clearError('goal-error', [goalName, goalTarget]));
}

/** Put the goal form back to "Add a goal". */
function resetGoalForm() {
  editingGoalId = null;
  goalName.value = '';
  goalTarget.value = '';
  el('goal-form-title').textContent = 'Add a goal';
  el('goal-submit').textContent = 'Add goal';
  el('goal-cancel').hidden = true;
}

el('goal-cancel').addEventListener('click', () => {
  clearMessages();
  resetGoalForm();
  el('goals-title').focus();
});

el('goal-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state) return;
  clearMessages();

  const name = goalName.value.trim();
  if (name === '') {
    showError('goal-error', 'Give your goal a name, like "New phone".', [goalName]);
    return;
  }
  const target = readAmount(goalTarget.value);
  if (!target.ok) {
    showError('goal-error', target.error, [goalTarget]);
    return;
  }

  let next;
  try {
    next = editingGoalId
      ? updateGoal(state, editingGoalId, { name, targetCents: target.cents })
      : addGoal(state, { name, targetCents: target.cents });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    showError('goal-error', error.message, [goalName]);
    return;
  }
  const wasEditing = editingGoalId !== null;
  commit(next);
  resetGoalForm();
  el('goal-list-result').textContent = wasEditing ? `Saved changes to "${name}".` : `Added "${name}".`;
});

el('goal-list').addEventListener('click', (event) => {
  const button = /** @type {HTMLElement} */ (event.target).closest('button[data-action]');
  if (!(button instanceof HTMLButtonElement) || !state) return;
  const { id, action } = button.dataset;
  const goal = state.goals.find((g) => g.id === id);
  if (!id || !goal) return;
  clearMessages();

  if (action === 'up' || action === 'down') {
    commit(moveGoal(state, id, action === 'up' ? -1 : 1));
    // Keep focus on the goal that moved, so pressing the button again keeps moving it.
    const same = document.querySelector(`#goal-list button[data-id="${id}"][data-action="${action}"]`);
    const other = document.querySelector(`#goal-list button[data-id="${id}"][data-action="${action === 'up' ? 'down' : 'up'}"]`);
    const target = same instanceof HTMLButtonElement && !same.disabled ? same : other;
    if (target instanceof HTMLElement) target.focus();
  } else if (action === 'edit') {
    editingGoalId = id;
    goalName.value = goal.name;
    goalTarget.value = centsToInput(goal.targetCents);
    el('goal-form-title').textContent = `Edit "${goal.name}"`;
    el('goal-submit').textContent = 'Save changes';
    el('goal-cancel').hidden = false;
    goalName.focus();
  } else if (action === 'remove') {
    if (!window.confirm(`Remove the goal "${goal.name}"? The money saved for it stays in your Goals bucket.`)) return;
    commit(removeGoal(state, id));
    if (editingGoalId === id) resetGoalForm();
    el('goal-list-result').textContent = `Removed "${goal.name}". Its money stays in your Goals bucket for your other goals.`;
    el('goals-title').focus();
  }
});

/**
 * @param {string} label
 * @param {string} action
 * @param {string} id
 * @param {string} ariaLabel
 * @returns {HTMLButtonElement}
 */
function goalButton(label, action, id, ariaLabel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = action === 'remove' ? 'small danger' : 'small';
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = id;
  button.setAttribute('aria-label', ariaLabel);
  return button;
}

/** @param {State} current */
function renderGoals(current) {
  const projection = projectGoals(current, localISODate());
  const count = current.goals.length;

  el('goal-list').replaceChildren(...projection.goals.map(({ goal, savedCents, weeks }, index) => {
    const done = savedCents >= goal.targetCents;
    const li = document.createElement('li');
    li.className = done ? 'goal done' : 'goal';

    const head = document.createElement('div');
    head.className = 'goal-head';
    const name = document.createElement('h3');
    name.className = 'goal-name';
    name.textContent = goal.name;
    const progressText = document.createElement('span');
    progressText.className = 'goal-progress-text';
    progressText.textContent = goalProgress(savedCents, goal.targetCents);
    head.append(name, progressText);

    const bar = document.createElement('progress');
    bar.max = goal.targetCents;
    bar.value = savedCents;
    bar.setAttribute('aria-label', `${goal.name}: ${goalProgress(savedCents, goal.targetCents)}`);

    const status = document.createElement('p');
    status.className = 'goal-status';
    status.textContent = goalStatus({
      savedCents,
      targetCents: goal.targetCents,
      weeks,
      averageWeeklyCents: projection.averageWeeklyCents,
      goalsPercent: projection.goalsPercent,
    });

    const actions = document.createElement('div');
    actions.className = 'actions goal-actions';
    if (count > 1) {
      const up = goalButton('↑ Up', 'up', goal.id, `Move ${goal.name} up`);
      up.disabled = index === 0;
      const down = goalButton('↓ Down', 'down', goal.id, `Move ${goal.name} down`);
      down.disabled = index === count - 1;
      actions.append(up, down);
    }
    actions.append(
      goalButton('Edit', 'edit', goal.id, `Edit ${goal.name}`),
      goalButton('Remove', 'remove', goal.id, `Remove ${goal.name}`),
    );

    li.append(head, bar, status, actions);
    return li;
  }));

  el('goals-empty').hidden = count > 0;
  el('goals-basis').hidden = count === 0;
  const note = unassignedNote(projection.unassignedCents, count > 0);
  el('goals-unassigned').textContent = note;
  el('goals-unassigned').hidden = note === '';
}

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
  renderGoals(state);
  renderHistory(state);
}

fillSplit(state?.split ?? DEFAULT_SPLIT);
resetDate(paycheckDate);
resetDate(purchaseDate);
render();
