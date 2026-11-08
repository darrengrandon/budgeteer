// Sentences the app shows. Plain and friendly, for 16-19 year olds (SPEC.md Decisions 1).
// Pure functions, so the wording is tested without a browser.

import { formatCents } from './money.js';
import { addDays } from './budget.js';

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
 * The line under each goal's progress bar.
 * @param {{ savedCents: number, targetCents: number, weeks: number, averageWeeklyCents: number, goalsPercent: number,
 *   hasPaychecks?: boolean }} args hasPaychecks: any paycheck at all, even older than 4 weeks
 * @returns {string}
 */
export function goalStatus({ savedCents, targetCents, weeks, averageWeeklyCents, goalsPercent, hasPaychecks = false }) {
  if (savedCents >= targetCents) return 'Done! You saved enough for this.';
  if (averageWeeklyCents <= 0) {
    return hasPaychecks
      ? "No paychecks in the last 4 weeks, so there's no estimate yet. Log your next one to see the weeks to go."
      : 'Log a paycheck to see a date.';
  }
  if (goalsPercent === 0) return "Your split puts 0% into Goals, so this won't fill up. Change your split to get here.";
  if (!Number.isFinite(weeks)) return 'Your recent pay is too small to give a date yet.';
  if (weeks === 1) return 'About 1 week to go.';
  return `About ${weeks} weeks to go.${yearsHint(weeks)}`;
}

/**
 * For long waits, say it in years too: 223 weeks means little at a glance.
 * @param {number} weeks
 * @returns {string}
 */
function yearsHint(weeks) {
  if (weeks < 52) return '';
  if (weeks === 52) return " That's about a year.";
  if (weeks < 104) return " That's over a year.";
  return ` That's about ${Math.round(weeks / 52)} years.`;
}

/**
 * "$25.00 of $100.00 saved"
 * @param {number} savedCents
 * @param {number} targetCents
 * @returns {string}
 */
export function goalProgress(savedCents, targetCents) {
  return `${formatCents(savedCents)} of ${formatCents(targetCents)} saved`;
}

/**
 * A note for money in the Goals bucket beyond every goal's target.
 * @param {number} unassignedCents
 * @param {boolean} hasGoals
 * @returns {string} empty when there is nothing to say
 */
export function unassignedNote(unassignedCents, hasGoals) {
  if (unassignedCents <= 0) return '';
  const amount = formatCents(unassignedCents);
  return hasGoals
    ? `You have ${amount} in Goals that no goal needs right now. Add a goal to put it to work.`
    : `You have ${amount} in Goals. Add a goal to start filling it.`;
}

/**
 * One line per goal under the what-if slider, like "Phone: about 9 weeks (2 weeks sooner)".
 * @param {{ name: string, done: boolean, trialWeeks: number, currentWeeks: number,
 *   averageWeeklyCents: number, trialGoalsPercent: number, hasPaychecks?: boolean }} args
 * @returns {string}
 */
export function whatIfLine({ name, done, trialWeeks, currentWeeks, averageWeeklyCents, trialGoalsPercent, hasPaychecks = false }) {
  if (done) return `${name}: done already`;
  if (averageWeeklyCents <= 0) {
    return hasPaychecks ? `${name}: no paychecks in the last 4 weeks` : `${name}: log a paycheck to see a date`;
  }
  if (trialGoalsPercent === 0) return `${name}: never, with 0% to Goals`;
  if (!Number.isFinite(trialWeeks)) return `${name}: no date yet`;

  const weeks = (n) => (n === 1 ? '1 week' : `${n} weeks`);
  let compare = '';
  if (Number.isFinite(currentWeeks)) {
    const diff = currentWeeks - trialWeeks;
    if (diff > 0) compare = ` (${weeks(diff)} sooner)`;
    else if (diff < 0) compare = ` (${weeks(-diff)} later)`;
    else compare = ' (same as now)';
  }
  return `${name}: about ${weeks(trialWeeks)}${compare}`;
}

/**
 * The line under the what-if split: how much a week goes into Goals, or why there is no estimate.
 * @param {{ averageWeeklyCents: number, weeklyCents: number, hasPaychecks: boolean }} args
 * @returns {string}
 */
export function whatIfWeekly({ averageWeeklyCents, weeklyCents, hasPaychecks }) {
  if (averageWeeklyCents > 0) return `That's about ${formatCents(weeklyCents)} a week into Goals.`;
  return hasPaychecks ? 'No paychecks in the last 4 weeks, so there are no estimates yet.' : 'Log a paycheck to see dates.';
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
  const amount = weeklySpendCents < 1000 && weeklySpendCents % 100 !== 0
    ? formatCents(weeklySpendCents)
    : `$${withCommas(Math.round(weeklySpendCents / 100))}`;
  return `Spend about ${amount} a week`;
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
 * The line on a goal card.
 * @param {{ savedCents: number, targetCents: number, weeks: number, hasPay: boolean,
 *   goalsPercent: number, todayISO: string }} args
 * @returns {string}
 */
export function readyLine({ savedCents, targetCents, weeks, hasPay, goalsPercent, todayISO }) {
  if (savedCents >= targetCents) return 'You can buy it!';
  if (!hasPay) return 'Log a paycheck to see when.';
  if (goalsPercent === 0) return 'Your split puts nothing into Goals. Change it in Settings.';
  if (!Number.isFinite(weeks)) return 'Ready once more pay comes in.';
  const when = shortDateFrom(addDays(todayISO, weeks * 7), todayISO);
  return `Ready in about ${weeks === 1 ? '1 week' : `${weeks} weeks`} (around ${when})`;
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
 * "Nice! $85.00 came out of Goals for Concert tickets."
 * @param {number} cents
 * @param {string} name
 * @returns {string}
 */
export function buySentence(cents, name) {
  return `Nice! ${formatCents(cents)} came out of Goals for ${name}.`;
}
