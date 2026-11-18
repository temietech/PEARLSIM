// Photorealistic clinical dental operatory suite, cabinetry, articulated dental lamp,
// delivery unit, and Pelican-style emergency resuscitation case.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildPatient, buildNurse } from './patient.js';
import { makeLabel } from './ui.js';
import { t } from './i18n.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat);
const cyl = (rt, rb, h, mat, seg = 20) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  return tex;
}

// Light grey clinical wood-plank / hospital vinyl plank flooring (matches pearlsim_page2 concept art)
function vinylFloorTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, w, h);
    const planks = 8, ph = h / planks;
    for (let r = 0; r < planks; r++) {
      const y = r * ph;
      ctx.fillStyle = r % 2 === 0 ? '#9ca8b8' : '#8e9bab';
      ctx.fillRect(0, y, w, ph - 1.5);
      // Subtle linear grain lines
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 40; i++) {
        ctx.fillRect(Math.random() * w, y + Math.random() * ph, 40 + Math.random() * 80, 1);
      }
      ctx.fillStyle = 'rgba(15,23,42,0.08)';
      ctx.fillRect(0, y + ph - 1.5, w, 1.5);
      const jointX = ((r * 173) % (w - 80)) + 40;
      ctx.fillRect(jointX, y, 1.5, ph);
    }
  }, [6, 6]);
}

function skyWindowTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#bae6fd');
    g.addColorStop(0.55, '#e0f2fe');
    g.addColorStop(0.65, '#cbd5e1');
    g.addColorStop(1, '#94a3b8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Frosted architectural window blinds / vertical louvers
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    for (let x = 0; x < w; x += 32) {
      ctx.fillRect(x, 0, 22, h);
    }
    // Window frame mullion
    ctx.fillStyle = '#334155';
    ctx.fillRect(w / 2 - 6, 0, 12, h);
    ctx.fillRect(0, h * 0.58, w, 10);
  });
}

// Dental panoramic radiograph (OPG X-ray) texture for wall viewer & EHR screen
function xrayTexture() {
  return canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#040d14';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, w * 0.45);
    g.addColorStop(0, 'rgba(165, 243, 252, 0.28)');
    g.addColorStop(0.6, 'rgba(56, 189, 248, 0.14)');
    g.addColorStop(1, 'rgba(4, 13, 20, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Dental arch teeth silhouettes on OPG
    ctx.fillStyle = 'rgba(224, 242, 254, 0.78)';
    for (let i = -7; i <= 7; i++) {
      const tx = w / 2 + i * 16;
      const curve = (i * i) * 0.45;
      ctx.beginPath(); ctx.roundRect(tx - 6, h * 0.36 - curve * 0.3, 12, 22, 3); ctx.fill();
      ctx.beginPath(); ctx.roundRect(tx - 5, h * 0.54 + curve * 0.3, 10, 22, 3); ctx.fill();
    }
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#67e8f9';
    ctx.font = '700 14px ui-monospace, monospace';
    ctx.fillText('PANORAMIC OPG • ADEBAYO, ALEX (68F) • DOB 14-03-1958', 18, 28);
  });
}

