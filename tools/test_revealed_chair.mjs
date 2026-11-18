import { open, shot } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.evaluate(async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();

  const P = window.__pearlsim;
  while (P.scene.children.length > 0) P.scene.remove(P.scene.children[0]);
  P.scene.background = new THREE.Color(0xdbeafe);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x64748b, 1.5);
  P.scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 2.2);
  dir.position.set(4, 6, 3);
  P.scene.add(dir);

  const gltf = await new Promise(r => loader.load('./public/models/dental_chair.glb', r));
  const chair = gltf.scene;
  chair.scale.setScalar(0.01);
  chair.position.set(0, 0, 0);

  // Apply real materials:
  // Hide the floating blue tray and delivery hoses
  chair.traverse(c => {
    // Hide tray and hose
    if (['Object_18', 'Object_19', 'Object_20', 'Object_27', 'Object_28'].includes(c.name)) {
      c.visible = false;
    }
    if (c.isMesh && c.material) {
      const origMat = Array.isArray(c.material) ? c.material[0] : c.material;
      const mat = origMat.clone();
      mat.map = null;
      mat.normalMap = null;
      mat.roughnessMap = null;

      // ACTUAL CUSHIONS: Object_54, Object_36, Object_29
      if (['Object_54', 'Object_36', 'Object_29'].includes(c.name)) {
        mat.color.setHex(0x1e3a8a); // Royal Navy Leatherette
        mat.roughness = 0.38;
        mat.metalness = 0.05;
        mat.clearcoat = 0.3;
      } else if (['Object_15'].includes(c.name)) {
        mat.color.setHex(0x0d9488); // Spittoon
        mat.roughness = 0.2;
      } else if (['Object_30', 'Object_65', 'Object_66'].includes(c.name)) {
        mat.color.setHex(0xe2e8f0); // Chrome
        mat.metalness = 0.95;
        mat.roughness = 0.12;
      } else {
        mat.color.setHex(0xf8fafc); // Clean clinical white enamel
        mat.roughness = 0.3;
      }
      c.material = mat;
    }
  });

  P.scene.add(chair);
});

await shot(page, 'test_revealed_chair_front', [0, 1.2, 3.0], [0, 0.8, 0], { fov: 45 });
await shot(page, 'test_revealed_chair_side', [3.2, 1.2, 0], [0, 0.8, 0], { fov: 45 });
await shot(page, 'test_revealed_chair_top', [0, 3.5, 0.01], [0, 0.8, 0], { fov: 45 });

await browser.close();
