// Pure client-side PDF 1.4 generator (zero external dependencies).
// Renders a crisp A4 Clinical Audit Report onto an offscreen canvas and wraps the JPEG stream in a valid PDF binary.

export function downloadAuditPdf({
  title,
  patientLabel,
  learnerName,
  outcomeText,
  durationText,
  grade,
  overall,
  dxTime,
  adrTime,
  steps,
  refCode,
  domains = null,
  grades = null,
  guidelines = null,
}) {
  const W = 1240, H = 1754; // A4 @ 150 DPI
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  const fitFont = (text, maxW, maxPx, weight = 800, family = 'system-ui, sans-serif') => {
    let px = maxPx;
    while (px > 11) {
      ctx.font = `${weight} ${px}px ${family}`;
      if (ctx.measureText(text).width <= maxW) break;
      px -= 1;
    }
    return px;
  };

  // Clean white A4 page
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Header band
  ctx.fillStyle = '#0d1b2a';
  ctx.fillRect(0, 0, W, 210);
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(0, 210, W, 6);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 44px system-ui, -apple-system, sans-serif';
  ctx.fillText('P.E.A.R.L.  CLINICAL AUDIT', 70, 88);
  ctx.fillStyle = '#a5f3fc';
  ctx.font = '600 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(title.toUpperCase(), 70, 134);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 20px ui-monospace, Consolas, monospace';
  ctx.fillText(`Ref: ${refCode}   |   Date: ${new Date().toISOString().slice(0, 10)}`, 70, 174);

  // Grade badge in header
  const pass = grade !== 'F';
  ctx.fillStyle = pass ? '#10b981' : '#f43f5e';
  ctx.beginPath();
  ctx.roundRect(W - 310, 48, 240, 114, 18);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  fitFont(`${grade}  (${overall}%)`, 204, 46, 900);
  ctx.fillText(`${grade}  (${overall}%)`, W - 190, 112);
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText(pass ? 'COMPETENT' : 'REFER', W - 190, 145);
  ctx.textAlign = 'left';

  // Learner & Patient metadata card
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(70, 260, W - 140, 136, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.fillText('CLINICIAN', 105, 304);
  ctx.fillText('PATIENT COHORT', 520, 304);
  ctx.fillText('TOTAL TIME', 960, 304);

  ctx.fillStyle = '#0f172a';
  fitFont(learnerName || 'Clinician', 380, 26, 800);
  ctx.fillText(learnerName || 'Clinician', 105, 346);
  fitFont(patientLabel, 410, 26, 800);
  ctx.fillText(patientLabel, 520, 346);
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.fillText(durationText, 960, 346);

  // 3 Key Metrics row
  const isHypo = /hypoglycaemia/i.test(title || '') || steps.some(([lbl]) => /glucose/i.test(lbl));
  const metrics = [
    ['TIME TO DIAGNOSE', dxTime],
    [isHypo ? 'ORAL GLUCOSE GEL' : 'IM ADRENALINE', adrTime],
    ['CLINICAL OUTCOME', outcomeText],
  ];
  const mw = (W - 140 - 48) / 3;
  metrics.forEach(([lbl, val], i) => {
    const mx = 70 + i * (mw + 24);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.roundRect(mx, 424, mw, 126, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(lbl, mx + 26, 464);
    ctx.fillStyle = '#0f172a';
    fitFont(val, mw - 52, 34, 900);
    ctx.fillText(val, mx + 26, 518);
  });

  // 7-Step Checklist
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.fillText('PROTOCOL CHECKLIST', 70, 598);

  steps.forEach(([label, timeStr, done], i) => {
    const sy = 624 + i * 80;
    ctx.fillStyle = done ? '#f0fdf4' : '#fff1f2';
    ctx.strokeStyle = done ? '#86efac' : '#fecdd3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(70, sy, W - 140, 68, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = done ? '#10b981' : '#f43f5e';
    ctx.beginPath();
    ctx.arc(114, sy + 34, 17, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillText(done ? '✓' : '✕', 114, sy + 41);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(label, 152, sy + 42);

    ctx.fillStyle = done ? '#047857' : '#be123c';
    ctx.textAlign = 'right';
    ctx.font = '700 22px ui-monospace, Consolas, monospace';
    ctx.fillText(timeStr, W - 105, sy + 42);
    ctx.textAlign = 'left';
  });

  // Competency Domains Breakdown (2x2 grid)
  if (domains && grades) {
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText('CLINICAL COMPETENCY DOMAINS', 70, 1236);

    const domList = [
      ['RECOGNITION', domains.recognition, grades.recognition],
      ['PRECISION', domains.precision, grades.precision],
      ['SEQUENCE', domains.sequence, grades.sequence],
      ['COMMUNICATION', domains.communication, grades.communication],
    ];
    const dw = (W - 140 - 24) / 2;
    domList.forEach(([lbl, val, g], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const dx = 70 + col * (dw + 24), dy = 1262 + row * 124;
      const pct = Math.max(0, Math.min(100, Number(val) || 0));
      const barCol = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#f43f5e';

      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(dx, dy, dw, 106, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillText(lbl, dx + 24, dy + 36);

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'right';
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.fillText(`${pct}%  (Grade ${g || '-'})`, dx + dw - 24, dy + 38);
      ctx.textAlign = 'left';

      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(dx + 24, dy + 64, dw - 48, 16, 8);
      ctx.fill();

      if (pct > 0) {
        ctx.fillStyle = barCol;
        ctx.beginPath();
        ctx.roundRect(dx + 24, dy + 64, Math.max(16, (dw - 48) * (pct / 100)), 16, 8);
        ctx.fill();
      }
    });
  }

  // Guideline Reference & Footer
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.roundRect(70, H - 156, W - 140, 62, 12);
  ctx.fill();
  const guideText = Array.isArray(guidelines) && guidelines.length
    ? `Guidelines: ${guidelines.slice(0, 2).join('  •  ')}`
    : 'Aligned to Resuscitation Council UK & BNF Emergency Guidelines';
  ctx.fillStyle = '#334155';
  fitFont(guideText, W - 208, 17, 600);
  ctx.fillText(guideText, 94, H - 119);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText('Generated by P.E.A.R.L. Universal Acute Healthcare Simulation', 70, H - 56);

  // Convert canvas to JPEG bytes and wrap in a valid PDF 1.4 document
  const dataUrl = c.toDataURL('image/jpeg', 0.92);
  const b64 = dataUrl.split(',')[1];
  const binStr = atob(b64);
  const imgBytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) imgBytes[i] = binStr.charCodeAt(i);

  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let len = 0;
  const pushStr = (s) => {
    const b = enc.encode(s);
    chunks.push(b);
    len += b.length;
  };
  const pushBytes = (b) => {
    chunks.push(b);
    len += b.length;
  };

  // PDF Header
  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
  // 1: Catalog
  offsets.push(len);
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  // 2: Pages
  offsets.push(len);
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  // 3: Page (A4 in points: 595 x 842)
  offsets.push(len);
  pushStr('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
  // 4: Image XObject
  offsets.push(len);
  pushStr(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`);
  pushBytes(imgBytes);
  pushStr('\nendstream\nendobj\n');
  // 5: Content stream drawing image full-page
  const content = 'q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n';
  offsets.push(len);
  pushStr(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

  // Cross-reference table
  const xrefOffset = len;
  pushStr(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
  for (const off of offsets) {
    pushStr(String(off).padStart(10, '0') + ' 00000 n \n');
  }
  pushStr(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  // Merge chunks and encode as base64 data URI (avoids blob URL revocation / "Interrupted" download errors in embedded webviews)
  const pdfBytes = new Uint8Array(len);
  let pos = 0;
  for (const ch of chunks) {
    pdfBytes.set(ch, pos);
    pos += ch.length;
  }
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < pdfBytes.length; i += step) {
    bin += String.fromCharCode(...pdfBytes.subarray(i, i + step));
  }
  const url = 'data:application/pdf;base64,' + btoa(bin);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PEARL-Clinical-Audit-${refCode}.pdf`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1500);
  return len;
}
