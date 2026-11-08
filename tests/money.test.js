import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDollars, formatCents, centsToInput } from '../src/money.js';

// parseDollars: the cases from ticket 003

test('parseDollars reads the ticket examples', () => {
  assert.equal(parseDollars('19.99'), 1999);
  assert.equal(parseDollars('0.1'), 10);
  assert.equal(parseDollars('$1,234.50'), 123450);
  assert.throws(() => parseDollars('12.345'), RangeError);
  assert.throws(() => parseDollars('abc'), RangeError);
});

test('parseDollars reads other everyday ways of typing money', () => {
  assert.equal(parseDollars('42'), 4200);
  assert.equal(parseDollars(' 42.5 '), 4250);
  assert.equal(parseDollars('.50'), 50);
  assert.equal(parseDollars('5.'), 500);
  assert.equal(parseDollars('$ 7.05'), 705);
  assert.equal(parseDollars('1,000'), 100000);
  assert.equal(parseDollars('1000000'), 100000000);
  assert.equal(parseDollars('007'), 700);
});

test('parseDollars reads zero as zero (the form decides if zero is allowed)', () => {
  assert.equal(parseDollars('0'), 0);
  assert.equal(parseDollars('0.00'), 0);
});

test('parseDollars never uses floating point (no 0.1 + 0.2 drift)', () => {
  assert.equal(parseDollars('0.29'), 29);
  assert.equal(parseDollars('1.15'), 115);
  assert.equal(parseDollars('4.35'), 435);
  assert.equal(parseDollars('19.99'), 1999);
});

test('parseDollars gives a friendly reason for each kind of bad amount', () => {
  assert.throws(() => parseDollars(''), { name: 'RangeError', message: /type an amount/i });
  assert.throws(() => parseDollars('   '), { name: 'RangeError', message: /type an amount/i });
  assert.throws(() => parseDollars('-5'), { name: 'RangeError', message: /negative/i });
  assert.throws(() => parseDollars('$-5.00'), { name: 'RangeError', message: /negative/i });
  assert.throws(() => parseDollars('12.345'), { name: 'RangeError', message: /2 digits/i });
  assert.throws(() => parseDollars('abc'), { name: 'RangeError', message: /like 42\.50/i });
  assert.throws(() => parseDollars('1234567890'), { name: 'RangeError', message: /too big/i });
});

test('parseDollars rejects things that only look like numbers', () => {
  for (const bad of ['$', '.', '1e3', 'Infinity', 'NaN', '0x10', '1,00', '12,34.5', '1 000', '1.2.3', '١٢', '5$', '+5']) {
    assert.throws(() => parseDollars(bad), RangeError, bad);
  }
});

test('parseDollars rejects input that is not text', () => {
  assert.throws(() => parseDollars(/** @type {any} */ (42)), RangeError);
  assert.throws(() => parseDollars(/** @type {any} */ (null)), RangeError);
});

// formatCents

test('formatCents shows dollars with cents and thousands commas', () => {
  assert.equal(formatCents(0), '$0.00');
  assert.equal(formatCents(5), '$0.05');
  assert.equal(formatCents(4250), '$42.50');
  assert.equal(formatCents(123450), '$1,234.50');
  assert.equal(formatCents(100000000), '$1,000,000.00');
  assert.equal(formatCents(-1500), '-$15.00');
});

test('formatCents refuses anything that is not whole cents', () => {
  assert.throws(() => formatCents(1.5), RangeError);
  assert.throws(() => formatCents(Number.NaN), RangeError);
});

test('formatCents and parseDollars round-trip', () => {
  for (const cents of [0, 1, 99, 100, 4250, 123456, 100000000]) {
    assert.equal(parseDollars(formatCents(cents)), cents);
  }
});

// centsToInput: for pre-filling an amount box

test('centsToInput gives a plain amount to put back in a text box', () => {
  assert.equal(centsToInput(4250), '42.50');
  assert.equal(centsToInput(123450), '1234.50');
  assert.equal(centsToInput(7), '0.07');
  assert.equal(parseDollars(centsToInput(123450)), 123450);
});
