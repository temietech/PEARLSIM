// Spatial UI: every panel is a canvas-textured quad living in the 3D scene, so
// the same interface works on a desktop monitor and inside a headset.
// Visual language: dark frosted glass, cyan edge glow, emerald / crimson status.
import * as THREE from 'three';

export const COLORS = { correct: '#34d399', incorrect: '#f43f5e', neutral: '#22d3ee', cyan: '#22d3ee', ink: '#e8f6fb', mute: '#8fb3c2' };
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export class CanvasPanel {
  constructor(w, h, pxW, pxH, { overlay = false } = {}) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = pxW; this.canvas.height = pxH;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: !overlay, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.material);
    if (overlay) this.mesh.renderOrder = 999;
  }
  commit() { this.texture.needsUpdate = true; }
  // Canvas pixel -> panel-local metres.
  local(px, py) { return [(px / this.canvas.width - 0.5) * this.w, (0.5 - py / this.canvas.height) * this.h]; }
}

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.closePath(); }
function glass(ctx, x, y, w, h, r, { stroke = COLORS.cyan, glow = 22, lw = 3, top = 'rgba(8,24,36,0.92)', bottom = 'rgba(4,14,24,0.96)' } = {}) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  rr(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.shadowColor = stroke; ctx.shadowBlur = glow; ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); ctx.restore();
  // faint top highlight, like light catching the glass edge
  ctx.save(); rr(ctx, x + 6, y + 6, w - 12, h - 12, Math.max(2, r - 6)); ctx.clip();
  const hl = ctx.createLinearGradient(0, y, 0, y + h * 0.4);
  hl.addColorStop(0, 'rgba(255,255,255,0.10)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(x, y, w, h * 0.4); ctx.restore();
}
function tick(ctx, cx, cy, r, ok) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = ok ? COLORS.correct : COLORS.incorrect; ctx.fill();
  ctx.strokeStyle = '#04141c'; ctx.lineWidth = r * 0.28; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  if (ok) { ctx.moveTo(cx - r * 0.45, cy); ctx.lineTo(cx - r * 0.1, cy + r * 0.38); ctx.lineTo(cx + r * 0.5, cy - r * 0.35); }
  else { ctx.moveTo(cx - r * 0.38, cy - r * 0.38); ctx.lineTo(cx + r * 0.38, cy + r * 0.38); ctx.moveTo(cx + r * 0.38, cy - r * 0.38); ctx.lineTo(cx - r * 0.38, cy + r * 0.38); }
  ctx.stroke();
}
function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}
function fit(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 4 && ctx.measureText(s + '...').width > maxW) s = s.slice(0, -1);
  return s.trimEnd() + '...';
}

export function makeLabel(text, w, h, { bg = '#ffffff', fg = '#0f172a', px = 256 } = {}) {
  const p = new CanvasPanel(w, h, px, Math.round(px * h / w));
  const { ctx, canvas } = p;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  const lh = canvas.height / (lines.length + 0.6);
  lines.forEach((l, i) => {
    let size = Math.floor(lh * (i === 0 ? 0.8 : 0.62));
    const f = () => { ctx.font = `${i === 0 ? 700 : 500} ${size}px ${FONT}`; };
    f(); while (ctx.measureText(l).width > canvas.width * 0.94 && size > 8) { size--; f(); }
    ctx.fillText(l, canvas.width / 2, lh * (i + 0.8));
  });
  p.material.transparent = false;
  p.commit();
  return p.mesh;
}

