/**
 * ClinicalStateMachine.js
 * 
 * Multi-Disciplinary Physiological State Machine & Clinical Competency Engine.
 * Designed for the Meta VR Hackathon & Authentic Clinical Education:
 * - 🩺 MEDICAL (Emergency Medicine / ER Resuscitation Bay)
 * - 💉 NURSING (Acute Inpatient Ward / Rapid Response)
 * - 🚑 PARAMEDIC / EMS (Pre-Hospital Ambulance / Field Triage)
 * - 🦷 DENTAL (Outpatient Chairside Surgical Emergency)
 * 
 * Modular Emergency Scenarios:
 * 1. HYPOGLYCEMIA (Acute Neuroglycopenic Crisis)
 * 2. ANAPHYLAXIS (Acute Severe Airway & Allergic Shock)
 * 3. MYOCARDIAL_INFARCTION (Acute Coronary Syndrome / STEMI)
 * 4. VASOVAGAL_SYNCOPE (Postural / Emotional Faint)
 * 
 * Incorporates Dermatological Diversity (Fitzpatrick I-VI) & Geriatric Presentations.
 */

export const EmergencyScenarios = Object.freeze({
  HYPOGLYCEMIA: 'HYPOGLYCEMIA',
  ANAPHYLAXIS: 'ANAPHYLAXIS',
  MYOCARDIAL_INFARCTION: 'MYOCARDIAL_INFARCTION',
  VASOVAGAL_SYNCOPE: 'VASOVAGAL_SYNCOPE'
});

export const ClinicalStates = Object.freeze({
  BASELINE: 'BASELINE',
  DECOMPENSATING: 'DECOMPENSATING',
  RECOVERY_CORRECT: 'RECOVERY_CORRECT',
  CRITICAL_ERROR: 'CRITICAL_ERROR',
  DISTRACTOR_ERROR: 'DISTRACTOR_ERROR'
});

export const Interventions = Object.freeze({
  NONE: 'NONE',
  GLUCOSE_GEL: 'GLUCOSE_GEL',         // 15g Oral Fast-Acting Carbohydrate Gel
  GLUCAGON: 'GLUCAGON',               // 1mg IM Glucagon
  ADRENALINE: 'ADRENALINE',           // 1:1000 IM Epinephrine (0.5mg into anterolateral thigh)
  ASPIRIN_GTN: 'ASPIRIN_GTN',         // Aspirin 300mg chewed + GTN spray 400mcg sublingual
  TRENDELENBURG: 'TRENDELENBURG',     // Lay flat with legs elevated 15-30 degrees
  INSULIN: 'INSULIN',                 // 100 U/mL (Fatal error in hypoglycemia/MI)
  DEFIBRILLATOR: 'DEFIBRILLATOR'      // AED analysis / shock
});

export const HealthcareDisciplines = Object.freeze({
  MEDICAL: 'MEDICAL',       // Hospital Emergency Resuscitation Bay
  NURSING: 'NURSING',       // Acute Inpatient Ward Bedside
  PARAMEDIC: 'PARAMEDIC',   // Pre-Hospital Ambulance / Field
  DENTAL: 'DENTAL'          // Chairside Surgical Outpatient Clinic
});

