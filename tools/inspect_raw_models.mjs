import { open } from './h.mjs';

const { browser, page } = await open({ enter: false });

const data = await page.evaluate(async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();

  const chairGltf = await new Promise(r => loader.load('./public/models/dental_chair.glb', r));
  const chairMeshes = [];
  chairGltf.scene.traverse(c => {
    if (c.isMesh) {
      c.geometry.computeBoundingBox();
      const b = c.geometry.boundingBox;
      chairMeshes.push({
        name: c.name,
        mat: c.material?.name || (Array.isArray(c.material) ? c.material.map(m=>m.name) : ''),
        min: [b.min.x, b.min.y, b.min.z].map(v => +(v*0.01).toFixed(3)),
        max: [b.max.x, b.max.y, b.max.z].map(v => +(v*0.01).toFixed(3)),
        size: [(b.max.x - b.min.x)*0.01, (b.max.y - b.min.y)*0.01, (b.max.z - b.min.z)*0.01].map(v => +v.toFixed(3)),
        center: [0.5*(b.max.x + b.min.x)*0.01, 0.5*(b.max.y + b.min.y)*0.01, 0.5*(b.max.z + b.min.z)*0.01].map(v => +v.toFixed(3))
      });
    }
  });

  const patientGltf = await new Promise(r => loader.load('./public/models/patient.glb', r));
  const patientMeshes = [];
  const patientBones = {};
  patientGltf.scene.traverse(c => {
    if (c.isMesh) {
      c.geometry.computeBoundingBox();
      const b = c.geometry.boundingBox;
      patientMeshes.push({
        name: c.name,
        mat: c.material?.name || '',
        size: [(b.max.x - b.min.x), (b.max.y - b.min.y), (b.max.z - b.min.z)].map(v => +v.toFixed(3)),
        center: [0.5*(b.max.x + b.min.x), 0.5*(b.max.y + b.min.y), 0.5*(b.max.z + b.min.z)].map(v => +v.toFixed(3))
      });
    }
    if (c.isBone) {
      patientBones[c.name] = {
        pos: [c.position.x, c.position.y, c.position.z].map(v => +v.toFixed(3)),
        rot: [c.rotation.x, c.rotation.y, c.rotation.z].map(v => +v.toFixed(3))
      };
    }
  });

  const nurseGltf = await new Promise(r => loader.load('./public/models/assistant_female.glb', r));
  const nurseMeshes = [];
  const nurseBones = {};
  nurseGltf.scene.traverse(c => {
    if (c.isMesh) {
      nurseMeshes.push({
        name: c.name,
        mat: c.material?.name || (Array.isArray(c.material) ? c.material.map(m=>m.name) : ''),
      });
    }
    if (c.isBone) {
      nurseBones[c.name] = {
        pos: [c.position.x, c.position.y, c.position.z].map(v => +v.toFixed(3)),
        rot: [c.rotation.x, c.rotation.y, c.rotation.z].map(v => +v.toFixed(3))
      };
    }
  });

  return { chairMeshes, patientMeshes, patientBones, nurseMeshes, nurseBones };
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
