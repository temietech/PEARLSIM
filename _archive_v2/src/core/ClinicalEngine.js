/**
 * ClinicalEngine.js - Institutional Clinical Emergency Simulation Engine
 * Manages the university-grade clinical scoring, blind triage progression,
 * medical histories, and CPD performance analytics.
 */

export const DisciplineTypes = {
  DENTAL: 'DENTAL',
  MEDICAL: 'MEDICAL',
  NURSING: 'NURSING',
  PARAMEDIC: 'PARAMEDIC'
};

export const EmergencyCases = {
  ANAPHYLAXIS: {
    id: 'ANAPHYLAXIS',
    title: 'Acute Anaphylactic Shock',
    category: 'Immunological Airway & Circulatory Collapse',
    triggerAgent: 'Chlorhexidine mouthwash and latex contact',
    onsetDelaySec: 25,
    pathology: 'IgE-mediated systemic vasodilation, rapid angioedema of the tongue, and laryngeal edema.',
    triageSigns: {
      tachypnea: true,
      diaphoresis: true,
      tremors: false,
      speechSlurring: false,
      tongueAngioedema: true,
      weakPulse: true
    },
    correctDiagnosis: 'ANAPHYLAXIS',
    correctMedication: 'ADRENALINE',
    approvedSite: 'VASTUS_LATERALIS',
    approvedRoute: 'Intramuscular (0.5mg 1:1000)',
    contraindicatedSites: ['ORAL_CAVITY', 'ABDOMEN', 'INTRAVENOUS_PUSH']
  },
  HYPOGLYCEMIA: {
    id: 'HYPOGLYCEMIA',
    title: 'Severe Hypoglycemic Crisis',
    category: 'Endocrine Neuroglycopenia',
    triggerAgent: 'Took morning insulin; omitted breakfast due to dental appointment anxiety',
    onsetDelaySec: 30,
    pathology: 'Plasma glucose < 2.8 mmol/L resulting in acute autonomic hyperactivity and cerebral neuroglycopenia.',
    triageSigns: {
      tachypnea: false,
      diaphoresis: true,
      tremors: true,
      speechSlurring: true,
      tongueAngioedema: false,
      weakPulse: true
    },
    correctDiagnosis: 'HYPOGLYCEMIA',
    correctMedication: 'GLUCAGON',
    approvedSite: 'VASTUS_LATERALIS',
    approvedRoute: 'Intramuscular (1mg Parenteral Rescue)',
    contraindicatedSites: ['ORAL_CAVITY', 'ABDOMEN']
  },
  MYOCARDIAL_INFARCTION: {
    id: 'MYOCARDIAL_INFARCTION',
    title: 'Acute Coronary Syndrome (STEMI)',
    category: 'Cardiovascular Ischemic Crisis',
    triggerAgent: 'Exogenous stress-induced catecholamine surge during operatory prep',
    onsetDelaySec: 35,
    pathology: 'Acute coronary arterial occlusion leading to transmural myocardial ischemia and left ventricular strain.',
    triageSigns: {
      tachypnea: true,
      diaphoresis: true,
      tremors: false,
      speechSlurring: false,
      tongueAngioedema: false,
      weakPulse: true
    },
    correctDiagnosis: 'MYOCARDIAL_INFARCTION',
    correctMedication: 'GTN_ASPIRIN',
    approvedSite: 'SUBLINGUAL_ORAL',
    approvedRoute: 'Sublingual Spray (400mcg) + 300mg Aspirin Chewed',
    contraindicatedSites: ['VASTUS_LATERALIS', 'ABDOMEN']
  },
  VASOVAGAL_SYNCOPE: {
    id: 'VASOVAGAL_SYNCOPE',
    title: 'Vasovagal Syncope (Dental Presyncope)',
    category: 'Neurocardiogenic Hypoperfusion',
    triggerAgent: 'Severe situational dental phobia and visual sight of instruments',
    onsetDelaySec: 20,
    pathology: 'Excessive vagal tone inducing sudden bradycardia (<45 BPM) and profound transient cerebral ischemia.',
    triageSigns: {
      tachypnea: false,
      diaphoresis: true,
      tremors: false,
      speechSlurring: true,
      tongueAngioedema: false,
      weakPulse: true
    },
    correctDiagnosis: 'VASOVAGAL_SYNCOPE',
    correctMedication: 'TRENDELENBURG',
    approvedSite: 'CHAIR_CONTROLS',
    approvedRoute: 'Horizontal Head-Down Recline Position',
    contraindicatedSites: ['VASTUS_LATERALIS', 'ORAL_CAVITY']
  }
};

