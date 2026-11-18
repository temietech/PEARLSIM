// Expressive Clinical Voice Service using ElevenLabs `eleven_v3` Audio Tags + Web Speech fallback.
// Matches voice IDs to character age/gender and applies clinical delivery tags (e.g. [gasping], [slurred]).

const VOICE_MAP = {
  adebayo: 'XB0fDUnXU5powFXDhCwa', // Charlotte (mature female)
  patel:   'pNInz6obpgDQGcFmaJgB', // Adam (adult male)
  miller:  'ThT5KcBeYPX3keUQqHPh', // Dorothy (older female)
  chen:    'jBpfuIE2acCO8z3wKNLl', // Gigi (youthful / child-like)
  nurse:   '21m00Tcm4TlvDq8ikWAM', // Rachel (calm clinical nurse)
};

const FALLBACK_PROSODY = {
  adebayo: { pitch: 0.96, rate: 0.96 },
  patel:   { pitch: 0.86, rate: 0.98 },
  miller:  { pitch: 0.92, rate: 0.90 },
  chen:    { pitch: 1.45, rate: 1.05 },
  nurse:   { pitch: 1.08, rate: 1.06 },
};

export class VoiceService {
  constructor() {
    this.apiKey = '';
    try { this.apiKey = localStorage.getItem('pearl_eleven_key') || ''; } catch { /* ignore */ }
    this.cache = new Map();
    this.activeAudio = null;
    this.reqSeq = 0;
  }

  setApiKey(key) {
    this.apiKey = String(key || '').trim();
    try {
      if (this.apiKey) localStorage.setItem('pearl_eleven_key', this.apiKey);
      else localStorage.removeItem('pearl_eleven_key');
    } catch { /* ignore */ }
  }

  stop() {
    this.reqSeq++;
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch { /* ignore */ }
      this.activeAudio = null;
    }
    if ('speechSynthesis' in window) {
      try { speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  }

  // Build eleven_v3 expressive tagged text + voice_settings based on clinical context
  buildExpressivePrompt(spokenText, { speaker = 'adebayo', phase = 'prodrome', isHypo = false, isNurse = false } = {}) {
    if (isNurse) {
      return {
        text: `[urgent, calm, professional] ${spokenText}`,
        stability: 0.65,
        style: 0.15,
      };
    }
    if (isHypo) {
      if (phase === 'established' || phase === 'severe') {
        return {
          text: `[slurred, exhausted, confused] ${spokenText}`,
          stability: 0.25,
          style: 0.35,
        };
      }
      return {
        text: `[shaky, breathy, dizzy] ${spokenText}`,
        stability: 0.35,
        style: 0.20,
      };
    }
    // Anaphylaxis
    if (phase === 'established' || phase === 'severe') {
      return {
        text: `[gasping, panicked, strained] ${spokenText}`,
        stability: 0.28,
        style: 0.35,
      };
    }
    return {
      text: `[nervous, hesitant] ${spokenText}`,
      stability: 0.45,
      style: 0.10,
    };
  }

  async speak(rawText, opts = {}) {
    const m = String(rawText || '').match(/"(.+)"/);
    if (!m) return;
    const spoken = m[1];
    const isNurse = /^"?Nurse Sarah:/i.test(spoken) || /^"?Nurse Sarah:/i.test(rawText);
    const cleanSpoken = spoken.replace(/^Nurse Sarah:\s*/i, '');
    const speaker = isNurse ? 'nurse' : (opts.patientKey || 'adebayo');
    const lang = opts.lang || 'en';

    this.stop();
    const seq = this.reqSeq;

    if (this.apiKey) {
      const voiceId = VOICE_MAP[speaker] || VOICE_MAP.adebayo;
      const expr = this.buildExpressivePrompt(cleanSpoken, {
        speaker,
        phase: opts.phase || 'prodrome',
        isHypo: !!opts.isHypo,
        isNurse,
      });
      const cacheKey = `${voiceId}|${expr.text}|${expr.stability}|${lang}`;
      try {
        let url = this.cache.get(cacheKey);
        if (!url) {
          const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
              'xi-api-key': this.apiKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
              text: expr.text,
              model_id: 'eleven_v3',
              voice_settings: {
                stability: expr.stability,
                similarity_boost: 0.78,
                style: expr.style,
                use_speaker_boost: true,
              },
            }),
          });
          if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status}`);
          const blob = await res.blob();
          url = URL.createObjectURL(blob);
          this.cache.set(cacheKey, url);
        }
        if (seq !== this.reqSeq) return;
        const audio = new Audio(url);
        this.activeAudio = audio;
        await audio.play();
        return;
      } catch (err) {
        console.warn('[VoiceService] ElevenLabs fallback to WebSpeech:', err?.message || err);
      }
    }

    // Fallback to Web Speech API with character-matched pitch & rate
    if (seq !== this.reqSeq || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(cleanSpoken);
      const p = FALLBACK_PROSODY[speaker] || FALLBACK_PROSODY.adebayo;
      u.lang = lang;
      u.pitch = p.pitch;
      u.rate = (opts.isHypo && (opts.phase === 'established' || opts.phase === 'severe')) ? 0.78 : p.rate;
      speechSynthesis.speak(u);
    } catch { /* optional */ }
  }
}
