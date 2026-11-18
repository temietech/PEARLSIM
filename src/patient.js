// High-fidelity clinical patient with Ready Player Me photorealistic avatar,
// authentic dental chair, contoured dental bib, widescreen intra-oral endoscopy AR visor, and Nurse Sarah.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const PHOTOTYPES = {
  VI: { label: 'Fitzpatrick VI', skin: 0x4a2c1d, pale: 0x5a4842, lip: 0x6a332f, lipCyan: 0x5d535c, tongue: 0xb85260, tongueCyan: 0x723d58, mucosa: '#8c3b4a' },
  IV: { label: 'Fitzpatrick IV', skin: 0x9c6b46, pale: 0x9f8875, lip: 0x96504a, lipCyan: 0x6f647a, tongue: 0xc4626c, tongueCyan: 0x7f6d88, mucosa: '#a34858' },
  II: { label: 'Fitzpatrick II', skin: 0xe4b899, pale: 0xddd1c9, lip: 0xc47876, lipCyan: 0x6d6e9e, tongue: 0xd26c76, tongueCyan: 0x7c70a2, mucosa: '#b85464' },
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function fabricBumpTexture() {
  if (fabricBumpTexture._tex) return fabricBumpTexture._tex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 1;
  for (let i = -256; i < 512; i += 4) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 256, 256); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.09)';
  for (let y = 0; y < 256; y += 3) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }
  for (const [x1, y1, x2, y2, w, a] of [
    [24, 18, 128, 140, 14, 0.28], [18, 42, 118, 165, 10, 0.20],
    [220, 22, 132, 152, 13, 0.26], [118, 110, 140, 240, 12, 0.22],
    [60, 150, 188, 195, 11, 0.20],
  ]) {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.45, `rgba(20,20,20,${a})`);
    g.addColorStop(0.65, `rgba(245,245,245,${a * 0.85})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = g; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(15,23,42,0.42)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(256, 128); ctx.stroke();
  ctx.setLineDash([]);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  fabricBumpTexture._tex = tex;
  return tex;
}

function setMorph(mesh, name, val) {
  const idx = mesh?.morphTargetDictionary?.[name];
  if (idx !== undefined && mesh.morphTargetInfluences) mesh.morphTargetInfluences[idx] = val;
}

function lerpMorph(mesh, name, target, alpha) {
  const idx = mesh?.morphTargetDictionary?.[name];
  if (idx !== undefined && mesh.morphTargetInfluences) {
    mesh.morphTargetInfluences[idx] += (target - mesh.morphTargetInfluences[idx]) * alpha;
  }
}

const _liftedTexCache = new Map();
function liftTextureLuminance(origTex, gamma = 0.52, desaturate = 0.25) {
  if (!origTex?.image) return origTex;
  const key = `${origTex.uuid}_${gamma}_${desaturate}`;
  if (_liftedTexCache.has(key)) return _liftedTexCache.get(key);
  const img = origTex.image;
  const w = Math.min(512, img.width || 512);
  const h = Math.min(512, img.height || 512);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  try {
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = Math.pow(d[i] / 255, gamma) * 255;
      let g = Math.pow(d[i + 1] / 255, gamma) * 255;
      let b = Math.pow(d[i + 2] / 255, gamma) * 255;
      if (desaturate > 0) {
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        r = r + (lum - r) * desaturate;
        g = g + (lum - g) * desaturate;
        b = b + (lum - b) * desaturate;
      }
      d[i] = Math.min(255, r);
      d[i + 1] = Math.min(255, g);
      d[i + 2] = Math.min(255, b);
    }
    ctx.putImageData(id, 0, 0);
  } catch { /* fallback if tainted */ }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = origTex.colorSpace || THREE.SRGBColorSpace;
  tex.flipY = origTex.flipY;
  tex.wrapS = origTex.wrapS;
  tex.wrapT = origTex.wrapT;
  _liftedTexCache.set(key, tex);
  return tex;
}

// High-tech Vastus Lateralis IM target reticle texture (matches pearlsim_page5)
function makeThighReticleTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  const cx = 256, cy = 240;

  ctx.strokeStyle = '#10b981';
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 18;
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(cx, cy, 175, 0, Math.PI * 2); ctx.stroke();

  ctx.lineWidth = 14;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    ctx.beginPath(); ctx.arc(cx, cy, 142, a + 0.05, a + Math.PI / 6 - 0.05); ctx.stroke();
  }

  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, 76, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 200, cy); ctx.lineTo(cx - 40, cy);
  ctx.moveTo(cx + 40, cy); ctx.lineTo(cx + 200, cy);
  ctx.moveTo(cx, cy - 200); ctx.lineTo(cx, cy - 40);
  ctx.moveTo(cx, cy + 40); ctx.lineTo(cx, cy + 200);
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(4, 24, 20, 0.92)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(22, 430, 468, 56, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#a7f3d0';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('[APPROVED IM SITE: VASTUS LATERALIS]', cx, 458);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Mouth target reticle texture
function makeMouthReticleTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  const cx = 256, cy = 240;
  ctx.strokeStyle = '#22d3ee';
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 18;
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(cx, cy, 165, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 5;
  ctx.setLineDash([22, 14]);
  ctx.beginPath(); ctx.arc(cx, cy, 130, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(7, 22, 34, 0.92)';
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(36, 428, 440, 54, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#67e8f9';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('CLICK TO INSPECT ORAL AIRWAY', cx, 455);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Radial pulse wrist target reticle texture
function makeWristReticleTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  const cx = 256, cy = 225;
  ctx.strokeStyle = '#38bdf8';
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 18;
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(cx, cy, 155, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 5;
  ctx.setLineDash([20, 14]);
  ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(7, 22, 34, 0.92)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(36, 428, 440, 54, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#bae6fd';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('[RADIAL PULSE: HOLD WRIST 3s]', cx, 455);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function zone(id, site, radius, pos) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  m.visible = true;
  m.position.copy(pos);
  m.userData.ia = { kind: 'zone', id, site, radius, enabled: true };
  return m;
}

export function buildPatient(phototype = 'VI', patientKey = 'adebayo', onAssetLoaded = null) {
  const baseTone = PHOTOTYPES[phototype] || PHOTOTYPES.VI;
  const tone = { ...baseTone };
  const root = new THREE.Group();
  root.name = 'PatientRoot';

  const chairGroup = new THREE.Group();
  chairGroup.name = 'DentalTreatmentChair';
  root.add(chairGroup);

  const avatarGroup = new THREE.Group();
  avatarGroup.name = 'PatientAvatar';
  root.add(avatarGroup);

  // Interaction zones (both right and left wrists/thighs supported within 0.45m-0.75m seated arm's reach)
  const zones = {
    wrist: zone('wrist', 'wrist', 0.08, V(-0.18, 0.88, -0.44)),
    wristL: zone('wristL', 'wrist', 0.08, V(0.24, 0.88, -0.44)),
    mouth: zone('mouth', 'mouth', 0.10, V(0.08, 0.97, -0.66)),
    thigh: zone('thigh', 'thigh', 0.10, V(-0.14, 0.85, -0.44)),
    thighL: zone('thighL', 'thigh', 0.10, V(0.20, 0.85, -0.44)),
    deltoid: zone('deltoid', 'deltoid', 0.12, V(-0.08, 0.92, -0.52)),
    abdomen: zone('abdomen', 'abdomen', 0.14, V(0.08, 0.85, -0.48)),
  };
  Object.values(zones).forEach((z) => root.add(z));

  // Wrist holographic target reticle
  const wristRing = new THREE.Mesh(
    new THREE.PlaneGeometry(0.20, 0.20),
    new THREE.MeshBasicMaterial({ map: makeWristReticleTexture(), side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
  );
  wristRing.rotation.set(-Math.PI / 4, -0.35, 0);
  wristRing.position.copy(zones.wrist.position);
  wristRing.position.y += 0.04;
  wristRing.renderOrder = 995;
  wristRing.visible = false;
  root.add(wristRing);

  // Thigh holographic target reticle
  const thighRing = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ map: makeThighReticleTexture(), side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
  );
  thighRing.rotation.set(-Math.PI / 4, -0.35, -0.15);
  thighRing.position.copy(zones.thigh.position);
  thighRing.position.y += 0.04;
  thighRing.renderOrder = 995;
  thighRing.visible = false;
  root.add(thighRing);

  // Oral cavity holographic target reticle
  const mouthRing = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.22),
    new THREE.MeshBasicMaterial({ map: makeMouthReticleTexture(), side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
  );
  mouthRing.rotation.set(0.35, -0.38, 0);
  mouthRing.position.set(0.08, 0.98, -0.72);
  mouthRing.renderOrder = 997;
  mouthRing.visible = false;
  root.add(mouthRing);

  const mouth = new THREE.Group();
  mouth.position.copy(zones.mouth.position);
  root.add(mouth);

  const maskMount = new THREE.Group();
  maskMount.position.copy(zones.mouth.position);
  maskMount.position.y += 0.02;
  maskMount.position.z += 0.02;
  root.add(maskMount);

  const mirrorCam = new THREE.PerspectiveCamera(38, 1, 0.02, 3);
  mirrorCam.position.set(0.08, 1.18, -0.52);
  mirrorCam.lookAt(mouth.position);
  root.add(mirrorCam);

  const tongueGeo = new THREE.SphereGeometry(0.018, 24, 16);
  tongueGeo.scale(1.0, 0.45, 1.5);
  const tongueMat = new THREE.MeshStandardMaterial({
    color: tone.tongue,
    roughness: 0.35,
    metalness: 0.05,
    emissive: 0x2a0a0c,
    emissiveIntensity: 0.2,
  });
  const tongueMesh = new THREE.Mesh(tongueGeo, tongueMat);
  tongueMesh.position.set(0, -0.01, 0.03);
  mouth.add(tongueMesh);

  let patientBones = null;
  let headMesh = null;
  let teethMesh = null;
  let skinMaterials = [];
  let isSupine = false;
  let supineAngle = 0;
  let blinkTimer = 0;
  let respPhase = 0;
  let shakeClock = 0;
  let distressElapsed = 0;
  const S_shakePhase = (dt) => { shakeClock += dt * 18; return shakeClock; };
  const sweatDrops = new THREE.Group();
  const sweatDropMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.02, metalness: 0.0,
    clearcoat: 1.0, clearcoatRoughness: 0.01, ior: 1.333, reflectivity: 1.0,
    transparent: true, opacity: 0, depthWrite: false,
  });
  const sweatDropCoords = [
    // Organic scattered [x, y] offsets in Head bone space (raycasted flush onto headMesh surface)
    [-0.034, 0.132], [-0.006, 0.144], [0.022, 0.135], [0.041, 0.124],
    [-0.051, 0.106], [0.046, 0.102], [-0.021, 0.119], [0.014, 0.114],
    [-0.044, 0.064], [0.039, 0.070], [-0.056, 0.086], [0.053, 0.082],
  ];
  const sweatDropMeshes = sweatDropCoords.map(([x, y], idx) => {
    const r = idx % 3 === 0 ? 0.0026 : 0.0018;
    const drop = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), sweatDropMat);
    drop.scale.set(1.0, 1.35, 0.55);
    drop.position.set(x, y, 0.09);
    drop.userData.baseY = y;
    drop.userData.phase = idx * 0.7;
    sweatDrops.add(drop);
    return drop;
  });
  sweatDrops.visible = false;
  // Pre-allocated colors to avoid per-frame GC allocations in update()
  const baseSkinCol = new THREE.Color();
  const flushTintCol = new THREE.Color(0xc83e3b);
  const flushSkinCol = new THREE.Color();
  const paleSkinCol = new THREE.Color(tone.pale);
  const targetSkinCol = new THREE.Color();
  const tongueBaseCol = new THREE.Color(tone.tongue);
  const tongueCyanCol = new THREE.Color(tone.tongueCyan);

  // 1. Load Dental Chair GLB
  const loader = new GLTFLoader();
  loader.load('./public/models/dental_chair.glb', (gltf) => {
    const chair = gltf.scene;
    chair.scale.setScalar(0.01);
    chair.rotation.y = -2.36515;
    chair.position.set(0.25, 0.04, 0.42);

    chair.traverse((child) => {
      const keep = [
        'Object_65', 'Object_66', 'Object_61', 'Object_62',
        'Object_57', 'Object_58', 'Object_47', 'Object_48', 'Object_51',
        'Object_43', 'Object_44', 'Object_39', 'Object_40',
        'Object_15', 'Object_36', 'Object_54',
      ];
      if (child.isMesh) {
        if (!keep.includes(child.name)) {
          child.visible = false;
        } else {
          child.visible = true;
          child.castShadow = true;
          child.receiveShadow = true;
          const origMat = Array.isArray(child.material) ? child.material[0] : child.material;
          const mat = origMat.clone();
          mat.map = null;
          mat.normalMap = null;
          mat.roughnessMap = null;

          if (['Object_15', 'Object_36', 'Object_54'].includes(child.name)) {
            mat.color.setHex(0x1e2f4d);
            mat.roughness = 0.38;
            mat.metalness = 0.06;
            mat.clearcoat = 0.32;
            mat.clearcoatRoughness = 0.24;
          } else if (['Object_65', 'Object_66'].includes(child.name)) {
            mat.color.setHex(0xe2e8f0);
            mat.roughness = 0.16;
            mat.metalness = 0.90;
          } else {
            mat.color.setHex(0xf8fafc);
            mat.roughness = 0.26;
            mat.metalness = 0.06;
          }
          child.material = mat;
        }
      }
    });

    chairGroup.add(chair);
    onAssetLoaded?.('chair');
  }, undefined, (err) => { console.warn('[Patient] Chair GLTF fallback', err); onAssetLoaded?.('chair'); });

  // Ergonomic Chair Armrests
  const navyLeather = new THREE.MeshStandardMaterial({ color: 0x1e2f4d, roughness: 0.38, metalness: 0.06 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.90, roughness: 0.16 });
  for (const s of [-1, 1]) {
    const armRest = new THREE.Mesh(new RoundedBoxGeometry(0.065, 0.035, 0.34, 4, 0.012), navyLeather);
    armRest.position.set(0.08 + s * 0.27, 0.82, -0.22);
    armRest.rotation.x = -0.15;
    chairGroup.add(armRest);
  }

  // 2. Load Patient Avatar GLB (customized per character profile: Adebayo, Patel, Miller, Chen!)
  const charStyle = {
    adebayo: { isMale: false, skinHex: 0x5c3724, paleHex: 0x6b574f, hairTint: 0x2c3038, topCol: 0xbfd8eb, botCol: 0x475569, shoeCol: 0x1e293b, scale: 0.92, pos: [0.08, 0.415, 0.60] },
    patel:   { isMale: true,  skinHex: 0xc28962, paleHex: 0xbba492, hairTint: 0x1e2024, topCol: 0x99d5c9, botCol: 0x475569, shoeCol: 0x1e293b, scale: 0.95, pos: [0.08, 0.405, 0.62] },
    miller:  { isMale: false, skinHex: 0xf0c9ae, paleHex: 0xe4d8ce, hairTint: 0xd8dee6, topCol: 0xd8c4f4, botCol: 0x64748b, shoeCol: 0x334155, scale: 0.90, pos: [0.08, 0.425, 0.58] },
    chen:    { isMale: true,  skinHex: 0xdba982, paleHex: 0xd5bfb0, hairTint: 0x1a1d22, topCol: 0x93c5fd, botCol: 0x334155, shoeCol: 0xe2e8f0, scale: 0.58, pos: [0.08, 0.59, 0.16] },
  }[patientKey] || { isMale: false, skinHex: tone.skin, paleHex: tone.pale, hairTint: 0x2c3038, topCol: 0xbfd8eb, botCol: 0x475569, shoeCol: 0x1e293b, scale: 0.92, pos: [0.08, 0.415, 0.60] };

  tone.skin = charStyle.skinHex;
  tone.pale = charStyle.paleHex;

  loader.load('./public/models/patient.glb', (gltf) => {
    const pModel = gltf.scene;
    pModel.scale.setScalar(charStyle.scale);
    pModel.rotation.set(-1.12, 0, 0);
    pModel.position.set(...charStyle.pos);

    const bones = {};
    pModel.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.morphTargetDictionary) {
          if (o.name.includes('Head')) headMesh = o;
          if (o.name.includes('Teeth')) teethMesh = o;
        }
        if (o.material) {
          o.material = o.material.clone();
          if (o.name.includes('Hair')) {
            if (charStyle.isMale) {
              // Hide women's bob haircut for male characters (Patel & 8yo Master David Chen)
              o.visible = false;
            } else {
              if (patientKey === 'miller' && o.material.map) {
                o.material.map = liftTextureLuminance(o.material.map, 0.42, 0.85);
              }
              o.material.color.setHex(charStyle.hairTint);
              o.material.roughness = 0.74;
              o.material.metalness = 0.04;
            }
          } else if (o.name.includes('Outfit_Top')) {
            if (charStyle.isMale && o.geometry?.attributes?.position) {
              o.geometry = o.geometry.clone();
              const pos = o.geometry.attributes.position;
              for (let i = 0; i < pos.count; i++) {
                const vy = pos.getY(i), vz = pos.getZ(i);
                if (vy > 1.15 && vy < 1.44 && vz > 0.082) {
                  pos.setZ(i, 0.082 + (vz - 0.082) * 0.15);
                }
              }
              pos.needsUpdate = true;
              o.geometry.computeVertexNormals();
            }
            if (patientKey !== 'adebayo' && o.material.map) {
              o.material.map = liftTextureLuminance(o.material.map, 0.65, 0.85);
            }
            o.material.color.setHex(charStyle.topCol);
            o.material.bumpMap = fabricBumpTexture();
            o.material.bumpScale = 0.015;
            o.material.roughness = 0.88;
            o.material.metalness = 0.0;
          } else if (o.name.includes('Outfit_Bottom')) {
            if (patientKey !== 'adebayo' && o.material.map) {
              o.material.map = liftTextureLuminance(o.material.map, 0.65, 0.80);
            }
            o.material.color.setHex(charStyle.botCol);
          } else if (o.name.includes('Footwear')) {
            if (charStyle.isMale) {
              o.visible = false;
            }
          } else if (o.name.includes('Eye')) {
            o.material.color.setHex(0xffffff);
            o.material.roughness = 0.14;
          } else if (o.name.includes('Skin') || o.name.includes('Head') || o.name.includes('Body')) {
            // Preserve Ready Player Me facial detail (brows, lips, pores) while lifting luminance for lighter skin tones
            if (patientKey !== 'adebayo' && o.material.map) {
              const g = patientKey === 'miller' ? 0.36 : 0.46;
              o.material.map = liftTextureLuminance(o.material.map, g, 0.45);
            }
            o.material.color.setHex(charStyle.skinHex);
            o.material.roughness = 0.64;
            o.material.metalness = 0.0;
            o.material.sheen = 0.14;
            o.material.sheenRoughness = 0.62;
            o.material.sheenColor = new THREE.Color(0x8a4a3a);
            skinMaterials.push(o.material);
          }
        }
      }
    });
    patientBones = bones;

    // Clean, well-fitted short cranial hair cap for male patients (no face-covering spheres or floating boxes)
    if (charStyle.isMale && bones.Head) {
      const hairMat = new THREE.MeshStandardMaterial({
        color: charStyle.hairTint,
        bumpMap: fabricBumpTexture(),
        bumpScale: 0.008,
        roughness: 0.84,
        metalness: 0.02,
      });
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.096, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.50),
        hairMat
      );
      crown.scale.set(1.00, 0.98, 1.07);
      crown.position.set(0, 0.094, 0.002);
      crown.rotation.x = -0.14;
      bones.Head.add(crown);
    }

    if (bones.Spine) bones.Spine.rotation.set(-0.08, 0, 0);
    if (bones.Spine1) bones.Spine1.rotation.set(-0.06, 0, 0);
    if (bones.Spine2) {
      bones.Spine2.rotation.set(-0.04, 0, 0);
      // Chrome dental bib neck chain & clips hugging collar cleanly (no floating box!)
      const chainGroup = new THREE.Group();
      const clipL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.022, 0.012), chromeMat);
      clipL.position.set(-0.075, 0.08, 0.105);
      const clipR = clipL.clone();
      clipR.position.x = 0.075;
      chainGroup.add(clipL, clipR);
      bones.Spine2.add(chainGroup);
    }
    if (bones.Neck) bones.Neck.rotation.set(0.22, 0, 0);
    if (bones.Head) {
      bones.Head.rotation.set(0.20, 0, 0);
      mouth.position.set(0, 0.016, 0.040);
      bones.Head.add(mouth);
      bones.Head.add(zones.mouth);
      zones.mouth.position.set(0, 0.02, 0.065);
      bones.Head.add(mouthRing);
      mouthRing.position.set(0, 0.025, 0.095);
      bones.Head.add(maskMount);
      maskMount.position.set(0, 0.026, 0.108);
      maskMount.rotation.set(Math.PI / 2, 0, 0);
      bones.Head.add(sweatDrops);
      if (headMesh) {
        avatarGroup.updateMatrixWorld(true);
        const rc = new THREE.Raycaster();
        const wOrig = new THREE.Vector3(), wTgt = new THREE.Vector3(), wDir = new THREE.Vector3();
        const lPt = new THREE.Vector3(), lOut = new THREE.Vector3();
        sweatDropMeshes.forEach((drop, idx) => {
          const [ox, oy] = sweatDropCoords[idx];
          wOrig.set(ox, oy, 0.25); bones.Head.localToWorld(wOrig);
          wTgt.set(ox * 0.25, oy, 0.0); bones.Head.localToWorld(wTgt);
          wDir.subVectors(wTgt, wOrig).normalize();
          rc.set(wOrig, wDir);
          const hits = rc.intersectObject(headMesh, false);
          if (hits.length) {
            const wPt = hits[0].point.clone();
            if (hits[0].face?.normal) {
              const wNorm = hits[0].face.normal.clone().transformDirection(headMesh.matrixWorld).normalize();
              wPt.addScaledVector(wNorm, 0.0012);
              lOut.copy(wPt).add(wNorm);
              bones.Head.worldToLocal(lOut);
            }
            lPt.copy(wPt);
            bones.Head.worldToLocal(lPt);
            drop.position.copy(lPt);
            drop.userData.baseY = lPt.y;
            if (hits[0].face?.normal) drop.lookAt(lOut);
          }
        });
      }
    }

    if (headMesh) headMesh.userData.ia = zones.mouth.userData.ia;
    if (teethMesh) teethMesh.userData.ia = zones.mouth.userData.ia;

    if (bones.LeftUpLeg) bones.LeftUpLeg.rotation.set(-0.40, 0, Math.PI - 0.04);
    if (bones.RightUpLeg) bones.RightUpLeg.rotation.set(-0.40, 0, -Math.PI + 0.04);
    if (bones.LeftLeg) bones.LeftLeg.rotation.set(-0.14, 0, 0);
    if (bones.RightLeg) bones.RightLeg.rotation.set(-0.14, 0, 0);
    if (bones.LeftFoot) bones.LeftFoot.rotation.set(1.04, 0, 0);
    if (bones.RightFoot) bones.RightFoot.rotation.set(1.04, 0, 0);
    if (charStyle.isMale) {
      const sneakerMat = new THREE.MeshStandardMaterial({ color: charStyle.shoeCol, roughness: 0.72 });
      const soleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
      for (const footBone of [bones.LeftFoot, bones.RightFoot]) {
        if (!footBone) continue;
        const shoe = new THREE.Group();
        const upper = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.24, 0.075, 3, 0.022), sneakerMat);
        upper.position.set(0, 0.075, 0.012);
        const sole = new THREE.Mesh(new RoundedBoxGeometry(0.116, 0.25, 0.024, 2, 0.008), soleMat);
        sole.position.set(0, 0.075, -0.026);
        shoe.add(sole, upper);
        footBone.add(shoe);
      }
    }

    if (bones.LeftShoulder) bones.LeftShoulder.rotation.z = -1.75;
    if (bones.RightShoulder) bones.RightShoulder.rotation.z = 1.75;
    if (bones.LeftArm) bones.LeftArm.rotation.set(1.08, 0.10, 0.04);
    if (bones.LeftForeArm) bones.LeftForeArm.rotation.set(0.62, 0, 0.28);
    if (bones.RightArm) bones.RightArm.rotation.set(1.08, -0.10, -0.04);
    if (bones.RightForeArm) bones.RightForeArm.rotation.set(0.62, 0, -0.28);
    if (bones.LeftHand) bones.LeftHand.rotation.set(0.14, -0.24, 0);
    if (bones.RightHand) bones.RightHand.rotation.set(0.14, 0.24, 0);

    // Fingertip Pulse Oximeter sensor on right index finger
    if (bones.RightHand) {
      const oximeter = new THREE.Group();
      const oxBody = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.016, 0.036, 2, 0.003), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }));
      const oxScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.024), new THREE.MeshBasicMaterial({ color: 0x0ea5e9 }));
      oxScreen.rotation.x = -Math.PI / 2; oxScreen.position.y = 0.0085;
      oximeter.add(oxBody, oxScreen);
      oximeter.position.set(0, 0.04, 0.01);
      bones.RightHand.add(oximeter);
    }

    for (const m of [headMesh, teethMesh]) {
      setMorph(m, 'mouthOpen', 0.08);
      setMorph(m, 'eyeBlinkLeft', 0.16);
      setMorph(m, 'eyeBlinkRight', 0.16);
      setMorph(m, 'eyeSquintLeft', 0.16);
      setMorph(m, 'eyeSquintRight', 0.16);
      setMorph(m, 'eyeLookDownLeft', 0.18);
      setMorph(m, 'eyeLookDownRight', 0.18);
    }

    avatarGroup.add(pModel);
    onAssetLoaded?.('patient');
  }, undefined, (err) => { console.warn('[Patient] Avatar GLTF fallback', err); onAssetLoaded?.('patient'); });

  // Widescreen Panoramic AR Visor for Intra-Oral Endoscopy & Lumen Diameter Telemetry (768x480)
  function drawOralEndoscopy(ctx, w, h, vitals, time = 0) {
    const swell = vitals?.swelling ?? 0.45;
    const cyan = vitals?.cyanosis ?? 0.15;
    const rr = vitals?.rr ?? 22;
    const breath = Math.sin(time * (rr / 60) * Math.PI * 2) * 5;

    ctx.clearRect(0, 0, w, h);

    // Deep HUD glass visor background
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#061520');
    bgGrad.addColorStop(1, '#030b12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle medical telemetry grid
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.055)';
    ctx.lineWidth = 1;
    for (let g = 0; g < w; g += 28) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, h); ctx.stroke(); }
    for (let g = 0; g < h; g += 28) { ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(w, g); ctx.stroke(); }

    // Oral cavity positioned cleanly on the right 62% of the widescreen visor (zero HUD overlap!)
    const cx = w * 0.65, cy = h * 0.47, r = h * 0.39;

    // 1. Perioral Cheek & Lip Cushion
    const skinHex = phototype === 'VI' ? '#4a2c1d' : phototype === 'IV' ? '#9e6b47' : '#dfa885';
    const skinGrad = ctx.createRadialGradient(cx, cy, r * 0.65, cx, cy, r * 1.22);
    skinGrad.addColorStop(0, skinHex);
    skinGrad.addColorStop(0.88, skinHex);
    skinGrad.addColorStop(1, '#040d14');
    ctx.fillStyle = skinGrad;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.15, r * 1.08, 0, 0, Math.PI * 2); ctx.fill();

    // Edematous Vermilion Border (Upper & Lower Lips)
    const lipBase = cyan > 0.3 ? '#634b58' : (phototype === 'VI' ? '#7d3c39' : '#c25e5e');
    const lipHi = cyan > 0.3 ? '#8c7382' : '#e89292';
    const lipGrad = ctx.createRadialGradient(cx, cy + 8, r * 0.62, cx, cy, r * 1.04);
    lipGrad.addColorStop(0, '#360c14');
    lipGrad.addColorStop(0.58, lipBase);
    lipGrad.addColorStop(0.84, lipHi);
    lipGrad.addColorStop(1, skinHex);
    ctx.fillStyle = lipGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.98, r * (0.90 + swell * 0.08), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    // Mouth opening clip
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.80, r * 0.72, 0, 0, Math.PI * 2);
    ctx.clip();

    // 2. Deep Posterior Oropharynx
    const pharGrad = ctx.createRadialGradient(cx, cy - 10 + breath * 0.4, 6, cx, cy, r * 0.82);
    pharGrad.addColorStop(0, '#0d0204');
    pharGrad.addColorStop(0.35, cyan > 0.3 ? '#3b1c2e' : '#4a101c');
    pharGrad.addColorStop(0.75, cyan > 0.3 ? '#694056' : '#942f3f');
    pharGrad.addColorStop(1, cyan > 0.3 ? '#573346' : '#78202f');
    ctx.fillStyle = pharGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // 3. Soft Palate, Palatoglossal Arches & Edematous Uvula
    const palGrad = ctx.createLinearGradient(cx, cy - r * 0.72, cx, cy + 12);
    palGrad.addColorStop(0, cyan > 0.3 ? '#85586f' : '#cc5e6e');
    palGrad.addColorStop(0.6, cyan > 0.3 ? '#6e4359' : '#ab3e4f');
    palGrad.addColorStop(1, '#4a121d');
    ctx.fillStyle = palGrad;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.85, cy + 18);
    ctx.quadraticCurveTo(cx - r * 0.52, cy - r * 0.50, cx - 20, cy - r * 0.30 + swell * 14);
    ctx.quadraticCurveTo(cx, cy - r * 0.02 + swell * 32 + breath * 0.5, cx + 20, cy - r * 0.30 + swell * 14);
    ctx.quadraticCurveTo(cx + r * 0.52, cy - r * 0.50, cx + r * 0.85, cy + 18);
    ctx.lineTo(cx + r, cy - r);
    ctx.lineTo(cx - r, cy - r);
    ctx.closePath();
    ctx.fill();

    // 4. Maxillary Gingiva & CONTIGUOUS Anatomical Upper Dental Arch (touching side-by-side, zero Chiclets gaps!)
    ctx.fillStyle = cyan > 0.3 ? '#80596d' : '#d46878';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.12, r * 0.82, r * 0.65, 0, Math.PI * 1.04, Math.PI * 1.96);
    ctx.lineTo(cx + r, cy - r);
    ctx.lineTo(cx - r, cy - r);
    ctx.closePath();
    ctx.fill();

    // Contiguous Upper Teeth (Central Incisors, Lateral Incisors, Canines, Premolars)
    const uArch = [
      { x: -96,  y: -46, w: 26, h: 30, rot: -0.34 },
      { x: -75,  y: -59, w: 27, h: 33, rot: -0.24 },
      { x: -53,  y: -70, w: 29, h: 37, rot: -0.15 },
      { x: -31,  y: -78, w: 30, h: 39, rot: -0.08 },
      { x: -11,  y: -82, w: 31, h: 42, rot: -0.02 },
      { x:  11,  y: -82, w: 31, h: 42, rot:  0.02 },
      { x:  31,  y: -78, w: 30, h: 39, rot:  0.08 },
      { x:  53,  y: -70, w: 29, h: 37, rot:  0.15 },
      { x:  75,  y: -59, w: 27, h: 33, rot:  0.24 },
      { x:  96,  y: -46, w: 26, h: 30, rot:  0.34 },
    ];
    const sF = r / 155;
    for (const t of uArch) {
      const tw = t.w * sF, th = t.h * sF;
      ctx.save();
      ctx.translate(cx + t.x * sF, cy + t.y * sF);
      ctx.rotate(t.rot);
      const eg = ctx.createLinearGradient(0, -th / 2, 0, th / 2);
      eg.addColorStop(0, '#d8ceb8');
      eg.addColorStop(0.25, '#f7f4e8');
      eg.addColorStop(0.75, '#ffffff');
      eg.addColorStop(1, '#e6e0d0');
      ctx.fillStyle = eg;
      ctx.strokeStyle = 'rgba(130, 115, 95, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-tw / 2, -th / 2, tw, th, [4, 4, 9, 9]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 5. Voluminous 3D Edematous Tongue with Vascular Sublingual Cyanosis & Filiform Papillae
    const tLift = swell * r * 0.34 - breath * 0.5;
    const tCenterY = cy + r * 0.30 - tLift;
    const tRx = r * (0.68 + swell * 0.11);
    const tRy = r * (0.47 + swell * 0.15);

    const tongueGrad = ctx.createRadialGradient(cx - 10, tCenterY - 14, 10, cx, tCenterY, tRx);
    tongueGrad.addColorStop(0, cyan > 0.2 ? '#a88ca8' : '#e88e9c');
    tongueGrad.addColorStop(0.42, cyan > 0.2 ? '#846282' : '#d15e71');
    tongueGrad.addColorStop(0.85, cyan > 0.2 ? '#5c3c58' : '#9c3547');
    tongueGrad.addColorStop(1, '#47121e');
    ctx.fillStyle = tongueGrad;
    ctx.beginPath();
    ctx.ellipse(cx, tCenterY, tRx, tRy, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fine lingual papillae stippling
    ctx.fillStyle = 'rgba(255, 225, 235, 0.15)';
    for (let i = 0; i < 110; i++) {
      const a = (i * 137.5) % (Math.PI * 2);
      const d = Math.sqrt((i + 1) / 110) * 0.84;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * tRx * d, tCenterY + Math.sin(a) * tRy * d, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Median lingual sulcus
    ctx.strokeStyle = 'rgba(70, 18, 32, 0.38)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, tCenterY - tRy * 0.78);
    ctx.quadraticCurveTo(cx + 2, tCenterY, cx, tCenterY + tRy * 0.62);
    ctx.stroke();

    // Wet saliva highlights
    ctx.fillStyle = 'rgba(255, 250, 252, 0.32)';
    ctx.beginPath();
    ctx.ellipse(cx - tRx * 0.25, tCenterY - tRy * 0.18, tRx * 0.20, tRy * 0.12, -0.2, 0, Math.PI * 2);
    ctx.ellipse(cx + tRx * 0.24, tCenterY - tRy * 0.14, tRx * 0.15, tRy * 0.09, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 6. Contiguous Mandibular (Lower) Teeth Arch
    const lArch = [
      { x: -72, y: 68, w: 23, h: 25, rot:  0.26 },
      { x: -53, y: 78, w: 23, h: 27, rot:  0.18 },
      { x: -35, y: 84, w: 23, h: 28, rot:  0.10 },
      { x: -17, y: 88, w: 22, h: 29, rot:  0.04 },
      { x:   0, y: 89, w: 22, h: 29, rot:  0.00 },
      { x:  17, y: 88, w: 22, h: 29, rot: -0.04 },
      { x:  35, y: 84, w: 23, h: 28, rot: -0.10 },
      { x:  53, y: 78, w: 23, h: 27, rot: -0.18 },
      { x:  72, y: 68, w: 23, h: 25, rot: -0.26 },
    ];
    for (const t of lArch) {
      const tw = t.w * sF, th = t.h * sF;
      ctx.save();
      ctx.translate(cx + t.x * sF, cy + t.y * sF);
      ctx.rotate(t.rot);
      ctx.fillStyle = '#f5f2e6';
      ctx.strokeStyle = 'rgba(130, 115, 95, 0.55)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.roundRect(-tw / 2, -th / 2, tw, th, [7, 7, 3, 3]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 7. Dental Mirror Loupe & Handle inside Oral Cavity
    const mCx = cx - 4, mCy = cy - r * 0.22, mR = 34;
    ctx.fillStyle = 'rgba(186, 230, 253, 0.14)';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(mCx, mCy, mR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(mCx + mR, mCy + 5); ctx.lineTo(cx + r * 0.95, mCy + 32); ctx.stroke();

    ctx.restore();

    // Cyan AR targeting arc around mouth
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.05, Math.PI * 0.72, Math.PI * 1.28);
    ctx.stroke();

    // 8. Left-Side Telemetry Column (Cleanly separated on the left 34% of the widescreen visor — zero lip overlap!)
    const lx = 20, lw = w * 0.34;
    ctx.fillStyle = 'rgba(9, 30, 42, 0.90)';
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.roundRect(lx, 20, lw, 108, 10); ctx.fill(); ctx.stroke();

    const isClear = swell < 0.1;
    ctx.fillStyle = isClear ? '#34d399' : '#f43f5e';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(isClear ? '• AIRWAY PATENT' : '• AIRWAY AT RISK', lx + 14, 44);
    ctx.fillStyle = '#e8f6fb';
    ctx.font = '700 13.5px system-ui, sans-serif';
    ctx.fillText(isClear ? 'NO TONGUE OR LIP SWELLING' : 'SWOLLEN TONGUE & LIPS', lx + 14, 68);
    ctx.fillText(isClear ? 'ORAL MUCOSA NORMAL' : 'THROAT SWELLING', lx + 14, 90);
    ctx.fillStyle = isClear ? '#6ee7b7' : '#67e8f9';
    ctx.font = '600 11.5px ui-monospace, monospace';
    ctx.fillText(isClear ? 'AIRWAY SWELLING: NONE' : 'AIRWAY SWELLING: SEVERE', lx + 14, 112);

    // Lumen Diameter Gauge Card
    const lumenMm = isClear ? '14.5' : Math.max(2.1, 4.8 - swell * 2.2).toFixed(1);
    ctx.fillStyle = 'rgba(9, 30, 42, 0.90)';
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
    ctx.beginPath(); ctx.roundRect(lx, 142, lw, 168, 10); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#8fb3c2';
    ctx.font = '700 12.5px system-ui, sans-serif';
    ctx.fillText('LUMEN DIAMETER', lx + 14, 168);

    const gCx = lx + lw / 2, gCy = 248, gR = 56;
    ctx.strokeStyle = 'rgba(143,179,194,0.22)';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(gCx, gCy, gR, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
    ctx.strokeStyle = isClear ? '#34d399' : '#22d3ee';
    ctx.beginPath(); ctx.arc(gCx, gCy, gR, Math.PI * 1.12, Math.PI * (1.12 + (1 - swell * 0.65) * 0.76)); ctx.stroke();

    ctx.fillStyle = isClear ? '#34d399' : '#f43f5e';
    ctx.font = '800 28px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${lumenMm}mm`, gCx, 262);
    ctx.fillStyle = isClear ? '#a7f3d0' : '#fda4af';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText(isClear ? 'NORMAL > 12.0mm • AIRWAY CLEAR' : 'NORMAL > 12.0mm • STRIDOR RISK', gCx, 290);

    // Bottom Finding + NEXT button
    ctx.fillStyle = 'rgba(10, 32, 46, 0.96)';
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(20, h - 54, w - 40, 40, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = swell > 0.05 ? '#fda4af' : '#a7f3d0';
    ctx.font = '700 15px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(swell > 0.05 ? 'FINDING: SWOLLEN TONGUE & THROAT' : 'FINDING: CLEAR ORAL AIRWAY', 40, h - 34);

    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.roundRect(w - 156, h - 49, 126, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#04222b';
    ctx.font = '800 15px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT →', w - 93, h - 33);
  }

  return {
    root,
    chairGroup,
    zones,
    wristRing,
    thighRing,
    mouthRing,
    maskMount,
    mirrorCam,
    mouth,
    tone,
    drawOralEndoscopy,
    get headMesh() { return headMesh; },
    get teethMesh() { return teethMesh; },
    setSupine() {
      isSupine = true;
    },
    reset(baselineVitals = { hr: 78, sbp: 122, dbp: 78, spo2: 98, rr: 15, swelling: 0, cyanosis: 0, sweat: 0 }) {
      isSupine = false;
      supineAngle = 0;
      distressElapsed = 0;
      sweatDrops.visible = false;
      sweatDropMat.opacity = 0;
      respPhase = 0;
      blinkTimer = 0;
      chairGroup.rotation.x = 0;
      avatarGroup.rotation.x = 0;
      wristRing.visible = false;
      thighRing.visible = false;
      mouthRing.visible = false;
      if (patientBones?.LeftHand) patientBones.LeftHand.rotation.z = 0;
      if (patientBones?.RightHand) patientBones.RightHand.rotation.z = 0;
      if (patientBones?.LeftShoulder) patientBones.LeftShoulder.rotation.z = -1.75;
      if (patientBones?.RightShoulder) patientBones.RightShoulder.rotation.z = 1.75;
      if (patientBones?.Spine1) patientBones.Spine1.scale.set(1, 1, 1);
      if (patientBones?.Spine2) patientBones.Spine2.rotation.set(-0.04, 0, 0);
      if (patientBones?.Head) patientBones.Head.rotation.set(0.20, 0, 0);
      if (headMesh) headMesh.scale.set(1, 1, 1);
      for (const m of [headMesh, teethMesh]) {
        setMorph(m, 'mouthOpen', 0.08);
        setMorph(m, 'eyeBlinkLeft', 0.16);
        setMorph(m, 'eyeBlinkRight', 0.16);
        setMorph(m, 'eyeSquintLeft', 0.16);
        setMorph(m, 'eyeSquintRight', 0.16);
        setMorph(m, 'eyeLookDownLeft', 0.18);
        setMorph(m, 'eyeLookDownRight', 0.18);
      }
      this.update(baselineVitals, 0, false);
    },
    update(vitals, dt, inDistress, isRecovered = false) {
      const rr = vitals.rr || 0;
      const swell = vitals.swelling || 0;
      const sweat = vitals.sweat || 0;
      const cyan = vitals.cyanosis || 0;
      const distressFactor = rr > 0 ? Math.min(1, Math.max(0, (rr - 14) / 18)) : 0;

      // Rapid accessory-muscle chest heave in acute respiratory distress vs. calm tidal breathing on recovery
      respPhase += dt * (rr / 60) * Math.PI * 2;
      const chestAmp = rr > 0 ? (0.020 + distressFactor * 0.055) : 0;
      const breathWave = Math.sin(respPhase);
      const respScale = 1.0 + breathWave * chestAmp;
      if (patientBones?.Spine1) {
        patientBones.Spine1.scale.set(respScale, 1.0, respScale * (1.0 + chestAmp * 0.4));
      }
      if (patientBones?.Spine2) {
        patientBones.Spine2.rotation.x = -0.04 - Math.max(0, breathWave) * distressFactor * 0.065;
      }
      if (patientBones?.LeftShoulder && patientBones?.RightShoulder) {
        const shLift = Math.max(0, breathWave) * distressFactor * 0.05;
        patientBones.LeftShoulder.rotation.z = -1.75 + shLift;
        patientBones.RightShoulder.rotation.z = 1.75 - shLift;
      }

      if (wristRing.visible) {
        wristRing.material.opacity = 0.78 + Math.sin(respPhase * 2.5) * 0.22;
      }
      if (mouthRing.visible) {
        mouthRing.material.opacity = 0.75 + Math.sin(respPhase * 2.5) * 0.25;
      }
      if (thighRing.visible) {
        thighRing.material.opacity = 0.80 + Math.sin(respPhase * 2.5) * 0.20;
      }

      // Agitation tremor & air-hunger head restlessness during distress; smooth relaxation post-Adrenaline/O2
      // Delayed onset (~3.5s) so newly seated patients start calm; clamped upward/lateral so hands never clip into thighs
      if (inDistress && !isRecovered) distressElapsed += dt;
      else distressElapsed = 0;
      const tremorRamp = Math.min(1, Math.max(0, (distressElapsed - 3.5) / 2.5));
      if (patientBones?.LeftHand && patientBones?.RightHand) {
        if (inDistress && !isRecovered && tremorRamp > 0) {
          const isTremor = sweat > 0.35 && swell < 0.1;
          const amp = (isTremor ? 0.055 : 0.028 + distressFactor * 0.028) * tremorRamp;
          const wave = Math.sin(respPhase * (isTremor ? 10.5 : 5.5) + S_shakePhase(dt));
          // Positive z on LeftHand / negative z on RightHand lifts away from thighs; never flex downward into legs
          const upLift = (0.5 + 0.5 * wave) * amp;
          const lat = wave * amp * 0.65;
          patientBones.LeftHand.rotation.z = upLift;
          patientBones.RightHand.rotation.z = -upLift;
          patientBones.LeftHand.rotation.y = -0.24 + lat;
          patientBones.RightHand.rotation.y = 0.24 - lat;
        } else {
          const kCalm = Math.min(1, dt * 6);
          patientBones.LeftHand.rotation.z += (0 - patientBones.LeftHand.rotation.z) * kCalm;
          patientBones.RightHand.rotation.z += (0 - patientBones.RightHand.rotation.z) * kCalm;
          patientBones.LeftHand.rotation.y += (-0.24 - patientBones.LeftHand.rotation.y) * kCalm;
          patientBones.RightHand.rotation.y += (0.24 - patientBones.RightHand.rotation.y) * kCalm;
        }
      }
      if (patientBones?.Head) {
        const targetHeadZ = (inDistress && !isRecovered) ? Math.sin(respPhase * 1.1) * (0.035 + distressFactor * 0.04) : 0;
        patientBones.Head.rotation.z += (targetHeadZ - patientBones.Head.rotation.z) * Math.min(1, dt * 4);
      }
      if (patientBones?.Spine2) {
        const heave = (inDistress && !isRecovered) ? Math.sin(respPhase * 1.6) * (0.025 + distressFactor * 0.035) : 0;
        patientBones.Spine2.rotation.x = -0.04 + heave;
      }

      if (isSupine && supineAngle < 0.22) {
        supineAngle += dt * 0.35;
        chairGroup.rotation.x = -supineAngle;
        avatarGroup.rotation.x = -supineAngle;
      }

      // Histamine facial flushing (erythema), diaphoretic sheen, and hypoxic cyanosis -> resolves to healthy tone
      const flush = Math.min(1, swell * 1.25);
      baseSkinCol.setHex(charStyle.skinHex);
      flushSkinCol.copy(baseSkinCol).lerp(flushTintCol, 0.62);
      targetSkinCol.copy(baseSkinCol).lerp(flushSkinCol, flush * (1 - cyan * 0.45)).lerp(paleSkinCol, cyan * 0.72);
      for (const mat of skinMaterials) {
        mat.clearcoat = sweat * 0.90;
        mat.clearcoatRoughness = 0.20;
        mat.roughness = Math.max(0.22, 0.68 - sweat * 0.44);
        mat.color.copy(targetSkinCol);
      }
      const dropLevel = Math.min(1, Math.max(0, (sweat - 0.22) / 0.65));
      sweatDrops.visible = dropLevel > 0.02;
      sweatDropMat.opacity = dropLevel * 0.56;
      if (sweatDrops.visible) {
        for (let i = 0; i < sweatDropMeshes.length; i++) {
          const d = sweatDropMeshes[i];
          const trickle = ((respPhase * 0.08 + d.userData.phase) % 1) * 0.008 * dropLevel;
          d.position.y = d.userData.baseY - (i % 3 === 0 ? trickle : 0);
        }
      }

      // Facial / perioral angioedema swelling & tongue edema
      if (headMesh) {
        headMesh.scale.set(1 + swell * 0.085, 1 + swell * 0.030, 1 + swell * 0.085);
      }
      tongueMesh.scale.set(0.95 + swell * 0.85, 0.35 + swell * 0.55, 1.15 + swell * 0.70);
      tongueMat.color.lerpColors(tongueBaseCol, tongueCyanCol, cyan);

      const targetMouth = (inDistress && !isRecovered) ? (swell > 0.1 ? 0.58 : 0.28) : isRecovered ? 0.14 : 0.08;
      const mouthAlpha = Math.min(1, dt * 5);
      lerpMorph(headMesh, 'mouthOpen', targetMouth, mouthAlpha);
      lerpMorph(teethMesh, 'mouthOpen', targetMouth, mouthAlpha);
      lerpMorph(headMesh, 'browInnerUp', (inDistress && !isRecovered) ? 0.52 : 0.04, Math.min(1, dt * 3));

      // Natural blinking & relaxed eyelids (reduces wide-eyed stare)
      blinkTimer += dt;
      let blinkVal = 0.16;
      if (blinkTimer > 3.4) {
        const bPhase = (blinkTimer - 3.4) / 0.22;
        if (bPhase < 1) {
          blinkVal = 0.16 + Math.sin(bPhase * Math.PI) * 0.80;
        } else {
          blinkTimer = 0;
        }
      }
      setMorph(headMesh, 'eyeBlinkLeft', blinkVal);
      setMorph(headMesh, 'eyeBlinkRight', blinkVal);
      setMorph(headMesh, 'eyesClosed', Math.max(0, blinkVal - 0.10));
      lerpMorph(headMesh, 'browInnerUp', (inDistress && !isRecovered) ? 0.28 : 0.04, Math.min(1, dt * 3));

      if (patientBones?.RightHand) {
        patientBones.RightHand.getWorldPosition(zones.wrist.position);
        zones.wrist.position.y += 0.02;
        wristRing.position.copy(zones.wrist.position);
        wristRing.position.y += 0.04;
      }
      if (patientBones?.LeftHand) {
        patientBones.LeftHand.getWorldPosition(zones.wristL.position);
        zones.wristL.position.y += 0.02;
      }
      if (patientBones?.RightUpLeg) {
        patientBones.RightUpLeg.getWorldPosition(zones.thigh.position);
        if (patientBones.RightLeg) {
          const knee = V(0, 0, 0);
          patientBones.RightLeg.getWorldPosition(knee);
          zones.thigh.position.lerp(knee, 0.56);
        }
        zones.thigh.position.x -= 0.06;
        zones.thigh.position.y += 0.04;
        thighRing.position.copy(zones.thigh.position);
        thighRing.position.y += 0.055;
      }
      if (patientBones?.LeftUpLeg) {
        patientBones.LeftUpLeg.getWorldPosition(zones.thighL.position);
        if (patientBones.LeftLeg) {
          const kneeL = V(0, 0, 0);
          patientBones.LeftLeg.getWorldPosition(kneeL);
          zones.thighL.position.lerp(kneeL, 0.56);
        }
        zones.thighL.position.x += 0.055;
        zones.thighL.position.y += 0.04;
      }
    },
  };
}

