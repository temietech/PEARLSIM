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

  const chair = P.world.patient.chairGroup.children[0];
  const pAvatarGroup = P.world.patient.root.getObjectByName('PatientAvatar');
  const pModel = pAvatarGroup.children[0];

  // 1. CHAIR: rotation.y = Math.PI / 2, align X with patient (X=0.50), align Z (Z=-0.15)
  chair.rotation.y = Math.PI / 2;
  chair.position.set(0.50, 0.04, -0.15);

  chair.traverse((child) => {
    // Hide delivery hose/arm cutting through body
    if (child.name === 'Object_27') {
      child.visible = false;
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

  // 2. PATIENT AVATAR: Lower to match cushion heights
  pModel.position.set(0.08, -0.10, -0.62);

  // Mature silver-grey hair for 68yo Alex Adebayo
  pModel.traverse((child) => {
    if (child.isMesh && child.name.includes('Hair') && child.material) {
      const mat = child.material.clone();
      mat.map = null;
      mat.color.setHex(0x94a3b8);
      mat.roughness = 0.9;
      child.material = mat;
    }
  });

  // Hide permanent target ring on the belly!
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

  // 3. NURSE SARAH
  P.world.assistant.traverse((child) => {
    if (child.name === 'Wolf3D_Glasses') {
      child.visible = false;
    }
    if (child.isMesh && child.material) {
      const mat = child.material.clone();
      if (child.name.includes('Outfit_Top') || child.name.includes('Outfit_Bottom')) {
        mat.map = null;
        mat.normalMap = null;
        mat.roughnessMap = null;
        mat.color.setHex(0x0d9488); // Hospital teal scrubs
        mat.roughness = 0.82;
        mat.metalness = 0.0;
      } else if (child.name.includes('Footwear')) {
        mat.map = null;
        mat.normalMap = null;
        mat.color.setHex(0xf8fafc); // Clean nursing clogs
        mat.roughness = 0.4;
      } else if (child.name.includes('Body')) {
        mat.map = null;
        mat.color.setHex(0x38bdf8); // Powder-free blue nitrile gloves
        mat.roughness = 0.35;
        mat.clearcoat = 0.4;
      }
      child.material = mat;
    }
  });

  // Natural attentive clinical posture for Sarah
  const nBones = {};
  P.world.assistant.traverse((o) => { if (o.isBone) nBones[o.name] = o; });
  if (nBones.LeftArm) nBones.LeftArm.rotation.set(0.45, 0.1, -0.22);
  if (nBones.LeftForeArm) nBones.LeftForeArm.rotation.set(0.95, 0.3, 0.55);
  if (nBones.RightArm) nBones.RightArm.rotation.set(0.45, -0.1, 0.22);
  if (nBones.RightForeArm) nBones.RightForeArm.rotation.set(0.95, -0.3, -0.55);
  if (nBones.Head) nBones.Head.rotation.set(0.18, -0.42, 0);
  P.world.assistant.position.set(-0.72, 0, -0.82);
  P.world.assistant.rotation.y = 0.52;

  // Measure final alignment
  pModel.updateMatrixWorld(true);
  chair.updateMatrixWorld(true);
  const pBones = {};
  pModel.traverse((o) => { if (o.isBone) pBones[o.name] = o; });
  const headPos = new THREE.Vector3();
  const hipsPos = new THREE.Vector3();
  const spinePos = new THREE.Vector3();
  const handPos = new THREE.Vector3();
  if (pBones.Head) pBones.Head.getWorldPosition(headPos);
  if (pBones.Hips) pBones.Hips.getWorldPosition(hipsPos);
  if (pBones.Spine2) pBones.Spine2.getWorldPosition(spinePos);
  if (pBones.LeftHand) pBones.LeftHand.getWorldPosition(handPos);

  if (bib && spinePos.y > 0) {
    bib.position.set(spinePos.x, spinePos.y + 0.06, spinePos.z + 0.10);
    bib.rotation.set(-0.68, 0, 0);
  }

  // Update interaction zones to match lowered patient bones
  if (P.world.patient.zones) {
    if (pBones.LeftHand) pBones.LeftHand.getWorldPosition(P.world.patient.zones.wrist.position);
    if (pBones.Head) {
      pBones.Head.getWorldPosition(P.world.patient.zones.mouth.position);
      P.world.patient.zones.mouth.position.z += 0.08;
      P.world.patient.zones.mouth.position.y -= 0.02;
    }
    if (pBones.LeftUpLeg) {
      pBones.LeftUpLeg.getWorldPosition(P.world.patient.zones.thigh.position);
      P.world.patient.zones.thigh.position.x -= 0.06;
      P.world.patient.zones.thigh.position.y += 0.04;
    }
  }

  return {
    head: headPos.toArray().map(v => v.toFixed(3)),
    hips: hipsPos.toArray().map(v => v.toFixed(3)),
    spine: spinePos.toArray().map(v => v.toFixed(3)),
    hand: handPos.toArray().map(v => v.toFixed(3))
  };
});

console.log('Resulting alignment:', result);
await sleep(800);

// Let's capture four critical angles:
// 1. Overhead view of operatory
await shot(page, 'perfect_operatory_overhead', [0.08, 3.2, 0.2], [0.08, 0.8, -0.6], { fov: 60 });
// 2. Chairside Clinician POV (sitting/standing right beside the patient looking at oral cavity and chest)
await shot(page, 'perfect_clinician_pov', [0.48, 1.35, -0.45], [0.08, 1.05, -0.75], { fov: 62 });
// 3. Side profile showing patient resting flush on cushions
await shot(page, 'perfect_side_profile', [1.5, 1.1, -0.62], [0.08, 0.95, -0.62], { fov: 48 });
// 4. Nurse Sarah in clean hospital scrubs
await shot(page, 'perfect_nurse_scrubs', [-0.42, 1.30, -0.52], [-0.72, 1.25, -0.82], { fov: 46 });

await browser.close();
