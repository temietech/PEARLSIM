/**
 * PatientAvatar.js - Realistic Seated Patient Avatar
 * Delivers natural semi-supine posture in the dental chair,
 * 3D oral cavity with tongue angioedema macroglossia, diaphoresis sheen,
 * and Vastus Lateralis thigh resuscitation target.
 */

import * as THREE from 'three';

export class PatientAvatar {
  constructor(gltfLoader, clinicalEngine, soundManager) {
    this.gltfLoader = gltfLoader;
    this.clinicalEngine = clinicalEngine;
    this.soundManager = soundManager;

    this.group = new THREE.Group();
    this.group.name = 'SeatedClinicalPatient';

    this.bones = {};
    this.skinMaterials = [];
    this.headMesh = null;
    this.teethMesh = null;
    this.time = 0;

    this.loadPatientModel();
    this.buildClinicalTargets();
  }

  loadPatientModel() {
    this.gltfLoader.load(
      './models/patient.glb',
      (gltf) => {
        const model = gltf.scene;
        this.model = model;

        // Position squarely in treatment chair facing +Z (toward clinician)
        model.scale.set(0.92, 0.92, 0.92);
        model.rotation.y = 0;
        model.position.set(0, -0.388, -0.147);

        // Catalog bones and cache pristine rest pose
        this.bones = {};
        this.skinMaterials = [];

        model.traverse((child) => {
          if (child.isBone) {
            this.bones[child.name] = child;
            child.userData.restQuaternion = child.quaternion.clone();
            child.userData.restPosition = child.position.clone();
          }

          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.name === 'Wolf3D_Head') this.headMesh = child;
            if (child.name === 'Wolf3D_Teeth') this.teethMesh = child;

            if (child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach(mat => {
                if (mat.name && (mat.name.includes('Skin') || mat.name.includes('Head') || mat.name.includes('Body'))) {
                  if (!this.skinMaterials.includes(mat)) {
                    child.material = mat.clone();
                    this.skinMaterials.push(child.material);
                  }
                }
              });
            }
          }
        });

        // Pose naturally seated and reclined in dental chair
        this.poseSeated();

        // Build 3D oral cavity anatomy mounted to the Head bone
        this.buildOralCavity();

        // Apply inclusive dermatology shaders
        this.applyDermatology();

        // Default open mouth for dental inspection
        this.setOralInspectionMode(false);

        this.group.add(model);
      },
      undefined,
      (err) => {
        console.error('[PatientAvatar] Error loading model:', err);
      }
    );
  }

  buildOralCavity() {
    if (!this.bones.Head) return;

    this.oralCavityGroup = new THREE.Group();
    this.oralCavityGroup.name = 'OralCavityAnatomy';

    // Anatomical Tongue positioned inside mouth cavity of Head bone
    const tongueGeo = new THREE.SphereGeometry(0.016, 20, 14);
    tongueGeo.scale(1.0, 0.45, 1.5);
    this.tongueMaterial = new THREE.MeshStandardMaterial({
      color: 0xbe185d,
      roughness: 0.35,
      metalness: 0.05
    });
    this.tongueMesh = new THREE.Mesh(tongueGeo, this.tongueMaterial);
    // Relative to Head bone: mouth cavity sits inside oral vault at (+0.0, +0.012, +0.055)
    this.tongueMesh.position.set(0, 0.012, 0.055);
    this.oralCavityGroup.add(this.tongueMesh);

    // Anatomical Uvula
    const uvulaGeo = new THREE.CylinderGeometry(0.002, 0.004, 0.012, 10);
    this.uvulaMaterial = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 });
    this.uvulaMesh = new THREE.Mesh(uvulaGeo, this.uvulaMaterial);
    this.uvulaMesh.position.set(0, 0.045, 0.055);
    this.oralCavityGroup.add(this.uvulaMesh);

    this.bones.Head.add(this.oralCavityGroup);
  }

  setOralInspectionMode(isInspecting) {
    // Routine checkup baseline mouthOpen = 0.65; macro inspection mouthOpen = 0.85
    const targetMouth = isInspecting ? 0.85 : 0.65;

    if (this.headMesh && this.headMesh.morphTargetDictionary) {
      const idx = this.headMesh.morphTargetDictionary['mouthOpen'];
      if (idx !== undefined && this.headMesh.morphTargetInfluences) {
        this.headMesh.morphTargetInfluences[idx] = targetMouth;
      }
    }
    if (this.teethMesh && this.teethMesh.morphTargetDictionary) {
      const idx = this.teethMesh.morphTargetDictionary['mouthOpen'];
      if (idx !== undefined && this.teethMesh.morphTargetInfluences) {
        this.teethMesh.morphTargetInfluences[idx] = targetMouth;
      }
    }

    // Dynamic tongue angioedema in anaphylaxis
    if (this.tongueMesh) {
      if (this.clinicalEngine.activeCase.id === 'ANAPHYLAXIS' && this.clinicalEngine.isEmergencyTriggered && !this.clinicalEngine.isResuscitated) {
        // Severe macroglossia swelling occluding the pharyngeal airway
        this.tongueMesh.scale.set(1.5, 1.0, 2.0);
        this.tongueMaterial.color.setHex(0x9d174d); // Deep swollen mucosal erythema
      } else {
        this.tongueMesh.scale.set(1.0, 0.45, 1.5);
        this.tongueMaterial.color.setHex(this.clinicalEngine.patientRecord.dermatology.oralMucosaHealthy);
      }
    }
  }

  poseSeated() {
    const b = this.bones;
    if (!b || !b.Hips) return;

    // Reset to rest pose
    Object.values(this.bones).forEach(bone => {
      if (bone.userData.restQuaternion) {
        bone.quaternion.copy(bone.userData.restQuaternion);
      }
    });

    // 1. Thighs bend forward resting flat on dental seat cushion (+82 deg)
    if (b.LeftUpLeg) {
      b.LeftUpLeg.rotateX(Math.PI * 0.46);
      b.LeftUpLeg.rotateZ(-0.04);
    }
    if (b.RightUpLeg) {
      b.RightUpLeg.rotateX(Math.PI * 0.46);
      b.RightUpLeg.rotateZ(0.04);
    }

    // 2. Knees bend naturally along chair contour (-20 deg)
    if (b.LeftLeg) b.LeftLeg.rotateX(-0.35);
    if (b.RightLeg) b.RightLeg.rotateX(-0.35);

    // 3. Feet flat on footrest
    if (b.LeftFoot) b.LeftFoot.rotateX(0.28);
    if (b.RightFoot) b.RightFoot.rotateX(0.28);

    // 4. Authentic semi-supine dental chair recline (~28-30 deg backrest angle)
    if (b.Spine) b.Spine.rotateX(-0.45);
    if (b.Spine1) b.Spine1.rotateX(-0.20);
    if (b.Spine2) b.Spine2.rotateX(-0.12);

    // 5. Neck & Head angled comfortably upward toward standing clinician
    if (b.Neck) b.Neck.rotateX(0.26);
    if (b.Head) b.Head.rotateX(0.18);

    // 6. Arms resting comfortably on chair armrests
    if (b.LeftArm) {
      b.LeftArm.rotateZ(-0.38);
      b.LeftArm.rotateX(0.15);
    }
    if (b.LeftForeArm) b.LeftForeArm.rotateY(0.22);

    if (b.RightArm) {
      b.RightArm.rotateZ(0.38);
      b.RightArm.rotateX(0.15);
    }
    if (b.RightForeArm) b.RightForeArm.rotateY(-0.22);
  }

  buildClinicalTargets() {
    // 1. APPROVED ANTEROLATERAL THIGH (VASTUS LATERALIS) TARGET
    const thighGroup = new THREE.Group();
    thighGroup.name = 'VastusLateralisTarget';
    thighGroup.userData = { siteId: 'VASTUS_LATERALIS', title: 'Vastus Lateralis (Thigh)' };

    this.thighTargetMat = new THREE.MeshBasicMaterial({
      color: 0x10b981, // Clean emerald green
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.055, 32), this.thighTargetMat);
    ring.rotation.x = -Math.PI / 2;
    thighGroup.add(ring);

    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.02, 24),
      new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    core.rotation.x = -Math.PI / 2;
    thighGroup.add(core);

    // Institutional Target Plaque
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 440; labelCanvas.height = 70;
    const ctx = labelCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fillRect(0, 0, 440, 70);
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, 434, 64);
    ctx.fillStyle = '#10b981'; ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('APPROVED IM: VASTUS LATERALIS', 220, 35);

    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.04), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true }));
    labelMesh.position.set(0, 0.03, 0);
    labelMesh.rotation.x = -Math.PI / 3;
    thighGroup.add(labelMesh);

    thighGroup.position.set(0.18, 0.52, 0.05);
    // Hidden by default until medication administration phase!
    thighGroup.visible = false;
    this.group.add(thighGroup);
    this.thighTarget = thighGroup;

    // 2. RADIAL PULSE HOTSPOT (Left Wrist)
    const pulseGroup = new THREE.Group();
    pulseGroup.name = 'RadialPulseHotspot';
    pulseGroup.userData = { siteId: 'RADIAL_PULSE', title: 'Radial Pulse (Left Wrist)' };

    const pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.015, 0.028, 24),
      new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
    );
    pulseRing.rotation.x = -Math.PI / 2;
    pulseGroup.add(pulseRing);

    pulseGroup.position.set(-0.30, 0.62, -0.12);
    pulseGroup.visible = false;
    this.group.add(pulseGroup);
    this.pulseHotspot = pulseGroup;
  }

  setThighTargetVisible(visible) {
    if (this.thighTarget) {
      this.thighTarget.visible = visible;
    }
  }

  setPulseHotspotVisible(visible) {
    if (this.pulseHotspot) {
      this.pulseHotspot.visible = visible;
    }
  }

  applyDermatology() {
    const derm = this.clinicalEngine.patientRecord.dermatology;
    const isShock = this.clinicalEngine.isEmergencyTriggered && !this.clinicalEngine.isResuscitated;

    this.skinMaterials.forEach(mat => {
      if (isShock) {
        mat.color.setHex(derm.ashenShockHex); // Ashen slate-gray hypoperfusion
        mat.roughness = derm.diaphoresisGloss; // High specular cold sweat sheen
      } else {
        mat.color.setHex(derm.skinHex);
        mat.roughness = 0.55;
      }
    });

    if (this.tongueMaterial) {
      this.tongueMaterial.color.setHex(isShock ? derm.oralMucosaCyanotic : derm.oralMucosaHealthy);
      if (this.clinicalEngine.isResuscitated && this.tongueMesh) {
        this.tongueMesh.scale.set(1.1, 0.45, 1.6);
      }
    }
  }

  getThighWorldPosition() {
    const pos = new THREE.Vector3();
    if (this.thighTarget) {
      this.thighTarget.getWorldPosition(pos);
    } else {
      pos.set(0.18, 0.52, -1.20);
    }
    return pos;
  }

  update(deltaSec) {
    this.time += deltaSec;

    const b = this.bones;
    if (!b || !b.Spine) return;

    // Dynamic respiration rise and fall
    const respRate = Math.max(6, this.clinicalEngine.vitals.respirationRate);
    const respCyclesPerSec = respRate / 60;
    const breathPhase = Math.sin(this.time * respCyclesPerSec * Math.PI * 2);

    if (b.Spine1 && b.Spine2) {
      b.Spine1.rotation.x = -0.20 + (breathPhase * 0.035);
      b.Spine2.rotation.x = -0.12 + (breathPhase * 0.045);
    }

    // Dynamic tremors in Hypoglycemia
    if (this.clinicalEngine.vitals.tremorLevel > 0.05) {
      const tremorFreq = 26;
      const jiggle = Math.sin(this.time * tremorFreq) * (0.015 * this.clinicalEngine.vitals.tremorLevel);
      if (b.Head) b.Head.rotation.z = jiggle * 2.0;
      if (b.RightArm) b.RightArm.rotation.x = 0.15 + jiggle;
      if (b.LeftArm) b.LeftArm.rotation.x = 0.15 - jiggle;
    }

    // Thigh Target Pulse
    if (this.thighTarget && this.thighTarget.visible && this.thighTargetMat) {
      this.thighTargetMat.opacity = 0.55 + Math.sin(this.time * 5) * 0.35;
    }
  }
}
