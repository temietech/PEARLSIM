import { open, shot, sleep } from './h.mjs';

console.log('Testing pure production build on http://localhost:8080...');
const { browser, page } = await open({ enter: true });

// Wait an extra second for physics and rendering to settle
await sleep(1500);

// 1. Full operatory side view showing patient contour from head to feet
await shot(page, 'prod_side_contour', [-1.6, 0.88, -0.2], [0.08, 0.76, -0.2], { fov: 52 });

// 2. Leg contour closeup showing thighs, knees, calves, and feet resting on cushion with zero clipping
await shot(page, 'prod_legs_closeup', [0.85, 0.98, 0.2], [0.12, 0.68, 0.05], { fov: 46 });

// 3. Nurse Sarah closeup showing natural skin tone arms, teal scrubs, white clogs, and clean face
await shot(page, 'prod_nurse_sarah', [-0.4, 1.35, -0.55], [-0.7, 1.25, -0.85], { fov: 50 });

// 4. Clinician 9 o'clock examination view looking down into oral cavity
await shot(page, 'prod_clinician_pov', [0.42, 1.42, -0.2], [0.08, 0.98, -0.68], { fov: 62 });

await browser.close();
console.log('Pure production verification complete.');
