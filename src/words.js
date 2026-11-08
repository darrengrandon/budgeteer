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
 * The "a lot more" question, compared with the biggest of the recent paychecks so a normal
 * paycheck after a short week doesn't trigger it (overnight fix P3). Empty when it looks normal.
 * @param {number} cents
 * @param {number[]} recentCents recent paychecks, oldest first (the last one is the newest)
 * @returns {string}
 */
export function bigAmountWarningRecent(cents, recentCents) {
  if (recentCents.length === 0) return '';
  const biggest = Math.max(...recentCents);
  if (cents < biggest * 4) return '';
  if (biggest === recentCents[recentCents.length - 1]) return bigAmountWarning(cents, biggest);
  return `That's a lot more than your recent paychecks (the most was ${formatCents(biggest)}). Is ${formatCents(cents)} right?`;
}

/** Paychecks over this ask "Is that right?" before saving (SPEC.md, $3,000). */
export const PAYCHECK_CHECK_CENTS = 300_000;

/**
 * A question before saving any paycheck over $3,000, even the first (SPEC.md decision 13).
 * Empty at $3,000 or less.
 * @param {number} cents
 * @returns {string}
 */
export function overLimitWarning(cents) {
  if (cents <= PAYCHECK_CHECK_CENTS) return '';
  return `That's over ${moneyShort(PAYCHECK_CHECK_CENTS)}. Is ${formatCents(cents)} right?`;
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

// ---------------------------------------------------------------------------
// Tap-to-explain (lazy-v2 step 3a): one plain sentence for each number on Home.

/** How often, in words, for each stated pay frequency. */
const PAID_EVERY = Object.freeze({
  weekly: 'every week',
  biweekly: 'every 2 weeks',
  'twice-monthly': 'twice a month',
  monthly: 'once a month',
});

/**
 * Where "Spend about $X a week" comes from.
 * @param {number} weeklyPayCents
 * @param {number} spendPercent
 * @param {number} weeklySpendCents
 * @returns {string}
 */
export function explainHeadline(weeklyPayCents, spendPercent, weeklySpendCents) {
  if (spendPercent === 0) {
    return 'Your split puts 0% of each paycheck into Spend, so there is nothing to spend each week. You can change that in Settings.';
  }
  return `You get about ${aboutAmount(weeklyPayCents)} a week and ${spendPercent}% of each paycheck goes to Spend, `
    + `so about ${aboutAmount(weeklySpendCents)} a week is yours to spend.`;
}

/**
 * How "Out of about $X a week of pay" was worked out.
 * @param {{ averageCents: number, paydayCount: number, frequency: import('./storage.js').PayFrequency,
 *   gapDays: number, weeklyPayCents: number }} args
 * @returns {string}
 */
export function explainBasis({ averageCents, paydayCount, frequency, gapDays, weeklyPayCents }) {
  const pay = paydayCount === 1
    ? `Your payday was ${formatCents(averageCents)}`
    : `Your last ${paydayCount} paydays average ${formatCents(averageCents)}`;
  const week = `so that's about ${aboutAmount(weeklyPayCents)} a week.`;
  if (frequency !== 'varies') return `${pay} and you get paid ${PAID_EVERY[frequency]}, ${week}`;
  if (paydayCount === 1) return `${pay}, and until you log another one Budgeteer guesses you get paid every 2 weeks, ${week}`;
  return `${pay} and they come about every ${gapDays} days, ${week}`;
}

/**
 * What "$40 of $300" on a goal card means.
 * @param {{ name: string, savedCents: number, targetCents: number, first: boolean }} args
 * @returns {string}
 */
export function explainGoalAmounts({ name, savedCents, targetCents, first }) {
  if (savedCents >= targetCents) return `Your Goals money covers all ${moneyShort(targetCents)} for ${name}.`;
  const toGo = moneyShort(targetCents - savedCents);
  if (first) return `You have ${moneyShort(savedCents)} saved toward ${name}, which costs ${moneyShort(targetCents)}, so ${toGo} to go.`;
  return `Goals money fills your goals from the top, so ${name} has ${moneyShort(savedCents)} of its `
    + `${moneyShort(targetCents)} so far, with ${toGo} to go.`;
}

/**
 * How the date in "Ready in about N weeks (around ...)" was found.
 * @param {{ perPaydayCents: number, neededCents: number, dateISO: string, todayISO: string, first: boolean }} args
 * @returns {string}
 */
export function explainReady({ perPaydayCents, neededCents, dateISO, todayISO, first }) {
  const when = `should be there by the payday around ${shortDateFrom(dateISO, todayISO)}.`;
  const each = `About ${moneyShort(perPaydayCents)} of each paycheck goes to Goals`;
  return first
    ? `${each}, so the ${moneyShort(neededCents)} still needed ${when}`
    : `${each}, and the ${moneyShort(neededCents)} needed for this goal and the ones above it ${when}`;
}

/**
 * What "$95.00 left to spend" is made of.
 * @param {number} inCents everything paychecks put into Spend
 * @param {number} spentCents all logged purchases
 * @returns {string}
 */
export function explainLeftToSpend(inCents, spentCents) {
  const went = `Your paychecks put ${formatCents(inCents)} into Spend`;
  if (spentCents === 0) return `${went} and you haven't logged any purchases yet.`;
  return `${went} and you've logged ${formatCents(spentCents)} of purchases, so ${formatCents(inCents - spentCents)} is left.`;
}

/**
 * What one amount in the latest list was.
 * @param {{ kind: 'paycheck' | 'purchase' | 'goalPurchase', cents: number, name?: string }} item
 * @param {{ spend: number, save: number, goals: number }} [parts] a paycheck's cents per bucket
 * @returns {string}
 */
export function explainActivity(item, parts) {
  const money = formatCents(item.cents);
  if (item.kind === 'paycheck' && parts) {
    return `This ${money} paycheck put ${formatCents(parts.spend)} into Spend, ${formatCents(parts.save)} into Save `
      + `and ${formatCents(parts.goals)} into Goals.`;
  }
  if (item.kind === 'goalPurchase') return `This ${money} came out of Goals when you bought ${item.name}.`;
  return `This ${money} purchase came out of Spend.`;
}