export const DemographicProfiles = Object.freeze({
  AFRICAN_GERIATRIC_F: {
    id: 'AFRICAN_GERIATRIC_F',
    name: 'Mrs. Adanna Eze',
    age: 81,
    sex: 'Female',
    ethnicity: 'African / Black (Fitzpatrick VI)',
    skinHex: 0x3d2314,
    ashenHex: 0x483d38,      // Ashen, slate-gray undertone when hypoperfused
    sweatRoughness: 0.16,
    baselineBP: '138/84',
    historyNote: 'History of diabetes, mild hypertension. Blunted autonomic response; atypical pain presentation.'
  },
  AFRICAN_YOUNG_M: {
    id: 'AFRICAN_YOUNG_M',
    name: 'Marcus Adebayo',
    age: 26,
    sex: 'Male',
    ethnicity: 'African / Black (Fitzpatrick V)',
    skinHex: 0x4a2e1d,
    ashenHex: 0x564a44,
    sweatRoughness: 0.15,
    baselineBP: '120/78',
    historyNote: 'Type 1 Diabetic athlete, active lifestyle. Prominent cold diaphoresis sweat sheen.'
  },
  CAUCASIAN_YOUNG_F: {
    id: 'CAUCASIAN_YOUNG_F',
    name: 'Alex Turner',
    age: 28,
    sex: 'Female',
    ethnicity: 'Caucasian (Fitzpatrick II)',
    skinHex: 0xf5cdb0,
    ashenHex: 0xe8ded8,      // Chalky, blanched facial pallor
    sweatRoughness: 0.20,
    baselineBP: '118/76',
    historyNote: 'Type 1 Diabetes since age 12. Classic blanched pallor and tremor.'
  },
  ASIAN_ELDERLY_M: {
    id: 'ASIAN_ELDERLY_M',
    name: 'Mr. Kenji Tanaka',
    age: 79,
    sex: 'Male',
    ethnicity: 'East Asian (Fitzpatrick III)',
    skinHex: 0xd9b38c,
    ashenHex: 0xc4b8aa,
    sweatRoughness: 0.22,
    baselineBP: '132/80',
    historyNote: 'Diabetic on oral agents; coronary stent 4 years ago. Mild exertional dyspnea.'
  }
});

export class ClinicalStateMachine {
  constructor(options = {}) {
    this.listeners = new Set();
    this.transitionListeners = new Set();
    this.auditListeners = new Set();

    this.autoCrashTimerSec = options.autoCrashTimerSec ?? 10;
    this.discipline = HealthcareDisciplines.DENTAL; // Default to Dental setting
    this.scenario = EmergencyScenarios.HYPOGLYCEMIA;
    this.demographic = DemographicProfiles.AFRICAN_GERIATRIC_F;

    // Physiological Vitals Engine
    this.vitals = {
      bloodGlucose: 72,      // mg/dL
      heartRate: 82,          // BPM
      systolicBP: 118,        // mmHg
      diastolicBP: 76,        // mmHg
      spo2: 98,               // %
      respirationRate: 14,    // Breaths/min
      cognitiveStatus: 'Alert but mild fatigue',
      shiveringIntensity: 0.0,// 0.0 to 1.0 (tremors)
      stElevationMm: 0.0,     // mm on Lead II ECG (for MI)
      stridorIntensity: 0.0,  // 0.0 to 1.0 (for Anaphylaxis)
      facialSwelling: 0.0     // 0.0 to 1.0 (Angioedema)
    };

    this.targetVitals = { ...this.vitals };

    // Simulation Workflow State
    this.currentState = ClinicalStates.BASELINE;
    this.lastIntervention = Interventions.NONE;

    // Timers
    this.stateElapsedSec = 0;
    this.totalElapsedSec = 0;
    this.recognitionStartTime = 0;
    this.recognitionDurationSec = 0;
    this.interventionStartTime = 0;
    this.interventionDurationSec = 0;
    this.emergencyDeclaredTime = 0;

    // Assessment & Diagnosis submissions
    this.selectedSymptoms = new Set();
    this.selectedDiagnosis = null;

    // Audit Report
    this.auditReport = null;

    this.update = this.update.bind(this);
  }

  setDiscipline(discipline) {
    if (HealthcareDisciplines[discipline]) {
      this.discipline = discipline;
      if (this.auditReport) this.generateAuditReport();
    }
  }

  setScenario(scenario) {
    if (EmergencyScenarios[scenario]) {
      this.scenario = scenario;
      this.reset();
    }
  }

  setDemographic(demoKey) {
    if (DemographicProfiles[demoKey]) {
      this.demographic = DemographicProfiles[demoKey];
    }
  }

