// Deterministic clinical state machine. No randomness, no rendering, no DOM:
// the same sequence of (time, action) inputs always produces the same vitals,
// the same outcome and the same audit score. Runs unchanged under Node for tests.

export const STEP = 0.1; // fixed simulation step, seconds
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const VITAL_KEYS = ['hr', 'sbp', 'dbp', 'spo2', 'rr', 'swelling', 'cyanosis', 'sweat'];

export class ClinicalEngine {
  constructor(scenario) {
    this.sc = scenario;
    this.listeners = [];
    this.reset();
  }

  on(fn) { this.listeners.push(fn); }
  emit(ev) { for (const fn of this.listeners) fn(ev); }

  reset() {
    this.t = 0;
    this.acc = 0;
    this.running = false;
    this.ended = false;
    this.outcome = null;
    this.phase = this.sc.initialPhase;
    this.progress = 0;
    this.holdoff = 0;
    this.vitals = { ...this.sc.baseline };
    this.f = {
      pulseAt: null, airwayAt: null, helpAt: null, supineAt: null, oxygenAt: null,
      boxAt: null, adrenalineAt: null, dxAt: null, dxWrong: 0, monitoring: false,
      partialDoses: 0, siteErrors: 0, contraindicated: 0, notIndicated: 0,
      adjunctBeforeAdrenaline: false,
    };
    this.log = [];
  }

  start() { this.running = true; this.record('scenario_start', 'neutral', this.sc.title, 'log_start'); }

  tick(dt) {
    if (!this.running || this.ended) return;
    this.acc += dt;
    while (this.acc >= STEP && !this.ended) { this.acc -= STEP; this.step(); }
  }

  step() {
    this.t = Math.round((this.t + STEP) * 10) / 10;
    const ph = this.sc.phases[this.phase];
    if (ph.duration) {
      if (this.holdoff > 0) this.holdoff -= STEP;
      else {
        let rate = 1;
        if (ph.deteriorating) {
          if (this.f.supineAt !== null) rate *= 0.8;
          if (this.f.oxygenAt !== null) rate *= 0.85;
        }
        this.progress += STEP * rate;
      }
      if (this.progress >= ph.duration) this.setPhase(ph.next);
    }
    const cur = this.sc.phases[this.phase];
    const tgt = { ...cur.vitals };
    if (!cur.terminal || cur.terminal === 'resolved') {
      if (this.f.oxygenAt !== null) tgt.spo2 = Math.min(99, tgt.spo2 + 4);
      if (this.f.supineAt !== null && tgt.sbp < 100) { tgt.sbp += 8; tgt.dbp += 4; }
    }
    const k = 1 - Math.exp(-STEP / (cur.tau || 8));
    for (const key of VITAL_KEYS) this.vitals[key] += (tgt[key] - this.vitals[key]) * k;
  }

  setPhase(id) {
    if (id === this.phase || this.ended) return;
    this.phase = id;
    this.progress = 0;
    this.record('phase', id === 'arrest' ? 'incorrect' : 'neutral', id, 'phase_' + id);
    this.emit({ type: 'phase', phase: id });
    const term = this.sc.phases[id].terminal;
    if (term) {
      this.ended = true;
      this.outcome = term;
      this.record('scenario_end', term === 'resolved' ? 'correct' : 'incorrect', term, 'log_end_' + term);
      this.emit({ type: 'end', outcome: term });
    }
  }

  record(type, severity, detail = '', key = null, params = null) {
    this.log.push({ t: this.t, type, severity, detail, key, params });
  }

