/**
 * llmBridge.js
 * 
 * Asynchronous dialogue bridge connecting the deterministic physiological state machine
 * to an LLM dialogue generator. Sends lightweight JSON payloads on state transitions
 * and updates the 3D floating spatial speech bubble above the patient's head.
 */

import { ClinicalStates, Interventions } from './ClinicalStateMachine.js';

// Configuration for LLM endpoint
export const LLM_CONFIG = {
  apiEndpoint: (typeof window !== 'undefined' && window.__PEARLSIM_LLM_ENDPOINT__) || null,
  apiKey: (typeof window !== 'undefined' && window.__PEARLSIM_LLM_KEY__) || null,
  timeoutMs: 3500
};

/**
 * Curated clinical dialogue matrix used for realistic, instantaneous dialogue responses
 * when offline or when external API endpoint is not set.
 */
const CLINICAL_DIALOGUE_MATRIX = {
  [ClinicalStates.BASELINE]: [
    "I... I feel a bit shaky and lightheaded. Did I skip lunch?",
    "Doctor... my hands feel slightly numb. Is the dental room getting warm?",
    "I'm feeling quite drained... my focus is slipping a little bit.",
    "Could I have a moment? I feel slightly clammy and off balance."
  ],
  [ClinicalStates.HYPOGLYCEMIA]: [
    "My head is spinning... I can't... I can't see straight. Everything is blurry...",
    "I'm shivering so hard... I feel cold sweat everywhere... please help me...",
    "Where... where am I? Words are getting tangled in my tongue...",
    "Heart is racing out of my chest! Thump... thump... I feel like I'm fainting...",
    "My hands won't stop trembling... doctor, something is really wrong..."
  ],
  [ClinicalStates.RECOVERY_GLUCAGON]: [
    "Oh... the fog is beginning to lift. My hands stopped shaking...",
    "I'm feeling a bit better... the warmth is coming back to my chest.",
    "Thank you... my vision is clearing up. What did you just give me?",
    "Phew... the dizziness is fading. I can think clearly again."
  ],
  [ClinicalStates.RECOVERY_GLUCOSE_GEL]: [
    "That sweet gel... thank you. The violent shaking is slowing down...",
    "The dizziness is subsiding... I can catch my breath now. Thank you, doctor.",
    "My vision is coming back. That glucose worked... I feel much better."
  ],
  [ClinicalStates.CRITICAL_INSULIN]: [
    "Wait... no! It burns... why did you give me... *gasp*...",
    "I can't... breathe... darkness... slipping away... *unresponsive*",
    "No... everything is going pitch black... *slumps into seizure stupor*...",
    "*Gasping weakly* ...too... much... *eyes roll back, loses consciousness*"
  ],
  [ClinicalStates.ADRENALINE_ERROR]: [
    "My heart! It's violently pounding out of my ribs... thump-thump! But my head... everything is still spinning...",
    "Chest is crushing... I feel like my heart is going to burst! Why am I still so weak?!",
    "Doctor, my heart is exploding! I feel dizzy and panicked... please help me breathe!"
  ],
  [ClinicalStates.TRENDELENBURG_ERROR]: [
    "Why is the chair tipping backwards? Blood is rushing to my head... I still can't think straight...",
    "I feel choked... tipping me back isn't stopping the trembling... please..."
  ]
};

// Tracking index to cycle non-repetitive dialogue
const dialogueIndices = {
  [ClinicalStates.BASELINE]: 0,
  [ClinicalStates.HYPOGLYCEMIA]: 0,
  [ClinicalStates.RECOVERY_GLUCAGON]: 0,
  [ClinicalStates.RECOVERY_GLUCOSE_GEL]: 0,
  [ClinicalStates.CRITICAL_INSULIN]: 0,
  [ClinicalStates.ADRENALINE_ERROR]: 0,
  [ClinicalStates.TRENDELENBURG_ERROR]: 0
};

/**
 * Main dialogue fetch function:
 * fetchPatientDialogue(currentState, lastIntervention, vitals)
 */
export async function fetchPatientDialogue(currentState, lastIntervention = Interventions.NONE, vitals = {}) {
  const payload = {
    patientId: "PATIENT-T1D-847592",
    clinicalState: currentState,
    lastIntervention: lastIntervention,
    timestamp: new Date().toISOString(),
    vitalsSummary: {
      bloodGlucose: vitals.bloodGlucose ?? (currentState === ClinicalStates.HYPOGLYCEMIA ? 38 : 72),
      heartRate: vitals.heartRate ?? (currentState === ClinicalStates.HYPOGLYCEMIA ? 122 : 82),
      bloodPressure: vitals.systolicBP ? `${vitals.systolicBP}/${vitals.diastolicBP}` : '118/76',
      cognitiveStatus: vitals.cognitiveStatus ?? 'Assessing'
    },
    systemPrompt: "You are a 34-year-old dental patient with Type 1 Diabetes in an emergency clinical simulation. Output ONLY 1 short, raw, visceral sentence reflecting your current physiological distress, confusion, relief, or collapse based on the clinical state. Do NOT include quotation marks, stage directions, or metadata."
  };

  // If external endpoint is provided, attempt HTTP fetch
  if (LLM_CONFIG.apiEndpoint) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LLM_CONFIG.timeoutMs);

      const headers = { 'Content-Type': 'application/json' };
      if (LLM_CONFIG.apiKey) {
        headers['Authorization'] = `Bearer ${LLM_CONFIG.apiKey}`;
      }

      const response = await fetch(LLM_CONFIG.apiEndpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const text = data.dialogue || data.text || data.message || (typeof data === 'string' ? data : null);
        if (text && typeof text === 'string') {
          return cleanDialogueText(text);
        }
      }
    } catch (err) {
      console.warn('[LLM Bridge] External endpoint failed. Falling back to matrix.', err.message);
    }
  }

  // Fallback to high-fidelity clinical dialogue matrix
  await new Promise(resolve => setTimeout(resolve, 350));

  const list = CLINICAL_DIALOGUE_MATRIX[currentState] || CLINICAL_DIALOGUE_MATRIX[ClinicalStates.BASELINE];
  const idx = dialogueIndices[currentState] % list.length;
  dialogueIndices[currentState] = (idx + 1) % list.length;

  return list[idx];
}

function cleanDialogueText(raw) {
  let cleaned = raw.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  return cleaned;
}
