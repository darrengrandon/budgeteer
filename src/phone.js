// Budgeteer phone app: first run, Home and the sheets. Built beside the old page (docs/adr/0006).
// Every piece of text goes in with textContent, never innerHTML, so typed or imported text can't run.

import {
  NO_STORAGE_WARNING,
  DAMAGED_WARNING,
  STORAGE_KEY,
  newState,
  upgradeState,
  loadState,
  readSaved,
  saveChecked,
  addPaycheck,
  addGoal,
  updateGoal,
  removeGoal,
  moveGoal,
  removePaycheck,
  paycheckParts,
} from './storage.js';
import { buyGoal } from './goals.js';
import { centsToInput, formatCents } from './money.js';
import { localISODate } from './budget.js';
import { homePlan } from './plan.js';
import { paycheckSentence, goalTimeline, buySentence } from './words.js';
import { readAmount } from './forms.js';

/** @typedef {import('./storage.js').State} State */

// ---------------------------------------------------------------------------
// DOM helpers

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Budgeteer page is missing #${id}`);
  return node;
}

/** @param {string} id */
const inputEl = (id) => /** @type {HTMLInputElement} */ (el(id));
/** @param {string} id */
const dialogEl = (id) => /** @type {HTMLDialogElement} */ (el(id));

/**
 * Show an error under a box and put the cursor there.
 * @param {string} errorId
 * @param {string} message
 * @param {HTMLInputElement} input
 */
function showError(errorId, message, input) {
  el(errorId).textContent = message;
  input.setAttribute('aria-invalid', 'true');
  input.focus();
}

/** @param {ParentNode} root */
function clearErrors(root) {
  for (const node of root.querySelectorAll('.error')) node.textContent = '';
  for (const node of root.querySelectorAll('[aria-invalid]')) node.removeAttribute('aria-invalid');
}

/** @param {string | null} text */
function showNotice(text) {
  el('notice').textContent = text ?? '';
  el('notice').hidden = !text;
}

/**
 * Open a sheet. Clicking the dimmed area above it closes it.
 * @param {HTMLDialogElement} sheet
 */
function openSheet(sheet) {
  if (!sheet.open) sheet.showModal();
}

for (const sheet of document.querySelectorAll('dialog.sheet')) {
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) /** @type {HTMLDialogElement} */ (sheet).close();
  });
}

// ---------------------------------------------------------------------------
// State, saving, and other tabs

const CHANGED_ELSEWHERE = 'Budgeteer was changed in another tab, so this page has been updated. Please try that again.';

/** @returns {Storage | null} */
function deviceStorage() {
  try {
    return window.localStorage;
  } catch {
    return null; // Some browsers throw just for looking when storage is turned off.
  }
}

const storage = deviceStorage();
/** The saved text as this tab last read or wrote it, to notice saves from other tabs. */
let lastSaved = readSaved(storage);
const loaded = loadState(storage);
/** @type {State | null} */
let state = loaded.state ? upgradeState(loaded.state) : null;
showNotice(loaded.warning === DAMAGED_WARNING || loaded.warning === NO_STORAGE_WARNING ? loaded.warning : null);

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
  if (fresh.state || fresh.warning === null) state = fresh.state ? upgradeState(fresh.state) : null;
  render();
}

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) reloadFromStorage();
});

// ---------------------------------------------------------------------------
// First run: "What are you saving for?" (or skip), then the paycheck sheet.

const welcomeName = inputEl('welcome-name');
const welcomePrice = inputEl('welcome-price');

for (const input of [welcomeName, welcomePrice]) {
  input.addEventListener('input', () => clearErrors(el('welcome-form')));
}

/** @param {State} first */
function startWith(first) {
  if (!commit(first)) return;
  openPaySheet(true);
}

