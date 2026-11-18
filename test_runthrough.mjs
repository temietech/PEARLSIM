import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = 'C:\\Users\\temie\\.gemini\\antigravity\\brain\\b69ac24a-ddf3-4347-acdf-68c1ca0b971e\\test_screenshots';

import fs from 'fs';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  console.log('[TEST] Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[CONSOLE ${msg.type()}] ${text}`);
    console.log(`[BROWSER] ${text}`);
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      console.log(`[HTTP ${res.status()}] ${res.url()}`);
    }
  });

  console.log('[TEST] Navigating to http://localhost:8080/ ...');
  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2500));

  // Step 1: Landing Page
  console.log('[TEST] Step 1: Landing Page');
  await page.screenshot({ path: path.join(OUT_DIR, '01_landing.png') });

  // Step 2: Click Enter Operatory Clinic
  console.log('[TEST] Step 2: Entering Operatory Clinic');
  await page.click('#btn-start-encounter');
  await page.waitForFunction(() => window.pearlSimApp?.assistant?.model, { timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT_DIR, '02_operatory_entry.png') });

  // Step 3: Start Procedure
  console.log('[TEST] Step 3: Starting Procedure');
  await page.click('#btn-begin-procedure');
  await new Promise(r => setTimeout(r, 4500)); // Let symptoms trigger
  await page.screenshot({ path: path.join(OUT_DIR, '03_procedure_observation.png') });

  // Step 4: Stop Procedure
  console.log('[TEST] Step 4: Stopping Procedure');
  await page.click('#btn-stop-procedure');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '04_quiz_step1_symptoms.png') });

  // Step 5: Check Symptoms & Submit
  console.log('[TEST] Step 5: Submitting Symptoms');
  await page.evaluate(() => {
    const items = document.querySelectorAll('.quiz-choice-item');
    if (items[0]) items[0].click();
    if (items[1]) items[1].click();
    if (items[2]) items[2].click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.click('#btn-quiz-action');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '05_quiz_step2_diagnosis.png') });

  // Step 6: Select Diagnosis & Submit
  console.log('[TEST] Step 6: Submitting Diagnosis');
  await page.evaluate(() => {
    const items = document.querySelectorAll('.quiz-choice-item');
    if (items[0]) items[0].click(); // Anaphylaxis
  });
  await new Promise(r => setTimeout(r, 500));
  await page.click('#btn-quiz-action');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '06_quiz_step2_diagnosis_feedback.png') });

  // Step 7: Advance to Step 3 Treatment
  console.log('[TEST] Step 7: Moving to Step 3 Treatment');
  await page.click('#btn-quiz-action');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '07_quiz_step3_treatment.png') });

  // Step 8: Select Adrenaline & Submit
  console.log('[TEST] Step 8: Submitting Treatment');
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.quiz-choice-item'));
    const adr = items.find(i => i.dataset.id === 'ADRENALINE');
    if (adr) adr.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.click('#btn-quiz-action');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '08_quiz_step3_treatment_feedback.png') });

  // Step 9: Proceed to Physical Resuscitation
  console.log('[TEST] Step 9: Proceeding to Physical Administration');
  await page.click('#btn-quiz-action');
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '09_physical_delivery_banner.png') });

  // Step 10: Simulate clicking Vastus Lateralis target to deliver EpiPen
  console.log('[TEST] Step 10: Administering Adrenaline into Vastus Lateralis');
  await page.evaluate(() => {
    window.pearlSimApp.executeMedicationAdministration('VASTUS_LATERALIS', window.pearlSimApp.patient.getThighWorldPosition());
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT_DIR, '10_injection_hold_countdown.png') });

  // Step 11: Wait for 10-second hold to finish
  console.log('[TEST] Step 11: Waiting for hold countdown to complete...');
  await new Promise(r => setTimeout(r, 9500));
  await page.screenshot({ path: path.join(OUT_DIR, '11_resuscitation_complete.png') });

  // Step 12: View Session Report
  console.log('[TEST] Step 12: Viewing Session Report');
  await page.click('#btn-view-session-report');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT_DIR, '12_session_report.png') });

  console.log('[TEST] Test run completed successfully!');
  await browser.close();
}

run().catch(err => {
  console.error('[TEST FATAL ERROR]', err);
  process.exit(1);
});
