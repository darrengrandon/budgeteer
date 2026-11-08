// Sentences the app shows. Plain and friendly, for 16-19 year olds (SPEC.md Decisions 1).
// Pure functions, so the wording is tested without a browser.

import { formatCents } from './money.js';
import { addDays, dayNumber } from './budget.js';

/**
 * "Your $42.50 became $21.25 to spend, $12.75 saved, $8.50 for goals."
 * @param {number} cents the whole paycheck
 * @param {{ spend: number, save: number, goals: number }} parts cents per bucket
 * @returns {string}
 */
export function paycheckSentence(cents, parts) {
  return `Your ${formatCents(cents)} became ${formatCents(parts.spend)} to spend, `
    + `${formatCents(parts.save)} saved, ${formatCents(parts.goals)} for goals.`;
}

/**
 * A short hint under the split boxes that says whether they total 100, and what to change.
 * @param {{ spend: number, save: number, goals: number }} split
 * @returns {string}
 */
export function splitTotalHint(split) {
  const values = [split.spend, split.save, split.goals];
  if (!values.every((v) => Number.isInteger(v) && v >= 0 && v <= 100)) {
    return 'Use whole numbers from 0 to 100 in each box.';
  }
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 100) return 'Adds up to 100%. Good to go.';
  if (total > 100) return `Adds up to ${total}%. Take away ${total - 100}.`;
  return `Adds up to ${total}%. Add ${100 - total} more.`;
}

/**
 * Shown when a purchase is more than what is in Spend (SPEC.md Decisions 3).
 * @param {number} availableCents
 * @returns {string}
 */
export function overspendMessage(availableCents) {
  if (availableCents <= 0) return 'Your Spend bucket is empty right now. Log a paycheck to fill it up.';
  return `That's more than you have. You have ${formatCents(availableCents)} left to spend.`;
}

/**
 * "Logged. $5.00 came out of Spend. You have $16.25 left to spend."
 * @param {number} cents the purchase
 * @param {number} leftCents what is left in Spend afterwards
 * @returns {string}
 */