el('welcome-form').addEventListener('submit', (event) => {
  event.preventDefault();
  clearErrors(el('welcome-form'));
  const name = welcomeName.value.trim();
  if (name === '' && welcomePrice.value.trim() === '') {
    startWith(newState());
    return;
  }
  if (name === '') {
    showError('welcome-name-error', 'Give your goal a name, like "New phone".', welcomeName);
    return;
  }
  const price = readAmount(welcomePrice.value);
  if (!price.ok) {
    showError('welcome-price-error', price.error, welcomePrice);
    return;
  }
  let first;
  try {
    first = addGoal(newState(), { name, targetCents: price.cents });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    showError('welcome-name-error', error.message, welcomeName);
    return;
  }
  startWith(first);
});

el('welcome-skip').addEventListener('click', () => startWith(newState()));

// ---------------------------------------------------------------------------
// The paycheck sheet

const paySheet = dialogEl('pay-sheet');
const payAmount = inputEl('pay-amount');
/** The id of the paycheck just added, for Undo. */
let justAddedId = /** @type {string | null} */ (null);

payAmount.addEventListener('input', () => clearErrors(paySheet));

/**
 * @param {boolean} [firstTime] the first-run wording: "How much was your paycheck?"
 */
function openPaySheet(firstTime = false) {
  if (!state) return;
  clearErrors(paySheet);
  el('home-status').textContent = '';
  justAddedId = null;
  payAmount.value = '';
  el('pay-title').textContent = firstTime ? 'How much was your paycheck?' : 'How much did you get paid?';
  el('pay-title').classList.remove('visually-hidden');
  el('pay-cancel').textContent = firstTime ? 'Not paid yet' : 'Cancel';
  el('pay-entry').hidden = false;
  el('pay-done').hidden = true;

  const last = state.paychecks[state.paychecks.length - 1];
  const same = el('pay-same');
  same.hidden = !last;
  if (last) {
    same.textContent = `Same as last time (${formatCents(last.cents)})`;
    same.dataset.amount = centsToInput(last.cents);
  }
  openSheet(paySheet);
  payAmount.focus();
}

el('got-paid').addEventListener('click', () => openPaySheet());
el('nudge').addEventListener('click', () => openPaySheet());
el('pay-cancel').addEventListener('click', () => paySheet.close());
el('pay-close').addEventListener('click', () => paySheet.close());

el('pay-same').addEventListener('click', () => {
  payAmount.value = el('pay-same').dataset.amount ?? '';
  clearErrors(paySheet);
  payAmount.focus();
});

el('pay-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state) return;
  clearErrors(paySheet);
  const amount = readAmount(payAmount.value);
  if (!amount.ok) {
    showError('pay-amount-error', amount.error, payAmount);
    return;
  }
  let next;
  try {
    next = addPaycheck(state, { date: localISODate(), cents: amount.cents });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    showError('pay-amount-error', error.message, payAmount);
    return;
  }
  const added = next.paychecks[next.paychecks.length - 1];
  if (!commit(next)) {
    paySheet.close();
    return;
  }
  justAddedId = added.id;
  showPayResult(added);
});

/**
 * Where the money went, and each goal's new timeline.
 * @param {import('./storage.js').Paycheck} added
 */
function showPayResult(added) {
  if (!state) return;
  el('pay-sentence').textContent = `Nice. ${paycheckSentence(added.cents, paycheckParts(added))}`;
  const today = localISODate();
  const plan = homePlan(state, today);
  el('pay-timeline').replaceChildren(...plan.goals.map((g) => {
    const li = document.createElement('li');
    li.textContent = goalTimeline({
      name: g.name, savedCents: g.savedCents, targetCents: g.targetCents, weeks: g.weeks,
      hasPay: true, goalsPercent: state?.split.goals ?? 0, todayISO: today,
    });
    return li;
  }));
  el('pay-entry').hidden = true;
  el('pay-done').hidden = false;
  el('pay-title').classList.add('visually-hidden'); // the question is answered; it still names the sheet
  el('pay-close').focus();
}

