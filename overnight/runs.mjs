// Run labels for the overnight review index. A file ends in "-<label>.webm" or "-<label>.png"
// when the suite ran with OVERNIGHT_LABEL=<label> (overnight/kit.js); no label is the first run.

/** @type {Readonly<Record<string, string>>} words for each label, as the index shows them */
export const RUNS = Object.freeze({
  before: 'before the fix',
  after: 'after the fix',
  final: 'final run, all fixes in',
  lazyv2: 'lazy-v2 run (pay frequency, tap-to-explain, one-tap repeat, one spend number)',
  '': 'first run',
});

const LABELLED = new RegExp(`-(${Object.keys(RUNS).filter(Boolean).join('|')})\\.(webm|png)$`);

/**
 * The run a video or screenshot came from.
 * @param {string} file
 * @returns {string} a key of RUNS
 */
export function runOf(file) {
  return LABELLED.exec(file)?.[1] ?? '';
}

/**
 * The file name without its run label, to look up a description written without one.
 * @param {string} file
 * @returns {string}
 */
export function withoutRun(file) {
  const run = runOf(file);
  return run ? file.replace(`-${run}.`, '.') : file;
}