export const PatientRecords = {
  EVELYN_ADEBAYO: {
    id: 'EVELYN_ADEBAYO',
    name: 'Mrs. Evelyn Adebayo',
    age: 76,
    gender: 'Female',
    ethnicity: 'African (Fitzpatrick Phototype VI)',
    occupation: 'Retired Headmistress',
    appointmentReason: 'Routine 6-Monthly Dental Examination & Ultrasonic Scaling',
    medicalHistory: {
      diagnoses: 'Type 2 Diabetes Mellitus (Diet & Metformin controlled), Mild Hypertension',
      medications: 'Metformin 500mg BD, Amlodipine 5mg OD',
      allergies: 'Suspected adverse reaction to latex in 2018 (cutaneous rash)',
      vitalSignsBaseline: 'BP: 128/82 mmHg, HR: 74 BPM, Blood Glucose: 6.2 mmol/L, SpO2: 98%'
    },
    dermatology: {
      skinHex: 0x3d2314,
      ashenShockHex: 0x4a4340, // Ashen slate-gray hypoperfusion
      diaphoresisGloss: 0.22,
      oralMucosaHealthy: 0xe11d48,
      oralMucosaCyanotic: 0x64748b // Oral mucosa inspection is clinical standard for deep skin tones
    }
  }
};

export class ClinicalEngine {
  constructor(soundManager) {
    this.soundManager = soundManager;

    this.activeDiscipline = DisciplineTypes.DENTAL;
    this.patientRecord = PatientRecords.EVELYN_ADEBAYO;
    this.activeCase = EmergencyCases.ANAPHYLAXIS;
    this.isBlindMode = true;

    // Encounter State
    this.isEncounterActive = false;
    this.isEmergencyTriggered = false;
    this.isResuscitated = false;
    this.isFailed = false;

    this.encounterClock = 0;
    this.emergencyClock = 0;
    this.timeLimitSec = 90; // 90 seconds before hypoxic decompensation

    // Dynamic Vitals
    this.vitals = {
      heartRate: 74,
      systolicBP: 128,
      diastolicBP: 82,
      respirationRate: 14,
      spo2: 98,
      bloodGlucose: 6.2,
      diaphoresisSheen: 0.0,
      tremorLevel: 0.0,
      isAirwayBlocked: false
    };

    // Triage Observations by Student
    this.observedSigns = {
      tachypnea: false,
      diaphoresis: false,
      tremors: false,
      speechSlurring: false,
      tongueAngioedema: false,
      weakPulse: false
    };

    // Scoring & Audit Matrix
    this.auditMetrics = {
      diagnosticSpeedSec: 0,
      diagnosticAccuracy: 0, // 0 to 100
      pharmacologicalSelection: 0, // 0 to 100
      anatomicalSiteAccuracy: 0, // 0 to 100
      communicationScore: 0, // 0 to 100
      clinicalLog: []
    };
  }

  setCase(caseKey, isBlind = true) {
    this.activeCase = EmergencyCases[caseKey] || EmergencyCases.ANAPHYLAXIS;
    this.isBlindMode = isBlind;
  }

  startEncounter() {
    this.isEncounterActive = true;
    this.isEmergencyTriggered = false;
    this.isResuscitated = false;
    this.isFailed = false;

    this.encounterClock = 0;
    this.emergencyClock = 0;

    // Reset vitals to baseline
    this.vitals.heartRate = 74;
    this.vitals.systolicBP = 128;
    this.vitals.diastolicBP = 82;
    this.vitals.respirationRate = 14;
    this.vitals.spo2 = 98;
    this.vitals.bloodGlucose = 6.2;
    this.vitals.diaphoresisSheen = 0.0;
    this.vitals.tremorLevel = 0.0;
    this.vitals.isAirwayBlocked = false;

    // Reset student observations
    Object.keys(this.observedSigns).forEach(k => { this.observedSigns[k] = false; });

    this.auditMetrics = {
      diagnosticSpeedSec: 0,
      diagnosticAccuracy: 0,
      pharmacologicalSelection: 0,
      anatomicalSiteAccuracy: 0,
      communicationScore: 70, // baseline communication
      clinicalLog: [
        { time: 0, event: `Encounter initiated: ${this.patientRecord.name}. Reason: ${this.patientRecord.appointmentReason}.` }
      ]
    };
  }

