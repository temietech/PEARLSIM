import { open, shot } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.waitForFunction(() => {
  const P = window.__pearlsim;
  return P?.world?.patient?.chairGroup?.children?.length > 0;
}, { timeout: 25000 });

// Find what makes up the blue tray
const trayParts = await page.evaluate(async () => {
  const P = window.__pearlsim;
  const chair = P.world.patient.chairGroup.children[0];

  const list = [];
  chair.traverse(c => {
    if (c.isMesh) {
      list.push({ name: c.name, mat: c.material?.name, parent: c.parent?.name });
    }
  });

  // Let's test hiding parts of the delivery unit:
  // If we hide 3DSMeshMatrix_6 or specific objects
  return list;
});

console.log('Chair objects:', trayParts);
await browser.close();
