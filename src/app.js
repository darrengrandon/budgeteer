// Budgeteer: first run, Home and the sheets (SPEC.md "Screens").
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
  moveGoalToTop,
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
import { homePlan, backupDue } from './plan.js';
import { missedPaydays } from './pay.js';
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
  shortDateFrom,
  lastPaycheckNote,
  bigAmountWarningRecent,
  overLimitWarning,
  missedChip,
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

/** Home messages fade after this long (REVIEW.md L13). */
const STATUS_MS = 10_000;
let statusTimer = 0;
/** @type {(() => void) | null} */
let statusRun = null;

/**
 * The message under the headline, with an optional button (like "Undo paycheck").
 * It fades after a while, and any saved change clears it (see commit).
 * @param {string} text
 * @param {{ label: string, name?: string, run: () => void } | null} [action]
 *   name: a fuller accessible name when the visible label is short ("Undo" / "Undo paycheck")
 */
function setStatus(text, action = null) {
  el('home-status').textContent = text;
  const button = el('home-status-action');
  button.hidden = !action;
  button.textContent = action ? action.label : '';
  if (action?.name) button.setAttribute('aria-label', action.name);
  else button.removeAttribute('aria-label');
  statusRun = action ? action.run : null;
  clearTimeout(statusTimer);
  if (text) statusTimer = window.setTimeout(() => setStatus(''), STATUS_MS);
}

el('home-status-action').addEventListener('click', () => {
  const run = statusRun;
  setStatus('');
  run?.();
});

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
    if (event.target !== sheet) return;
    if (sheet.id === 'settings-sheet') closeSettings();
    else /** @type {HTMLDialogElement} */ (sheet).close();
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
  setStatus('');
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

// Phones often resume a page from memory instead of reloading it. Re-check the date then,
// so "Got paid? Log it." and the goal dates are right (REVIEW.md L3).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') reloadFromStorage();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) reloadFromStorage();
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

