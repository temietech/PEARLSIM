import { open, shot, sleep } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.waitForFunction(() => {
  const P = window.__pearlsim;
  return P?.world?.patient?.chairGroup?.children?.length > 0 &&
         P?.world?.patient?.root?.getObjectByName('Wolf3D_Head') &&
         P?.world?.assistant?.getObjectByName('Wolf3D_Head');
}, { timeout: 25000 });

const metrics = await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;

  // 1. CHAIR: rotation.y = 0, hide delivery arm Object_27, apply royal navy leatherette with map=null
  const chair = P.world.patient.chairGroup.children[0];
  chair.rotation.y = 0;
  // Center chair slightly under patient:
  chair.position.set(0.08, 0.04, -0.62);

  chair.traverse((child) => {
    // Hide blue delivery hose/arm cutting through body
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

  // 2. PATIENT AVATAR: Lower slightly so body rests flush on chair cushions
  const pAvatarGroup = P.world.patient.root.getObjectByName('PatientAvatar');
  // Original position was (0.08, 0.62, -0.62). Let's lower Y so back and hips are on cushions:
  pAvatarGroup.position.set(0.08, 0.46, -0.62);

  // Mature silver-grey hair for 68yo Alex Adebayo
  P.world.patient.root.traverse((child) => {
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
    bib.position.set(0.08, 1.48, -0.66);
    bib.rotation.set(-0.72, 0, 0);
    P.world.patient.root.add(bib);
  }

  // 3. NURSE SARAH
  P.world.assistant.traverse((child) => {
    // Hide reindeer glasses completely
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

  // Let's get bone world positions of patient to confirm head, chest, mouth, wrist, thigh
  const pBones = {};
  P.world.patient.root.traverse((o) => { if (o.isBone) pBones[o.name] = o; });
  const headPos = new THREE.Vector3();
  const hipsPos = new THREE.Vector3();
  const handPos = new THREE.Vector3();
  const legPos = new THREE.Vector3();
  if (pBones.Head) pBones.Head.getWorldPosition(headPos);
  if (pBones.Hips) pBones.Hips.getWorldPosition(hipsPos);
  if (pBones.LeftHand) pBones.LeftHand.getWorldPosition(handPos);
  if (pBones.LeftUpLeg) pBones.LeftUpLeg.getWorldPosition(legPos);

  // Update bib position to match actual chest world position
  const spinePos = new THREE.Vector3();
  if (pBones.Spine2) pBones.Spine2.getWorldPosition(spinePos);
  if (bib && spinePos.y > 0) {
    bib.position.set(spinePos.x, spinePos.y + 0.08, spinePos.z + 0.12);
  }

  return {
    head: headPos.toArray().map(v => v.toFixed(3)),
    hips: hipsPos.toArray().map(v => v.toFixed(3)),
    hand: handPos.toArray().map(v => v.toFixed(3)),
    spine: spinePos.toArray().map(v => v.toFixed(3))
  };
});

console.log('Patient metrics:', metrics);
await sleep(800);

// Let's take screenshots from:
// 1. Top-down overhead view of operatory
await shot(page, 'rot0_operatory_overhead', [0.1, 3.2, 0.6], [0.08, 0.7, -0.6], { fov: 60 });
// 2. Chairside clinician POV looking down at patient
await shot(page, 'rot0_clinician_pov', [0.55, 1.48, -0.42], [0.08, 1.25, -0.65], { fov: 60 });
// 3. Patient face and chest closeup
await shot(page, 'rot0_patient_face_bib', [0.25, 1.55, -0.35], [0.08, 1.55, -0.72], { fov: 42 });
// 4. Nurse Sarah closeup
await shot(page, 'rot0_nurse_scrubs', [-0.45, 1.35, -0.45], [-0.72, 1.30, -0.82], { fov: 46 });

await browser.close();
