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
  addPurchase,
  setTrackSpending,
  removePaycheck,
  removePurchase,
  removeGoalPurchase,
  OverspendError,
  GoalMoneyUsedError,
  paycheckParts,
  setSplit,
  balances,
  recentActivity,
  exportBackup,
  importBackup,
  backupFileName,
  LIMITS,
} from './storage.js';
import { buyGoal } from './goals.js';
import { centsToInput, formatCents } from './money.js';
import { localISODate } from './budget.js';
import { homePlan } from './plan.js';
import {
  paycheckSentence,
  goalTimeline,
  buySentence,
  splitTotalHint,
  shortDate,
  leftToSpend,
  purchaseSentence,
  overspendMessage,
  spendAvailable,
} from './words.js';
import { readAmount, readSplitInputs, toPercent } from './forms.js';

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

/**
 * The message at the top of the page.
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

/**
 * "1 paycheck", "2 goal buys"
 * @param {number} n
 * @param {string} word
 */
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

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
/** Saved text that couldn't be read, kept so the teen can download it and get help. */
const unreadable = loaded.warning === DAMAGED_WARNING && typeof lastSaved === 'string' ? lastSaved : null;
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
// Settings: split (with a live preview), your money, history, backup, install help

const settingsSheet = dialogEl('settings-sheet');
const splitInputs = { spend: inputEl('split-spend'), save: inputEl('split-save'), goals: inputEl('split-goals') };
const HISTORY_LIMIT = 20;
let showAllHistory = false;

const splitValues = () => ({ spend: splitInputs.spend.value, save: splitInputs.save.value, goals: splitInputs.goals.value });

/** Clear every message inside Settings, so only the newest one shows. */
function clearSettingsMessages() {
  for (const node of settingsSheet.querySelectorAll('.result')) node.textContent = '';
  clearErrors(settingsSheet);
  el('split-hint').hidden = false;
}

function openSettings() {
  if (!state) return;
  clearSettingsMessages();
  splitInputs.spend.value = String(state.split.spend);
  splitInputs.save.value = String(state.split.save);
  splitInputs.goals.value = String(state.split.goals);
  showAllHistory = false;
  renderSettings();
  openSheet(settingsSheet);
  el('settings-done').focus();
}

el('open-settings').addEventListener('click', openSettings);
el('settings-done').addEventListener('click', () => settingsSheet.close());

/** The split hint and, when the split is valid, what it would mean. */
function renderSplitPreview() {
  if (!state) return;
  const values = splitValues();
  el('split-hint').textContent = splitTotalHint({
    spend: toPercent(values.spend), save: toPercent(values.save), goals: toPercent(values.goals),
  });
  const result = readSplitInputs(values);
  el('split-preview-box').hidden = !result.ok;
  if (!result.ok) return;
  const today = localISODate();
  const plan = homePlan(state, today, result.split);
  const lines = [plan.headline, ...plan.goals.map((g) => goalTimeline({
    name: g.name, savedCents: g.savedCents, targetCents: g.targetCents, weeks: g.weeks,
    hasPay: plan.basis !== '', goalsPercent: result.split.goals, todayISO: today,
  }))];
  el('split-preview').replaceChildren(...lines.map((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    return li;
  }));
}

for (const input of Object.values(splitInputs)) {
  input.addEventListener('input', () => {
    clearErrors(el('split-form'));
    el('split-hint').hidden = false;
    renderSplitPreview();
  });
}

el('split-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state) return;
  clearSettingsMessages();
  const result = readSplitInputs(splitValues());
  if (!result.ok) {
    el('split-hint').hidden = true; // the alert says the same thing; show it once
    showError('split-error', result.error, splitInputs.spend);
    return;
  }
  if (!commit(setSplit(state, result.split))) return;
  const { spend, save, goals } = result.split;
  el('split-result').textContent =
    `Saved. Paychecks you log from now on will be split ${spend}% Spend, ${save}% Save, ${goals}% Goals.`;
});

function renderMoney() {
  if (!state) return;
  const totals = balances(state);
  el('money').replaceChildren(...[['Spend', totals.spend], ['Save', totals.save], ['Goals', totals.goals]].map(([name, cents]) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = String(name);
    const amount = document.createElement('span');
    amount.textContent = formatCents(Number(cents));
    li.append(label, amount);
    return li;
  }));
}

/**
 * What a History row says, and its Remove button's name.
 * @param {import('./storage.js').ActivityItem} item
 */
