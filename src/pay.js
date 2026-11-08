// Weekly pay, learned from the gaps between paydays (SPEC.md "The numbers", docs/adr/0004).
// Pure functions. All money is integer cents; weekly pay is kept as an exact fraction.

import { dayNumber } from './budget.js';

/** How many recent paydays count. */
const RECENT_PAYDAYS = 6;
/** The usual gap when there is only one payday: paid every 2 weeks. */
const DEFAULT_GAP_DAYS = 14;
/** "Got paid? Log it." waits this many days past the usual gap. */
const GRACE_DAYS = 2;

/**
 * @typedef {{ date: string, cents: number }} PaycheckLike
 * @typedef {{ cents: number, days: number }} WeeklyPay cents earned per this many days
 */

/**
 * Paychecks grouped by date (two on one day are one payday), oldest first.
 * Paychecks dated after today are left out.
 * @param {PaycheckLike[]} paychecks
 * @param {string} todayISO
 * @returns {{ date: string, cents: number }[]}
 */
export function paydays(paychecks, todayISO) {
  const today = dayNumber(todayISO);
  /** @type {Map<string, number>} */
  const byDate = new Map();
  for (const { date, cents } of paychecks) {
    if (dayNumber(date) > today) continue;
    byDate.set(date, (byDate.get(date) ?? 0) + cents);
  }
  return [...byDate].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([date, cents]) => ({ date, cents }));
}

/**
 * @param {PaycheckLike[]} paychecks
 * @param {string} todayISO
 */
function recentPaydays(paychecks, todayISO) {
  return paydays(paychecks, todayISO).slice(-RECENT_PAYDAYS);
}

/**
 * The median number of days between the recent paydays, rounded to a whole day
 * (half a day rounds up). 14 when there are fewer than two paydays.
 * @param {PaycheckLike[]} paychecks
 * @param {string} todayISO
 * @returns {number}
 */
export function usualGapDays(paychecks, todayISO) {
  const days = recentPaydays(paychecks, todayISO).map((p) => dayNumber(p.date));
  if (days.length < 2) return DEFAULT_GAP_DAYS;
  const gaps = days.slice(1).map((day, i) => day - days[i]).sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 === 1 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2;
  return Math.round(median);
}

/**
 * Weekly pay as an exact fraction: the recent paydays' total, earned over
 * (number of recent paydays x usual gap) days. Weekly cents = cents x 7 / days.
 * Null when there is no payday yet.
 * @param {PaycheckLike[]} paychecks
 * @param {string} todayISO
 * @returns {WeeklyPay | null}
 */
export function weeklyPay(paychecks, todayISO) {
  const recent = recentPaydays(paychecks, todayISO);
  if (recent.length === 0) return null;
  const cents = recent.reduce((sum, p) => sum + p.cents, 0);
  return { cents, days: recent.length * usualGapDays(paychecks, todayISO) };
}

/**
 * Weekly pay times the Spend percent, rounded to whole cents. Null with no weekly pay.
 * @param {WeeklyPay | null} pay
 * @param {number} spendPercent
 * @returns {number | null}
 */
export function weeklySpendCents(pay, spendPercent) {
  if (!pay) return null;
  return Math.round((pay.cents * 7 * spendPercent) / (pay.days * 100));
}

/**
 * True when the last payday is more than the usual gap plus 2 days ago.
 * @param {PaycheckLike[]} paychecks
 * @param {string} todayISO
 * @returns {boolean}
 */
export function gotPaidDue(paychecks, todayISO) {
  const all = paydays(paychecks, todayISO);
  if (all.length === 0) return false;
  const daysSince = dayNumber(todayISO) - dayNumber(all[all.length - 1].date);
  return daysSince > usualGapDays(paychecks, todayISO) + GRACE_DAYS;
}
