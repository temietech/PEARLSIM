import { open, shot } from './h.mjs';

const { browser, page } = await open({ enter: true });

const meshes = await page.evaluate(async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const P = window.__pearlsim;

  const gltf = await new Promise((res, rej) => loader.load('./public/models/dental_chair.glb', res, undefined, rej));
  const m = gltf.scene;

  const list = [];
  m.traverse((c) => {
    if (c.isMesh) {
      c.geometry.computeBoundingBox();
      const bb = c.geometry.boundingBox;
      list.push({
        name: c.name,
        mat: c.material ? (Array.isArray(c.material) ? c.material.map(x=>x.name) : c.material.name) : 'none',
        size: [+(bb.max.x - bb.min.x).toFixed(1), +(bb.max.y - bb.min.y).toFixed(1), +(bb.max.z - bb.min.z).toFixed(1)],
        center: [+(0.5*(bb.max.x + bb.min.x)).toFixed(1), +(0.5*(bb.max.y + bb.min.y)).toFixed(1), +(0.5*(bb.max.z + bb.min.z)).toFixed(1)]
      });
    }
  });
  return list;
});

console.log(JSON.stringify(meshes, null, 2));
await browser.close();
