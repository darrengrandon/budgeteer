// Run labels in the overnight review index (overnight/make-index.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOf, RUNS } from '../overnight/runs.mjs';

test('each run label is read from the file name', () => {
  assert.equal(runOf('a-iphone15.webm'), '');
  assert.equal(runOf('b-iphoneSE-before.webm'), 'before');
  assert.equal(runOf('b-iphoneSE-after.png'), 'after');
  assert.equal(runOf('h-iphone15-final.webm'), 'final');
  assert.equal(runOf('a-pixel9-lazyv2.webm'), 'lazyv2');
  assert.equal(runOf('a-pixel9-03-first-result-lazyv2.png'), 'lazyv2');
});

test('every run label has words for the index', () => {
  for (const key of ['', 'before', 'after', 'final', 'lazyv2']) assert.equal(typeof RUNS[key], 'string');
});
