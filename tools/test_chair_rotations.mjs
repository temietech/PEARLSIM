import { open, shot, sleep } from './h.mjs';

const { browser, page } = await open({ enter: true });

// Wait for chair model to be loaded
await page.waitForFunction(() => {
  const P = window.__pearlsim;
  return P?.world?.patient?.chairGroup?.children?.length > 0;
}, { timeout: 20000 });

// Let's test chair rotations: 0, Math.PI/2, Math.PI, -Math.PI/2
for (const [name, rot] of [['rot_0', 0], ['rot_pos90', Math.PI / 2], ['rot_180', Math.PI], ['rot_neg90', -Math.PI / 2]]) {
  await page.evaluate((r) => {
    const P = window.__pearlsim;
    const chair = P.world.patient.chairGroup.children[0];
    if (chair) {
      chair.rotation.y = r;
    }
  }, rot);
  await sleep(200);
  // Overhead isometric view
  await shot(page, `test_chair_${name}`, [0, 3.2, 0.4], [0, 0.6, -0.6], { fov: 60 });
}

await browser.close();