  reset() {
    this.totalElapsedSec = 0;
    this.stateElapsedSec = 0;
    this.recognitionStartTime = 0;
    this.recognitionDurationSec = 0;
    this.interventionStartTime = 0;
    this.interventionDurationSec = 0;
    this.emergencyDeclaredTime = 0;
    this.selectedSymptoms.clear();
    this.selectedDiagnosis = null;
    this.lastIntervention = Interventions.NONE;
    this.auditReport = null;

    // Initialize baseline vitals tailored to scenario
    switch (this.scenario) {
      case EmergencyScenarios.HYPOGLYCEMIA:
        this.vitals = {
          bloodGlucose: 74,
          heartRate: 80,
          systolicBP: 120,
          diastolicBP: 78,
          spo2: 98,
          respirationRate: 14,
          cognitiveStatus: 'Alert but mild fatigue',
          shiveringIntensity: 0.0,
          stElevationMm: 0.0,
          stridorIntensity: 0.0,
          facialSwelling: 0.0
        };
        break;

      case EmergencyScenarios.ANAPHYLAXIS:
        this.vitals = {
          bloodGlucose: 95,
          heartRate: 78,
          systolicBP: 122,
          diastolicBP: 80,
          spo2: 99,
          respirationRate: 14,
          cognitiveStatus: 'Alert, resting comfortably',
          shiveringIntensity: 0.0,
          stElevationMm: 0.0,
          stridorIntensity: 0.0,
          facialSwelling: 0.0
        };
        break;

      case EmergencyScenarios.MYOCARDIAL_INFARCTION:
        this.vitals = {
          bloodGlucose: 98,
          heartRate: 82,
          systolicBP: 130,
          diastolicBP: 84,
          spo2: 97,
          respirationRate: 15,
          cognitiveStatus: 'Alert, mild anxiousness',
          shiveringIntensity: 0.0,
          stElevationMm: 0.0,
          stridorIntensity: 0.0,
          facialSwelling: 0.0
        };
        break;

      case EmergencyScenarios.VASOVAGAL_SYNCOPE:
        this.vitals = {
          bloodGlucose: 88,
          heartRate: 76,
          systolicBP: 116,
          diastolicBP: 74,
          spo2: 98,
          respirationRate: 13,
          cognitiveStatus: 'Alert, slightly apprehensive',
          shiveringIntensity: 0.0,
          stElevationMm: 0.0,
          stridorIntensity: 0.0,
          facialSwelling: 0.0
        };
        break;
    }

    this.targetVitals = { ...this.vitals };
    this.transitionTo(ClinicalStates.BASELINE, Interventions.NONE);
  }

  declareEmergency() {
    if (this.emergencyDeclaredTime === 0) {
      this.emergencyDeclaredTime = this.totalElapsedSec;
      if (this.recognitionStartTime > 0) {
        this.recognitionDurationSec = Math.max(1, this.emergencyDeclaredTime - this.recognitionStartTime);
      } else {
        this.recognitionDurationSec = Math.max(1, this.totalElapsedSec);
      }
      this.interventionStartTime = this.totalElapsedSec;
    }
  }

  submitDiagnosis(symptomsArray, diagnosisString) {
    this.selectedSymptoms = new Set(symptomsArray || []);
    this.selectedDiagnosis = diagnosisString || null;
  }

  administer(intervention) {
    if (this.interventionStartTime === 0) {
      this.interventionStartTime = this.totalElapsedSec;
    }
    this.interventionDurationSec = Math.max(1, this.totalElapsedSec - this.interventionStartTime);
    this.lastIntervention = intervention;

    // Evaluate intervention correctness based on active scenario
    switch (this.scenario) {
      case EmergencyScenarios.HYPOGLYCEMIA:
        if (intervention === Interventions.GLUCOSE_GEL || intervention === Interventions.GLUCAGON) {
          this.transitionTo(ClinicalStates.RECOVERY_CORRECT, intervention);
        } else if (intervention === Interventions.INSULIN) {
          this.transitionTo(ClinicalStates.CRITICAL_ERROR, intervention);
        } else {
          this.transitionTo(ClinicalStates.DISTRACTOR_ERROR, intervention);
        }
        break;

      case EmergencyScenarios.ANAPHYLAXIS:
        if (intervention === Interventions.ADRENALINE) {
          this.transitionTo(ClinicalStates.RECOVERY_CORRECT, intervention);
        } else if (intervention === Interventions.GLUCOSE_GEL || intervention === Interventions.INSULIN) {
          this.transitionTo(ClinicalStates.CRITICAL_ERROR, intervention); // Delaying adrenaline causes asphyxia
        } else {
          this.transitionTo(ClinicalStates.DISTRACTOR_ERROR, intervention);
        }
        break;

      case EmergencyScenarios.MYOCARDIAL_INFARCTION:
        if (intervention === Interventions.ASPIRIN_GTN) {
          this.transitionTo(ClinicalStates.RECOVERY_CORRECT, intervention);
        } else if (intervention === Interventions.ADRENALINE) {
          this.transitionTo(ClinicalStates.CRITICAL_ERROR, intervention); // Adrenaline causes ventricular fibrillation in acute MI
        } else {
          this.transitionTo(ClinicalStates.DISTRACTOR_ERROR, intervention);
        }
        break;

      case EmergencyScenarios.VASOVAGAL_SYNCOPE:
        if (intervention === Interventions.TRENDELENBURG) {
          this.transitionTo(ClinicalStates.RECOVERY_CORRECT, intervention);
        } else if (intervention === Interventions.INSULIN || intervention === Interventions.ADRENALINE) {
          this.transitionTo(ClinicalStates.CRITICAL_ERROR, intervention);
        } else {
          this.transitionTo(ClinicalStates.DISTRACTOR_ERROR, intervention);
        }
        break;
    }
  }