  // Every learner action goes through here. Returns { severity, key, params }
  // where severity is 'correct' | 'incorrect' | 'neutral' and key is an i18n id.
  act(type, p = {}) {
    if (!this.running || this.ended) return null;
    const f = this.f;
    const t = this.t;
    const once = (flag, key) => {
      if (f[flag] !== null) return { severity: 'neutral', key: 'already_done' };
      f[flag] = t;
      return { severity: 'correct', key };
    };
    let r;
    switch (type) {
      case 'assess_pulse':
        f.monitoring = true;
        r = once('pulseAt', 'fb_pulse');
        if (r.key === 'already_done') r = { severity: 'neutral', key: 'fb_pulse' };
        r.params = { hr: Math.round(this.vitals.hr) };
        break;
      case 'inspect_airway': r = once('airwayAt', 'fb_airway'); break;
      case 'call_help': r = once('helpAt', 'fb_help'); break;
      case 'position_supine': r = once('supineAt', 'fb_supine'); break;
      case 'oxygen': r = once('oxygenAt', 'fb_oxygen'); break;
      case 'open_drug_box':
        if (f.boxAt === null) f.boxAt = t;
        r = { severity: 'neutral', key: 'fb_box' };
        break;
      case 'diagnose': r = this.diagnose(p.id); break;
      case 'inject': r = this.inject(p); break;
      case 'drug': r = this.giveDrug(p.id); break;
      default: r = { severity: 'neutral', key: 'fb_no_effect' };
    }
    this.record(type, r.severity, r.detail || p.id || p.site || '', r.key, r.params || null);
    return r;
  }

  diagnose(id) {
    const f = this.f;
    if (f.pulseAt === null || f.airwayAt === null) return { severity: 'neutral', key: 'fb_dx_locked' };
    if (f.dxAt !== null) return { severity: 'neutral', key: 'already_done' };
    if (id === this.sc.diagnosis.correct) { f.dxAt = this.t; return { severity: 'correct', key: 'fb_dx_correct', detail: id }; }
    f.dxWrong++;
    return { severity: 'incorrect', key: 'fb_dx_wrong', detail: id };
  }

  inject({ site, held = 0 }) {
    const cfg = this.sc.adrenaline;
    const f = this.f;
    if (!cfg.validSites.includes(site)) {
      f.siteErrors++;
      return { severity: 'incorrect', key: 'fb_wrong_site', detail: `wrong site: ${site}`, consumed: false };
    }
    if (held + 1e-6 < cfg.holdSeconds) {
      f.partialDoses++;
      this.holdoff = Math.max(this.holdoff, 20 * (held / cfg.holdSeconds));
      return {
        severity: 'incorrect', key: 'fb_adrenaline_partial', params: { s: cfg.holdSeconds },
        detail: `partial dose, held ${held.toFixed(1)} s of ${cfg.holdSeconds} s`, consumed: true,
      };
    }
    if (f.adrenalineAt !== null) {
      return { severity: 'neutral', key: 'fb_adrenaline_repeat', detail: 'repeat dose', consumed: true };
    }
    f.adrenalineAt = this.t;
    if (this.sc.phases[this.phase].deteriorating) this.setPhase('recovering');
    return { severity: 'correct', key: 'fb_adrenaline_full', detail: `full dose, ${site}`, consumed: true };
  }

  giveDrug(id) {
    const d = this.sc.drugs[id];
    const f = this.f;
    if (!d) return { severity: 'neutral', key: 'fb_no_effect', detail: id };
    if (d.class === 'definitive') {
      if (f.adrenalineAt === null) f.adrenalineAt = this.t;
      if (this.sc.phases[this.phase].deteriorating) this.setPhase('recovering');
      return { severity: 'correct', key: d.key, detail: `${id} (definitive)` };
    }
    if (d.class === 'contraindicated') {
      f.contraindicated++;
      const ph = this.sc.phases[this.phase];
      if (ph.deteriorating) this.setPhase(ph.next);
      else if (this.phase === 'recovering') this.setPhase('established');
      return { severity: 'incorrect', key: d.key, detail: `${id} (contraindicated)` };
    }
    if (d.class === 'adjunct') {
      if (f.adrenalineAt !== null) return { severity: 'correct', key: d.key + '_ok', detail: `${id} (adjunct)` };
      f.adjunctBeforeAdrenaline = true;
      return { severity: 'incorrect', key: d.key + '_early', detail: `${id} before adrenaline` };
    }
    f.notIndicated++;
    return { severity: 'incorrect', key: d.key, detail: `${id} (not indicated)` };
  }

