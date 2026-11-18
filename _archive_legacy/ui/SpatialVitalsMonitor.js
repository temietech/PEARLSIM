/**
 * SpatialVitalsMonitor.js
 * 
 * Floating 3D Glassmorphism Medical Vitals Monitor for WebXR.
 * Renders real-time ECG telemetry, dynamic HR, BP, BG, SpO2, and status alarms
 * onto a high-performance CanvasTexture.
 */

import * as THREE from 'three';
import { ClinicalStates } from '../core/ClinicalStateMachine.js';

export class SpatialVitalsMonitor {
  constructor(soundManager) {
    this.soundManager = soundManager;

    // Dimensions
    this.canvasWidth = 1024;
    this.canvasHeight = 576;

    // Offscreen Canvas for glass texture rendering
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.ctx = this.canvas.getContext('2d', { alpha: true });

    // Texture & Material
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    // 3D Glass Panel Mesh
    this.group = new THREE.Group();
    this.group.name = 'SpatialVitalsMonitor';

    this.createMonitorMesh();

    // ECG Lead II Rhythm Strip State
    this.ecgTrace = [];
    this.ecgCursorX = 0;
    this.ecgWidth = 620;
    this.ecgHeight = 160;
    this.ecgStartX = 40;
    this.ecgStartY = 130;
    this.ecgPhase = 0; // 0 to 1 through cardiac cycle
    this.lastCardiacBeepBeat = -1;

    // Vitals cache
    this.vitals = {
      state: ClinicalStates.BASELINE,
      heartRate: 82,
      bloodGlucose: 72,
      systolicBP: 118,
      diastolicBP: 76,
      spo2: 98,
      respirationRate: 14,
      cognitiveStatus: 'Alert',
      alarmActive: false,
      alarmLevel: 'NONE'
    };

    // Strobe / Animation timing
    this.time = 0;
    this.needsRender = true;
    this.lastRenderTime = 0;
  }