function makeTool(id, tool, drug, build) {
  const g = new THREE.Group();
  build(g);
  // Tight hit spheres matching actual instrument dimensions so off-target clicks do not trigger
  const hitRadius = drug ? 0.042 : 0.055;
  const reachRadius = drug ? 0.14 : 0.18;
  const proxy = new THREE.Mesh(
    new THREE.SphereGeometry(hitRadius, 10, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  proxy.visible = true;
  proxy.position.y = 0.05;
  g.add(proxy);
  g.userData.ia = { kind: 'tool', id, tool, drug, radius: reachRadius, enabled: true };
  return g;
}

const gloss = (c) => std(c, { roughness: 0.22, metalness: 0.04 });

// Printed EpiPen barrel label texture
function epiLabelTex() {
  return canvasTex(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#fef08a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(10, 12, w - 20, h - 24);
    ctx.fillStyle = '#0f172a'; ctx.font = '900 26px system-ui, sans-serif';
    ctx.fillText('EpiPen 0.3mg', 22, 46);
    ctx.fillStyle = '#dc2626'; ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText('ADRENALINE 1:1000 IM', 22, 74);
    ctx.fillStyle = '#f97316'; ctx.fillRect(22, 86, w - 44, 16);
  });
}

// High-fidelity Epinephrine auto-injector (EpiPen)
function injector(g) {
  const body = cyl(0.0115, 0.0115, 0.074, gloss(0xeab308));
  body.position.y = 0.048;
  const label = cyl(0.0118, 0.0118, 0.042, new THREE.MeshStandardMaterial({ map: epiLabelTex(), roughness: 0.25 }));
  label.position.y = 0.052;
  const blueCap = cyl(0.0122, 0.0122, 0.018, gloss(0x1d4ed8));
  blueCap.position.y = 0.093;
  const orangeTip = cyl(0.0095, 0.0065, 0.015, gloss(0xf97316));
  orangeTip.position.y = 0.0075;
  const thumbButton = cyl(0.0085, 0.0085, 0.005, gloss(0xdc2626));
  thumbButton.position.y = 0.104;
  g.add(body, label, blueCap, orangeTip, thumbButton);
}

// Sublingual GTN Spray Canister
function gtn(g) {
  const body = cyl(0.014, 0.014, 0.062, gloss(0xf8fafc)); body.position.y = 0.031;
  const redBand = cyl(0.0143, 0.0143, 0.024, gloss(0xdc2626)); redBand.position.y = 0.035;
  const nozzle = cyl(0.008, 0.010, 0.020, gloss(0xdc2626)); nozzle.position.y = 0.071;
  const tip = box(0.006, 0.004, 0.008, gloss(0xf8fafc)); tip.position.set(0, 0.076, 0.008);
  g.add(body, redBand, nozzle, tip);
}

// Salbutamol Inhaler
function inhaler(g) {
  const canister = cyl(0.012, 0.012, 0.052, std(0xd1d5db, { metalness: 0.85, roughness: 0.18 })); canister.position.set(0, 0.05, 0);
  const boot = rbox(0.026, 0.062, 0.024, 0.006, gloss(0x0284c7)); boot.position.set(0, 0.041, 0);
  const mouthpiece = rbox(0.024, 0.020, 0.038, 0.006, gloss(0x0369a1)); mouthpiece.position.set(0, 0.012, 0.012);
  g.add(canister, boot, mouthpiece);
}

// Oral Glucose Gel Tube
function glucose(g) {
  const tube = cyl(0.008, 0.016, 0.082, gloss(0xf97316)); tube.position.y = 0.041;
  const cap = cyl(0.007, 0.007, 0.015, gloss(0xf8fafc)); cap.position.y = 0.090;
  g.add(tube, cap);
}

// Soluble Aspirin Pack
function aspirin(g) {
  const pack = rbox(0.05, 0.062, 0.014, 0.003, gloss(0xf8fafc)); pack.position.y = 0.031;
  const stripe = box(0.051, 0.016, 0.015, gloss(0x16a34a)); stripe.position.y = 0.048;
  g.add(pack, stripe);
}

// Insulin Pen (100 units/mL)
function insulinPen(g) {
  const body = cyl(0.0085, 0.0085, 0.095, gloss(0x0d9488)); body.position.y = 0.0475;
  const windowBand = cyl(0.0088, 0.0088, 0.024, gloss(0xe2e8f0)); windowBand.position.y = 0.055;
  const cap = cyl(0.009, 0.009, 0.032, gloss(0xf8fafc)); cap.position.y = 0.108;
  const dial = cyl(0.007, 0.007, 0.012, gloss(0x0284c7)); dial.position.y = 0.006;
  g.add(body, windowBand, cap, dial);
}

// Stainless Steel Dental Mouth Mirror with knurled handle & angled mirror head
function mirror(g) {
  const steel = std(0xe2e8f0, { metalness: 0.95, roughness: 0.12 });
  const handle = cyl(0.005, 0.004, 0.145, steel); handle.position.y = 0.072;
  const gripRing1 = cyl(0.0056, 0.0056, 0.018, std(0x94a3b8, { metalness: 0.9, roughness: 0.35 })); gripRing1.position.y = 0.055;
  const neck = cyl(0.003, 0.003, 0.028, steel); neck.position.set(0, 0.152, 0.004); neck.rotation.x = 0.35;
  const bezel = cyl(0.0145, 0.0145, 0.003, steel, 24);
  bezel.position.set(0, 0.168, 0.010); bezel.rotation.x = 0.95;
  const disc = cyl(0.013, 0.013, 0.0035, std(0xbae6fd, { metalness: 0.98, roughness: 0.02 }), 24);
  disc.position.set(0, 0.168, 0.0105); disc.rotation.x = 0.95;
  g.add(handle, gripRing1, neck, bezel, disc);
}

// High-Concentration Oxygen Mask with Reservoir Bag & Green Tubing
function mask(g) {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xdcfce7, transparent: true, opacity: 0.48, roughness: 0.08, side: THREE.DoubleSide, clearcoat: 1.0 })
  );
  dome.scale.set(1.25, 0.82, 1.0);
  const bag = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 16, 12),
    new THREE.MeshPhysicalMaterial({ color: 0xf0fdf4, transparent: true, opacity: 0.58, roughness: 0.2 })
  );
  bag.scale.set(1.6, 0.65, 1.0); bag.position.set(0.095, 0, 0);
  const port = cyl(0.008, 0.008, 0.032, std(0x15803d)); port.position.y = 0.046;
  g.add(dome, bag, port);
}

