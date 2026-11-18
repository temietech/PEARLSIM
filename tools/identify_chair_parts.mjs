import { open } from './h.mjs';

const { browser, page } = await open({ enter: false });

const meshNames = await page.evaluate(async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();

  const gltf = await new Promise(r => loader.load('./public/models/dental_chair.glb', r));
  const chair = gltf.scene;

  // Let's find which meshes are the headrest and floating parts
  const list = [];
  chair.traverse(c => {
    if (c.isMesh) {
      const b = new THREE.Box3().setFromObject(c);
      list.push({
        name: c.name,
        mat: c.material?.name || (Array.isArray(c.material) ? c.material.map(m=>m.name) : ''),
        col: c.material?.color?.getHexString(),
        center: b.getCenter(new THREE.Vector3()).toArray().map(v=>+(v*0.01).toFixed(2)),
        size: b.getSize(new THREE.Vector3()).toArray().map(v=>+(v*0.01).toFixed(2))
      });
    }
  });
  return list;
});

console.log(JSON.stringify(meshNames, null, 2));
await browser.close();
