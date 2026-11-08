// Core budget logic. Pure functions, no DOM, no storage. All money is integer cents.

const MS_PER_DAY = 86_400_000;

/**
 * Turn a 'YYYY-MM-DD' string into a whole day number (days since 1970-01-01, UTC).
 * Uses Date.UTC so the result never depends on the device's time zone.
 * Throws a RangeError for anything that is not a real calendar date.
 * @param {string} iso
 * @returns {number}
 */
export function dayNumber(iso) {
  const match = typeof iso === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!match) throw new RangeError(`Not a YYYY-MM-DD date: ${String(iso)}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`Not a real date: ${iso}`);
  }
  return ms / MS_PER_DAY;
}

/**
 * The device's local calendar day as 'YYYY-MM-DD' (what "today" means to the person).
 * @param {Date} [date]
 * @returns {string}
 */
export function localISODate(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * True if the value is a 'YYYY-MM-DD' string for a real calendar date.
 * @param {unknown} iso
 * @returns {boolean}
 */
export function isISODate(iso) {
  try {
    dayNumber(/** @type {string} */ (iso));
    return true;
  } catch {
    return false;
  }
}

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
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > Number.MAX_SAFE_INTEGER / 100) {
    throw new RangeError(`Amount must be a whole, non-negative number of cents, got ${amountCents}`);
  }
  const keys = Object.keys(percents ?? {});
  if (keys.length === 0) throw new RangeError('Percents must total 100, got no buckets');
  for (const key of keys) {
    const pct = percents[key];
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      throw new RangeError(`Percent for ${key} must be a whole number from 0 to 100, got ${pct}`);
    }
  }
  const total = keys.reduce((sum, key) => sum + percents[key], 0);
  if (total !== 100) throw new RangeError(`Percents must total 100, got ${total}`);

  /** @type {Record<string, number>} */
  const result = {};
  const remainders = keys.map((key, index) => {
    const scaled = amountCents * percents[key]; // exact: both are small integers
    result[key] = Math.floor(scaled / 100);
    return { key, index, remainder: scaled % 100 };
  });

  let leftover = amountCents - keys.reduce((sum, key) => sum + result[key], 0);
  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { key } of remainders) {
    if (leftover === 0) break;
    result[key] += 1;
    leftover -= 1;
  }
  return result;
}

/**
 * Whole weeks until a goal is reached at a steady weekly contribution.
 * 0 if already reached. Infinity if it can never be reached (weekly <= 0).
 * Throws a RangeError if any amount is not a whole number of cents, or target/saved is negative.
 * @param {{targetCents: number, savedCents: number, weeklyCents: number}} args
 * @returns {number}
 */
export function weeksToGoal({ targetCents, savedCents, weeklyCents }) {
  for (const [name, value] of Object.entries({ targetCents, savedCents, weeklyCents })) {
    if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be whole cents, got ${value}`);
  }
  if (targetCents < 0 || savedCents < 0) throw new RangeError('Target and saved amounts cannot be negative');

  const left = targetCents - savedCents;
  if (left <= 0) return 0;
  if (weeklyCents <= 0) return Infinity;
  return Math.ceil(left / weeklyCents);
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
  return Math.round((incomeInWindow(paychecks, todayISO, windowDays) * 7) / windowDays);
}

/**
 * Total cents of paychecks dated after (today - windowDays) and up to and including today.
 * @param {{date: string, cents: number}[]} paychecks
 * @param {string} todayISO
 * @param {number} [windowDays=28]
 * @returns {number}
 */
export function incomeInWindow(paychecks, todayISO, windowDays = 28) {
  if (!Number.isInteger(windowDays) || windowDays < 1) {
    throw new RangeError(`windowDays must be a whole number of days, at least 1, got ${windowDays}`);
  }
  const today = dayNumber(todayISO);
  const earliest = today - windowDays; // exclusive

  let total = 0;
  for (const paycheck of paychecks) {
    if (!Number.isSafeInteger(paycheck.cents) || paycheck.cents < 0) {
      throw new RangeError(`Paycheck cents must be whole and non-negative, got ${paycheck.cents}`);
    }
    const day = dayNumber(paycheck.date);
    if (day > earliest && day <= today) total += paycheck.cents;
  }
  return total;
}
