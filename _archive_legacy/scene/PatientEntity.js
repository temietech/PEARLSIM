/**
 * PatientEntity.js
 * 
 * Clinical Patient & Assistant Entity for PEARLSIM:
 * - Loads authentic 3D Clinical Treatment Recliner (dental_chair.glb)
 * - Aligns chair along Z-axis (headrest at back, footrest at front)
 * - Removes obstructive overhead lamp arms that block clinician sightlines
 * - Seats the realistic 3D Human Patient avatar flush on the cushion
 * - Poses thighs forward, knees over leg contour, arms relaxed on armrests
 * - Supports diverse demographics:
 *   - African / Black (Fitzpatrick V-VI): Ashen slate-gray hypoperfusion & cold diaphoresis gloss
 *   - Caucasian (Fitzpatrick I-II): Chalky blanched pallor & erythema
 *   - Asian (Fitzpatrick III-IV): Sallow ashen hypoperfusion
 *   - Geriatric (80-year-old): Thinned skin, altered postural tone
 * - Trendelenburg hydraulic tilt animation
 * - Interactive radial pulse check on patient wrist
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { ClinicalStates, EmergencyScenarios, DemographicProfiles } from '../core/ClinicalStateMachine.js';

export class PatientEntity {
  constructor(soundManager) {
    this.soundManager = soundManager;
    this.group = new THREE.Group();
    this.group.name = 'Clinical_PatientEntity';

    this.currentState = ClinicalStates.BASELINE;
    this.scenario = EmergencyScenarios.HYPOGLYCEMIA;
    this.demographic = DemographicProfiles.AFRICAN_GERIATRIC_F;

    this.shiveringIntensity = 0.0;
    this.respirationRate = 14;
    this.time = 0;
    this.chairReclineAngle = 0;
    this.targetChairRecline = 0;

    // Bone & Material references
    this.bones = {};
    this.skinMaterials = [];
    this.headMesh = null;
    this.patientModel = null;
    this.patientLoaded = false;

    // Setup GLTF & Draco loaders
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);

    // Root node for the chair and seated patient (tilts together for Trendelenburg)
    this.chairAndPatientNode = new THREE.Group();
    this.chairAndPatientNode.name = 'ChairAndPatientNode';
    this.group.add(this.chairAndPatientNode);

    // 1. Load Clinical Treatment Chair
    this.loadTreatmentChair();

    // 2. Load Realistic 3D Patient Character
    this.loadPatientCharacter();

    // 3. Load Realistic 3D Clinical Assistant in Scrubs
    this.loadClinicalAssistant();

    // 4. Setup IV Cannula / Injection Port & Radial Pulse Hotspot
    this.buildClinicalHotspots();
  }

  setDemographic(demo) {
    this.demographic = demo || DemographicProfiles.AFRICAN_GERIATRIC_F;
    this.applyDemographicSkin();
  }

  setScenario(scenario) {
    this.scenario = scenario;
  }

  loadTreatmentChair() {
    this.chairGroup = new THREE.Group();
    this.chairGroup.name = 'TreatmentChairModel';

    this.gltfLoader.load(
      './models/dental_chair.glb',
      (gltf) => {
        const model = gltf.scene;

        // Scale factor: aligns chair length (~1.85m) and seat cushion height (~0.57m)
        const scale = 0.0098;
        model.scale.set(scale, scale, scale);

        // EXACT ROTATION & ORIENTATION FIX:
        // In dental_chair.glb, chair longitudinal axis from headrest to footrest is at 130.9 deg (2.285 rad).
        // Rotating by -2.285 rad aligns the chair exactly straight along +Z (headrest at -Z back, footrest at +Z front).
        model.rotation.y = -2.285;

        // Centering offset:
        // Rotated model cushion centerline is offset by X = -16.51 in model units.
        // Offsetting X by +16.51 * scale (+0.162m) squares the cushions exactly at X = 0.00m.
        // Base plate is aligned flush with floor (Y = -0.022m).
        // Seat cushion is placed at Z = -0.15m directly underneath patient hips.
        model.position.set(0.162, -0.022, 0.11);

        // Hide clutter meshes: overhead lamp, drill delivery unit, hanging drill hoses, floating brackets
        const clutterNames = [
          'Object_11', 'Object_12', 'Object_18', 'Object_19', 'Object_20',
          'Object_23', 'Object_26', 'Object_27', 'Object_28', 'Object_29',
          'Object_30', 'Object_33'
        ];

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (clutterNames.includes(child.name)) {
              child.visible = false;
            }

            if (child.material && child.material.isMeshStandardMaterial) {
              // Clinical medical upholstery leather for cushions (Object_4, Object_15, Object_36, Object_54)
              if (child.name === 'Object_4' || child.name === 'Object_15' || child.name === 'Object_36' || child.name === 'Object_54') {
                child.material.color.setHex(0x1e3a8a); // Clinical navy blue upholstery
                child.material.roughness = 0.42;
                child.material.metalness = 0.05;
              } else {
                // Chair structural frame & chrome
                child.material.roughness = Math.min(0.35, child.material.roughness);
                child.material.metalness = Math.max(0.65, child.material.metalness);
              }
            }
          }
        });

        this.chairGroup.add(model);
      },
      undefined,
      (err) => {
        console.warn('[PatientEntity] Chair fallback.', err);
        this.buildFallbackChair();
      }
    );

    this.chairAndPatientNode.add(this.chairGroup);
  }

  buildFallbackChair() {
    const chair = new THREE.Group();
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.35, metalness: 0.1 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 0.12, 32), chromeMat);
    base.position.y = 0.06;
    chair.add(base);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.50, 24), chromeMat);
    pillar.position.y = 0.35;
    chair.add(pillar);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.65), leatherMat);
    seat.position.set(0, 0.58, -0.05);
    chair.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.75), leatherMat);
    back.rotation.x = -0.32;
    back.position.set(0, 0.85, -0.42);
    chair.add(back);

    this.chairGroup.add(chair);
  }

  loadPatientCharacter() {
    this.patientGroup = new THREE.Group();
    this.patientGroup.name = 'Patient_Demographic';

    this.gltfLoader.load(
      './models/patient.glb',
      (gltf) => {
        const model = gltf.scene;
        this.patientModel = model;

        // Position patient avatar squarely in the chair facing +Z (toward clinician)
        // Scale 0.92, hips (y=1.037 * 0.92 = 0.954m) with position.y = -0.388m places hips flush on cushion (y = 0.566m, z = -0.147m)
        model.scale.set(0.92, 0.92, 0.92);
        model.rotation.y = 0; // Faces directly forward (+Z) toward clinician
        model.position.set(0, -0.388, -0.147);

        // Catalog bones and save rest quaternions to prevent coordinate deformation
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

            if (child.name === 'Wolf3D_Head') {
              this.headMesh = child;
            }
            if (child.name === 'Wolf3D_Teeth') {
              this.teethMesh = child;
            }

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

        // Build internal anatomical Oral Cavity (tongue angioedema & uvula)
        this.buildOralCavity(model);

        // Pose patient naturally seated in the reclined clinical treatment chair
        this.posePatientSeated();

        // Apply selected demographic skin tone & shaders
        this.applyDemographicSkin();

        this.patientGroup.add(model);
        this.patientLoaded = true;
      },
      undefined,
      (err) => {
        console.error('[PatientEntity] Error loading patient.glb:', err);
      }
    );

    this.chairAndPatientNode.add(this.patientGroup);
  }

  buildOralCavity(patientModel) {
    this.oralCavityGroup = new THREE.Group();
    this.oralCavityGroup.name = 'OralCavityAirway';

    // Anatomical Tongue
    const tongueGeo = new THREE.SphereGeometry(0.024, 24, 16);
    tongueGeo.scale(1.1, 0.4, 1.8);
    this.tongueMaterial = new THREE.MeshStandardMaterial({
      color: 0xe11d48, // Healthy pink mucosa
      roughness: 0.35, // Moist specular gloss
      metalness: 0.05
    });
    this.tongueMesh = new THREE.Mesh(tongueGeo, this.tongueMaterial);
    this.tongueMesh.position.set(0, 1.48, 0.06);
    this.oralCavityGroup.add(this.tongueMesh);

    // Anatomical Uvula & Soft Palate
    const uvulaGeo = new THREE.CylinderGeometry(0.003, 0.005, 0.015, 12);
    this.uvulaMaterial = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.4
    });
    this.uvulaMesh = new THREE.Mesh(uvulaGeo, this.uvulaMaterial);
    this.uvulaMesh.position.set(0, 1.515, 0.035);
    this.oralCavityGroup.add(this.uvulaMesh);

    patientModel.add(this.oralCavityGroup);
  }

  setOralInspectionMode(isOpen) {
    this.isOralInspecting = isOpen;
    const targetMouth = isOpen ? 0.85 : 0.0;

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
      if (this.scenario === EmergencyScenarios.ANAPHYLAXIS && isOpen) {
        // Severe macroglossia (swollen tongue occluding oral airway)
        this.tongueMesh.scale.set(1.5, 0.85, 2.1);
        this.tongueMaterial.color.setHex(0xd946ef); // Erythematous/purplish swelling
      } else {
        this.tongueMesh.scale.set(1.1, 0.4, 1.8);
        this.tongueMaterial.color.setHex(0xe11d48);
      }
    }
  }

  posePatientSeated() {
    const b = this.bones;
    if (!b || !b.Hips) return;

    // 1. Reset all bones to pristine rest pose
    Object.values(this.bones).forEach(bone => {
      if (bone.userData.restQuaternion) {
        bone.quaternion.copy(bone.userData.restQuaternion);
      }
    });

    // 2. Both thighs bend forward squarely resting on seat cushion
    // In ReadyPlayerMe/Mixamo humanoid rig, local +X rotation bends femur forward along +Z
    if (b.LeftUpLeg) {
      b.LeftUpLeg.rotateX(Math.PI * 0.44); // ~79 degrees forward
      b.LeftUpLeg.rotateZ(-0.05); // natural outward thigh splay
    }
    if (b.RightUpLeg) {
      b.RightUpLeg.rotateX(Math.PI * 0.44); // ~79 degrees forward
      b.RightUpLeg.rotateZ(0.05); // natural outward thigh splay
    }

    // 3. Both knees bend naturally over the leg contour downward onto footrest
    // Local -X rotation bends knee downward along chair contour
    if (b.LeftLeg) {
      b.LeftLeg.rotateX(-0.35); // ~20 degrees downward contour
    }
    if (b.RightLeg) {
      b.RightLeg.rotateX(-0.35); // ~20 degrees downward contour
    }

    // 4. Feet resting flat on footrest
    if (b.LeftFoot) {
      b.LeftFoot.rotateX(0.28);
    }
    if (b.RightFoot) {
      b.RightFoot.rotateX(0.28);
    }

    // 5. Spine and torso reclining comfortably back into the backrest
    if (b.Spine) {
      b.Spine.rotateX(-0.16);
    }
    if (b.Spine1) {
      b.Spine1.rotateX(-0.08);
    }
    if (b.Spine2) {
      b.Spine2.rotateX(-0.05);
    }

    // 6. Neck & Head: resting against headrest, tilting forward to face clinician
    const ageTilt = (this.demographic && this.demographic.age > 75) ? 0.24 : 0.16;
    if (b.Neck) {
      b.Neck.rotateX(ageTilt);
    }
    if (b.Head) {
      b.Head.rotateX(0.08);
    }

    // 7. Left arm resting comfortably on left armrest
    if (b.LeftArm) {
      b.LeftArm.rotateZ(-0.38);
      b.LeftArm.rotateX(0.20);
    }
    if (b.LeftForeArm) {
      b.LeftForeArm.rotateY(0.25);
    }

    // 8. Right arm resting comfortably on right armrest near IV/thigh
    if (b.RightArm) {
      b.RightArm.rotateZ(0.38);
      b.RightArm.rotateX(0.20);
    }
    if (b.RightForeArm) {
      b.RightForeArm.rotateY(-0.25);
    }
  }

  applyDemographicSkin() {
    const demo = this.demographic || DemographicProfiles.AFRICAN_GERIATRIC_F;
    const isDecompensating = (this.currentState === ClinicalStates.DECOMPENSATING || this.currentState === ClinicalStates.CRITICAL_ERROR);

    this.skinMaterials.forEach(skinMat => {
      if (isDecompensating) {
        // Hypoperfused Pallor: In dark skin, turns ashen slate-gray with high specular cold sweat sheen
        skinMat.color.setHex(demo.ashenHex);
        skinMat.roughness = demo.sweatRoughness; // Specular cold diaphoresis sweat droplets
      } else {
        // Normal healthy warm perfusion
        skinMat.color.setHex(demo.skinHex);
        skinMat.roughness = 0.55;
      }
    });
  }

  loadClinicalAssistant() {
    this.assistantGroup = new THREE.Group();
    this.assistantGroup.name = 'Assistant_Sarah';

    this.gltfLoader.load(
      './models/assistant_female.glb',
      (gltf) => {
        const model = gltf.scene;

        // Position standing attentively on floor beside the treatment unit
        model.scale.set(0.92, 0.92, 0.92);
        model.position.set(-0.75, 0, -0.25);
        model.rotation.y = 1.25; // Face patient/chair (~72 degrees)

        // Give assistant authentic teal scrubs & remove novelty party accessories
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // Remove reindeer antlers and novelty glasses
            if (child.name === 'Wolf3D_Glasses') {
              child.visible = false;
            }

            // Uniform clinical scrubs (hospital teal #0e7490)
            if (child.name === 'Wolf3D_Outfit_Top' || child.name === 'Wolf3D_Outfit_Bottom') {
              if (child.material) {
                const mat = child.material.clone();
                mat.map = null; // Clear graphic patterns
                mat.color.setHex(0x0e7490); // Teal scrubs
                mat.roughness = 0.8;
                mat.metalness = 0.05;
                mat.needsUpdate = true;
                child.material = mat;
              }
            }
          }
        });

        this.assistantGroup.add(model);
      },
      undefined,
      (err) => {
        console.warn('[PatientEntity] Assistant model skipped:', err);
      }
    );

    this.group.add(this.assistantGroup);
  }

  buildClinicalHotspots() {
    // 1. APPROVED ANTEROLATERAL THIGH (VASTUS LATERALIS) - PRIMARY IM RESUSCITATION TARGET
    const thighGroup = new THREE.Group();
    thighGroup.name = 'VastusLateralisTarget';

    this.thighTargetMat = new THREE.MeshBasicMaterial({
      color: 0x10b981, // Neon Green
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const thighRing = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.055, 32), this.thighTargetMat);
    thighRing.rotation.x = -Math.PI / 2;
    thighGroup.add(thighRing);

    // Subtle pulsating bullseye core
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.02, 24),
      new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    core.rotation.x = -Math.PI / 2;
    thighGroup.add(core);

    // Target Label Plaque
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 400; labelCanvas.height = 70;
    const ctx = labelCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(0, 0, 400, 70);
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, 394, 64);
    ctx.fillStyle = '#10b981'; ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('APPROVED IM: VASTUS LATERALIS', 200, 35);

    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.04), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true }));
    labelMesh.position.set(0, 0.03, 0);
    labelMesh.rotation.x = -Math.PI / 3;
    thighGroup.add(labelMesh);

    // Positioned directly over patient's middle-third anterolateral right thigh
    thighGroup.position.set(0.18, 0.56, 0.10);
    this.chairAndPatientNode.add(thighGroup);
    this.thighTarget = thighGroup;
    this.injectionPort = thighGroup; // Primary parenteral injection port

    // 2. Interactive Radial Pulse Check Hotspot on Left Wrist
    const pulseGroup = new THREE.Group();
    pulseGroup.name = 'RadialPulseHotspot';
    const pulseRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    });
    const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.015, 0.028, 24), pulseRingMat);
    pulseRing.rotation.x = -Math.PI / 2;
    pulseGroup.add(pulseRing);

    pulseGroup.position.set(-0.30, 0.62, -0.12);
    this.chairAndPatientNode.add(pulseGroup);
    this.radialPulseHotspot = pulseGroup;
  }

  updateVitals(snapshot) {
    this.currentState = snapshot.state;
    this.scenario = snapshot.scenario;
    this.demographic = snapshot.demographic || this.demographic;
    this.shiveringIntensity = snapshot.shiveringIntensity || 0.0;
    this.respirationRate = snapshot.respirationRate || 14;

    this.applyDemographicSkin();

    // Trendelenburg Chair Tilt Angle
    if (this.lastIntervention === 'TRENDELENBURG' || this.currentState === ClinicalStates.RECOVERY_CORRECT && this.scenario === EmergencyScenarios.VASOVAGAL_SYNCOPE) {
      this.targetChairRecline = -0.30; // Head-down recline
    } else {
      this.targetChairRecline = 0.0;
    }
  }

  update(deltaSec) {
    this.time += deltaSec;

    const b = this.bones;
    if (!b || !b.Spine) return;

    // 1. Respiration Dynamics (Chest Breathing Expansion)
    const respRate = Math.max(6, this.respirationRate);
    const respCyclesPerSec = respRate / 60;
    const breathPhase = Math.sin(this.time * respCyclesPerSec * Math.PI * 2);
    
    if (b.Spine1 && b.Spine2) {
      b.Spine1.rotation.x = -0.10 + (breathPhase * 0.025);
      b.Spine2.rotation.x = -0.06 + (breathPhase * 0.035);
    }

    // 2. Shivering / Fine Tremors in Hypoglycemia (8-12 Hz)
    if (this.shiveringIntensity > 0.02) {
      const tremorFreq = 28; // ~9 Hz oscillation
      const jiggle = Math.sin(this.time * tremorFreq) * (0.018 * this.shiveringIntensity);
      const jiggleRot = Math.cos(this.time * (tremorFreq + 4)) * (0.045 * this.shiveringIntensity);

      if (b.Head) {
        b.Head.rotation.y = jiggleRot * 1.5;
        b.Head.rotation.z = jiggle * 2.2;
      }
      if (b.RightArm) {
        b.RightArm.rotation.x = 0.35 + jiggle;
      }
      if (b.LeftArm) {
        b.LeftArm.rotation.x = 0.35 - jiggle;
      }
    } else {
      // Natural gaze sway or comatose collapse
      if (b.Head) {
        if (this.currentState === ClinicalStates.CRITICAL_ERROR) {
          b.Head.rotation.y = THREE.MathUtils.lerp(b.Head.rotation.y, 0.45, 0.06);
          b.Head.rotation.z = THREE.MathUtils.lerp(b.Head.rotation.z, 0.35, 0.06);
          b.Head.rotation.x = THREE.MathUtils.lerp(b.Head.rotation.x, 0.28, 0.06);
        } else {
          const lookSway = Math.sin(this.time * 0.8) * 0.03;
          b.Head.rotation.y = lookSway;
          b.Head.rotation.z = 0;
          b.Head.rotation.x = 0.10;
        }
      }
    }

    // 3. Facial Expression Morphs (Panting / Gasping)
    if (this.headMesh && this.headMesh.morphTargetDictionary) {
      const mouthOpenIdx = this.headMesh.morphTargetDictionary['mouthOpen'];
      if (mouthOpenIdx !== undefined && this.headMesh.morphTargetInfluences) {
        if (this.currentState === ClinicalStates.DECOMPENSATING) {
          this.headMesh.morphTargetInfluences[mouthOpenIdx] = 0.25 + (breathPhase * 0.2);
        } else if (this.currentState === ClinicalStates.CRITICAL_ERROR) {
          this.headMesh.morphTargetInfluences[mouthOpenIdx] = 0.60;
        } else {
          this.headMesh.morphTargetInfluences[mouthOpenIdx] = 0.0;
        }
      }
    }

    // 4. Trendelenburg Chair Tilt Interpolation
    if (this.targetChairRecline !== undefined) {
      this.chairReclineAngle = THREE.MathUtils.lerp(this.chairReclineAngle, this.targetChairRecline, deltaSec * 2.5);
      this.chairAndPatientNode.rotation.x = this.chairReclineAngle;
    }

    // 5. Thigh Target Beacon Pulse
    if (this.thighTargetMat) {
      this.thighTargetMat.opacity = 0.55 + Math.sin(this.time * 5) * 0.35;
    }
  }

  getInjectionWorldPosition() {
    const pos = new THREE.Vector3();
    if (this.injectionPort) {
      this.injectionPort.getWorldPosition(pos);
    } else {
      pos.set(0.18, 0.56, -1.15);
    }
    return pos;
  }
}
