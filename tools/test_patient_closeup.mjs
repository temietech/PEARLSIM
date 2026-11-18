import { open, shot, sleep } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.waitForFunction(() => {
  const P = window.__pearlsim;
  return P?.world?.patient?.chairGroup?.children?.length > 0 &&
         P?.world?.patient?.root?.getObjectByName('Wolf3D_Head') &&
         P?.world?.assistant?.getObjectByName('Wolf3D_Head');
}, { timeout: 25000 });

await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;

  // 1. POSITION AND CONFIGURE THE DENTAL CHAIR
  const chair = P.world.patient.chairGroup.children[0];
  const requiredRot = -2.36515;
  chair.rotation.y = requiredRot;
  chair.position.set(0.25, 0.04, 0.42);

  chair.traverse(c => {
    const keep = [
      'Object_65', 'Object_66', 'Object_61', 'Object_62',
      'Object_57', 'Object_58', 'Object_47', 'Object_48', 'Object_51',
      'Object_43', 'Object_44', 'Object_39', 'Object_40',
      'Object_15', 'Object_36', 'Object_54',
    ];
    if (c.isMesh) {
      if (!keep.includes(c.name)) {
        c.visible = false;
      } else {
        c.visible = true;
        const origMat = Array.isArray(c.material) ? c.material[0] : c.material;
        const mat = origMat.clone();
        mat.map = null;
        mat.normalMap = null;
        mat.roughnessMap = null;

        if (['Object_15', 'Object_36', 'Object_54'].includes(c.name)) {
          mat.color.setHex(0x1e3a8a); // Royal Navy Leatherette
          mat.roughness = 0.38;
          mat.metalness = 0.05;
          mat.clearcoat = 0.35;
          mat.clearcoatRoughness = 0.2;
        } else if (['Object_65', 'Object_66'].includes(c.name)) {
          mat.color.setHex(0xe2e8f0); // Chrome
          mat.metalness = 0.95;
          mat.roughness = 0.12;
        } else {
          mat.color.setHex(0xf8fafc); // Clean white medical enamel
          mat.roughness = 0.3;
          mat.metalness = 0.08;
        }
        c.material = mat;
      }
    }
  });

  // 2. PATIENT AVATAR
  const pAvatarGroup = P.world.patient.root.getObjectByName('PatientAvatar');
  const pModel = pAvatarGroup.children[0];
  pModel.position.set(0.08, 0.02, -0.62);

  // Mature silver hair for 68yo Alex Adebayo
  pModel.traverse(c => {
    if (c.isMesh && c.name.includes('Hair') && c.material) {
      const mat = c.material.clone();
      mat.map = null;
      mat.color.setHex(0x94a3b8);
      mat.roughness = 0.9;
      c.material = mat;
    }
  });

  // Hide permanent target ring on the belly
  const ring = P.world.patient.root.children.find(c => c.isMesh && c.geometry.type === 'RingGeometry');
  if (ring) ring.visible = false;

  // Add realistic clinical dental bib across chest
  let bib = P.world.patient.root.getObjectByName('DentalBib');
  if (!bib) {
    const bibGeo = new THREE.PlaneGeometry(0.32, 0.36);
    const bibMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd, // Disposable medical paper cyan
      roughness: 0.88,
      side: THREE.DoubleSide
    });
    bib = new THREE.Mesh(bibGeo, bibMat);
    bib.name = 'DentalBib';
    P.world.patient.root.add(bib);
  }
  bib.position.set(0.08, 0.92, -0.66);
  bib.rotation.set(-0.68, 0, 0);

  // 3. NURSE SARAH
  P.world.assistant.traverse(child => {
    if (child.name === 'Wolf3D_Glasses') child.visible = false;
    if (child.isMesh && child.material) {
      const mat = child.material.clone();
      if (child.name.includes('Outfit_Top') || child.name.includes('Outfit_Bottom')) {
        mat.map = null;
        mat.normalMap = null;
        mat.roughnessMap = null;
        mat.color.setHex(0x0d9488);
        mat.roughness = 0.82;
        mat.metalness = 0.0;
      } else if (child.name.includes('Footwear')) {
        mat.map = null;
        mat.normalMap = null;
        mat.color.setHex(0xf8fafc);
        mat.roughness = 0.4;
      } else if (child.name.includes('Body')) {
        mat.map = null;
        mat.color.setHex(0x38bdf8);
        mat.roughness = 0.35;
        mat.clearcoat = 0.4;
      }
      child.material = mat;
    }
  });

  const nBones = {};
  P.world.assistant.traverse((o) => { if (o.isBone) nBones[o.name] = o; });
  if (nBones.LeftArm) nBones.LeftArm.rotation.set(0.45, 0.1, -0.22);
  if (nBones.LeftForeArm) nBones.LeftForeArm.rotation.set(0.95, 0.3, 0.55);
  if (nBones.RightArm) nBones.RightArm.rotation.set(0.45, -0.1, 0.22);
  if (nBones.RightForeArm) nBones.RightForeArm.rotation.set(0.95, -0.3, -0.55);
  if (nBones.Head) nBones.Head.rotation.set(0.18, -0.42, 0);
  P.world.assistant.position.set(-0.72, 0, -0.82);
  P.world.assistant.rotation.y = 0.52;
});

await sleep(800);

// Capture refined clinician POV with full head and face in frame
await shot(page, 'refined_clinician_pov', [0.48, 1.48, -0.18], [0.08, 1.12, -0.72], { fov: 62 });
// Patient face and mouth closeup (for mirror examination inspection)
await shot(page, 'refined_patient_face_exam', [0.24, 1.35, -0.52], [0.08, 1.25, -0.78], { fov: 42 });
// Patient lap, thigh, and hands (for pulse palpation and EpiPen injection)
await shot(page, 'refined_patient_torso_thigh', [0.45, 1.25, -0.25], [0.08, 0.78, -0.52], { fov: 50 });

await browser.close();
