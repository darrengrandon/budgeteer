// Budgeteer page: connects the forms to the state and draws the numbers.
// Every piece of text goes in with textContent, never innerHTML, so typed or imported text can't run.

import {
  DEFAULT_SPLIT,
  NO_STORAGE_WARNING,
  DAMAGED_WARNING,
  STORAGE_KEY,
  emptyState,
  loadState,
  readSaved,
  saveChecked,
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
  exportBackup,
  importBackup,
  backupFileName,
  LIMITS,
} from './storage.js';
import { formatCents, centsToInput } from './money.js';
import { localISODate } from './budget.js';
import { projectGoals, whatIf } from './goals.js';
import {
  paycheckSentence,
  splitTotalHint,
  overspendMessage,
  purchaseSentence,
  shortDate,
  goalStatus,
  goalProgress,
  unassignedNote,
  whatIfLine,
  whatIfWeekly,
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

/**
 * Clear the error messages inside one form (each box has its own, right under it).
 * @param {HTMLElement} form
 */
function clearFormErrors(form) {
  for (const node of form.querySelectorAll('.error')) node.textContent = '';
  for (const node of form.querySelectorAll('[aria-invalid]')) node.removeAttribute('aria-invalid');
}

/** Clear every "done" and error message, so only the newest one is on screen. */
function clearMessages() {
  for (const node of document.querySelectorAll('.result, .error')) node.textContent = '';
  for (const node of document.querySelectorAll('[aria-invalid]')) node.removeAttribute('aria-invalid');
  el('split-hint').hidden = false;
}

/**
 * Show or hide the message at the top of the page.
 * @param {string | null} text
 * @param {boolean} [offerDownload] show "Download the unreadable data"
 */
function showNotice(text, offerDownload = false) {
  el('notice-text').textContent = text ?? '';
  el('notice-download').hidden = !offerDownload;
  el('notice').hidden = !text;
}

/**
 * Hand the teen a file to save.
 * @param {string} fileName
 * @param {string} text
 * @param {string} type
 */
function downloadText(fileName, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
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

const CHANGED_ELSEWHERE = 'Budgeteer was changed in another tab, so this page has been updated. Please try that again.';

const storage = deviceStorage();
/** The saved text as this tab last read or wrote it, to notice saves from other tabs. */
let lastSaved = readSaved(storage);
const loaded = loadState(storage);
/** @type {State | null} */
let state = loaded.state;
/** Saved text that couldn't be read, kept so the teen can download it and get help. */
const unreadable = loaded.warning === DAMAGED_WARNING && typeof lastSaved === 'string' ? lastSaved : null;
/** True while the teen is changing an existing split. */
let editingSplit = false;
showNotice(loaded.warning, unreadable !== null);

el('notice-download').addEventListener('click', () => {
  if (unreadable !== null) downloadText(`budgeteer-unreadable-${localISODate()}.txt`, unreadable, 'text/plain');
});

/**
 * Save the new state and redraw. Returns false, and changes nothing, if another tab saved
 * first (this tab then shows the other tab's data) or if the state would not load again.
 * @param {State} next
 * @returns {boolean}
 */
function commit(next) {
  const result = saveChecked(storage, next, lastSaved);
  if (result.status === 'changed') {
    reloadFromStorage();
    showNotice(CHANGED_ELSEWHERE);
    return false;
  }
  if (result.status === 'invalid') {
    showNotice(`Something went wrong, so that wasn't saved. ${result.error}`);
    return false;
  }
  state = next;
  if (result.status === 'saved') lastSaved = result.raw;
  else showNotice(NO_STORAGE_WARNING);
  render();
  return true;
}

/** Pick up what another tab saved. */
function reloadFromStorage() {
  lastSaved = readSaved(storage);
  const fresh = loadState(storage);
  // Adopt it if it loaded, or if the other tab cleared everything. Keep ours if it can't be read.
  if (fresh.state || fresh.warning === null) state = fresh.state;
  if (state && editingGoalId && !state.goals.some((g) => g.id === editingGoalId)) resetGoalForm();
  render();
}

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) reloadFromStorage();
});

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
    el('split-hint').hidden = false;
    updateSplitHint();
  });
}

