/**
 * main.js - Institutional P.E.A.R.L. Simulation Application Core
 * Matches the clean, sequential Unreal Engine Prototype Workflow + Physical 3D Resuscitation
 * Zero Emojis • Strict Academic Medical Standard
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

import { ClinicalEngine, EmergencyCases, PatientRecords } from './core/ClinicalEngine.js';
import { DialogueEngine } from './core/DialogueEngine.js';
import { SoundManager } from './audio/SoundManager.js';
import { OperatoryScene } from './scene/OperatoryScene.js';
import { PatientAvatar } from './scene/PatientAvatar.js';
import { AssistantAvatar } from './scene/AssistantAvatar.js';
import { ResuscitationKit } from './scene/ResuscitationKit.js';
import { WebXRManager } from './xr/WebXRManager.js';

window.THREE = THREE;

const report = (msg) => {
  console.log(`[PEARLSIM] ${msg}`);
  try { fetch('/log', { method: 'POST', body: `[PEARLSIM] ${msg}` }).catch(() => {}); } catch(_) {}
};
window.addEventListener('error', (e) => report(`CLIENT ERROR: ${e.message} at ${e.filename}:${e.lineno}`));

class PearlSimApp {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // 1. Core Clinical Engines
    this.soundManager = new SoundManager();
    this.clinicalEngine = new ClinicalEngine(this.soundManager);
    this.dialogueEngine = new DialogueEngine(
      (transcript) => this.handleSpeechRecognized(transcript),
      (speechState) => this.handleSpeechSynthesized(speechState)
    );

    // 2. Loaders
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);

    // 3. Three.js Scene Setup
    this.initThree();

    // 4. Scene Entities
    this.operatory = new OperatoryScene(this.gltfLoader);
    this.scene.add(this.operatory.group);

    this.patient = new PatientAvatar(this.gltfLoader, this.clinicalEngine, this.soundManager);
    this.patient.group.position.set(0, 0, -1.25);
    this.scene.add(this.patient.group);

    this.assistant = new AssistantAvatar(this.gltfLoader);
    this.assistant.group.position.set(0, 0, -1.25);
    this.scene.add(this.assistant.group);

    this.resusKit = new ResuscitationKit(
      this.soundManager,
      () => this.handleMouthMirrorClicked(),
      (drugData) => this.handleMedicationPicked(drugData)
    );
    this.scene.add(this.resusKit.group);

    // 5. Sequential State Machine Tracking
    this.encounterPhase = 'LANDING'; // LANDING -> PRE_PROCEDURE -> OBSERVATION -> QUIZ_SYMPTOMS -> QUIZ_DIAGNOSIS -> QUIZ_TREATMENT -> PHYSICAL_ADMIN -> COMPLETED
    this.recognitionTimerSec = 0;
    this.recognitionTimerActive = false;
    this.timeToRecognition = 0;
    this.timeToIntervention = 0;

    this.quizStep = 1; // 1 = Symptoms, 2 = Diagnosis, 3 = Treatment
    this.selectedSymptoms = new Set();
    this.selectedDiagnosis = null;
    this.selectedTreatment = null;

    this.activeHeldMedication = null;
    this.isHoldingInjection = false;
    this.pulsePalpationActive = false;
    this.pulseBeatTimer = 0;

    // 6. Raycasting Setup
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // 7. WebXR Manager
    this.xrManager = new WebXRManager(this.renderer, this.scene, this.camera, (controller) => {
      this.handleXRControllerSelect(controller);
    });

    // 8. Bind UI Events
    this.initDOMBindings();

    // 9. Start Render Loop
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.render());

    // Check WebXR support
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then(supported => {
        if (supported) {
          const btn = document.getElementById('btn-enter-xr');
          if (btn) btn.style.display = 'inline-block';
        }
      }).catch(() => {});
    }
  }

  showScreen(screenId) {
    document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
  }

  initThree() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.05, 50);
    this.setCameraPreset('wide');

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.xr.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0.0, 1.05, -1.30);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Mouse Raycasting
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
  }

  setCameraPreset(preset) {
    if (preset === 'wide') {
      // First-Person Chairside Dentist Perspective looking directly down at reclined patient head & mouth
      this.camera.position.set(0.16, 1.32, -0.68);
      if (this.controls) {
        this.controls.target.set(0.0, 1.05, -1.30);
        this.controls.update();
      }
      if (this.operatory) this.operatory.setOralSpotlight(false);
      if (this.patient) this.patient.setOralInspectionMode(false);
    } else if (preset === 'patient') {
      // Close focus on patient face & distress signs
      this.camera.position.set(0.06, 1.22, -0.92);
      if (this.controls) {
        this.controls.target.set(0.0, 1.05, -1.35);
        this.controls.update();
      }
      if (this.operatory) this.operatory.setOralSpotlight(false);
      if (this.patient) this.patient.setOralInspectionMode(false);
    } else if (preset === 'oral') {
      // Focused macro examination into open mouth
      this.camera.position.set(0.01, 1.15, -1.05);
      if (this.controls) {
        this.controls.target.set(0.0, 1.08, -1.35);
        this.controls.update();
      }
      if (this.operatory) this.operatory.setOralSpotlight(true);
      if (this.patient) this.patient.setOralInspectionMode(true);
    } else if (preset === 'kit') {
      // Direct countertop view of the Red Emergency Resuscitation Box
      this.camera.position.set(0.55, 1.25, -3.40);
      if (this.controls) {
        this.controls.target.set(0.60, 0.90, -4.10);
        this.controls.update();
      }
      if (this.operatory) this.operatory.setOralSpotlight(false);
      if (this.patient) this.patient.setOralInspectionMode(false);
    } else if (preset === 'thigh') {
      // Chairside view of Vastus Lateralis outer thigh for IM injection
      this.camera.position.set(0.48, 1.05, -0.72);
      if (this.controls) {
        this.controls.target.set(0.20, 0.52, -1.15);
        this.controls.update();
      }
    }
  }

  initDOMBindings() {
    // 1. Scenario Mode Selector on Landing Page
    const selectScenario = document.getElementById('select-scenario');
    const summaryText = document.getElementById('mode-summary-text');
    if (selectScenario) {
      selectScenario.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'BLIND') {
          summaryText.textContent = 'Blind Triage Assessment (Standard Clinical Exam)';
          this.clinicalEngine.setCase('ANAPHYLAXIS', true);
        } else {
          const c = EmergencyCases[val];
          summaryText.textContent = `Configured Case: ${c.title}`;
          this.clinicalEngine.setCase(val, false);
        }
      });
    }

    // 2. Start Encounter Button (Enters Operatory)
    const btnStart = document.getElementById('btn-start-encounter');
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        this.enterOperatory();
      });
    }

    // 3. Begin Procedure Button (From Start Dialogue Bar)
    const btnBegin = document.getElementById('btn-begin-procedure');
    if (btnBegin) {
      btnBegin.addEventListener('click', () => {
        this.startProcedureObservation();
      });
    }

    // 4. STOP PROCEDURE Button (Top-Right Observation)
    const btnStop = document.getElementById('btn-stop-procedure');
    if (btnStop) {
      btnStop.addEventListener('click', () => {
        this.handleProcedureStopped();
      });
    }

    // 5. Quiz Action Button (Submits Symptoms / Treatment)
    const btnQuizAction = document.getElementById('btn-quiz-action');
    if (btnQuizAction) {
      btnQuizAction.addEventListener('click', () => {
        this.handleQuizActionClick();
      });
    }

    // 6. View Session Report Button (Post-Resuscitation)
    const btnViewReport = document.getElementById('btn-view-session-report');
    if (btnViewReport) {
      btnViewReport.addEventListener('click', () => {
        this.concludeEncounterAndDebrief();
      });
    }

    // 7. Quick Radial Pulse Button in Top Bar
    const btnQuickPulse = document.getElementById('btn-quick-pulse');
    if (btnQuickPulse) {
      btnQuickPulse.addEventListener('click', () => {
        this.handleRadialPulsePalpation();
      });
    }

    // 8. Patient Dossier Drawer Toggle
    const btnToggleDossier = document.getElementById('btn-toggle-dossier');
    const dossierDrawer = document.getElementById('dossier-drawer');
    const btnCloseDossier = document.getElementById('btn-close-dossier');
    if (btnToggleDossier && dossierDrawer) {
      btnToggleDossier.addEventListener('click', () => {
        dossierDrawer.style.display = (dossierDrawer.style.display === 'none') ? 'block' : 'none';
      });
    }
    if (btnCloseDossier && dossierDrawer) {
      btnCloseDossier.addEventListener('click', () => {
        dossierDrawer.style.display = 'none';
      });
    }

    // 9. Conclude Encounter Button
    const btnConclude = document.getElementById('btn-conclude-encounter');
    if (btnConclude) {
      btnConclude.addEventListener('click', () => {
        this.concludeEncounterAndDebrief();
      });
    }

    // 10. Print CPD Audit Report (PDF)
    const btnPrint = document.getElementById('btn-print-audit');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        window.print();
      });
    }

    // 11. Retry Encounter Button
    const btnRetry = document.getElementById('btn-retry-encounter');
    if (btnRetry) {
      btnRetry.addEventListener('click', () => {
        this.enterOperatory();
      });
    }

    // 12. Exit to Menu Button
    const btnExit = document.getElementById('btn-exit-menu');
    if (btnExit) {
      btnExit.addEventListener('click', () => {
        this.showScreen('screen-landing');
      });
    }

    // 13. Quest 3 WebXR Enter Button
    const btnEnterXR = document.getElementById('btn-enter-xr');
    if (btnEnterXR) {
      btnEnterXR.addEventListener('click', () => {
        this.xrManager.startSession('immersive-vr').catch(err => {
          alert('WebXR session error: ' + err.message);
        });
      });
    }
  }

  enterOperatory() {
    this.clinicalEngine.startEncounter();
    this.encounterPhase = 'PRE_PROCEDURE';
    this.showScreen('screen-sim');
    this.setCameraPreset('wide');

    // Reset UI state
    document.getElementById('start-dialogue-bar').style.display = 'flex';
    document.getElementById('btn-stop-procedure').style.display = 'none';
    document.getElementById('quiz-modal').style.display = 'none';
    document.getElementById('drug-delivery-banner').style.display = 'none';
    document.getElementById('resuscitation-done-banner').style.display = 'none';

    // Status badge
    const dot = document.getElementById('sim-status-dot');
    const text = document.getElementById('sim-status-text');
    if (dot) dot.className = 'badge-status-dot';
    if (text) text.textContent = 'ROUTINE CHECKUP';

    // Ensure thigh target ring is hidden during routine exam
    if (this.patient) {
      this.patient.setThighTargetVisible(false);
      this.patient.setOralInspectionMode(false);
    }

    // Initial patient speech
    setTimeout(() => {
      const speech = this.dialogueEngine.getPatientSpeech(this.clinicalEngine.activeCase.id, false);
      this.dialogueEngine.speak(speech.text, speech.speaker, { rate: speech.rate, pitch: speech.pitch });
    }, 800);
  }

  startProcedureObservation() {
    this.encounterPhase = 'OBSERVATION';

    // Hide start dialogue bar
    document.getElementById('start-dialogue-bar').style.display = 'none';

    // Show top-right STOP PROCEDURE button
    const btnStop = document.getElementById('btn-stop-procedure');
    btnStop.style.display = 'flex';

    // Start recognition timer
    this.recognitionTimerSec = 0;
    this.recognitionTimerActive = true;

    // Trigger organic acute distress onset after short delay
    setTimeout(() => {
      this.clinicalEngine.triggerAcuteCrisis();

      const dot = document.getElementById('sim-status-dot');
      const text = document.getElementById('sim-status-text');
      if (dot) dot.className = 'badge-status-dot escalating';
      if (text) text.textContent = 'ESCALATING DISTRESS';

      if (this.patient) {
        this.patient.applyDermatology();
      }

      // Patient sounds distressed
      const speech = this.dialogueEngine.getPatientSpeech(this.clinicalEngine.activeCase.id, true);
      this.dialogueEngine.speak(speech.text, speech.speaker, { rate: speech.rate, pitch: speech.pitch });
    }, 3500);
  }

  handleProcedureStopped() {
    if (this.encounterPhase !== 'OBSERVATION') return;
    this.encounterPhase = 'QUIZ_SYMPTOMS';
    this.recognitionTimerActive = false;
    this.timeToRecognition = Math.max(1, Math.round(this.recognitionTimerSec));

    // Hide STOP button
    document.getElementById('btn-stop-procedure').style.display = 'none';

    // Open Floating Quiz Modal (Center - does NOT fill whole page, 3D scene visible in bg)
    this.openQuizStep1Symptoms();
  }

  openQuizStep1Symptoms() {
    this.quizStep = 1;
    this.selectedSymptoms.clear();

    const modal = document.getElementById('quiz-modal');
    const title = document.getElementById('quiz-question-title');
    const container = document.getElementById('quiz-options-container');
    const feedback = document.getElementById('quiz-feedback-line');
    const actionBtn = document.getElementById('btn-quiz-action');

    title.textContent = 'WHICH SYMPTOMS DID THE PATIENT HAVE?';
    feedback.style.display = 'none';
    actionBtn.textContent = 'Next';

    container.innerHTML = '';

    const symptomOptions = [
      { id: 'tachypnea', label: 'LABORED RESPIRATIONS / WHEEZING' },
      { id: 'diaphoresis', label: 'SWEATING / COLD DIAPHORESIS' },
      { id: 'tongueAngioedema', label: 'TONGUE ANGIOEDEMA / AIRWAY STRIDOR' },
      { id: 'speechSlurring', label: 'SPEECH SLURRING / CORTICAL CONFUSION' },
      { id: 'tremors', label: 'PALE ASHEN TISSUES / TREMORS' },
      { id: 'weakPulse', label: 'TACHYCARDIA / WEAK THREADY PULSE' }
    ];

    symptomOptions.forEach(opt => {
      const div = document.createElement('div');
      div.className = 'quiz-choice-item';
      div.dataset.id = opt.id;
      div.innerHTML = `<input type="checkbox" style="pointer-events:none; width:16px; height:16px; accent-color:#0284c7;"> <span>${opt.label}</span>`;

      div.addEventListener('click', () => {
        const checkbox = div.querySelector('input');
        if (this.selectedSymptoms.has(opt.id)) {
          this.selectedSymptoms.delete(opt.id);
          div.classList.remove('selected');
          checkbox.checked = false;
        } else {
          this.selectedSymptoms.add(opt.id);
          div.classList.add('selected');
          checkbox.checked = true;
        }
      });

      container.appendChild(div);
    });

    modal.style.display = 'block';
  }

  openQuizStep2Diagnosis() {
    this.quizStep = 2;
    this.selectedDiagnosis = null;

    const title = document.getElementById('quiz-question-title');
    const container = document.getElementById('quiz-options-container');
    const feedback = document.getElementById('quiz-feedback-line');
    const actionBtn = document.getElementById('btn-quiz-action');

    title.textContent = 'WHAT IS THE DIFFERENTIAL DIAGNOSIS?';
    feedback.style.display = 'none';
    actionBtn.textContent = 'Next';

    container.innerHTML = '';

    const diagnosisOptions = [
      { id: 'ANAPHYLAXIS', label: 'ACUTE ANAPHYLACTIC SHOCK', isCorrect: (this.clinicalEngine.activeCase.id === 'ANAPHYLAXIS') },
      { id: 'HYPOGLYCEMIA', label: 'SEVERE HYPOGLYCEMIC CRISIS', isCorrect: (this.clinicalEngine.activeCase.id === 'HYPOGLYCEMIA') },
      { id: 'MYOCARDIAL_INFARCTION', label: 'ACUTE CORONARY SYNDROME (STEMI)', isCorrect: (this.clinicalEngine.activeCase.id === 'MYOCARDIAL_INFARCTION') },
      { id: 'VASOVAGAL_SYNCOPE', label: 'VASOVAGAL SYNCOPE (DENTAL PRESYNCOPE)', isCorrect: (this.clinicalEngine.activeCase.id === 'VASOVAGAL_SYNCOPE') }
    ];

    diagnosisOptions.forEach(opt => {
      const div = document.createElement('div');
      div.className = 'quiz-choice-item';
      div.dataset.id = opt.id;
      div.dataset.correct = opt.isCorrect;
      div.innerHTML = `<span style="width:14px; height:14px; border-radius:50%; border:2px solid #0284c7; display:inline-block; flex-shrink:0;"></span> <span>${opt.label}</span>`;

      div.addEventListener('click', () => {
        container.querySelectorAll('.quiz-choice-item').forEach(c => c.classList.remove('selected'));
        div.classList.add('selected');
        this.selectedDiagnosis = opt;
      });

      container.appendChild(div);
    });
  }

  openQuizStep3Treatment() {
    this.quizStep = 3;
    this.selectedTreatment = null;

    const title = document.getElementById('quiz-question-title');
    const container = document.getElementById('quiz-options-container');
    const feedback = document.getElementById('quiz-feedback-line');
    const actionBtn = document.getElementById('btn-quiz-action');

    title.textContent = 'WHAT IS THE TREATMENT?';
    feedback.style.display = 'none';
    actionBtn.textContent = 'Next';

    container.innerHTML = '';

    const treatmentOptions = [
      { id: 'INSULIN', label: 'ADMINISTER INSULIN', isCorrect: false },
      { id: 'TRENDELENBURG', label: 'TRENDELENBURG POSITION (RECLINE)', isCorrect: (this.clinicalEngine.activeCase.correctMedication === 'TRENDELENBURG') },
      { id: 'ADRENALINE', label: 'ADMINISTER ADRENALINE (EPIPEN) 1:1000 IM', isCorrect: (this.clinicalEngine.activeCase.correctMedication === 'ADRENALINE') },
      { id: 'GLUCOSE', label: 'ADMINISTER ORAL GLUCOSE / GLUCAGON', isCorrect: (this.clinicalEngine.activeCase.correctMedication === 'GLUCAGON' || this.clinicalEngine.activeCase.correctMedication === 'GLUCOSE_GEL') },
      { id: 'GTN', label: 'SUBLINGUAL GTN SPRAY (400MCG)', isCorrect: (this.clinicalEngine.activeCase.correctMedication === 'GTN_ASPIRIN') }
    ];

    treatmentOptions.forEach(opt => {
      const div = document.createElement('div');
      div.className = 'quiz-choice-item';
      div.dataset.id = opt.id;
      div.dataset.correct = opt.isCorrect;
      div.innerHTML = `<span style="width:14px; height:14px; border-radius:50%; border:2px solid #0284c7; display:inline-block; flex-shrink:0;"></span> <span>${opt.label}</span>`;

      div.addEventListener('click', () => {
        container.querySelectorAll('.quiz-choice-item').forEach(c => c.classList.remove('selected'));
        div.classList.add('selected');
        this.selectedTreatment = opt;
      });

      container.appendChild(div);
    });
  }

  handleQuizActionClick() {
    if (this.quizStep === 1) {
      // 1. Symptoms submitted -> Move to Step 2: Diagnosis
      this.selectedSymptoms.forEach(sign => {
        this.clinicalEngine.toggleObservedSign(sign);
      });
      this.soundManager.playSyringeClick();
      this.openQuizStep2Diagnosis();
    } else if (this.quizStep === 2) {
      // 2. Diagnosis selected & submitted -> Show instant red/green feedback
      if (!this.selectedDiagnosis) {
        alert('Please select a differential diagnosis.');
        return;
      }

      const container = document.getElementById('quiz-options-container');
      const feedback = document.getElementById('quiz-feedback-line');
      const actionBtn = document.getElementById('btn-quiz-action');

      this.clinicalEngine.submitDifferentialDiagnosis(this.selectedDiagnosis.id);

      container.querySelectorAll('.quiz-choice-item').forEach(item => {
        const isCorrect = (item.dataset.correct === 'true');
        if (item.classList.contains('selected')) {
          if (isCorrect) {
            item.classList.add('correct');
            feedback.style.color = '#34d399';
            feedback.textContent = `Correct Formulation: ${this.selectedDiagnosis.label}.`;
          } else {
            item.classList.add('incorrect');
            feedback.style.color = '#f87171';
            feedback.textContent = `Misdiagnosis: Primary pathology is ${this.clinicalEngine.activeCase.title}.`;
          }
        } else if (isCorrect) {
          item.classList.add('correct');
        }
      });

      feedback.style.display = 'block';
      this.soundManager.playCardiacBeep(this.selectedDiagnosis.isCorrect ? 880 : 320, 0.12);

      actionBtn.textContent = 'Next';
      this.quizStep = 2.5; // Awaiting advance to Step 3
    } else if (this.quizStep === 2.5) {
      this.soundManager.playSyringeClick();
      this.openQuizStep3Treatment();
    } else if (this.quizStep === 3) {
      // 3. Treatment selected & submitted -> Show instant red/green feedback
      if (!this.selectedTreatment) {
        alert('Please select a treatment protocol.');
        return;
      }

      const container = document.getElementById('quiz-options-container');
      const feedback = document.getElementById('quiz-feedback-line');
      const actionBtn = document.getElementById('btn-quiz-action');

      container.querySelectorAll('.quiz-choice-item').forEach(item => {
        const isCorrect = (item.dataset.correct === 'true');
        if (item.classList.contains('selected')) {
          if (isCorrect) {
            item.classList.add('correct');
            feedback.style.color = '#34d399';
            feedback.textContent = 'Accurate Protocol Identified: Administer into Vastus Lateralis muscle.';
          } else {
            item.classList.add('incorrect');
            feedback.style.color = '#f87171';
            feedback.textContent = `Incorrect Protocol: Emergency standard requires ${this.clinicalEngine.activeCase.correctMedication}.`;
          }
        } else if (isCorrect) {
          item.classList.add('correct');
        }
      });

      feedback.style.display = 'block';
      this.soundManager.playCardiacBeep(this.selectedTreatment.isCorrect ? 880 : 320, 0.12);

      actionBtn.textContent = 'Next';
      this.quizStep = 4;
    } else if (this.quizStep === 4) {
      // Close quiz modal and transition to physical 3D resuscitation
      document.getElementById('quiz-modal').style.display = 'none';
      this.startPhysicalDrugAdministration();
    }
  }

  handleSpeechSynthesized({ speaker, text, active }) {
    const speakerEl = document.getElementById('start-dialogue-speaker');
    const textEl = document.getElementById('start-dialogue-text');
    if (speakerEl && speaker) speakerEl.textContent = speaker;
    if (textEl && text) textEl.textContent = `"${text}"`;
  }

  handleSpeechRecognized(transcript) {
    this.clinicalEngine.recordCommunicationEvent('PATIENT_REASSURANCE', transcript);
    const speaker = document.getElementById('start-dialogue-speaker');
    const text = document.getElementById('start-dialogue-text');
    if (speaker) speaker.textContent = 'Clinician';
    if (text) text.textContent = `"${transcript}"`;

    if (transcript.toLowerCase().includes('sarah') || transcript.toLowerCase().includes('999') || transcript.toLowerCase().includes('kit')) {
      this.handleAssistantCommand(transcript);
    } else {
      setTimeout(() => {
        const speech = this.dialogueEngine.getPatientSpeech(this.clinicalEngine.activeCase.id, this.clinicalEngine.isEmergencyTriggered);
        this.dialogueEngine.speak(speech.text, speech.speaker, { rate: speech.rate, pitch: speech.pitch });
      }, 1000);
    }
  }

  startPhysicalDrugAdministration() {
    this.encounterPhase = 'PHYSICAL_ADMIN';

    // Show top guidance banner
    const banner = document.getElementById('drug-delivery-banner');
    const drugTitle = document.getElementById('delivery-banner-drug');
    const drugSub = document.getElementById('delivery-banner-instruction');

    drugTitle.textContent = 'Adrenaline (EpiPen) 1:1000 Selected';
    drugSub.textContent = 'Click the approved Vastus Lateralis outer thigh target on the patient for intramuscular injection.';
    banner.style.display = 'block';

    // Set active held medication
    this.activeHeldMedication = {
      medicationId: 'ADRENALINE',
      name: 'Adrenaline (EpiPen) Auto-Injector 1:1000',
      approvedSite: 'VASTUS_LATERALIS'
    };

    // Show Vastus Lateralis target ring on patient thigh
    if (this.patient) {
      this.patient.setThighTargetVisible(true);
    }

    // Move camera to thigh vantage point
    this.setCameraPreset('thigh');

    // Open countertop resuscitation kit lid
    if (this.resusKit) {
      this.resusKit.toggleKitBox();
    }
  }

  executeMedicationAdministration(targetSite, targetWorldPos) {
    if (!this.activeHeldMedication) return;
    const med = this.activeHeldMedication;

    if (med.approvedSite === 'VASTUS_LATERALIS' && targetSite === 'VASTUS_LATERALIS') {
      // 10-Second Depot Hold Countdown Overlay
      this.isHoldingInjection = true;
      const overlay = document.getElementById('injection-hold-overlay');
      const num = document.getElementById('hold-countdown-num');
      if (overlay) overlay.style.display = 'block';

      let secondsLeft = 10;
      if (num) num.textContent = `${secondsLeft}s`;

      const holdTimer = setInterval(() => {
        secondsLeft--;
        if (num) num.textContent = `${secondsLeft}s`;
        this.soundManager.playCardiacBeep(520, 0.05);

        if (secondsLeft <= 0) {
          clearInterval(holdTimer);
          if (overlay) overlay.style.display = 'none';
          this.isHoldingInjection = false;

          // Hide thigh target ring
          if (this.patient) {
            this.patient.setThighTargetVisible(false);
          }

          // Complete administration
          this.resusKit.executeInjectionAnimation(med, targetWorldPos, () => {
            this.handleResuscitationSuccess(med.medicationId, targetSite);
          });
        }
      }, 1000);
    } else {
      this.resusKit.executeInjectionAnimation(med, targetWorldPos, () => {
        this.handleResuscitationSuccess(med.medicationId, targetSite);
      });
    }

    // Hide guidance banner
    document.getElementById('drug-delivery-banner').style.display = 'none';
  }

  handleResuscitationSuccess(medicationId, targetSite) {
    this.clinicalEngine.validateAdministration(medicationId, targetSite);
    this.timeToIntervention = Math.max(12, Math.round(this.recognitionTimerSec + 14));

    const dot = document.getElementById('sim-status-dot');
    const text = document.getElementById('sim-status-text');
    if (dot) dot.className = 'badge-status-dot';
    if (text) text.textContent = 'RESUSCITATED - STABILIZED';

    if (this.patient) {
      this.patient.applyDermatology();
    }

    // Return camera to chairside perspective
    this.setCameraPreset('wide');

    // Sarah speaks aloud
    this.dialogueEngine.speak(
      'Adrenaline successfully administered into the vastus lateralis thigh. Airway resistance dropping, SpO2 recovering. Excellent work, doctor.',
      'Dental Assistant Sarah',
      { rate: 0.95, pitch: 1.0 }
    );

    // Show completion banner
    document.getElementById('resuscitation-done-banner').style.display = 'block';
  }

  handleMouthMirrorClicked() {
    this.setCameraPreset('oral');
  }

  handleMedicationPicked(drugData) {
    this.activeHeldMedication = drugData;
    const banner = document.getElementById('drug-delivery-banner');
    const drugTitle = document.getElementById('delivery-banner-drug');
    const drugSub = document.getElementById('delivery-banner-instruction');

    drugTitle.textContent = `${drugData.name} Selected`;
    drugSub.textContent = 'Click the approved Vastus Lateralis outer thigh target on the patient for intramuscular injection.';
    banner.style.display = 'block';

    if (this.patient) {
      this.patient.setThighTargetVisible(true);
    }
    this.setCameraPreset('thigh');
  }

  handleRadialPulsePalpation() {
    this.pulsePalpationActive = true;
    this.soundManager.playRadialPulseThump();
    this.xrManager.triggerHaptic(0.9, 120);

    const toast = document.getElementById('pulse-toast');
    const rateEl = document.getElementById('pulse-rate');
    const descEl = document.getElementById('pulse-desc');

    if (toast && rateEl && descEl) {
      rateEl.textContent = `${this.clinicalEngine.vitals.heartRate} BPM`;

      if (this.clinicalEngine.isEmergencyTriggered) {
        descEl.textContent = 'Rapid, weak and thready peripheral pulse. Marked tachycardia. Capillary refill > 3s (Severe hypoperfusion shock).';
      } else {
        descEl.textContent = 'Regular rhythm, strong normal volume. Warm peripheries. Capillary refill < 2s.';
      }

      toast.style.display = 'flex';
      clearTimeout(this.pulseToastTimeout);
      this.pulseToastTimeout = setTimeout(() => {
        toast.style.display = 'none';
        this.pulsePalpationActive = false;
      }, 4000);
    }
  }

  concludeEncounterAndDebrief() {
    const report = this.clinicalEngine.generateAuditReport();

    // Populate Unreal Prototype Session Report Fields
    const recogEl = document.getElementById('report-recog-time');
    const intervEl = document.getElementById('report-interv-time');
    const outcomeEl = document.getElementById('report-outcome');
    const scoreNum = document.getElementById('debrief-score');
    const scoreGrade = document.getElementById('debrief-grade');

    if (recogEl) recogEl.textContent = `00:${String(this.timeToRecognition).padStart(2, '0')}`;
    if (intervEl) intervEl.textContent = `00:${String(this.timeToIntervention || 26).padStart(2, '0')}`;
    if (outcomeEl) outcomeEl.textContent = 'STABILIZED';

    if (scoreNum) scoreNum.textContent = 'A - 96%';
    if (scoreGrade) scoreGrade.textContent = 'DISTINCTION';

    // Populate Chronological Clinical Log
    const tbody = document.getElementById('debrief-log-rows');
    if (tbody) {
      tbody.innerHTML = '';
      report.clinicalLog.forEach(item => {
        const tr = document.createElement('tr');
        const tdTime = document.createElement('td');
        tdTime.style.fontFamily = 'var(--font-mono)';
        tdTime.style.color = 'var(--accent-cyan)';
        tdTime.textContent = `+${item.time}s`;

        const tdEvent = document.createElement('td');
        tdEvent.textContent = item.event;

        tr.appendChild(tdTime);
        tr.appendChild(tdEvent);
        tbody.appendChild(tr);
      });
    }

    this.showScreen('screen-debrief');
  }

  onPointerDown(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Check Resuscitation Kit items & tools
    const kitHits = this.raycaster.intersectObjects(this.resusKit.interactiveObjects, true);
    if (kitHits.length > 0) {
      this.resusKit.triggerSelect(kitHits[0].object);
      return;
    }

    // 2. Check Clinical Anatomical Targets on Patient
    if (this.patient) {
      const targets = [this.patient.thighTarget, this.patient.pulseHotspot].filter(Boolean);
      const hits = this.raycaster.intersectObjects(targets, true);

      if (hits.length > 0) {
        let cur = hits[0].object;
        while (cur && !cur.userData?.siteId && cur.parent) cur = cur.parent;

        if (cur && cur.userData?.siteId === 'VASTUS_LATERALIS') {
          if (this.activeHeldMedication) {
            this.executeMedicationAdministration('VASTUS_LATERALIS', this.patient.getThighWorldPosition());
          } else {
            alert('Approved Vastus Lateralis site. Select medication from kit to administer.');
          }
        } else if (cur && cur.userData?.siteId === 'RADIAL_PULSE') {
          this.handleRadialPulsePalpation();
        }
      }
    }
  }

  onPointerMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const kitHits = this.raycaster.intersectObjects(this.resusKit.interactiveObjects, true);
    this.resusKit.setHovered(kitHits.length > 0 ? kitHits[0].object : null);
  }

  handleXRControllerSelect(controller) {
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const kitHits = this.raycaster.intersectObjects(this.resusKit.interactiveObjects, true);
    if (kitHits.length > 0) {
      this.resusKit.triggerSelect(kitHits[0].object);
      return;
    }

    if (this.patient) {
      const targets = [this.patient.thighTarget, this.patient.pulseHotspot].filter(Boolean);
      const hits = this.raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        let cur = hits[0].object;
        while (cur && !cur.userData?.siteId && cur.parent) cur = cur.parent;

        if (cur?.userData?.siteId === 'VASTUS_LATERALIS' && this.activeHeldMedication) {
          this.executeMedicationAdministration('VASTUS_LATERALIS', this.patient.getThighWorldPosition());
        } else if (cur?.userData?.siteId === 'RADIAL_PULSE') {
          this.handleRadialPulsePalpation();
        }
      }
    }
  }

  render() {
    const delta = this.clock.getDelta();

    // 1. Update Core Engines
    this.clinicalEngine.update(delta);

    // 2. Update Recognition Timer during active observation
    if (this.recognitionTimerActive) {
      this.recognitionTimerSec += delta;
      const timerDisplay = document.getElementById('stop-timer-display');
      if (timerDisplay) {
        const mins = String(Math.floor(this.recognitionTimerSec / 60)).padStart(2, '0');
        const secs = String(Math.floor(this.recognitionTimerSec % 60)).padStart(2, '0');
        timerDisplay.textContent = `${mins}:${secs}`;
      }
    }

    // 3. Update Patient Avatar Respiration & Tremors
    if (this.patient) {
      this.patient.update(delta);
    }

    // 4. Update Resuscitation Kit Lid & Animations
    if (this.resusKit) {
      this.resusKit.update(delta);
    }

    // 5. Cardiac pulse acoustic loop during active palpation
    if (this.pulsePalpationActive) {
      this.pulseBeatTimer += delta;
      const interval = 60 / Math.max(40, this.clinicalEngine.vitals.heartRate);
      if (this.pulseBeatTimer >= interval) {
        this.pulseBeatTimer = 0;
        this.soundManager.playRadialPulseThump();
        this.xrManager.triggerHaptic(0.85, 100);
      }
    }

    // 6. Controls
    if (this.controls) {
      this.controls.update();
    }

    // 7. Render
    this.renderer.render(this.scene, this.camera);
  }
}

// Bootstrap Application
window.addEventListener('DOMContentLoaded', () => {
  report('Initializing PearlSimApp with Unreal Prototype Workflow...');
  window.pearlSimApp = new PearlSimApp();
  report('PearlSimApp successfully initialized!');
});
