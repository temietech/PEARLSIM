import { open, sleep } from './h.mjs';

console.log('Launching browser...');
const { browser, page } = await open({ enter: true });
console.log('Browser opened and entered operatory.');

const info = await page.evaluate(() => {
  const P = window.__pearlsim;
  
  // Nurse meshes
  const nurseMeshes = [];
  P.world.assistant.traverse(c => {
    nurseMeshes.push({ name: c.name, type: c.type, isMesh: !!c.isMesh, visible: c.visible });
  });

  // Patient bones
  const pBones = {};
  P.world.patient.root.traverse(c => {
    if (c.isBone) {
      pBones[c.name] = {
        pos: [c.position.x, c.position.y, c.position.z],
        rot: [c.rotation.x, c.rotation.y, c.rotation.z]
      };
    }
  });

  // Chair meshes
  const chairMeshes = [];
  P.world.patient.chairGroup.traverse(c => {
    if (c.isMesh) {
      chairMeshes.push({ name: c.name, visible: c.visible });
    }
  });

  return { nurseMeshes, pBones, chairMeshes };
});

console.log('=== NURSE MESHES ===');
console.log(info.nurseMeshes.filter(m => m.isMesh));

console.log('=== CHAIR MESHES ===');
console.log(info.chairMeshes);

console.log('=== PATIENT BONES ===');
console.log(Object.keys(info.pBones));

await browser.close();
