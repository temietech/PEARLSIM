import { open, shot } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;

  // 1. NURSE SARAH - Natural skin tone matching head, short-sleeve teal scrubs, white clogs
  P.world.assistant.traverse(child => {
    if (child.name === 'Wolf3D_Glasses') child.visible = false;
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
        // Natural skin tone - absolutely NO CYAN BLUE!
        mat.map = null;
        mat.color.setHex(0xf2cfb8);
        mat.roughness = 0.55;
        mat.metalness = 0.0;
      }
      child.material = mat;
    }
  });

  // Nurse natural attentive posture
  const nBones = {};
  P.world.assistant.traverse(c => { if (c.isBone) nBones[c.name] = c; });
  if (nBones.LeftArm) nBones.LeftArm.rotation.set(0.35, 0.1, -0.18);
  if (nBones.LeftForeArm) nBones.LeftForeArm.rotation.set(0.55, 0.2, 0.35);
  if (nBones.RightArm) nBones.RightArm.rotation.set(0.35, -0.1, 0.18);
  if (nBones.RightForeArm) nBones.RightForeArm.rotation.set(0.55, -0.2, -0.35);
  if (nBones.Head) nBones.Head.rotation.set(0.12, -0.35, 0);

  // 2. PATIENT MRS. ALEX ADEBAYO - Anatomically grounded seating contour
  const pModel = P.world.patient.root.getObjectByName('PatientAvatar').children[0];
  const bones = {};
  pModel.traverse(c => { if (c.isBone) bones[c.name] = c; });

  // Patient root position:
  // Hips at seat saddle: Y = -0.15, Z = -0.48
  pModel.position.set(0.08, -0.15, -0.48);

  // Recline spine back into the backrest cushion and headrest
  if (bones.Spine) bones.Spine.rotation.set(0.42, 0, 0);
  if (bones.Spine1) bones.Spine1.rotation.set(0.28, 0, 0);
  if (bones.Spine2) bones.Spine2.rotation.set(0.16, 0, 0);
  if (bones.Neck) bones.Neck.rotation.set(-0.18, 0, 0);
  if (bones.Head) bones.Head.rotation.set(-0.12, 0, 0);

  // Legs: thighs along seat slope, knees resting over cushion crest, calves along leg rest
  if (bones.LeftUpLeg) bones.LeftUpLeg.rotation.set(1.78, 0, -0.06);
  if (bones.RightUpLeg) bones.RightUpLeg.rotation.set(1.78, 0, 0.06);
  if (bones.LeftLeg) bones.LeftLeg.rotation.set(-0.24, 0, 0);
  if (bones.RightLeg) bones.RightLeg.rotation.set(-0.24, 0, 0);
  if (bones.LeftFoot) bones.LeftFoot.rotation.set(0.12, 0, 0);
  if (bones.RightFoot) bones.RightFoot.rotation.set(0.12, 0, 0);

  // Arms: resting comfortably on chair armrests / lap
  if (bones.LeftArm) bones.LeftArm.rotation.set(0.32, 0.12, -0.28);
  if (bones.LeftForeArm) bones.LeftForeArm.rotation.set(0.50, 0.30, 0.40);
  if (bones.RightArm) bones.RightArm.rotation.set(0.32, -0.12, 0.28);
  if (bones.RightForeArm) bones.RightForeArm.rotation.set(0.50, -0.30, -0.40);

  pModel.updateMatrixWorld(true);
});

// Take 4 comprehensive verification shots
// 1. Full operatory side view (patient head-to-toe + chair)
await shot(page, 'realism_full_side', [-1.6, 0.88, -0.2], [0.08, 0.76, -0.2], { fov: 52 });
// 2. Legs closeup from clinician side
await shot(page, 'realism_legs_closeup', [0.85, 0.98, 0.2], [0.12, 0.68, 0.05], { fov: 46 });
// 3. Nurse Sarah closeup showing natural arms & teal scrubs
await shot(page, 'realism_nurse_sarah', [-0.4, 1.35, -0.55], [-0.7, 1.25, -0.85], { fov: 50 });
// 4. Clinician 9 o'clock dental examination POV
await shot(page, 'realism_clinician_pov', [0.42, 1.42, -0.2], [0.08, 0.98, -0.68], { fov: 62 });

await browser.close();
console.log('all realism shots taken');