el('split-preset').addEventListener('click', () => fillSplit(DEFAULT_SPLIT));

function cancelSplitChange() {
  editingSplit = false;
  render();
  el('change-split').focus();
}
el('split-cancel').addEventListener('click', cancelSplitChange);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && editingSplit) cancelSplitChange();
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
    el('split-hint').hidden = true; // the alert says the same thing; show it once
    showError('split-error', result.error, allSplitInputs);
    return;
  }
  clearError('split-error', allSplitInputs);
  const firstRun = state === null;
  if (!commit(state === null ? emptyState(result.split) : setSplit(state, result.split))) return;
  editingSplit = false;
  trialGoals = null;
  render();
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
  const now = new Date();
  input.value = localISODate(now);
  input.max = localISODate(now);
  input.min = localISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 730));
}

for (const input of [paycheckAmount, paycheckDate]) {
  input.addEventListener('input', () => clearFormErrors(el('paycheck-form')));
}

el('paycheck-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state) return;
  clearMessages();

  const amount = readAmount(paycheckAmount.value);
  if (!amount.ok) {
    showError('paycheck-amount-error', amount.error, [paycheckAmount]);
    return;
  }
  const date = readPastDate(paycheckDate.value, localISODate());
  if (!date.ok) {
    showError('paycheck-date-error', date.error, [paycheckDate]);
    return;
  }

  let next;
  try {
    next = addPaycheck(state, { date: date.date, cents: amount.cents });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    showError('paycheck-amount-error', error.message, [paycheckAmount]);
    return;
  }
  const added = next.paychecks[next.paychecks.length - 1];
  if (!commit(next)) return;
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
  input.addEventListener('input', () => clearFormErrors(el('purchase-form')));
}

el('purchase-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state) return;
  clearMessages();

  const amount = readAmount(purchaseAmount.value);
  if (!amount.ok) {
    showError('purchase-amount-error', amount.error, [purchaseAmount]);
    return;
  }
  const date = readPastDate(purchaseDate.value, localISODate());
  if (!date.ok) {
    showError('purchase-date-error', date.error, [purchaseDate]);
    return;
  }

  let next;
  try {
    next = addPurchase(state, { date: date.date, cents: amount.cents, note: purchaseNote.value });
  } catch (error) {
    if (error instanceof OverspendError) {
      showError('purchase-amount-error', overspendMessage(error.availableCents), [purchaseAmount]);
    } else if (error instanceof RangeError) {
      showError('purchase-note-error', error.message, [purchaseNote]);
    } else {
      throw error;
    }
    return;
  }
  if (!commit(next)) return;
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
  input.addEventListener('input', () => clearFormErrors(el('goal-form')));
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
    showError('goal-name-error', 'Give your goal a name, like "New phone".', [goalName]);
    return;
  }
  const target = readAmount(goalTarget.value);
  if (!target.ok) {
    showError('goal-target-error', target.error, [goalTarget]);
    return;
  }

  let next;
  try {
    next = editingGoalId
      ? updateGoal(state, editingGoalId, { name, targetCents: target.cents })
      : addGoal(state, { name, targetCents: target.cents });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    showError('goal-name-error', error.message, [goalName]);
    return;
  }
  const editedId = editingGoalId;
  if (!commit(next)) return;
  resetGoalForm();
  el('goal-list-result').textContent = editedId ? `Saved changes to "${name}".` : `Added "${name}".`;
  if (editedId) {
    const editButton = document.querySelector(`#goal-list button[data-id="${editedId}"][data-action="edit"]`);
    if (editButton instanceof HTMLElement) editButton.focus();
  }
});

