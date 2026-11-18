import { open, shot } from './tools/h.mjs';

const { browser, page } = await open();

await page.evaluate(async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const P = window.__pearlsim;

  // Load assistant.glb
  const gltf = await new Promise((res, rej) => loader.load('./public/models/assistant.glb', res, undefined, rej));
  const m = gltf.scene;
  m.position.set(0, 0, 0);
  m.scale.setScalar(1.0);
  P.scene.add(m);

  // Hide everything else
  P.world.room.visible = false;
  P.world.assistant.visible = false;
  P.world.patient.root.visible = false;
  P.scene.background = new THREE.Color(0x777777);

  // Frame assistant.glb
  const box = new THREE.Box3().setFromObject(m);
  const center = new THREE.Vector3(); box.getCenter(center);
  const size = new THREE.Vector3(); box.getSize(size);
  console.log('assistant.glb center', center, 'size', size);

  P.camera.position.set(center.x, center.y + 0.1, center.z + size.y * 1.2);
  P.camera.lookAt(center.x, center.y, center.z);
});

await shot(page, 'assistant_glb_preview', [0, 1.4, 1.8], [0, 1.3, 0], { fov: 45 });
await browser.close();