  transitionTo(newState, intervention = Interventions.NONE) {
    const oldState = this.currentState;
    this.currentState = newState;
    this.stateElapsedSec = 0;

    // Apply target physiological differentials based on state and scenario
    this.computeTargetVitals(newState, intervention);

    // Notify listeners
    const snapshot = this.getVitalsSnapshot();
    if (this.onStateChange) {
      this.onStateChange(newState, oldState, intervention, snapshot);
    }
    this.transitionListeners.forEach(fn => fn(newState, oldState, intervention, snapshot));

    // If state reaches final resolution, generate audit report
    if (newState === ClinicalStates.RECOVERY_CORRECT ||
        newState === ClinicalStates.CRITICAL_ERROR ||
        newState === ClinicalStates.DISTRACTOR_ERROR) {
      this.generateAuditReport();
    }
  }

  computeTargetVitals(state, intervention) {
    const s = this.scenario;

    if (state === ClinicalStates.BASELINE) {
      // Steady baseline
      return;
    }

    if (state === ClinicalStates.DECOMPENSATING) {
      switch (s) {
        case EmergencyScenarios.HYPOGLYCEMIA:
          this.targetVitals.bloodGlucose = 38;
          this.targetVitals.heartRate = 110; // Reflex sympathetic tachycardia
          this.targetVitals.systolicBP = 135;
          this.targetVitals.diastolicBP = 88;
          this.targetVitals.respirationRate = 18;
          this.targetVitals.shiveringIntensity = 0.85;
          this.targetVitals.cognitiveStatus = 'Slurred speech, severe disorientation, tremors';
          break;

        case EmergencyScenarios.ANAPHYLAXIS:
          this.targetVitals.systolicBP = 68; // Profound vasodilation shock
          this.targetVitals.diastolicBP = 38;
          this.targetVitals.heartRate = 132; // Severe compensatory tachycardia
          this.targetVitals.spo2 = 82;       // Bronchospasm hypoxia
          this.targetVitals.respirationRate = 28;
          this.targetVitals.stridorIntensity = 0.90;
          this.targetVitals.facialSwelling = 0.80; // Angioedema
          this.targetVitals.cognitiveStatus = 'Severe respiratory distress, gasping, air hunger';
          break;

        case EmergencyScenarios.MYOCARDIAL_INFARCTION:
          this.targetVitals.stElevationMm = 3.5; // Acute STEMI on Lead II
          this.targetVitals.heartRate = 96;
          this.targetVitals.systolicBP = 158;
          this.targetVitals.diastolicBP = 98;
          this.targetVitals.spo2 = 93;
          this.targetVitals.respirationRate = 22;
          this.targetVitals.cognitiveStatus = 'Clutching chest, severe crushing retrosternal pain radiating to jaw';
          break;

        case EmergencyScenarios.VASOVAGAL_SYNCOPE:
          this.targetVitals.heartRate = 42; // Profound vagal bradycardia
          this.targetVitals.systolicBP = 82;
          this.targetVitals.diastolicBP = 50;
          this.targetVitals.spo2 = 97;
          this.targetVitals.respirationRate = 10;
          this.targetVitals.cognitiveStatus = 'Unresponsive, limp syncope episode';
          break;
      }
    }

    if (state === ClinicalStates.RECOVERY_CORRECT) {
      // Vitals slowly normalize to safe healthy range
      this.targetVitals.shiveringIntensity = 0.0;
      this.targetVitals.stridorIntensity = 0.0;
      this.targetVitals.facialSwelling = 0.0;
      this.targetVitals.stElevationMm = 0.0;
      this.targetVitals.spo2 = 98;
      this.targetVitals.respirationRate = 14;

      if (s === EmergencyScenarios.HYPOGLYCEMIA) {
        this.targetVitals.bloodGlucose = 96;
        this.targetVitals.heartRate = 82;
        this.targetVitals.systolicBP = 120;
        this.targetVitals.diastolicBP = 78;
        this.targetVitals.cognitiveStatus = 'Cognition recovered, tremors ceased, speech fluent';
      } else if (s === EmergencyScenarios.ANAPHYLAXIS) {
        this.targetVitals.systolicBP = 114;
        this.targetVitals.diastolicBP = 74;
        this.targetVitals.heartRate = 92;
        this.targetVitals.cognitiveStatus = 'Airway patent, stridor resolved, breathing comfortable';
      } else if (s === EmergencyScenarios.MYOCARDIAL_INFARCTION) {
        this.targetVitals.heartRate = 78;
        this.targetVitals.systolicBP = 124;
        this.targetVitals.diastolicBP = 80;
        this.targetVitals.cognitiveStatus = 'Chest pain easing with GTN & Aspirin; awaiting EMS transport';
      } else if (s === EmergencyScenarios.VASOVAGAL_SYNCOPE) {
        this.targetVitals.heartRate = 74;
        this.targetVitals.systolicBP = 118;
        this.targetVitals.diastolicBP = 76;
        this.targetVitals.cognitiveStatus = 'Consciousness regained on recline, oriented x 3';
      }
    }

    if (state === ClinicalStates.CRITICAL_ERROR) {
      if (s === EmergencyScenarios.HYPOGLYCEMIA && intervention === Interventions.INSULIN) {
        this.targetVitals.bloodGlucose = 14;
        this.targetVitals.heartRate = 38;
        this.targetVitals.systolicBP = 55;
        this.targetVitals.diastolicBP = 30;
        this.targetVitals.respirationRate = 6;
        this.targetVitals.shiveringIntensity = 0.0; // Flaccid comatose collapse
        this.targetVitals.cognitiveStatus = 'Flaccid neuroglycopenic coma; unreactive pupils. CODE BLUE!';
      } else if (s === EmergencyScenarios.ANAPHYLAXIS) {
        this.targetVitals.spo2 = 64;
        this.targetVitals.heartRate = 40;
        this.targetVitals.systolicBP = 45;
        this.targetVitals.respirationRate = 4;
        this.targetVitals.cognitiveStatus = 'Total airway occlusion; asphyxial cardiac arrest. CODE BLUE!';
      } else if (s === EmergencyScenarios.MYOCARDIAL_INFARCTION && intervention === Interventions.ADRENALINE) {
        this.targetVitals.heartRate = 220; // Ventricular Fibrillation triggered by adrenaline
        this.targetVitals.systolicBP = 0;
        this.targetVitals.diastolicBP = 0;
        this.targetVitals.stElevationMm = 6.0;
        this.targetVitals.cognitiveStatus = 'Ventricular Fibrillation / Pulseless Electrical Activity. CODE BLUE!';
      }
    }

    if (state === ClinicalStates.DISTRACTOR_ERROR) {
      // Non-fatal but wrong intervention
      this.targetVitals.cognitiveStatus = 'Incorrect medication administered; underlying emergency untreated!';
    }
  }

