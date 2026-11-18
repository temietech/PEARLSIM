/**
 * SoundManager.js
 * 
 * Clinical Web Audio API sound synthesizer.
 * Generates realistic medical telemetry tones without relying on external audio assets:
 * - Synchronized ECG cardiac telemetry beeps (pitch modulated by SpO2, tempo modulated by HR)
 * - Tachycardia alert beeps
 * - Critical Code Blue multi-tone crash alarms (IEC 60601-1-8 medical alarm pattern)
 * - Adrenaline tachycardia / arrhythmia alert
 * - Syringe interaction & injection fluid administration sounds
 */

import { ClinicalStates } from '../core/ClinicalStateMachine.js';

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.lastBeepTime = 0;
    this.alarmActive = false;
    this.currentHR = 80;
    this.currentSpo2 = 98;
    this.currentState = ClinicalStates.BASELINE;
    this.alarmTimer = null;

    this.initAudioContext = this.initAudioContext.bind(this);
  }

  initAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (muted) {
      this.stopAlarm();
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  onStateChange(newState, snapshot) {
    this.currentState = newState;
    if (newState === ClinicalStates.CRITICAL_ERROR) {
      this.startCriticalAlarm();
    } else if (newState === ClinicalStates.RECOVERY_CORRECT || newState === ClinicalStates.BASELINE) {
      this.stopAlarm();
    }
  }

  playBeep(freq = 440, duration = 0.08) {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + duration + 0.01);
    } catch (e) {}
  }

  updateVitals(snapshot) {
    this.currentHR = snapshot.heartRate;
    this.currentSpo2 = snapshot.spo2;
    this.currentState = snapshot.state;

    if (snapshot.state === ClinicalStates.CRITICAL_INSULIN) {
      if (!this.alarmActive) {
        this.startCriticalAlarm();
      }
    } else if (snapshot.state === ClinicalStates.ADRENALINE_ERROR) {
      if (!this.alarmActive) {
        this.startAdrenalineAlarm();
      }
    } else {
      this.stopAlarm();
    }
  }

  playCardiacBeep() {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;

    const baseFreq = 300 + (this.currentSpo2 - 70) * 18;
    const freq = Math.max(260, Math.min(1000, baseFreq));

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.06, this.ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.13);
    } catch (e) {}
  }

  startCriticalAlarm() {
    if (this.alarmActive || this.isMuted || !this.ctx) return;
    this.alarmActive = true;
    this.scheduleNextAlarmBurst();
  }

  scheduleNextAlarmBurst() {
    if (!this.alarmActive || this.isMuted || !this.ctx || this.ctx.state !== 'running') return;

    // Standard medical burst: 5 urgent descending tones (IEC 60601-1-8)
    const tones = [523.25, 440.0, 349.23, 440.0, 349.23];
    const startTime = this.ctx.currentTime + 0.05;

    tones.forEach((freq, idx) => {
      const noteTime = startTime + (idx * 0.14);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(0.05, noteTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.11);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.12);
    });

    this.alarmTimer = setTimeout(() => {
      if (this.alarmActive) {
        this.scheduleNextAlarmBurst();
      }
    }, 1200);
  }

  startAdrenalineAlarm() {
    if (this.alarmActive || this.isMuted || !this.ctx) return;
    this.alarmActive = true;
    this.scheduleAdrenalineBurst();
  }

  scheduleAdrenalineBurst() {
    if (!this.alarmActive || this.isMuted || !this.ctx || this.ctx.state !== 'running') return;

    // Rapid dual warning chirp for extreme tachycardia (>160 BPM)
    const startTime = this.ctx.currentTime + 0.05;
    [880, 1046.5].forEach((freq, idx) => {
      const noteTime = startTime + (idx * 0.1);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(0.04, noteTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.09);
    });

    this.alarmTimer = setTimeout(() => {
      if (this.alarmActive) {
        this.scheduleAdrenalineBurst();
      }
    }, 700);
  }

  stopAlarm() {
    this.alarmActive = false;
    if (this.alarmTimer) {
      clearTimeout(this.alarmTimer);
      this.alarmTimer = null;
    }
  }

  playHoverSound() {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {}
  }

  playAdministerSound(isGlucagonOrGlucose) {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isGlucagonOrGlucose ? 600 : 250, now);
      osc.frequency.exponentialRampToValueAtTime(isGlucagonOrGlucose ? 1200 : 150, now + 0.25);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.32);
    } catch (e) {}
  }
}
