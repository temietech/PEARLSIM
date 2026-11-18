import { open, shot } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;

  // 1. NURSE SARAH
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
        mat.map = null;
        mat.color.setHex(0xf2cfb8); // Natural skin tone
        mat.roughness = 0.55;
        mat.metalness = 0.0;
      }
      child.material = mat;
    }
  });

  const nBones = {};
  P.world.assistant.traverse(c => { if (c.isBone) nBones[c.name] = c; });
  if (nBones.LeftArm) nBones.LeftArm.rotation.set(0.35, 0.1, -0.18);
  if (nBones.LeftForeArm) nBones.LeftForeArm.rotation.set(0.55, 0.2, 0.35);
  if (nBones.RightArm) nBones.RightArm.rotation.set(0.35, -0.1, 0.18);
  if (nBones.RightForeArm) nBones.RightForeArm.rotation.set(0.55, -0.2, -0.35);
  if (nBones.Head) nBones.Head.rotation.set(0.12, -0.35, 0);

  // 2. PATIENT MRS. ALEX ADEBAYO
  const pModel = P.world.patient.root.getObjectByName('PatientAvatar').children[0];
  const bones = {};
  pModel.traverse(c => { if (c.isBone) bones[c.name] = c; });

  // Patient root position
  pModel.position.set(0.08, -0.15, -0.48);

  // Recline spine backwards onto backrest cushion
  if (bones.Spine) bones.Spine.rotation.set(-0.38, 0, 0);
  if (bones.Spine1) bones.Spine1.rotation.set(-0.22, 0, 0);
  if (bones.Spine2) bones.Spine2.rotation.set(-0.12, 0, 0);
  if (bones.Neck) bones.Neck.rotation.set(0.24, 0, 0);
  if (bones.Head) bones.Head.rotation.set(0.18, 0, 0);

  // Legs: thighs along seat, knees flexed over crest, calves on leg rest
  if (bones.LeftUpLeg) bones.LeftUpLeg.rotation.set(1.78, 0, -0.06);
  if (bones.RightUpLeg) bones.RightUpLeg.rotation.set(1.78, 0, 0.06);
  if (bones.LeftLeg) bones.LeftLeg.rotation.set(-0.24, 0, 0);
  if (bones.RightLeg) bones.RightLeg.rotation.set(-0.24, 0, 0);
  if (bones.LeftFoot) bones.LeftFoot.rotation.set(0.12, 0, 0);
  if (bones.RightFoot) bones.RightFoot.rotation.set(0.12, 0, 0);

  // Arms: resting comfortably along sides and thighs
  if (bones.LeftArm) bones.LeftArm.rotation.set(0.22, 0.05, -0.30);
  if (bones.LeftForeArm) bones.LeftForeArm.rotation.set(0.35, 0.20, 0.25);
  if (bones.RightArm) bones.RightArm.rotation.set(0.22, -0.05, 0.30);
  if (bones.RightForeArm) bones.RightForeArm.rotation.set(0.35, -0.20, -0.25);

  pModel.updateMatrixWorld(true);
});

// Take shots
await shot(page, 'recline_side', [-1.6, 0.88, -0.2], [0.08, 0.76, -0.2], { fov: 52 });
await shot(page, 'recline_clinician_pov', [0.42, 1.42, -0.2], [0.08, 0.98, -0.68], { fov: 62 });
await shot(page, 'recline_face', [0.25, 1.25, -0.5], [0.08, 1.05, -0.75], { fov: 42 });

await browser.close();
console.log('recline tests done');
