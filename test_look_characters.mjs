import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = 'C:\\Users\\temie\\.gemini\\antigravity\\brain\\b69ac24a-ddf3-4347-acdf-68c1ca0b971e\\test_screenshots\\characters';
fs.mkdirSync(OUT_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox', '--window-size=1280,800'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.toString()));
await page.goto('http://localhost:8080/', { waitUntil: 'networkidle0' });
await page.click('#btnDesktop');
// The nurse GLB is ~11 MB: wait until both avatars have actually loaded.
const t0 = Date.now();
for (;;) {
  const ready = await page.evaluate(() => {
    const P = window.__pearlsim;
    let nBones = 0, pBones = 0;
    P.world.assistant.traverse((o) => { if (o.isBone) nBones++; });
    P.world.patient.root.traverse((o) => { if (o.isBone) pBones++; });
    return { nBones, pBones };
  });
  if (ready.nBones > 0 && ready.pBones > 0) { console.log('loaded after', Date.now() - t0, 'ms', ready); break; }
  if (Date.now() - t0 > 45000) { console.log('TIMEOUT waiting for models', ready); break; }
  await sleep(500);
}
await sleep(1500);

async function shot(name, js) {
  await page.evaluate(js);
  await sleep(700);
  await page.screenshot({ path: path.join(OUT_DIR, name + '.png') });
  console.log('saved', name);
}

const setup = `
  const THREE_ = null;
`;

// NURSE close-up: front of her face and upper body
await shot('nurse_front', `(async () => {
  const P = window.__pearlsim, cam = P.camera;
  const n = P.world.assistant;
  const box = { min: [1e9,1e9,1e9], max: [-1e9,-1e9,-1e9] };
  let head = null;
  n.traverse(o => { if (o.isBone && o.name === 'Head') head = o; });
  const v = head.getWorldPosition(head.position.clone());
  console.log('nurse head', v.x, v.y, v.z);
  cam.position.set(v.x + 0.2, v.y + 0.0, v.z + 1.1);
  cam.lookAt(v.x, v.y - 0.25, v.z);
})()`);

// NURSE full body
await shot('nurse_full', `(async () => {
  const P = window.__pearlsim, cam = P.camera;
  let head = null;
  P.world.assistant.traverse(o => { if (o.isBone && o.name === 'Head') head = o; });
  const v = head.getWorldPosition(head.position.clone());
  cam.position.set(v.x + 0.3, 1.1, v.z + 2.4);
  cam.lookAt(v.x, 0.8, v.z);
})()`);

// PATIENT head close-up from above/head end and from the side
await shot('patient_head_side', `(async () => {
  const P = window.__pearlsim, cam = P.camera;
  let head = null;
  P.world.patient.root.traverse(o => { if (o.isBone && o.name === 'Head') head = o; });
  const v = head.getWorldPosition(head.position.clone());
  console.log('patient head', v.x, v.y, v.z);
  cam.position.set(v.x + 0.9, v.y + 0.35, v.z + 0.7);
  cam.lookAt(v.x, v.y, v.z);
})()`);

await shot('patient_full', `(async () => {
  const P = window.__pearlsim, cam = P.camera;
  cam.position.set(1.9, 1.6, 0.9);
  cam.lookAt(0.1, 0.7, -0.65);
})()`);

await shot('patient_face_front', `(async () => {
  const P = window.__pearlsim, cam = P.camera;
  let head = null;
  P.world.patient.root.traverse(o => { if (o.isBone && o.name === 'Head') head = o; });
  const v = head.getWorldPosition(head.position.clone());
  cam.position.set(v.x, v.y + 0.5, v.z + 0.55);
  cam.lookAt(v.x, v.y, v.z);
})()`);

await browser.close();
