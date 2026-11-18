import { open } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.waitForFunction(() => {
  const P = window.__pearlsim;
  return P?.world?.patient?.chairGroup?.children?.length > 0;
}, { timeout: 20000 });

const chairDetails = await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;
  const chair = P.world.patient.chairGroup.children[0];

  const meshes = [];
  chair.traverse((c) => {
    if (c.isMesh) {
      const box = new THREE.Box3().setFromObject(c);
      meshes.push({
        name: c.name,
        visible: c.visible,
        mat: c.material?.name || (Array.isArray(c.material) ? c.material.map(m=>m.name) : ''),
        col: c.material?.color ? '#' + c.material.color.getHexString() : '',
        box: {
          min: box.min.toArray().map(v => v.toFixed(2)),
          max: box.max.toArray().map(v => v.toFixed(2)),
          center: box.getCenter(new THREE.Vector3()).toArray().map(v => v.toFixed(2)),
          size: box.getSize(new THREE.Vector3()).toArray().map(v => v.toFixed(2))
        }
      });
    }
  });

  // Also check patient avatar
  const pMeshes = [];
  P.world.patient.root.traverse((c) => {
    if (c.isMesh && c.visible) {
      const box = new THREE.Box3().setFromObject(c);
      pMeshes.push({
        name: c.name,
        parent: c.parent?.name,
        box: {
          min: box.min.toArray().map(v => v.toFixed(2)),
          max: box.max.toArray().map(v => v.toFixed(2)),
          center: box.getCenter(new THREE.Vector3()).toArray().map(v => v.toFixed(2)),
          size: box.getSize(new THREE.Vector3()).toArray().map(v => v.toFixed(2))
        }
      });
    }
  });

  return { meshes, pMeshes };
});

console.log('CHAIR MESHES:');
for (const m of chairDetails.meshes) {
  console.log(`${m.name.padEnd(12)} col:${m.col.padEnd(8)} mat:${m.mat.padEnd(20)} size:[${m.box.size}] center:[${m.box.center}]`);
}

console.log('\nPATIENT MESHES:');
for (const m of chairDetails.pMeshes) {
  console.log(`${m.name.padEnd(22)} parent:${(m.parent||'').padEnd(12)} size:[${m.box.size}] center:[${m.box.center}]`);
}

await browser.close();
