import { open, shot, sleep } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;

  // 1. FIX THE NURSE
  P.world.assistant.traverse((child) => {
    // A. Hide reindeer glasses completely
    if (child.name === 'Wolf3D_Glasses') {
      child.visible = false;
    }
    // B. Fix materials to authentic hospital scrubs
    if (child.isMesh && child.material) {
      const mat = child.material.clone();
      if (child.name.includes('Outfit_Top') || child.name.includes('Outfit_Bottom')) {
        mat.map = null; // strip graphic t-shirt print
        mat.normalMap = null;
        mat.color.setHex(0x0d9488); // Professional hospital teal
        mat.roughness = 0.85;
        mat.metalness = 0.0;
      } else if (child.name.includes('Footwear')) {
        mat.map = null; // strip coral running shoes
        mat.color.setHex(0xf8fafc); // Clean white nursing clogs
        mat.roughness = 0.35;
      } else if (child.name.includes('Body')) {
        // Nitrile examination gloves on hands
        mat.map = null;
        mat.color.setHex(0x38bdf8); // Medical powder-free blue nitrile
        mat.roughness = 0.35;
        mat.clearcoat = 0.4;
      }
      child.material = mat;
    }
  });

  // Nurse natural clinical stance
  const nBones = {};
  P.world.assistant.traverse((o) => { if (o.isBone) nBones[o.name] = o; });
  if (nBones.LeftArm) {
    nBones.LeftArm.rotation.set(0.25, 0, -0.15);
  }
  if (nBones.LeftForeArm) {
    nBones.LeftForeArm.rotation.set(0.65, 0.2, 0.45);
  }
  if (nBones.RightArm) {
    nBones.RightArm.rotation.set(0.25, 0, 0.15);
  }
  if (nBones.RightForeArm) {
    nBones.RightForeArm.rotation.set(0.65, -0.2, -0.45);
  }
  if (nBones.Head) {
    nBones.Head.rotation.set(0.15, -0.35, 0); // Attentive gaze toward patient
  }
  P.world.assistant.position.set(-0.75, 0, -0.85);
  P.world.assistant.rotation.y = 0.45;

  // 2. FIX THE DENTAL CHAIR
  // Hide the giant blue corrugated delivery hose cutting through torso (Object_27)
  P.world.patient.chairGroup.traverse((child) => {
    if (child.name === 'Object_27') {
      child.visible = false;
    }
    if (child.isMesh && child.material) {
      const origMat = Array.isArray(child.material) ? child.material[0] : child.material;
      const mat = origMat.clone();
      // True royal navy blue leatherette cushions (strip old textures)
      if (['Object_18', 'Object_20', 'Object_29'].includes(child.name)) {
        mat.map = null;
        mat.color.setHex(0x1e3a8a); // Royal Navy
        mat.roughness = 0.45;
        mat.metalness = 0.05;
        mat.clearcoat = 0.3;
      } else if (['Object_15', 'Object_36', 'Object_54'].includes(child.name)) {
        mat.map = null;
        mat.color.setHex(0x0d9488); // Mint spittoon
        mat.roughness = 0.35;
      } else if (['Object_19', 'Object_30', 'Object_65', 'Object_66'].includes(child.name)) {
        mat.color.setHex(0xe2e8f0);
        mat.metalness = 0.95;
        mat.roughness = 0.15;
      }
      child.material = mat;
    }
  });

  // 3. FIX PATIENT POSITION & DERMATOLOGY
  // Lower patient model so hips sit flush on chair seat cushion
  const pModel = P.world.patient.root.getObjectByName('PatientAvatar');
  if (pModel) {
    pModel.position.set(0.05, 0.08, -0.65);
    pModel.rotation.y = -Math.PI / 2; // Align with chair longitudinal axis
  }

  // Pose patient naturally reclined
  const pBones = {};
  P.world.patient.root.traverse((o) => { if (o.isBone) pBones[o.name] = o; });

  if (pBones.Hips) pBones.Hips.position.set(0, 0.62, 0);
  if (pBones.Spine) pBones.Spine.rotation.set(-0.48, 0, 0);
  if (pBones.Spine1) pBones.Spine1.rotation.set(-0.18, 0, 0);
  if (pBones.Spine2) pBones.Spine2.rotation.set(-0.08, 0, 0);
  if (pBones.Neck) pBones.Neck.rotation.set(0.22, 0, 0);
  if (pBones.Head) pBones.Head.rotation.set(0.24, 0, 0);

  // Legs along the dental chair contour
  if (pBones.LeftUpLeg) pBones.LeftUpLeg.rotation.set(1.42, 0, -0.06);
  if (pBones.RightUpLeg) pBones.RightUpLeg.rotation.set(1.42, 0, 0.06);
  if (pBones.LeftLeg) pBones.LeftLeg.rotation.set(-0.45, 0, 0);
  if (pBones.RightLeg) pBones.RightLeg.rotation.set(-0.45, 0, 0);
  if (pBones.LeftFoot) pBones.LeftFoot.rotation.set(0.25, 0, 0);
  if (pBones.RightFoot) pBones.RightFoot.rotation.set(0.25, 0, 0);

  // Arms resting along armrests / lap
  if (pBones.LeftArm) pBones.LeftArm.rotation.set(0.22, 0, -0.35);
  if (pBones.LeftForeArm) pBones.LeftForeArm.rotation.set(0.35, 0.2, 0.15);
  if (pBones.RightArm) pBones.RightArm.rotation.set(0.22, 0, 0.35);
  if (pBones.RightForeArm) pBones.RightForeArm.rotation.set(0.35, -0.2, -0.15);

  // Style patient: mature silver-grey hair for 68yo Alex Adebayo
  P.world.patient.root.traverse((child) => {
    if (child.isMesh && child.material) {
      const mat = child.material.clone();
      if (child.name.includes('Hair')) {
        mat.map = null;
        mat.color.setHex(0x94a3b8); // Mature silver-grey
        mat.roughness = 0.9;
      }
      child.material = mat;
    }
  });

  // Hide the permanent target ring on the belly!
  const ring = P.world.patient.root.children.find(c => c.isMesh && c.geometry.type === 'RingGeometry');
  if (ring) ring.visible = false;

  // Add realistic clinical dental bib across the chest
  let bib = P.world.patient.root.getObjectByName('DentalBib');
  if (!bib) {
    const bibGeo = new THREE.PlaneGeometry(0.34, 0.38);
    const bibMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd, // Soft paper clinical cyan
      roughness: 0.85,
      side: THREE.DoubleSide
    });
    bib = new THREE.Mesh(bibGeo, bibMat);
    bib.name = 'DentalBib';
    bib.position.set(0.05, 0.88, -0.72);
    bib.rotation.set(-0.75, 0, 0);
    P.world.patient.root.add(bib);
  }

  // 4. POSITION CLINICIAN CAMERA CHAIRSIDE
  // Stand at patient's right side (natural dental operator position) looking at face, oral cavity & chest
  P.camera.position.set(0.55, 1.48, -0.45);
  P.camera.lookAt(0.05, 0.95, -0.85);
});

await sleep(1500);

// Capture screenshots from key perspectives
await shot(page, 'fixed_clinician_operatory_view', [0.55, 1.48, -0.45], [0.05, 0.95, -0.85], { fov: 62 });
await shot(page, 'fixed_nurse_closeup', [-0.55, 1.35, -0.55], [-0.75, 1.35, -0.85], { fov: 45 });
await shot(page, 'fixed_patient_face_closeup', [0.25, 1.25, -0.65], [0.05, 1.05, -0.92], { fov: 42 });
await shot(page, 'fixed_full_chairside_overview', [1.2, 1.6, 0.2], [0.0, 0.9, -0.7], { fov: 55 });

await browser.close();
