// Shared puppeteer harness for visual verification of PEARLSIM.
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export const OUT = 'C:\\Users\\temie\\.gemini\\antigravity\\brain\\b69ac24a-ddf3-4347-acdf-68c1ca0b971e\\test_screenshots\\fix';
fs.mkdirSync(OUT, { recursive: true });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function open({ width = 1280, height = 800, enter = true, timeout = 90000, url = 'http://localhost:8080/' } = {}) {
  const tmp = path.join(os.tmpdir(), 'chrome_pup_' + Math.random().toString(36).slice(2));
  fs.mkdirSync(tmp, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', `--user-data-dir=${tmp}`, `--window-size=${width},${height}`]
  });
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  page.on('pageerror', (e) => console.log('[PAGEERROR]', e.toString()));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('[console.' + m.type() + ']', m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) console.log('[HTTP ' + r.status() + ']', r.url()); });
  await page.goto(url, { waitUntil: 'networkidle0' });
  if (enter) {
    const s1 = await page.evaluate(() => {
      const el = document.getElementById('stagePearl');
      return el && !el.hidden;
    });
    if (s1) await page.click('#tabE');
    await sleep(150);
    await page.click('#btnDesktop');
    const t0 = Date.now();
    for (;;) {
      const r = await page.evaluate(() => {
        const P = window.__pearlsim; if (!P || !P.world) return { ok: false };
        let n = 0, p = 0;
        P.world.assistant.traverse((o) => { if (o.isBone) n++; });
        P.world.patient.root.traverse((o) => { if (o.isBone) p++; });
        return { ok: n > 0 && p > 0, n, p };
      });
      if (r.ok) { console.log('models ready after', Date.now() - t0, 'ms'); break; }
      if (Date.now() - t0 > timeout) { console.log('TIMEOUT waiting for models', r); break; }
      await sleep(400);
    }
    await sleep(800);
  }
  return { browser, page };
}

// Place the camera and take a screenshot.
export async function shot(page, name, pos, look, { fov } = {}) {
  await page.evaluate(([pos, look, fov]) => {
    const cam = window.__pearlsim.camera;
    cam.position.set(...pos); cam.lookAt(...look);
    if (fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }, [pos, look, fov || null]);
  await sleep(500);
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file });
  console.log('saved', file);
  return file;
}
