import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = 'C:\\Users\\temie\\.gemini\\antigravity\\brain\\b69ac24a-ddf3-4347-acdf-68c1ca0b971e\\test_screenshots\\realistic_test';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
  page.on('pageerror', err => console.error(`[PAGEERROR] ${err.toString()}`));

  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle0' });
  await page.click('#btnDesktop');
  await new Promise(r => setTimeout(r, 1000));

  const result = await page.evaluate(async () => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();

    const loadGLTF = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));

    const chairGltf = await loadGLTF('./public/models/dental_chair.glb');
    const patientGltf = await loadGLTF('./public/models/patient.glb');
    const nurseGltf = await loadGLTF('./public/models/assistant_female.glb');

    return {
      chairLoaded: !!chairGltf.scene,
      patientLoaded: !!patientGltf.scene,
      nurseLoaded: !!nurseGltf.scene
    };
  });

  console.log('Load test result:', result);
  await browser.close();
}

run().catch(console.error);
