import { open } from './h.mjs';

const { browser, page } = await open({ enter: true });

const info = await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;

  // Measure cushions in world space
  const chairMeshes = {};
  P.world.patient.chairGroup.traverse(c => {
    if (c.isMesh && c.visible) {
      const box = new THREE.Box3().setFromObject(c);
      chairMeshes[c.name] = {
        min: [box.min.x.toFixed(3), box.min.y.toFixed(3), box.min.z.toFixed(3)],
        max: [box.max.x.toFixed(3), box.max.y.toFixed(3), box.max.z.toFixed(3)],
        center: [((box.min.x + box.max.x)/2).toFixed(3), ((box.min.y + box.max.y)/2).toFixed(3), ((box.min.z + box.max.z)/2).toFixed(3)]
      };
    }
  });

  // Assistant meshes
  const nurseMeshes = [];
  P.world.assistant.traverse(c => {
    if (c.isMesh) {
      nurseMeshes.push({ name: c.name, visible: c.visible });
    }
  });

  // Patient bones
  const patientBones = {};
  P.world.patient.root.traverse(c => {
    if (c.isBone) {
      const wp = new THREE.Vector3();
      c.getWorldPosition(wp);
      patientBones[c.name] = [wp.x.toFixed(3), wp.y.toFixed(3), wp.z.toFixed(3)];
    }
  });

  return { chairMeshes, nurseMeshes, patientBones };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
