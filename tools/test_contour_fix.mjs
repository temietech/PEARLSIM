import { open, shot, sleep } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.waitForFunction(() => {
  const P = window.__pearlsim;
  return P?.world?.patient?.chairGroup?.children?.length > 0 &&
         P?.world?.patient?.root?.getObjectByName('Wolf3D_Head');
}, { timeout: 25000 });

await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;

  // 1. FIX NURSE SARAH'S ARMS (NO BLUE ARMS!)
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
        // Natural human skin tone for arms and hands - NO CYAN BLUE!
        // Copy skin properties from Wolf3D_Head so arms match face perfectly
        const headMesh = P.world.assistant.getObjectByName('Wolf3D_Head');
        if (headMesh && headMesh.material) {
          mat.color.copy(headMesh.material.color);
          mat.roughness = 0.55;
          mat.metalness = 0.0;
          // Keep skin map if available
          if (headMesh.material.map) mat.map = headMesh.material.map;
        } else {
          mat.map = null;
          mat.color.setHex(0xf2cfb8); // Natural healthy skin tone
          mat.roughness = 0.55;
        }
      }
      child.material = mat;
    }
  });

  // 2. FIX PATIENT LEGS - FOLLOW EXACT CONTOUR OF THE CHAIR (ZERO CLIPPING)
  const pModel = P.world.patient.root.getObjectByName('PatientAvatar').children[0];
  const bones = {};
  pModel.traverse(c => { if (c.isBone) bones[c.name] = c; });

  // Position patient so hips sit comfortably in saddle of seat
  pModel.position.set(0.08, 0.08, -0.56);

  // Spine recline along backrest
  if (bones.Spine) bones.Spine.rotation.set(-0.42, 0, 0);
  if (bones.Spine1) bones.Spine1.rotation.set(-0.18, 0, 0);
  if (bones.Spine2) bones.Spine2.rotation.set(-0.10, 0, 0);
  if (bones.Neck) bones.Neck.rotation.set(0.20, 0, 0);
  if (bones.Head) bones.Head.rotation.set(0.18, 0, 0);

  // Legs contoured to seat and leg rest cushion:
  // Thighs angled along seat surface
  if (bones.LeftUpLeg) bones.LeftUpLeg.rotation.set(1.36, 0, -0.05);
  if (bones.RightUpLeg) bones.RightUpLeg.rotation.set(1.36, 0, 0.05);
  // Knees gently extended so calves rest ON TOP of the cushion (no clipping into foam)
  if (bones.LeftLeg) bones.LeftLeg.rotation.set(-0.06, 0, 0);
  if (bones.RightLeg) bones.RightLeg.rotation.set(-0.06, 0, 0);
  // Feet resting relaxed on leg support
  if (bones.LeftFoot) bones.LeftFoot.rotation.set(0.15, 0, 0);
  if (bones.RightFoot) bones.RightFoot.rotation.set(0.15, 0, 0);

  // Arms resting naturally along chair sides
  if (bones.LeftArm) bones.LeftArm.rotation.set(0.20, 0, -0.32);
  if (bones.LeftForeArm) bones.LeftForeArm.rotation.set(0.25, 0.15, 0.12);
  if (bones.RightArm) bones.RightArm.rotation.set(0.20, 0, 0.32);
  if (bones.RightForeArm) bones.RightForeArm.rotation.set(0.25, -0.15, -0.12);
});

await sleep(800);

// Capture screenshots specifically checking legs and nurse arms
// 1. Direct side view showing patient body and legs contouring along the chair
await shot(page, 'contour_side_view', [-1.6, 0.85, -0.3], [0.08, 0.72, -0.3], { fov: 45 });
// 2. Quarter angle showing thighs and legs resting on cushion
await shot(page, 'contour_legs_closeup', [0.95, 1.1, 0.1], [0.08, 0.75, -0.2], { fov: 46 });
// 3. Nurse Sarah closeup showing natural skin arms (no blue arms!)
await shot(page, 'contour_nurse_natural_arms', [-0.42, 1.35, -0.52], [-0.72, 1.25, -0.82], { fov: 48 });
// 4. Clinician POV overview
await shot(page, 'contour_clinician_pov', [0.48, 1.48, -0.18], [0.08, 1.12, -0.72], { fov: 62 });

await browser.close();