export function purchaseSentence(cents, leftCents) {
  const left = leftCents > 0 ? `You have ${formatCents(leftCents)} left to spend.` : 'Your Spend bucket is now empty.';
  return `Logged. ${formatCents(cents)} came out of Spend. ${left}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "Nov 7, 2026" from "2026-11-07". Reads the parts directly, so the time zone can't shift the day.
 * @param {string} iso
 * @returns {string}
 */
export function shortDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/**
 * The line above the purchase form.
 * @param {number} spendCents what is in Spend
 * @param {boolean} hasPaychecks any paycheck logged at all
 * @returns {string}
 */
export function spendAvailable(spendCents, hasPaychecks) {
  if (spendCents > 0) return `You have ${formatCents(spendCents)} to spend.`;
  return hasPaychecks
    ? 'Your Spend bucket is empty. Log your next paycheck to add more.'
    : 'Your Spend bucket is empty. Log a paycheck first.';
}

// ---------------------------------------------------------------------------
// Phone screens (ticket 014)

/** Commas in a whole number of dollars: 1234 -> "1,234". */
const withCommas = (/** @type {number} */ n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * An exact amount without ".00": "$300", "$8.50", "$1,234". Never rounds.
 * @param {number} cents
 * @returns {string}
 */
export function moneyShort(cents) {
  const full = formatCents(cents);
  return full.endsWith('.00') ? full.slice(0, -3) : full;
}

/**
 * The Home headline (SPEC.md "Spend about $X a week"): whole dollars, except under $10.
 * @param {number | null} weeklySpendCents null before the first paycheck
 * @returns {string}
 */
export function spendHeadline(weeklySpendCents) {
  if (weeklySpendCents === null) return 'Log your first paycheck';
  return `Spend about ${aboutAmount(weeklySpendCents)} a week`;
}

/**
 * The line under the headline: "Out of about $100 a week of pay."
 * @param {number} weeklyPayCents
 * @returns {string}
 */
export function payBasis(weeklyPayCents) {
  return `Out of about ${aboutAmount(weeklyPayCents)} a week of pay.`;
}

/**
 * An "about" amount: whole dollars, except under $10 where the cents matter.
 * @param {number} cents
 * @returns {string}
 */
function aboutAmount(cents) {
  return cents < 1000 && cents % 100 !== 0 ? formatCents(cents) : `$${withCommas(Math.round(cents / 100))}`;
}

/**
 * "$40 of $300"
 * @param {number} savedCents
 * @param {number} targetCents
 * @returns {string}
 */
export function goalAmounts(savedCents, targetCents) {
  return `${moneyShort(savedCents)} of ${moneyShort(targetCents)}`;
}

/**
 * "Jan 9" this year, "Jan 9, 2027" otherwise.
 * @param {string} iso
 * @param {string} todayISO
 * @returns {string}
 */
export function shortDateFrom(iso, todayISO) {
  const full = shortDate(iso);
  return iso.slice(0, 4) === todayISO.slice(0, 4) ? full.slice(0, full.lastIndexOf(',')) : full;
}

/**
 * The line on a goal card. The date is counted from fromISO (the last payday), so it stays
 * put between paydays (REVIEW.md L10); the weeks shown are from today.
 * @param {{ savedCents: number, targetCents: number, weeks: number, hasPay: boolean,
 *   goalsPercent: number, todayISO: string, fromISO?: string, dateISO?: string }} args
 * @returns {string}
 */
export function readyLine({ savedCents, targetCents, weeks, hasPay, goalsPercent, todayISO, fromISO = todayISO, dateISO }) {
  if (savedCents >= targetCents) return 'You can buy it!';
  if (!hasPay) return 'Log a paycheck to see when.';
  if (goalsPercent === 0) return 'Your split puts nothing into Goals. Change it in Settings.';
  if (!Number.isFinite(weeks)) return 'Ready once more pay comes in.';
  // dateISO: the payday when the money will be there (src/plan.js); otherwise weeks from fromISO.
  const date = dateISO ?? addDays(fromISO, weeks * 7);
  const daysLeft = dayNumber(date) - dayNumber(todayISO);
  if (daysLeft <= 0) return 'Should be ready by now. Log your paycheck to check.';
  return `Ready in about ${howLong(Math.ceil(daysLeft / 7))} (around ${shortDateFrom(date, todayISO)})`;
}

/**
 * Weeks up to a year; after that, years, which are easier to picture (REVIEW.md L14).
 * @param {number} weeks
 * @returns {string}
 */
function howLong(weeks) {
  if (weeks === 1) return '1 week';
  if (weeks <= 52) return `${weeks} weeks`;
  if (weeks < 78) return 'a year';
  return `${withCommas(Math.round(weeks / 52))} years`;
}

/**
 * A reminder in the paycheck sheet when a paycheck was logged in the last 3 days, so a
 * duplicate is less likely (REVIEW.md L1). Empty otherwise.
 * @param {string} lastISO the last paycheck's date
 * @param {number} cents the last paycheck
 * @param {string} todayISO
 * @returns {string}
 */
export function lastPaycheckNote(lastISO, cents, todayISO) {
  const days = dayNumber(todayISO) - dayNumber(lastISO);
  if (days < 0 || days > 3) return '';
  const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `on ${shortDateFrom(lastISO, todayISO)}`;
  return `You already logged ${formatCents(cents)} ${when}.`;
}

/**
 * A question before saving a paycheck 4 or more times the last one, like a missing dot
 * (REVIEW.md L5). Empty when the amount looks normal.
 * @param {number} cents
 * @param {number | null} lastCents
 * @returns {string}
 */
export function bigAmountWarning(cents, lastCents) {
  if (lastCents === null || cents < lastCents * 4) return '';
  return `That's a lot more than last time (${formatCents(lastCents)}). Is ${formatCents(cents)} right?`;
}

/**
 * The chip that adds paydays the teen skipped (REVIEW.md L2).
 * @param {string[]} dates
 * @param {string} todayISO
 * @returns {string}
 */
export function missedChip(dates, todayISO) {
  const when = dates.map((d) => shortDateFrom(d, todayISO));
  const list = when.length <= 2 ? when.join(' and ') : `${when.slice(0, -1).join(', ')} and ${when[when.length - 1]}`;
  return dates.length === 1
    ? `Also add the paycheck I missed (around ${list})`
    : `Also add the ${dates.length} paychecks I missed (around ${list})`;
}

/**
 * One goal's line after logging a paycheck: "Phone: ready in about 9 weeks (around Jan 9)".
 * @param {{ name: string, savedCents: number, targetCents: number, weeks: number, hasPay: boolean,
 *   goalsPercent: number, todayISO: string }} args
 * @returns {string}
 */
export function goalTimeline({ name, ...rest }) {
  const line = readyLine(rest);
  return `${name}: ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
}

/**
 * The big number on the Spending card (only while tracking is on).
 * @param {number} spendCents
 * @returns {string}
 */
export function leftToSpend(spendCents) {
  return `${formatCents(spendCents)} left to spend`;
}

/**
 * "Nice! $85.00 came out of Goals for Concert tickets."
 * @param {number} cents what came out of Goals
 * @param {string} name
 * @param {number} [paidCents] what it really cost, if more than came out of Goals
 * @returns {string}
 */
export function buySentence(cents, name, paidCents = cents) {
  const extra = paidCents > cents ? ` The extra ${formatCents(paidCents - cents)} didn't come from Goals.` : '';
  return `Nice! ${formatCents(cents)} came out of Goals for ${name}.${extra}`;
}
