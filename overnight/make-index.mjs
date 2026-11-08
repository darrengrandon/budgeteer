// Builds overnight-review/index.html: every video and screenshot with a one-line description.
// Run after the overnight suite: node overnight/make-index.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const review = fileURLToPath(new URL('../overnight-review/', import.meta.url));

const scenarios = {
  a: 'First run with a goal, first paycheck, home screen',
  b: 'A steady weekly paycheck for eight weeks, "You can buy it!" and Buy it',
  c: 'Irregular hours: very different amounts and one missed week',
  d: 'Forgetting for three weeks, then opening the app',
  e: 'Mistakes: double tap, missing dot, empty, huge, zero or negative goal price',
  f: 'Backup and restore, and clearing site data',
  g: 'Offline: load once, go offline, reload, log a paycheck',
  h: 'Dark mode and large text',
  i: 'Changing the split, and Track my spending with the balance check',
  P: 'Phase 3 fix P2/P2b, checked by hand at 320px',
};
const devices = { iphone15: 'iPhone 15 (393px)', pixel9: 'Pixel 9 (360px)', iphoneSE: 'iPhone SE (320px)' };
const runs = {
  before: 'before the fix',
  after: 'after the fix',
  final: 'final run, all fixes in',
  '': 'first run',
};
const extra = {
  'P2-fix-iphoneSE-light-after.png': 'After fixes P2/P2b, light: "Paycheck added. Undo" on one line, Buy it clear of the bar',
  'P2-fix-iphoneSE-dark-after.png': 'After fixes P2/P2b, dark: the same screen',
};

/** Descriptions written by the suite (the last one per file wins). */
const described = new Map();
if (existsSync(`${review}media.jsonl`)) {
  for (const line of readFileSync(`${review}media.jsonl`, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    described.set(row.file, row.description);
  }
}

/** @param {string} file */
function parse(file) {
  const run = /-(before|after|final)\.(webm|png)$/.exec(file)?.[1] ?? '';
  const scenario = file[0];
  const device = Object.keys(devices).find((d) => file.includes(`-${d}`)) ?? '';
  const base = file.replace(/-(before|after|final)(\.(webm|png))$/, '$2');
  const text = extra[file] ?? described.get(file) ?? described.get(base) ?? (file.endsWith('.webm') ? scenarios[scenario] : file);
  return { scenario, device, run, text };
}

const escape = (/** @type {string} */ s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

const videos = readdirSync(`${review}videos`).filter((f) => f.endsWith('.webm')).sort();
const shots = readdirSync(`${review}screenshots`).filter((f) => f.endsWith('.png')).sort();

let html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Budgeteer overnight review</title>
<style>
  body { font: 15px/1.45 system-ui, sans-serif; margin: 0 auto; max-width: 1100px; padding: 16px; color: #1d2030; background: #f5f6fa; }
  h1 { margin: 0 0 4px; } h2 { margin: 28px 0 8px; } h3 { margin: 18px 0 6px; font-size: 1rem; }
  table { border-collapse: collapse; width: 100%; background: #fff; }
  td, th { border-bottom: 1px solid #d5d8e3; padding: 6px 8px; text-align: left; vertical-align: top; }
  img { width: 90px; border: 1px solid #d5d8e3; border-radius: 6px; }
  .tag { display: inline-block; padding: 0 6px; border-radius: 8px; font-size: 12px; background: #e3e5ee; }
  .before { background: #fdecea; } .after { background: #e6f4ea; } .final { background: #dfe7ff; }
  a { color: #3d4bd6; }
</style>
</head>
<body>
<h1>Budgeteer overnight review</h1>
<p>${videos.length} videos and ${shots.length} screenshots. The report is
<a href="OVERNIGHT-REPORT.md">OVERNIGHT-REPORT.md</a>; the separate agent's notes are in
<a href="agent-notes.md">agent-notes.md</a>. Tags: <span class="tag">first run</span>
<span class="tag before">before the fix</span> <span class="tag after">after the fix</span>
<span class="tag final">final run, all fixes in</span>.</p>
`;

for (const [key, title] of Object.entries(scenarios)) {
  const v = videos.filter((f) => f[0] === key);
  const s = shots.filter((f) => f[0] === key);
  if (v.length === 0 && s.length === 0) continue;
  html += `<h2>${key === 'P' ? '' : `${key}. `}${escape(title)}</h2>\n`;
  if (v.length) {
    html += '<h3>Videos</h3><table><tr><th>File</th><th>Device</th><th>Run</th><th>What it shows</th></tr>\n';
    for (const file of v) {
      const p = parse(file);
      html += `<tr><td><a href="videos/${escape(file)}">${escape(file)}</a></td><td>${devices[p.device] ?? ''}</td>`
        + `<td><span class="tag ${p.run}">${runs[p.run]}</span></td><td>${escape(p.text)}</td></tr>\n`;
    }
    html += '</table>\n';
  }
  if (s.length) {
    html += '<h3>Screenshots</h3><table><tr><th></th><th>File</th><th>Device</th><th>Run</th><th>What it shows</th></tr>\n';
    for (const file of s) {
      const p = parse(file);
      html += `<tr><td><a href="screenshots/${escape(file)}"><img loading="lazy" src="screenshots/${escape(file)}" alt=""></a></td>`
        + `<td><a href="screenshots/${escape(file)}">${escape(file)}</a></td><td>${devices[p.device] ?? (file.includes('iphoneSE') ? devices.iphoneSE : '')}</td>`
        + `<td><span class="tag ${p.run}">${runs[p.run]}</span></td><td>${escape(p.text)}</td></tr>\n`;
    }
    html += '</table>\n';
  }
}
html += '</body>\n</html>\n';
writeFileSync(`${review}index.html`, html);
console.log(`index.html: ${videos.length} videos, ${shots.length} screenshots`);
