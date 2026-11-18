import { open, shot } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.waitForFunction(() => {
  const P = window.__pearlsim;
  return P?.world?.patient?.chairGroup?.children?.length > 0 &&
         P?.world?.patient?.root?.getObjectByName('Wolf3D_Head');
}, { timeout: 25000 });

// Capture direct side view of the chair and patient's legs
// From the patient's left side and right side
await shot(page, 'check_legs_left_side', [-1.8, 0.75, -0.4], [0.08, 0.65, -0.4], { fov: 45 });
await shot(page, 'check_legs_right_side', [1.8, 0.75, -0.4], [0.08, 0.65, -0.4], { fov: 45 });
await shot(page, 'check_legs_quarter_angle', [1.2, 1.1, 0.4], [0.08, 0.65, -0.3], { fov: 50 });

// Also query world Y of patient's thighs, knees, feet vs chair cushion Y along the Z axis
const profile = await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;

  const bones = {};
  P.world.patient.root.traverse(c => { if (c.isBone) bones[c.name] = c; });

  const getPos = (b) => {
    const v = new THREE.Vector3();
    b.getWorldPosition(v);
    return [v.x.toFixed(3), v.y.toFixed(3), v.z.toFixed(3)];
  };

  const seatMesh = P.world.patient.chairGroup.getObjectByName('Object_54');
  seatMesh.geometry.computeBoundingBox();
  const seatBox = new THREE.Box3().setFromObject(seatMesh);

  return {
    hips: getPos(bones.Hips),
    leftUpLeg: getPos(bones.LeftUpLeg),
    leftLeg: getPos(bones.LeftLeg),
    leftFoot: getPos(bones.LeftFoot),
    rightUpLeg: getPos(bones.RightUpLeg),
    rightLeg: getPos(bones.RightLeg),
    rightFoot: getPos(bones.RightFoot),
    seatMin: seatBox.min.toArray().map(v=>v.toFixed(3)),
    seatMax: seatBox.max.toArray().map(v=>v.toFixed(3)),
    seatCenter: seatBox.getCenter(new THREE.Vector3()).toArray().map(v=>v.toFixed(3))
  };
});

console.log('Profile:', JSON.stringify(profile, null, 2));
await browser.close();
