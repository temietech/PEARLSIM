// WebAudio Clinical Telemetry, Stridor/Wheeze Respiratory Cue & Micro-Feedback Sound Manager
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.activeOscillators = new Set();
    this.breathPhase = 0;
    this.lastWheezeHalf = -1;
    this.smoothedHr = 84;
    this.smoothedSpo2 = 99;
  }

  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        this.ctx = null;
      }
    } else if (this.ctx.state === 'suspended') {
      try { this.ctx.resume().catch(() => {}); } catch { /* ignore */ }
    }
    return this.ctx;
  }

  beep(freq, dur = 0.07, gain = 0.05, delay = 0, type = 'sine') {
    if (!this.ctx || this.ctx.state === 'closed') return;
    if (this.ctx.state === 'suspended') {
      try { this.ctx.resume().catch(() => {}); } catch { /* ignore */ }
    }
    try {
      const startAt = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, startAt);
      g.gain.linearRampToValueAtTime(gain, startAt + 0.008);
      g.gain.setTargetAtTime(0.0001, startAt + dur, 0.02);
      o.connect(g).connect(this.ctx.destination);
      this.activeOscillators.add(o);
      o.onended = () => {
        this.activeOscillators.delete(o);
        try { o.disconnect(); g.disconnect(); } catch { /* ignore */ }
      };
      o.start(startAt);
      o.stop(startAt + dur + 0.14);
    } catch { /* ignore audio context state error */ }
  }

  playHoverTick() {
    this.beep(1040, 0.025, 0.018);
  }

  playConfirmChime() {
    this.beep(880, 0.055, 0.045, 0);
    this.beep(1320, 0.085, 0.045, 0.055);
  }

  // Pulse oximeter telemetry beep: pitch tracks SpO2 smoothly; urgent crisp tone in shock/tachycardia, calm sinus tone in recovery
  playTelemetryBeep(vitals, phase) {
    if (!this.ctx || vitals.hr <= 0) return;
    this.smoothedHr += (vitals.hr - this.smoothedHr) * 0.25;
    this.smoothedSpo2 += (vitals.spo2 - this.smoothedSpo2) * 0.25;
    const pitch = Math.max(300, Math.min(820, 520 + (this.smoothedSpo2 - 85) * 18));
    const urgent = phase === 'established' || phase === 'severe' || this.smoothedHr >= 118;
    const dur = urgent ? 0.042 : 0.065;
    const gain = urgent ? 0.042 : 0.032;
    this.beep(pitch, dur, gain, 0, urgent ? 'triangle' : 'sine');
  }

  // Synthesizes subtle inspiratory stridor / expiratory wheeze cues during acute airway edema, fading out on recovery
  playStridorCue(intensity = 0.5, isExpiratory = false) {
    if (!this.ctx || this.ctx.state !== 'running' || intensity <= 0.05) return;
    try {
      const now = this.ctx.currentTime;
      const dur = isExpiratory ? 0.48 : 0.36;
      const o = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();

      o.type = 'sawtooth';
      const baseFreq = isExpiratory ? 390 : 540;
      o.frequency.setValueAtTime(baseFreq, now);
      o.frequency.exponentialRampToValueAtTime(isExpiratory ? 310 : 640, now + dur);

      filter.type = 'bandpass';
      filter.frequency.value = isExpiratory ? 520 : 760;
      filter.Q.value = 6.5;

      const peakGain = Math.min(0.022, 0.008 + intensity * 0.014);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(peakGain, now + dur * 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      o.connect(filter).connect(g).connect(this.ctx.destination);
      this.activeOscillators.add(o);
      o.onended = () => {
        this.activeOscillators.delete(o);
        try { o.disconnect(); filter.disconnect(); g.disconnect(); } catch { /* ignore */ }
      };
      o.start(now);
      o.stop(now + dur + 0.05);
    } catch { /* ignore */ }
  }

  updateRespiratoryAudio(vitals, phase, dt, active = true) {
    if (!active || !this.ctx || vitals.rr <= 0) return;
    const isDistress = (phase === 'established' || phase === 'severe') || (vitals.swelling >= 0.45 && phase !== 'recovering' && phase !== 'resolved');
    if (!isDistress) {
      this.lastWheezeHalf = -1;
      return;
    }
    this.breathPhase += dt * (vitals.rr / 60) * 2; // 2 half-cycles per breath (inspiration + expiration)
    const halfIdx = Math.floor(this.breathPhase);
    if (halfIdx !== this.lastWheezeHalf) {
      this.lastWheezeHalf = halfIdx;
      const intensity = Math.min(1, Math.max(0.2, vitals.swelling || 0.5));
      this.playStridorCue(intensity, halfIdx % 2 === 1);
    }
  }

  suspend() {
    for (const osc of this.activeOscillators) {
      try { osc.stop(); osc.disconnect(); } catch { /* ignore */ }
    }
    this.activeOscillators.clear();
    if (this.ctx && this.ctx.state === 'running') {
      try { this.ctx.suspend().catch(() => {}); } catch { /* ignore */ }
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      try { this.ctx.resume().catch(() => {}); } catch { /* ignore */ }
    }
  }

  dispose() {
    this.suspend();
    if (this.ctx) {
      const c = this.ctx;
      this.ctx = null;
      try { c.close().catch(() => {}); } catch { /* ignore */ }
    }
  }
}
