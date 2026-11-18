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
        const headMesh = P.world.assistant.getObjectByName('Wolf3D_Head');
        if (headMesh && headMesh.material && headMesh.material.map) {
          mat.map = headMesh.material.map;
          mat.color.copy(headMesh.material.color);
        } else {
          mat.map = null;
          mat.color.setHex(0xf2cfb8);
        }
        mat.roughness = 0.55;
        mat.metalness = 0.0;
      }
      child.material = mat;
    }
  });

  // Nurse attentive clinical posture: hands relaxed at sides or front
  const nBones = {};
  P.world.assistant.traverse(c => { if (c.isBone) nBones[c.name] = c; });
  if (nBones.LeftArm) nBones.LeftArm.rotation.set(0.4, 0.1, -0.2);
  if (nBones.LeftForeArm) nBones.LeftForeArm.rotation.set(0.6, 0.2, 0.4);
  if (nBones.RightArm) nBones.RightArm.rotation.set(0.4, -0.1, 0.2);
  if (nBones.RightForeArm) nBones.RightForeArm.rotation.set(0.6, -0.2, -0.4);
  if (nBones.Head) nBones.Head.rotation.set(0.15, -0.35, 0);

  // 2. PATIENT MRS. ALEX ADEBAYO - Perfect ergonomic seating contour
  const pModel = P.world.patient.root.getObjectByName('PatientAvatar').children[0];
  const bones = {};
  pModel.traverse(c => { if (c.isBone) bones[c.name] = c; });

  // Move patient origin so hips sit directly into seat valley and slightly back
  // Seat valley is at Z ~ -0.25 to -0.30, Y ~ 0.73.
  pModel.position.set(0.08, -0.27, -0.32);

  // Recline spine back into the backrest cushion
  if (bones.Spine) bones.Spine.rotation.set(0.48, 0, 0);
  if (bones.Spine1) bones.Spine1.rotation.set(0.32, 0, 0);
  if (bones.Spine2) bones.Spine2.rotation.set(0.18, 0, 0);
  if (bones.Neck) bones.Neck.rotation.set(-0.15, 0, 0);
  if (bones.Head) bones.Head.rotation.set(-0.10, 0, 0);

  // Legs:
  // Thighs angled along seat surface
  if (bones.LeftUpLeg) bones.LeftUpLeg.rotation.set(0.92, 0, -0.06);
  if (bones.RightUpLeg) bones.RightUpLeg.rotation.set(0.92, 0, 0.06);
  // Knees: flex over cushion crest so calves follow chair legrest
  if (bones.LeftLeg) bones.LeftLeg.rotation.set(0.42, 0, 0);
  if (bones.RightLeg) bones.RightLeg.rotation.set(0.42, 0, 0);
  // Feet resting relaxed on legrest surface
  if (bones.LeftFoot) bones.LeftFoot.rotation.set(-0.25, 0, 0);
  if (bones.RightFoot) bones.RightFoot.rotation.set(-0.25, 0, 0);

  // Arms: Resting naturally across lower abdomen / chair armrests
  if (bones.LeftArm) bones.LeftArm.rotation.set(0.45, 0.1, -0.25);
  if (bones.LeftForeArm) bones.LeftForeArm.rotation.set(0.55, 0.35, 0.45);
  if (bones.RightArm) bones.RightArm.rotation.set(0.45, -0.1, 0.25);
  if (bones.RightForeArm) bones.RightForeArm.rotation.set(0.55, -0.35, -0.45);

  pModel.updateMatrixWorld(true);
});

// Take side view to check backrest contact and leg contour
await shot(page, 'pose_side_check', [-1.6, 0.85, -0.1], [0.08, 0.72, -0.1], { fov: 50 });
// Take clinician POV
await shot(page, 'pose_clinician_pov', [0.45, 1.45, -0.15], [0.08, 0.95, -0.65], { fov: 60 });
// Take legs closeup
await shot(page, 'pose_legs_closeup', [0.85, 1.0, 0.25], [0.12, 0.65, 0.1], { fov: 48 });

await browser.close();
console.log('pose check done');