el('welcome-skip').addEventListener('click', () => {
  const name = welcomeName.value.trim();
  const price = readAmount(welcomePrice.value);
  if (name !== '' && price.ok) {
    try {
      startWith(addGoal(newState(), { name, targetCents: price.cents }));
      return;
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
  }
  startWith(newState());
});

// ---------------------------------------------------------------------------
// The paycheck sheet

const paySheet = dialogEl('pay-sheet');
const payAmount = inputEl('pay-amount');
const paySubmit = el('pay-submit');
const payMissed = el('pay-missed');
/** The ids of the paychecks just added (today's, and any missed ones), for Undo. */
let justAddedIds = /** @type {string[]} */ ([]);
/** Paydays the teen skipped, offered by the "missed" chip (REVIEW.md L2). */
let missed = /** @type {string[]} */ ([]);
/** An unusually big amount the teen has already been asked about (REVIEW.md L5). */
let confirmedCents = /** @type {number | null} */ (null);
/** The teen said "Yes, log another" to a repeat of today's or yesterday's amount. */
let repeatConfirmed = false;

/**
 * Show or hide the "Log another paycheck?" step (SPEC.md decision 13). Its "No" button takes
 * the place of "Add paycheck", so a double tap lands on "No", not on a second paycheck.
 * @param {string} question empty to hide the step
 */
function showRepeatStep(question) {
  const asking = question !== '';
  el('pay-repeat').textContent = question;
  el('pay-repeat').hidden = !asking;
  paySubmit.hidden = asking;
  el('pay-repeat-no').hidden = !asking;
  el('pay-cancel').hidden = asking;
  el('pay-repeat-yes').hidden = !asking;
}

/** Back to "Add paycheck" after the amount changes. */
function resetPayQuestion() {
  confirmedCents = null;
  repeatConfirmed = false;
  paySubmit.textContent = 'Add paycheck';
  showRepeatStep('');
}

/**
 * True for the second tap of a double tap (the browser counts it as click number 2).
 * @param {Event} event
 */
const isSecondTap = (event) => event instanceof MouseEvent && event.detail > 1;

// The second tap of a double tap never saves, confirms or undoes anything.
paySubmit.addEventListener('click', (event) => {
  if (isSecondTap(event)) event.preventDefault();
});

el('pay-repeat-no').addEventListener('click', (event) => {
  if (isSecondTap(event)) return;
  paySheet.close();
  setStatus('OK. Nothing new was logged.');
});

el('pay-repeat-yes').addEventListener('click', (event) => {
  if (isSecondTap(event)) return;
  repeatConfirmed = true;
  /** @type {HTMLFormElement} */ (el('pay-form')).requestSubmit();
});

payAmount.addEventListener('input', () => {
  clearErrors(paySheet);
  resetPayQuestion();
});

/** "A and B", "A, B and C" */
const joinAnd = (/** @type {string[]} */ items) =>
  (items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/**
 * @param {boolean} [firstTime] the first-run wording: "How much was your paycheck?"
 */
function openPaySheet(firstTime = false) {
  if (!state) return;
  const today = localISODate();
  clearErrors(paySheet);
  setStatus('');
  justAddedIds = [];
  payAmount.value = '';
  resetPayQuestion();
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

  // Say so if a paycheck was logged in the last few days, so it isn't logged twice (REVIEW.md L1).
  const latest = state.paychecks.reduce((a, b) => (b.date >= a.date ? b : a), state.paychecks[0]);
  const note = latest ? lastPaycheckNote(latest.date, latest.cents, today) : '';
  el('pay-last').textContent = note;
  el('pay-last').hidden = note === '';

  // Offer to add paydays that were clearly skipped (REVIEW.md L2).
  missed = missedPaydays(state.paychecks, today);
  payMissed.hidden = missed.length === 0;
  payMissed.textContent = missed.length > 0 ? missedChip(missed, today) : '';
  payMissed.setAttribute('aria-pressed', 'false');

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
  resetPayQuestion();
  payAmount.focus();
});

payMissed.addEventListener('click', () => {
  payMissed.setAttribute('aria-pressed', String(payMissed.getAttribute('aria-pressed') !== 'true'));
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
  const recent = state.paychecks.slice(-6).map((p) => p.cents);
  const warning = bigAmountWarningRecent(amount.cents, recent) || overLimitWarning(amount.cents);
  if (warning !== '' && confirmedCents !== amount.cents) {
    showError('pay-amount-error', warning, payAmount);
    confirmedCents = amount.cents;
    paySubmit.textContent = `Yes, add ${formatCents(amount.cents)}`;
    return;
  }

  const today = localISODate();
  // The same amount as a paycheck already logged today is probably a repeat: ask first.
  // (The owner asked for "today or yesterday"; yesterday waits for their OK to change the
  // review2 L1 test, which logs a repeat the next day. See overnight-review/OVERNIGHT-REPORT.md.)
  const repeat = state.paychecks.find((p) => p.cents === amount.cents && p.date === today);
  if (repeat && !repeatConfirmed) {
    showRepeatStep(`You already logged ${formatCents(amount.cents)} today. Log another paycheck?`);
    el('pay-repeat-no').focus();
    return;
  }

  const backfill = payMissed.getAttribute('aria-pressed') === 'true' ? missed : [];
  let next = state;
  /** @type {string[]} */
  const ids = [];
  try {
    for (const date of [...backfill, today]) {
      next = addPaycheck(next, { date, cents: amount.cents });
      ids.push(next.paychecks[next.paychecks.length - 1].id);
    }
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
  justAddedIds = ids;
  showPayResult(added, backfill);
});

/**
 * Where the money went, and each goal's new timeline.
 * @param {import('./storage.js').Paycheck} added today's paycheck
 * @param {string[]} backfill missed paydays added too
 */
function showPayResult(added, backfill) {
  if (!state) return;
  const today = localISODate();
  el('pay-sentence').textContent = `Nice. ${paycheckSentence(added.cents, paycheckParts(added))}`;
  const when = joinAnd(backfill.map((d) => shortDateFrom(d, today)));
  el('pay-extra').textContent = backfill.length === 1 ? `Also added the paycheck from ${when}.`
    : backfill.length > 1 ? `Also added the ${backfill.length} paychecks from ${when}.` : '';
  el('pay-extra').hidden = backfill.length === 0;
  el('pay-timeline').replaceChildren(...homePlan(state, today).goals.map((g) => {
    const li = document.createElement('li');
    li.textContent = `${g.name}: ${g.line.charAt(0).toLowerCase()}${g.line.slice(1)}`;
    return li;
  }));
  el('pay-entry').hidden = true;
  el('pay-done').hidden = false;
  el('pay-title').classList.add('visually-hidden'); // the question is answered; it still names the sheet
  el('pay-close').focus();
}

/** Take back the paychecks just added. Returns false if their money was already used. */
function undoAdded() {
  if (!state || justAddedIds.length === 0) return true;
  let next = state;
  try {
    for (const id of [...justAddedIds].reverse()) next = removePaycheck(next, id);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return false;
  }
  if (!commit(next)) return true;
  justAddedIds = [];
  setStatus('Paycheck removed.');
  return true;
}

el('pay-undo').addEventListener('click', (event) => {
  if (isSecondTap(event)) return;
  if (!undoAdded()) {
    el('pay-undo-error').textContent = "That paycheck can't be taken back now, because its money was already used.";
    return;
  }
  const message = el('home-status').textContent;
  paySheet.close();
  setStatus(message);
});

// After "Done" (or a quick double tap past the summary), Undo stays on Home (REVIEW.md L5).
paySheet.addEventListener('close', () => {
  if (justAddedIds.length === 0) return;
  setStatus('Paycheck added.', {
    label: 'Undo', // short, so it fits beside the message on a 320px phone (overnight fix P2b)
    name: 'Undo paycheck',
    run: () => {
      if (!undoAdded()) setStatus("That paycheck can't be taken back now, because its money was already used.");
    },
  });
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
  setStatus('');
  goalName.value = goal ? goal.name : '';
  goalPrice.value = goal ? centsToInput(goal.targetCents) : '';
  el('goal-title').textContent = goal ? `Edit "${goal.name}"` : 'Add a goal';
  el('goal-more').hidden = !goal;
  const index = goal ? state.goals.indexOf(goal) : -1;
  el('goal-up').hidden = index < 1;
  el('goal-top').hidden = index < 2; // second place: "Move up" already is "to the top"
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
  setStatus(editedId ? `Saved "${savedName}".` : `Added "${savedName}".`);
  focusGoal(editedId ?? next.goals[next.goals.length - 1].id);
});

el('goal-up').addEventListener('click', () => {
  if (!state || !sheetGoalId) return;
  const id = sheetGoalId;
  const goal = state.goals.find((g) => g.id === id);
  goalSheet.close();
  if (!goal || !commit(moveGoal(state, id, -1))) return;
  setStatus(`Moved "${goal.name}" up.`);
  focusGoal(id);
});

el('goal-top').addEventListener('click', () => {
  if (!state || !sheetGoalId) return;
  const id = sheetGoalId;
  const goal = state.goals.find((g) => g.id === id);
  goalSheet.close();
  if (!goal || !commit(moveGoalToTop(state, id))) return;
  setStatus(`Moved "${goal.name}" to the top.`);
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
  setStatus(`Removed "${goal.name}". Its money stays in Goals.`);
});

/** @param {string} id */
function openBuySheet(id) {
  const goal = state?.goals.find((g) => g.id === id);
  if (!goal) return;
  sheetGoalId = id;
  clearErrors(buySheet);
  setStatus('');
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
  const extra = price.cents - record.cents;
  // With tracking on, the extra can come out of Spend in one tap (REVIEW.md L9).
  const action = extra > 0 && state?.settings?.trackSpending === true
    ? { label: `Take ${formatCents(extra)} from Spend`, run: () => takeFromSpend(extra, `Extra for ${record.name}`) }
    : null;
  setStatus(buySentence(record.cents, record.name, price.cents), action);
  el('headline').focus();
});

/**
 * Log a purchase from Spend for the part of a goal buy that Goals didn't cover.
 * @param {number} cents
 * @param {string} note
 */
function takeFromSpend(cents, note) {
  if (!state) return;
  let next;
  try {
    next = addPurchase(state, { date: localISODate(), cents, note });
  } catch (error) {
    if (!(error instanceof OverspendError)) throw error;
    setStatus(overspendMessage(error.availableCents));
    return;
  }
  if (!commit(next)) return;
  setStatus(purchaseSentence(cents, balances(next).spend));
}

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
  el('history-action').hidden = true;
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
/** Close Settings, but ask first if a new, valid split wasn't saved. */
function closeSettings() {
  const result = readSplitInputs(splitValues());
  if (state && result.ok) {
    const now = state.split;
    const { spend, save, goals } = result.split;
    if ((spend !== now.spend || save !== now.save || goals !== now.goals)
      && window.confirm(`Save your new split (${spend}% Spend, ${save}% Save, ${goals}% Goals)?`)) {
      commit(setSplit(state, result.split));
    }
  }
  settingsSheet.close();
}

el('settings-done').addEventListener('click', closeSettings);
settingsSheet.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeSettings();
});

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
  const lines = [plan.headline, ...plan.goals.map((g) => (result.split.goals === 0 && !g.funded
    ? `${g.name}: nothing goes to Goals with this split`
    : `${g.name}: ${g.line.charAt(0).toLowerCase()}${g.line.slice(1)}`))];
  el('split-preview').replaceChildren(...lines.map((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    return li;
  }));
}

