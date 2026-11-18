// Scenario data for the deterministic clinical engine.
// Clinical content follows the RCUK 2021 anaphylaxis algorithm in outline and
// MUST be signed off by a clinical lead before use with learners.
// Time is compressed: untreated, the patient arrests ~145 s after onset.

export const anaphylaxis = {
  id: 'anaphylaxis-dental-01',
  title: 'Anaphylaxis in the dental chair',
  trigger: 'Chlorhexidine mouth rinse at the start of a routine checkup',
  patient: {
    name: 'Mrs. Alex Adebayo', age: 68, visit: 'Routine checkup',
    history: ['Type 1 diabetes', 'Severe penicillin allergy'],
  },
  diagnosis: { correct: 'anaphylaxis', options: ['anaphylaxis', 'hypoglycaemia', 'acs', 'syncope'] },
  guidelines: [
    'Resuscitation Council UK - Emergency treatment of anaphylaxis (2021)',
    'European Resuscitation Council Guidelines 2021 - special circumstances',
    'ADA - Medical emergencies in the dental office',
  ],
  baseline: { hr: 84, sbp: 126, dbp: 80, spo2: 99, rr: 14, swelling: 0, cyanosis: 0, sweat: 0 },
  initialPhase: 'prodrome',
  phases: {
    prodrome: {
      duration: 35, next: 'established', deteriorating: true,
      vitals: { hr: 112, sbp: 108, dbp: 68, spo2: 95, rr: 24, swelling: 0.48, cyanosis: 0.12, sweat: 0.55 },
    },
    established: {
      duration: 60, next: 'severe', deteriorating: true,
      vitals: { hr: 128, sbp: 86, dbp: 50, spo2: 91, rr: 28, swelling: 0.6, cyanosis: 0.35, sweat: 0.7 },
    },
    severe: {
      duration: 50, next: 'arrest', deteriorating: true,
      vitals: { hr: 146, sbp: 64, dbp: 36, spo2: 84, rr: 34, swelling: 0.9, cyanosis: 0.75, sweat: 1 },
    },
    arrest: {
      terminal: 'arrest', tau: 2,
      vitals: { hr: 0, sbp: 0, dbp: 0, spo2: 60, rr: 0, swelling: 1, cyanosis: 1, sweat: 1 },
    },
    recovering: {
      duration: 6, next: 'resolved',
      vitals: { hr: 108, sbp: 104, dbp: 64, spo2: 96, rr: 20, swelling: 0.35, cyanosis: 0.1, sweat: 0.5 },
    },
    resolved: {
      terminal: 'resolved',
      vitals: { hr: 96, sbp: 116, dbp: 72, spo2: 98, rr: 16, swelling: 0.2, cyanosis: 0, sweat: 0.3 },
    },
  },
  adrenaline: {
    validSites: ['thigh'],
    // Hold time is device-specific (current EpiPen labelling: 3 s; Jext: 10 s).
    // Set this to match the device your institution trains on.
    holdSeconds: 10,
  },
  drugs: {
    gtn: { class: 'contraindicated', key: 'fb_gtn' },
    aspirin: { class: 'not_indicated', key: 'fb_aspirin' },
    glucose: { class: 'not_indicated', key: 'fb_glucose' },
    insulin: { class: 'not_indicated', key: 'fb_insulin' },
    salbutamol: { class: 'adjunct', key: 'fb_salbutamol' },
  },
  weights: { recognition: 0.25, precision: 0.35, sequence: 0.25, communication: 0.15 },
  passMark: 70,
};

export const hypoglycaemia = {
  id: 'hypoglycaemia-dental-01',
  title: 'Severe hypoglycaemia in the dental chair',
  trigger: 'Missed breakfast following morning insulin injection',
  patient: {
    name: 'Mrs. Alex Adebayo', age: 68, visit: 'Routine checkup',
    history: ['Type 1 diabetes', 'Severe penicillin allergy'],
  },
  diagnosis: { correct: 'hypoglycaemia', options: ['anaphylaxis', 'hypoglycaemia', 'acs', 'syncope'] },
  guidelines: [
    'Resuscitation Council UK - Medical emergencies in dental practice',
    'British National Formulary (BNF) - Emergency treatment of hypoglycaemia',
    'ADA - Medical emergencies in the dental office',
  ],
  baseline: { hr: 84, sbp: 126, dbp: 80, spo2: 99, rr: 14, swelling: 0, cyanosis: 0, sweat: 0 },
  initialPhase: 'prodrome',
  phases: {
    prodrome: {
      duration: 18, next: 'established', deteriorating: true,
      vitals: { hr: 108, sbp: 118, dbp: 74, spo2: 98, rr: 20, swelling: 0, cyanosis: 0, sweat: 0.72 },
    },
    established: {
      duration: 60, next: 'severe', deteriorating: true,
      vitals: { hr: 118, sbp: 114, dbp: 70, spo2: 97, rr: 20, swelling: 0, cyanosis: 0, sweat: 0.85 },
    },
    severe: {
      duration: 50, next: 'arrest', deteriorating: true,
      vitals: { hr: 128, sbp: 92, dbp: 58, spo2: 95, rr: 22, swelling: 0, cyanosis: 0.15, sweat: 1 },
    },
    arrest: {
      terminal: 'arrest', tau: 2,
      vitals: { hr: 112, sbp: 96, dbp: 60, spo2: 94, rr: 16, swelling: 0, cyanosis: 0.2, sweat: 1 },
    },
    recovering: {
      duration: 6, next: 'resolved',
      vitals: { hr: 94, sbp: 120, dbp: 76, spo2: 98, rr: 16, swelling: 0, cyanosis: 0, sweat: 0.35 },
    },
    resolved: {
      terminal: 'resolved',
      vitals: { hr: 82, sbp: 124, dbp: 78, spo2: 99, rr: 14, swelling: 0, cyanosis: 0, sweat: 0.1 },
    },
  },
  adrenaline: { validSites: ['thigh'], holdSeconds: 10 },
  drugs: {
    glucose: { class: 'definitive', key: 'fb_glucose_ok' },
    insulin: { class: 'contraindicated', key: 'fb_insulin_contra' },
    gtn: { class: 'not_indicated', key: 'fb_gtn' },
    aspirin: { class: 'not_indicated', key: 'fb_aspirin' },
    salbutamol: { class: 'not_indicated', key: 'fb_salbutamol_ni' },
  },
  weights: { recognition: 0.25, precision: 0.35, sequence: 0.25, communication: 0.15 },
  passMark: 70,
};
