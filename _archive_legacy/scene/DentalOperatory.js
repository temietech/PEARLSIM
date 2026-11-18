/**
 * DentalOperatory.js
 * 
 * First-person Dental Operatory Environment matching the Unreal Engine prototype (Image 3):
 * 1. Dentist POV gloved hands holding Dental Mirror & Explorer/Probe
 * 2. Operative dental bracket table with instruments (mirror, explorer, periodontal probe)
 * 3. Dental overhead examination light fixture with focused surgical spotlight
 * 4. Background operatory clinic cabinetry & walls (visible in Desktop/VR, hidden in AR passthrough)
 */

import * as THREE from 'three';
import { HumanGenerator } from './HumanGenerator.js';

export class DentalOperatory {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'DentalOperatoryEnvironment';

    // 1. First-Person Dentist Gloved Hands (Anchored in front of camera)
    this.handsNode = HumanGenerator.createDentistPOVHands();
    this.group.add(this.handsNode);

    // 2. Operative Dental Bracket Table (Foreground sterile blue tray holding instruments)
    this.buildOperativeBracketTable();

    // 3. Overhead Dental Examination Lamp
    this.buildOverheadDentalLamp();

    // 4. Clinical Dental Room (Walls & Cabinetry)
    this.buildOperatoryRoom();
  }

  buildOperativeBracketTable() {
    const tableGroup = new THREE.Group();
    tableGroup.name = 'OperativeBracketTable';

    const steelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
    const drapeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.85 }); // Surgical blue

    // Stainless steel bracket arm & tray table right in front of dentist
    const trayTop = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.015, 0.32), steelMat);
    trayTop.position.set(0, 0.82, -0.65);
    tableGroup.add(trayTop);

    // Blue sterile instrument cloth
    const drape = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.004, 0.30), drapeMat);
    drape.position.set(0, 0.83, -0.65);
    tableGroup.add(drape);

    // Instruments resting on the sterile cloth (matching Image 3)
    const instMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.1 });

    // Dental Mirror resting on tray
    const m1 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.16, 12), instMat);
    m1.rotation.x = Math.PI / 2;
    m1.position.set(-0.14, 0.84, -0.65);
    tableGroup.add(m1);

    // Periodontal probe resting on tray
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.16, 12), instMat);
    p1.rotation.x = Math.PI / 2;
    p1.position.set(-0.05, 0.84, -0.65);
    tableGroup.add(p1);

    // Dental Explorer resting on tray
    const e1 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.16, 12), instMat);
    e1.rotation.x = Math.PI / 2;
    e1.position.set(0.05, 0.84, -0.65);
    tableGroup.add(e1);

    // Cotton pliers / tweezers
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.004, 0.15), instMat);
    c1.position.set(0.14, 0.84, -0.65);
    tableGroup.add(c1);

    this.group.add(tableGroup);
  }

  buildOverheadDentalLamp() {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(0.25, 2.1, -1.2);

    const casingMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Dual LED reflector head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.16), casingMat);
    lampGroup.add(head);

    const lens1 = new THREE.Mesh(new THREE.CircleGeometry(0.038, 24), lensMat);
    lens1.position.set(-0.06, -0.061, 0);
    lens1.rotation.x = Math.PI / 2;
    lampGroup.add(lens1);

    const lens2 = new THREE.Mesh(new THREE.CircleGeometry(0.038, 24), lensMat);
    lens2.position.set(0.06, -0.061, 0);
    lens2.rotation.x = Math.PI / 2;
    lampGroup.add(lens2);

    // Articulated lamp arm
    const armMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 });
    const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.75, 16), armMat);
    arm1.position.set(0.18, 0.25, -0.15);
    arm1.rotation.z = -0.6;
    lampGroup.add(arm1);

    // Focused surgical spotlight aimed directly into patient's oral cavity
    this.spotLight = new THREE.SpotLight(0xfff7ed, 2.2, 5.0, Math.PI / 6, 0.35, 1.2);
    this.spotLight.position.set(0, 0, 0);
    this.spotLight.target.position.set(-0.25, -1.1, -0.35); // Points at patient face
    lampGroup.add(this.spotLight);
    lampGroup.add(this.spotLight.target);

    this.group.add(lampGroup);
  }

  buildOperatoryRoom() {
    this.roomGroup = new THREE.Group();
    this.roomGroup.name = 'ClinicOperatoryRoom';

    // Modern dental clinic wall paneling (matching Image 3 soft teal & white clinical look)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.85 });
    const accentWallMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.8 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.1 }); // Medical vinyl floor
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, transmission: 0.85, roughness: 0.1, transparent: true });

    // Clinic Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.roomGroup.add(floor);

    // Back Wall
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), wallMat);
    backWall.position.set(0, 2, -3.8);
    this.roomGroup.add(backWall);

    // Left Wall
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), accentWallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-3.5, 2, 0);
    this.roomGroup.add(leftWall);

    // Clinic Cabinetry & Wash Counter (matching Image 3 background)
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.95, 0.65), cabinetMat);
    counter.position.set(0.6, 0.475, -2.8);
    this.roomGroup.add(counter);

    // Sink basin
    const sinkMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.12, 24), sinkMat);
    basin.position.set(1.2, 0.95, -2.8);
    this.roomGroup.add(basin);

    // Autoclave / Sterilization unit on counter
    const autoclave = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 0.45), sinkMat);
    autoclave.position.set(0.1, 1.15, -2.8);
    this.roomGroup.add(autoclave);

    // Dental X-ray monitor on wall
    const monitorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.04), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    monitorFrame.position.set(0.6, 1.9, -3.75);
    this.roomGroup.add(monitorFrame);

    const monitorScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.48), glassMat);
    monitorScreen.position.set(0.6, 1.9, -3.72);
    this.roomGroup.add(monitorScreen);

    this.group.add(this.roomGroup);
  }

  setARMode(isAR) {
    // In AR passthrough mode on Quest 3, hide room geometry so physical room shows
    if (this.roomGroup) {
      this.roomGroup.visible = !isAR;
    }
  }

  update(deltaSec) {
    // Subtle breathing drift in first-person dentist hands
    if (this.handsNode) {
      const breath = Math.sin(performance.now() * 0.002) * 0.003;
      this.handsNode.position.y = breath;
    }
  }
}
