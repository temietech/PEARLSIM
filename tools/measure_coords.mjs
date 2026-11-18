import { open } from './h.mjs';

const { browser, page } = await open({ enter: true });

const coords = await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;

  // Chair cushion bounds
  const getBounds = (obj) => {
    const box = new THREE.Box3().setFromObject(obj);
    return {
      min: { x: +box.min.x.toFixed(3), y: +box.min.y.toFixed(3), z: +box.min.z.toFixed(3) },
      max: { x: +box.max.x.toFixed(3), y: +box.max.y.toFixed(3), z: +box.max.z.toFixed(3) },
      center: { x: +((box.min.x + box.max.x)/2).toFixed(3), y: +((box.min.y + box.max.y)/2).toFixed(3), z: +((box.min.z + box.max.z)/2).toFixed(3) }
    };
  };

  const chair = {};
  P.world.patient.chairGroup.traverse(c => {
    if (['Object_15', 'Object_36', 'Object_54'].includes(c.name)) {
      chair[c.name] = getBounds(c);
    }
  });

  // Bones world positions
  const bones = {};
  P.world.patient.root.traverse(c => {
    if (c.isBone) {
      const v = new THREE.Vector3();
      c.getWorldPosition(v);
      bones[c.name] = { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) };
    }
  });

  return { chair, bones };
});

console.log('=== CHAIR CUSHIONS ===');
console.log(JSON.stringify(coords.chair, null, 2));

console.log('=== KEY BONES ===');
const key = ['Hips', 'Spine', 'Spine2', 'Head', 'LeftUpLeg', 'LeftLeg', 'LeftFoot'];
const keyBones = {};
key.forEach(k => keyBones[k] = coords.bones[k]);
console.log(JSON.stringify(keyBones, null, 2));

await browser.close();
