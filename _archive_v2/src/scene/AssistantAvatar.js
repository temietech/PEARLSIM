/**
 * AssistantAvatar.js - Dental Assistant Sarah in Hospital Teal Scrubs
 */

import * as THREE from 'three';

export class AssistantAvatar {
  constructor(gltfLoader) {
    this.gltfLoader = gltfLoader;
    this.group = new THREE.Group();
    this.group.name = 'AssistantSarah';
    this.bones = {};
    this.model = null;

    this.loadAssistantModel();
  }

  loadAssistantModel() {
    this.gltfLoader.load(
      './models/assistant_female.glb',
      (gltf) => {
        const model = gltf.scene;
        this.model = model;
        model.scale.set(0.92, 0.92, 0.92);
        model.position.set(-0.75, 0, -0.25);
        model.rotation.y = 1.25;

        // Catalog bones and cache pristine rest pose
        model.traverse((child) => {
          if (child.isBone) {
            this.bones[child.name] = child;
            child.userData.restQuaternion = child.quaternion.clone();
            child.userData.restPosition = child.position.clone();
          }

          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.name === 'Wolf3D_Glasses') {
              child.visible = false;
            }

            if (child.name === 'Wolf3D_Outfit_Top' || child.name === 'Wolf3D_Outfit_Bottom') {
              if (child.material) {
                const mat = child.material.clone();
                mat.map = null;
                mat.color.setHex(0x0e7490); // Clinical teal scrubs
                mat.roughness = 0.8;
                mat.metalness = 0.05;
                mat.needsUpdate = true;
                child.material = mat;
              }
            }

            if (child.name === 'Wolf3D_Outfit_Footwear') {
              if (child.material) {
                const mat = child.material.clone();
                mat.map = null;
                mat.color.setHex(0x334155); // Professional dark slate clinical clogs
                mat.roughness = 0.6;
                mat.metalness = 0.1;
                mat.needsUpdate = true;
                child.material = mat;
              }
            }
          }
        });

        // Natural, attentive clinical standing posture (arms hang naturally down at sides)
        const b = this.bones;
        if (b) {
          if (b.LeftArm) {
            b.LeftArm.rotateX(1.35);
            b.LeftArm.rotateZ(0.06);
          }
          if (b.RightArm) {
            b.RightArm.rotateX(1.35);
            b.RightArm.rotateZ(-0.06);
          }
          if (b.LeftForeArm) {
            b.LeftForeArm.rotateY(-0.10);
          }
          if (b.RightForeArm) {
            b.RightForeArm.rotateY(0.10);
          }
          if (b.Spine) b.Spine.rotateX(0.04);
          if (b.Neck) b.Neck.rotateX(-0.04);
        }

        this.group.add(model);
      },
      undefined,
      (err) => {
        console.warn('[AssistantAvatar] Assistant fallback.', err);
      }
    );
  }
}