for (const input of Object.values(splitInputs)) {
  input.addEventListener('input', () => {
    clearErrors(el('split-form'));
    el('split-result').textContent = '';
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
  if (state.settings?.trackSpending !== true) {
    totals.spend += state.purchases.reduce((sum, b) => sum + b.cents, 0);
  }
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
    when.textContent = item.kind === 'goalPurchase' ? `${shortDate(item.date)} · from Goals` : shortDate(item.date);
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
  else {
    el('history-result').textContent =
      `Undone. ${formatCents(record?.cents ?? 0)} is back in Goals. Add the goal again if you still want it.`;
    if (record) offerAddBack(record);
  }
  el('history-title').focus();
});

/**
 * "Add it back": the undone goal returns at the top, with the price that came out of Goals.
 * @param {import('./storage.js').GoalPurchase} record
 */
function offerAddBack(record) {
  const button = el('history-action');
  button.textContent = 'Add it back';
  button.hidden = false;
  button.onclick = () => {
    if (!state) return;
    let next;
    try {
      next = addGoal(state, { name: record.name, targetCents: record.cents });
      next = moveGoalToTop(next, next.goals[next.goals.length - 1].id);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      el('history-error').textContent = error.message;
      return;
    }
    if (!commit(next)) return;
    clearSettingsMessages();
    el('history-result').textContent = `${record.name} is back at the top, with its ${formatCents(record.cents)}.`;
  };
}

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
  setStatus('');
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
  setStatus(purchaseSentence(amount.cents, balances(next).spend));
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
    when.textContent = item.kind === 'goalPurchase' ? `${shortDate(item.date)} · from Goals` : shortDate(item.date);
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
  if (firstRun) setStatus(message);
  else el('backup-result').textContent = message;
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
  el('install-card').hidden = !installHelpWanted();
  el('backup-card').hidden = !backupDue(state.paychecks.length, readBackupMark());
  // Before the first paycheck, the headline itself opens the paycheck sheet.
  if (plan.basis === '') {
    el('headline').setAttribute('role', 'button');
    el('headline').tabIndex = 0;
  } else {
    el('headline').removeAttribute('role');
    el('headline').tabIndex = -1;
  }
}

