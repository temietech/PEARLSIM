import { open, shot } from './h.mjs';

const { browser, page } = await open({ enter: true });

const heights = [-0.19, -0.16, -0.13];

for (const y of heights) {
  await page.evaluate((posY) => {
    const P = window.__pearlsim;
    const pModel = P.world.patient.root.getObjectByName('PatientAvatar').children[0];
    const bones = {};
    pModel.traverse(c => { if (c.isBone) bones[c.name] = c; });

    pModel.position.set(0.08, posY, -0.36);

    // Recline backrest contact
    if (bones.Spine) bones.Spine.rotation.set(0.48, 0, 0);
    if (bones.Spine1) bones.Spine1.rotation.set(0.32, 0, 0);
    if (bones.Spine2) bones.Spine2.rotation.set(0.18, 0, 0);
    if (bones.Neck) bones.Neck.rotation.set(-0.15, 0, 0);
    if (bones.Head) bones.Head.rotation.set(-0.10, 0, 0);

    // Legs: rest flush on top of cushion
    if (bones.LeftUpLeg) bones.LeftUpLeg.rotation.set(1.82, 0, -0.06);
    if (bones.RightUpLeg) bones.RightUpLeg.rotation.set(1.82, 0, 0.06);
    if (bones.LeftLeg) bones.LeftLeg.rotation.set(-0.28, 0, 0);
    if (bones.RightLeg) bones.RightLeg.rotation.set(-0.28, 0, 0);
    if (bones.LeftFoot) bones.LeftFoot.rotation.set(0.12, 0, 0);
    if (bones.RightFoot) bones.RightFoot.rotation.set(0.12, 0, 0);

    // Arms: relaxed on lap/armrests
    if (bones.LeftArm) bones.LeftArm.rotation.set(0.40, 0.1, -0.22);
    if (bones.LeftForeArm) bones.LeftForeArm.rotation.set(0.65, 0.35, 0.45);
    if (bones.RightArm) bones.RightArm.rotation.set(0.40, -0.1, 0.22);
    if (bones.RightForeArm) bones.RightForeArm.rotation.set(0.65, -0.35, -0.45);

    pModel.updateMatrixWorld(true);
  }, y);

  await shot(page, `height_${y}`, [-1.6, 0.85, -0.1], [0.08, 0.72, -0.1], { fov: 50 });
  await shot(page, `height_legs_${y}`, [0.85, 1.0, 0.25], [0.12, 0.65, 0.1], { fov: 48 });
}

await browser.close();
console.log('height tests done');
