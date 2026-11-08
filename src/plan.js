// What Home shows, worked out from the records. Pure, so it is tested without a browser.

import { weeklyPay, weeklySpendCents, gotPaidDue, paydays } from './pay.js';
import { projectGoals } from './goals.js';
import { balances } from './storage.js';
import { spendHeadline, payBasis, goalAmounts, readyLine } from './words.js';

/** @typedef {import('./storage.js').State} State */
/** @typedef {import('./storage.js').Split} Split */

/**
 * @typedef {object} GoalCard
 * @property {string} id
 * @property {string} name
 * @property {number} targetCents
 * @property {number} savedCents
 * @property {number} weeks
 * @property {boolean} funded the whole price is covered: "Buy it" can be offered
 * @property {string} amounts "$40 of $300"
 * @property {string} line "Ready in about 9 weeks (around Jan 9)" or "You can buy it!"
 * @property {boolean} canMoveToBuy not first, but Goals already holds its price (REVIEW.md L6)
 */

/** "Back up your info" shows after this many paychecks since the last backup on this phone. */
const PAYCHECKS_PER_BACKUP = 4;

/**
 * True when it is time to suggest a backup (REVIEW.md L4).
 * @param {number} paycheckCount paychecks now
 * @param {number | null} lastCount paychecks at the last backup (or "Not now") on this phone
 * @returns {boolean}
 */
export function backupDue(paycheckCount, lastCount) {
  return paycheckCount - (lastCount ?? 0) >= PAYCHECKS_PER_BACKUP;
}

/**
 * Everything on Home, top to bottom (SPEC.md "Home").
 * Pass a trial split to preview what a different split would do; nothing is saved.
 * @param {State} state
 * @param {string} todayISO
 * @param {Split} [split]
 * @returns {{ headline: string, basis: string, nudge: boolean, goals: GoalCard[] }}
 */
export function homePlan(state, todayISO, split = state.split) {
  const pay = weeklyPay(state.paychecks, todayISO);
  const projection = projectGoals(state, todayISO, split, pay);
  const days = paydays(state.paychecks, todayISO);
  const lastPayday = days.length > 0 ? days[days.length - 1].date : todayISO;
  const goalsBalance = balances(state).goals;
  return {
    headline: spendHeadline(weeklySpendCents(pay, split.spend)),
    basis: pay ? payBasis(Math.round((pay.cents * 7) / pay.days)) : '',
    nudge: gotPaidDue(state.paychecks, todayISO),
    goals: projection.goals.map(({ goal, savedCents, weeks }, index) => {
      const funded = savedCents >= goal.targetCents;
      const canMoveToBuy = index > 0 && !funded && goal.targetCents <= goalsBalance;
      return {
        id: goal.id,
        name: goal.name,
        targetCents: goal.targetCents,
        savedCents,
        weeks,
        funded,
        canMoveToBuy,
        amounts: goalAmounts(savedCents, goal.targetCents),
        line: canMoveToBuy
          ? "The money's already in Goals. Move it to the top to buy it now."
          : readyLine({
            savedCents, targetCents: goal.targetCents, weeks, hasPay: pay !== null, goalsPercent: split.goals,
            todayISO, fromISO: lastPayday,
          }),
      };
    }),
  };
}
