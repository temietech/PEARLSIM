import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = 'C:\\Users\\temie\\.gemini\\antigravity\\brain\\b69ac24a-ddf3-4347-acdf-68c1ca0b971e\\test_screenshots\\realistic_test';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
  page.on('pageerror', err => console.error(`[PAGEERROR] ${err.toString()}`));

  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle0' });
  await page.click('#btnDesktop');
  await new Promise(r => setTimeout(r, 1000));

  const status = await page.evaluate(async () => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const loadGLTF = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));

    const scene = window.__pearlsim.scene;
    const camera = window.__pearlsim.camera;

    // Load dental chair
    const chairGltf = await loadGLTF('./public/models/dental_chair.glb');
    const chair = chairGltf.scene;
    chair.scale.setScalar(0.01);
    chair.rotation.y = Math.PI / 2;
    chair.position.set(0.05, 0.05, -0.62);

    chair.traverse(child => {
      if (child.isMesh && child.material) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mat = child.material.clone();
        if (['Object_20', 'Object_27', 'Object_29', 'Object_18'].includes(child.name)) {
          mat.color.setHex(0x1e3a8a); // Navy blue upholstery
          mat.roughness = 0.45;
          mat.metalness = 0.05;
        } else if (['Object_19', 'Object_30', 'Object_65', 'Object_66'].includes(child.name)) {
          mat.color.setHex(0xe2e8f0); // Chrome
          mat.roughness = 0.15;
          mat.metalness = 0.95;
        } else if (['Object_15', 'Object_36', 'Object_54'].includes(child.name)) {
          mat.color.setHex(0x0d9488); // Mint spittoon
          mat.roughness = 0.35;
          mat.metalness = 0.1;
        } else {
          mat.color.setHex(0xf8fafc); // Clean medical off-white
          mat.roughness = 0.3;
          mat.metalness = 0.15;
        }
        child.material = mat;
      }
    });

    // Load realistic patient
    const patientGltf = await loadGLTF('./public/models/patient.glb');
    const pModel = patientGltf.scene;
    pModel.scale.setScalar(0.92);
    pModel.position.set(0.05, 0.58, -0.58);
    pModel.rotation.y = Math.PI; // Face toward clinician

    // Get bones
    const bones = {};
    pModel.traverse(o => { if (o.isBone) bones[o.name] = o; });

    // Pose patient seated in chair
    if (bones.Hips) {
      bones.Hips.position.y -= 0.02;
    }
    if (bones.Spine) bones.Spine.rotateX(-0.45);
    if (bones.Spine1) bones.Spine1.rotateX(-0.20);
    if (bones.Spine2) bones.Spine2.rotateX(-0.12);
    if (bones.Neck) bones.Neck.rotateX(0.24);
    if (bones.Head) bones.Head.rotateX(0.18);

    if (bones.LeftUpLeg) { bones.LeftUpLeg.rotateX(Math.PI * 0.45); bones.LeftUpLeg.rotateZ(-0.06); }
    if (bones.RightUpLeg) { bones.RightUpLeg.rotateX(Math.PI * 0.45); bones.RightUpLeg.rotateZ(0.06); }
    if (bones.LeftLeg) bones.LeftLeg.rotateX(-0.35);
    if (bones.RightLeg) bones.RightLeg.rotateX(-0.35);
    if (bones.LeftFoot) bones.LeftFoot.rotateX(0.28);
    if (bones.RightFoot) bones.RightFoot.rotateX(0.28);

    if (bones.LeftArm) { bones.LeftArm.rotateZ(-0.42); bones.LeftArm.rotateX(0.18); }
    if (bones.LeftForeArm) bones.LeftForeArm.rotateY(0.25);
    if (bones.RightArm) { bones.RightArm.rotateZ(0.42); bones.RightArm.rotateX(0.18); }
    if (bones.RightForeArm) bones.RightForeArm.rotateY(-0.25);

    // Open mouth
    pModel.traverse(o => {
      if (o.morphTargetDictionary && o.morphTargetInfluences) {
        const idx = o.morphTargetDictionary['mouthOpen'];
        if (idx !== undefined) o.morphTargetInfluences[idx] = 0.65;
      }
      if (o.isMesh && o.material) {
        o.castShadow = true;
        o.receiveShadow = true;
        // Apply skin tone
        if (o.name.includes('Skin') || o.name.includes('Head') || o.name.includes('Body')) {
          o.material = o.material.clone();
          o.material.color.setHex(0x4a2c1d); // Fitzpatrick VI
          o.material.roughness = 0.55;
        }
      }
    });

    // Load realistic nurse
    const nurseGltf = await loadGLTF('./public/models/assistant_female.glb');
    const nurse = nurseGltf.scene;
    nurse.scale.setScalar(0.92);
    nurse.position.set(-0.65, 0, -0.9);
    nurse.rotation.y = 0.5;

    const nBones = {};
    nurse.traverse(o => { if (o.isBone) nBones[o.name] = o; });
    if (nBones.LeftArm) { nBones.LeftArm.rotateX(1.35); }
    if (nBones.RightArm) { nBones.RightArm.rotateX(1.35); }

    nurse.traverse(o => {
      if (o.isMesh && o.material) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.name.includes('Outfit_Top') || o.name.includes('Outfit_Bottom')) {
          o.material = o.material.clone();
          o.material.color.setHex(0x0d9488); // Teal scrubs
          o.material.roughness = 0.8;
        }
      }
    });

    // Add to scene (hide procedural patient and procedural nurse for comparison)
    window.__pearlsim.world.patient.root.visible = false;
    window.__pearlsim.world.assistant.visible = false;

    scene.add(chair);
    scene.add(pModel);
    scene.add(nurse);

    return { success: true };
  });

  console.log('Setup evaluated:', status);
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT_DIR, 'realistic_operatory_preview.png') });
  console.log('Saved preview screenshot!');
  await browser.close();
}

run().catch(console.error);
