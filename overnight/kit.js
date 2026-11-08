// @ts-check
// Helpers for the overnight video scenarios: captions, screenshots, automatic checks, video names.
// Everything is written under overnight-review/ (gitignored).
import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';

const review = fileURLToPath(new URL('../overnight-review/', import.meta.url));
for (const dir of ['videos', 'screenshots']) mkdirSync(`${review}${dir}`, { recursive: true });

/** "-before" / "-after" when re-running scenarios around a fix (OVERNIGHT_LABEL=after). */
const label = process.env.OVERNIGHT_LABEL ? `-${process.env.OVERNIGHT_LABEL}` : '';

/** @param {string} day 'YYYY-MM-DD', 10am in America/Chicago */
export const on = (day) => new Date(`${day}T10:00:00-06:00`);

/**
 * A scenario: a page plus a "story" helper that captions, screenshots and audits it.
 * The video is saved as overnight-review/videos/<scenario>-<device><label>.webm.
 */
export const test = base.extend({
  story: async ({ page }, use, testInfo) => {
    const scenario = testInfo.title.split(':')[0].trim(); // "a", "b", ...
    const device = testInfo.project.name;
    let shot = 0;
    const story = {
      /**
       * Show a caption at the top of the page saying what is about to happen.
       * It sits in the top layer, so it shows above open sheets, and ignores taps.
       * @param {string} text
       */
      async caption(text) {
        await page.evaluate((t) => {
          let el = document.getElementById('overnight-caption');
          if (!el) {
            el = document.createElement('div');
            el.id = 'overnight-caption';
            el.setAttribute('popover', 'manual');
            Object.assign(el.style, {
              position: 'fixed', inset: '0 0 auto 0', margin: '0', width: '100%', maxWidth: '100%', height: 'auto',
              padding: '6px 10px', border: '0', background: 'rgba(20,20,30,.85)', color: '#fff',
              font: '600 13px/1.3 system-ui, sans-serif', textAlign: 'center', pointerEvents: 'none',
            });
            document.body.append(el);
          }
          el.textContent = t;
          if (el.matches(':popover-open')) el.hidePopover();
          el.showPopover();
        }, text);
      },
      /**
       * A result screen: pause 1 second, then a clean screenshot (no caption) and the checks.
       * @param {string} name
       * @param {string} description one line for overnight-review/index.html
       */
      async result(name, description) {
        await page.waitForTimeout(1000);
        shot += 1;
        const file = `${scenario}-${device}-${String(shot).padStart(2, '0')}-${name}${label}.png`;
        await page.evaluate(() => document.getElementById('overnight-caption')?.hidePopover?.());
        await page.screenshot({ path: `${review}screenshots/${file}` });
        await page.evaluate(() => document.getElementById('overnight-caption')?.showPopover?.());
        const audit = await audits(page);
        appendFileSync(`${review}media.jsonl`, `${JSON.stringify({ type: 'screenshot', file, scenario, device, description })}\n`);
        appendFileSync(`${review}audit.jsonl`, `${JSON.stringify({ scenario, device, file, ...audit })}\n`);
        return audit;
      },
    };
    await use(story);
    const video = page.video();
    await page.context().close();
    if (video) {
      const file = `${scenario}-${device}${label}.webm`;
      await video.saveAs(`${review}videos/${file}`);
      appendFileSync(`${review}media.jsonl`, `${JSON.stringify({ type: 'video', file, scenario, device, description: testInfo.title })}\n`);
    }
  },
});

export { expect };

/**
 * Automatic checks against the quality bar, on whatever is on screen now.
 * @param {import('@playwright/test').Page} page
 */
async function audits(page) {
  return page.evaluate(() => {
    const caption = document.getElementById('overnight-caption');
    const text = (document.body.innerText || '').replace(caption?.innerText ?? '', '');
    const visible = (/** @type {Element} */ el) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const small = [...document.querySelectorAll('button, input, a[href], [role="switch"], [role="button"], select')]
      .filter((el) => visible(el) && el.id !== 'backup-file')
      .filter((el) => { const b = el.getBoundingClientRect(); return b.width < 44 || b.height < 44; })
      .map((el) => `${el.tagName.toLowerCase()}#${el.id} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    const offscreen = [...document.querySelectorAll('button, input, h1, h2, h3, p, li')]
      .filter((el) => visible(el) && el !== caption && !caption?.contains(el))
      .filter((el) => { const b = el.getBoundingClientRect(); return b.right > window.innerWidth + 1 || b.left < -1; })
      .map((el) => `${el.tagName.toLowerCase()}#${el.id} "${(el.textContent ?? '').trim().slice(0, 30)}"`);
    const bad = ['NaN', 'Infinity', 'undefined', 'null', '-$', '$-'].filter((word) => text.includes(word));
    return {
      horizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
      smallTargets: small,
      offscreen,
      badText: bad,
      blank: text.trim().length < 20,
    };
  });
}
