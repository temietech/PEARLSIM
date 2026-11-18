/**
 * OperatoryScene.js - Photorealistic 3D Dental Operatory Environment
 * Renders the clinical operatory, articulated surgical operating lamp,
 * hospital-grade seamless vinyl flooring, and the authentic dental treatment chair.
 */

import * as THREE from 'three';

export class OperatoryScene {
  constructor(gltfLoader) {
    this.gltfLoader = gltfLoader;
    this.group = new THREE.Group();
    this.group.name = 'DentalOperatoryEnvironment';

    this.chairGroup = new THREE.Group();
    this.chairGroup.name = 'DentalChairGroup';
    this.chairGroup.position.set(0, 0, -1.25);
    this.group.add(this.chairGroup);

    this.buildSurgicalLighting();
    this.buildArchitecture();
    this.buildDentalOperatingLamp();
    this.loadTreatmentChair();
  }

  buildSurgicalLighting() {
    // Ambient clinical illumination
    const ambient = new THREE.AmbientLight(0xffffff, 1.1);
    this.group.add(ambient);

    // Primary operatory surgical spotlight focused over patient
    this.surgicalSpot = new THREE.SpotLight(0xffffff, 3.2, 8, Math.PI / 4, 0.25, 1.0);
    this.surgicalSpot.position.set(0.2, 2.7, -0.6);
    this.surgicalSpot.target.position.set(0, 0.95, -1.25);
    this.surgicalSpot.castShadow = true;
    this.group.add(this.surgicalSpot);
    this.group.add(this.surgicalSpot.target);

    // Focused Oral Cavity Inspection Spotlight
    this.oralSpotlight = new THREE.SpotLight(0xfef08a, 1.5, 5, Math.PI / 6, 0.2, 1.2);
    this.oralSpotlight.position.set(0, 1.8, -0.85);
    this.oralSpotlight.target.position.set(0, 1.05, -1.28);
    this.group.add(this.oralSpotlight);
    this.group.add(this.oralSpotlight.target);

    // Diffuse directional fill lighting
    const fill = new THREE.DirectionalLight(0xe0f2fe, 0.7);
    fill.position.set(-2.5, 3.0, 1.0);
    this.group.add(fill);

    // Subtle edge rim light
    const rim = new THREE.PointLight(0x0ea5e9, 0.6, 6);
    rim.position.set(0, 2.2, -2.8);
    this.group.add(rim);
  }

