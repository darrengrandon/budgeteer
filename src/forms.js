// Checking what people type into the forms. Pure functions, no DOM.
// Each returns { ok: true, ... } or { ok: false, error } with a message safe to show.

import { parseDollars, formatCents } from './money.js';
import { isISODate, dayNumber } from './budget.js';
import { LIMITS } from './storage.js';
import { splitTotalHint } from './words.js';

/**
 * A money amount that must be more than zero and no more than the app's limit.
 * @param {string} text
 * @returns {{ ok: true, cents: number } | { ok: false, error: string }}
 */
export function readAmount(text) {
  let cents;
  try {
    cents = parseDollars(text);
  } catch (error) {
    return { ok: false, error: /** @type {Error} */ (error).message };
  }
  if (cents === 0) return { ok: false, error: 'The amount has to be more than $0.' };
  if (cents > LIMITS.maxCents) {
    return { ok: false, error: `That's more than ${formatCents(LIMITS.maxCents)}. Check the amount.` };
  }
  return { ok: true, cents };
}

/**
 * A date that is a real day, today or earlier.
 * @param {string} text value of a date box, 'YYYY-MM-DD' or ''
 * @param {string} todayISO
 * @returns {{ ok: true, date: string } | { ok: false, error: string }}
 */
export function readPastDate(text, todayISO) {
  if (text === '') return { ok: false, error: 'Pick a date.' };
  if (!isISODate(text)) return { ok: false, error: 'Pick a real date.' };
  if (dayNumber(text) > dayNumber(todayISO)) {
    return { ok: false, error: "That date hasn't happened yet. Pick today or an earlier day." };
  }
  return { ok: true, date: text };
}

/**
 * A whole-number percent typed in a box, or NaN if it isn't one.
 * @param {string} text
 * @returns {number}
 */
export function toPercent(text) {
  const trimmed = String(text).trim();
  return /^\d{1,3}$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/**
 * The three split boxes. They must be whole numbers from 0 to 100 that total 100.
 * @param {{ spend: string, save: string, goals: string }} values
 * @returns {{ ok: true, split: { spend: number, save: number, goals: number } } | { ok: false, error: string }}
 */
export function readSplitInputs(values) {
  const split = { spend: toPercent(values.spend), save: toPercent(values.save), goals: toPercent(values.goals) };
  const ok = [split.spend, split.save, split.goals].every((v) => Number.isInteger(v) && v <= 100)
    && split.spend + split.save + split.goals === 100;
  return ok ? { ok: true, split } : { ok: false, error: splitTotalHint(split) };
}