el('pay-undo').addEventListener('click', () => {
  if (!state || !justAddedId) return;
  let next;
  try {
    next = removePaycheck(state, justAddedId);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    el('pay-undo-error').textContent = "That paycheck can't be taken back now, because its money was already used.";
    return;
  }
  if (!commit(next)) return;
  justAddedId = null;
  paySheet.close();
  el('home-status').textContent = 'Paycheck removed.';
});

// ---------------------------------------------------------------------------
// Goals: add, edit, move up, remove (the goal sheet), and Buy it (the buy sheet)

const goalSheet = dialogEl('goal-sheet');
const goalName = inputEl('goal-name');
const goalPrice = inputEl('goal-price');
const buySheet = dialogEl('buy-sheet');
const buyPrice = inputEl('buy-price');
/** The goal the open sheet is about (null: adding a new goal). */
let sheetGoalId = /** @type {string | null} */ (null);

for (const input of [goalName, goalPrice]) input.addEventListener('input', () => clearErrors(goalSheet));
buyPrice.addEventListener('input', () => clearErrors(buySheet));

/**
 * Put focus back on a goal's Options button after its sheet closes.
 * @param {string} id
 */
function focusGoal(id) {
  const button = document.querySelector(`#goal-cards button[data-action="options"][data-id="${id}"]`);
  if (button instanceof HTMLElement) button.focus();
}

/** @param {string | null} id null to add a new goal */
function openGoalSheet(id) {
  if (!state) return;
  const goal = id ? state.goals.find((g) => g.id === id) : undefined;
  sheetGoalId = goal ? goal.id : null;
  clearErrors(goalSheet);
  el('home-status').textContent = '';
  goalName.value = goal ? goal.name : '';
  goalPrice.value = goal ? centsToInput(goal.targetCents) : '';
  el('goal-title').textContent = goal ? `Edit "${goal.name}"` : 'Add a goal';
  el('goal-more').hidden = !goal;
  el('goal-up').hidden = !goal || state.goals[0].id === goal.id;
  openSheet(goalSheet);
  goalName.focus();
}

el('add-goal').addEventListener('click', () => openGoalSheet(null));
el('goal-cancel').addEventListener('click', () => goalSheet.close());

el('goal-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state) return;
  clearErrors(goalSheet);
  const name = goalName.value.trim();
  if (name === '') {
    showError('goal-name-error', 'Give your goal a name, like "New phone".', goalName);
    return;
  }
  const price = readAmount(goalPrice.value);
  if (!price.ok) {
    showError('goal-price-error', price.error, goalPrice);
    return;
  }
  let next;
  try {
    next = sheetGoalId
      ? updateGoal(state, sheetGoalId, { name, targetCents: price.cents })
      : addGoal(state, { name, targetCents: price.cents });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    showError('goal-name-error', error.message, goalName);
    return;
  }
  const editedId = sheetGoalId;
  const savedName = editedId ? next.goals.find((g) => g.id === editedId)?.name : next.goals[next.goals.length - 1].name;
  goalSheet.close();
  if (!commit(next)) return;
  el('home-status').textContent = editedId ? `Saved "${savedName}".` : `Added "${savedName}".`;
  focusGoal(editedId ?? next.goals[next.goals.length - 1].id);
});

el('goal-up').addEventListener('click', () => {
  if (!state || !sheetGoalId) return;
  const id = sheetGoalId;
  const goal = state.goals.find((g) => g.id === id);
  goalSheet.close();
  if (!goal || !commit(moveGoal(state, id, -1))) return;
  el('home-status').textContent = `Moved "${goal.name}" up.`;
  focusGoal(id);
});

el('goal-remove').addEventListener('click', () => {
  if (!state || !sheetGoalId) return;
  const id = sheetGoalId;
  const index = state.goals.findIndex((g) => g.id === id);
  const goal = state.goals[index];
  const below = state.goals[index + 1];
  const where = below ? `and goes to "${below.name}" next` : 'for future goals';
  if (!window.confirm(`Remove "${goal.name}"? The money saved for it stays in Goals ${where}.`)) return;
  goalSheet.close();
  if (!commit(removeGoal(state, id))) return;
  el('home-status').textContent = `Removed "${goal.name}". Its money stays in Goals.`;
});

