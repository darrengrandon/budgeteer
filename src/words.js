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