  triggerAcuteCrisis() {
    if (this.isEmergencyTriggered) return;
    this.isEmergencyTriggered = true;
    this.soundManager.playAlarmCue();

    this.auditMetrics.clinicalLog.push({
      time: Math.round(this.encounterClock),
      event: `Acute emergency onset: ${this.activeCase.pathology}`
    });

    if (this.activeCase.id === 'ANAPHYLAXIS') {
      this.vitals.heartRate = 138;
      this.vitals.systolicBP = 72;
      this.vitals.diastolicBP = 40;
      this.vitals.respirationRate = 28;
      this.vitals.spo2 = 86;
      this.vitals.diaphoresisSheen = 0.85;
      this.vitals.isAirwayBlocked = true;
    } else if (this.activeCase.id === 'HYPOGLYCEMIA') {
      this.vitals.heartRate = 118;
      this.vitals.systolicBP = 110;
      this.vitals.diastolicBP = 70;
      this.vitals.bloodGlucose = 2.1;
      this.vitals.respirationRate = 22;
      this.vitals.diaphoresisSheen = 0.95;
      this.vitals.tremorLevel = 0.90;
    } else if (this.activeCase.id === 'MYOCARDIAL_INFARCTION') {
      this.vitals.heartRate = 104;
      this.vitals.systolicBP = 164;
      this.vitals.diastolicBP = 98;
      this.vitals.respirationRate = 26;
      this.vitals.spo2 = 91;
      this.vitals.diaphoresisSheen = 0.75;
    } else if (this.activeCase.id === 'VASOVAGAL_SYNCOPE') {
      this.vitals.heartRate = 42;
      this.vitals.systolicBP = 78;
      this.vitals.diastolicBP = 48;
      this.vitals.respirationRate = 12;
      this.vitals.diaphoresisSheen = 0.65;
    }
  }

  toggleObservedSign(signKey) {
    if (this.observedSigns[signKey] !== undefined) {
      this.observedSigns[signKey] = !this.observedSigns[signKey];
      const isExpected = this.activeCase.triageSigns[signKey];

      this.auditMetrics.clinicalLog.push({
        time: Math.round(this.encounterClock),
        event: `Triage finding marked: ${signKey} (${this.observedSigns[signKey] ? 'Positive' : 'Cleared'}) - Clinically ${isExpected ? 'Accurate' : 'Incongruent'}`
      });
      return this.observedSigns[signKey];
    }
    return false;
  }

  submitDifferentialDiagnosis(diagnosisId) {
    const isCorrect = (diagnosisId === this.activeCase.id);
    this.auditMetrics.diagnosticSpeedSec = Math.round(this.emergencyClock);
    this.auditMetrics.diagnosticAccuracy = isCorrect ? 100 : 25;

    this.auditMetrics.clinicalLog.push({
      time: Math.round(this.encounterClock),
      event: `Differential diagnosis formulated: ${diagnosisId}. Result: ${isCorrect ? 'Accurate' : 'Misdiagnosis'}`
    });

    return {
      isCorrect,
      targetCase: this.activeCase,
      diagnosticSpeed: this.auditMetrics.diagnosticSpeedSec
    };
  }

  recordCommunicationEvent(type, details) {
    if (type === 'PATIENT_REASSURANCE') {
      this.auditMetrics.communicationScore = Math.min(100, this.auditMetrics.communicationScore + 10);
      this.auditMetrics.clinicalLog.push({ time: Math.round(this.encounterClock), event: `Communication: Reassured patient chairside. Details: "${details}"` });
    } else if (type === 'ASSISTANT_COMMAND') {
      this.auditMetrics.communicationScore = Math.min(100, this.auditMetrics.communicationScore + 15);
      this.auditMetrics.clinicalLog.push({ time: Math.round(this.encounterClock), event: `Team Leadership: Issued clear directive to Dental Assistant Sarah: "${details}"` });
    }
  }

