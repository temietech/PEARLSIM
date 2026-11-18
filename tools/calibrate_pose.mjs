import { open, shot, sleep } from './h.mjs';

const { browser, page } = await open({ enter: true });

const posedInfo = await page.evaluate(() => {
  const P = window.__pearlsim;
  const bones = {}, nBones = {};
  let pModel = null;
  P.world.patient.root.traverse(o => {
    if (o.name === 'PatientAvatar' && o.children[0]) pModel = o.children[0];
    if (o.isBone) bones[o.name] = o;
  });
  P.world.assistant.traverse(o => { if (o.isBone) nBones[o.name] = o; });

  pModel.rotation.set(-1.12, 0, 0);
  pModel.position.set(0.08, 0.37, 0.56);

  if (bones.Spine) bones.Spine.rotation.set(-0.08, 0, 0);
  if (bones.Spine1) bones.Spine1.rotation.set(-0.06, 0, 0);
  if (bones.Spine2) bones.Spine2.rotation.set(-0.04, 0, 0);
  if (bones.Neck) bones.Neck.rotation.set(0.22, 0, 0);
  if (bones.Head) bones.Head.rotation.set(0.20, 0, 0);

  // 1.78 + 1.12 = 2.90 rad keeps thighs resting along the upward slope of the seat cushion!
  if (bones.LeftUpLeg) bones.LeftUpLeg.rotation.set(2.88, 0, -0.05);
  if (bones.RightUpLeg) bones.RightUpLeg.rotation.set(2.88, 0, 0.05);
  if (bones.LeftLeg) bones.LeftLeg.rotation.set(-0.26, 0, 0);
  if (bones.RightLeg) bones.RightLeg.rotation.set(-0.26, 0, 0);
  if (bones.LeftFoot) bones.LeftFoot.rotation.set(0.12, 0, 0);
  if (bones.RightFoot) bones.RightFoot.rotation.set(0.12, 0, 0);

  // Arms resting along sides, hands on lap/abdomen
  if (bones.LeftArm) bones.LeftArm.rotation.set(1.12, 0.15, -0.10);
  if (bones.LeftForeArm) bones.LeftForeArm.rotation.set(0.75, 0, 0.45);
  if (bones.RightArm) bones.RightArm.rotation.set(1.12, -0.15, 0.10);
  if (bones.RightForeArm) bones.RightForeArm.rotation.set(0.75, 0, -0.45);

  // Nurse arms
  if (nBones.LeftArm) nBones.LeftArm.rotation.set(1.15, 0, -0.15);
  if (nBones.LeftForeArm) nBones.LeftForeArm.rotation.set(0.40, 0, 0.25);
  if (nBones.RightArm) nBones.RightArm.rotation.set(1.15, 0, 0.15);
  if (nBones.RightForeArm) nBones.RightForeArm.rotation.set(0.40, 0, -0.25);

  P.scene.updateMatrixWorld(true);
  const pos = {};
  for (const b of ['Hips','Spine','Spine2','Head','LeftHand','RightHand','LeftUpLeg','LeftLeg','LeftFoot']) {
    if (bones[b]) {
      const v = bones[b].getWorldPosition(P.camera.position.clone());
      pos[b] = [v.x, v.y, v.z].map(n => +n.toFixed(3));
    }
  }
  return pos;
});
console.log('Posed world positions:', JSON.stringify(posedInfo, null, 2));

await shot(page, 'cal3_side', [-1.8, 0.95, -0.2], [0.08, 0.80, -0.2], { fov: 50 });
await shot(page, 'cal3_front', [0.08, 1.35, 1.3], [0.08, 0.80, -0.3], { fov: 50 });
await shot(page, 'cal3_pov', [-0.48, 1.38, -0.22], [0.08, 0.92, -0.72], { fov: 60 });
await browser.close();
