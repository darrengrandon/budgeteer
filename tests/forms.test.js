import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAmount, readPastDate, readSplitInputs, toPercent } from '../src/forms.js';

// readAmount: what the paycheck and purchase boxes accept

test('readAmount accepts a positive amount and returns cents', () => {
  assert.deepEqual(readAmount('42.50'), { ok: true, cents: 4250 });
  assert.deepEqual(readAmount('$1,000,000'), { ok: true, cents: 100000000 });
});

test('readAmount turns every bad amount into a friendly message', () => {
  const cases = {
    '': /type an amount/i,
    '-5': /negative/i,
    abc: /like 42\.50/i,
    '12.345': /2 digits/i,
    0: /more than \$0/i,
    '0.00': /more than \$0/i,
    '1000000.01': /more than \$1,000,000/i,
  };
  for (const [text, message] of Object.entries(cases)) {
    const result = readAmount(String(text));
    assert.equal(result.ok, false, text);
    assert.match(result.error, message, text);
  }
});

// readPastDate: paychecks and purchases happen today or earlier

test('readPastDate accepts today and earlier days', () => {
  assert.deepEqual(readPastDate('2026-11-07', '2026-11-07'), { ok: true, date: '2026-11-07' });
  assert.deepEqual(readPastDate('2025-01-31', '2026-11-07'), { ok: true, date: '2025-01-31' });
});

test('readPastDate rejects empty, impossible and future dates in plain words', () => {
  assert.match(readPastDate('', '2026-11-07').error, /pick a date/i);
  assert.match(readPastDate('2026-02-30', '2026-11-07').error, /real date/i);
  assert.match(readPastDate('not a date', '2026-11-07').error, /real date/i);
  assert.match(readPastDate('2026-11-08', '2026-11-07').error, /hasn't happened yet/i);
});

// toPercent and readSplitInputs: the three split boxes

test('toPercent reads a whole number from a box, or NaN', () => {
  assert.equal(toPercent('50'), 50);
  assert.equal(toPercent(' 0 '), 0);
  assert.ok(Number.isNaN(toPercent('')));
  assert.ok(Number.isNaN(toPercent('50.5')));
  assert.ok(Number.isNaN(toPercent('-5')));
  assert.ok(Number.isNaN(toPercent('1e2')));
});

test('readSplitInputs accepts three whole numbers totaling 100', () => {
  assert.deepEqual(readSplitInputs({ spend: '50', save: '30', goals: '20' }), { ok: true, split: { spend: 50, save: 30, goals: 20 } });
  assert.deepEqual(readSplitInputs({ spend: '100', save: '0', goals: '0' }), { ok: true, split: { spend: 100, save: 0, goals: 0 } });
});

test('readSplitInputs explains what is wrong', () => {
  assert.match(readSplitInputs({ spend: '60', save: '30', goals: '20' }).error, /110%.*take away 10/i);
  assert.match(readSplitInputs({ spend: '', save: '30', goals: '20' }).error, /whole numbers/i);
  assert.match(readSplitInputs({ spend: '150', save: '-30', goals: '-20' }).error, /whole numbers/i);
});

// Fresh-eyes review U3: a wrong year (1999 instead of 2026) hides an entry at the bottom of the list.

test('readPastDate asks you to check the year for dates more than 2 years ago', () => {
  assert.deepEqual(readPastDate('2024-11-07', '2026-11-07'), { ok: true, date: '2024-11-07' }); // exactly 730 days
  assert.match(readPastDate('2024-11-06', '2026-11-07').error, /more than 2 years ago\. Check the year/i);
  assert.match(readPastDate('1999-01-01', '2026-11-07').error, /check the year/i);
});
