/**
 * EquipmentTray.js
 * 
 * 3D Bedside Mayo Equipment Tray matching P.E.A.R.L. Emergency specification:
 * 1. Glucose Gel Tube (Option 1 - First-line conscious oral glucose)
 * 2. Glucagon Syringe (1 mg IM - Parenteral hypoglycemia rescue)
 * 3. Adrenaline Syringe (1:1000 IM Epinephrine - Anaphylaxis protocol)
 * 4. Aspirin 300mg & GTN Spray (Acute Coronary Syndrome / STEMI protocol)
 * 5. Insulin Syringe (Option 5 - Fatal error in hypoglycemia)
 * 6. Trendelenburg Recline Lever (Option 4 - Syncope tilt)
 */

import * as THREE from 'three';
import { Interventions } from '../core/ClinicalStateMachine.js';

export class EquipmentTray {
  constructor(soundManager, onAdministerCallback) {
    this.soundManager = soundManager;
    this.onAdministerCallback = onAdministerCallback;

    this.group = new THREE.Group();
    this.group.name = 'EquipmentTray';

    this.interactiveObjects = [];
    this.hoveredObject = null;
    this.isAnimating = false;

    this.buildTrayTable();

    // 1. Glucose Gel Tube
    this.glucoseGel = this.buildGlucoseGel();
    this.glucoseGel.position.set(-0.18, 0.73, 0.04);
    this.glucoseGel.rotation.set(0, 0, Math.PI / 2);
    this.group.add(this.glucoseGel);

    // 2. Glucagon Emergency Syringe
    this.glucagonSyringe = this.buildGlucagonSyringe();
    this.glucagonSyringe.position.set(-0.10, 0.73, -0.02);
    this.glucagonSyringe.rotation.set(0, 0, Math.PI / 2);
    this.group.add(this.glucagonSyringe);

    // 3. Adrenaline Syringe (Epinephrine 1:1000)
    this.adrenalineSyringe = this.buildAdrenalineSyringe();
    this.adrenalineSyringe.position.set(-0.02, 0.73, -0.02);
    this.adrenalineSyringe.rotation.set(0, 0, Math.PI / 2);
    this.group.add(this.adrenalineSyringe);

    // 4. Aspirin & GTN Spray (Acute Coronary Syndrome)
    this.aspirinGTN = this.buildAspirinGTN();
    this.aspirinGTN.position.set(0.06, 0.73, 0.04);
    this.group.add(this.aspirinGTN);

    // 5. Insulin Syringe (Fatal Error)
    this.insulinSyringe = this.buildInsulinSyringe();
    this.insulinSyringe.position.set(0.14, 0.73, -0.02);
    this.insulinSyringe.rotation.set(0, 0, Math.PI / 2);
    this.group.add(this.insulinSyringe);

    // 6. Trendelenburg Position Lever (Dental Chair Tilt)
    this.trendelenburgLever = this.buildTrendelenburgLever();
    this.trendelenburgLever.position.set(0.20, 0.73, 0.10);
    this.group.add(this.trendelenburgLever);

    // Store home positions
    this.homePositions = new Map();
    [this.glucoseGel, this.glucagonSyringe, this.adrenalineSyringe, this.aspirinGTN, this.insulinSyringe, this.trendelenburgLever].forEach(obj => {
      this.homePositions.set(obj, { pos: obj.position.clone(), rot: obj.rotation.clone() });
    });

    // Animation state
    this.animatingItem = null;
    this.animProgress = 0;
    this.animDuration = 2.0;
    this.animStartPos = new THREE.Vector3();
    this.animTargetPos = new THREE.Vector3();

    this.time = 0;
  }