  update(deltaSec) {
    this.totalElapsedSec += deltaSec;
    this.stateElapsedSec += deltaSec;

    // Auto-trigger decompensation if player is in baseline
    if (this.currentState === ClinicalStates.BASELINE) {
      if (this.totalElapsedSec >= this.autoCrashTimerSec) {
        this.recognitionStartTime = this.totalElapsedSec;
        this.transitionTo(ClinicalStates.DECOMPENSATING, Interventions.NONE);
      }
    }

    // Physiological Differential Interpolation
    const rate = 0.8 * deltaSec;
    this.vitals.bloodGlucose += (this.targetVitals.bloodGlucose - this.vitals.bloodGlucose) * rate;
    this.vitals.heartRate += (this.targetVitals.heartRate - this.vitals.heartRate) * rate;
    this.vitals.systolicBP += (this.targetVitals.systolicBP - this.vitals.systolicBP) * rate;
    this.vitals.diastolicBP += (this.targetVitals.diastolicBP - this.vitals.diastolicBP) * rate;
    this.vitals.spo2 += (this.targetVitals.spo2 - this.vitals.spo2) * rate;
    this.vitals.respirationRate += (this.targetVitals.respirationRate - this.vitals.respirationRate) * rate;
    this.vitals.shiveringIntensity += (this.targetVitals.shiveringIntensity - this.vitals.shiveringIntensity) * rate;
    this.vitals.stElevationMm += (this.targetVitals.stElevationMm - this.vitals.stElevationMm) * rate;
    this.vitals.stridorIntensity += (this.targetVitals.stridorIntensity - this.vitals.stridorIntensity) * rate;
    this.vitals.facialSwelling += (this.targetVitals.facialSwelling - this.vitals.facialSwelling) * rate;

    // Fire vitals updates
    const snapshot = this.getVitalsSnapshot();
    if (this.onVitalsUpdate) this.onVitalsUpdate(snapshot);
    this.listeners.forEach(fn => fn(snapshot));
  }

