/**
 * ClinicalEnvironment.js
 * 
 * Multi-Disciplinary Healthcare Emergency Suite:
 * Designed for Medical (ER/Hospital), Nursing (Acute Care/Ward),
 * Paramedic (EMS Emergency Response), and Dental clinical contexts.
 * 
 * Provides an open, completely unobstructed 3D scene:
 * - Clean overview of the patient, treatment chair/gurney, clinical assistant,
 *   floating spatial vitals monitor, and bedside emergency drug tray.
 * - Soft surgical overhead lighting ensuring clear visual illumination.
 * - Background clinical architecture (resuscitation bay walls, medical counters, monitors).
 */

import * as THREE from 'three';

export class ClinicalEnvironment {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'UniversalClinicalEnvironment';

    this.buildOverheadLighting();
    this.buildRoomArchitecture();
  }

  buildOverheadLighting() {
    // Ambient clinical illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    this.group.add(ambientLight);

    // Key examination surgical light (casts crisp illumination across patient and tray)
    const keyLight = new THREE.DirectionalLight(0xf8fafc, 1.8);
    keyLight.position.set(1.5, 3.8, 1.5);
    this.group.add(keyLight);

    // Fill soft blue clinical light
    const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.85);
    fillLight.position.set(-2.0, 3.0, 0.5);
    this.group.add(fillLight);

    // Subtle edge rim light for glassmorphism panels
    const rimLight = new THREE.PointLight(0x00f0ff, 1.2, 8);
    rimLight.position.set(0, 2.2, -2.8);
    this.group.add(rimLight);
  }

  buildRoomArchitecture() {
    this.roomGroup = new THREE.Group();
    this.roomGroup.name = 'ClinicalRoomArchitecture';

    // Neutral, modern hospital / resuscitation bay materials
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Clean medical polyurethane flooring
      roughness: 0.35,
      metalness: 0.1
    });

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Hospital off-white sterile wall
      roughness: 0.85
    });

    const accentWallMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.8
    });

    const cabinetMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.7,
      roughness: 0.25
    });

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.roomGroup.add(floor);

    // Grid Floor Accents (subtle orientation markers for XR space)
    const gridHelper = new THREE.GridHelper(10, 20, 0x00f0ff, 0x475569);
    gridHelper.position.y = 0.001;
    this.roomGroup.add(gridHelper);

    // Back Wall
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.5), wallMat);
    backWall.position.set(0, 2.25, -4.2);
    this.roomGroup.add(backWall);

    // Protective medical bumper rail along back wall
    const wallRail = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 0.04), trimMat);
    wallRail.position.set(0, 0.95, -4.18);
    this.roomGroup.add(wallRail);

    // Left Wall
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.5), accentWallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-4.5, 2.25, 0);
    this.roomGroup.add(leftWall);

    // Background Medical Cabinetry & Resuscitation Crash Cart Station
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.92, 0.65), cabinetMat);
    counter.position.set(0.8, 0.46, -3.8);
    this.roomGroup.add(counter);

    // Stainless steel sink / wash basin
    const sinkMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 });
    const sink = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.16, 0.14, 24), sinkMat);
    sink.position.set(1.6, 0.93, -3.8);
    this.roomGroup.add(sink);

    // Medical Telemetry Display on Wall (ER Doctor & Inpatient Ward)
    const telemetryFrame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.68, 0.04), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    telemetryFrame.position.set(0.6, 2.1, -4.16);
    this.roomGroup.add(telemetryFrame);

    const telemetryScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.02, 0.60),
      new THREE.MeshBasicMaterial({ color: 0x030712 })
    );
    telemetryScreen.position.set(0.6, 2.1, -4.13);
    this.roomGroup.add(telemetryScreen);

    this.wallTelemetry = telemetryFrame;
    this.wallTelemetryScreen = telemetryScreen;

    // Overhead Clinical Light Fixture (suspended comfortably above)
    const lampFixture = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.35), cabinetMat);
    lampFixture.position.set(0, 2.8, -1.2);
    this.roomGroup.add(lampFixture);

    this.group.add(this.roomGroup);
  }

  setDiscipline(discipline) {
    // In dental practice, wall-mounted cardiac telemetry displays are absent
    const isDental = (discipline === 'DENTAL');
    if (this.wallTelemetry) this.wallTelemetry.visible = !isDental;
    if (this.wallTelemetryScreen) this.wallTelemetryScreen.visible = !isDental;
  }

  setPassthroughMode(isPassthrough) {
    if (this.roomGroup) {
      this.roomGroup.visible = !isPassthrough;
    }
  }

  setARMode(isAR) {
    this.setPassthroughMode(isAR);
  }

  update(deltaSec) {
    // Dynamic subtle animation if needed
  }
}
