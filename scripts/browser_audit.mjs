import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_ROOT = process.env.BLOG_AUDIT_ROOT
  ? path.resolve(ROOT, process.env.BLOG_AUDIT_ROOT)
  : ROOT;
const EXTERNAL_BASE_URL = process.env.BLOG_AUDIT_BASE_URL?.trim();
const IGNORE_HTTPS_ERRORS = process.env.AUDIT_IGNORE_HTTPS_ERRORS === '1';
const SCREENSHOT_DIR = path.join(ROOT, 'artifacts', 'blog-audit');
const PAGE_PATHS = [
  'index.html',
  'about.html',
  'embedded.html',
  'algorithms.html',
  'modeling.html',
  'modeling-cat-算法模型.html',
  'modeling-cat-应用案例.html',
  'modeling-cat-理论研究.html',
  'projects.html',
  'blog.html',
  'contact.html',
  '404.html',
  'offline.html'
];
const SCREENSHOT_PAGES = new Set([
  'index.html',
  'about.html',
  'projects.html',
  'blog.html',
  'algorithms.html',
  'modeling.html',
  'contact.html'
]);
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'mobile', width: 412, height: 915, isMobile: true },
  { name: 'compact', width: 320, height: 800, isMobile: true }
];

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('BLOG_AUDIT_BASE_URL must use http or https');
  }
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(url) {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Local server did not start: ${lastError || url}`);
}

function startServer(port) {
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  return spawn(python, ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
    cwd: SITE_ROOT,
    stdio: 'ignore',
    windowsHide: true
  });
}

function record(failures, condition, message) {
  if (!condition) failures.push(message);
}

async function auditPage(page, baseUrl, pagePath, viewport, failures) {
  const runtimeIssues = [];
  await page.addInitScript(() => {
    window.__auditCumulativeLayoutShift = 0;
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__auditCumulativeLayoutShift += entry.value;
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch (_) {
        // Older engines can still run the rest of the audit.
      }
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeIssues.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => runtimeIssues.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => {
    runtimeIssues.push(`requestfailed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) runtimeIssues.push(`HTTP ${response.status()}: ${response.url()}`);
  });

  const url = new URL(pagePath, baseUrl).href;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(180);
  await page.evaluate(async () => {
    const maximum = document.documentElement.scrollHeight - window.innerHeight;
    for (let position = 0; position <= maximum; position += Math.max(240, window.innerHeight * 0.75)) {
      window.scrollTo(0, position);
      await new Promise((resolve) => setTimeout(resolve, 45));
    }
    window.scrollTo(0, maximum);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await Promise.all(Array.from(document.images).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
        window.setTimeout(resolve, 2000);
      });
    }));
    window.scrollTo(0, 0);
  });

  const state = await page.evaluate(() => ({
    h1Count: document.querySelectorAll('h1').length,
    mainCount: document.querySelectorAll('main').length,
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
    brokenImages: Array.from(document.images)
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.getAttribute('src')),
    invisibleRevealItems: Array.from(document.querySelectorAll('.reveal'))
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.visibility === 'hidden' || Number(style.opacity) === 0;
      }).length,
    blankButtons: Array.from(document.querySelectorAll('button'))
      .filter((button) => !(button.textContent.trim() || button.getAttribute('aria-label') || button.getAttribute('title')))
      .length,
    shortText: document.body.innerText.trim().length < 100,
    performance: (() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      return {
        loadMilliseconds: navigation ? navigation.loadEventEnd - navigation.startTime : 0,
        encodedBytes: (navigation?.encodedBodySize || 0) + resources.reduce((total, entry) => total + (entry.encodedBodySize || 0), 0),
        resourceCount: resources.length,
        externalResources: resources.filter((entry) => new URL(entry.name).origin !== location.origin).map((entry) => entry.name),
        cumulativeLayoutShift: window.__auditCumulativeLayoutShift || 0
      };
    })()
  }));

  const prefix = `${viewport.name}/${pagePath}`;
  record(failures, response?.status() === 200, `${prefix}: expected HTTP 200, received ${response?.status()}`);
  record(failures, state.h1Count === 1, `${prefix}: expected one h1, found ${state.h1Count}`);
  record(failures, state.mainCount === 1, `${prefix}: expected one main, found ${state.mainCount}`);
  record(failures, state.overflow <= 1, `${prefix}: horizontal overflow is ${state.overflow}px`);
  record(failures, state.brokenImages.length === 0, `${prefix}: broken images ${state.brokenImages.join(', ')}`);
  record(failures, state.invisibleRevealItems === 0, `${prefix}: ${state.invisibleRevealItems} content blocks are invisible`);
  record(failures, state.blankButtons === 0, `${prefix}: ${state.blankButtons} buttons have no accessible text`);
  record(failures, !state.shortText, `${prefix}: page content appears blank`);
  record(failures, state.performance.loadMilliseconds < 5000, `${prefix}: load event took ${Math.round(state.performance.loadMilliseconds)}ms`);
  record(failures, state.performance.encodedBytes < 2_000_000, `${prefix}: transferred more than 2 MB`);
  record(failures, state.performance.resourceCount <= 25, `${prefix}: loaded ${state.performance.resourceCount} resources`);
  record(failures, state.performance.externalResources.length === 0, `${prefix}: loaded external resources ${state.performance.externalResources.join(', ')}`);
  record(failures, state.performance.cumulativeLayoutShift < 0.1, `${prefix}: cumulative layout shift is ${state.performance.cumulativeLayoutShift.toFixed(3)}`);
  runtimeIssues.forEach((issue) => failures.push(`${prefix}: ${issue}`));

  const axeResults = await new AxeBuilder({ page }).analyze();
  axeResults.violations.forEach((violation) => {
    const targets = violation.nodes.slice(0, 3).flatMap((node) => node.target).join(', ');
    failures.push(`${prefix}: axe ${violation.id} (${violation.impact || 'unknown'}) at ${targets}`);
  });

  if (SCREENSHOT_PAGES.has(pagePath)) {
    const basename = pagePath.replace('.html', '');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${basename}-${viewport.name}.png`),
      fullPage: true
    });
  }
}

async function auditAllPages(browser, baseUrl, failures) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS,
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.isMobile,
      locale: 'zh-CN',
      serviceWorkers: 'block'
    });
    for (const pagePath of PAGE_PATHS) {
      const page = await context.newPage();
      await auditPage(page, baseUrl, pagePath, viewport, failures);
      await page.close();
    }
    await context.close();
  }
}

async function auditInteractions(browser, baseUrl, failures) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS,
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    permissions: ['clipboard-read', 'clipboard-write'],
    serviceWorkers: 'block'
  });
  const page = await context.newPage();

  await page.goto(new URL('index.html', baseUrl).href);
  const toggle = page.locator('[data-nav-toggle]');
  await toggle.click();
  record(failures, await toggle.getAttribute('aria-expanded') === 'true', 'interaction: mobile navigation did not open');
  record(failures, await page.locator('#site-nav').isVisible(), 'interaction: mobile navigation is not visible');
  record(failures, await page.locator('#site-nav [aria-current="page"]').evaluate((element) => element === document.activeElement), 'interaction: mobile navigation did not move focus to the current link');
  await page.locator('#site-nav a').last().focus();
  await page.keyboard.press('Tab');
  record(failures, await toggle.evaluate((element) => element === document.activeElement), 'interaction: mobile navigation does not trap focus');
  await page.keyboard.press('Escape');
  record(failures, await toggle.getAttribute('aria-expanded') === 'false', 'interaction: Escape did not close mobile navigation');
  record(failures, await toggle.evaluate((element) => element === document.activeElement), 'interaction: closing navigation did not restore focus');

  await page.goto(new URL('algorithms.html', baseUrl).href);
  await page.locator('#tab-problems').focus();
  await page.keyboard.press('ArrowRight');
  record(failures, await page.locator('#tab-templates').getAttribute('aria-selected') === 'true', 'interaction: tab keyboard navigation failed');
  record(failures, await page.locator('#panel-templates').isVisible(), 'interaction: selected tab panel is hidden');
  await page.locator('#panel-templates details').first().click();
  const copyButton = page.locator('#panel-templates [data-copy-code]').first();
  await copyButton.click();
  await page.waitForFunction((button) => button.textContent !== '复制代码', await copyButton.elementHandle());
  record(failures, /已复制|已选中/.test(await copyButton.innerText()), 'interaction: code copy did not report a result');

  await page.goto(new URL('modeling.html', baseUrl).href);
  await page.locator('#model-filter').selectOption({ index: 3 });
  record(failures, await page.locator('[data-model-category]:visible').count() === 2, 'interaction: modeling filter returned the wrong card count');
  record(failures, new URL(page.url()).searchParams.has('category'), 'interaction: modeling filter did not create a shareable URL');

  await page.goto(new URL('contact.html', baseUrl).href);
  await page.locator('[data-copy-email]').click();
  await page.waitForFunction(() => document.querySelector('[data-copy-status]')?.textContent.length > 0);
  record(failures, /已复制/.test(await page.locator('[data-copy-status]').innerText()), 'interaction: email copy did not report success');

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(new URL('about.html', baseUrl).href);
  const nextSectionVisiblePixels = await page.evaluate(() => {
    const hero = document.querySelector('.about-hero');
    const nextSection = hero?.nextElementSibling;
    return nextSection ? Math.max(0, window.innerHeight - nextSection.getBoundingClientRect().top) : 0;
  });
  record(failures, nextSectionVisiblePixels >= 16, 'interaction: the 320px profile hero does not reveal the next section');
  const honorArchive = page.locator('.honor-archive');
  const honorSummary = honorArchive.locator('summary');
  await honorSummary.focus();
  await page.keyboard.press('Enter');
  record(failures, await honorArchive.evaluate((element) => element.open), 'interaction: honor archive did not open from the keyboard');
  record(failures, await honorArchive.locator('.award-row').count() === 14, 'interaction: honor archive does not contain all 14 records');
  const compactOverflow = await page.evaluate(() => (
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth
  ));
  record(failures, compactOverflow <= 1, `interaction: expanded honor archive overflows the 320px viewport by ${compactOverflow}px`);
  const expandedHonorAxe = await new AxeBuilder({ page }).analyze();
  expandedHonorAxe.violations.forEach((violation) => {
    const targets = violation.nodes.slice(0, 3).flatMap((node) => node.target).join(', ');
    failures.push(`interaction: expanded honor archive axe ${violation.id} (${violation.impact || 'unknown'}) at ${targets}`);
  });

  await context.close();
}

async function auditWithoutJavaScript(browser, baseUrl, failures) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS,
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    javaScriptEnabled: false,
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  await page.goto(new URL('index.html', baseUrl).href);
  record(failures, await page.locator('#site-nav').isVisible(), 'no-js: primary navigation is hidden');
  record(failures, await page.locator('.reveal').first().isVisible(), 'no-js: page content is hidden');
  await page.goto(new URL('algorithms.html', baseUrl).href);
  record(failures, await page.locator('#panel-templates').isVisible(), 'no-js: alternate tab content is inaccessible');
  await context.close();
}

async function auditManifest(browser, baseUrl, failures) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS,
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  await page.goto(new URL('index.html', baseUrl).href, { waitUntil: 'domcontentloaded' });
  const session = await context.newCDPSession(page);
  const manifest = await session.send('Page.getAppManifest');
  record(failures, manifest.url === new URL('manifest.webmanifest', baseUrl).href, 'manifest: Chromium did not discover the expected manifest');
  record(failures, manifest.errors.length === 0, `manifest: Chromium reported ${manifest.errors.map((error) => error.message).join('; ')}`);
  await context.close();
}

async function auditOffline(browser, baseUrl, failures) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS,
    serviceWorkers: 'allow'
  });
  const page = await context.newPage();
  await page.goto(new URL('index.html', baseUrl).href, { waitUntil: 'networkidle' });
  await page.evaluate(async (timeoutMs) => {
    if (!navigator.serviceWorker) throw new Error('Service Worker API is unavailable');
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error('Service Worker ready timed out')),
        timeoutMs
      ))
    ]);
  }, 20000);
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload({ waitUntil: 'networkidle' });
  }
  record(failures, await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'offline: service worker did not control the page');

  await context.setOffline(true);
  await page.goto(new URL('about.html', baseUrl).href, { waitUntil: 'domcontentloaded' });
  record(failures, (await page.locator('h1').innerText()) === 'Yan', 'offline: cached content page did not load');
  await page.goto(new URL('not-cached.html', baseUrl).href, { waitUntil: 'domcontentloaded' });
  record(failures, (await page.locator('h1').innerText()) === '当前无法连接网络', 'offline: unknown route did not show the offline state');
  await context.close();
}

async function main() {
  const failures = [];
  let server;
  let baseUrl;
  if (SITE_ROOT !== ROOT && !SITE_ROOT.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error('BLOG_AUDIT_ROOT must stay inside the repository');
  }
  if (EXTERNAL_BASE_URL) {
    baseUrl = normalizeBaseUrl(EXTERNAL_BASE_URL);
  } else {
    const port = await getAvailablePort();
    baseUrl = `http://127.0.0.1:${port}/`;
    server = startServer(port);
  }
  let browser;

  try {
    if (server) await waitForServer(baseUrl);
    browser = await chromium.launch({
      headless: true,
      args: IGNORE_HTTPS_ERRORS ? ['--ignore-certificate-errors'] : []
    });
    await auditAllPages(browser, baseUrl, failures);
    await auditInteractions(browser, baseUrl, failures);
    await auditWithoutJavaScript(browser, baseUrl, failures);
    await auditManifest(browser, baseUrl, failures);
    await auditOffline(browser, baseUrl, failures);
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }

  if (failures.length) {
    console.error(`Browser audit failed with ${failures.length} issue(s):`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Browser audit passed: ${PAGE_PATHS.length} pages x ${VIEWPORTS.length} viewports.`);
  console.log(`Audited base URL: ${baseUrl}`);
  console.log('Interactions, no-JavaScript fallback, axe checks, manifest parsing, offline navigation and screenshots passed.');
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
