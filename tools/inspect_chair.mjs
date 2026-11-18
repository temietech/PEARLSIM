import { open, shot, sleep } from './h.mjs';

const { browser, page } = await open();

// Dump chair mesh world boxes.
const info = await page.evaluate(() => {
  const P = window.__pearlsim;
  const THREE_ = P.scene.constructor && null;
  const out = [];
  const chairGroup = P.world.patient.chairGroup;
  chairGroup.updateMatrixWorld(true);
  const Box3 = P.scene.position.constructor; // Vector3 ctor (to avoid import)
  chairGroup.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone();
    // transform 8 corners to world
    const pts = [];
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
      pts.push(new Box3(x, y, z).applyMatrix4(o.matrixWorld));
    }
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const p of pts) { for (const [i, k] of ['x', 'y', 'z'].entries()) { mn[i] = Math.min(mn[i], p[k]); mx[i] = Math.max(mx[i], p[k]); } }
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    out.push({ n: o.name, min: mn.map((v) => +v.toFixed(2)), max: mx.map((v) => +v.toFixed(2)), col: m.color ? m.color.getHexString() : '-', mat: m.name });
  });
  return out;
});
for (const r of info) console.log(JSON.stringify(r));

// Hide everything but the chair and look from several sides.
await page.evaluate(() => {
  const P = window.__pearlsim;
  P.world.room.visible = false;
  P.world.assistant.visible = false;
  P.world.patient.root.traverse((o) => { if (o.name === 'PatientAvatar') o.visible = false; });
  P.scene.background = new P.scene.background.constructor(0x888888);
});
await shot(page, 'chair_side_from_front', [0.12, 1.0, 3.2], [0.12, 0.8, -0.65], { fov: 40 });
await shot(page, 'chair_side_from_back', [0.12, 1.0, -4.5], [0.12, 0.8, -0.65], { fov: 40 });
await shot(page, 'chair_from_left', [-3.5, 1.0, -0.65], [0.12, 0.8, -0.65], { fov: 40 });
await shot(page, 'chair_from_right', [3.8, 1.0, -0.65], [0.12, 0.8, -0.65], { fov: 40 });
await shot(page, 'chair_top', [0.12, 4.0, -0.64], [0.12, 0.8, -0.65], { fov: 40 });
await browser.close();
