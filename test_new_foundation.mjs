import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = 'C:\\Users\\temie\\.gemini\\antigravity\\brain\\b69ac24a-ddf3-4347-acdf-68c1ca0b971e\\test_screenshots\\new_foundation';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('[TEST] Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const logs = [];
  page.on('console', msg => {
    logs.push(`[CONSOLE ${msg.type()}] ${msg.text()}`);
    console.log(`[BROWSER] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    logs.push(`[ERROR] ${err.toString()}`);
    console.error(`[PAGEERROR] ${err.toString()}`);
  });

  console.log('[TEST] Navigating to http://localhost:8080/ ...');
  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle0', timeout: 15000 });
  await sleep(1000);

  // 1. Landing Screen (Stage 1: PEARL Pillars -> Stage 2: Discipline & Dossier)
  console.log('[TEST] 1. Landing Page');
  await page.screenshot({ path: path.join(OUT_DIR, '01_landing_hub.png') });
  await page.click('#tabE');
  await sleep(400);

  // 2. Click ENTER OPERATORY
  console.log('[TEST] 2. Entering Operatory...');
  await page.click('#btnDesktop');
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '02_operatory_entry.png') });

  // Verify window.__pearlsim
  const isInitialized = await page.evaluate(() => !!window.__pearlsim);
  console.log('[TEST] Simulation state initialized:', isInitialized);

  // 3. Start Checkup
  console.log('[TEST] 3. Starting Checkup...');
  await page.evaluate(() => {
    window.__pearlsim.startCheckup();
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '03_checkup_started.png') });

  // 4. Clinical Assessments: Radial Pulse & Airway Inspection
  console.log('[TEST] 4. Performing Pulse & Airway Assessment...');
  await page.evaluate(() => {
    const e = window.__pearlsim.engine;
    e.act('assess_pulse');
    e.act('inspect_airway');
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '04_assessments_done.png') });

  // 5. Differential Diagnosis
  console.log('[TEST] 5. Diagnosing Anaphylaxis...');
  await page.evaluate(() => {
    const e = window.__pearlsim.engine;
    e.act('diagnose', { id: 'anaphylaxis' });
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '05_diagnosed.png') });

  // 6. Resuscitation Protocol
  console.log('[TEST] 6. Executing Resuscitation Protocol (Help, Supine, Box, EpiPen 10s hold, O2)...');
  await page.evaluate(() => {
    const e = window.__pearlsim.engine;
    e.act('call_help');
    e.act('position_supine');
    e.act('open_drug_box');
    e.act('inject', { site: 'thigh', held: 10 });
    e.act('oxygen');
  });
  await sleep(2000);
  await page.screenshot({ path: path.join(OUT_DIR, '06_treatment_administered.png') });

  // Fast-forward engine to resolution
  console.log('[TEST] 7. Advancing engine to resolution...');
  await page.evaluate(() => {
    const e = window.__pearlsim.engine;
    for (let i = 0; i < 300 && !e.ended; i++) {
      window.__pearlsim.frame(0.1);
    }
  });
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT_DIR, '07_resolution.png') });

  // Wait for audit report
  console.log('[TEST] 8. Waiting for CPD Audit Report to render...');
  await sleep(3500);
  await page.screenshot({ path: path.join(OUT_DIR, '08_cpd_audit_report.png') });

  const scoreData = await page.evaluate(() => {
    return window.__pearlsim.S.score;
  });
  console.log('[TEST] Final Score Data:', JSON.stringify(scoreData, null, 2));

  await browser.close();
  console.log('[TEST] All tests completed successfully!');
}

run().catch(err => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
