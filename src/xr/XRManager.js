// WebXR Bare-Hand Tracking (XRHandModelFactory + Pinch / Select / Direct Index-Tip Poke) & Controller Input Manager
import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

const mTmp = new THREE.Matrix4();

export class XRManager {
  constructor({
    renderer,
    scene,
    hands,
    controllers,
    grips,
    xrHands,
    raycaster,
    onSelectStart,
    onSelectEnd,
    onSqueeze,
  }) {
    this.renderer = renderer;
    this.scene = scene;
    this.hands = hands;
    this.controllers = controllers;
    this.grips = grips;
    this.xrHands = xrHands;
    this.raycaster = raycaster;
    this.onSelectStart = onSelectStart;
    this.onSelectEnd = onSelectEnd;
    this.onSqueeze = onSqueeze;
    this.lastStartMs = [0, 0];
    this.lastStartSource = ['', ''];
    this.pokeCooldownUntil = 0;
  }

  setup() {
    const handModelFactory = new XRHandModelFactory();

    for (let i = 0; i < 2; i++) {
      const hand = this.hands[i];
      const c = this.renderer.xr.getController(i);
      const g = this.renderer.xr.getControllerGrip(i);
      const h = this.renderer.xr.getHand(i);

      const triggerStart = (source) => {
        const now = performance.now();
        // Deduplicate only when controller 'selectstart' and hand 'pinchstart' both fire for the same physical pinch
        if (this.lastStartSource[i] && this.lastStartSource[i] !== source && now - this.lastStartMs[i] < 50) return;
        this.lastStartSource[i] = source;
        this.lastStartMs[i] = now;
        hand.connected = true;
        this.onSelectStart(hand);
      };

      const triggerEnd = () => {
        this.onSelectEnd(hand);
      };

      c.addEventListener('connected', (e) => {
        hand.connected = true;
        hand.gamepad = e.data?.gamepad || null;
        hand.isBareHand = !!e.data?.hand;
        hand.handedness = e.data?.handedness || (i === 0 ? 'left' : 'right');
      });
      c.addEventListener('disconnected', () => {
        hand.connected = false;
        hand.gamepad = null;
        hand.isBareHand = false;
        this.onSqueeze(hand);
      });
      c.addEventListener('selectstart', () => triggerStart('select'));
      c.addEventListener('selectend', triggerEnd);
      c.addEventListener('squeezestart', () => this.onSqueeze(hand));

      // Meta Quest bare-hand pinch events on XRHandSpace
      h.addEventListener('pinchstart', () => {
        hand.isBareHand = true;
        triggerStart('pinch');
      });
      h.addEventListener('pinchend', triggerEnd);

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1.5)]),
        new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.42 }),
      );
      const reticle = new THREE.Mesh(
        new THREE.SphereGeometry(0.010, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9, depthTest: false }),
      );
      reticle.position.set(0, 0, -0.75);
      reticle.visible = false;
      c.add(line, reticle);
      this.scene.add(c);
      this.controllers.push(c);

      const gloveMat = new THREE.MeshPhysicalMaterial({ color: 0xe0f2fe, roughness: 0.32, metalness: 0.02, clearcoat: 0.35 });
      const cuffMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 });
      const handMesh = new THREE.Group();
      handMesh.scale.setScalar(0.76);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.016, 0.068), gloveMat);
      const wristCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.024, 0.040, 14), cuffMat);
      wristCuff.rotation.x = Math.PI / 2;
      wristCuff.position.set(0, -0.002, 0.052);
      handMesh.add(palm, wristCuff);
      const fingerX = [-0.021, -0.007, 0.007, 0.021];
      const fingerLen = [0.046, 0.054, 0.050, 0.038];
      for (let f = 0; f < 4; f++) {
        const fg = new THREE.Mesh(new THREE.CapsuleGeometry(0.0062, fingerLen[f], 4, 8), gloveMat);
        fg.rotation.x = Math.PI / 2 + 0.16;
        fg.position.set(fingerX[f], -0.005, -0.056);
        handMesh.add(fg);
      }
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0072, 0.032, 4, 8), gloveMat);
      thumb.rotation.set(Math.PI / 2 + 0.1, 0, i === 0 ? -0.58 : 0.58);
      thumb.position.set(i === 0 ? 0.036 : -0.036, -0.006, -0.018);
      handMesh.add(thumb);
      g.add(handMesh);
      this.scene.add(g);
      this.grips.push(g);

      // Visible 3D articulated bare-hand model via Three.js XRHandModelFactory
      const handModel = handModelFactory.createHandModel(h, 'mesh');
      h.add(handModel);
      this.scene.add(h);
      this.xrHands.push(h);
    }
  }

  // Returns the active 3D anchor for an XR hand: prefers bare-hand index-finger-tip joint when tracked
  getAnchor(hand) {
    const xh = this.xrHands[hand.i];
    const indexTip = xh?.joints?.['index-finger-tip'];
    const bareActive = !!(indexTip && (xh.visible || indexTip.visible));
    if (this.grips[hand.i]) this.grips[hand.i].visible = !bareActive;
    if (bareActive) return indexTip;
    return this.grips[hand.i] || this.controllers[hand.i];
  }

  // World position of the hand's pinch/poke point (index fingertip or controller grip)
  getHandWorldPos(hand, target = new THREE.Vector3()) {
    const anchor = this.getAnchor(hand);
    if (anchor) return anchor.getWorldPosition(target);
    if (hand.held) return hand.held.getWorldPosition(target);
    return target.set(0, 0, 0);
  }

  // Aim raycaster from the bare-hand pointer ray or controller ray
  aimRay(hand) {
    const c = this.controllers[hand.i];
    if (c) {
      c.updateMatrixWorld(true);
      mTmp.identity().extractRotation(c.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(mTmp).normalize();
      return true;
    }
    const anchor = this.getAnchor(hand);
    if (anchor) {
      anchor.updateMatrixWorld(true);
      mTmp.identity().extractRotation(anchor.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(anchor.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(mTmp).normalize();
      return true;
    }
    return false;
  }

  // Checks whether the hand is actively tracked (bare hand or controller) and hides grip sphere when bare hand is visible
  isHandActive(i) {
    const hand = this.hands[i];
    const xh = this.xrHands[i];
    const grip = this.grips[i];
    const hasJoints = !!(xh?.joints && Object.keys(xh.joints).length > 0);
    const handVisible = !!(xh?.visible && hasJoints);
    if (handVisible) hand.isBareHand = true;
    if (grip?.children?.[0]) {
      grip.children[0].visible = !handVisible;
    }
    return hand.connected || handVisible;
  }
}