function historyWords(item) {
  const when = shortDate(item.date);
  const money = formatCents(item.cents);
  if (item.kind === 'paycheck') {
    return { what: 'Paycheck', amount: `+${money}`, label: `Remove paycheck of ${money} from ${when}`, button: 'Remove' };
  }
  if (item.kind === 'purchase') {
    const what = item.note || 'Purchase';
    return { what, amount: `−${money}`, label: `Remove purchase "${what}" of ${money} from ${when}`, button: 'Remove' };
  }
  return { what: `Bought: ${item.name}`, amount: `−${money}`, label: `Undo buying ${item.name} (${money}) from ${when}`, button: 'Undo' };
}

function renderHistory() {
  if (!state) return;
  const { items, total } = recentActivity(state, showAllHistory ? Infinity : HISTORY_LIMIT);
  el('history').replaceChildren(...items.map((item) => {
    const words = historyWords(item);
    const li = document.createElement('li');
    const text = document.createElement('span');
    text.className = 'history-text';
    const what = document.createElement('span');
    what.className = 'history-what';
    what.textContent = words.what;
    const when = document.createElement('span');
    when.className = 'history-when';
    when.textContent = shortDate(item.date);
    text.append(what, when);
    const amount = document.createElement('span');
    amount.className = item.kind === 'paycheck' ? 'history-amount in' : 'history-amount';
    amount.textContent = words.amount;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = words.button;
    button.dataset.id = item.id;
    button.dataset.kind = item.kind;
    button.setAttribute('aria-label', words.label);
    li.append(text, amount, button);
    return li;
  }));
  el('history-empty').hidden = total > 0;
  const toggle = el('history-toggle');
  toggle.hidden = total <= HISTORY_LIMIT;
  toggle.textContent = showAllHistory ? 'Show fewer' : `Show all ${total}`;
}

el('history-toggle').addEventListener('click', () => {
  showAllHistory = !showAllHistory;
  renderHistory();
});

el('history').addEventListener('click', (event) => {
  const button = /** @type {HTMLElement} */ (event.target).closest('button[data-id]');
  if (!(button instanceof HTMLButtonElement) || !state) return;
  const { id, kind } = button.dataset;
  if (!id) return;
  clearSettingsMessages();

  // Check first, so the teen is never asked to confirm something that then gets refused.
  let next;
  try {
    if (kind === 'paycheck') next = removePaycheck(state, id);
    else if (kind === 'purchase') next = removePurchase(state, id);
    else next = removeGoalPurchase(state, id);
  } catch (error) {
    if (error instanceof OverspendError) {
      el('history-error').textContent =
        "You can't remove this paycheck because you've already spent part of it. Remove some purchases first.";
      return;
    }
    if (error instanceof GoalMoneyUsedError) {
      el('history-error').textContent =
        "You can't remove this paycheck, because its goal money already paid for something you bought. Undo that buy first.";
      return;
    }
    throw error;
  }
  const label = button.getAttribute('aria-label');
  const question = kind === 'goalPurchase' ? `${label}? The money goes back into Goals.` : `${label}? You can't undo this.`;
  if (!window.confirm(question)) return;
  const record = (state.goalPurchases ?? []).find((x) => x.id === id);
  if (!commit(next)) return;
  if (kind === 'paycheck') el('history-result').textContent = 'Paycheck removed.';
  else if (kind === 'purchase') el('history-result').textContent = 'Purchase removed. The money is back in Spend.';
  else el('history-result').textContent =
    `Undone. ${formatCents(record?.cents ?? 0)} is back in Goals. Add the goal again if you still want it.`;
  el('history-title').focus();
});

function renderSettings() {
  if (!state) return;
  const tracking = state.settings?.trackSpending === true;
  el('track-switch').setAttribute('aria-checked', String(tracking));
  el('money-note').hidden = tracking;
  renderSplitPreview();
  renderMoney();
  renderHistory();
}

// Track my spending (docs/adr/0005): off hides purchases; it never deletes them.

el('track-switch').addEventListener('click', () => {
  if (!state) return;
  clearSettingsMessages();
  const on = state.settings?.trackSpending !== true;
  if (!commit(setTrackSpending(state, on))) return;
  el('track-result').textContent = on
    ? 'Tracking is on. Log purchases from the Spending card on Home.'
    : 'Tracking is off. Your purchases are kept, just hidden.';
});

const purchaseSheet = dialogEl('purchase-sheet');
const purchaseAmount = inputEl('purchase-amount');
const purchaseNote = inputEl('purchase-note');

for (const input of [purchaseAmount, purchaseNote]) input.addEventListener('input', () => clearErrors(purchaseSheet));

