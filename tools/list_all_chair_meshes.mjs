import { open, shot } from './h.mjs';

const { browser, page } = await open({ enter: false });

await page.evaluate(async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();

  // Hide landing
  const P = window.__pearlsim;
  while (P.scene.children.length > 0) P.scene.remove(P.scene.children[0]);
  P.scene.background = new THREE.Color(0x1e293b);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x475569, 1.5);
  P.scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 2.0);
  dir.position.set(5, 10, 5);
  P.scene.add(dir);

  const gltf = await new Promise(r => loader.load('./public/models/dental_chair.glb', r));
  const chair = gltf.scene;
  chair.scale.setScalar(0.01);
  chair.position.set(0, 0, 0);
  P.scene.add(chair);

  // Group meshes by their visual part
  const parts = [];
  chair.traverse(c => {
    if (c.isMesh) {
      parts.push({
        name: c.name,
        mat: c.material?.name || (Array.isArray(c.material) ? c.material.map(m=>m.name) : ''),
        parent: c.parent?.name
      });
    }
  });
  window.__chairParts = parts;
});

const parts = await page.evaluate(() => window.__chairParts);
console.log(JSON.stringify(parts, null, 2));

await browser.close();
