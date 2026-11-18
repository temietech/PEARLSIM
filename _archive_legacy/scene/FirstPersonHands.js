/**
 * FirstPersonHands.js
 * 
 * First-person clinician presence for PEARLSIM:
 * Renders sterile white nitrile examination gloved hands resting in the foreground
 * lower-third of the viewport over the clinical instrument tray, providing natural
 * depth, spatial scale, and VR immersion matching the prototype visuals.
 * 
 * Automatically hidden in WebXR immersive mode where physical Quest controllers
 * or hand-tracking take over.
 */

import * as THREE from 'three';

export class FirstPersonHands {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.name = 'FirstPersonGlovedHands';

    this.buildGlovedHands();
  }

  buildGlovedHands() {
    // Medical Nitrile Glove Material (Clean clinical white/pale-blue specular sheen)
    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0xedf2f7,
      roughness: 0.38,
      metalness: 0.08
    });

    const cuffMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8, // Sky blue sterile gown cuff trim
      roughness: 0.65
    });

    // Left Arm / Hand
    const leftArmGroup = this.createArm(gloveMat, cuffMat, false);
    leftArmGroup.position.set(-0.30, -0.36, -0.60);
    leftArmGroup.rotation.set(0.18, 0.15, 0.12);
    this.group.add(leftArmGroup);

    // Right Arm / Hand
    const rightArmGroup = this.createArm(gloveMat, cuffMat, true);
    rightArmGroup.position.set(0.30, -0.36, -0.60);
    rightArmGroup.rotation.set(0.18, -0.15, -0.12);
    this.group.add(rightArmGroup);

    // Attach to camera so hands stay in the lower foreground of the first-person perspective
    this.camera.add(this.group);
  }

  createArm(gloveMat, cuffMat, isRight) {
    const arm = new THREE.Group();

    // Forearm
    const forearmGeo = new THREE.CylinderGeometry(0.042, 0.048, 0.30, 24);
    const forearm = new THREE.Mesh(forearmGeo, gloveMat);
    forearm.rotation.x = Math.PI / 2.3;
    forearm.position.set(0, -0.06, 0.10);
    forearm.castShadow = true;
    arm.add(forearm);

    // Sterile gown wrist cuff
    const cuffGeo = new THREE.CylinderGeometry(0.049, 0.052, 0.04, 24);
    const cuff = new THREE.Mesh(cuffGeo, cuffMat);
    cuff.rotation.x = Math.PI / 2.3;
    cuff.position.set(0, -0.11, 0.22);
    arm.add(cuff);

    // Palm / Hand
    const palmGeo = new THREE.BoxGeometry(0.082, 0.026, 0.095);
    const palm = new THREE.Mesh(palmGeo, gloveMat);
    palm.position.set(0, 0, -0.05);
    palm.castShadow = true;
    arm.add(palm);

    // Knuckles / Fingers Group (resting relaxed curved posture)
    const fingersGroup = new THREE.Group();
    fingersGroup.position.set(0, 0, -0.095);

    const fingerWidths = [0.016, 0.017, 0.016, 0.015];
    const fingerOffsets = [-0.03, -0.01, 0.01, 0.03];
    const fingerLengths = [0.065, 0.075, 0.070, 0.055];

    for (let i = 0; i < 4; i++) {
      const fingerGeo = new THREE.CylinderGeometry(fingerWidths[i] / 2, fingerWidths[i] / 2, fingerLengths[i], 16);
      const finger = new THREE.Mesh(fingerGeo, gloveMat);
      finger.rotation.x = Math.PI / 2.6; // Curved downward naturally resting on tray
      finger.position.set(fingerOffsets[i], -0.015, -fingerLengths[i] / 2.4);
      finger.castShadow = true;
      fingersGroup.add(finger);
    }

    // Thumb
    const thumbGeo = new THREE.CylinderGeometry(0.009, 0.011, 0.055, 16);
    const thumb = new THREE.Mesh(thumbGeo, gloveMat);
    thumb.rotation.set(Math.PI / 4, isRight ? -Math.PI / 4 : Math.PI / 4, 0);
    thumb.position.set(isRight ? -0.045 : 0.045, -0.01, -0.04);
    thumb.castShadow = true;
    arm.add(thumb);

    arm.add(fingersGroup);
    return arm;
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}