// ---------------------------------------------------------------------------
// Backup nudge (SPEC.md "Backup nudge", REVIEW.md L4): every 4 paychecks since the last backup
// (or "Not now") on this phone. The count is kept on this phone only, beside the data.

const BACKUP_MARK_KEY = 'budgeteer.backupAt';
let backupMark = /** @type {number | null} */ (null);

/** Paychecks there were at the last backup or "Not now", or null if never. */
function readBackupMark() {
  try {
    const saved = storage?.getItem(BACKUP_MARK_KEY);
    if (typeof saved === 'string' && /^\d{1,9}$/.test(saved)) return Number(saved);
  } catch {
    // Storage is off; use what this visit remembers.
  }
  return backupMark;
}

/** Remember that a backup was made (or put off) now. */
function markBackup() {
  if (!state) return;
  backupMark = state.paychecks.length;
  try {
    storage?.setItem(BACKUP_MARK_KEY, String(backupMark));
  } catch {
    // Storage is off; it stays hidden for this visit.
  }
  el('backup-card').hidden = true;
}

el('backup-card-download').addEventListener('click', () => {
  if (!state) return;
  downloadText(backupFileName(localISODate()), exportBackup(state), 'application/json');
  markBackup();
  setStatus('Backup downloaded. Keep the file somewhere safe.');
});
el('backup-card-later').addEventListener('click', markBackup);
el('backup-download').addEventListener('click', markBackup);

// "Log your first paycheck" opens the paycheck sheet (REVIEW.md L12).
const headline = el('headline');
const headlineOpensSheet = () => headline.getAttribute('role') === 'button';
headline.addEventListener('click', () => {
  if (headlineOpensSheet()) openPaySheet();
});
headline.addEventListener('keydown', (event) => {
  if (headlineOpensSheet() && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openPaySheet();
  }
});

// ---------------------------------------------------------------------------
// Installing (docs/adr/0001): the iPhone help card, and the service worker for offline use.

const INSTALL_HELP_KEY = 'budgeteer.installHelp';
let installHelpDismissed = false;

/** iPhone Safari, not yet installed, and not dismissed. */
function installHelpWanted() {
  if (installHelpDismissed) return false;
  const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const nav = /** @type {Navigator & { standalone?: boolean }} */ (navigator);
  const installed = nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  try {
    if (storage?.getItem(INSTALL_HELP_KEY) === 'dismissed') return false;
  } catch {
    // Storage is off; the card can still be dismissed for this visit.
  }
  return iPhone && !installed;
}

el('install-dismiss').addEventListener('click', () => {
  installHelpDismissed = true;
  try {
    storage?.setItem(INSTALL_HELP_KEY, 'dismissed');
  } catch {
    // Storage is off; it stays hidden for this visit.
  }
  el('install-card').hidden = true;
  el('headline').focus();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // Offline support is a bonus; the app works the same without it.
  });
}

render();
if (state === null) welcomeName.focus();
