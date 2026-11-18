/**
 * main.js
 * 
 * Main application orchestrator for PEARLSIM:
 * Multi-Disciplinary Healthcare Emergency Simulation Prototype
 * Designed for Medical, Nursing, Paramedic (EMS), and Dental clinical teams.
 * Replicates the high-fidelity Meta VR Hackathon visual and spatial experience.
 * Supports Meta Quest 3 WebXR (AR passthrough & VR) and Desktop browsers.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import {
  ClinicalStateMachine,
  ClinicalStates,
  Interventions,
  HealthcareDisciplines,
  EmergencyScenarios,
  DemographicProfiles
} from './core/ClinicalStateMachine.js';

import { fetchPatientDialogue, LLM_CONFIG } from './core/llmBridge.js';
import { SoundManager } from './audio/SoundManager.js';
import { SpatialVitalsMonitor } from './ui/SpatialVitalsMonitor.js';
import { SpatialDialogueBubble } from './ui/SpatialDialogueBubble.js';
import { PatientEntity } from './scene/PatientEntity.js';
import { ClinicalEnvironment } from './scene/ClinicalEnvironment.js';
import { EquipmentTray } from './scene/EquipmentTray.js';
import { FirstPersonHands } from './scene/FirstPersonHands.js';
import { XRManager } from './xr/XRManager.js';

class PearlSimApp {
  constructor() {
    const report = (step) => {
      console.log(`[PEARLSIM_BOOT] ${step}`);
      try { fetch('/log', { method: 'POST', body: `[PEARLSIM_BOOT] ${step}` }).catch(() => {}); } catch(_) {}
    };

    report('Constructor start');
    this.container = document.getElementById('canvas-container');

    // Selected Encounter Configuration
    this.selectedDiscipline = 'DENTAL';
    this.selectedScenario = 'RANDOM';
    this.activeScenario = 'HYPOGLYCEMIA';
    this.selectedDemographic = 'AFRICAN_GERIATRIC_F';
    this.selectedEnv = 'VIRTUAL';

    // Core Systems
    this.clock = new THREE.Clock();
    this.soundManager = new SoundManager();
    this.stateMachine = new ClinicalStateMachine({ autoCrashTimerSec: 10 });

    // 3D Scene setup
    report('initThree');
    this.initThree();
    report('initSceneObjects');
    this.initSceneObjects();
    report('initXR');
    this.initXR();
    report('initEventListeners');
    this.initEventListeners();
    report('initStateMachineBridges');
    this.initStateMachineBridges();

    // Apply initial encounter configuration (Dental clinic, African geriatric patient)
    report('applyEncounterConfig');
    this.applyEncounterConfig(
      this.selectedDiscipline,
      this.selectedScenario,
      this.selectedDemographic,
      this.selectedEnv,
      false
    );

    // Initial dialogue
    report('triggerDialogue');
    this.triggerDialogue(ClinicalStates.BASELINE, Interventions.NONE);

    // Start render loop
    report('setAnimationLoop');
    this.renderer.setAnimationLoop(this.render.bind(this));
    report('Constructor complete');
  }

  initThree() {
    this.scene = new THREE.Scene();

    // Doctor first-person eye-level camera view looking right at the patient
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.05, 50);
    this.setCameraPreset('wide');

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.xr.enabled = true;
    this.renderer.setClearColor(0x000000, 0); // Transparent passthrough for Quest AR
    this.container.appendChild(this.renderer.domElement);

    // Desktop Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.95, -1.25);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 0.4;
    this.controls.maxDistance = 6.0;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setCameraPreset(preset) {
    if (this.patient?.setOralInspectionMode) {
      this.patient.setOralInspectionMode(preset === 'oral');
    }

    if (preset === 'wide') {
      // First-person perspective matching VR Dentist view
      this.camera.position.set(0, 1.28, 0.20);
      if (this.controls) {
        this.controls.target.set(0, 0.95, -1.25);
        this.controls.update();
      }
    } else if (preset === 'patient') {
      // Close focus on patient's face, sweating, expressions & breathing
      this.camera.position.set(0.10, 1.20, -0.65);
      if (this.controls) {
        this.controls.target.set(0, 1.05, -1.25);
        this.controls.update();
      }
    } else if (preset === 'oral') {
      // Focused macro oral cavity inspection view looking directly inside patient's open mouth
      this.camera.position.set(0.0, 1.14, -0.95);
      if (this.controls) {
        this.controls.target.set(0.0, 1.10, -1.35);
        this.controls.update();
      }
    } else if (preset === 'tray') {
      // Close focus on bedside emergency drug tray & syringes
      this.camera.position.set(0.55, 1.15, -0.45);
      if (this.controls) {
        this.controls.target.set(0.48, 0.72, -0.75);
        this.controls.update();
      }
    }
  }

  initSceneObjects() {
    // 1. Universal Clinical Emergency Environment (Lighting, Walls, Operatory Station)
    this.environment = new ClinicalEnvironment();
    this.scene.add(this.environment.group);

    // 2. Patient Entity: Treatment Chair + Realistic 3D Patient Character + Assistant
    this.patient = new PatientEntity(this.soundManager);
    this.patient.group.position.set(0, 0, -1.25);
    this.scene.add(this.patient.group);

    // 3. Bedside Emergency Mayo Drug Tray (Glucose, Glucagon, Adrenaline, Aspirin/GTN, Insulin, Trendelenburg)
    this.tray = new EquipmentTray(this.soundManager, (intervention) => {
      this.stateMachine.administer(intervention);
    });
    this.tray.group.position.set(0.48, 0, -0.75);
    this.tray.group.rotation.y = -0.32;
    this.scene.add(this.tray.group);

    // 4. Floating Spatial Vitals Monitor (Glassmorphism)
    this.vitalsMonitor = new SpatialVitalsMonitor(this.soundManager);
    this.vitalsMonitor.group.position.set(-0.80, 1.36, -1.15);
    this.vitalsMonitor.group.rotation.y = 0.44;
    this.scene.add(this.vitalsMonitor.group);

    // 5. Floating Spatial Dialogue Bubble (Anchored above patient head)
    this.dialogueBubble = new SpatialDialogueBubble();
    this.dialogueBubble.group.position.set(0, 1.62, -1.40);
    this.scene.add(this.dialogueBubble.group);

    // 6. First-Person Clinician Nitrile Gloved Hands (Foreground presence)
    this.scene.add(this.camera);
    this.hands = new FirstPersonHands(this.camera);
    this.hands.setVisible(false); // Clean desktop view; physical Quest controllers / hand tracking active in WebXR
  }

  initXR() {
    this.xrManager = new XRManager(
      this.renderer,
      this.scene,
      this.camera,
      (raycaster) => this.handleRaycastSelect(raycaster),
      (hoveredObj) => this.tray.setHovered(hoveredObj)
    );

    const enterArBtn = document.getElementById('btn-enter-ar');
    if ('xr' in navigator) {
      navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        if (supported) {
          enterArBtn.style.display = 'block';
          enterArBtn.addEventListener('click', () => this.startARSession());
        } else {
          enterArBtn.style.display = 'none';
        }
      }).catch(() => {
        enterArBtn.style.display = 'none';
      });
    }

    this.renderer.domElement.addEventListener('pointerdown', (event) => {
      if (this.renderer.xr.isPresenting) return;
      if (event.target.closest('#hud-container button, #hud-container input, #hud-container .starthub-card, #hud-container .clipboard-tablet, #hud-container .intervention-container, #hud-container .audit-report-card, #hud-container .unreal-dialog-frame')) return;

      const rect = this.renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.camera);
      this.handleRaycastSelect(raycaster);
    });

    this.renderer.domElement.addEventListener('pointermove', (event) => {
      if (this.renderer.xr.isPresenting) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.camera);
      const intersects = raycaster.intersectObjects(this.tray.interactiveObjects, true);

      if (intersects.length > 0) {
        let topInteractive = intersects[0].object;
        while (topInteractive && !this.tray.interactiveObjects.includes(topInteractive)) {
          topInteractive = topInteractive.parent;
        }
        this.tray.setHovered(topInteractive);
        this.renderer.domElement.style.cursor = 'pointer';
      } else {
        this.tray.setHovered(null);
        this.renderer.domElement.style.cursor = 'default';
      }
    });
  }

  handleRaycastSelect(raycaster) {
    // 1. Check if user clicked on interactive drug tray items
    const intersects = raycaster.intersectObjects(this.tray.interactiveObjects, true);
    if (intersects.length > 0) {
      let topInteractive = intersects[0].object;
      while (topInteractive && !this.tray.interactiveObjects.includes(topInteractive)) {
        topInteractive = topInteractive.parent;
      }
      if (topInteractive) {
        const targetPos = this.patient.getInjectionWorldPosition();
        this.tray.triggerSelect(topInteractive, targetPos);
        return;
      }
    }

    // 2. Check if user clicked on the Radial Pulse Hotspot on wrist
    if (this.patient.radialPulseHotspot) {
      const pulseHits = raycaster.intersectObjects([this.patient.radialPulseHotspot], true);
      if (pulseHits.length > 0) {
        this.checkRadialPulse();
      }
    }
  }

  async startARSession() {
    try {
      this.soundManager.initAudioContext();
      if (this.hands) this.hands.setVisible(false);

      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking']
      });
      await this.renderer.xr.setSession(session);
      document.body.classList.add('in-xr');

      this.environment.setPassthroughMode(true);

      session.addEventListener('end', () => {
        document.body.classList.remove('in-xr');
        this.environment.setPassthroughMode(false);
        if (this.hands) this.hands.setVisible(true);
      });
    } catch (err) {
      console.error('[WebXR AR] Failed to initialize immersive-ar:', err);
      alert('Could not start WebXR AR: ' + err.message);
    }
  }

  applyEncounterConfig(discipline, scenario, demographicKey, env, autoReset = true) {
    this.selectedDiscipline = discipline;
    this.selectedScenario = scenario;
    this.selectedDemographic = demographicKey;
    this.selectedEnv = env;

    // 1. Set Clinical Discipline & authentic equipment visibility
    this.stateMachine.setDiscipline(discipline);

    const hudBadge = document.getElementById('hud-active-discipline-badge');
    const hudIcon = document.getElementById('hud-discipline-icon');
    const hudTitle = document.getElementById('hud-discipline-title');
    const hudVitalsPill = document.getElementById('hud-vitals-pill');
    const btnCheckPulse = document.getElementById('btn-check-pulse');
    const tabClinician = document.getElementById('tab-view-clinician');

    if (this.environment?.setDiscipline) {
      this.environment.setDiscipline(discipline);
    }

    if (discipline === HealthcareDisciplines.DENTAL) {
      if (hudIcon) hudIcon.textContent = '🦷';
      if (hudTitle) hudTitle.textContent = 'DENTIST (CHAIRSIDE OPERATORY)';
      if (tabClinician) tabClinician.textContent = '🦷 Dentist';
      // Real dental practices DO NOT have wall-mounted cardiac telemetry monitors!
      this.vitalsMonitor.group.visible = false;
      if (hudVitalsPill) hudVitalsPill.style.display = 'none';
      if (btnCheckPulse) {
        btnCheckPulse.style.border = '1px solid #10b981';
        btnCheckPulse.style.boxShadow = '0 0 12px rgba(16,185,129,0.35)';
      }
    } else {
      // In Hospital ER, Ward, and Paramedic EMS: wall/mobile telemetry monitor is active
      this.vitalsMonitor.group.visible = true;
      if (hudVitalsPill) hudVitalsPill.style.display = 'flex';
      if (btnCheckPulse) {
        btnCheckPulse.style.border = '';
        btnCheckPulse.style.boxShadow = '';
      }

      if (discipline === HealthcareDisciplines.MEDICAL) {
        if (hudIcon) hudIcon.textContent = '🩺';
        if (hudTitle) hudTitle.textContent = 'ER DOCTOR (RESUS BAY)';
        if (tabClinician) tabClinician.textContent = '🩺 Doctor';
      } else if (discipline === HealthcareDisciplines.NURSING) {
        if (hudIcon) hudIcon.textContent = '💉';
        if (hudTitle) hudTitle.textContent = 'WARD NURSE (BEDSIDE)';
        if (tabClinician) tabClinician.textContent = '💉 Nurse';
      } else if (discipline === HealthcareDisciplines.PARAMEDIC) {
        if (hudIcon) hudIcon.textContent = '🚑';
        if (hudTitle) hudTitle.textContent = 'LEAD PARAMEDIC (FIELD EMS)';
        if (tabClinician) tabClinician.textContent = '🚑 Paramedic';
      }
    }

    // 2. Scenario Resolution (Mystery Detective vs Known)
    if (scenario === 'RANDOM') {
      const pool = [
        EmergencyScenarios.HYPOGLYCEMIA,
        EmergencyScenarios.ANAPHYLAXIS,
        EmergencyScenarios.MYOCARDIAL_INFARCTION,
        EmergencyScenarios.VASOVAGAL_SYNCOPE
      ];
      this.activeScenario = pool[Math.floor(Math.random() * pool.length)];
    } else {
      this.activeScenario = scenario;
    }

    this.stateMachine.setScenario(this.activeScenario);
    this.patient.setScenario(this.activeScenario);

    // 3. Demographic Profile (Inclusive Dermatology & Geriatric presentation)
    const profile = DemographicProfiles[demographicKey] || DemographicProfiles.AFRICAN_GERIATRIC_F;
    this.stateMachine.setDemographic(demographicKey);
    this.patient.setDemographic(profile);

    const clipboardMeta = document.getElementById('clipboard-patient-meta');
    if (clipboardMeta) {
      clipboardMeta.textContent = `SIMULATION • PATIENT: ${profile.name.toUpperCase()} (${profile.age} Y/O ${profile.sex.toUpperCase()}) • ${discipline}`;
    }

    // 4. Environment Mode (Virtual vs Mixed Reality Passthrough)
    if (env === 'PASSTHROUGH') {
      this.environment.setPassthroughMode(true);
    } else {
      this.environment.setPassthroughMode(false);
    }

    if (autoReset) {
      this.resetSimulation();
    }
  }

  checkRadialPulse() {
    this.soundManager.initAudioContext();
    const vitals = this.stateMachine.getVitalsSnapshot();
    const state = this.stateMachine.currentState;
    const scenario = this.activeScenario;

    let character = 'Regular Rhythm, Strong Normal Volume';
    let alertColor = '#10b981';

    if (state === ClinicalStates.DECOMPENSATING || state === ClinicalStates.CRITICAL_ERROR) {
      if (scenario === EmergencyScenarios.HYPOGLYCEMIA) {
        character = 'Sinus Tachycardia (~110+ BPM), Weak & Thready, Profuse Clamminess';
        alertColor = '#f59e0b';
      } else if (scenario === EmergencyScenarios.ANAPHYLAXIS) {
        character = 'Severe Tachycardia (~130+ BPM), Thready, Barely Palpable (Hypotensive Shock)';
        alertColor = '#ef4444';
      } else if (scenario === EmergencyScenarios.MYOCARDIAL_INFARCTION) {
        character = 'Irregular Rhythm, Ectopic Beats, Weak Volume, Peripheral Cyanosis';
        alertColor = '#f59e0b';
      } else if (scenario === EmergencyScenarios.VASOVAGAL_SYNCOPE) {
        character = 'Profound Bradycardia (~45 BPM), Faint Soft Pulse';
        alertColor = '#00f0ff';
      }
    } else if (state === ClinicalStates.RECOVERY_CORRECT) {
      character = 'Regular Rhythm, Strong Pulse, Warm Peripheries (Perfusion Restored)';
      alertColor = '#10b981';
    }

    const toast = document.getElementById('pulse-feedback-toast');
    const toastText = document.getElementById('pulse-toast-text');
    if (toast && toastText) {
      toastText.textContent = `Palpating Radial Pulse: ${vitals.heartRate} BPM — ${character}`;
      toast.style.borderColor = alertColor;
      toast.style.display = 'flex';
      toast.classList.remove('fade-out');

      clearTimeout(this.pulseToastTimeout);
      this.pulseToastTimeout = setTimeout(() => {
        toast.style.display = 'none';
      }, 4500);
    }

    // Auditory feedback: gentle pulse click
    this.soundManager.playBeep(vitals.heartRate > 100 ? 540 : 440, 0.07);

    // Quest Controller Haptic Feedback (Vibration pulse)
    if (this.xrManager) {
      this.xrManager.triggerHaptic(0.7, 180);
    }
  }

  initStateMachineBridges() {
    this.stateMachine.onStateChange = (newState, oldState, lastIntervention, snapshot) => {
      try { if (this.soundManager?.onStateChange) this.soundManager.onStateChange(newState, snapshot); } catch (e) { console.warn(e); }
      try { if (this.vitalsMonitor?.updateState) this.vitalsMonitor.updateState(newState, snapshot); } catch (e) { console.warn(e); }
      try { if (this.patient?.updateVitals) this.patient.updateVitals(snapshot); } catch (e) { console.warn(e); }

      // Trigger Procedure Stopped modal when patient first decompensates
      if (newState === ClinicalStates.DECOMPENSATING) {
        const procModal = document.getElementById('modal-procedure-stopped');
        if (procModal) procModal.style.display = 'block';
      }

      // Fetch dynamic conversational dialogue from LLM Bridge
      this.triggerDialogue(newState, lastIntervention);
    };

    this.stateMachine.onVitalsUpdate = (snapshot) => {
      try { if (this.soundManager?.updateVitals) this.soundManager.updateVitals(snapshot); } catch (e) { console.warn(e); }
      try { if (this.vitalsMonitor?.updateVitals) this.vitalsMonitor.updateVitals(snapshot); } catch (e) { console.warn(e); }
      try { if (this.patient?.updateVitals) this.patient.updateVitals(snapshot); } catch (e) { console.warn(e); }
      try { this.updateHUDVitals(snapshot); } catch (e) { console.warn(e); }
    };

    this.stateMachine.onAuditGenerated = (report) => {
      setTimeout(() => {
        this.displayAuditReport(report);
      }, 3500);
    };
  }

  async triggerDialogue(state, intervention) {
    try {
      const vitals = this.stateMachine.getVitalsSnapshot();
      const dialogueText = await fetchPatientDialogue(state, intervention, vitals);
      if (this.dialogueBubble?.showText) {
        this.dialogueBubble.showText(dialogueText, 6.0);
      } else if (this.dialogueBubble?.setDialogue) {
        this.dialogueBubble.setDialogue(dialogueText);
      }
    } catch (err) {
      console.warn('[Dialogue] Fallback dialogue trigger:', err);
    }
  }

  updateHUDVitals(snapshot) {
    const hrEl = document.getElementById('hud-hr-readout');
    const bpEl = document.getElementById('hud-bp-readout');
    const pulseBar = document.getElementById('hud-pulse-level');

    if (hrEl) hrEl.textContent = Math.round(snapshot.heartRate);
    if (bpEl) bpEl.textContent = `${Math.round(snapshot.systolicBP)}/${Math.round(snapshot.diastolicBP)}`;

    if (pulseBar) {
      const pct = Math.max(15, Math.min(100, (snapshot.heartRate / 140) * 100));
      pulseBar.style.width = `${pct}%`;

      if (snapshot.heartRate > 110 || snapshot.systolicBP < 85) {
        pulseBar.style.background = 'linear-gradient(90deg, #ef4444, #f59e0b)';
      } else {
        pulseBar.style.background = 'linear-gradient(90deg, #10b981, #00f0ff)';
      }
    }
  }

  displayAuditReport(report) {
    const modal = document.getElementById('modal-audit-report');
    if (!modal) return;

    const discTitle = document.getElementById('rpt-discipline-title');
    if (discTitle) {
      discTitle.textContent = `${report.discipline} CLINICAL COMPETENCY EVALUATION`;
    }

    document.getElementById('rpt-recog-time').textContent = `${report.recogTimeStr} (${report.recogPass ? 'PASS' : 'AT RISK'})`;
    document.getElementById('rpt-recog-time').className = `stat-val ${report.recogPass ? 'pass' : 'fail'}`;

    document.getElementById('rpt-interv-time').textContent = `${report.intervTimeStr} (${report.intervPass ? 'PASS' : 'AT RISK'})`;
    document.getElementById('rpt-interv-time').className = `stat-val ${report.intervPass ? 'pass' : 'fail'}`;

    document.getElementById('rpt-outcome').textContent = report.patientOutcome;
    document.getElementById('rpt-outcome').className = `stat-val ${report.outcomePass ? 'pass' : 'fail'}`;

    document.getElementById('rpt-score-num').textContent = `${report.scoreTotal} / 100%`;

    document.getElementById('rpt-log-symptoms').innerHTML = `• Observed Signs: <span class="${report.symptomsIdentified >= 1 ? 'tag-pass' : 'tag-fail'}">[ ${report.symptomsIdentified >= 1 ? 'PASS' : 'FAIL'} ]</span> ${report.symptomCheckText}`;
    document.getElementById('rpt-log-diagnosis').innerHTML = `• Differential Diagnosis: <span class="${report.diagnosisPass ? 'tag-pass' : 'tag-fail'}">[ ${report.diagnosisPass ? 'PASS' : 'FAIL'} ]</span> ${report.diagnosisText}`;
    document.getElementById('rpt-log-treatment').innerHTML = `• Treatment Protocol: <span class="${report.treatmentPass ? 'tag-pass' : 'tag-fail'}">[ ${report.treatmentPass ? 'PASS' : 'FAIL'} ]</span> ${report.treatmentText}`;

    const gradeEl = document.getElementById('rpt-grade-text');
    gradeEl.textContent = report.competencyGradeText;
    gradeEl.className = `rating-grade grade-${report.competencyGrade.toLowerCase()}`;

    document.getElementById('rpt-recommendation').textContent = report.recommendation;

    modal.style.display = 'flex';
  }

  initEventListeners() {
    const procModal = document.getElementById('modal-procedure-stopped');
    const clipboardModal = document.getElementById('modal-clipboard');
    const interventionModal = document.getElementById('modal-intervention');
    const auditModal = document.getElementById('modal-audit-report');
    const startHubModal = document.getElementById('modal-start-hub');

    // 1. SPATIAL START HUB: Options Selection Logic
    const bindChoiceCards = (selector, onSelect) => {
      const cards = document.querySelectorAll(selector);
      cards.forEach(card => {
        card.addEventListener('click', () => {
          cards.forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          if (onSelect) onSelect(card);
        });
      });
    };

    let tempDiscipline = this.selectedDiscipline;
    let tempScenario = this.selectedScenario;
    let tempDemographic = this.selectedDemographic;
    let tempEnv = this.selectedEnv;

    bindChoiceCards('.hub-choice-card[data-discipline]', (card) => {
      tempDiscipline = card.dataset.discipline;
    });

    bindChoiceCards('.hub-choice-card[data-scenario]', (card) => {
      tempScenario = card.dataset.scenario;
    });

    bindChoiceCards('.hub-choice-card[data-demographic]', (card) => {
      tempDemographic = card.dataset.demographic;
    });

    bindChoiceCards('.hub-choice-card[data-env]', (card) => {
      tempEnv = card.dataset.env;
    });

    // Launch Encounter Button
    document.getElementById('btn-launch-encounter').addEventListener('click', () => {
      this.soundManager.initAudioContext();
      if (startHubModal) startHubModal.style.display = 'none';
      this.applyEncounterConfig(tempDiscipline, tempScenario, tempDemographic, tempEnv, true);
    });

    // Top Bar Encounter Hub Button
    document.getElementById('btn-open-starthub').addEventListener('click', () => {
      this.soundManager.initAudioContext();
      if (startHubModal) startHubModal.style.display = 'flex';
    });

    // 2. Camera View Tabs
    const viewTabs = document.querySelectorAll('.view-tab');
    viewTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        viewTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.setCameraPreset(tab.dataset.view);
      });
    });

    // 3. Palpate Radial Pulse Button
    document.getElementById('btn-check-pulse').addEventListener('click', () => {
      this.checkRadialPulse();
    });

    // 4. Stop Procedure / Distress Assessment Trigger
    document.getElementById('btn-manual-stop').addEventListener('click', () => {
      this.soundManager.initAudioContext();
      if (procModal) procModal.style.display = 'block';
    });

    // 5. Modal: PROCEDURE STOPPED. SELECT ACTION
    document.getElementById('btn-resume-checkup').addEventListener('click', () => {
      if (procModal) procModal.style.display = 'none';
    });

    document.getElementById('btn-declare-emergency').addEventListener('click', () => {
      this.soundManager.initAudioContext();
      if (procModal) procModal.style.display = 'none';
      this.stateMachine.declareEmergency();
      if (clipboardModal) clipboardModal.style.display = 'flex';
    });

    // 6. Modal: MEDICAL DIGITAL CLIPBOARD (Diagnostic Triage)
    document.getElementById('btn-open-clipboard').addEventListener('click', () => {
      if (clipboardModal) clipboardModal.style.display = 'flex';
    });

    document.getElementById('btn-close-clipboard').addEventListener('click', () => {
      if (clipboardModal) clipboardModal.style.display = 'none';
    });

    document.getElementById('btn-confirm-clipboard').addEventListener('click', () => {
      this.soundManager.initAudioContext();
      const symptoms = [];
      if (document.getElementById('symp-diaphoresis')?.checked) symptoms.push('diaphoresis');
      if (document.getElementById('symp-tremors')?.checked) symptoms.push('tremors');
      if (document.getElementById('symp-confusion')?.checked) symptoms.push('confusion');
      if (document.getElementById('symp-stridor')?.checked) symptoms.push('stridor');
      if (document.getElementById('symp-chestpain')?.checked) symptoms.push('chestpain');

      const selectedDiagRadio = document.querySelector('input[name="diagnosis-choice"]:checked');
      const diagnosis = selectedDiagRadio ? selectedDiagRadio.value : null;

      this.stateMachine.submitDiagnosis(symptoms, diagnosis);
      if (clipboardModal) clipboardModal.style.display = 'none';

      // Automatically pop up SELECT IMMEDIATE INTERVENTION
      if (interventionModal) interventionModal.style.display = 'flex';
    });

    // 7. Modal: SELECT IMMEDIATE INTERVENTION (5 Core Healthcare Cards)
    const administerFromModal = (type) => {
      this.soundManager.initAudioContext();
      if (interventionModal) interventionModal.style.display = 'none';

      // Find matching item on tray to animate
      const trayItem = this.tray.interactiveObjects.find(obj => obj.userData?.type === type);
      if (trayItem) {
        const targetPos = this.patient.getInjectionWorldPosition();
        this.tray.triggerSelect(trayItem, targetPos);
      } else {
        this.stateMachine.administer(type);
      }
    };

    document.getElementById('card-action-glucose').addEventListener('click', () => {
      administerFromModal(Interventions.GLUCOSE_GEL);
    });

    document.getElementById('card-action-adrenaline').addEventListener('click', () => {
      administerFromModal(Interventions.ADRENALINE);
    });

    document.getElementById('card-action-cardiac').addEventListener('click', () => {
      administerFromModal(Interventions.ASPIRIN_GTN);
    });

    document.getElementById('card-action-trendelenburg').addEventListener('click', () => {
      administerFromModal(Interventions.TRENDELENBURG);
    });

    document.getElementById('card-action-insulin').addEventListener('click', () => {
      administerFromModal(Interventions.INSULIN);
    });

    document.getElementById('btn-quick-glucagon').addEventListener('click', () => {
      administerFromModal(Interventions.GLUCAGON);
    });

    document.getElementById('btn-close-intervention').addEventListener('click', () => {
      if (interventionModal) interventionModal.style.display = 'none';
    });

    // 8. Modal: SESSION AUDIT REPORT
    document.getElementById('btn-retry-module').addEventListener('click', () => {
      if (auditModal) auditModal.style.display = 'none';
      this.resetSimulation();
    });

    document.getElementById('btn-close-audit').addEventListener('click', () => {
      if (auditModal) auditModal.style.display = 'none';
      if (startHubModal) startHubModal.style.display = 'flex';
    });

    document.getElementById('btn-export-pdf').addEventListener('click', () => {
      window.print();
    });

    // 9. Audio Toggle
    const audioBtn = document.getElementById('btn-audio-toggle');
    const audioIcon = document.getElementById('audio-icon');
    audioBtn.addEventListener('click', () => {
      this.soundManager.initAudioContext();
      const isMuted = this.soundManager.toggleMute();
      audioIcon.textContent = isMuted ? '🔇' : '🔊';
    });

    // 10. Reset Simulation
    document.getElementById('btn-reset').addEventListener('click', () => {
      this.resetSimulation();
    });

    // 11. Settings Drawer
    const settingsBtn = document.getElementById('btn-settings');
    const settingsDrawer = document.getElementById('settings-drawer');
    settingsBtn.addEventListener('click', () => settingsDrawer.classList.toggle('open'));
    document.getElementById('btn-close-settings').addEventListener('click', () => settingsDrawer.classList.remove('open'));
    document.getElementById('btn-save-settings').addEventListener('click', () => {
      LLM_CONFIG.apiEndpoint = document.getElementById('cfg-endpoint').value.trim() || null;
      LLM_CONFIG.apiKey = document.getElementById('cfg-key').value.trim() || null;
      settingsDrawer.classList.remove('open');
    });

    window.addEventListener('pointerdown', () => this.soundManager.initAudioContext(), { once: true });
  }

  resetSimulation() {
    this.soundManager.initAudioContext();
    this.stateMachine.reset();
    this.tray.reset();

    const procModal = document.getElementById('modal-procedure-stopped');
    const clipboardModal = document.getElementById('modal-clipboard');
    const interventionModal = document.getElementById('modal-intervention');
    const auditModal = document.getElementById('modal-audit-report');

    if (procModal) procModal.style.display = 'none';
    if (clipboardModal) clipboardModal.style.display = 'none';
    if (interventionModal) interventionModal.style.display = 'none';
    if (auditModal) auditModal.style.display = 'none';

    // Uncheck clipboard inputs
    const checks = document.querySelectorAll('#modal-clipboard input');
    checks.forEach(c => c.checked = false);

    this.triggerDialogue(ClinicalStates.BASELINE, Interventions.NONE);
  }

  render() {
    try {
      const delta = Math.min(this.clock.getDelta(), 0.1);

      // Update core simulation state machine
      this.stateMachine.update(delta);

      // Update 3D entities & animations
      this.patient.update(delta);
      this.tray.update(delta);
      this.vitalsMonitor.update(delta);
      this.dialogueBubble.update(delta, this.camera);

      // Update XR / Desktop controls
      if (this.renderer.xr.isPresenting) {
        this.xrManager.update(this.tray.interactiveObjects);
      } else if (this.controls) {
        this.controls.update();
      }

      // Render WebGL frame
      this.renderer.render(this.scene, this.camera);

      if (!this._hasRenderedFirstFrame) {
        this._hasRenderedFirstFrame = true;
        console.log('[PEARLSIM] First WebGL frame rendered successfully!');
        try { fetch('/log', { method: 'POST', body: '[PEARLSIM] First WebGL frame rendered successfully!' }).catch(() => {}); } catch(_) {}
      }
    } catch (err) {
      if (!this._hasLoggedRenderError) {
        this._hasLoggedRenderError = true;
        console.error('[PEARLSIM] Render Loop Error:', err);
        try { fetch('/log', { method: 'POST', body: `[RENDER_ERROR] ${err.message} Stack: ${err.stack}` }).catch(() => {}); } catch(_) {}
      }
    }
  }
}

// Bootstrap application on window load (safe against already-fired DOMContentLoaded)
function startPearlSim() {
  try {
    window.pearlApp = new PearlSimApp();
  } catch (err) {
    console.error('[PEARLSIM] Fatal error bootstrapping application:', err);
    try { fetch('/log', { method: 'POST', body: `[BOOTSTRAP_FATAL] ${err.message} Stack: ${err.stack}` }).catch(() => {}); } catch(_) {}
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', startPearlSim);
} else {
  startPearlSim();
}
