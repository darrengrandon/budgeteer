// Goals: how Goals-bucket money is shared out, and how many weeks until each goal.
// Pure functions. All money is integer cents.

import { weeksToGoal, averageWeeklyIncome } from './budget.js';
import { balances } from './storage.js';

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
 * @param {{ goalsBalanceCents: number, goals: Goal[], weeklyCents: number }} args
 * @returns {{ savedCents: number, weeks: number }[]}
 */
export function goalProjections({ goalsBalanceCents, goals, weeklyCents }) {
  const saved = allocateToGoals(goalsBalanceCents, goals);
  let targetSoFar = 0;
  return goals.map((goal, i) => {
    targetSoFar += goal.targetCents;
    return {
      savedCents: saved[i],
      weeks: weeksToGoal({ targetCents: targetSoFar, savedCents: goalsBalanceCents, weeklyCents }),
    };
  });
}

/**
 * Everything the Goals section shows, from the records.
 * Pass a trial split to see "what if" weeks; it changes only future money, not what is saved.
 * @param {State} state
 * @param {string} todayISO
 * @param {Split} [split] defaults to the real split
 */
export function projectGoals(state, todayISO, split = state.split) {
  const goalsBalanceCents = balances(state).goals;
  const averageWeeklyCents = averageWeeklyIncome(state.paychecks, todayISO);
  const weeklyCents = weeklyGoalsCents(averageWeeklyCents, split.goals);
  const projections = goalProjections({ goalsBalanceCents, goals: state.goals, weeklyCents });
  const assigned = projections.reduce((sum, p) => sum + p.savedCents, 0);
  return {
    averageWeeklyCents,
    weeklyCents,
    goalsPercent: split.goals,
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
