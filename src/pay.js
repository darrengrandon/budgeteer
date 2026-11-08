// Weekly pay from the usual gap between paydays (SPEC.md "The numbers", docs/adr/0004 and 0007).
// The teen's answer to "How often do you get paid?" sets the gap; only "It's different every
// time" learns it from logged paydays. Pure functions. All money is integer cents; weekly pay
// and the gap are kept as exact fractions.

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
 * @typedef {{ num: number, den: number }} Gap the usual gap is num ÷ den days
 * @typedef {import('./storage.js').PayFrequency} PayFrequency
 */

/** The gap each stated answer means. Twice a month is 24 paydays a year; once a month, 12. */
const STATED_GAPS = Object.freeze({
  weekly: { num: 7, den: 1 },
  biweekly: { num: 14, den: 1 },
  'twice-monthly': { num: 365, den: 24 },
  monthly: { num: 365, den: 12 },
});

/**
 * The usual gap between paydays as an exact fraction of days: the stated answer, or for
 * "It's different every time" the gap learned from logged paydays (usualGapDays).
 * @param {PaycheckLike[]} paychecks
 * @param {string} todayISO
 * @param {PayFrequency} [frequency]
 * @returns {Gap}
 */
export function payGap(paychecks, todayISO, frequency = 'varies') {
  if (frequency !== 'varies' && Object.hasOwn(STATED_GAPS, frequency)) return STATED_GAPS[frequency];
  return { num: usualGapDays(paychecks, todayISO), den: 1 };
}

/**
 * Days after the last payday until the k-th next one, rounded up so a date is never early.
 * @param {Gap} gap
 * @param {number} k
 * @returns {number}
 */
export function gapDays(gap, k) {
  return Math.ceil((k * gap.num) / gap.den);
}

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
 * @param {PayFrequency} [frequency]
 * @returns {string[]} 'YYYY-MM-DD' dates, oldest first
 */
export function missedPaydays(paychecks, todayISO, frequency = 'varies') {
  const all = paydays(paychecks, todayISO);
  if (all.length === 0) return [];
  const gap = payGap(paychecks, todayISO, frequency);
  const lastDate = all[all.length - 1].date;
  const passed = Math.floor(((dayNumber(todayISO) - dayNumber(lastDate)) * gap.den) / gap.num);
  /** @type {string[]} */
  const missed = [];
  for (let i = 1; i < passed && missed.length < MAX_MISSED; i++) missed.push(addDays(lastDate, gapDays(gap, i)));
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
 * A gap of num/den days is kept whole by multiplying both sides by den.
 * Null when there is no payday yet.
 * @param {PaycheckLike[]} paychecks
 * @param {string} todayISO
 * @param {PayFrequency} [frequency]
 * @returns {WeeklyPay | null}
 */
export function weeklyPay(paychecks, todayISO, frequency = 'varies') {
  const recent = recentPaydays(paychecks, todayISO);
  if (recent.length === 0) return null;
  const total = recent.reduce((sum, p) => sum + p.cents, 0);
  const gap = payGap(paychecks, todayISO, frequency);
  return { cents: total * gap.den, days: recent.length * gap.num };
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
 * @param {PayFrequency} [frequency]
 * @returns {boolean}
 */
export function gotPaidDue(paychecks, todayISO, frequency = 'varies') {
  const all = paydays(paychecks, todayISO);
  if (all.length === 0) return false;
  const daysSince = dayNumber(todayISO) - dayNumber(all[all.length - 1].date);
  const gap = payGap(paychecks, todayISO, frequency);
  return daysSince * gap.den > gap.num + GRACE_DAYS * gap.den;
}