export function buildNurse(onAssetLoaded = null) {
  const g = new THREE.Group();
  g.name = 'DentalNurseSarah';

  let nodTimer = 0;
  let idleTime = 0;
  let nurseBones = null;

  g.userData.nod = () => { nodTimer = 0.8; };
  g.userData.reset = () => {
    nodTimer = 0;
    idleTime = 0;
    if (nurseBones?.Head) nurseBones.Head.rotation.set(0.16, -0.34, -0.04);
    if (nurseBones?.Spine) nurseBones.Spine.rotation.set(0.06, -0.05, 0);
    if (nurseBones?.Spine1) nurseBones.Spine1.rotation.set(0.08, -0.05, 0);
  };
  g.userData.update = (dt) => {
    idleTime += dt;
    if (nurseBones?.Spine) {
      nurseBones.Spine.rotation.x = 0.06 + Math.sin(idleTime * 1.4) * 0.012;
    }
    if (nurseBones?.Spine1) {
      nurseBones.Spine1.rotation.x = 0.08 + Math.sin(idleTime * 1.4 + 0.5) * 0.010;
    }
    if (nurseBones?.RightArm) {
      nurseBones.RightArm.rotation.x = 0.98 + Math.sin(idleTime * 1.1) * 0.012;
    }
    if (nodTimer > 0) {
      nodTimer -= dt;
      if (nurseBones?.Head) {
        const p = Math.sin(((0.8 - nodTimer) / 0.8) * Math.PI * 2);
        nurseBones.Head.rotation.x = 0.16 + p * 0.22;
      }
    }
  };

  const loader = new GLTFLoader();
  loader.load('./public/models/assistant_female.glb', (gltf) => {
    const nurse = gltf.scene;
    nurse.scale.setScalar(0.81);
    // Grounded 100% on the floor at Y = 0 (zero floor clipping!)
    nurse.position.set(0, 0, 0);
    nurse.rotation.y = 0.42;

    const bones = {};
    nurse.traverse((child) => {
      if (child.name === 'Wolf3D_Glasses') {
        child.visible = false;
      }
      if (child.isBone) bones[child.name] = child;
      if (child.isMesh && child.material) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mat = child.material.clone();
        if (child.name.includes('Outfit_Top') || child.name.includes('Outfit_Bottom')) {
          mat.map = null;
          mat.normalMap = null;
          mat.roughnessMap = null;
          mat.color.setHex(0x0d9488);
          mat.roughness = 0.72;
          mat.metalness = 0.0;
        } else if (child.name.includes('Footwear')) {
          mat.map = null;
          mat.normalMap = null;
          mat.color.setHex(0xf8fafc);
          mat.roughness = 0.4;
        } else if (child.name.includes('Body')) {
          mat.map = null;
          mat.color.setHex(0xf2cfb8);
          mat.roughness = 0.52;
          mat.metalness = 0.0;
        }
        child.material = mat;
      }
    });
    nurseBones = bones;

    if (bones.Head) {
      bones.Head.rotation.set(0.16, -0.34, -0.04);
    }
    if (bones.Spine2) {
      // Clinical NHS/Hospital ID badge on scrub chest pocket
      const badge = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, 0.058, 0.004),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
      );
      badge.position.set(0.065, 0.04, 0.115);
      const badgeHeader = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, 0.014, 0.005),
        new THREE.MeshBasicMaterial({ color: 0x0284c7 })
      );
      badgeHeader.position.set(0.065, 0.062, 0.116);
      bones.Spine2.add(badge, badgeHeader);
    }

    // Relaxed, natural chairside posture leaning softly toward patient
    if (bones.Spine) bones.Spine.rotation.set(0.06, -0.05, 0);
    if (bones.Spine1) bones.Spine1.rotation.set(0.08, -0.05, 0);
    if (bones.Spine2) bones.Spine2.rotation.set(0.05, -0.04, 0);
    if (bones.LeftArm) bones.LeftArm.rotation.set(1.02, 0.12, -0.14);
    if (bones.LeftForeArm) bones.LeftForeArm.rotation.set(0.42, 0, 0.18);
    if (bones.RightArm) bones.RightArm.rotation.set(0.98, -0.18, 0.16);
    if (bones.RightForeArm) bones.RightForeArm.rotation.set(0.55, 0, -0.24);
    if (bones.RightHand) bones.RightHand.rotation.set(0.08, 0, 0);

    if (bones.RightHand) {
      const suctionWand = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.18, 12), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 }));
      suctionWand.position.set(0, 0.05, 0.04);
      suctionWand.rotation.x = Math.PI / 3;
      bones.RightHand.add(suctionWand);
    }

    g.add(nurse);
    onAssetLoaded?.('nurse');
  }, undefined, (err) => { console.warn('[Nurse] GLTF fallback', err); onAssetLoaded?.('nurse'); });

  return g;
}
