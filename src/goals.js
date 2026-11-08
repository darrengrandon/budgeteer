// Goals: how Goals-bucket money is shared out, and how many weeks until each goal.
// Pure functions. All money is integer cents.

import { weeksToGoal, incomeInWindow, isISODate } from './budget.js';
import { balances, nextId, LIMITS } from './storage.js';

/** The old 28-day window, used only when no weekly pay is given. */
const WINDOW_DAYS = 28;

/** @typedef {import('./storage.js').State} State */
/** @typedef {import('./storage.js').Goal} Goal */
/** @typedef {import('./storage.js').Split} Split */

/**
 * Fill goals top to bottom, each up to its target (SPEC.md Decisions 2).
 * Money beyond every target stays unassigned.
 * @param {number} goalsBucketCents what is in the Goals bucket
 * @param {Goal[]} goals in priority order
 * @returns {number[]} saved cents for each goal, same order
 */
export function allocateToGoals(goalsBucketCents, goals) {
  if (!Number.isSafeInteger(goalsBucketCents) || goalsBucketCents < 0) {
    throw new RangeError(`Goals bucket must be whole, non-negative cents, got ${goalsBucketCents}`);
  }
  let left = goalsBucketCents;
  return goals.map((goal) => {
    const saved = Math.min(left, goal.targetCents);
    left -= saved;
    return saved;
  });
}

/**
 * Cents a week going into Goals: average weekly pay times the Goals percent, rounded.
 * @param {number} averageWeeklyCents
 * @param {number} goalsPercent
 * @returns {number}
 */
export function weeklyGoalsCents(averageWeeklyCents, goalsPercent) {
  return Math.round((averageWeeklyCents * goalsPercent) / 100);
}

/**
 * Saved cents and weeks to go for each goal. Because goals fill top to bottom, a goal is
 * reached when the Goals bucket covers its target plus every target above it.
 * The weekly amount is weeklyCents / per, so an exact fraction (like $2.125) can be passed
 * as whole numbers and nothing is rounded before the weeks are worked out.
 * @param {{ goalsBalanceCents: number, goals: Goal[], weeklyCents: number, per?: number }} args
 * @returns {{ savedCents: number, weeks: number }[]}
 */
export function goalProjections({ goalsBalanceCents, goals, weeklyCents, per = 1 }) {
  if (!Number.isSafeInteger(per) || per < 1) throw new RangeError(`per must be a whole number, at least 1, got ${per}`);
  const saved = allocateToGoals(goalsBalanceCents, goals);
  let targetSoFar = 0;
  return goals.map((goal, i) => {
    targetSoFar += goal.targetCents;
    // Scale every amount by "per" so weeksToGoal sees whole numbers with the same ratio.
    const savedSoFar = Math.min(goalsBalanceCents, targetSoFar);
    return {
      savedCents: saved[i],
      weeks: weeksToGoal({ targetCents: targetSoFar * per, savedCents: savedSoFar * per, weeklyCents }),
    };
  });
}

/**
 * Everything the goal cards show, from the records.
 * Pass a trial split to see "what if" weeks; it changes only future money, not what is saved.
 * Pass weekly pay as an exact fraction { cents, days } (see src/pay.js), or null for none;
 * without it, the 28-day window is used.
 * @param {State} state
 * @param {string} todayISO
 * @param {Split} [split] defaults to the real split
 * @param {{ cents: number, days: number } | null} [pay]
 */
export function projectGoals(state, todayISO, split = state.split,
  pay = { cents: incomeInWindow(state.paychecks, todayISO, WINDOW_DAYS), days: WINDOW_DAYS }) {
  const income = pay ?? { cents: 0, days: WINDOW_DAYS };
  const goalsBalanceCents = balances(state).goals;
  // Shown to the teen, rounded to the cent.
  const averageWeeklyCents = Math.round((income.cents * 7) / income.days);
  const weeklyCents = weeklyGoalsCents(averageWeeklyCents, split.goals);
  // Used for the weeks, exactly: pay x 7 / days x Goals % / 100.
  const exactWeekly = income.cents * 7 * split.goals;
  const projections = goalProjections({
    goalsBalanceCents, goals: state.goals, weeklyCents: exactWeekly, per: income.days * 100,
  });
  const assigned = projections.reduce((sum, p) => sum + p.savedCents, 0);
  return {
    averageWeeklyCents,
    weeklyCents,
    goalsPercent: split.goals,
    hasPaychecks: state.paychecks.length > 0,
    unassignedCents: goalsBalanceCents - assigned,
    goals: state.goals.map((goal, i) => ({ goal, ...projections[i] })),
  };
}

/**
 * A trial split for the what-if slider: percent moves between Spend and Goals, Save stays put.
 * @param {Split} split the real split
 * @param {number} goalsPercent the trial Goals percent, 0 to spend + goals
 * @returns {Split}
 */
export function trialSplit(split, goalsPercent) {
  const shared = split.spend + split.goals;
  if (!Number.isInteger(goalsPercent) || goalsPercent < 0 || goalsPercent > shared) {
    throw new RangeError(`Goals percent must be a whole number from 0 to ${shared}, got ${goalsPercent}`);
  }
  return { spend: shared - goalsPercent, save: split.save, goals: goalsPercent };
}

/**
 * Goal projections for a trial Goals percent next to the real ones. Changes nothing.
 * @param {State} state
 * @param {string} todayISO
 * @param {number} goalsPercent
 */
export function whatIf(state, todayISO, goalsPercent) {
  const split = trialSplit(state.split, goalsPercent);
  return {
    split,
    trial: projectGoals(state, todayISO, split),
    current: projectGoals(state, todayISO),
  };
}

/**
 * Buy it (SPEC.md decisions 7 and 8): record that a fully saved goal was bought.
 * The real price comes out of Goals, but never more than the goal's price; if it cost less,
 * the rest stays in Goals for the next goal. The goal is removed and a goal purchase kept.
 * @param {State} state a version 2 or 3 state
 * @param {string} goalId
 * @param {{ cents: number, date: string }} purchase the real price and the day
 * @returns {State}
 */
export function buyGoal(state, goalId, { cents, date }) {
  if (state.version === 1 || !state.goalPurchases) throw new RangeError('Upgrade the state to version 2 first.');
  const index = state.goals.findIndex((g) => g.id === goalId);
  if (index === -1) throw new RangeError(`No goal with id ${goalId}`);
  const goal = state.goals[index];
  if (!Number.isInteger(cents) || cents < 1 || cents > LIMITS.maxCents) {
    throw new RangeError('The price must be more than $0, in whole cents.');
  }
  if (!isISODate(date)) throw new RangeError('The date must be a real date.');
  const saved = allocateToGoals(balances(state).goals, state.goals)[index];
  if (saved < goal.targetCents) throw new RangeError(`"${goal.name}" isn't fully saved yet.`);
  if (state.goalPurchases.length >= LIMITS.maxRecords) throw new RangeError('You have too many goal buys logged.');

  const record = { id: nextId('x', state.goalPurchases), date, cents: Math.min(cents, goal.targetCents), name: goal.name };
  return {
    ...state,
    goals: state.goals.filter((g) => g.id !== goalId),
    goalPurchases: [...state.goalPurchases, record],
  };
}
