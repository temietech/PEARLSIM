/**
 * SpatialDialogueBubble.js
 * 
 * Floating 3D Curved Glass Speech Bubble anchored above the patient's head.
 * Displays dynamic LLM conversational dialogue with typewriter animation,
 * speech indicator pulse, and frosted glass aesthetic.
 */

import * as THREE from 'three';

export class SpatialDialogueBubble {
  constructor() {
    this.canvasWidth = 768;
    this.canvasHeight = 256;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.ctx = this.canvas.getContext('2d', { alpha: true });

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    this.group = new THREE.Group();
    this.group.name = 'SpatialDialogueBubble';

    this.createMesh();

    // Dialogue State
    this.targetText = "I... I feel a bit shaky and lightheaded.";
    this.displayedText = "";
    this.charIndex = 0;
    this.typingSpeed = 35; // ms per character
    this.lastCharTime = 0;
    this.isTyping = false;
    this.opacity = 0;
    this.targetOpacity = 1.0;
    this.pulseTime = 0;
    this.speakerRole = "PATIENT (Alex)";

    this.renderCanvas();
  }

  createMesh() {
    const width = 0.65;  // 65cm wide in XR
    const height = 0.22; // 22cm tall

    // Front Screen with texture
    const planeGeo = new THREE.PlaneGeometry(width, height);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.98,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(planeGeo, this.material);
    this.group.add(this.mesh);

    // Subtle glass backplate
    const backGeo = new THREE.BoxGeometry(width + 0.015, height + 0.015, 0.008);
    this.backMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      metalness: 0.1,
      roughness: 0.2,
      transmission: 0.65,
      transparent: true,
      opacity: 0.7,
      ior: 1.45
    });
    const backMesh = new THREE.Mesh(backGeo, this.backMat);
    backMesh.position.z = -0.006;
    this.group.add(backMesh);

    // Glowing frame
    const edges = new THREE.EdgesGeometry(backGeo);
    this.frameMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.5
    });
    const frame = new THREE.LineSegments(edges, this.frameMat);
    frame.position.z = -0.006;
    this.group.add(frame);

    // Speech arrow pointer (cone pointing down toward patient mouth)
    const arrowGeo = new THREE.ConeGeometry(0.02, 0.04, 16);
    arrowGeo.rotateX(Math.PI);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.8
    });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    arrowMesh.position.set(0, -height / 2 - 0.02, 0);
    this.group.add(arrowMesh);
  }

  /**
   * Set new dialogue string with typewriter animation
   */
  setDialogue(text, speaker = "PATIENT (Alex)") {
    this.speakerRole = speaker;
    this.targetText = text || "...";
    this.displayedText = "";
    this.charIndex = 0;
    this.isTyping = true;
    this.targetOpacity = 1.0;
    this.lastCharTime = performance.now();
  }

  showText(text, durationSec = 6.0, speaker = "PATIENT (Alex)") {
    this.setDialogue(text, speaker);
  }

  update(deltaSec) {
    this.pulseTime += deltaSec;

    // Typewriter effect
    if (this.isTyping) {
      const now = performance.now();
      if (now - this.lastCharTime >= this.typingSpeed) {
        this.lastCharTime = now;
        if (this.charIndex < this.targetText.length) {
          this.charIndex++;
          this.displayedText = this.targetText.substring(0, this.charIndex);
          this.renderCanvas();
          this.texture.needsUpdate = true;
        } else {
          this.isTyping = false;
        }
      }
    }

    // Gentle float bobbing in XR space
    this.mesh.position.y = Math.sin(this.pulseTime * 1.8) * 0.008;
  }

  renderCanvas() {
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    ctx.clearRect(0, 0, w, h);

    // Frosted Glass Bubble Background
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.88)');
    bgGrad.addColorStop(1, 'rgba(30, 41, 59, 0.92)');

    this.roundRect(ctx, 4, 4, w - 8, h - 8, 20);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Specular border
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.stroke();

    // Header / Speaker Bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    this.roundRect(ctx, 16, 14, w - 32, 38, 10);
    ctx.fill();

    // Pulsing audio wave / voice dot
    const pulseRadius = 5 + Math.sin(this.pulseTime * 6) * 1.5;
    ctx.beginPath();
    ctx.arc(36, 33, pulseRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#00f0ff';
    ctx.fill();

    ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(this.speakerRole, 54, 38);

    // LLM generated tag
    ctx.font = '13px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('⚡ LLM CLINICAL DIALOGUE BRIDGE', w - 245, 38);

    // Spoken Text Body with word wrapping
    ctx.font = 'bold 22px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#f8fafc';

    const textToDraw = this.displayedText + (this.isTyping ? '▌' : '');
    this.wrapText(ctx, `"${textToDraw}"`, 32, 92, w - 64, 34);
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
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
