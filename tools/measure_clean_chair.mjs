import { open } from './h.mjs';

const { browser, page } = await open({ enter: false });

const box = await page.evaluate(async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();

  const gltf = await new Promise(r => loader.load('./public/models/dental_chair.glb', r));
  const chair = gltf.scene;
  chair.scale.setScalar(0.01);

  const keep = [
    'Object_65', 'Object_66', 'Object_61', 'Object_62',
    'Object_57', 'Object_58', 'Object_47', 'Object_48', 'Object_51',
    'Object_43', 'Object_44', 'Object_39', 'Object_40',
    'Object_15', 'Object_36', 'Object_54',
  ];
  chair.traverse(c => {
    if (c.isMesh && !keep.includes(c.name)) c.visible = false;
  });

  // Test rotation.y = Math.PI / 2
  chair.rotation.y = Math.PI / 2;
  chair.updateMatrixWorld(true);

  const getB = (obj) => {
    const b = new THREE.Box3().setFromObject(obj);
    return {
      center: b.getCenter(new THREE.Vector3()).toArray().map(v=>+v.toFixed(3)),
      size: b.getSize(new THREE.Vector3()).toArray().map(v=>+v.toFixed(3)),
      min: b.min.toArray().map(v=>+v.toFixed(3)),
      max: b.max.toArray().map(v=>+v.toFixed(3))
    };
  };

  return {
    total: getB(chair),
    headrest: getB(chair.getObjectByName('Object_15')),
    backrest: getB(chair.getObjectByName('Object_36')),
    seat: getB(chair.getObjectByName('Object_54')),
    base: getB(chair.getObjectByName('Object_65'))
  };
});

console.log(JSON.stringify(box, null, 2));
await browser.close();