  validateAdministration(medicationId, targetSite) {
    const isCorrectMed = (medicationId === this.activeCase.correctMedication);
    const isApprovedSite = (targetSite === this.activeCase.approvedSite);

    this.auditMetrics.pharmacologicalSelection = isCorrectMed ? 100 : 15;
    this.auditMetrics.anatomicalSiteAccuracy = isApprovedSite ? 100 : 0;

    if (isCorrectMed && isApprovedSite) {
      this.isResuscitated = true;
      this.soundManager.playSuccessChime();

      // Normalize vitals
      this.vitals.heartRate = 82;
      this.vitals.systolicBP = 120;
      this.vitals.diastolicBP = 78;
      this.vitals.respirationRate = 16;
      this.vitals.spo2 = 98;
      this.vitals.diaphoresisSheen = 0.15;
      this.vitals.tremorLevel = 0.0;
      this.vitals.isAirwayBlocked = false;

      this.auditMetrics.clinicalLog.push({
        time: Math.round(this.encounterClock),
        event: `Resuscitation Successful: Administered ${medicationId} via approved route (${targetSite}). Perfusion and airway stabilized.`
      });

      return {
        status: 'SUCCESS',
        title: 'Perfusion & Airway Restored',
        message: `Accurate intervention. Administered ${this.activeCase.approvedRoute}. Patient vitals stabilizing.`
      };
    } else if (isCorrectMed && !isApprovedSite) {
      this.auditMetrics.clinicalLog.push({
        time: Math.round(this.encounterClock),
        event: `CRITICAL ERROR: Selected correct drug (${medicationId}) but delivered to CONTRAINDICATED site (${targetSite})!`
      });

      return {
        status: 'CONTRAINDICATED_SITE',
        title: 'Contraindicated Anatomical Site',
        message: `Pharmacology is correct, but ${targetSite} is contraindicated! You must inject into the Vastus Lateralis (Anterolateral Thigh).`
      };
    } else {
      this.auditMetrics.clinicalLog.push({
        time: Math.round(this.encounterClock),
        event: `PHARMACOLOGICAL ERROR: Administered incorrect medication (${medicationId}) for ${this.activeCase.title}.`
      });

      return {
        status: 'INCORRECT_MEDICATION',
        title: 'Incorrect Medication Administered',
        message: `${medicationId} is contraindicated for ${this.activeCase.title}. Re-evaluate differential diagnosis.`
      };
    }
  }

  generateAuditReport() {
    // Calculate Overall University Performance Grade
    const totalScore = Math.round(
      this.auditMetrics.diagnosticAccuracy * 0.35 +
      this.auditMetrics.pharmacologicalSelection * 0.25 +
      this.auditMetrics.anatomicalSiteAccuracy * 0.25 +
      this.auditMetrics.communicationScore * 0.15
    );

    let classification = 'Referral';
    let gradeLabel = 'Unsatisfactory - Retest Required';
    if (totalScore >= 85) {
      classification = 'Distinction';
      gradeLabel = 'Excellence in Acute Resuscitation';
    } else if (totalScore >= 70) {
      classification = 'Pass';
      gradeLabel = 'Competent Clinical Management';
    }

    return {
      simulationId: `PEARL-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      discipline: 'Dentistry (Chairside Acute Operatory Protocol)',
      patient: this.patientRecord,
      caseEntity: this.activeCase,
      totalScore,
      classification,
      gradeLabel,
      metrics: this.auditMetrics,
      clinicalLog: this.auditMetrics.clinicalLog
    };
  }

  update(deltaSec) {
    if (!this.isEncounterActive) return;

    this.encounterClock += deltaSec;

    // Organic Onset: Trigger emergency automatically when routine phase hits onset threshold
    if (!this.isEmergencyTriggered && this.encounterClock >= this.activeCase.onsetDelaySec) {
      this.triggerAcuteCrisis();
    }

    if (this.isEmergencyTriggered && !this.isResuscitated && !this.isFailed) {
      this.emergencyClock += deltaSec;

      if (this.emergencyClock >= this.timeLimitSec) {
        this.isFailed = true;
        this.vitals.heartRate = 28;
        this.vitals.spo2 = 62;
        this.auditMetrics.clinicalLog.push({
          time: Math.round(this.encounterClock),
          event: 'Critical Hypoxic Decompensation: Airway and perfusion unrecovered within critical time window.'
        });
      }
    }
  }
}