  buildDentalOperatingLamp() {
    // Articulated 3D Dental Operating Lamp overhead
    this.lampGroup = new THREE.Group();
    this.lampGroup.name = 'ArticulatedDentalOperatingLamp';

    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
    const emissiveMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.2,
      roughness: 0.1
    });

    // Ceiling mount plate
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.04, 24), chromeMat);
    mount.position.set(0.15, 2.98, -0.60);
    this.lampGroup.add(mount);

    // Vertical telescopic suspension pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 16), chromeMat);
    pole.position.set(0.15, 2.75, -0.60);
    this.lampGroup.add(pole);

    // Articulated boom arm 1
    const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.55, 16), whiteMat);
    arm1.position.set(0.15, 2.45, -0.72);
    arm1.rotation.x = 0.52;
    this.lampGroup.add(arm1);

    // Articulated knuckle joint
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 16), chromeMat);
    joint.position.set(0.15, 2.30, -0.85);
    this.lampGroup.add(joint);

    // Dental surgical lamp head housing
    const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.18), whiteMat);
    lampHead.position.set(0.15, 2.22, -0.92);
    lampHead.rotation.x = 0.45;
    this.lampGroup.add(lampHead);

    // Glowing LED emitter array on underside
    const ledLens = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), emissiveMat);
    ledLens.position.set(0.15, 2.16, -0.95);
    ledLens.rotation.x = Math.PI / 2 + 0.45;
    this.lampGroup.add(ledLens);

    // Dual positioning handles for ergonomic dentist grip
    const handleL = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 12, 24, Math.PI), chromeMat);
    handleL.position.set(0.01, 2.22, -0.92);
    handleL.rotation.y = Math.PI / 2;
    this.lampGroup.add(handleL);

    const handleR = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 12, 24, Math.PI), chromeMat);
    handleR.position.set(0.29, 2.22, -0.92);
    handleR.rotation.y = -Math.PI / 2;
    this.lampGroup.add(handleR);

    this.group.add(this.lampGroup);
  }

  setOralSpotlight(active) {
    if (this.oralSpotlight) {
      this.oralSpotlight.intensity = active ? 4.5 : 1.5;
    }
  }

  buildArchitecture() {
    // Hospital-grade seamless vinyl flooring (soft slate matte, no neon grids)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.38,
      metalness: 0.08
    });

    // Clinical off-white wall enamel
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.85
    });

    // Stainless steel hospital impact trim
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.2
    });

    // Medical cabinetry enamel
    const cabinetMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3
    });

    const mintAccentMat = new THREE.MeshStandardMaterial({
      color: 0x0d9488, // Clinical mint/teal accent matching Unreal Prototype
      roughness: 0.4
    });

    // Seamless Vinyl Floor (No GridHelper!)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Back Wall
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 4.5), wallMat);
    backWall.position.set(0, 2.25, -4.5);
    backWall.receiveShadow = true;
    this.group.add(backWall);

    // Wall impact bumper rail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(16, 0.12, 0.04), trimMat);
    rail.position.set(0, 0.95, -4.48);
    this.group.add(rail);

    // Left Wall
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 4.5), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-4.5, 2.25, 0);
    this.group.add(leftWall);

    // Countertop Station (holds the red emergency resuscitation kit)
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.90, 0.70), cabinetMat);
    counter.position.set(0.6, 0.45, -4.1);
    counter.castShadow = true;
    counter.receiveShadow = true;
    this.group.add(counter);

    // Mint Cabinetry Trim Stripe
    const counterStripe = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.06, 0.71), mintAccentMat);
    counterStripe.position.set(0.6, 0.86, -4.1);
    this.group.add(counterStripe);

    // Clinical Wash Basin
    const sinkMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 });
    const sink = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.16, 0.14, 24), sinkMat);
    sink.position.set(1.6, 0.92, -4.1);
    this.group.add(sink);
  }

  loadTreatmentChair() {
    this.gltfLoader.load(
      './models/dental_chair.glb',
      (gltf) => {
        const model = gltf.scene;

        const scale = 0.0095;
        model.scale.set(scale, scale, scale);

        // Precise longitudinal alignment: facing +Z toward clinician
        // Mathematical rotation and offset derived from GLTF mesh coordinates
        model.rotation.y = Math.PI / 2;
        model.position.set(0.41, -0.55, -0.80);

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // Proper non-mutating material assignments
            if (child.material) {
              const origMat = Array.isArray(child.material) ? child.material[0] : child.material;
              const mat = origMat.clone();

              // Chair Upholstery: Backrest, Seat Cushion, Headrest
              if (['Object_20', 'Object_27', 'Object_29'].includes(child.name)) {
                mat.color.setHex(0x1e3a8a); // Authentic clinical navy/royal blue upholstery
                mat.roughness = 0.55;
                mat.metalness = 0.05;
              } else if (['Object_18'].includes(child.name)) {
                // Headrest cushion
                mat.color.setHex(0x1e3a8a);
                mat.roughness = 0.55;
                mat.metalness = 0.05;
              } else if (['Object_19', 'Object_30', 'Object_65', 'Object_66'].includes(child.name)) {
                // Polished chrome fittings, armrests, base plate
                mat.color.setHex(0xe2e8f0);
                mat.roughness = 0.2;
                mat.metalness = 0.85;
              } else if (['Object_15', 'Object_36', 'Object_54'].includes(child.name)) {
                // Mint-accented spittoon body
                mat.color.setHex(0x0d9488);
                mat.roughness = 0.4;
                mat.metalness = 0.1;
              } else {
                // Off-white medical enamel
                mat.color.setHex(0xf8fafc);
                mat.roughness = 0.35;
                mat.metalness = 0.2;
              }
              child.material = mat;
            }
          }
        });

        this.chairGroup.add(model);
      },
      undefined,
      (err) => {
        console.warn('[OperatoryScene] Chair fallback.', err);
      }
    );
  }

  setChairRecline(angleRad) {
    if (this.chairGroup) {
      this.chairGroup.rotation.x = angleRad;
    }
  }
}
