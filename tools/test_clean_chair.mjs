import { open, shot } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;

  // Clear scene of everything except camera
  const toRemove = P.scene.children.filter(c => c !== P.camera);
  for (const c of toRemove) P.scene.remove(c);
  P.scene.background = new THREE.Color(0xdbeafe);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x64748b, 1.8);
  P.scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 2.2);
  dir.position.set(4, 6, 3);
  P.scene.add(dir);

  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const gltf = await new Promise(r => loader.load('./public/models/dental_chair.glb', r));
  const chair = gltf.scene;
  chair.scale.setScalar(0.01);
  chair.position.set(0, 0, 0);

  chair.traverse(c => {
    // Only keep chair base, mechanism, frames, and cushions
    const keep = [
      'Object_65', 'Object_66', 'Object_61', 'Object_62', // Base & chrome foot plate
      'Object_57', 'Object_58', 'Object_47', 'Object_48', 'Object_51', // Lift column & joint
      'Object_43', 'Object_44', 'Object_39', 'Object_40', // Seat & backrest frames
      'Object_15', 'Object_36', 'Object_54', // Cushions: headrest, backrest, seat
    ];
    if (c.isMesh && !keep.includes(c.name)) {
      c.visible = false;
    }
    if (c.isMesh && c.material) {
      const origMat = Array.isArray(c.material) ? c.material[0] : c.material;
      const mat = origMat.clone();
      mat.map = null;
      mat.normalMap = null;
      mat.roughnessMap = null;

      // The 3 cushions: Headrest (Object_15), Backrest (Object_36), Seat (Object_54)
      if (['Object_15', 'Object_36', 'Object_54'].includes(c.name)) {
        mat.color.setHex(0x1e3a8a); // Royal Navy Leatherette
        mat.roughness = 0.38;
        mat.metalness = 0.05;
        mat.clearcoat = 0.35;
        mat.clearcoatRoughness = 0.2;
      } else if (['Object_30', 'Object_65', 'Object_66'].includes(c.name)) {
        mat.color.setHex(0xe2e8f0); // Polished surgical chrome
        mat.metalness = 0.95;
        mat.roughness = 0.12;
      } else {
        mat.color.setHex(0xf8fafc); // Clean clinical white enamel
        mat.roughness = 0.3;
        mat.metalness = 0.08;
      }
      c.material = mat;
    }
  });

  P.scene.add(chair);
});

await shot(page, 'clean_chair_side', [2.8, 1.0, 0], [0, 0.7, 0], { fov: 45 });
await shot(page, 'clean_chair_isometric', [2.2, 1.8, 1.8], [0, 0.7, 0], { fov: 45 });
await browser.close();