el('goal-list').addEventListener('click', (event) => {
  const button = /** @type {HTMLElement} */ (event.target).closest('button[data-action]');
  if (!(button instanceof HTMLButtonElement) || !state) return;
  const { id, action } = button.dataset;
  const goal = state.goals.find((g) => g.id === id);
  if (!id || !goal) return;
  clearMessages();

  if (action === 'up' || action === 'down') {
    if (!commit(moveGoal(state, id, action === 'up' ? -1 : 1))) return;
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
    const below = state.goals[state.goals.indexOf(goal) + 1];
    const where = below ? `and goes to "${below.name}" next` : 'for future goals';
    if (!window.confirm(`Remove the goal "${goal.name}"? The money saved for it stays in your Goals bucket ${where}.`)) return;
    if (!commit(removeGoal(state, id))) return;
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
      hasPaychecks: projection.hasPaychecks,
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
// What if? A slider that tries a different Goals share. Nothing is saved until "Use this split".

const slider = inputEl('whatif-slider');
/** The trial Goals percent, or null when the slider sits on the real split. */
let trialGoals = /** @type {number | null} */ (null);

slider.addEventListener('input', () => {
  if (!state) return;
  clearMessages();
  trialGoals = Number(slider.value);
  renderWhatIf(state);
});

el('whatif-reset').addEventListener('click', () => {
  if (!state) return;
  clearMessages();
  trialGoals = null;
  renderWhatIf(state);
  slider.focus();
});

el('whatif-apply').addEventListener('click', () => {
  if (!state || trialGoals === null || trialGoals === state.split.goals) return;
  clearMessages();
  const { split } = whatIf(state, localISODate(), trialGoals);
  if (!commit(setSplit(state, split))) return;
  trialGoals = null;
  render();
  el('whatif-result').textContent =
    `Done. Paychecks you log from now on will be split ${split.spend}% Spend, ${split.save}% Save, ${split.goals}% Goals.`;
  slider.focus();
});

/** @param {State} current */
function renderWhatIf(current) {
  el('whatif').hidden = current.goals.length === 0;
  if (current.goals.length === 0) return;

  const shared = current.split.spend + current.split.goals;
  el('whatif-controls').hidden = shared === 0;
  el('whatif-locked').hidden = shared !== 0;
  if (shared === 0) return;

  if (trialGoals !== null && trialGoals > shared) trialGoals = null;
  const goalsPercent = trialGoals ?? current.split.goals;
  const result = whatIf(current, localISODate(), goalsPercent);
  const { split, trial } = result;

  slider.max = String(shared);
  slider.value = String(goalsPercent);
  const splitText = `Spend ${split.spend}% · Save ${split.save}% · Goals ${split.goals}%`;
  el('whatif-split').textContent = splitText;
  slider.setAttribute('aria-valuetext', `Goals ${split.goals}%, Spend ${split.spend}%`);
  el('whatif-weekly').textContent = whatIfWeekly(trial);

  el('whatif-goals').replaceChildren(...trial.goals.map((g, i) => {
    const li = document.createElement('li');
    li.textContent = whatIfLine({
      name: g.goal.name,
      done: g.savedCents >= g.goal.targetCents,
      trialWeeks: g.weeks,
      currentWeeks: result.current.goals[i].weeks,
      averageWeeklyCents: trial.averageWeeklyCents,
      trialGoalsPercent: split.goals,
      hasPaychecks: trial.hasPaychecks,
    });
    return li;
  }));

  const changed = goalsPercent !== current.split.goals;
  /** @type {HTMLButtonElement} */ (el('whatif-apply')).disabled = !changed;
  /** @type {HTMLButtonElement} */ (el('whatif-reset')).disabled = !changed;
}

// ---------------------------------------------------------------------------
// Backup: download the records as a file, or restore them from one.
// A restored file is untrusted: importBackup checks every field before anything changes.

const backupFile = inputEl('backup-file');

el('backup-download').addEventListener('click', () => {
  if (!state) return;
  clearMessages();
  downloadText(backupFileName(localISODate()), exportBackup(state), 'application/json');
  el('backup-result').textContent = 'Backup downloaded. Keep the file somewhere safe.';
});

function chooseBackupFile() {
  clearMessages();
  backupFile.value = '';
  backupFile.click();
}
el('backup-restore').addEventListener('click', chooseBackupFile);
el('setup-restore-button').addEventListener('click', chooseBackupFile);

backupFile.addEventListener('change', async () => {
  const file = backupFile.files?.[0];
  if (!file) return;
  const errorId = state === null || editingSplit ? 'setup-restore-error' : 'backup-error';
  const fail = (/** @type {string} */ reason) => {
    el(errorId).textContent = `That file couldn't be restored, so nothing was changed. ${reason}`;
  };

  if (file.size > LIMITS.maxBackupChars) {
    fail('It is too big to be a Budgeteer backup.');
    return;
  }
  let text;
  try {
    text = await file.text();
  } catch {
    fail("The file couldn't be read.");
    return;
  }
  const result = importBackup(text, localISODate());
  if (!result.ok) {
    fail(result.error);
    return;
  }
  if (state && !window.confirm('Restoring replaces everything in Budgeteer right now with what is in the backup. Go ahead?')) {
    return;
  }

  const restored = result.state;
  if (!commit(restored)) return;
  editingSplit = false;
  trialGoals = null;
  resetGoalForm();
  render();
  const count = (/** @type {number} */ n, /** @type {string} */ word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  el('backup-result').textContent = `Backup restored: ${count(restored.paychecks.length, 'paycheck')}, `
    + `${count(restored.purchases.length, 'purchase')} and ${count(restored.goals.length, 'goal')}.`;
  el('backup-title').focus();
});

// ---------------------------------------------------------------------------
// Recent activity, with Remove buttons to fix mistakes

const HISTORY_LIMIT = 20;
/** True after "Show all" is pressed. */
let showAllHistory = false;

el('history-toggle').addEventListener('click', () => {
  showAllHistory = !showAllHistory;
  if (state) renderHistory(state);
});

el('history').addEventListener('click', (event) => {
  const button = /** @type {HTMLElement} */ (event.target).closest('button[data-id]');
  if (!(button instanceof HTMLButtonElement) || !state) return;
  const { id, kind } = button.dataset;
  if (!id) return;
  clearMessages();
  if (!window.confirm(`${button.getAttribute('aria-label')}? You can't undo this.`)) return;

  let next;
  try {
    next = kind === 'paycheck' ? removePaycheck(state, id) : removePurchase(state, id);
  } catch (error) {
    if (!(error instanceof OverspendError)) throw error;
    el('history-error').textContent =
      "You can't remove this paycheck because you've already spent part of it. Remove some purchases first.";
    return;
  }
  if (!commit(next)) return;
  el('history-result').textContent = kind === 'paycheck' ? 'Paycheck removed.' : 'Purchase removed. The money is back in Spend.';
  el('history-title').focus();
});

/** @param {State} current */
function renderHistory(current) {
  const { items, total } = recentActivity(current, showAllHistory ? Infinity : HISTORY_LIMIT);
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
  el('history-more').hidden = total <= HISTORY_LIMIT;
  el('history-more-text').textContent = showAllHistory
    ? `Showing all ${total}.`
    : `Showing the ${HISTORY_LIMIT} most recent of ${total}.`;
  el('history-toggle').textContent = showAllHistory ? 'Show fewer' : `Show all ${total}`;
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
  el('setup-restore').hidden = state !== null;

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
  renderWhatIf(state);
  renderHistory(state);
}

fillSplit(state?.split ?? DEFAULT_SPLIT);
resetDate(paycheckDate);
resetDate(purchaseDate);
render();
