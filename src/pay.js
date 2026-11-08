// Weekly pay, learned from the gaps between paydays (SPEC.md "The numbers", docs/adr/0004).
// Pure functions. All money is integer cents; weekly pay is kept as an exact fraction.

import { dayNumber, addDays } from './budget.js';

/** How many recent paydays count. */
const RECENT_PAYDAYS = 6;
/** Paychecks fewer than this many days apart are one payday. */
const SAME_PAYDAY_DAYS = 4;
/** Never offer to add more missed paychecks than this at once. */
const MAX_MISSED = 6;
/** The usual gap when there is only one payday: paid every 2 weeks. */
const DEFAULT_GAP_DAYS = 14;
/** "Got paid? Log it." waits this many days past the usual gap. */
const GRACE_DAYS = 2;

/**
 * @typedef {{ date: string, cents: number }} PaycheckLike
 * @typedef {{ cents: number, days: number }} WeeklyPay cents earned per this many days
 */

/**
 * Paychecks grouped into paydays, oldest first. A paycheck less than 4 days after the
 * first paycheck of a payday joins it: a duplicate, or a second job paying a few days
 * apart, never fakes a 1-day gap (REVIEW.md L1). Paychecks dated after today are left out.
 * @param {PaycheckLike[]} paychecks
 * @param {string} todayISO
 * @returns {{ date: string, cents: number }[]}
 */
export function paydays(paychecks, todayISO) {
  const today = dayNumber(todayISO);
  const sorted = paychecks
    .filter(({ date }) => dayNumber(date) <= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  /** @type {{ date: string, cents: number }[]} */
  const groups = [];
  for (const { date, cents } of sorted) {
    const last = groups[groups.length - 1];
    if (last && dayNumber(date) - dayNumber(last.date) < SAME_PAYDAY_DAYS) last.cents += cents;
    else groups.push({ date, cents });
  }
  return groups;
}

/**
 * Paydays the teen most likely skipped (REVIEW.md L2). Expected paydays come every usual gap
 * after the last one. The paycheck being logged today stands for the latest of them that has
 * passed, so only the ones before it are missed (overnight fix P4: offering that one too
 * counted a single payday twice).
 * @param {PaycheckLike[]} paychecks
 * @param {string} todayISO
 * @returns {string[]} 'YYYY-MM-DD' dates, oldest first
 */
export function missedPaydays(paychecks, todayISO) {
  const all = paydays(paychecks, todayISO);
  if (all.length === 0) return [];
  const gap = usualGapDays(paychecks, todayISO);
  const lastDate = all[all.length - 1].date;
  const passed = Math.floor((dayNumber(todayISO) - dayNumber(lastDate)) / gap);
  /** @type {string[]} */
  const missed = [];
  for (let i = 1; i < passed && missed.length < MAX_MISSED; i++) missed.push(addDays(lastDate, i * gap));
  return missed;
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
