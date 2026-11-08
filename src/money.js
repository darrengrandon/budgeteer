// Converting between what people type ("$1,234.50") and integer cents (123450).
// Only string and integer math: never multiply a float dollar amount by 100.

const AMOUNT_PATTERN = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d*))?$/;
const MAX_WHOLE_DOLLAR_DIGITS = 9;

/**
 * Read a dollar amount typed by a person and return whole cents.
 * Accepts "42", "42.5", ".50", "$1,234.50". Rejects negatives, more than 2 decimals,
 * badly placed commas and anything that is not a plain amount.
 * Throws a RangeError whose message is safe to show to the person.
 * @param {string} text
 * @returns {number} cents (0 or more)
 */
export function parseDollars(text) {
  if (typeof text !== 'string' || text.trim() === '') throw new RangeError('Type an amount, like 42.50.');
  const trimmed = text.trim();
  if (/^\$?\s*-/.test(trimmed)) throw new RangeError("The amount can't be negative.");

  const match = AMOUNT_PATTERN.exec(trimmed);
  const whole = match?.[1];
  const fraction = match?.[2] ?? '';
  if (!match || (whole === undefined && fraction === '')) {
    throw new RangeError("That doesn't look like an amount. Type it like 42.50.");
  }
  if (fraction.length > 2) {
    throw new RangeError('Amounts only go down to cents, so use at most 2 digits after the dot.');
  }
  const digits = (whole ?? '0').replaceAll(',', '').replace(/^0+(?=\d)/, '');
  if (digits.length > MAX_WHOLE_DOLLAR_DIGITS) throw new RangeError('That number is too big.');

  return Number(digits) * 100 + Number(fraction.padEnd(2, '0'));
}

/**
 * Show cents as dollars for display, like "$1,234.50" or "-$15.00".
 * @param {number} cents
 * @returns {string}
 */
export function formatCents(cents) {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`Expected whole cents, got ${cents}`);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Show cents as a plain amount to put back into a text box, like "1234.50".
 * @param {number} cents
 * @returns {string}
 */
export function centsToInput(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError(`Expected whole, non-negative cents, got ${cents}`);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
