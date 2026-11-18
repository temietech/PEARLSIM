import { open, shot } from './h.mjs';

const { browser, page } = await open({ enter: true });

await page.waitForFunction(() => {
  const P = window.__pearlsim;
  return P?.world?.patient?.chairGroup?.children?.length > 0;
}, { timeout: 25000 });

await page.evaluate(async () => {
  const THREE = await import('three');
  const P = window.__pearlsim;
  const chair = P.world.patient.chairGroup.children[0];

  // Align chair
  chair.rotation.y = Math.PI / 2;
  chair.position.set(0.50, 0.04, -0.15);

  // Let's color-code chair meshes:
  // cushions vs tray vs base
  chair.traverse(c => {
    if (c.isMesh && c.material) {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
      if (['Object_18', 'Object_20'].includes(c.name)) {
        mat.color.setHex(0xff0000); // RED = headrest / backrest
      } else if (c.name === 'Object_29') {
        mat.color.setHex(0x00ff00); // GREEN = Object_29
      } else if (c.name === 'Object_26') {
        mat.color.setHex(0x0000ff); // BLUE = Object_26
      } else if (c.name === 'Object_27') {
        mat.color.setHex(0xffff00); // YELLOW = Object_27
      } else if (c.name === 'Object_30') {
        mat.color.setHex(0xff00ff); // MAGENTA = Object_30
      } else if (c.name === 'Object_33') {
        mat.color.setHex(0x00ffff); // CYAN = Object_33
      } else {
        mat.color.setHex(0x888888); // GREY = base & rest
      }
      c.material = mat;
    }
  });
});

await shot(page, 'chair_color_coded', [1.2, 1.4, -0.4], [0.1, 1.0, -0.7], { fov: 55 });
await browser.close();
