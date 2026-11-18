/**
 * HumanGenerator.js
 * 
 * Multi-Disciplinary 3D Human Character Generator for PEARLSIM.
 * Supports Medical (ER), Nursing (Ward/ICU), Paramedic (EMS), and Dental emergency training.
 * 
 * Generates:
 * 1. Clinical Patient (Alex): Seated/semi-recumbent with realistic anatomical face,
 *    blinking eyes, brown hair, hospital gown / clinical attire with ECG monitoring leads,
 *    pulse oximeter, physiological diaphoresis (sweat sheen), breathing, and tremors.
 * 2. Clinical Assistant: Healthcare professional in scrubs and nitrile gloves.
 */

import * as THREE from 'three';
import { ClinicalStates } from '../core/ClinicalStateMachine.js';

export class HumanGenerator {
  static createPatientCharacter(discipline = 'MEDICAL') {
    const root = new THREE.Group();
    root.name = 'PatientCharacter_Alex';

    // Skin Material with PBR properties for sweating clamminess
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf5cdb0,
      roughness: 0.55,
      metalness: 0.05
    });
    root.userData.skinMat = skinMat;

    const lipsMat = new THREE.MeshStandardMaterial({ color: 0xd98275, roughness: 0.4 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.85 });
    
    // Universal Hospital Patient Gown Material (Medical Teal / Light Hospital Blue)
    const gownMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.8,
      side: THREE.DoubleSide
    });

    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
    const shoesMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

    // 1. Torso Group
    const torsoGroup = new THREE.Group();
    torsoGroup.name = 'Patient_TorsoGroup';
    torsoGroup.position.set(0, 0.72, -0.15);
    torsoGroup.rotation.x = -0.30;

    // Chest & Upper Torso (Patient Gown)
    const chestGeo = new THREE.BoxGeometry(0.38, 0.42, 0.22);
    const chestMesh = new THREE.Mesh(chestGeo, gownMat);
    chestMesh.position.set(0, 0.20, 0);
    torsoGroup.add(chestMesh);
    root.userData.chestMesh = chestMesh;

    // Pelvis
    const pelvisGeo = new THREE.BoxGeometry(0.36, 0.28, 0.20);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, gownMat);
    pelvisMesh.position.set(0, -0.12, 0);
    torsoGroup.add(pelvisMesh);

    // ECG Telemetry Electrodes on Chest (RA, LA, LL leads for Lead II monitoring)
    const leadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    const leads = [
      { x: -0.12, y: 0.30, z: 0.114, label: 'RA' }, // Right Arm lead (White)
      { x: 0.12, y: 0.30, z: 0.114, label: 'LA' },  // Left Arm lead (Black)
      { x: 0.10, y: 0.10, z: 0.114, label: 'LL' }   // Left Leg lead (Red)
    ];

    leads.forEach(ld => {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.016, 16), leadMat);
      pad.position.set(ld.x, ld.y, ld.z);
      torsoGroup.add(pad);

      const snap = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.006, 12), wireMat);
      snap.rotation.x = Math.PI / 2;
      snap.position.set(ld.x, ld.y, ld.z + 0.004);
      torsoGroup.add(snap);
    });

    // Optional Dental Bib node (only visible if dental discipline selected)
    const bibMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7, side: THREE.DoubleSide });
    const bibMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), bibMat);
    bibMesh.position.set(0, 0.20, 0.116);
    bibMesh.visible = (discipline === 'DENTAL');
    torsoGroup.add(bibMesh);
    root.userData.bibMesh = bibMesh;

    // 2. Head & Articulated Neck
    const neckGroup = new THREE.Group();
    neckGroup.position.set(0, 0.42, 0.02);

    const neckGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.10, 16);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.set(0, 0.04, 0);
    neckGroup.add(neckMesh);

    const headGroup = new THREE.Group();
    headGroup.name = 'Patient_Head';
    headGroup.position.set(0, 0.14, 0);

    // Cranium / Face Base
    const headGeo = new THREE.SphereGeometry(0.115, 32, 24);
    headGeo.scale(0.92, 1.18, 0.98);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.set(0, 0.06, 0);
    headGroup.add(headMesh);

    // Sculpted Nose
    const noseGeo = new THREE.ConeGeometry(0.022, 0.05, 16);
    noseGeo.rotateX(Math.PI / 2);
    const noseMesh = new THREE.Mesh(noseGeo, skinMat);
    noseMesh.position.set(0, 0.06, 0.125);
    headGroup.add(noseMesh);

    // Parted Lips (slightly breathing / anxious in distress)
    const upperLip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.008, 0.012), lipsMat);
    upperLip.position.set(0, 0.025, 0.118);
    headGroup.add(upperLip);

    const lowerLip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.010, 0.012), lipsMat);
    lowerLip.position.set(0, 0.010, 0.116);
    headGroup.add(lowerLip);

    // Teeth inside mouth
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.006, 0.008), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
    teeth.position.set(0, 0.018, 0.112);
    headGroup.add(teeth);

    // Detailed Anxious Eyes (Iris, Pupil, Sclera, Eyebrows)
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const irisMat = new THREE.MeshBasicMaterial({ color: 0x5a3d28 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    const browMat = new THREE.MeshBasicMaterial({ color: 0x271911 });

    const createEye = (isLeft) => {
      const eyeRoot = new THREE.Group();
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 16), eyeWhiteMat);
      eyeRoot.add(sclera);

      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.009, 16), irisMat);
      iris.position.set(0, 0, 0.017);
      eyeRoot.add(iris);

      const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 16), pupilMat);
      pupil.position.set(0, 0, 0.0175);
      eyeRoot.add(pupil);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.006, 0.008), browMat);
      brow.position.set(0, 0.024, 0.012);
      brow.rotation.z = isLeft ? 0.12 : -0.12;
      eyeRoot.add(brow);

      eyeRoot.position.set(isLeft ? -0.044 : 0.044, 0.082, 0.098);
      return eyeRoot;
    };

    const leftEye = createEye(true);
    const rightEye = createEye(false);
    headGroup.add(leftEye);
    headGroup.add(rightEye);
    root.userData.leftEye = leftEye;
    root.userData.rightEye = rightEye;

    // Stylized Volumetric Hair
    const hairGroup = new THREE.Group();
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.122, 24, 16), hairMat);
    hairTop.scale.set(0.95, 1.15, 1.05);
    hairTop.position.set(0, 0.09, -0.01);
    hairGroup.add(hairTop);

    [-0.10, 0.10].forEach(x => {
      const sideburn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.05), hairMat);
      sideburn.position.set(x, 0.06, 0.02);
      hairGroup.add(sideburn);
    });

    headGroup.add(hairGroup);
    neckGroup.add(headGroup);
    torsoGroup.add(neckGroup);
    root.userData.headGroup = headGroup;
    root.userData.neckGroup = neckGroup;

    // 3. Arms Resting Along Treatment Unit / Stretcher
    const leftArm = HumanGenerator.createLimb(gownMat, skinMat, true);
    leftArm.position.set(-0.25, 0.32, 0.02);
    torsoGroup.add(leftArm);
    root.userData.leftArm = leftArm;

    const rightArm = HumanGenerator.createLimb(gownMat, skinMat, false);
    rightArm.position.set(0.25, 0.32, 0.02);
    torsoGroup.add(rightArm);
    root.userData.rightArm = rightArm;

    // Pulse Oximeter Sensor on Right Index Finger
    const pulseOxMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
    const pulseOx = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.016, 0.032), pulseOxMat);
    pulseOx.position.set(0.16, -0.16, 0.44);
    rightArm.add(pulseOx);

    // 4. Legs Extending Forward onto Treatment Unit / Bed Footrest
    const legsGroup = new THREE.Group();
    legsGroup.name = 'Patient_Legs';
    legsGroup.position.set(0, 0.52, -0.08);

    [-0.11, 0.11].forEach(x => {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.42, 16), pantsMat);
      thigh.rotation.x = 1.35;
      thigh.position.set(x, 0.06, 0.22);
      legsGroup.add(thigh);

      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.44, 16), pantsMat);
      shin.rotation.x = 1.50;
      shin.position.set(x, 0.04, 0.62);
      legsGroup.add(shin);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.22), shoesMat);
      shoe.position.set(x, 0.06, 0.88);
      legsGroup.add(shoe);
    });

    root.add(torsoGroup);
    root.add(legsGroup);
    root.userData.torsoGroup = torsoGroup;

    return root;
  }

  static createLimb(sleeveMat, skinMat, isLeft) {
    const armGroup = new THREE.Group();
    const sign = isLeft ? -1 : 1;

    const upperArmGeo = new THREE.CylinderGeometry(0.05, 0.045, 0.28, 16);
    const upperArm = new THREE.Mesh(upperArmGeo, sleeveMat);
    upperArm.rotation.z = sign * 0.15;
    upperArm.rotation.x = 0.35;
    upperArm.position.set(sign * 0.06, -0.10, 0.08);
    armGroup.add(upperArm);

    const forearmGeo = new THREE.CylinderGeometry(0.042, 0.036, 0.28, 16);
    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.rotation.x = 1.45;
    forearm.rotation.z = sign * -0.08;
    forearm.position.set(sign * 0.10, -0.16, 0.30);
    armGroup.add(forearm);

    const handGeo = new THREE.BoxGeometry(0.075, 0.035, 0.10);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.set(sign * 0.10, -0.16, 0.48);
    armGroup.add(hand);

    return armGroup;
  }

  static createClinicalAssistant() {
    const root = new THREE.Group();
    root.name = 'ClinicalAssistant_Sarah';

    // Universal Medical Scrubs (Hospital Teal / Navy) & Nitrile Examination Gloves
    const scrubMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.75 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbd0b5, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.85 });
    const maskMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.6 });

    const body = new THREE.Group();

    // Scrubs Top (Torso)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.52, 0.20), scrubMat);
    torso.position.set(0, 1.15, 0);
    body.add(torso);

    // Hospital Staff Identification Badge
    const badgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.07), badgeMat);
    badge.position.set(-0.10, 1.25, 0.105);
    body.add(badge);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.10, 20, 20), skinMat);
    head.scale.set(0.9, 1.15, 0.95);
    head.position.set(0, 1.54, 0);
    body.add(head);

    // Hair bun
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 16), hairMat);
    hair.position.set(0, 1.58, -0.04);
    body.add(hair);

    // Clinical Face Mask
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.04), maskMat);
    mask.position.set(0, 1.50, 0.08);
    body.add(mask);

    // Scrubs Pants (Legs)
    [-0.09, 0.09].forEach(x => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.85, 16), scrubMat);
      leg.position.set(x, 0.45, 0);
      body.add(leg);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.18), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      shoe.position.set(x, 0.03, 0.03);
      body.add(shoe);
    });

    // Arms with Nitrile Gloves
    [-0.20, 0.20].forEach((x) => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.55, 16), scrubMat);
      arm.rotation.x = 0.25;
      arm.position.set(x, 1.10, 0.08);
      body.add(arm);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), gloveMat);
      hand.position.set(x, 0.82, 0.20);
      body.add(hand);
    });

    root.add(body);
    // Positioned beside the patient's head on the left
    root.position.set(-0.85, 0, -1.35);
    root.rotation.y = 0.45;

    return root;
  }
}
