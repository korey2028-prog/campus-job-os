// 用隔离的 Chromium（Playwright 自带）截图所有路由，任何 console error 都会让脚本失败
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { start } from './serve.mjs';

const require = createRequire('/Users/korey/.npm/_npx/31e32ef8478fbf80/node_modules/');
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.SHOTS_DIR || '/private/tmp/claude-501/-Users-korey/7f03a6d8-5542-498f-9836-e957fe8de025/scratchpad/shots';
mkdirSync(OUT, { recursive: true });
const demo = JSON.parse(readFileSync(join(root, 'apps/web/data/demo.json'), 'utf8'));
const detailId = (demo.positions.find((p) => p.conflicts.length && p.deadlineRaw.startsWith('2026/11')) || demo.positions[0]).id;
const riskId = demo.positions.find((p) => p.risk).id;
const ROUTES = ['welcome', 'today', 'jobs', `jobs/${detailId}`, `jobs/${riskId}`, 'applications', 'facts', 'materials', 'materials/M-01', 'insights', 'guide', 'archive', 'quality', 'settings', 'more'];
const SIZES = [['desktop', 1440, 900], ['mobile', 390, 844]];

const server = await start();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/korey/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const errors = [];
let n = 0;
try {
  for (const [name, w, h] of SIZES) {
    for (const scheme of ['light', 'dark']) {
      const dark = scheme === 'dark';
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}/${scheme} console: ${m.text()}`); });
      page.on('pageerror', (e) => errors.push(`${name}/${scheme} pageerror: ${e.message}`));
      page.on('requestfailed', (r) => errors.push(`${name}/${scheme} requestfailed: ${r.url()}`));
      await page.addInitScript(() => { try { if (location.hash.startsWith('#/welcome')) localStorage.clear(); else if (!localStorage.getItem('jobos.demo.v1')) localStorage.setItem('jobos.demo.v1', JSON.stringify({ onboarded: true })); } catch {} });
      const routes = dark ? ['jobs', `jobs/${detailId}`] : ROUTES;
      for (const r of routes) {
        await ctx.clearCookies();
        await page.goto('about:blank');
        await page.goto(`http://127.0.0.1:5178/#/${r}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(350);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 0 && name === 'mobile') errors.push(`mobile/${scheme} ${r}: horizontal overflow ${overflow}px`);
        const file = `${name}-${scheme}-${r.replace(/\//g, '_')}.png`;
        if (name === 'mobile') await page.screenshot({ path: join(OUT, file.replace('.png', '-fold.png')) });
        if (name === 'desktop') { // 让 100vh 的侧边栏在整页截图里也撑满
          const full = await page.evaluate(() => document.documentElement.scrollHeight);
          await page.setViewportSize({ width: w, height: Math.max(h, full) });
          await page.waitForTimeout(100);
        }
        await page.screenshot({ path: join(OUT, file), fullPage: true });
        if (name === 'desktop') await page.setViewportSize({ width: w, height: h });
        n++;
      }
      if (!dark) {
        // 额外：添加招聘浮层、筛选浮层
        await page.goto('about:blank');
        await page.goto('http://127.0.0.1:5178/#/jobs', { waitUntil: 'networkidle' });
        await page.click('[data-act="open-intake"]');
        await page.fill('textarea', '星河半导体 2027届校园招聘 市场岗\n本科及以上，专业不限，网申截止 2026年11月20日\nhttps://careers.xinghe-demo.cn/campus');
        await page.fill('[data-input="it-company"]', '星河半导体'); await page.fill('[data-input="it-title"]', '市场专员');
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(OUT, `${name}-light-sheet_intake.png`) });
        await page.click('[data-act="it-save"]'); await page.waitForTimeout(300);
        if (!/jobs\/9001/.test(page.url())) errors.push(`${name}: intake did not navigate to new position (${page.url()})`);
        await page.screenshot({ path: join(OUT, `${name}-light-intake_result.png`), fullPage: true });
        await page.goto('http://127.0.0.1:5178/#/jobs', { waitUntil: 'networkidle' });
        await page.click('[data-act="jf-sheet"]:visible'); await page.waitForTimeout(300);
        await page.screenshot({ path: join(OUT, `${name}-light-sheet_filters.png`) });
        await page.goto('http://127.0.0.1:5178/#/jobs?tags=free,soe&q=zzzz', { waitUntil: 'networkidle' });
        await page.waitForTimeout(200);
        await page.screenshot({ path: join(OUT, `${name}-light-jobs_empty.png`) });
        await page.goto('about:blank');
        await page.goto('http://127.0.0.1:5178/#/jobs', { waitUntil: 'networkidle' });
        await page.evaluate(() => localStorage.setItem('jobos.view', 'table')); await page.reload({ waitUntil: 'networkidle' });
        await page.screenshot({ path: join(OUT, `${name}-light-jobs_table.png`) });
        await page.evaluate(() => localStorage.removeItem('jobos.view'));
        await page.goto('about:blank');
        await page.goto('http://127.0.0.1:5178/#/applications', { waitUntil: 'networkidle' });
        const chg = page.locator('[data-act="app-menu"]:visible').first(); await chg.click(); await page.waitForTimeout(250);
        await page.screenshot({ path: join(OUT, `${name}-light-sheet_appmenu.png`) });
        n += 6;
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((ok) => server.close(ok));
}
console.log(`captured ${n} screenshots -> ${OUT}`);
if (errors.length) { console.error('FAILED:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
