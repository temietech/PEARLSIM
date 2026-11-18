import { open, shot } from './h.mjs';

const { browser, page } = await open({ enter: true });

const tests = [
  { name: 'optA', upLeg: 1.55, leg: -0.35, foot: 0.10, posY: -0.32, posZ: -0.36 },
  { name: 'optB', upLeg: 1.70, leg: -0.45, foot: 0.15, posY: -0.32, posZ: -0.36 },
  { name: 'optC', upLeg: 1.70, leg: -0.15, foot: 0.05, posY: -0.32, posZ: -0.36 },
  { name: 'optD', upLeg: 1.85, leg: -0.30, foot: 0.10, posY: -0.32, posZ: -0.36 },
];

for (const opt of tests) {
  await page.evaluate((opt) => {
    const P = window.__pearlsim;
    const pModel = P.world.patient.root.getObjectByName('PatientAvatar').children[0];
    const bones = {};
    pModel.traverse(c => { if (c.isBone) bones[c.name] = c; });

    pModel.position.set(0.08, opt.posY, opt.posZ);

    if (bones.Spine) bones.Spine.rotation.set(0.48, 0, 0);
    if (bones.Spine1) bones.Spine1.rotation.set(0.32, 0, 0);
    if (bones.Spine2) bones.Spine2.rotation.set(0.18, 0, 0);
    if (bones.Neck) bones.Neck.rotation.set(-0.15, 0, 0);
    if (bones.Head) bones.Head.rotation.set(-0.10, 0, 0);

    if (bones.LeftUpLeg) bones.LeftUpLeg.rotation.set(opt.upLeg, 0, -0.06);
    if (bones.RightUpLeg) bones.RightUpLeg.rotation.set(opt.upLeg, 0, 0.06);
    if (bones.LeftLeg) bones.LeftLeg.rotation.set(opt.leg, 0, 0);
    if (bones.RightLeg) bones.RightLeg.rotation.set(opt.leg, 0, 0);
    if (bones.LeftFoot) bones.LeftFoot.rotation.set(opt.foot, 0, 0);
    if (bones.RightFoot) bones.RightFoot.rotation.set(opt.foot, 0, 0);

    pModel.updateMatrixWorld(true);
  }, opt);

  await shot(page, `side_${opt.name}`, [-1.6, 0.85, -0.1], [0.08, 0.72, -0.1], { fov: 50 });
}

await browser.close();
console.log('all options shot');
