import { open, shot, sleep } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.waitForFunction(() => {
  const P = window.__pearlsim;
  return P?.world?.patient?.chairGroup?.children?.length > 0 &&
         P?.world?.patient?.root?.getObjectByName('Wolf3D_Head') &&
         P?.world?.assistant?.getObjectByName('Wolf3D_Head');
}, { timeout: 25000 });

const result = await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;

  // 1. FIX THE DENTAL CHAIR
  const chair = P.world.patient.chairGroup.children[0];
  if (chair) {
    // Hide the giant delivery arm/hose that impales the patient
    chair.traverse((child) => {
      if (child.name === 'Object_27' || child.name === 'Object_26' || child.name === 'Object_33') {
        // Check if it's the delivery unit
        if (child.name === 'Object_27') child.visible = false;
      }
      if (child.isMesh && child.material) {
        const origMat = Array.isArray(child.material) ? child.material[0] : child.material;
        const mat = origMat.clone();
        // True Royal Navy leatherette cushions with no texture bleeding
        if (['Object_18', 'Object_20', 'Object_29'].includes(child.name)) {
          mat.map = null;
          mat.normalMap = null;
          mat.roughnessMap = null;
          mat.color.setHex(0x1e3a8a); // Royal Navy
          mat.roughness = 0.42;
          mat.metalness = 0.05;
          mat.clearcoat = 0.35;
          mat.clearcoatRoughness = 0.25;
        } else if (['Object_15', 'Object_36', 'Object_54'].includes(child.name)) {
          mat.map = null;
          mat.color.setHex(0x0d9488); // Clean mint spittoon
          mat.roughness = 0.3;
        } else if (['Object_19', 'Object_30', 'Object_65', 'Object_66'].includes(child.name)) {
          mat.color.setHex(0xe2e8f0); // Polished surgical chrome
          mat.metalness = 0.95;
          mat.roughness = 0.12;
        } else {
          mat.color.setHex(0xf8fafc); // Clean medical enamel
          mat.roughness = 0.28;
          mat.metalness = 0.1;
        }
        child.material = mat;
      }
    });

    // Set chair rotation to pos90 (+Math.PI/2) and adjust position
    chair.rotation.y = Math.PI / 2;
    chair.position.set(0.08, 0.04, -0.58);
  }

  // 2. FIX NURSE SARAH
  P.world.assistant.traverse((child) => {
    // Remove reindeer antlers / glasses / clown nose completely
    if (child.name === 'Wolf3D_Glasses') {
      child.visible = false;
    }
    if (child.isMesh && child.material) {
      const mat = child.material.clone();
      if (child.name.includes('Outfit_Top') || child.name.includes('Outfit_Bottom')) {
        mat.map = null;
        mat.normalMap = null;
        mat.roughnessMap = null;
        mat.color.setHex(0x0d9488); // Professional hospital teal scrubs
        mat.roughness = 0.82;
        mat.metalness = 0.0;
      } else if (child.name.includes('Footwear')) {
        mat.map = null;
        mat.normalMap = null;
        mat.color.setHex(0xf8fafc); // White clinical nursing shoes
        mat.roughness = 0.4;
      } else if (child.name.includes('Body')) {
        mat.map = null;
        mat.color.setHex(0x38bdf8); // Medical powder-free blue nitrile gloves
        mat.roughness = 0.35;
        mat.clearcoat = 0.4;
      }
      child.material = mat;
    }
  });

  // Nurse natural attentive stance
  const nBones = {};
  P.world.assistant.traverse((o) => { if (o.isBone) nBones[o.name] = o; });
  if (nBones.LeftArm) nBones.LeftArm.rotation.set(0.35, 0.1, -0.2);
  if (nBones.LeftForeArm) nBones.LeftForeArm.rotation.set(0.85, 0.3, 0.5);
  if (nBones.RightArm) nBones.RightArm.rotation.set(0.35, -0.1, 0.2);
  if (nBones.RightForeArm) nBones.RightForeArm.rotation.set(0.85, -0.3, -0.5);
  if (nBones.Head) nBones.Head.rotation.set(0.18, -0.42, 0); // Attentive gaze on patient
  P.world.assistant.position.set(-0.72, 0, -0.82);
  P.world.assistant.rotation.y = 0.52;

  // 3. FIX PATIENT POSE & ALIGNMENT
  const pAvatarGroup = P.world.patient.root.getObjectByName('PatientAvatar');
  const pBones = {};
  P.world.patient.root.traverse((o) => { if (o.isBone) pBones[o.name] = o; });

  // Reset avatar group position to sit flush in chair
  if (pAvatarGroup) {
    pAvatarGroup.position.set(0.08, 0.12, -0.58);
  }

  // Natural dental recline pose
  if (pBones.Hips) pBones.Hips.position.set(0, 0.54, 0);
  if (pBones.Spine) pBones.Spine.rotation.set(-0.35, 0, 0);
  if (pBones.Spine1) pBones.Spine1.rotation.set(-0.16, 0, 0);
  if (pBones.Spine2) pBones.Spine2.rotation.set(-0.06, 0, 0);
  if (pBones.Neck) pBones.Neck.rotation.set(0.18, 0, 0);
  if (pBones.Head) pBones.Head.rotation.set(0.20, 0, 0);

  // Legs along the chair
  if (pBones.LeftUpLeg) pBones.LeftUpLeg.rotation.set(1.48, 0, -0.05);
  if (pBones.RightUpLeg) pBones.RightUpLeg.rotation.set(1.48, 0, 0.05);
  if (pBones.LeftLeg) pBones.LeftLeg.rotation.set(-0.48, 0, 0);
  if (pBones.RightLeg) pBones.RightLeg.rotation.set(-0.48, 0, 0);
  if (pBones.LeftFoot) pBones.LeftFoot.rotation.set(0.32, 0, 0);
  if (pBones.RightFoot) pBones.RightFoot.rotation.set(0.32, 0, 0);

  // Arms along armrests
  if (pBones.LeftArm) pBones.LeftArm.rotation.set(0.20, 0, -0.32);
  if (pBones.LeftForeArm) pBones.LeftForeArm.rotation.set(0.30, 0.15, 0.15);
  if (pBones.RightArm) pBones.RightArm.rotation.set(0.20, 0, 0.32);
  if (pBones.RightForeArm) pBones.RightForeArm.rotation.set(0.30, -0.15, -0.15);

  // Patient hair: mature silver-grey for 68yo Alex Adebayo
  P.world.patient.root.traverse((child) => {
    if (child.isMesh && child.name.includes('Hair') && child.material) {
      const mat = child.material.clone();
      mat.map = null;
      mat.color.setHex(0x94a3b8);
      mat.roughness = 0.9;
      child.material = mat;
    }
  });

  // Hide permanent green belly ring!
  const ring = P.world.patient.root.children.find(c => c.isMesh && c.geometry.type === 'RingGeometry');
  if (ring) ring.visible = false;

  // Add realistic clinical dental bib
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
    bib.position.set(0.08, 0.78, -0.68);
    bib.rotation.set(-0.72, 0, 0);
    P.world.patient.root.add(bib);
  }

  // Get key positions for camera targeting
  const headPos = new THREE.Vector3();
  const hipsPos = new THREE.Vector3();
  if (pBones.Head) pBones.Head.getWorldPosition(headPos);
  if (pBones.Hips) pBones.Hips.getWorldPosition(hipsPos);

  return {
    headPos: headPos.toArray().map(v => v.toFixed(3)),
    hipsPos: hipsPos.toArray().map(v => v.toFixed(3)),
  };
});

console.log('Result:', result);
await sleep(1000);

// Take screenshots
await shot(page, 'align_clinician_pov', [0.48, 1.45, -0.42], [0.08, 0.88, -0.72], { fov: 62 });
await shot(page, 'align_side_profile', [1.5, 1.1, -0.55], [0.08, 0.75, -0.55], { fov: 50 });
await shot(page, 'align_nurse_attentive', [-0.5, 1.35, -0.45], [-0.72, 1.3, -0.82], { fov: 46 });
await shot(page, 'align_operatory_overview', [0.1, 2.8, 0.8], [0.08, 0.7, -0.6], { fov: 65 });

await browser.close();