/** @param {string} id */
function openBuySheet(id) {
  const goal = state?.goals.find((g) => g.id === id);
  if (!goal) return;
  sheetGoalId = id;
  clearErrors(buySheet);
  el('home-status').textContent = '';
  el('buy-title').textContent = `Did you buy ${goal.name}?`;
  buyPrice.value = centsToInput(goal.targetCents);
  openSheet(buySheet);
  buyPrice.focus();
}

el('buy-cancel').addEventListener('click', () => buySheet.close());

el('buy-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state || !sheetGoalId) return;
  clearErrors(buySheet);
  const price = readAmount(buyPrice.value);
  if (!price.ok) {
    showError('buy-price-error', price.error, buyPrice);
    return;
  }
  let next;
  try {
    next = buyGoal(state, sheetGoalId, { cents: price.cents, date: localISODate() });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    showError('buy-price-error', error.message, buyPrice);
    return;
  }
  const record = next.goalPurchases?.[next.goalPurchases.length - 1];
  buySheet.close();
  if (!record || !commit(next)) return;
  el('home-status').textContent = buySentence(record.cents, record.name, price.cents);
  el('headline').focus();
});

el('goal-cards').addEventListener('click', (event) => {
  const button = /** @type {HTMLElement} */ (event.target).closest('button[data-action]');
  if (!(button instanceof HTMLButtonElement) || !button.dataset.id) return;
  if (button.dataset.action === 'options') openGoalSheet(button.dataset.id);
  if (button.dataset.action === 'buy') openBuySheet(button.dataset.id);
});

// ---------------------------------------------------------------------------
// Drawing

/**
 * One goal card. The top goal is big.
 * @param {import('./plan.js').GoalCard} goal
 * @param {boolean} top
 * @returns {HTMLLIElement}
 */
function goalCard(goal, top) {
  const li = document.createElement('li');
  li.className = ['goal-card', top ? 'top' : '', goal.funded ? 'funded' : ''].filter(Boolean).join(' ');

  const head = document.createElement('div');
  head.className = 'goal-head';
  const name = document.createElement('h3');
  name.className = 'goal-name';
  name.textContent = goal.name;
  const options = document.createElement('button');
  options.type = 'button';
  options.className = 'icon-button';
  options.textContent = '⋯';
  options.dataset.action = 'options';
  options.dataset.id = goal.id;
  options.setAttribute('aria-label', `Options for ${goal.name}`);
  head.append(name, options);

  const amounts = document.createElement('p');
  amounts.className = 'goal-amounts';
  amounts.textContent = goal.amounts;

  const bar = document.createElement('progress');
  bar.max = goal.targetCents;
  bar.value = goal.savedCents;
  bar.setAttribute('aria-label', `${goal.name}: ${goal.amounts}`);

  const ready = document.createElement('p');
  ready.className = 'goal-ready';
  ready.textContent = goal.line;

  li.append(head, amounts, bar, ready);
  if (goal.funded) {
    const buy = document.createElement('button');
    buy.type = 'button';
    buy.className = 'primary buy';
    buy.textContent = 'Buy it';
    buy.dataset.action = 'buy';
    buy.dataset.id = goal.id;
    buy.setAttribute('aria-label', `Buy it: ${goal.name}`);
    li.append(buy);
  }
  return li;
}

function render() {
  const firstRun = state === null;
  el('welcome').hidden = !firstRun;
  el('home').hidden = firstRun;
  el('paybar').hidden = firstRun;
  if (!state) return;

  const plan = homePlan(state, localISODate());
  el('nudge').hidden = !plan.nudge;
  el('headline').textContent = plan.headline;
  el('basis').textContent = plan.basis;
  el('basis').hidden = plan.basis === '';
  el('goal-cards').replaceChildren(...plan.goals.map((goal, i) => goalCard(goal, i === 0)));
  el('goals-empty').hidden = plan.goals.length > 0;
}

render();
if (state === null) welcomeName.focus();