  createMonitorMesh() {
    const width = 0.85;  // 85cm wide in XR
    const height = 0.48; // 48cm tall in XR

    // Front Screen Panel (Displays glass UI)
    const screenGeo = new THREE.PlaneGeometry(width, height);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.98,
      side: THREE.DoubleSide
    });
    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.group.add(this.screenMesh);

    // Glass Backing Panel with frosted edge bevel
    const backGeo = new THREE.BoxGeometry(width + 0.02, height + 0.02, 0.015);
    const backMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      metalness: 0.1,
      roughness: 0.25,
      transmission: 0.7,
      transparent: true,
      opacity: 0.65,
      ior: 1.45,
      thickness: 0.02
    });
    const backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.position.z = -0.01;
    this.group.add(backMesh);

    // Glowing border frame
    const frameGeo = new THREE.EdgesGeometry(backGeo);
    this.frameMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.6
    });
    const frameLine = new THREE.LineSegments(frameGeo, this.frameMat);
    frameLine.position.z = -0.01;
    this.group.add(frameLine);

    // Anchor mounting arm
    const armGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.35, 16);
    const armMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.85,
      roughness: 0.3
    });
    const armMesh = new THREE.Mesh(armGeo, armMat);
    armMesh.position.set(0, -height / 2 - 0.17, -0.01);
    this.group.add(armMesh);
  }

  updateVitals(snapshot) {
    this.vitals = snapshot;
    this.needsRender = true;
  }

  updateState(newState, snapshot) {
    if (snapshot) {
      this.updateVitals(snapshot);
    }
  }

  /**
   * Generates authentic ECG Lead II waveform voltage given current cardiac cycle phase (0 to 1)
   */
  getECGVoltage(phase) {
    // Normal Sinus Rhythm P-Q-R-S-T wave model
    if (this.vitals.state === ClinicalStates.CRITICAL_INSULIN) {
      // Dying/arrhythmic agonal rhythm: sluggish, wide bizarre complex with dropped beats
      if (phase < 0.1) return 0;
      if (phase < 0.3) return Math.sin((phase - 0.1) / 0.2 * Math.PI) * 0.25; // wide bizarre wave
      if (phase < 0.45) return -Math.sin((phase - 0.3) / 0.15 * Math.PI) * 0.35;
      if (phase < 0.7) return Math.sin((phase - 0.45) / 0.25 * Math.PI) * 0.15;
      return 0;
    }

    // Normal or Tachycardic Sinus Rhythm
    if (phase < 0.12) {
      // Isoelectric baseline
      return 0;
    } else if (phase >= 0.12 && phase < 0.22) {
      // P Wave (Atrial depolarization)
      const p = (phase - 0.12) / 0.10;
      return Math.sin(p * Math.PI) * 0.18;
    } else if (phase >= 0.22 && phase < 0.28) {
      // PR segment
      return 0;
    } else if (phase >= 0.28 && phase < 0.32) {
      // Q Wave (Septal depolarization)
      const q = (phase - 0.28) / 0.04;
      return -Math.sin(q * Math.PI) * 0.15;
    } else if (phase >= 0.32 && phase < 0.40) {
      // R Wave (Ventricular depolarization spike)
      const r = (phase - 0.32) / 0.08;
      return Math.sin(r * Math.PI) * 1.0;
    } else if (phase >= 0.40 && phase < 0.44) {
      // S Wave (Late ventricular depolarization)
      const s = (phase - 0.40) / 0.04;
      return -Math.sin(s * Math.PI) * 0.28;
    } else if (phase >= 0.44 && phase < 0.52) {
      // ST segment
      return 0;
    } else if (phase >= 0.52 && phase < 0.68) {
      // T Wave (Ventricular repolarization)
      const t = (phase - 0.52) / 0.16;
      return Math.sin(t * Math.PI) * 0.25;
    }
    // TP isoelectric baseline
    return 0;
  }

  /**
   * Per-frame update called in Three.js requestAnimationFrame
   */
  update(deltaSec) {
    this.time += deltaSec;

    // Advance cardiac cycle phase based on current HR
    // HR in beats per minute -> beats per second = HR / 60
    const beatsPerSec = Math.max(20, this.vitals.heartRate) / 60;
    const oldPhase = this.ecgPhase;
    this.ecgPhase = (this.ecgPhase + beatsPerSec * deltaSec) % 1.0;

    // Detect R-wave peak (~0.36 phase) for cardiac beep sound
    if (oldPhase < 0.36 && this.ecgPhase >= 0.36) {
      if (this.soundManager) {
        this.soundManager.playCardiacBeep();
      }
    }

    // Step ECG trace
    const sweepSpeed = 160; // pixels per second
    const prevX = this.ecgCursorX;
    this.ecgCursorX = (this.ecgCursorX + sweepSpeed * deltaSec) % this.ecgWidth;

    const voltage = this.getECGVoltage(this.ecgPhase);
    const y = this.ecgStartY + (this.ecgHeight / 2) - (voltage * (this.ecgHeight * 0.42));

    this.ecgTrace.push({ x: this.ecgStartX + this.ecgCursorX, y: y, timestamp: this.time });

    // Cull old trace points beyond wrap buffer
    const wrapBufferX = 35;
    this.ecgTrace = this.ecgTrace.filter(pt => {
      const dist = (pt.x - this.ecgStartX) - this.ecgCursorX;
      return dist > wrapBufferX || dist < -5;
    });

    // Throttle canvas texture re-render to ~30-45 FPS to conserve Quest GPU/CPU
    if (this.time - this.lastRenderTime >= 0.022) {
      this.lastRenderTime = this.time;
      this.renderCanvas();
      this.texture.needsUpdate = true;
    }

    // Update border glow color
    if (this.vitals.state === ClinicalStates.CRITICAL_INSULIN) {
      const flash = Math.sin(this.time * 8) > 0 ? 0xff1e40 : 0x7f0010;
      this.frameMat.color.setHex(flash);
    } else if (this.vitals.state === ClinicalStates.HYPOGLYCEMIA) {
      this.frameMat.color.setHex(0xf59e0b);
    } else {
      this.frameMat.color.setHex(0x00f0ff);
    }
  }

  /**
   * Draws the high-contrast Glassmorphic UI onto the canvas
   */
  renderCanvas() {
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    ctx.clearRect(0, 0, w, h);

    // 1. Frosted Glass Background
    const isCritical = this.vitals.state === ClinicalStates.CRITICAL_INSULIN;
    const isHypo = this.vitals.state === ClinicalStates.HYPOGLYCEMIA;

    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    if (isCritical) {
      const alpha = 0.75 + Math.sin(this.time * 8) * 0.12;
      bgGrad.addColorStop(0, `rgba(45, 10, 20, ${alpha})`);
      bgGrad.addColorStop(1, `rgba(15, 23, 42, 0.92)`);
    } else if (isHypo) {
      bgGrad.addColorStop(0, 'rgba(30, 25, 45, 0.88)');
      bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
    } else {
      bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.85)');
      bgGrad.addColorStop(1, 'rgba(3, 7, 18, 0.92)');
    }

    this.roundRect(ctx, 4, 4, w - 8, h - 8, 24);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Glass Specular Border
    ctx.lineWidth = 3;
    ctx.strokeStyle = isCritical ? 'rgba(239, 68, 68, 0.85)' : (isHypo ? 'rgba(245, 158, 11, 0.8)' : 'rgba(56, 189, 248, 0.6)');
    ctx.stroke();

    // 2. Header Bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    this.roundRect(ctx, 20, 18, w - 40, 54, 14);
    ctx.fill();

    // Hospital / Multi-Disciplinary Department Tag
    ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94a3b8';
    let deptTag = 'EMERGENCY DEPT • RESUSCITATION BAY 04 • PATIENT T1D-847592';
    if (this.vitals.discipline === 'PARAMEDIC') {
      deptTag = 'EMS RESPONSE • AMBULANCE TRANSPORT • PATIENT T1D-847592';
    } else if (this.vitals.discipline === 'NURSING') {
      deptTag = 'ACUTE INPATIENT WARD • BED 04 • PATIENT T1D-847592';
    } else if (this.vitals.discipline === 'DENTAL') {
      deptTag = 'CHAIRSIDE CLINIC • OPERATORY 04 • PATIENT T1D-847592';
    }
    ctx.fillText(deptTag, 40, 52);

    // State Badge
    let badgeText = 'STATUS: STABLE BASELINE';
    let badgeColor = '#00f0ff';
    let badgeBg = 'rgba(0, 240, 255, 0.15)';

    if (this.vitals.state === ClinicalStates.HYPOGLYCEMIA) {
      badgeText = 'ALERT: SEVERE HYPOGLYCEMIC CRISIS';
      badgeColor = '#fbbf24';
      badgeBg = 'rgba(245, 158, 11, 0.25)';
    } else if (this.vitals.state === ClinicalStates.RECOVERY_GLUCAGON) {
      badgeText = 'SUCCESS: GLUCAGON ADMINISTERED • STABILIZING';
      badgeColor = '#34d399';
      badgeBg = 'rgba(52, 211, 153, 0.25)';
    } else if (this.vitals.state === ClinicalStates.CRITICAL_INSULIN) {
      badgeText = 'CRITICAL OVERDOSE: FATAL INSULIN ERROR';
      badgeColor = '#f87171';
      badgeBg = 'rgba(239, 68, 68, 0.35)';
    }

    const badgeWidth = ctx.measureText(badgeText).width + 36;
    const badgeX = w - 40 - badgeWidth;
    this.roundRect(ctx, badgeX, 26, badgeWidth, 38, 10);
    ctx.fillStyle = badgeBg;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = badgeColor;
    ctx.stroke();

    ctx.fillStyle = badgeColor;
    ctx.font = 'bold 17px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(badgeText, badgeX + 18, 51);

    // 3. ECG Lead II Rhythm Strip Box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    this.roundRect(ctx, this.ecgStartX, this.ecgStartY - 30, this.ecgWidth, this.ecgHeight + 40, 16);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.stroke();

    // ECG Grid lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = this.ecgStartX; x <= this.ecgStartX + this.ecgWidth; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, this.ecgStartY - 30);
      ctx.lineTo(x, this.ecgStartY + this.ecgHeight + 10);
      ctx.stroke();
    }
    for (let y = this.ecgStartY - 30; y <= this.ecgStartY + this.ecgHeight + 10; y += 25) {
      ctx.beginPath();
      ctx.moveTo(this.ecgStartX, y);
      ctx.lineTo(this.ecgStartX + this.ecgWidth, y);
      ctx.stroke();
    }

    // ECG Label
    ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('LEAD II (1mV / 25mm/s)', this.ecgStartX + 16, this.ecgStartY - 8);

    // Draw ECG Trace
    if (this.ecgTrace.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.ecgStartX, this.ecgStartY - 30, this.ecgWidth, this.ecgHeight + 40);
      ctx.clip();

      ctx.lineWidth = 2.8;
      ctx.strokeStyle = isCritical ? '#ef4444' : (isHypo ? '#f59e0b' : '#00f0ff');
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      let first = true;
      for (let i = 0; i < this.ecgTrace.length; i++) {
        const pt = this.ecgTrace[i];
        if (first) {
          ctx.moveTo(pt.x, pt.y);
          first = false;
        } else {
          // Break line if gap (sweep wrap)
          if (Math.abs(pt.x - this.ecgTrace[i - 1].x) > 20) {
            ctx.moveTo(pt.x, pt.y);
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4. Vitals Metric Glass Cards (Right Column)
    const rightColX = 690;
    const cardWidth = 295;

    // Card 1: Heart Rate (HR)
    this.drawMetricCard(
      ctx, rightColX, 100, cardWidth, 100,
      'HEART RATE', `${this.vitals.heartRate}`, 'BPM',
      isCritical ? '#f87171' : (isHypo ? '#fbbf24' : '#00f0ff'),
      '♥'
    );

    // Card 2: Blood Pressure (BP)
    this.drawMetricCard(
      ctx, rightColX, 215, cardWidth, 100,
      'BLOOD PRESSURE', `${this.vitals.systolicBP}/${this.vitals.diastolicBP}`, 'mmHg',
      '#e2e8f0',
      'SYS/DIA'
    );

    // Card 3: Blood Glucose (BG) - HIGHLIGHT CRITICAL
    let bgBadge = 'NORMAL';
    let bgAccent = '#38bdf8';
    if (this.vitals.bloodGlucose < 54) {
      bgBadge = 'CRITICAL LOW';
      bgAccent = isCritical ? '#f87171' : '#fbbf24';
    } else if (this.vitals.bloodGlucose < 70) {
      bgBadge = 'LOW TREND';
      bgAccent = '#fbbf24';
    } else {
      bgBadge = 'STABLE';
      bgAccent = '#34d399';
    }

    this.drawMetricCard(
      ctx, rightColX, 330, cardWidth, 110,
      'BLOOD GLUCOSE', `${this.vitals.bloodGlucose}`, 'mg/dL',
      bgAccent,
      bgBadge
    );

    // 5. Lower Row Cards (Left Side)
    // SpO2
    this.drawMetricCard(
      ctx, 40, 360, 290, 85,
      'PULSE OX (SpO2)', `${this.vitals.spo2}%`, 'PLETH',
      this.vitals.spo2 < 90 ? '#f87171' : '#38bdf8',
      'O2 SAT'
    );

    // Respiration Rate
    this.drawMetricCard(
      ctx, 350, 360, 310, 85,
      'RESPIRATION RATE', `${this.vitals.respirationRate}`, '/min',
      '#e2e8f0',
      'RR'
    );

    // 6. Clinical Guidance Footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    this.roundRect(ctx, 20, 465, w - 40, 90, 16);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();

    ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('COGNITIVE STATUS:', 40, 498);

    ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = isCritical ? '#fca5a5' : (isHypo ? '#fde68a' : '#f8fafc');
    ctx.fillText(this.vitals.cognitiveStatus, 195, 498);

    ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#38bdf8';
    let instruction = 'CLINICAL INSTRUCTION: Monitor vitals trend. Prepare emergency kit if patient decompensates.';
    if (this.vitals.state === ClinicalStates.HYPOGLYCEMIA) {
      instruction = 'ACTION REQUIRED: Administer 1mg GLUCAGON IM from tray. DO NOT administer insulin!';
    } else if (this.vitals.state === ClinicalStates.RECOVERY_GLUCAGON) {
      instruction = 'SUCCESSFUL INTERVENTION: Glycemia recovering. Maintain airway and monitor telemetry.';
    } else if (this.vitals.state === ClinicalStates.CRITICAL_INSULIN) {
      instruction = 'FATAL OVERDOSE ERROR: Patient in severe neuroglycopenic arrest. Initiate resuscitation!';
    }
    ctx.fillText(instruction, 40, 532);
  }

  drawMetricCard(ctx, x, y, w, h, label, value, unit, accentColor, tag) {
    // Glass card background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    this.roundRect(ctx, x, y, w, h, 14);
    ctx.fill();

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();

    // Top Label
    ctx.font = 'bold 14px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(label, x + 16, y + 26);

    // Tag / Badge
    if (tag) {
      ctx.font = 'bold 12px "Segoe UI", Roboto, sans-serif';
      const tagW = ctx.measureText(tag).width + 16;
      this.roundRect(ctx, x + w - tagW - 14, y + 12, tagW, 22, 6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
      ctx.fillStyle = accentColor;
      ctx.fillText(tag, x + w - tagW - 6, y + 27);
    }

    // Large Numeric Value
    ctx.font = 'bold 42px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = accentColor;
    ctx.fillText(value, x + 16, y + 74);

    // Unit
    const valWidth = ctx.measureText(value).width;
    ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(unit, x + 24 + valWidth, y + 72);
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