// Shared Lead II ECG waveform renderer (supports Desktop HUD & VR/MR Monitor)
export function drawEcgWaveform(ctx, ex, ey, ew, eh, v, animTime, phase = 'prodrome') {
  const isArrest = phase === 'arrest' || v.hr <= 0;
  const isCritical = v.sbp < 90 || v.spo2 < 92 || phase === 'severe';
  const strokeCol = isArrest ? '#f43f5e' : isCritical ? '#fb7185' : '#34d399';
  const baseLine = ey + eh * 0.64;

  ctx.save();
  ctx.strokeStyle = strokeCol;
  ctx.lineWidth = Math.max(1.8, eh * 0.036);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  if (isArrest) {
    for (let x = 0; x <= ew; x += 2) {
      const y = baseLine + Math.sin(x * 0.08 + animTime * 4) * 0.6;
      if (x === 0) ctx.moveTo(ex + x, y); else ctx.lineTo(ex + x, y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  const freq = Math.max(0.8, v.hr / 60);
  const pxPerBeat = Math.max(24, ew * 0.16);
  const ampScale = eh / 132;
  const stDepression = (phase === 'established' || phase === 'severe') ? 7 * ampScale : 0;
  const stepX = ew > 300 ? 3 : 1.5;
  let lastY = baseLine;

  for (let x = 0; x <= ew; x += stepX) {
    const p = ((x / pxPerBeat) * freq + animTime * freq) % 1;
    let y = baseLine;
    if (p > 0.12 && p < 0.20) y -= Math.sin(((p - 0.12) / 0.08) * Math.PI) * 12 * ampScale;
    else if (p >= 0.24 && p < 0.27) y += 11 * ampScale;
    else if (p >= 0.27 && p < 0.32) y -= Math.sin(((p - 0.27) / 0.05) * Math.PI) * 58 * ampScale;
    else if (p >= 0.32 && p < 0.36) y += (16 * ampScale) + stDepression;
    else if (p >= 0.36 && p < 0.44) y += stDepression * 0.6;
    else if (p >= 0.44 && p < 0.56) y -= Math.sin(((p - 0.44) / 0.12) * Math.PI) * 18 * ampScale - stDepression * 0.3;
    if (x === 0) ctx.moveTo(ex + x, y); else ctx.lineTo(ex + x, y);
    lastY = y;
  }
  ctx.stroke();

  ctx.fillStyle = strokeCol;
  ctx.beginPath();
  ctx.arc(ex + ew - 2, lastY, Math.max(2.2, eh * 0.036), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Patient monitor: positioned in upper-left peripheral FOV in VR/AR with live ECG Lead II strip.
export class Monitor extends CanvasPanel {
  constructor() { super(0.52, 0.36, 780, 540, { overlay: true }); this.lastUnmonSec = -1; }
  draw(v, monitoring, time, tr, animTime = time, phase = 'prodrome') {
    const sec = Math.floor(time);
    if (!monitoring && sec === this.lastUnmonSec) return;
    this.lastUnmonSec = monitoring ? -1 : sec;
    const { ctx, canvas: c } = this;
    const critical = monitoring && (v.sbp < 90 || v.spo2 < 92);
    const strokeCol = critical ? COLORS.incorrect : COLORS.cyan;
    ctx.clearRect(0, 0, c.width, c.height);
    glass(ctx, 18, 18, c.width - 36, c.height - 36, 30, {
      stroke: strokeCol, glow: critical ? 24 : 16, lw: 4,
      top: 'rgba(5, 16, 26, 0.94)', bottom: 'rgba(3, 10, 18, 0.97)',
    });
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#67e8f9'; ctx.font = `800 20px ${FONT}`; ctx.textAlign = 'left';
    ctx.fillText('PATIENT VITALS  •  LIVE', 33, 46);
    const mm = Math.floor(time / 60), ss = String(Math.floor(time % 60)).padStart(2, '0');
    ctx.fillStyle = '#a5f3fc'; ctx.font = '700 26px ui-monospace, Consolas, monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${mm}:${ss}`, c.width - 33, 48);
    ctx.textAlign = 'left';

    // Live ECG Lead II Strip Box
    const ex = 33, ey = 64, ew = c.width - 66, eh = 99;
    ctx.fillStyle = 'rgba(2, 9, 15, 0.92)';
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.32)';
    ctx.lineWidth = 2;
    rr(ctx, ex, ey, ew, eh, 12); ctx.fill(); ctx.stroke();

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.09)';
    ctx.lineWidth = 1;
    for (let gx = ex + 30; gx < ex + ew; gx += 30) { ctx.beginPath(); ctx.moveTo(gx, ey); ctx.lineTo(gx, ey + eh); ctx.stroke(); }
    for (let gy = ey + 25; gy < ey + eh; gy += 25) { ctx.beginPath(); ctx.moveTo(ex, gy); ctx.lineTo(ex + ew, gy); ctx.stroke(); }

    if (!monitoring) {
      ctx.fillStyle = '#fbbf24'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tr('mon_assess') + ' — ' + tr('mon_assess2'), ex + ew / 2, ey + eh / 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    } else {
      drawEcgWaveform(ctx, ex, ey, ew, eh, v, animTime, phase);
    }

    const cell = (label, val, unit, x, y, col, size = 78) => {
      ctx.fillStyle = '#94a3b8'; ctx.font = `700 20px ${FONT}`; ctx.fillText(label, x, y);
      ctx.fillStyle = col;
      ctx.font = `800 ${size}px ui-monospace, Consolas, monospace`; ctx.fillText(val, x, y + size - 5);
      ctx.font = `600 18px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(unit, x, y + size + 20); ctx.globalAlpha = 1;
    };
    const hrVal = monitoring ? String(Math.round(v.hr)) : '--';
    const spo2Val = monitoring ? String(Math.round(v.spo2)) : '--';
    const bpVal = monitoring ? `${Math.round(v.sbp)}/${Math.round(v.dbp)}` : '--/--';
    const rrVal = monitoring ? String(Math.round(v.rr)) : '--';
    cell('HEART RATE', hrVal, 'bpm', 36, 200, '#34d399');
    cell('SpO2 OXIMETRY', spo2Val, '%', 405, 200, '#38bdf8');
    cell('NIBP PRESSURE', bpVal, 'mmHg', 36, 370, v.sbp < 90 && monitoring ? '#fb7185' : '#e2e8f0', 66);
    cell('RESP RATE', rrVal, '/min', 480, 370, '#facc15', 66);
    this.commit();
  }
}

// Feedback card: drifts in the lower field of view, colour-coded, then fades.
export class Toast extends CanvasPanel {
  constructor() {
    super(0.6, 0.126, 1200, 252, { overlay: true });
    this.ttl = 0; this.material.opacity = 0; this.last = '';
  }
  show(text, severity = 'neutral', ttl = 5.5, progress = null) {
    const key = text + severity + (progress === null ? '' : progress.toFixed(2));
    this.ttl = ttl;
    if (key === this.last) return;
    this.last = key;
    const { ctx, canvas: c } = this;
    const col = COLORS[severity] || COLORS.neutral;
    ctx.clearRect(0, 0, c.width, c.height);
    glass(ctx, 28, 28, c.width - 56, c.height - 56, 36, { stroke: col });
    ctx.fillStyle = COLORS.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `500 44px ${FONT}`;
    let lines = wrap(ctx, text, c.width - 170);
    if (lines.length > 2) { ctx.font = `500 36px ${FONT}`; lines = wrap(ctx, text, c.width - 170).slice(0, 3); }
    const lh = lines.length > 2 ? 44 : 54;
    const y0 = c.height / 2 - ((lines.length - 1) * lh) / 2 - (progress !== null ? 12 : 0);
    if (severity !== 'neutral') tick(ctx, 86, c.height / 2 - (progress !== null ? 12 : 0), 24, severity === 'correct');
    const tx = severity !== 'neutral' ? 130 : 78;
    lines.forEach((l, i) => ctx.fillText(l, tx, y0 + i * lh));
    if (progress !== null) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, 78, c.height - 78, c.width - 156, 14, 7); ctx.fill();
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col;
      rr(ctx, 78, c.height - 78, Math.max(14, (c.width - 156) * Math.min(1, progress)), 14, 7); ctx.fill(); ctx.restore();
    }
    this.commit();
  }
  update(dt) {
    this.ttl -= dt;
    const target = this.ttl > 0 ? 1 : 0;
    this.material.opacity += (target - this.material.opacity) * Math.min(1, dt * 8);
    this.mesh.visible = this.material.opacity > 0.02;
  }
}

// Big patient briefing HUD card with generic patient details + START CHECKUP button.
export class StartCard extends CanvasPanel {
  constructor(tr, patient = null) {
    super(0.84, 0.36, 1280, 548, { overlay: true });
    this.tr = tr;
    this.setPatient(patient);
    this.mesh.userData.ia = { kind: 'target', id: 'start', enabled: true, radius: 0.38 };
  }
  setPatient(patient) {
    const { ctx, canvas: c, tr } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    glass(ctx, 24, 24, c.width - 48, c.height - 48, 40, {
      stroke: 'rgba(34,211,238,0.75)', glow: 22, lw: 3,
      top: 'rgba(10,24,38,0.92)', bottom: 'rgba(6,15,26,0.95)',
    });
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8'; ctx.font = `800 22px ${FONT}`;
    ctx.fillText('PATIENT BRIEFING', 74, 78);

    if (patient) {
      ctx.fillStyle = '#f8fafc'; ctx.font = `800 54px ${FONT}`;
      ctx.fillText(`${patient.name}, ${patient.age}yo`, 74, 142);
      ctx.fillStyle = '#67e8f9'; ctx.font = `700 32px ${FONT}`;
      ctx.fillText(patient.visit || 'Routine Dental Checkup', 74, 206);
      const hist = Array.isArray(patient.history) && patient.history.length ? patient.history.join('  •  ') : 'No known medical issues';
      ctx.fillStyle = '#cbd5e1'; ctx.font = `600 28px ${FONT}`;
      ctx.fillText(fit(ctx, `Medical Notes: ${hist}`, c.width - 150), 74, 272);
      ctx.fillStyle = '#94a3b8'; ctx.font = `500 25px ${FONT}`;
      ctx.fillText('Patient is seated comfortably in the dental chair. Ready to begin.', 74, 326);
    } else {
      ctx.fillStyle = COLORS.ink; ctx.font = `600 44px ${FONT}`;
      const lines = wrap(ctx, tr('start_msg'), c.width - 160).slice(0, 2);
      lines.forEach((l, i) => ctx.fillText(l, 74, 180 + i * 58));
    }
    ctx.save(); ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 28; rr(ctx, 390, 384, 500, 108, 28); ctx.fillStyle = COLORS.cyan; ctx.fill(); ctx.restore();
    ctx.fillStyle = '#04222b'; ctx.textAlign = 'center'; ctx.font = `800 40px ${FONT}`; ctx.fillText(tr('start_btn'), 640, 440);
    this.commit();
  }
}

const SYMPTOM_OPTIONS = [
  { id: 'sym_anaphylaxis', label: 'Throat tightness, tongue swelling & weak rapid pulse' },
  { id: 'sym_hypo', label: 'Sweating, tremor & normal oral airway' },
  { id: 'sym_stemi', label: 'Crushing central chest pain radiating to left arm' },
  { id: 'sym_syncope', label: 'Brief dizziness & slow pulse, resolves when flat' },
];

const TX_OPTIONS = [
  { id: 'tx_adrenaline', label: 'IM Adrenaline 0.5mg (1:1000) + High-Flow O2' },
  { id: 'tx_glucose', label: 'Oral Glucose Gel / Dextrose 40%' },
  { id: 'tx_gtn', label: 'Sublingual GTN Spray + Aspirin 300mg' },
  { id: 'tx_observe', label: 'Lay flat & observe only (no medication)' },
];

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Clinical reasoning panel: 1 Symptoms -> 2 Differential diagnosis -> 3 Treatment protocol.
// World-anchored to the side of the patient so it never covers them.
export class ReasoningPanel extends CanvasPanel {
  constructor(options) {
    super(0.62, 0.46, 1240, 920, { overlay: true });
    this.options = options; this.sig = ''; this.mesh.visible = false;
    this.shuffleOptions();
    this.hits = options.map((id, i) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.44, 0.056),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      const [x, y] = this.local(620, 272 + i * 132);
      m.position.set(x, y, 0.004); m.visible = true;
      m.userData.ia = { kind: 'target', id: 'dx', idx: i, dx: id, enabled: false, radius: 0.12 };
      this.mesh.add(m);
      return m;
    });
  }
  shuffleOptions() {
    this.symItems = shuffleArr(SYMPTOM_OPTIONS);
    this.dxItems = shuffleArr(this.options);
    this.txItems = shuffleArr(TX_OPTIONS);
    this.sig = '';
  }
  getRightIdx(step, isHypo) {
    if (step === 1) return Math.max(0, this.symItems.findIndex((o) => o.id === (isHypo ? 'sym_hypo' : 'sym_anaphylaxis')));
    if (step === 2) return Math.max(0, this.dxItems.indexOf(isHypo ? 'hypoglycaemia' : 'anaphylaxis'));
    return Math.max(0, this.txItems.findIndex((o) => o.id === (isHypo ? 'tx_glucose' : 'tx_adrenaline')));
  }
  draw(st, tr) {
    const sig = JSON.stringify(st);
    if (sig === this.sig) return;
    this.sig = sig;
    this.hits.forEach((h, i) => {
      h.userData.ia.dx = this.dxItems[i];
      if (st.step === 1) h.userData.ia.enabled = !(st.symWrong || []).includes(this.symItems[i].id);
      else if (st.step === 2) h.userData.ia.enabled = !st.wrong.includes(this.dxItems[i]);
      else if (st.step === 3) h.userData.ia.enabled = !(st.txWrong || []).includes(this.txItems[i].id);
      else h.userData.ia.enabled = false;
    });
    const { ctx, canvas: c } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    glass(ctx, 30, 30, c.width - 60, c.height - 60, 44);
    // step tabs
    const tw = 356, gap = 22, x0 = (c.width - (tw * 3 + gap * 2)) / 2;
    ['step_symptoms', 'step_dx', 'step_tx'].forEach((k, i) => {
      const n = i + 1, active = st.step === n, done = st.step > n, x = x0 + i * (tw + gap);
      glass(ctx, x, 64, tw, 104, 24, {
        stroke: active ? COLORS.cyan : 'rgba(140,190,205,0.35)', glow: active ? 24 : 0, lw: active ? 4 : 2,
        top: active ? 'rgba(20,90,105,0.75)' : 'rgba(40,64,76,0.55)', bottom: active ? 'rgba(10,54,66,0.8)' : 'rgba(22,40,50,0.6)',
      });
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = active ? '#a5f3fc' : done ? COLORS.ink : COLORS.mute; ctx.font = `700 30px ${FONT}`;
      ctx.fillText(`${n}. ${tr(k)}`, x + tw / 2, 102);
      ctx.font = `500 22px ${FONT}`; ctx.fillStyle = active ? '#67e8f9' : COLORS.mute;
      ctx.fillText(tr(active ? 'step_active' : done ? 'step_done' : 'step_locked'), x + tw / 2, 138);
    });
    glass(ctx, 70, 196, c.width - 140, c.height - 276, 30, { stroke: 'rgba(140,190,205,0.3)', glow: 0, lw: 2, top: 'rgba(10,28,38,0.55)', bottom: 'rgba(6,18,27,0.6)' });
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';

    const drawOptionRows = (items, wrongIds, hintText, pickedId = null, showFeedback = true) => {
      items.forEach(({ id, label }, i) => {
        const y = 272 + i * 132;
        const bad = showFeedback && (wrongIds || []).includes(id);
        const good = showFeedback && pickedId === id;
        const neutralSel = !showFeedback && pickedId === id;
        const hov = st.hoverIdx === i && !bad;
        glass(ctx, 130, y - 52, c.width - 260, 104, 30, {
          stroke: bad ? COLORS.incorrect : good ? COLORS.correct : (hov || neutralSel) ? COLORS.cyan : 'rgba(170,205,215,0.45)',
          glow: bad ? 10 : (hov || good || neutralSel) ? 20 : 0,
          lw: (hov || good || neutralSel) ? 4 : 3,
          top: bad ? 'rgba(70,22,34,0.6)' : good ? 'rgba(10,72,54,0.75)' : (hov || neutralSel) ? 'rgba(24,84,98,0.8)' : 'rgba(58,74,84,0.7)',
          bottom: bad ? 'rgba(46,14,24,0.65)' : good ? 'rgba(6,48,36,0.8)' : (hov || neutralSel) ? 'rgba(12,56,68,0.85)' : 'rgba(36,50,60,0.75)',
        });
        if (bad || good) tick(ctx, 186, y, 20, good);
        else { ctx.strokeStyle = (hov || neutralSel) ? COLORS.cyan : '#c5d6dd'; ctx.lineWidth = 3; rr(ctx, 167, y - 19, 38, 38, 8); ctx.stroke(); }
        ctx.globalAlpha = bad ? 0.5 : 1;
        ctx.fillStyle = COLORS.ink;
        ctx.font = `600 31px ${FONT}`;
        ctx.fillText(fit(ctx, label, c.width - 370), 232, y + 2);
        ctx.globalAlpha = 1;
      });
      ctx.textAlign = 'center'; ctx.fillStyle = COLORS.mute; ctx.font = `500 26px ${FONT}`;
      ctx.fillText(hintText, c.width / 2, 796);
    };

    if (st.step === 1) {
      drawOptionRows(this.symItems, st.symWrong, 'Select the presenting clinical symptoms observed', st.symPicked, st.txShowFeedback !== false);
    } else if (st.step === 2) {
      const dxItems = this.dxItems.map((id) => ({ id, label: tr('dx_' + id) }));
      drawOptionRows(dxItems, st.wrong, tr('step2_hint'), st.dxPicked, st.txShowFeedback !== false);
    } else if (st.step === 3) {
      drawOptionRows(this.txItems, st.txWrong, 'Select the immediate emergency treatment', st.txPicked, st.txShowFeedback !== false);
    } else {
      glass(ctx, 300, 232, c.width - 600, 70, 35, { stroke: COLORS.correct, glow: 16, top: 'rgba(8,60,46,0.75)', bottom: 'rgba(6,40,32,0.8)' });
      ctx.textAlign = 'center'; ctx.fillStyle = '#a7f3d0'; ctx.font = `700 28px ${FONT}`; ctx.fillText(`${tr('dx_' + st.dx).toUpperCase()}  -  ${tr('step3_go')}`, c.width / 2, 268);
      ctx.textAlign = 'left';
      st.feed.slice(-6).forEach((e, i) => {
        const y = 362 + i * 74;
        tick(ctx, 150, y, 19, e.sev === 'correct');
        ctx.fillStyle = COLORS.mute; ctx.font = '500 26px ui-monospace, Consolas, monospace'; ctx.fillText(e.clock, 190, y + 1);
        ctx.fillStyle = COLORS.ink; ctx.font = `500 30px ${FONT}`; ctx.fillText(fit(ctx, e.text, c.width - 440), 290, y + 1);
      });
      if (!st.feed.length) { ctx.textAlign = 'center'; ctx.fillStyle = COLORS.mute; ctx.font = `500 30px ${FONT}`; ctx.fillText(tr('step3_hint'), c.width / 2, 520); }
    }
    this.commit();
  }
}

// In-world result panel shown at the end of the scenario (with 3D hand-pinchable Replay & Exit buttons in VR/AR).
export class Debrief extends CanvasPanel {
  constructor() {
    super(0.86, 0.56, 1400, 910, { overlay: true });
    this.mesh.visible = false;
    const mkBtnHit = (id, cx, cy) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.28, 0.068),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      const [lx, ly] = this.local(cx, cy);
      m.position.set(lx, ly, 0.006);
      m.userData.ia = { kind: 'target', id, enabled: false, radius: 0.16 };
      this.mesh.add(m);
      return m;
    };
    this.replayHit = mkBtnHit('debrief_replay', 420, 810);
    this.exitHit = mkBtnHit('debrief_exit', 980, 810);
  }
  draw(score, tr, inXR) {
    const { ctx, canvas: c } = this;
    const ok = score.pass, col = ok ? COLORS.correct : COLORS.incorrect;
    ctx.clearRect(0, 0, c.width, c.height);
    glass(ctx, 30, 30, c.width - 60, c.height - 60, 44, { stroke: col });
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.ink; ctx.font = `700 46px ${FONT}`; ctx.fillText(tr('debrief_title').toUpperCase(), 90, 112);
    const outKey = (score.isHypo && score.outcome === 'arrest') ? 'hypo_out_arrest' : 'out_' + score.outcome;
    ctx.fillStyle = score.outcome === 'resolved' ? '#a7f3d0' : '#fda4af'; ctx.font = `500 32px ${FONT}`; ctx.fillText(tr(outKey), 90, 164);
    glass(ctx, c.width - 600, 74, 510, 110, 30, { stroke: col, glow: 20, top: 'rgba(12,44,54,0.8)', bottom: 'rgba(8,30,40,0.85)' });
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.ink; ctx.font = `800 40px ${FONT}`;
    ctx.fillText(`${tr('grade')} ${score.grade}  -  ${score.overall}%`, c.width - 345, 116);
    ctx.fillStyle = col; ctx.font = `700 24px ${FONT}`; ctx.fillText(tr(ok ? 'pass' : 'fail'), c.width - 345, 156);
    ['recognition', 'precision', 'sequence', 'communication'].forEach((id, i) => {
      const x = 90 + (i % 2) * 620, y = 228 + Math.floor(i / 2) * 242, val = score.domains[id];
      const dc = val >= 70 ? COLORS.correct : val >= 40 ? '#fbbf24' : COLORS.incorrect;
      glass(ctx, x, y, 590, 214, 28, { stroke: 'rgba(140,190,205,0.35)', glow: 0, lw: 2, top: 'rgba(40,64,76,0.6)', bottom: 'rgba(22,40,50,0.65)' });
      ctx.textAlign = 'left'; ctx.fillStyle = COLORS.mute; ctx.font = `600 28px ${FONT}`; ctx.fillText(tr('d_' + id), x + 30, y + 46);
      ctx.fillStyle = COLORS.ink; ctx.font = `800 72px ${FONT}`; ctx.fillText(`${score.grades[id]}`, x + 30, y + 120);
      ctx.font = '700 60px ui-monospace, Consolas, monospace'; ctx.fillText(`${val}%`, x + 110, y + 122);
      tick(ctx, x + 536, y + 116, 24, val >= 70);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + 30, y + 172, 530, 14, 7); ctx.fill();
      if (val > 0) { ctx.save(); ctx.shadowColor = dc; ctx.shadowBlur = 12; ctx.fillStyle = dc; rr(ctx, x + 30, y + 172, 5.3 * val, 14, 7); ctx.fill(); ctx.restore(); }
    });
    if (inXR) {
      this.replayHit.userData.ia.enabled = true;
      this.exitHit.userData.ia.enabled = true;
      glass(ctx, 190, 756, 460, 104, 28, { stroke: COLORS.cyan, glow: 18, lw: 4, top: 'rgba(14,116,144,0.85)', bottom: 'rgba(8,60,78,0.92)' });
      ctx.textAlign = 'center'; ctx.fillStyle = '#e6fbff'; ctx.font = `800 34px ${FONT}`;
      ctx.fillText('↻  REPLAY SCENARIO', 420, 810);

      glass(ctx, 750, 756, 460, 104, 28, { stroke: COLORS.incorrect, glow: 14, lw: 3, top: 'rgba(88,22,38,0.82)', bottom: 'rgba(54,12,24,0.90)' });
      ctx.fillStyle = '#fecdd3'; ctx.font = `800 34px ${FONT}`;
      ctx.fillText('✕  EXIT SESSION', 980, 810);
    } else {
      this.replayHit.userData.ia.enabled = false;
      this.exitHit.userData.ia.enabled = false;
    }
    this.commit(); this.mesh.visible = true;
  }
}