  getVitalsSnapshot() {
    return {
      bloodGlucose: Math.round(this.vitals.bloodGlucose),
      heartRate: Math.round(this.vitals.heartRate),
      systolicBP: Math.round(this.vitals.systolicBP),
      diastolicBP: Math.round(this.vitals.diastolicBP),
      spo2: Math.round(this.vitals.spo2),
      respirationRate: Math.round(this.vitals.respirationRate),
      cognitiveStatus: this.vitals.cognitiveStatus,
      shiveringIntensity: parseFloat(this.vitals.shiveringIntensity.toFixed(2)),
      stElevationMm: parseFloat(this.vitals.stElevationMm.toFixed(1)),
      stridorIntensity: parseFloat(this.vitals.stridorIntensity.toFixed(2)),
      facialSwelling: parseFloat(this.vitals.facialSwelling.toFixed(2)),
      state: this.currentState,
      lastIntervention: this.lastIntervention,
      scenario: this.scenario,
      discipline: this.discipline,
      demographic: this.demographic,
      totalElapsedSec: this.totalElapsedSec,
      stateElapsedSec: this.stateElapsedSec
    };
  }

  generateAuditReport() {
    const s = this.scenario;
    const interv = this.lastIntervention;
    const diag = this.selectedDiagnosis;

    let treatmentCorrect = false;
    let treatmentFatal = false;
    let diagnosisCorrect = false;

    // Check Diagnosis
    if (s === EmergencyScenarios.HYPOGLYCEMIA && diag === 'hypoglycemia') diagnosisCorrect = true;
    if (s === EmergencyScenarios.ANAPHYLAXIS && diag === 'anaphylaxis') diagnosisCorrect = true;
    if (s === EmergencyScenarios.MYOCARDIAL_INFARCTION && diag === 'mi') diagnosisCorrect = true;
    if (s === EmergencyScenarios.VASOVAGAL_SYNCOPE && diag === 'syncope') diagnosisCorrect = true;

    // Check Treatment
    if (s === EmergencyScenarios.HYPOGLYCEMIA) {
      if (interv === Interventions.GLUCOSE_GEL || interv === Interventions.GLUCAGON) treatmentCorrect = true;
      if (interv === Interventions.INSULIN) treatmentFatal = true;
    } else if (s === EmergencyScenarios.ANAPHYLAXIS) {
      if (interv === Interventions.ADRENALINE) treatmentCorrect = true;
      if (interv === Interventions.GLUCOSE_GEL || interv === Interventions.INSULIN) treatmentFatal = true;
    } else if (s === EmergencyScenarios.MYOCARDIAL_INFARCTION) {
      if (interv === Interventions.ASPIRIN_GTN) treatmentCorrect = true;
      if (interv === Interventions.ADRENALINE) treatmentFatal = true;
    } else if (s === EmergencyScenarios.VASOVAGAL_SYNCOPE) {
      if (interv === Interventions.TRENDELENBURG) treatmentCorrect = true;
      if (interv === Interventions.INSULIN) treatmentFatal = true;
    }

    // Scoring Breakdown (Based on Grading system.txt)
    // 30% Right Treatment, 20% Diagnosis, 15% Symptoms, 20% Recognition Time, 10% Intervention Time, 5% Outcome
    let scoreTotal = 0;
    if (treatmentCorrect) scoreTotal += 30;
    if (diagnosisCorrect) scoreTotal += 20;

    // Symptom count
    const symptomsCount = this.selectedSymptoms.size;
    const symptomScore = Math.min(15, symptomsCount * 5);
    scoreTotal += symptomScore;

    // Time to recognition (< 12s pass)
    const recogPass = this.recognitionDurationSec > 0 && this.recognitionDurationSec <= 14;
    if (recogPass) scoreTotal += 20;

    // Time to intervention (< 20s pass)
    const intervPass = this.interventionDurationSec > 0 && this.interventionDurationSec <= 22;
    if (intervPass) scoreTotal += 10;

    if (this.currentState === ClinicalStates.RECOVERY_CORRECT) scoreTotal += 5;

    // Competency Letter Grade
    let competencyGrade = 'A';
    let gradeText = 'A (PERFECT)';
    let recommendation = 'Protocol executed with high clinical precision.';

    if (treatmentFatal || interv === Interventions.INSULIN || !treatmentCorrect) {
      competencyGrade = 'F';
      gradeText = 'F (UNSAFE)';
      recommendation = `Critical protocol failure! Review official ${this.discipline} guidelines for ${s}.`;
    } else if (!diagnosisCorrect) {
      competencyGrade = 'E';
      gradeText = 'E (INCORRECT DIAGNOSIS)';
      recommendation = 'Treatment administered without accurate differential diagnosis.';
    } else if (symptomsCount < 2) {
      competencyGrade = 'C';
      gradeText = 'C (ACCEPTABLE)';
      recommendation = 'Diagnosis correct, but key physical signs were missed on assessment.';
    } else if (!recogPass || !intervPass) {
      competencyGrade = 'B';
      gradeText = 'B (GOOD)';
      recommendation = 'Correct protocol executed, but emergency response timing was delayed.';
    }

    const fmtTime = (sec) => {
      const m = Math.floor(sec / 60).toString().padStart(2, '0');
      const s = Math.floor(sec % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    this.auditReport = {
      discipline: this.discipline,
      scenario: s,
      demographic: this.demographic,
      scoreTotal,
      competencyGrade,
      competencyGradeText: gradeText,
      recommendation,
      recogTimeStr: fmtTime(this.recognitionDurationSec),
      recogPass,
      intervTimeStr: fmtTime(this.interventionDurationSec),
      intervPass,
      patientOutcome: treatmentCorrect ? 'STABILIZED' : (treatmentFatal ? 'CRITICAL (CODE BLUE)' : 'PERSISTENT DISTRESS'),
      outcomePass: treatmentCorrect,
      treatmentPass: treatmentCorrect,
      treatmentText: treatmentCorrect ? 'Correct Lifesaving Drug Administered' : (treatmentFatal ? 'FATAL ERROR MEDICATION GIVEN' : 'Incorrect Protocol Administered'),
      diagnosisPass: diagnosisCorrect,
      diagnosisText: diagnosisCorrect ? `Correctly Identified ${s}` : 'Failed Differential Diagnosis',
      symptomCheckText: `Identified ${symptomsCount} Key Physical Signs`
    };

    if (this.onAuditGenerated) this.onAuditGenerated(this.auditReport);
    this.auditListeners.forEach(fn => fn(this.auditReport));
    return this.auditReport;
  }
}
