import { open } from './h.mjs';

const { browser, page } = await open({ enter: false });

const rots = await page.evaluate(async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();

  const gltf = await new Promise(r => loader.load('./public/models/dental_chair.glb', r));
  const chair = gltf.scene;
  chair.scale.setScalar(0.01);

  const out = {};
  for (const [label, r] of [['rot_0', 0], ['rot_pos90', Math.PI/2], ['rot_180', Math.PI], ['rot_neg90', -Math.PI/2]]) {
    chair.rotation.y = r;
    chair.updateMatrixWorld(true);
    const h = new THREE.Box3().setFromObject(chair.getObjectByName('Object_15')).getCenter(new THREE.Vector3());
    const s = new THREE.Box3().setFromObject(chair.getObjectByName('Object_54')).getCenter(new THREE.Vector3());
    out[label] = {
      head: [h.x.toFixed(3), h.y.toFixed(3), h.z.toFixed(3)],
      seat: [s.x.toFixed(3), s.y.toFixed(3), s.z.toFixed(3)],
      delta_head_to_seat: [(s.x - h.x).toFixed(3), (s.y - h.y).toFixed(3), (s.z - h.z).toFixed(3)]
    };
  }
  return out;
});

console.log(JSON.stringify(rots, null, 2));
await browser.close();
