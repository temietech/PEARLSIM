/**
 * XRManager.js
 * 
 * Comprehensive WebXR Manager for Meta Quest 3:
 * - Requests 'immersive-ar' with 'local-floor' and 'hand-tracking'
 * - AR Passthrough with transparent clear background
 * - Quest Touch Plus Controller raycasting (laser pointer + reticle)
 * - Hand Tracking pinch gesture raycast selection
 * - Desktop mouse raycasting fallback
 */

import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

export class XRManager {
  constructor(renderer, scene, camera, onSelectCallback, onHoverCallback) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.onSelectCallback = onSelectCallback;
    this.onHoverCallback = onHoverCallback;

    this.controllers = [];
    this.controllerGrips = [];
    this.hands = [];

    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    this.mouse = new THREE.Vector2();

    this.controllerModelFactory = new XRControllerModelFactory();
    this.handModelFactory = new XRHandModelFactory();

    this.setupControllers();
    this.setupHandTracking();
    this.setupMouseEvents();
  }

  setupControllers() {
    for (let i = 0; i < 2; i++) {
      // 1. Controller Raycaster Beam
      const controller = this.renderer.xr.getController(i);
      controller.addEventListener('selectstart', (e) => this.onXRSelectStart(controller, e));
      controller.addEventListener('selectend', (e) => this.onXRSelectEnd(controller, e));
      controller.addEventListener('connected', (e) => {
        controller.userData.targetRayMode = e.data.targetRayMode;
        controller.userData.inputSource = e.data;
        this.addLaserPointer(controller);
      });
      controller.addEventListener('disconnected', () => {
        this.removeLaserPointer(controller);
      });
      this.scene.add(controller);
      this.controllers.push(controller);

      // 2. Controller 3D Mesh Grip
      const controllerGrip = this.renderer.xr.getControllerGrip(i);
      controllerGrip.add(this.controllerModelFactory.createControllerModel(controllerGrip));
      this.scene.add(controllerGrip);
      this.controllerGrips.push(controllerGrip);
    }
  }

  setupHandTracking() {
    for (let i = 0; i < 2; i++) {
      const hand = this.renderer.xr.getHand(i);
      hand.add(this.handModelFactory.createHandModel(hand, 'mesh'));
      hand.addEventListener('pinchstart', (e) => {
        // Pinch gesture serves as select trigger for Quest hand tracking
        const controller = this.controllers[i];
        if (controller) {
          this.onXRSelectStart(controller, e);
        }
      });
      this.scene.add(hand);
      this.hands.push(hand);
    }
  }

  addLaserPointer(controller) {
    // Laser Line Beam
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -3.5)
    ]);
    const laserMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.65,
      linewidth: 2
    });
    const laserLine = new THREE.Line(laserGeo, laserMat);
    laserLine.name = 'laser';
    controller.add(laserLine);

    // Reticle Dot Target
    const reticleGeo = new THREE.RingGeometry(0.012, 0.018, 24);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const reticle = new THREE.Mesh(reticleGeo, reticleMat);
    reticle.position.set(0, 0, -1.5);
    reticle.name = 'reticle';
    controller.add(reticle);
  }

  removeLaserPointer(controller) {
    const laser = controller.getObjectByName('laser');
    if (laser) controller.remove(laser);
    const reticle = controller.getObjectByName('reticle');
    if (reticle) controller.remove(reticle);
  }

  setupMouseEvents() {
    window.addEventListener('mousemove', (e) => {
      // Normalize mouse coordinates for desktop raycaster fallback
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('click', (e) => {
      // Don't trigger if clicked on 2D HTML UI overlay
      if (e.target && e.target.closest && e.target.closest('#hud-container')) return;
      if (!this.renderer.xr.isPresenting) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        if (this.onSelectCallback) {
          this.onSelectCallback(this.raycaster);
        }
      }
    });
  }

  onXRSelectStart(controller, event) {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

    if (this.onSelectCallback) {
      this.onSelectCallback(this.raycaster);
    }
  }

  onXRSelectEnd(controller, event) {
    // Select released
  }

  /**
   * Fire haptic vibration pulse on Meta Quest Touch Plus controllers
   * @param {number} intensity - 0.0 to 1.0 vibration amplitude
   * @param {number} duration - pulse duration in milliseconds
   */
  triggerHaptic(intensity = 0.6, duration = 150) {
    for (const controller of this.controllers) {
      const inputSource = controller.userData?.inputSource;
      if (inputSource?.gamepad?.hapticActuators && inputSource.gamepad.hapticActuators.length > 0) {
        try {
          inputSource.gamepad.hapticActuators[0].pulse(intensity, duration);
        } catch (e) {
          // Fallback or unsupported browser
        }
      }
    }
  }

  /**
   * Per-frame raycast poll for hover detection
   */
  update(interactiveObjects) {
    if (this.renderer.xr.isPresenting) {
      // Check both controllers
      let hovered = null;
      for (const controller of this.controllers) {
        if (!controller.visible) continue;

        this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

        const intersects = this.raycaster.intersectObjects(interactiveObjects, true);
        if (intersects.length > 0) {
          hovered = intersects[0].object;
          // Position reticle exactly at intersection point
          const reticle = controller.getObjectByName('reticle');
          if (reticle) {
            reticle.position.set(0, 0, -intersects[0].distance);
          }
          break;
        } else {
          const reticle = controller.getObjectByName('reticle');
          if (reticle) {
            reticle.position.set(0, 0, -1.5);
          }
        }
      }
      if (this.onHoverCallback) {
        this.onHoverCallback(hovered);
      }
    } else {
      // Desktop mouse raycast hover
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(interactiveObjects, true);
      const hovered = intersects.length > 0 ? intersects[0].object : null;
      if (this.onHoverCallback) {
        this.onHoverCallback(hovered);
      }
    }
  }
}
