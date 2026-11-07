// Core budget logic. Pure functions, no DOM, no storage. All money is integer cents.
// Ticket 001 implements these until tests/budget.test.js passes.

/**
 * Split one paycheck into buckets by whole-number percents that total 100.
 * Uses largest-remainder rounding so the parts always add up to the amount.
 * Ties go to the bucket listed first.
 * Throws a RangeError if amountCents is not a non-negative integer or percents do not total 100.
 * @param {number} amountCents
 * @param {Record<string, number>} percents e.g. { spend: 50, save: 30, goals: 20 }
 * @returns {Record<string, number>} cents per bucket, same keys as percents
 */
export function splitIncome(amountCents, percents) {
  throw new Error('not implemented');
}

/**
 * Whole weeks until a goal is reached at a steady weekly contribution.
 * 0 if already reached. Infinity if it can never be reached (weekly <= 0).
 * @param {{targetCents: number, savedCents: number, weeklyCents: number}} args
 * @returns {number}
 */
export function weeksToGoal({ targetCents, savedCents, weeklyCents }) {
  throw new Error('not implemented');
}

/**
 * Average weekly income over the trailing window, in cents (rounded).
 * Counts paychecks dated after (today - windowDays) and up to and including today.
 * Dates are 'YYYY-MM-DD' strings; do not use local-time Date parsing.
 * @param {{date: string, cents: number}[]} paychecks
 * @param {string} todayISO
 * @param {number} [windowDays=28]
 * @returns {number}
 */
export function averageWeeklyIncome(paychecks, todayISO, windowDays = 28) {
  throw new Error('not implemented');
}
