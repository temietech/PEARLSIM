import { open } from './h.mjs';

const { browser, page } = await open({ enter: false });

const morphs = await page.evaluate(async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();

  const pGltf = await new Promise(r => loader.load('./public/models/patient.glb', r));
  const pMorphs = {};
  pGltf.scene.traverse(c => {
    if (c.isMesh && c.morphTargetDictionary) {
      pMorphs[c.name] = Object.keys(c.morphTargetDictionary);
    }
  });

  const aGltf = await new Promise(r => loader.load('./public/models/assistant_female.glb', r));
  const aMorphs = {};
  const aMaterials = {};
  aGltf.scene.traverse(c => {
    if (c.isMesh) {
      if (c.morphTargetDictionary) aMorphs[c.name] = Object.keys(c.morphTargetDictionary);
      if (c.material) {
        aMaterials[c.name] = {
          name: c.material.name,
          color: c.material.color?.getHexString(),
          map: !!c.material.map
        };
      }
    }
  });

  return { pMorphs, aMorphs, aMaterials };
});

console.log(JSON.stringify(morphs, null, 2));
await browser.close();
