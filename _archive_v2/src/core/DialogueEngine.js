/**
 * DialogueEngine.js - Institutional Communication & Speech Engine
 * Features real-time voice input, simulated stridor, speech slurring,
 * and chairside dental assistant command parsing.
 */

export class DialogueEngine {
  constructor(onSpeechRecognized, onSpeechSynthesized) {
    this.onSpeechRecognized = onSpeechRecognized;
    this.onSpeechSynthesized = onSpeechSynthesized;

    this.synth = window.speechSynthesis || null;
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;

    this.initSpeechRecognition();
  }

  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        this.recognition = new SpeechRec();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-GB';

        this.recognition.onstart = () => { this.isListening = true; };
        this.recognition.onend = () => { this.isListening = false; };
        this.recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          if (this.onSpeechRecognized) {
            this.onSpeechRecognized(transcript);
          }
        };
      } catch (e) {
        console.warn('[DialogueEngine] Speech recognition unavailable.');
      }
    }
  }

  startListening() {
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (e) {}
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }

  speak(text, speaker = 'Patient', options = {}) {
    if (!this.synth) return;
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 0.95;
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.onSpeechSynthesized) this.onSpeechSynthesized({ speaker, text, active: true });
    };
    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.onSpeechSynthesized) this.onSpeechSynthesized({ speaker, text, active: false });
    };
    utterance.onerror = () => {
      this.isSpeaking = false;
      if (this.onSpeechSynthesized) this.onSpeechSynthesized({ speaker, text, active: false });
    };

    this.synth.speak(utterance);
  }

  getPatientSpeech(caseId, isEmergency) {
    if (!isEmergency) {
      return {
        speaker: 'Patient',
        text: 'Good morning, doctor. I am just here for my routine scale and polish. I am feeling well today.',
        rate: 1.0,
        pitch: 1.05
      };
    }

    if (caseId === 'ANAPHYLAXIS') {
      return {
        speaker: 'Patient (Inspiratory Stridor)',
        text: 'Doctor... my throat... feels like it is closing shut... I cannot... swallow or catch my breath...',
        rate: 0.75,
        pitch: 0.85
      };
    } else if (caseId === 'HYPOGLYCEMIA') {
      return {
        speaker: 'Patient (Neuroglycopenic Slurring)',
        text: 'I feel so weak and shaky... I took my insulin this morning but skipped breakfast... my hands will not stop trembling...',
        rate: 0.82,
        pitch: 0.95
      };
    } else if (caseId === 'MYOCARDIAL_INFARCTION') {
      return {
        speaker: 'Patient (Crushing Angina)',
        text: 'My chest... an unbearable tightness like an anvil... shooting severe pain down into my left arm and jaw...',
        rate: 0.78,
        pitch: 0.90
      };
    } else if (caseId === 'VASOVAGAL_SYNCOPE') {
      return {
        speaker: 'Patient (Presyncope Faint)',
        text: 'I suddenly feel burning hot and nauseous... everything in the room is fading to black...',
        rate: 0.85,
        pitch: 0.92
      };
    }

    return {
      speaker: 'Patient',
      text: 'Doctor, something is very wrong...',
      rate: 0.9,
      pitch: 1.0
    };
  }

  parseAssistantCommand(transcript) {
    const text = transcript.toLowerCase();

    if (text.includes('999') || text.includes('ambulance') || text.includes('emergency services') || text.includes('call')) {
      return {
        type: 'AMBULANCE',
        speaker: 'Dental Assistant Sarah',
        text: 'Dialing 999 immediately. Informing emergency dispatch of an acute chairside medical emergency and requesting blue-light paramedic response.'
      };
    } else if (text.includes('kit') || text.includes('box') || text.includes('drug') || text.includes('resus') || text.includes('adrenaline') || text.includes('epipen')) {
      return {
        type: 'KIT',
        speaker: 'Dental Assistant Sarah',
        text: 'Opening the emergency resuscitation drug box on the countertop station now, doctor.'
      };
    } else if (text.includes('trendelenburg') || text.includes('recline') || text.includes('chair') || text.includes('tilt') || text.includes('flat')) {
      return {
        type: 'TRENDELENBURG',
        speaker: 'Dental Assistant Sarah',
        text: 'Reclining the dental chair flat into the horizontal Trendelenburg position to restore cerebral blood flow.'
      };
    } else if (text.includes('oxygen') || text.includes('cylinder') || text.includes('mask')) {
      return {
        type: 'OXYGEN',
        speaker: 'Dental Assistant Sarah',
        text: 'High-flow oxygen cylinder prepped with non-rebreathe reservoir mask at 15 litres per minute.'
      };
    }

    return {
      type: 'GENERAL',
      speaker: 'Dental Assistant Sarah',
      text: 'Understood, doctor. Standing by chairside to assist you.'
    };
  }
}
