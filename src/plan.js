// What Home shows, worked out from the records. Pure, so it is tested without a browser.

import { weeklyPay, weeklySpendCents, gotPaidDue, paydays, payGap, gapDays } from './pay.js';
import { projectGoals } from './goals.js';
import { balances, paycheckParts } from './storage.js';
import { splitIncome, addDays } from './budget.js';
import {
  spendHeadline, payBasis, goalAmounts, readyLine, shortDateFrom,
  explainHeadline, explainBasis, explainGoalAmounts, explainReady, explainLeftToSpend, explainGoal,
} from './words.js';

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
 * @property {string} line "Ready around Jan 9 (in about 9 weeks)" or "You can buy it!"
 * @property {boolean} canMoveToBuy not first, but Goals already holds its price (REVIEW.md L6)
 * @property {string} amountsExplain what "$40 of $300" means (step 3a)
 * @property {string} lineExplain how the ready date was found; '' when the line has no number
 * @property {string} readyDate the date in "Ready around Dec 19 (...)", shown big on Home; '' otherwise
 * @property {string} explain one plain sentence about the card's numbers, for its "?"
 */

/** Recent paydays that count toward weekly pay (src/pay.js). */
const RECENT_PAYDAYS = 6;

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
 * @returns {{ headline: string, basis: string, nudge: boolean, goals: GoalCard[],
 *   explain: { headline: string, basis: string }, weeklySpendCents: number | null }}
 */
export function homePlan(state, todayISO, split = state.split) {
  const frequency = state.settings?.payFrequency ?? 'varies';
  const pay = weeklyPay(state.paychecks, todayISO, frequency);
  const projection = projectGoals(state, todayISO, split, pay);
  const days = paydays(state.paychecks, todayISO);
  const lastPayday = days.length > 0 ? days[days.length - 1].date : todayISO;
  const goalsBalance = balances(state).goals;
  // The goal date is the payday when the money will really be there, so it is never early:
  // a typical payday (the average, rounded down) split the way the app splits it, repeated
  // every usual gap after the last payday (SPEC.md "When can I buy it").
  const gap = payGap(state.paychecks, todayISO, frequency);
  const typical = pay ? Math.floor((pay.cents * gap.num) / (pay.days * gap.den)) : 0;
  const perPayday = typical > 0 ? splitIncome(typical, split).goals : 0;
  const weeklySpend = weeklySpendCents(pay, split.spend);
  const weeklyPayCents = pay ? Math.round((pay.cents * 7) / pay.days) : 0;
  let targetSoFar = 0;
  return {
    headline: spendHeadline(weeklySpend),
    weeklySpendCents: weeklySpend,
    basis: pay ? payBasis(weeklyPayCents) : '',
    nudge: gotPaidDue(state.paychecks, todayISO, frequency),
    explain: pay ? {
      headline: explainHeadline(weeklyPayCents, split.spend, weeklySpend ?? 0),
      basis: explainBasis({
        averageCents: typical,
        paydayCount: Math.min(days.length, RECENT_PAYDAYS),
        frequency,
        gapDays: gap.num / gap.den,
        weeklyPayCents,
      }),
    } : { headline: '', basis: '' },
    goals: projection.goals.map(({ goal, savedCents, weeks }, index) => {
      const funded = savedCents >= goal.targetCents;
      const canMoveToBuy = index > 0 && !funded && goal.targetCents <= goalsBalance;
      targetSoFar += goal.targetCents;
      const neededCents = targetSoFar - goalsBalance;
      const paydaysNeeded = perPayday > 0 ? Math.ceil(neededCents / perPayday) : Infinity;
      const dateISO = Number.isFinite(paydaysNeeded) ? addDays(lastPayday, gapDays(gap, paydaysNeeded)) : undefined;
      const line = canMoveToBuy
        ? "The money's already in Goals. Move it to the top to buy it now."
        : readyLine({
          savedCents,
          targetCents: goal.targetCents,
          weeks: Number.isFinite(paydaysNeeded) ? weeks : Infinity,
          hasPay: pay !== null,
          goalsPercent: split.goals,
          todayISO,
          dateISO,
        });
      return {
        id: goal.id,
        name: goal.name,
        targetCents: goal.targetCents,
        savedCents,
        weeks,
        funded,
        canMoveToBuy,
        amounts: goalAmounts(savedCents, goal.targetCents),
        line,
        amountsExplain: explainGoalAmounts({ name: goal.name, savedCents, targetCents: goal.targetCents, first: index === 0 }),
        // Only "Ready around ... (in about N weeks)" has a number to explain (readyLine).
        lineExplain: line.startsWith('Ready around') && dateISO
          ? explainReady({ perPaydayCents: perPayday, neededCents, dateISO, todayISO, first: index === 0 })
          : '',
        readyDate: line.startsWith('Ready around') && dateISO ? shortDateFrom(dateISO, todayISO) : '',
        explain: explainGoal({
          name: goal.name, savedCents, targetCents: goal.targetCents, first: index === 0, line, perPaydayCents: perPayday, dateISO, todayISO,
        }),
      };
    }),
  };
}

/**
 * What "$95.00 left to spend" is made of (step 3a).
 * @param {State} state
 * @returns {string}
 */
export function spendingExplain(state) {
  const inCents = state.paychecks.reduce((sum, p) => sum + paycheckParts(p).spend, 0);
  const spentCents = state.purchases.reduce((sum, b) => sum + b.cents, 0);
  return explainLeftToSpend(inCents, spentCents);
}

/**
 * The amount for the one-tap "Same as last time" on Home (step 3b): the last paycheck added.
 * Null before any paycheck, and when that amount was already logged today or yesterday,
 * because logging it again is probably a repeat (SPEC.md decision 13).
 * @param {State} state
 * @param {string} todayISO
 * @returns {number | null}
 */
export function sameAgainCents(state, todayISO) {
  const last = state.paychecks[state.paychecks.length - 1];
  if (!last) return null;
  const yesterday = addDays(todayISO, -1);
  const repeat = state.paychecks.some((p) => p.cents === last.cents && (p.date === todayISO || p.date === yesterday));
  return repeat ? null : last.cents;
}
