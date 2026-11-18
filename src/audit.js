// Clinical performance audit dashboard, built from the engine log and score only.
import { t } from './i18n.js';
import { downloadAuditPdf } from './pdf.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clock = (s) => (s === null || s === undefined ? 'Missed'
  : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);
const dot = (ok) => `<span class="dot${ok ? '' : ' x'}">${ok ? '&#10003;' : '&#10005;'}</span>`;

// FNV-1a over the event log: the same performance always yields the same reference.
function auditRef(log) {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify(log)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'PS-' + h.toString(16).toUpperCase().padStart(8, '0');
}

export function renderReport(el, { engine, score, profile, patientLabel, onHome, onRedo, onReplay }) {
  const ti = score.times, f = engine.f;
  const refCode = auditRef(engine.log);
  const isHypo = engine?.sc?.diagnosis?.correct === 'hypoglycaemia';
  const outcomeKey = (isHypo && score.outcome === 'arrest') ? 'hypo_out_arrest' : 'out_' + score.outcome;
  const outcomeText = score.outcome ? t(outcomeKey) : t('r_not_done');
  const dxTime = ti.dx === null ? 'Missed' : `${ti.dx.toFixed(1)}s`;
  const adrTime = ti.adrenaline === null ? 'Missed' : `${ti.adrenaline.toFixed(1)}s`;

  const steps = isHypo ? [
    ['1. Palpate Radial Pulse', f.pulseAt],
    ['2. Inspect Oral Airway', f.airwayAt],
    ['3. Confirm Hypoglycaemia', f.dxAt],
    ['4. Summon Nurse Sarah (Emergency Services)', f.helpAt],
    ['5. Oral Glucose Gel (40%)', f.adrenalineAt],
  ] : [
    ['1. Palpate Radial Pulse', f.pulseAt],
    ['2. Inspect Oral Airway', f.airwayAt],
    ['3. Confirm Acute Anaphylaxis', f.dxAt],
    ['4. Summon Nurse Sarah (Emergency Services)', f.helpAt],
    ['5. Lay Chair Flat (Supine)', f.supineAt],
    ['6. IM Adrenaline 0.5mg', f.adrenalineAt],
    ['7. High-Flow O2 Mask', f.oxygenAt],
  ];

  const checklist = steps.map(([label, timeVal]) => `
    <li>${dot(timeVal !== null)}<span>${esc(label)}</span><time>${clock(timeVal)}</time></li>
  `).join('');

  el.innerHTML = `
  <article class="audit">
    <header class="a-head">
      <div class="a-title-wrap">
        <div>
          <h1>CLINICAL AUDIT</h1>
          <p>${esc(patientLabel)} &bull; ${esc(clock(score.duration))} &bull; Ref: ${esc(refCode)}</p>
        </div>
      </div>
      <div class="gradepill ${score.pass ? '' : 'bad'}">
        <span class="medal">${score.grade}</span>
        <span>${score.overall}%</span>
        <em>${esc(t(score.pass ? 'band_' + score.grade : 'fail'))}</em>
      </div>
    </header>

    <div class="a-cards a-cards-3">
      <section class="a-card">
        <h3>Time to Diagnose</h3>
        <div class="a-val"><span>${esc(dxTime)}</span><span class="g">Grade ${esc(score.grades.recognition)}</span></div>
      </section>
      <section class="a-card">
        <h3>${isHypo ? 'Oral Glucose Gel' : 'IM Adrenaline'}</h3>
        <div class="a-val"><span>${esc(adrTime)}</span><span class="g">Grade ${esc(score.grades.precision)}</span></div>
      </section>
      <section class="a-card">
        <h3>Outcome</h3>
        <div class="a-val"><span style="font-size:21px">${esc(outcomeText)}</span></div>
      </section>
    </div>

    <section class="a-panel">
      <h2>Protocol Checklist</h2>
      <ul class="step-grid">${checklist}</ul>
    </section>

    <footer class="a-foot">
      <span>Clinician: <b>${esc(profile.name || 'Guest')}</b></span>
      <div class="a-actions">
        <button id="btnHome" class="ghost">&#8962; Home</button>
        <button id="btnRedo" class="ghost">&#8635; Redo Simulation</button>
        <button id="btnPrint" class="export">&#11015; Download PDF</button>
      </div>
    </footer>
  </article>`;

  el.querySelector('#btnPrint').onclick = () => {
    downloadAuditPdf({
      title: engine.sc.title,
      patientLabel,
      learnerName: profile.name || 'Guest',
      outcomeText,
      durationText: clock(score.duration),
      grade: score.grade,
      overall: score.overall,
      dxTime,
      adrTime,
      steps: steps.map(([lbl, tv]) => [lbl, clock(tv), tv !== null]),
      refCode,
      domains: score.domains,
      grades: score.grades,
      guidelines: engine.sc.guidelines,
    });
  };
  el.querySelector('#btnHome').onclick = () => {
    if (typeof onHome === 'function') onHome();
    else if (typeof onReplay === 'function') onReplay();
    else location.reload();
  };
  el.querySelector('#btnRedo').onclick = () => {
    if (typeof onRedo === 'function') onRedo();
    else if (typeof onReplay === 'function') onReplay();
    else location.reload();
  };
  el.hidden = false;
}
