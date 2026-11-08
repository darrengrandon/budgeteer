// Sentences the app shows. Plain and friendly, for 16-19 year olds (SPEC.md Decisions 1).
// Pure functions, so the wording is tested without a browser.

import { formatCents } from './money.js';

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
 * @param {{ savedCents: number, targetCents: number, weeks: number, averageWeeklyCents: number, goalsPercent: number }} args
 * @returns {string}
 */
export function goalStatus({ savedCents, targetCents, weeks, averageWeeklyCents, goalsPercent }) {
  if (savedCents >= targetCents) return 'Done! You saved enough for this.';
  if (averageWeeklyCents <= 0) return 'Log a paycheck to see a date.';
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
