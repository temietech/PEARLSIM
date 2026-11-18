import { open, shot } from './h.mjs';

const { browser, page } = await open({ enter: true });

// Test candidate postures
const results = await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;

  // Fix Nurse Sarah first
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

  const pModel = P.world.patient.root.getObjectByName('PatientAvatar').children[0];
  const bones = {};
  pModel.traverse(c => { if (c.isBone) bones[c.name] = c; });

  // Posture tuning:
  // We want the patient's hips to sit at world Y ~ 0.72, Z ~ -0.22.
  // In the model, Hips is ~0.95m above model origin.
  // So model origin Y should be 0.72 - 0.95 = -0.23!
  // And Z: Hips should be at Z ~ -0.22.
  pModel.position.set(0.08, -0.22, -0.22);

  // Reset bone rotations
  for (const b of Object.values(bones)) {
    b.rotation.set(0, 0, 0);
  }

  // Spine: Recline back along backrest (-Z direction and slightly up)
  // Backrest rises from Z = -0.22 (seat) to Z = -0.81 (top of backrest), Y rises from 0.72 to 0.85
  // That angle is atan2(0.85 - 0.72, -0.81 - (-0.22)) = atan2(0.13, -0.59) = ~167 deg (or recline of ~40 deg from vertical)
  if (bones.Spine) bones.Spine.rotation.set(-0.35, 0, 0);
  if (bones.Spine1) bones.Spine1.rotation.set(-0.25, 0, 0);
  if (bones.Spine2) bones.Spine2.rotation.set(-0.15, 0, 0);
  if (bones.Neck) bones.Neck.rotation.set(0.20, 0, 0);
  if (bones.Head) bones.Head.rotation.set(0.15, 0, 0);

  // Legs: Extend forward along seat cushion and legrest (+Z direction)
  // Thighs: flex forward from hip (rotateX ~ +80 deg = 1.40 rad)
  if (bones.LeftUpLeg) bones.LeftUpLeg.rotation.set(1.42, 0, -0.06);
  if (bones.RightUpLeg) bones.RightUpLeg.rotation.set(1.42, 0, 0.06);
  // Knees: slight flexion (rotateX ~ -0.15 rad) so calves slope gently down along legrest
  if (bones.LeftLeg) bones.LeftLeg.rotation.set(-0.18, 0, 0);
  if (bones.RightLeg) bones.RightLeg.rotation.set(-0.18, 0, 0);
  // Feet: relaxed plantar flexion resting on cushion
  if (bones.LeftFoot) bones.LeftFoot.rotation.set(0.25, 0, 0);
  if (bones.RightFoot) bones.RightFoot.rotation.set(0.25, 0, 0);

  // Arms: resting comfortably on chair armrests / sides
  if (bones.LeftArm) bones.LeftArm.rotation.set(0.25, 0, -0.35);
  if (bones.LeftForeArm) bones.LeftForeArm.rotation.set(0.20, 0.20, 0.15);
  if (bones.RightArm) bones.RightArm.rotation.set(0.25, 0, 0.35);
  if (bones.RightForeArm) bones.RightForeArm.rotation.set(0.20, -0.20, -0.15);

  // Measure key bone positions after update
  pModel.updateMatrixWorld(true);
  const out = {};
  ['Hips', 'Spine', 'Spine2', 'Head', 'LeftUpLeg', 'LeftLeg', 'LeftFoot'].forEach(k => {
    if (bones[k]) {
      const v = new THREE.Vector3();
      bones[k].getWorldPosition(v);
      out[k] = { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) };
    }
  });

  return out;
});

console.log('New Bone Positions:', JSON.stringify(results, null, 2));

// Capture side view to see full seating contour
await shot(page, 'calibrated_side_view', [-1.6, 0.85, -0.1], [0.08, 0.72, -0.1], { fov: 50 });
// Capture clinician view looking down at patient
await shot(page, 'calibrated_clinician_pov', [0.45, 1.45, -0.15], [0.08, 0.95, -0.65], { fov: 60 });
// Capture legs closeup
await shot(page, 'calibrated_legs', [0.85, 1.0, 0.25], [0.12, 0.65, 0.1], { fov: 48 });

await browser.close();
console.log('done calibration shots');