export function buildWorld(scene, { phototype, patientKey = 'adebayo', onAssetLoaded = null }) {
  const pickables = [];
  const tools = [];
  const white = std(0xf8fafc, { roughness: 0.30, metalness: 0.04 });
  const chrome = std(0xe2e8f0, { roughness: 0.16, metalness: 0.90 });
  const charcoal = std(0x1e293b, { roughness: 0.40, metalness: 0.08 });
  const slateCounter = std(0x334155, { roughness: 0.26, metalness: 0.14 });
  const tealAccent = std(0x0d9488, { roughness: 0.38 });

  // 1. Lighting: Balanced surgical key, cool-daylight fill, subtle rim separation, and crisp directional shadows
  scene.add(new THREE.HemisphereLight(0xf8fafc, 0x64748b, 0.54));
  const sun = new THREE.DirectionalLight(0xfffbeb, 1.48);
  sun.position.set(-2.4, 3.2, 1.5); sun.target.position.set(0.05, 0.85, -0.8);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.018; sun.shadow.radius = 2.5;
  Object.assign(sun.shadow.camera, { left: -2.8, right: 2.8, top: 2.8, bottom: -2.8, near: 0.5, far: 9.5 });
  const fill = new THREE.DirectionalLight(0xdbeafe, 0.46);
  fill.position.set(1.9, 2.2, 1.8); fill.target.position.set(0.05, 0.85, -0.5);
  const rim = new THREE.DirectionalLight(0xe0f2fe, 0.42);
  rim.position.set(0.4, 2.4, -2.1); rim.target.position.set(0.1, 1.0, -0.35);
  scene.add(sun, sun.target, fill, fill.target, rim, rim.target);

  // Cached soft Ambient Occlusion contact-shadow texture (zero runtime shader cost)
  const aoTex = canvasTex(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 6, 32, 32, 31);
    g.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
    g.addColorStop(0.6, 'rgba(15, 23, 42, 0.22)');
    g.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  const addAO = (parent, w, d, x, y, z, opacity = 0.65, rx = -Math.PI / 2) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity, depthWrite: false })
    );
    m.rotation.x = rx;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // 2. Room Shell (Clinical Dental Operatory Suite)
  const room = new THREE.Group(); scene.add(room);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 6.4),
    std(0xffffff, { map: vinylFloorTexture(), roughness: 0.34, metalness: 0.06 })
  );
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);

  const wallMat = std(0xd8e2ed, { roughness: 0.82 });
  const trimMat = std(0x64748b, { metalness: 0.5, roughness: 0.35 });

  for (const [x, z, ry] of [[0, -2.6, 0], [0, 2.8, Math.PI], [-2.6, 0, Math.PI / 2], [2.6, 0, -Math.PI / 2]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.0), wallMat);
    w.position.set(x, 1.5, z); w.rotation.y = ry; w.receiveShadow = true; room.add(w);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.09, 0.025), trimMat);
    rail.position.set(x * 0.995, 0.92, z * 0.995); rail.rotation.y = ry; room.add(rail);
    const skirt = box(5.6, 0.10, 0.02, charcoal); skirt.position.set(x * 0.997, 0.05, z * 0.997); skirt.rotation.y = ry; room.add(skirt);
  }

  // Ceiling with acoustic grid & LED panels
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), std(0xf8fafc, { roughness: 0.95 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 3.0; room.add(ceil);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const x of [-1.0, 1.0]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), ledMat);
    panel.rotation.x = Math.PI / 2; panel.position.set(x, 2.99, -0.7); room.add(panel);
  }

  // Architectural Window with Vertical Blinds & Daylight on Right/Left Wall
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.35), new THREE.MeshBasicMaterial({ map: skyWindowTexture(), toneMapped: false }));
  win.rotation.y = Math.PI / 2; win.position.set(-2.58, 1.62, -0.65); room.add(win);
  room.add(at(box(0.06, 0.06, 2.3, white), -2.56, 2.32, -0.65));
  room.add(at(box(0.06, 0.06, 2.3, white), -2.56, 0.92, -0.65));

  // 3. Detailed Clinical Rear Cabinetry, Drawers, Upper Wall Cabinets & X-Ray Viewer
  const cab = rbox(4.2, 0.86, 0.58, 0.015, white); cab.position.set(0.2, 0.44, -2.28); cab.castShadow = true; cab.receiveShadow = true; room.add(cab);
  const counter = at(rbox(4.26, 0.04, 0.62, 0.012, slateCounter), 0.2, 0.89, -2.27);
  counter.castShadow = true; counter.receiveShadow = true;
  room.add(counter);
  // Subtle recessed dark seam backing behind drawer fronts + floor contact AO
  const cabSeam = box(3.85, 0.72, 0.01, std(0x94a3b8, { roughness: 0.9 }));
  cabSeam.position.set(0.17, 0.46, -1.992);
  room.add(cabSeam);
  addAO(room, 4.6, 0.55, 0.2, 0.004, -1.96, 0.55);

  // Cabinet Drawer Banks & Brushed Steel Handles (visible in clinician POV background!)
  for (let col = 0; col < 5; col++) {
    const cx = -1.35 + col * 0.76;
    for (let row = 0; row < 3; row++) {
      const cy = 0.22 + row * 0.24;
      const drawerFront = rbox(0.70, 0.21, 0.02, 0.006, std(0xf8fafc, { roughness: 0.28 }));
      drawerFront.position.set(cx, cy, -1.985);
      drawerFront.castShadow = true; drawerFront.receiveShadow = true;
      const handleBar = cyl(0.006, 0.006, 0.18, chrome, 12);
      handleBar.rotation.z = Math.PI / 2;
      handleBar.position.set(cx, cy + 0.03, -1.965);
      handleBar.castShadow = true;
      room.add(drawerFront, handleBar);
    }
  }

  // Upper Wall-Mounted Medical Storage Cabinets with Frosted Glass Inserts & Under-Cabinet LED Strip
  for (let i = 0; i < 4; i++) {
    const ux = -1.1 + i * 0.72;
    const uCab = rbox(0.68, 0.62, 0.34, 0.012, white);
    uCab.position.set(ux, 2.08, -2.41);
    uCab.castShadow = true; uCab.receiveShadow = true;
    const glassInsert = box(0.22, 0.42, 0.01, new THREE.MeshPhysicalMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.1, clearcoat: 0.8 }));
    glassInsert.position.set(ux, 2.08, -2.235);
    const uHandle = cyl(0.005, 0.005, 0.14, chrome, 10);
    uHandle.position.set(ux + 0.24, 1.92, -2.225);
    room.add(uCab, glassInsert, uHandle);
  }
  addAO(room, 3.3, 0.42, -0.02, 1.75, -2.40, 0.38);
  // Under-cabinet warm LED task strip
  const underLed = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.02, 0.08), new THREE.MeshBasicMaterial({ color: 0xfffbeb, toneMapped: false }));
  underLed.position.set(-0.02, 1.76, -2.35);
  room.add(underLed);

  // Wall-Mounted Dental Panoramic X-Ray Lightbox (Radiograph Viewer)
  const xrayFrame = rbox(0.66, 0.36, 0.03, 0.01, charcoal);
  xrayFrame.position.set(-0.65, 1.38, -2.56);
  const xrayScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.60, 0.30), new THREE.MeshBasicMaterial({ map: xrayTexture(), toneMapped: false }));
  xrayScreen.position.set(-0.65, 1.38, -2.542);
  room.add(xrayFrame, xrayScreen);

  // Brushed steel sink, sensor faucet & wall soap/towel dispensers
  room.add(at(rbox(0.48, 0.025, 0.38, 0.01, std(0xcbd5e1, { metalness: 0.9, roughness: 0.2 })), 1.55, 0.905, -2.26));
  room.add(at(cyl(0.013, 0.013, 0.24, chrome, 16), 1.55, 1.03, -2.42));
  const spout = cyl(0.011, 0.011, 0.18, chrome, 16); spout.rotation.x = Math.PI / 2; room.add(at(spout, 1.55, 1.15, -2.35));

  // Medical Glove Dispensers & Yellow Biohazard Sharps Bin on Counter
  for (let i = 0; i < 3; i++) {
    room.add(at(rbox(0.22, 0.11, 0.12, 0.01, std([0x0d9488, 0x2563eb, 0x0284c7][i], { roughness: 0.45 })), -1.35 + i * 0.26, 0.96, -2.32));
  }
  const sharpsBin = at(rbox(0.18, 0.24, 0.16, 0.02, std(0xfacc15, { roughness: 0.38 })), -1.78, 1.02, -2.32);
  const sharpsLid = at(rbox(0.19, 0.04, 0.17, 0.01, std(0xdc2626, { roughness: 0.4 })), -1.78, 1.15, -2.32);
  room.add(sharpsBin, sharpsLid);

  // Soft contact shadow under chair
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({
    map: canvasTex(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
      g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    }),
    transparent: true, depthWrite: false,
  }));
  blob.rotation.x = -Math.PI / 2; blob.position.set(0.12, 0.005, -0.62); scene.add(blob);

  // 4. Build Realistic Patient & Chair
  let curPatientKey = patientKey, curPhototype = phototype;
  let patient = buildPatient(phototype, patientKey, onAssetLoaded);
  scene.add(patient.root);
  pickables.push(...Object.values(patient.zones));

  // Chair recline button target (Mounted on Clinician's Side of Chair above armrest height)
  const recline = new THREE.Group();
  recline.add(rbox(0.15, 0.068, 0.032, 0.008, charcoal));
  const reclineHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.08, 0.05),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  recline.add(reclineHit);
  const padLbl = makeLabel(t('lbl_chair'), 0.13, 0.046, { bg: '#0f172a', fg: '#38bdf8' }); padLbl.position.z = 0.0165; recline.add(padLbl);
  recline.position.set(-0.56, 1.12, -0.62);
  recline.rotation.set(-0.18, 0.42, 0);
  recline.userData.ia = { kind: 'target', id: 'recline', enabled: true, radius: 0.26 };
  scene.add(recline); pickables.push(recline);

  // 5. Dental Nurse Sarah (Clear of Crash Cart & Drug Box on Patient's Left Headside)
  const assistant = buildNurse(onAssetLoaded);
  assistant.position.set(0.32, 0, -0.96);
  assistant.rotation.y = -0.68;
  assistant.userData.ia = { kind: 'target', id: 'assistant', enabled: true, radius: 0.46 };
  scene.add(assistant);
  // Fast 12-triangle bounding box proxy for raycasting (avoids slow CPU SkinnedMesh raycasting on mousemove!)
  const assistantHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 1.65, 0.48),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  assistantHit.position.set(0.32, 0.92, -0.96);
  assistantHit.userData.ia = assistant.userData.ia;
  scene.add(assistantHit);
  pickables.push(assistantHit);

  // 6. Spatial Peripheral Vitals & ECG Monitor (Upper-Left Peripheral FOV in VR/MR — never blocks patient or tray)
  const monitorAnchor = new THREE.Group();
  monitorAnchor.position.set(-0.78, 1.38, -1.04);
  monitorAnchor.rotation.set(0.08, 0.58, 0);
  monitorAnchor.scale.setScalar(0.92);
  scene.add(monitorAnchor);

  // 7. Ceiling-Suspended Articulated Dental Operating Lamp (Zero floor pole obstruction!)
  const ceilMount = cyl(0.11, 0.13, 0.04, chrome, 24); ceilMount.position.set(0.05, 2.98, -0.62); scene.add(ceilMount);
  const lampPost = cyl(0.022, 0.022, 0.95, chrome, 20); lampPost.position.set(0.05, 2.50, -0.62); scene.add(lampPost);
  const lampBoom1 = cyl(0.018, 0.018, 0.56, white, 16); lampBoom1.rotation.x = 0.52; lampBoom1.position.set(0.02, 1.84, -0.64); scene.add(lampBoom1);
  const lampJoint = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 16), chrome); lampJoint.position.set(-0.02, 1.62, -0.65); scene.add(lampJoint);

  const lamp = new THREE.Group();
  lamp.position.set(-0.06, 1.46, -0.64);
  lamp.rotation.set(0.42, 0.28, 0.12);
  scene.add(lamp);
  // Curved surgical lamp reflector head
  lamp.add(rbox(0.26, 0.065, 0.17, 0.028, white));
  lamp.add(at(rbox(0.22, 0.02, 0.13, 0.01, chrome), 0, 0.035, 0));
  // Glowing LED emitter array
  const ledFace = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.12), new THREE.MeshBasicMaterial({ color: 0xfff9e6, toneMapped: false }));
  ledFace.position.set(0, -0.034, 0); ledFace.rotation.x = Math.PI / 2; lamp.add(ledFace);
  // Dual U-shaped sterilizable handles
  for (const x of [-0.155, 0.155]) {
    const hGrip = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.007, 10, 20, Math.PI), chrome);
    hGrip.position.set(x, -0.01, 0.02);
    hGrip.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    lamp.add(hGrip);
  }
  // Subtle volumetric light cone under the dental operating lamp
  const coneGeo = new THREE.ConeGeometry(0.26, 0.52, 24, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff8dc, transparent: true, opacity: 0.065, side: THREE.DoubleSide, depthWrite: false });
  const lightCone = new THREE.Mesh(coneGeo, coneMat);
  lightCone.position.set(0, -0.28, 0);
  lamp.add(lightCone);

  // Focused Surgical Spotlight aimed at patient's oral cavity (balanced so it never blows out forehead highlights)
  const spot = new THREE.SpotLight(0xfff8eb, 2.2, 3.0, 0.45, 0.75, 1.8);
  spot.position.set(-0.06, 1.44, -0.64); spot.target.position.set(0.08, 0.95, -0.74); scene.add(spot, spot.target);

  // 8. Cantilevered Dental Delivery Unit & Bracket Table with Mouth Mirror (Clinician's Side, ~0.62m reach)
  const trayX = -0.46, trayY = 0.88, trayZ = -0.48;
  // White delivery unit housing & blue disposable clinical barrier mat
  scene.add(
    at(rbox(0.38, 0.032, 0.28, 0.012, white), trayX, trayY, trayZ),
    at(rbox(0.33, 0.006, 0.23, 0.004, std(0x38bdf8, { roughness: 0.55 })), trayX, trayY + 0.018, trayZ),
    at(rbox(0.22, 0.008, 0.14, 0.004, chrome), trayX + 0.03, trayY + 0.021, trayZ - 0.02)
  );
  // Delivery arm & coiled handpiece hoses hanging under bracket table
  scene.add(at(cyl(0.016, 0.018, 0.88, chrome), trayX - 0.14, 0.44, trayZ), at(cyl(0.14, 0.16, 0.025, chrome, 24), trayX - 0.14, 0.015, trayZ));
  for (let i = 0; i < 3; i++) {
    const hz = trayZ - 0.08 + i * 0.06;
    // Handpiece holsters on side of delivery head
    const holster = cyl(0.009, 0.007, 0.09, chrome, 12);
    holster.rotation.z = -0.45;
    scene.add(at(holster, trayX + 0.19, trayY - 0.01, hz));
    // Hanging tubing loop
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.0045, 8, 20, Math.PI), charcoal);
    hose.rotation.x = Math.PI; hose.rotation.y = Math.PI / 2;
    scene.add(at(hose, trayX + 0.17, trayY - 0.06, hz));
  }

  const mLbl = makeLabel(t('lbl_mirror'), 0.14, 0.040, { bg: '#0f172a', fg: '#67e8f9', px: 512 });
  mLbl.rotation.x = -Math.PI / 2; mLbl.position.set(trayX - 0.02, trayY + 0.029, trayZ + 0.088); scene.add(mLbl);
  for (const z of [trayZ - 0.04, trayZ - 0.01]) {
    const probe = cyl(0.003, 0.0015, 0.15, chrome, 10); probe.rotation.z = Math.PI / 2;
    scene.add(at(probe, trayX + 0.03, trayY + 0.026, z));
  }
  const mirrorTool = makeTool('mirror', 'mirror', null, mirror);
  mirrorTool.position.set(trayX - 0.05, trayY + 0.026, trayZ - 0.03);
  mirrorTool.rotation.z = -Math.PI / 2;
  scene.add(mirrorTool); tools.push(mirrorTool);

  // 9. Oxygen Cylinder (Beside Emergency Crash Cart)
  const o2X = 0.72, o2Z = -0.90;
  scene.add(at(cyl(0.075, 0.075, 0.64, std(0x0f172a, { roughness: 0.28 }), 28), o2X, 0.36, o2Z));
  scene.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), gloss(0xf8fafc)), o2X, 0.68, o2Z));
  scene.add(at(cyl(0.022, 0.026, 0.08, std(0xd4a017, { metalness: 0.9, roughness: 0.25 }), 14), o2X, 0.78, o2Z), at(cyl(0.095, 0.105, 0.05, charcoal, 24), o2X, 0.025, o2Z));
  scene.add(at(cyl(0.008, 0.008, 0.28, chrome, 10), o2X, 0.92, o2Z));
  const oLbl = makeLabel(t('lbl_o2'), 0.11, 0.038, { bg: '#0f172a', fg: '#34d399' }); oLbl.position.set(o2X, 0.48, o2Z + 0.078); scene.add(oLbl);

  // 10. Emergency Crash Cart with Pelican-Style Molded Resuscitation Drug Case (~0.64m reach, clear of Nurse Sarah)
  const cartX = 0.72, cartZ = -0.26;
  const cartBody = at(rbox(0.50, 0.82, 1.08, 0.025, white), cartX, 0.49, cartZ);
  cartBody.castShadow = true; cartBody.receiveShadow = true;
  const cartTop = at(rbox(0.54, 0.032, 1.12, 0.012, slateCounter), cartX, 0.915, cartZ);
  cartTop.castShadow = true; cartTop.receiveShadow = true;
  const cartRail = at(cyl(0.01, 0.01, 1.02, chrome, 12), cartX - 0.28, 0.89, cartZ);
  cartRail.rotation.x = Math.PI / 2;
  scene.add(cartBody, cartTop, cartRail);
  addAO(scene, 0.82, 1.35, cartX, 0.005, cartZ, 0.58);
  addAO(scene, 0.42, 0.88, 0.66, 0.933, -0.26, 0.72);

  for (let i = 0; i < 3; i++) {
    // Red emergency crash-cart drawer accent stripes & chrome handles
    scene.add(at(rbox(0.02, 0.22, 1.00, 0.008, std(0xf1f5f9, { roughness: 0.35 })), cartX - 0.258, 0.24 + i * 0.25, cartZ));
    scene.add(at(box(0.022, 0.028, 0.98, std(0xdc2626, { roughness: 0.35 })), cartX - 0.259, 0.32 + i * 0.25, cartZ));
    const h = cyl(0.007, 0.007, 0.46, chrome, 10); h.rotation.x = Math.PI / 2; scene.add(at(h, cartX - 0.28, 0.26 + i * 0.25, cartZ));
  }
  for (const [x, z] of [[cartX - 0.20, cartZ + 0.46], [cartX - 0.20, cartZ - 0.46], [cartX + 0.20, cartZ + 0.46], [cartX + 0.20, cartZ - 0.46]]) {
    scene.add(at(cyl(0.035, 0.035, 0.04, charcoal, 16), x, 0.04, z));
  }

  const drugBox = new THREE.Group();
  drugBox.position.set(0.66, 0.93, -0.26);
  drugBox.rotation.set(0, -Math.PI / 2, 0);
  scene.add(drugBox);

  const red = std(0xdc2626, { roughness: 0.32, metalness: 0.05 });
  const parts = [
    [0.74, 0.024, 0.22, 0, 0.012, 0],
    [0.74, 0.145, 0.008, 0, 0.0725, -0.106],
    [0.008, 0.145, 0.22, 0.366, 0.0725, 0],
    [0.008, 0.145, 0.22, -0.366, 0.0725, 0],
    [0.74, 0.068, 0.008, 0, 0.034, 0.106],
  ];
  for (const [w, h, d, x, y, z] of parts) {
    const pMesh = at(rbox(w, h, d, 0.003, red), x, y, z);
    pMesh.castShadow = true; pMesh.receiveShadow = true;
    drugBox.add(pMesh);
  }

  // Dark charcoal die-cut foam insert with 7 individual recessed slots
  drugBox.add(at(box(0.72, 0.006, 0.20, std(0x0f172a, { roughness: 0.85 })), 0, 0.025, 0));
  for (let s = 0; s < 6; s++) {
    drugBox.add(at(box(0.005, 0.045, 0.19, std(0x1e293b, { roughness: 0.7 })), -0.25 + s * 0.10, 0.045, 0));
  }

  // Hinged Pelican-Style Lid with Molded Ribs, Heavy-Duty Black Latches & Top Handle
  const lid = new THREE.Group(); lid.position.set(0, 0.148, -0.106); drugBox.add(lid);
  const lidLbl = makeLabel('✚ EMERGENCY RESUSCITATION DRUGS', 0.64, 0.082, { bg: '#ffffff', fg: '#b91c1c', px: 512 });
  lidLbl.position.set(0, -0.072, 0.222);
  const lidLbl2 = makeLabel('✚ EMERGENCY RESUSCITATION DRUGS', 0.64, 0.082, { bg: '#ffffff', fg: '#b91c1c', px: 512 });
  lidLbl2.rotation.x = -Math.PI / 2; lidLbl2.position.set(0, 0.005, 0.11);

  const lidTop = at(rbox(0.75, 0.008, 0.224, 0.003, red), 0, 0, 0.112);
  const lidFront = at(rbox(0.75, 0.15, 0.008, 0.003, red), 0, -0.075, 0.22);
  lidTop.castShadow = true; lidTop.receiveShadow = true;
  lidFront.castShadow = true; lidFront.receiveShadow = true;
  lid.add(
    lidTop,
    lidFront,
    // Black heavy-duty Pelican latches & top handle
    at(rbox(0.042, 0.055, 0.014, 0.003, charcoal), -0.26, -0.11, 0.224),
    at(rbox(0.042, 0.055, 0.014, 0.003, charcoal), 0.26, -0.11, 0.224),
    at(rbox(0.14, 0.022, 0.026, 0.005, charcoal), 0, -0.125, 0.228),
    lidLbl,
    lidLbl2
  );
  // Molded structural ribs on lid top
  for (const rx of [-0.32, 0.32]) {
    lid.add(at(rbox(0.018, 0.006, 0.20, 0.002, red), rx, 0.005, 0.112));
  }
  const lidHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.14, 0.22),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  lidHit.position.set(0, -0.06, 0.12);
  lid.add(lidHit);
  lid.userData.ia = { kind: 'target', id: 'boxlid', enabled: true, radius: 0.42 };
  pickables.push(lid);

  const guideLabels = [padLbl, mLbl, oLbl];
  const layout = [
    ['gtn', 'oral', 'gtn', gtn], ['adrenaline_1', 'injector', 'adrenaline', injector],
    ['glucose', 'oral', 'glucose', glucose], ['salbutamol', 'oral', 'salbutamol', inhaler],
    ['insulin', 'oral', 'insulin', insulinPen], ['aspirin', 'oral', 'aspirin', aspirin],
  ];
  layout.forEach(([id, tool, drug, build], i) => {
    const x = -0.30 + i * 0.10;
    const tl = makeTool(id, tool, drug, build);
    tl.position.set(x, 0.024, 0); tl.userData.ia.enabled = false;
    drugBox.add(tl); tools.push(tl);
    const lbl = makeLabel(t('drug_' + drug), 0.096, 0.052, { bg: '#0f172a', fg: '#f8fafc' });
    lbl.position.set(x, 0.036, 0.112); drugBox.add(lbl);
    guideLabels.push(lbl);
  });

  // High-Flow Oxygen Mask placed clearly inside compartment 7 of the Emergency Box
  const maskTool = makeTool('mask', 'mask', null, mask);
  maskTool.position.set(0.30, 0.036, 0);
  maskTool.scale.setScalar(0.78);
  maskTool.userData.ia.enabled = false;
  drugBox.add(maskTool); tools.push(maskTool);
  const maskBoxLbl = makeLabel(t('drug_o2mask'), 0.096, 0.052, { bg: '#0f172a', fg: '#34d399' });
  maskBoxLbl.position.set(0.30, 0.036, 0.112); drugBox.add(maskBoxLbl);
  guideLabels.push(maskBoxLbl);

  for (const tl of tools) {
    tl.userData.home = { parent: tl.parent, position: tl.position.clone(), quaternion: tl.quaternion.clone() };
    pickables.push(tl);
  }

  floor.receiveShadow = true;

  // Freeze static room geometry matrices so Three.js skips per-frame static matrix multiplies
  room.traverse((obj) => {
    if (obj !== room) {
      obj.updateMatrix();
      obj.matrixAutoUpdate = false;
    }
  });

  let lidOpen = false, lidAngle = 0;
  return {
    room,
    get patient() { return patient; },
    tools, pickables, monitorAnchor, assistant, assistantHit, recline, lid, maskTool, mirrorTool, blob, guideLabels,
    targets: [recline, assistantHit, lid],
    openBox() {
      if (lidOpen) return false;
      lidOpen = true; lid.userData.ia.enabled = false;
      for (const tl of tools) if (tl.userData.ia.drug || tl.userData.ia.tool === 'mask') tl.userData.ia.enabled = true;
      return true;
    },
    isBoxOpen() { return lidOpen; },
    setPatient(nextPhototype, nextPatientKey) {
      if (curPatientKey === nextPatientKey && curPhototype === nextPhototype) return;
      const oldZones = new Set(Object.values(patient.zones));
      for (let i = pickables.length - 1; i >= 0; i--) {
        if (oldZones.has(pickables[i])) pickables.splice(i, 1);
      }
      scene.remove(patient.root);
      curPhototype = nextPhototype;
      curPatientKey = nextPatientKey;
      patient = buildPatient(nextPhototype, nextPatientKey);
      scene.add(patient.root);
      pickables.push(...Object.values(patient.zones));
    },
    reset(baselineVitals) {
      lidOpen = false;
      lidAngle = 0;
      lid.rotation.x = 0;
      lid.userData.ia.enabled = true;
      recline.userData.ia.enabled = true;
      assistantHit.userData.ia.enabled = true;
      for (const tl of tools) {
        const h = tl.userData.home;
        if (h) {
          h.parent.add(tl);
          tl.position.copy(h.position);
          tl.quaternion.copy(h.quaternion);
        }
        tl.userData.ia.enabled = !tl.userData.ia.drug && tl.userData.ia.tool !== 'mask';
      }
      assistant.userData.reset?.();
      patient.reset?.(baselineVitals);
    },
    update(dt) {
      assistant.userData.update?.(dt);
      const target = lidOpen ? -1.95 : 0;
      if (Math.abs(lidAngle - target) > 1e-3) { lidAngle += (target - lidAngle) * (1 - Math.exp(-dt * 6)); lid.rotation.x = lidAngle; }
    },
  };
}
