import { open, shot } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.evaluate(async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();

  const P = window.__pearlsim;
  // Clear everything from scene except camera
  const toRemove = P.scene.children.filter(c => c !== P.camera);
  for (const c of toRemove) P.scene.remove(c);

  P.scene.background = new THREE.Color(0xdbeafe);

  // Add lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x64748b, 1.8);
  P.scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 2.2);
  dir.position.set(4, 6, 3);
  P.scene.add(dir);

  // Load raw chair
  const gltf = await new Promise(r => loader.load('./public/models/dental_chair.glb', r));
  const chair = gltf.scene;

  // Let's compute overall bounding box
  const bb = new THREE.Box3().setFromObject(chair);
  const center = bb.getCenter(new THREE.Vector3());
  const size = bb.getSize(new THREE.Vector3());

  // Center the chair at origin
  chair.position.sub(center);
  const scale = 2.0 / Math.max(size.x, size.y, size.z);
  chair.scale.setScalar(scale);

  P.scene.add(chair);
});

await shot(page, 'raw_chair_front', [0, 0.5, 3.2], [0, 0, 0], { fov: 45 });
await shot(page, 'raw_chair_side_right', [3.2, 0.5, 0], [0, 0, 0], { fov: 45 });
await shot(page, 'raw_chair_side_left', [-3.2, 0.5, 0], [0, 0, 0], { fov: 45 });
await shot(page, 'raw_chair_top', [0, 3.8, 0.01], [0, 0, 0], { fov: 45 });

await browser.close();
