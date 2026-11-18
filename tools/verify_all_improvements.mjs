import { open, shot, sleep, OUT } from './h.mjs';
import path from 'path';

console.log('=== STARTING V5 WINNER VISUAL VERIFICATION ===');
const { browser, page } = await open({ enter: false });

// 1. Stage 1: Initial Landing Screen (P.E.A.R.L. Pillars)
console.log('[1/8] Capturing Stage 1: P.E.A.R.L. Pillars...');
await page.screenshot({ path: path.join(OUT, 'v5_01_landing_pearl_only.png') });

// 2. Stage 2: Discipline & Dossier
console.log('[2/8] Clicking E -> Capturing Stage 2 Discipline & Dossier...');
await page.click('#tabE');
await sleep(400);
await page.screenshot({ path: path.join(OUT, 'v5_02_discipline_and_dossier.png') });

// 3. Enter Operatory
console.log('[3/8] Entering Dental Operatory...');
await page.click('#btnDesktop');

const t0 = Date.now();
for (;;) {
  const ready = await page.evaluate(() => {
    const P = window.__pearlsim; if (!P || !P.world) return false;
    let n = 0, p = 0;
    P.world.assistant.traverse((o) => { if (o.isBone) n++; });
    P.world.patient.root.traverse((o) => { if (o.isBone) p++; });
    return n > 0 && p > 0;
  });
  if (ready) { console.log('Models ready in', Date.now() - t0, 'ms'); break; }
  if (Date.now() - t0 > 45000) { console.log('Timeout waiting for models'); break; }
  await sleep(400);
}
await sleep(1500);

// 4. Clinician POV in 'ready' state
console.log('[4/8] Capturing Clinician Right-Side POV (Ready state)...');
await page.screenshot({ path: path.join(OUT, 'v5_03_clinician_pov_ready.png') });

// 5. Full Side Profile
console.log('[5/8] Capturing Side Profile of Operatory...');
await shot(page, 'v5_04_side_contour', [-1.75, 1.05, -0.25], [0.08, 0.85, -0.45], { fov: 52 });

// 6. Emergency Drug Box Closed & Opened Closeup
console.log('[6/8] Capturing Emergency Resuscitation Drug Box Closeup...');
await shot(page, 'v5_05_emergency_drug_box', [0.05, 1.25, -0.32], [0.66, 0.96, -0.32], { fov: 46 });

// 7. Start Checkup, Palpate Pulse (attach telemetry), Grab Mirror -> Mouth Reticle
console.log('[7/8] Testing Mouth Mirror, Nitrile Gloved Hand & Mouth Reticle...');
await page.evaluate(() => {
  const P = window.__pearlsim;
  P.camera.position.set(-0.48, 1.38, -0.22);
  P.camera.lookAt(0.08, 0.92, -0.72);
  P.camera.fov = 60;
  P.camera.updateProjectionMatrix();
  P.startCheckup();
  P.engine.act('assess_pulse');
  P.S.pulseShown = Math.round(P.engine.vitals.hr);

  // Grab mirror via pointer/tool logic
  const mirrorTool = P.world.tools.find((t) => t.userData.ia.tool === 'mirror');
  P.hands[2].held = mirrorTool;
  mirrorTool.parent.remove(mirrorTool);
  const holder = P.camera.children.find((c) => c.isGroup);
  holder?.add(mirrorTool);
  mirrorTool.position.set(0, 0, 0);
  if (holder?.children[0]) holder.children[0].visible = true; // deskGlove
  if (P.world.patient.mouthRing) P.world.patient.mouthRing.visible = true;
});
await sleep(600);
await page.screenshot({ path: path.join(OUT, 'v5_06_mirror_gloved_hand_reticle.png') });

// 8. Trigger Oral Cavity Endoscopy + Lumen Diameter Telemetry View
console.log('[8/8] Capturing Oral Cavity Endoscopy & Lumen Diameter HUD...');
await page.evaluate(() => {
  const P = window.__pearlsim;
  if (P.world.patient.mouthRing) P.world.patient.mouthRing.visible = false;
  P.engine.act('inspect_airway');
  P.S.mirrorUntil = P.S.time + 8;
});
await sleep(700);
await page.screenshot({ path: path.join(OUT, 'v5_07_oral_endoscopy_lumen_hud.png') });

// Bonus: Capture Vastus Lateralis IM Injection Reticle with EpiPen in Gloved Hand
await page.evaluate(() => {
  const P = window.__pearlsim;
  P.S.mirrorUntil = 0;
  P.engine.act('diagnose', { id: 'anaphylaxis' });
  P.engine.act('call_help');
  P.world.openBox();
  P.engine.act('open_drug_box');
  const epi = P.world.tools.find((t) => t.userData.ia.id === 'adrenaline_1');
  const holder = P.camera.children.find((c) => c.isGroup);
  if (P.hands[2].held) P.hands[2].held.removeFromParent();
  P.hands[2].held = epi;
  epi.parent.remove(epi);
  holder?.add(epi);
  epi.position.set(0, 0, 0);
  if (P.world.patient.thighRing) P.world.patient.thighRing.visible = true;
});
await sleep(600);
await page.screenshot({ path: path.join(OUT, 'v5_08_vastus_lateralis_epipen_hud.png') });

await browser.close();
console.log('=== V5 VERIFICATION COMPLETE ===');
