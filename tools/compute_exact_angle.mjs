import { open } from './h.mjs';

const { browser, page } = await open({ enter: false });

const testAngle = await page.evaluate(async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();

  const gltf = await new Promise(r => loader.load('./public/models/dental_chair.glb', r));
  const chair = gltf.scene;
  chair.scale.setScalar(0.01);

  // Compute exact angle from headrest to seat
  chair.rotation.y = 0;
  chair.updateMatrixWorld(true);
  const h0 = new THREE.Box3().setFromObject(chair.getObjectByName('Object_15')).getCenter(new THREE.Vector3());
  const s0 = new THREE.Box3().setFromObject(chair.getObjectByName('Object_54')).getCenter(new THREE.Vector3());

  // Vector from head to seat in X-Z
  const vx = s0.x - h0.x;
  const vz = s0.z - h0.z;
  // Desired direction is along +Z (vx = 0, vz > 0)
  const currentAngle = Math.atan2(vx, vz); // Angle from +Z towards +X
  const requiredRot = -currentAngle;

  chair.rotation.y = requiredRot;
  chair.updateMatrixWorld(true);
  const h1 = new THREE.Box3().setFromObject(chair.getObjectByName('Object_15')).getCenter(new THREE.Vector3());
  const s1 = new THREE.Box3().setFromObject(chair.getObjectByName('Object_54')).getCenter(new THREE.Vector3());

  return {
    currentAngleDeg: (currentAngle * 180 / Math.PI).toFixed(2),
    requiredRotDeg: (requiredRot * 180 / Math.PI).toFixed(2),
    requiredRotRad: requiredRot,
    headAfter: [h1.x.toFixed(3), h1.y.toFixed(3), h1.z.toFixed(3)],
    seatAfter: [s1.x.toFixed(3), s1.y.toFixed(3), s1.z.toFixed(3)],
    deltaAfter: [(s1.x - h1.x).toFixed(3), (s1.y - h1.y).toFixed(3), (s1.z - h1.z).toFixed(3)]
  };
});

console.log(JSON.stringify(testAngle, null, 2));
await browser.close();