  score() {
    const f = this.f;
    const lin = (v, full, zero) => clamp((zero - v) / (zero - full), 0, 1) * 100;
    const firstAssess = f.pulseAt === null ? f.airwayAt
      : f.airwayAt === null ? f.pulseAt : Math.min(f.pulseAt, f.airwayAt);
    const bothAssess = f.pulseAt !== null && f.airwayAt !== null ? Math.max(f.pulseAt, f.airwayAt) : null;

    // Recognition is timed to the correct working diagnosis; assessment alone earns partial credit.
    let recognition = 0;
    if (f.dxAt !== null) recognition = Math.max(20, lin(f.dxAt, 30, 120));
    else if (bothAssess !== null) recognition = Math.max(10, 0.4 * lin(bothAssess, 30, 120));
    else if (firstAssess !== null) recognition = Math.max(5, 0.2 * lin(firstAssess, 30, 120));
    recognition = clamp(recognition - 15 * f.dxWrong, 0, 100);

    let precision = 0;
    if (f.adrenalineAt !== null) {
      precision = 50 + 0.3 * lin(f.adrenalineAt, 60, 150)
        + Math.max(0, 10 - 5 * f.siteErrors) + (f.partialDoses === 0 ? 10 : 0);
    }
    precision = clamp(precision - 40 * f.contraindicated - 15 * f.notIndicated, 0, 100);

    const isHypo = this.sc?.diagnosis?.correct === 'hypoglycaemia';
    const seq = {
      helpEarly: f.helpAt !== null && (f.adrenalineAt === null || f.helpAt <= f.adrenalineAt || f.helpAt <= 45),
      supine: isHypo ? true : f.supineAt !== null,
      adrenalineFirst: f.adrenalineAt !== null && !f.adjunctBeforeAdrenaline,
      oxygen: isHypo ? true : f.oxygenAt !== null,
      assessedBeforeDrugs: firstAssess !== null && (f.boxAt === null || firstAssess <= f.boxAt),
    };
    const sequence = (seq.helpEarly ? 25 : 0) + (seq.supine ? 20 : 0) + (seq.adrenalineFirst ? 25 : 0)
      + (seq.oxygen ? 20 : 0) + (seq.assessedBeforeDrugs ? 10 : 0);

    let communication = 0;
    if (f.helpAt !== null) communication = f.helpAt <= 30 ? 100 : f.helpAt <= 90 ? 100 - (f.helpAt - 30) : 20;

    const w = this.sc.weights;
    const overall = recognition * w.recognition + precision * w.precision
      + sequence * w.sequence + communication * w.communication;
    const r = (n) => Math.round(n);
    const grade = (n) => (n >= 90 ? 'A' : n >= 80 ? 'B' : n >= 70 ? 'C' : 'F');
    return {
      outcome: this.outcome,
      isHypo: this.sc?.diagnosis?.correct === 'hypoglycaemia',
      duration: this.t,
      domains: {
        recognition: r(recognition), precision: r(precision),
        sequence: r(sequence), communication: r(communication),
      },
      overall: r(overall),
      grade: grade(r(overall)),
      grades: {
        recognition: grade(r(recognition)), precision: grade(r(precision)),
        sequence: grade(r(sequence)), communication: grade(r(communication)),
      },
      pass: this.outcome === 'resolved' && f.contraindicated === 0 && Math.round(overall) >= this.sc.passMark,
      times: {
        firstAssess, bothAssess, dx: f.dxAt, help: f.helpAt, supine: f.supineAt,
        oxygen: f.oxygenAt, adrenaline: f.adrenalineAt,
      },
      errors: {
        dxWrong: f.dxWrong, siteErrors: f.siteErrors, partialDoses: f.partialDoses,
        contraindicated: f.contraindicated, notIndicated: f.notIndicated,
        adjunctBeforeAdrenaline: f.adjunctBeforeAdrenaline,
      },
      seq,
    };
  }
}
