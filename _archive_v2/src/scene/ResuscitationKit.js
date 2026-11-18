/**
 * ResuscitationKit.js - Emergency Drug Kit & Dental Mouth Mirror
 * Features the countertop Red Emergency Box with interactive opening lid,
 * the chairside Dental Mouth Mirror, and resuscitation medications.
 */

import * as THREE from 'three';

export class ResuscitationKit {
  constructor(soundManager, onMirrorSelected, onMedicationSelected) {
    this.soundManager = soundManager;
    this.onMirrorSelected = onMirrorSelected;
    this.onMedicationSelected = onMedicationSelected;

    this.group = new THREE.Group();
    this.group.name = 'ResuscitationKitAndTools';

    this.interactiveObjects = [];
    this.hoveredObject = null;

    this.isKitOpen = false;
    this.lidAngle = 0;
    this.targetLidAngle = 0;

    this.animatingItem = null;
    this.animProgress = 0;
    this.animStartPos = new THREE.Vector3();
    this.animTargetPos = new THREE.Vector3();
    this.homePositions = new Map();

    this.buildMouthMirrorTool();
    this.buildChairsideInstrumentCart();
    this.buildCountertopEmergencyBox();
  }

  buildChairsideInstrumentCart() {
    const cartGroup = new THREE.Group();
    cartGroup.name = 'ChairsideInstrumentCart';

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.12 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });

    // 1. Mobile 4-star base on floor
    const baseLeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.04), steelMat);
    baseLeg1.position.set(0.46, 0.02, -0.85);
    cartGroup.add(baseLeg1);

    const baseLeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.36), steelMat);
    baseLeg2.position.set(0.46, 0.02, -0.85);
    cartGroup.add(baseLeg2);

    // 2. Telescopic surgical chrome column
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.020, 0.76, 24), chromeMat);
    pole.position.set(0.46, 0.40, -0.85);
    cartGroup.add(pole);

    // 3. Stainless Steel Surgical Mayo Tray
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.016, 0.26), whiteMat);
    tray.position.set(0.46, 0.78, -0.85);
    cartGroup.add(tray);

    // Tray lip border
    const trayLip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.025, 0.27), chromeMat);
    trayLip.position.set(0.46, 0.775, -0.85);
    cartGroup.add(trayLip);

    this.group.add(cartGroup);
  }

  buildMouthMirrorTool() {
    this.mirrorGroup = new THREE.Group();
    this.mirrorGroup.name = 'Tool_DentalMouthMirror';
    this.mirrorGroup.userData = { type: 'MOUTH_MIRROR', title: 'Dental Mouth Mirror' };

    const steelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });

    // Handle
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.16, 16), steelMat);
    handle.rotation.z = Math.PI / 2;
    this.mirrorGroup.add(handle);

    // Angled neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.035, 12), steelMat);
    neck.position.set(0.09, 0.012, 0);
    neck.rotation.z = -Math.PI / 4;
    this.mirrorGroup.add(neck);

    // Circular mirror head
    const mirrorHead = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.003, 24), steelMat);
    mirrorHead.position.set(0.105, 0.024, 0);
    mirrorHead.rotation.x = Math.PI / 2;
    this.mirrorGroup.add(mirrorHead);

    // Reflective glass disc
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, metalness: 0.9, roughness: 0.05 });
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.011, 24), glassMat);
    glass.position.set(0.105, 0.024, 0.002);
    this.mirrorGroup.add(glass);

    // Positioned cleanly on the chairside instrument tray at easy reach
    this.mirrorGroup.position.set(0.46, 0.80, -0.85);
    this.mirrorGroup.rotation.y = -0.3;
    this.group.add(this.mirrorGroup);

    this.registerHitbox(this.mirrorGroup, 0.20, 0.08, 0.08, 0x0ea5e9);
  }

  buildCountertopEmergencyBox() {
    this.kitBoxGroup = new THREE.Group();
    this.kitBoxGroup.name = 'RedEmergencyResusBox';

    // Red Medical Tackle Box Base
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }); // Institutional red
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    const boxBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.32), redMat);
    boxBase.position.y = 0.07;
    this.kitBoxGroup.add(boxBase);

    // White Cross emblem on front
    const cross1 = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.02), whiteMat);
    cross1.position.set(0, 0.07, 0.161);
    this.kitBoxGroup.add(cross1);

    const cross2 = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.06), whiteMat);
    cross2.position.set(0, 0.07, 0.161);
    this.kitBoxGroup.add(cross2);

    // Hinged Lid Group
    this.lidHinge = new THREE.Group();
    this.lidHinge.position.set(0, 0.14, -0.16);

    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.03, 0.33), redMat);
    lid.position.set(0, 0.015, 0.165);
    this.lidHinge.add(lid);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.02), whiteMat);
    handle.position.set(0, 0.04, 0.165);
    this.lidHinge.add(handle);

    this.kitBoxGroup.add(this.lidHinge);

    // Inside Medication Tray (Revealed when lid opens)
    this.insideTray = new THREE.Group();
    this.insideTray.position.set(0, 0.08, 0);

    this.medications = [
      this.buildEpiPen(),
      this.buildGlucagonKit(),
      this.buildGTNSpray(),
      this.buildGlucoseGel(),
      this.buildAspirinBlister()
    ];

    this.medications.forEach(m => this.insideTray.add(m));
    this.kitBoxGroup.add(this.insideTray);

    // Hitbox for clicking the box itself to open/close
    this.kitBoxGroup.userData = { type: 'EMERGENCY_BOX_LID', title: 'Emergency Resuscitation Drug Box' };
    this.registerHitbox(this.kitBoxGroup, 0.50, 0.22, 0.36, 0xdc2626);

    // Positioned on the countertop station beside the assistant
    this.kitBoxGroup.position.set(0.45, 0.90, -4.10);
    this.group.add(this.kitBoxGroup);
  }

  buildEpiPen() {
    const group = new THREE.Group();
    group.name = 'Med_Adrenaline_EpiPen';
    group.userData = {
      medicationId: 'ADRENALINE',
      name: 'Adrenaline (EpiPen) Auto-Injector 1:1000',
      approvedSite: 'VASTUS_LATERALIS',
      dose: '0.5mg IM into Vastus Lateralis Thigh'
    };

    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 20), yellowMat);
    group.add(body);

    const blackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const safetyCap = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.028, 20), blackMat);
    safetyCap.position.y = 0.08;
    group.add(safetyCap);

    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
    const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.02, 20), orangeMat);
    plunger.position.y = -0.08;
    group.add(plunger);

    group.position.set(-0.14, 0.02, 0.02);
    group.rotation.set(0, 0, Math.PI / 2);
    this.homePositions.set(group, { pos: group.position.clone(), rot: group.rotation.clone() });
    this.registerHitbox(group, 0.05, 0.18, 0.05, 0xeab308);
    return group;
  }

  buildGlucagonKit() {
    const group = new THREE.Group();
    group.name = 'Med_Glucagon_Kit';
    group.userData = {
      medicationId: 'GLUCAGON',
      name: 'Glucagon Emergency Kit 1mg',
      approvedSite: 'VASTUS_LATERALIS',
      dose: '1mg IM Parenteral Rescue'
    };

    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.13, 16), orangeMat);
    group.add(body);

    const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.8 });
    const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 16), glassMat);
    vial.position.y = 0.08;
    group.add(vial);

    group.position.set(-0.05, 0.02, -0.03);
    group.rotation.set(0, 0, Math.PI / 2);
    this.homePositions.set(group, { pos: group.position.clone(), rot: group.rotation.clone() });
    this.registerHitbox(group, 0.05, 0.18, 0.05, 0xf97316);
    return group;
  }

  buildGTNSpray() {
    const group = new THREE.Group();
    group.name = 'Med_GTN_Spray';
    group.userData = {
      medicationId: 'GTN_ASPIRIN',
      name: 'Sublingual GTN Spray (400mcg)',
      approvedSite: 'SUBLINGUAL_ORAL',
      dose: '400mcg Sublingual Oral Spray'
    };

    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.3 });
    const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 20), blueMat);
    canister.position.y = 0.035;
    group.add(canister);

    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.02, 0.018), whiteMat);
    nozzle.position.set(0, 0.08, 0.005);
    group.add(nozzle);

    group.position.set(0.04, 0.02, 0.03);
    this.homePositions.set(group, { pos: group.position.clone(), rot: group.rotation.clone() });
    this.registerHitbox(group, 0.05, 0.12, 0.05, 0x0284c7);
    return group;
  }

  buildGlucoseGel() {
    const group = new THREE.Group();
    group.name = 'Med_Glucose_Gel';
    group.userData = {
      medicationId: 'GLUCOSE_GEL',
      name: 'Oral Glucose Gel Tube',
      approvedSite: 'SUBLINGUAL_ORAL',
      dose: 'Buccal pouch oral administration'
    };

    const gelMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.11, 16), gelMat);
    group.add(tube);

    const greenMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.02, 16), greenMat);
    cap.position.y = 0.065;
    group.add(cap);

    group.position.set(0.12, 0.02, -0.02);
    group.rotation.set(0, 0, Math.PI / 2);
    this.homePositions.set(group, { pos: group.position.clone(), rot: group.rotation.clone() });
    this.registerHitbox(group, 0.05, 0.14, 0.05, 0x10b981);
    return group;
  }

  buildAspirinBlister() {
    const group = new THREE.Group();
    group.name = 'Med_Aspirin_Blister';
    group.userData = {
      medicationId: 'ASPIRIN',
      name: 'Dispersible Aspirin 300mg',
      approvedSite: 'SUBLINGUAL_ORAL',
      dose: '300mg chewed or dispersed in water'
    };

    const foilMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
    const blister = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.004, 0.08), foilMat);
    group.add(blister);

    group.position.set(0.18, 0.02, 0.04);
    this.homePositions.set(group, { pos: group.position.clone(), rot: group.rotation.clone() });
    this.registerHitbox(group, 0.08, 0.03, 0.10, 0xe2e8f0);
    return group;
  }

  registerHitbox(group, w, h, d, glowColorHex) {
    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.userData = group.userData;
    hitBox.userData.parentGroup = group;
    group.add(hitBox);
    this.interactiveObjects.push(hitBox);

    const auraMat = new THREE.MeshBasicMaterial({ color: glowColorHex, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const aura = new THREE.Mesh(new THREE.RingGeometry(0.025, 0.05, 24), auraMat);
    aura.rotation.x = Math.PI / 2;
    group.add(aura);
    group.userData.auraMat = auraMat;
  }

  toggleKitBox() {
    this.isKitOpen = !this.isKitOpen;
    this.targetLidAngle = this.isKitOpen ? -Math.PI * 0.65 : 0; // Flip lid open back
    this.soundManager.playSyringeClick();
  }

  triggerSelect(hitBox, targetWorldPos) {
    if (!hitBox || !hitBox.userData.parentGroup) return;
    const parent = hitBox.userData.parentGroup;

    if (parent.userData.type === 'EMERGENCY_BOX_LID') {
      this.toggleKitBox();
      return;
    }

    if (parent.userData.type === 'MOUTH_MIRROR') {
      this.soundManager.playSyringeClick();
      if (this.onMirrorSelected) this.onMirrorSelected();
      return;
    }

    // Medication selected from kit
    if (parent.userData.medicationId) {
      this.soundManager.playSyringeClick();
      if (this.onMedicationSelected) {
        this.onMedicationSelected(parent.userData);
      }
    }
  }

  executeInjectionAnimation(medicationData, targetWorldPos, onComplete) {
    const group = new THREE.Group();
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 20), yellowMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const needleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.04, 12), needleMat);
    needle.position.z = 0.09;
    needle.rotation.x = Math.PI / 2;
    group.add(needle);

    group.position.copy(targetWorldPos);
    group.position.y += 0.12;
    this.group.add(group);

    this.soundManager.playSyringeClick();

    let step = 0;
    const animTimer = setInterval(() => {
      step++;
      if (step < 6) {
        group.position.y -= 0.015;
      } else if (step === 6) {
        this.soundManager.playSyringeClick();
      } else if (step > 15) {
        clearInterval(animTimer);
        this.group.remove(group);
        if (onComplete) onComplete();
      }
    }, 40);
  }

  setHovered(hitBox) {
    if (this.hoveredObject === hitBox) return;

    if (this.hoveredObject && this.hoveredObject.userData.parentGroup) {
      const prev = this.hoveredObject.userData.parentGroup;
      if (prev.userData.auraMat) prev.userData.auraMat.opacity = 0;
      prev.scale.set(1, 1, 1);
    }

    this.hoveredObject = hitBox;

    if (this.hoveredObject && this.hoveredObject.userData.parentGroup) {
      const active = this.hoveredObject.userData.parentGroup;
      if (active.userData.auraMat) active.userData.auraMat.opacity = 0.85;
      active.scale.set(1.1, 1.1, 1.1);
    }
  }

  update(deltaSec) {
    // Lid opening interpolation
    if (Math.abs(this.lidAngle - this.targetLidAngle) > 0.01) {
      this.lidAngle = THREE.MathUtils.lerp(this.lidAngle, this.targetLidAngle, deltaSec * 6);
      if (this.lidHinge) this.lidHinge.rotation.x = this.lidAngle;
    }

    // Parenteral drug delivery animation
    if (this.animatingItem) {
      this.animProgress += deltaSec / 1.8;

      if (this.animProgress < 0.45) {
        const t = this.animProgress / 0.45;
        this.animatingItem.position.lerpVectors(this.animStartPos, this.animTargetPos, t);
        this.animatingItem.position.y += Math.sin(t * Math.PI) * 0.14;
      } else if (this.animProgress < 0.75) {
        this.animatingItem.position.copy(this.animTargetPos);
      } else if (this.animProgress < 1.0) {
        const t = (this.animProgress - 0.75) / 0.25;
        this.animatingItem.position.lerpVectors(this.animTargetPos, this.animStartPos, t);
      } else {
        this.animatingItem.position.copy(this.animStartPos);
        const home = this.homePositions.get(this.animatingItem);
        if (home) this.animatingItem.rotation.copy(home.rot);
        this.animatingItem = null;
      }
    }
  }
}
