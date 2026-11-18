import { open } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.waitForFunction(() => {
  const P = window.__pearlsim;
  return P?.world?.patient?.chairGroup?.children?.length > 0 &&
         P?.world?.patient?.root?.getObjectByName('Wolf3D_Head');
}, { timeout: 25000 });

// Test different chair positions and rotations relative to patient
const data = await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;

  const chair = P.world.patient.chairGroup.children[0];
  const pAvatarGroup = P.world.patient.root.getObjectByName('PatientAvatar');
  const pModel = pAvatarGroup.children[0];

  // Try chair.rotation.y = Math.PI / 2
  chair.rotation.y = Math.PI / 2;

  // Patient bones
  const bones = {};
  pModel.traverse(c => { if (c.isBone) bones[c.name] = c; });

  const getBones = () => {
    pModel.updateMatrixWorld(true);
    const pos = (b) => {
      const v = new THREE.Vector3();
      b.getWorldPosition(v);
      return v.toArray().map(x => +x.toFixed(3));
    };
    return {
      hips: pos(bones.Hips),
      spine: pos(bones.Spine),
      head: pos(bones.Head),
      leftFoot: pos(bones.LeftFoot),
      leftHand: pos(bones.LeftHand)
    };
  };

  const getCushions = () => {
    chair.updateMatrixWorld(true);
    const box = (name) => {
      const obj = chair.getObjectByName(name);
      if (!obj) return null;
      const b = new THREE.Box3().setFromObject(obj);
      return {
        center: b.getCenter(new THREE.Vector3()).toArray().map(x => +x.toFixed(3)),
        size: b.getSize(new THREE.Vector3()).toArray().map(x => +x.toFixed(3)),
        min: b.min.toArray().map(x => +x.toFixed(3)),
        max: b.max.toArray().map(x => +x.toFixed(3))
      };
    };
    return {
      headrest: box('Object_18'),
      backrest: box('Object_20'),
      seat: box('Object_29')
    };
  };

  return {
    patientBones: getBones(),
    chairCushions: getCushions(),
    chairPos: chair.position.toArray().map(x => +x.toFixed(3)),
    patientPos: pModel.position.toArray().map(x => +x.toFixed(3))
  };
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
