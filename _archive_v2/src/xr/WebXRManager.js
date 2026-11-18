/**
 * WebXRManager.js - Meta Quest 3 WebXR & Spatial Controller Manager
 */

import * as THREE from 'three';

export class WebXRManager {
  constructor(renderer, scene, camera, onSelectCallback) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.onSelectCallback = onSelectCallback;

    this.controllers = [];
    this.isSessionActive = false;
    this.setupControllers();
  }

  setupControllers() {
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.addEventListener('select', (event) => {
        if (this.onSelectCallback) this.onSelectCallback(event.target);
      });
      this.scene.add(controller);
      this.controllers.push(controller);

      // Quest controller pointer ray
      const rayGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -2.5)
      ]);
      const rayMat = new THREE.LineBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.7 });
      const rayLine = new THREE.Line(rayGeo, rayMat);
      controller.add(rayLine);
    }
  }

  triggerHaptic(intensity = 0.8, durationMs = 150) {
    this.controllers.forEach(ctrl => {
      const gamepad = ctrl.gamepad || (ctrl.inputSource && ctrl.inputSource.gamepad);
      if (gamepad && gamepad.hapticActuators && gamepad.hapticActuators.length > 0) {
        try {
          gamepad.hapticActuators[0].pulse(intensity, durationMs);
        } catch (e) {}
      }
    });
  }

  startSession(mode = 'immersive-ar') {
    if (!('xr' in navigator)) return Promise.reject(new Error('WebXR unsupported'));

    return navigator.xr.requestSession(mode, {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['hand-tracking', 'hit-test']
    }).then(session => {
      this.isSessionActive = true;
      this.renderer.xr.setSession(session);
      session.addEventListener('end', () => {
        this.isSessionActive = false;
      });
      return session;
    });
  }
}