el('log-purchase').addEventListener('click', () => {
  if (!state) return;
  clearErrors(purchaseSheet);
  el('home-status').textContent = '';
  purchaseAmount.value = '';
  purchaseNote.value = '';
  el('purchase-left').textContent = spendAvailable(balances(state).spend, state.paychecks.length > 0);
  openSheet(purchaseSheet);
  purchaseAmount.focus();
});

el('purchase-cancel').addEventListener('click', () => purchaseSheet.close());

el('purchase-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state) return;
  clearErrors(purchaseSheet);
  const amount = readAmount(purchaseAmount.value);
  if (!amount.ok) {
    showError('purchase-amount-error', amount.error, purchaseAmount);
    return;
  }
  let next;
  try {
    next = addPurchase(state, { date: localISODate(), cents: amount.cents, note: purchaseNote.value });
  } catch (error) {
    if (error instanceof OverspendError) {
      showError('purchase-amount-error', overspendMessage(error.availableCents), purchaseAmount);
    } else if (error instanceof RangeError) {
      showError('purchase-note-error', error.message, purchaseNote);
    } else {
      throw error;
    }
    return;
  }
  purchaseSheet.close();
  if (!commit(next)) return;
  el('home-status').textContent = purchaseSentence(amount.cents, balances(next).spend);
});

/** The Spending card on Home: what's left and the latest three records. */
function renderSpending() {
  if (!state) return;
  const tracking = state.settings?.trackSpending === true;
  el('spending').hidden = !tracking;
  if (!tracking) return;
  el('left-to-spend').textContent = leftToSpend(balances(state).spend);
  el('recent').replaceChildren(...recentActivity(state, 3).items.map((item) => {
    const words = historyWords(item);
    const li = document.createElement('li');
    const text = document.createElement('span');
    text.className = 'history-text';
    const what = document.createElement('span');
    what.className = 'history-what';
    what.textContent = words.what;
    const when = document.createElement('span');
    when.className = 'history-when';
    when.textContent = shortDate(item.date);
    text.append(what, when);
    const amount = document.createElement('span');
    amount.className = item.kind === 'paycheck' ? 'history-amount in' : 'history-amount';
    amount.textContent = words.amount;
    li.append(text, amount);
    return li;
  }));
}

// Backup: download the records as a file, or restore them from one. A restored file is
// untrusted: importBackup checks every field (and dates against today) before anything changes.

const backupFile = inputEl('backup-file');

el('backup-download').addEventListener('click', () => {
  if (!state) return;
  clearSettingsMessages();
  downloadText(backupFileName(localISODate()), exportBackup(state), 'application/json');
  el('backup-result').textContent = 'Backup downloaded. Keep the file somewhere safe.';
});

function chooseBackupFile() {
  clearSettingsMessages();
  el('welcome-restore-error').textContent = '';
  backupFile.value = '';
  backupFile.click();
}
el('backup-restore').addEventListener('click', chooseBackupFile);
el('welcome-restore').addEventListener('click', chooseBackupFile);

backupFile.addEventListener('change', async () => {
  const file = backupFile.files?.[0];
  if (!file) return;
  const firstRun = state === null;
  const fail = (/** @type {string} */ reason) => {
    el(firstRun ? 'welcome-restore-error' : 'backup-error').textContent =
      `That file couldn't be restored, so nothing was changed. ${reason}`;
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
  if (!firstRun && !window.confirm('Restoring replaces everything in Budgeteer right now with what is in the backup. Go ahead?')) {
    return;
  }
  const restored = upgradeState(result.state);
  if (!commit(restored)) return;
  const message = `Backup restored: ${count(restored.paychecks.length, 'paycheck')}, `
    + `${count(restored.purchases.length, 'purchase')}, ${count(restored.goals.length, 'goal')} `
    + `and ${count(restored.goalPurchases?.length ?? 0, 'goal buy')}.`;
  el(firstRun ? 'home-status' : 'backup-result').textContent = message;
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
  el('open-settings').hidden = firstRun;
  if (!state) return;
  if (settingsSheet.open) renderSettings();

  const plan = homePlan(state, localISODate());
  el('nudge').hidden = !plan.nudge;
  el('headline').textContent = plan.headline;
  el('basis').textContent = plan.basis;
  el('basis').hidden = plan.basis === '';
  el('goal-cards').replaceChildren(...plan.goals.map((goal, i) => goalCard(goal, i === 0)));
  el('goals-empty').hidden = plan.goals.length > 0;
  renderSpending();
}

render();
if (state === null) welcomeName.focus();