  buildTrayTable() {
    const standMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });

    // Stand base
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.03, 0.45), standMat);
    base.position.set(0, 0.015, 0);
    this.group.add(base);

    // Stand column
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.70, 16), standMat);
    col.position.set(0, 0.36, 0);
    this.group.add(col);

    // Stainless steel tray top
    const trayMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.25 });
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.38), trayMat);
    tray.position.set(0, 0.71, 0.02);
    this.group.add(tray);

    // Blue sterile drape
    const drapeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.85 });
    const drape = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.005, 0.35), drapeMat);
    drape.position.set(0, 0.722, 0.02);
    this.group.add(drape);

    // Header label plaque
    const plaque = this.createPlaqueMesh("P.E.A.R.L. EMERGENCY DRUG TRAY • CLINICAL SIM");
    plaque.position.set(0, 0.74, -0.14);
    this.group.add(plaque);
  }

  /**
   * Option 1: Glucose Gel Tube (Oral absorption)
   */
  buildGlucoseGel() {
    const group = new THREE.Group();
    group.name = 'Item_GlucoseGel';
    group.userData = {
      type: Interventions.GLUCOSE_GEL,
      title: 'ORAL GLUCOSE GEL (15g)',
      warning: 'FIRST-LINE: CONSCIOUS HYPOGLYCEMIA',
      actionLabel: 'Administer Oral Glucose Gel'
    };

    // Tube body (Bright cyan / royal blue squeezable tube)
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.12, 16), tubeMat);
    tube.scale.set(1.2, 1.0, 0.65);
    group.add(tube);

    // White nozzle screw cap
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.03, 16), capMat);
    cap.position.set(0, -0.075, 0);
    group.add(cap);

    // Label band
    const label = this.createItemLabel("GLUCOSE GEL", "#0284c7", "#ffffff");
    label.position.set(0, 0, 0.016);
    group.add(label);

    // Hitbox
    this.attachHitboxAndAura(group, new THREE.BoxGeometry(0.09, 0.22, 0.09), 0x38bdf8);

    // Tooltip
    const tooltip = this.createTooltipMesh("GLUCOSE GEL (15g)", "RECOMMENDED: 1st-Line Conscious Hypoglycemia", "#38bdf8");
    tooltip.position.set(0, 0.18, 0);
    tooltip.visible = false;
    group.add(tooltip);
    group.userData.tooltip = tooltip;

    return group;
  }

  /**
   * Glucagon Syringe (1 mg IM Parenteral Rescue)
   */
  buildGlucagonSyringe() {
    const group = new THREE.Group();
    group.name = 'Item_Glucagon';
    group.userData = {
      type: Interventions.GLUCAGON,
      title: 'GLUCAGON (1 mg IM)',
      warning: 'CORRECT ACTION: UNCONSCIOUS / SEVERE HYPO',
      actionLabel: 'Administer 1mg Glucagon IM'
    };

    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
    const amberMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.14, 16),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.8, roughness: 0.2, transparent: true, opacity: 0.9 })
    );
    group.add(barrel);

    const redCap = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.014, 0.06, 16), redMat);
    redCap.position.set(0, -0.09, 0);
    group.add(redCap);

    const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 12), amberMat);
    plunger.position.set(0, 0.09, 0);
    group.add(plunger);

    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.007, 16), redMat);
    thumb.position.set(0, 0.13, 0);
    group.add(thumb);

    const label = this.createItemLabel("GLUCAGON 1mg", "#dc2626", "#ffffff");
    label.position.set(0, 0, 0.014);
    group.add(label);

    this.attachHitboxAndAura(group, new THREE.BoxGeometry(0.08, 0.26, 0.08), 0x34d399);

    const tooltip = this.createTooltipMesh("GLUCAGON (1 mg IM)", "RECOMMENDED: Parenteral Glucose Rescue", "#10b981");
    tooltip.position.set(0, 0.18, 0);
    tooltip.visible = false;
    group.add(tooltip);
    group.userData.tooltip = tooltip;

    return group;
  }

  /**
   * Adrenaline Syringe (1:1000 Epinephrine - Anaphylaxis protocol)
   */
  buildAdrenalineSyringe() {
    const group = new THREE.Group();
    group.name = 'Item_Adrenaline';
    group.userData = {
      type: Interventions.ADRENALINE,
      title: 'ADRENALINE 1:1000 (0.5mg)',
      warning: 'FIRST-LINE: ACUTE ANAPHYLAXIS',
      actionLabel: 'Administer Adrenaline (Anaphylaxis Protocol)'
    };

    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.35 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.35 });

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.13, 16),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.85, roughness: 0.2, transparent: true, opacity: 0.9 })
    );
    group.add(barrel);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.055, 16), yellowMat);
    cap.position.set(0, -0.085, 0);
    group.add(cap);

    const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.08, 12), greenMat);
    plunger.position.set(0, 0.085, 0);
    group.add(plunger);

    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 16), yellowMat);
    thumb.position.set(0, 0.125, 0);
    group.add(thumb);

    const label = this.createItemLabel("ADRENALINE 1:1000", "#ca8a04", "#ffffff");
    label.position.set(0, 0, 0.013);
    group.add(label);

    this.attachHitboxAndAura(group, new THREE.BoxGeometry(0.08, 0.25, 0.08), 0xf59e0b);

    const tooltip = this.createTooltipMesh("ADRENALINE (1:1000 IM)", "FIRST-LINE: Acute Anaphylactic Shock", "#f59e0b");
    tooltip.position.set(0, 0.18, 0);
    tooltip.visible = false;
    group.add(tooltip);
    group.userData.tooltip = tooltip;

    return group;
  }

  /**
   * Option: Aspirin 300mg & GTN Spray (Acute Coronary Syndrome / STEMI)
   */
  buildAspirinGTN() {
    const group = new THREE.Group();
    group.name = 'Item_AspirinGTN';
    group.userData = {
      type: Interventions.ASPIRIN_GTN,
      title: 'ASPIRIN & GTN SPRAY',
      warning: 'FIRST-LINE: MYOCARDIAL INFARCTION / CHEST PAIN',
      actionLabel: 'Administer Aspirin 300mg Chewed + GTN Spray'
    };

    const bottleMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.2 });
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 16), bottleMat);
    bottle.position.set(0, 0, 0);
    group.add(bottle);

    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.02), nozzleMat);
    nozzle.position.set(0, 0.05, 0.005);
    group.add(nozzle);

    const blisterMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.85, roughness: 0.25 });
    const blister = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.005, 0.06), blisterMat);
    blister.position.set(0.025, -0.035, 0.01);
    group.add(blister);

    const label = this.createItemLabel("ASPIRIN+GTN", "#d97706", "#ffffff");
    label.position.set(0, 0, 0.013);
    group.add(label);

    this.attachHitboxAndAura(group, new THREE.BoxGeometry(0.09, 0.16, 0.09), 0xf59e0b);

    const tooltip = this.createTooltipMesh("ASPIRIN & GTN SPRAY", "FIRST-LINE: Acute Coronary Syndrome", "#f59e0b");
    tooltip.position.set(0, 0.16, 0);
    tooltip.visible = false;
    group.add(tooltip);
    group.userData.tooltip = tooltip;

    return group;
  }

  /**
   * Option 5: Insulin Syringe (Fatal Error in Hypoglycemia)
   */
  buildInsulinSyringe() {
    const group = new THREE.Group();
    group.name = 'Item_Insulin';
    group.userData = {
      type: Interventions.INSULIN,
      title: 'INSULIN (100 U/mL)',
      warning: 'CRITICAL ERROR: FATAL IN HYPOGLYCEMIA!',
      actionLabel: 'Administer 100U Insulin (Fatal Error)'
    };

    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff6b00, roughness: 0.35 });

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.14, 16),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.85, roughness: 0.15, transparent: true, opacity: 0.85 })
    );
    group.add(barrel);

    const orangeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.011, 0.06, 16), orangeMat);
    orangeCap.position.set(0, -0.095, 0);
    group.add(orangeCap);

    const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.08, 12), orangeMat);
    plunger.position.set(0, 0.09, 0);
    group.add(plunger);

    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.005, 16), orangeMat);
    thumb.position.set(0, 0.13, 0);
    group.add(thumb);

    const label = this.createItemLabel("INSULIN 100U", "#ff6b00", "#ffffff");
    label.position.set(0, 0, 0.012);
    group.add(label);

    this.attachHitboxAndAura(group, new THREE.BoxGeometry(0.08, 0.28, 0.08), 0xef4444);

    const tooltip = this.createTooltipMesh("INSULIN (100 U/mL)", "FATAL ERROR: Lethal Neuroglycopenic Shock", "#ef4444");
    tooltip.position.set(0, 0.18, 0);
    tooltip.visible = false;
    group.add(tooltip);
    group.userData.tooltip = tooltip;

    return group;
  }

  /**
   * Option 4: Trendelenburg Position Lever (Dental Chair Tilt)
   */
  buildTrendelenburgLever() {
    const group = new THREE.Group();
    group.name = 'Item_Trendelenburg';
    group.userData = {
      type: Interventions.TRENDELENBURG,
      title: 'TRENDELENBURG POSITION',
      warning: 'INDICATION: VASOVAGAL SYNCOPE',
      actionLabel: 'Recline Chair (Trendelenburg)'
    };

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.4 });

    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.06), metalMat);
    group.add(pedestal);

    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.04), blueMat);
    chairBack.rotation.x = -0.4;
    chairBack.position.set(0, 0.03, -0.01);
    group.add(chairBack);

    const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.04), blueMat);
    chairSeat.position.set(0, 0.025, 0.02);
    group.add(chairSeat);

    this.attachHitboxAndAura(group, new THREE.BoxGeometry(0.12, 0.12, 0.12), 0x0ea5e9);

    const tooltip = this.createTooltipMesh("TRENDELENBURG TILT", "INDICATION: Vasovagal Syncope Faint", "#0ea5e9");
    tooltip.position.set(0, 0.14, 0);
    tooltip.visible = false;
    group.add(tooltip);
    group.userData.tooltip = tooltip;

    return group;
  }

  attachHitboxAndAura(group, hitGeo, auraColorHex) {
    const hitBox = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.userData = group.userData;
    hitBox.userData.parentGroup = group;
    group.add(hitBox);
    this.interactiveObjects.push(hitBox);

    const auraMat = new THREE.MeshBasicMaterial({ color: auraColorHex, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const aura = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.055, 24), auraMat);
    aura.rotation.x = Math.PI / 2;
    group.add(aura);
    group.userData.aura = auraMat;
  }

  createItemLabel(text, bgColor, textColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, 248, 56);
    ctx.fillStyle = textColor; ctx.font = 'bold 24px "Segoe UI", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.02), mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  createTooltipMesh(title, sub, accentColorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 380; canvas.height = 110;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    this.roundRect(ctx, 4, 4, 372, 102, 12);
    ctx.fill();

    ctx.strokeStyle = accentColorHex; ctx.lineWidth = 3;
    this.roundRect(ctx, 4, 4, 372, 102, 12);
    ctx.stroke();

    ctx.fillStyle = accentColorHex; ctx.font = 'bold 24px "Segoe UI", sans-serif';
    ctx.fillText(title, 20, 42);

    ctx.fillStyle = '#e2e8f0'; ctx.font = '16px "Segoe UI", sans-serif';
    ctx.fillText(sub, 20, 78);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.07), mat);
    mesh.rotation.y = -Math.PI / 4;
    return mesh;
  }

  createPlaqueMesh(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 512, 64);
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, 506, 58);
    ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.05), mat);
    mesh.rotation.x = -Math.PI / 3;
    return mesh;
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  setHovered(intersectedHitBox) {
    if (this.hoveredObject === intersectedHitBox) return;

    if (this.hoveredObject && this.hoveredObject.userData.parentGroup) {
      const prev = this.hoveredObject.userData.parentGroup;
      if (prev.userData.aura) prev.userData.aura.opacity = 0;
      if (prev.userData.tooltip) prev.userData.tooltip.visible = false;
      prev.scale.set(1, 1, 1);
    }

    this.hoveredObject = intersectedHitBox;

    if (this.hoveredObject && this.hoveredObject.userData.parentGroup) {
      const active = this.hoveredObject.userData.parentGroup;
      if (active.userData.aura) active.userData.aura.opacity = 0.85;
      if (active.userData.tooltip) active.userData.tooltip.visible = true;
      active.scale.set(1.08, 1.08, 1.08);

      if (this.soundManager) this.soundManager.playHoverSound();
    }
  }

  triggerSelect(intersectedHitBox, targetPatientPos) {
    if (this.isAnimating) return;
    if (!intersectedHitBox || !intersectedHitBox.userData.parentGroup) return;

    const itemGroup = intersectedHitBox.userData.parentGroup;
    const type = itemGroup.userData.type;

    this.isAnimating = true;
    this.animatingItem = itemGroup;
    this.animProgress = 0;

    this.animStartPos.copy(itemGroup.position);
    this.animTargetPos.copy(targetPatientPos);

    if (itemGroup.userData.tooltip) itemGroup.userData.tooltip.visible = false;
    if (itemGroup.userData.aura) itemGroup.userData.aura.opacity = 0;

    if (this.soundManager) {
      this.soundManager.playAdministerSound(type === Interventions.GLUCAGON || type === Interventions.GLUCOSE_GEL);
    }

    if (this.onAdministerCallback) {
      this.onAdministerCallback(type);
    }
  }

  update(deltaSec) {
    this.time += deltaSec;

    if (this.isAnimating && this.animatingItem) {
      this.animProgress += deltaSec / this.animDuration;

      if (this.animProgress < 0.45) {
        const t = this.animProgress / 0.45;
        const ease = 1 - Math.pow(1 - t, 3);
        this.animatingItem.position.lerpVectors(this.animStartPos, this.animTargetPos, ease);
        this.animatingItem.position.y += Math.sin(t * Math.PI) * 0.15;
      } else if (this.animProgress < 0.75) {
        this.animatingItem.position.copy(this.animTargetPos);
      } else if (this.animProgress < 1.0) {
        const t = (this.animProgress - 0.75) / 0.25;
        this.animatingItem.position.lerpVectors(this.animTargetPos, this.animStartPos, t * t);
      } else {
        this.animatingItem.position.copy(this.animStartPos);
        const home = this.homePositions.get(this.animatingItem);
        if (home) this.animatingItem.rotation.copy(home.rot);
        this.animatingItem = null;
        this.isAnimating = false;
      }
    }
  }

  reset() {
    this.isAnimating = false;
    this.animatingItem = null;
    this.homePositions.forEach((home, item) => {
      item.position.copy(home.pos);
      item.rotation.copy(home.rot);
      item.scale.set(1, 1, 1);
    });
    this.setHovered(null);
  }
}
