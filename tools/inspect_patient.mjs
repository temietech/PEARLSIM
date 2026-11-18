import { open, sleep } from './h.mjs';

const { browser, page } = await open({ enter: true });

const info = await page.evaluate(async () => {
  const P = window.__pearlsim;
  const THREE = await import('three');

  // Find chair cushions in world space
  const chairParts = {};
  P.world.patient.chairGroup.traverse(c => {
    if (['Object_18', 'Object_20', 'Object_29'].includes(c.name)) {
      const box = new THREE.Box3().setFromObject(c);
      chairParts[c.name] = {
        min: box.min.toArray().map(v => v.toFixed(3)),
        max: box.max.toArray().map(v => v.toFixed(3)),
        center: box.getCenter(new THREE.Vector3()).toArray().map(v => v.toFixed(3))
      };
    }
  });

  // Find patient bones and meshes
  const bones = {};
  const meshes = [];
  P.world.patient.root.traverse(c => {
    if (c.isBone) {
      const wp = new THREE.Vector3();
      c.getWorldPosition(wp);
      bones[c.name] = {
        localPos: c.position.toArray().map(v => v.toFixed(3)),
        worldPos: wp.toArray().map(v => v.toFixed(3)),
        rot: [c.rotation.x.toFixed(3), c.rotation.y.toFixed(3), c.rotation.z.toFixed(3)]
      };
    }
    if (c.isMesh) {
      meshes.push({
        name: c.name,
        visible: c.visible,
        parent: c.parent?.name
      });
    }
  });

  return { chairParts, bones, meshes };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
