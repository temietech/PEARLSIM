import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ClinicalEngine } from './engine.js';
import { anaphylaxis, hypoglycaemia } from './scenario-anaphylaxis.js';
import { buildWorld } from './world.js';
import { Monitor, Toast, Debrief, StartCard, ReasoningPanel, makeLabel, drawEcgWaveform } from './ui.js';
import { setLang, getLang, setPatientName, t } from './i18n.js';
import { renderReport } from './audit.js';
import { XRManager } from './xr/XRManager.js';
import { SoundManager } from './audio/SoundManager.js';
import { VoiceService } from './audio/VoiceService.js';

const voiceService = new VoiceService();

// Fill these in once a CPD provider has approved the activity.
const CPD = { hours: 0.25, provider: '', accreditationRef: '' };
const BODY_SITES = ['thigh', 'deltoid', 'abdomen'];
const PULSE_SECONDS = 3;

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);

const scene = new THREE.Scene();
const BG = new THREE.Color(0xeef0ee);
scene.background = BG;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.68;

function applyLightingProfile(isAR) {
  renderer.toneMappingExposure = isAR ? 0.95 : 0.88;
  scene.environmentIntensity = isAR ? 0.84 : 0.68;
}

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.03, 30);
camera.rotation.order = 'YXZ';
// Authentic chairside clinician operator perspective (9 to 11 o'clock chairside POV, patient's right-hand side)
camera.position.set(-0.48, 1.38, -0.22);
camera.lookAt(0.08, 0.92, -0.72);
scene.add(camera);
// Keep the bracket table (right) and emergency cart (facing) in frame on narrow windows.
function fitCamera() {
  camera.aspect = innerWidth / innerHeight;
  const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(48)) / camera.aspect);
  camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(v), 58, 86);
  camera.updateProjectionMatrix();
}
fitCamera();
const deskHolder = new THREE.Group();
deskHolder.position.set(0.16, -0.13, -0.36); deskHolder.rotation.set(0.38, -0.22, -0.18);
camera.add(deskHolder);

// Clean surgical instrument holder group (zero primitive cylinder fingers)
const deskGlove = new THREE.Group();
deskGlove.visible = false;
deskHolder.add(deskGlove);

let engine = new ClinicalEngine(anaphylaxis);
const bindEngineEvents = () => {
  engine.on((ev) => {
    if (ev.type === 'phase') {
      const sev = ev.phase === 'arrest' ? 'incorrect' : ev.phase === 'recovering' || ev.phase === 'resolved' ? 'correct' : 'neutral';
      notify('phase_' + ev.phase, sev);
    } else if (ev.type === 'end') finish();
  });
};
bindEngineEvents();
// mode: 'landing' -> 'ready' (in the operatory, calm) -> 'running' -> 'ended'
const S = {
  mode: 'landing', paused: false, time: 0, hold: null, mirrorUntil: 0, quizCooldownUntil: 0, pulseCooldown: 0,
  beat: 0, monitorClock: 0, hudClock: 0, mirrorClock: 0, score: null, profile: null, fps: 0,
  feed: [], dxWrong: [], symDone: false, symWrong: [], symPicked: null, dxPicked: null, txPicked: null, txWrong: [], hoverDx: null, hoverIdx: null, hoveredObj: null, pulseShown: null,
  hintToastUntil: 0, hintToastHtml: '',
};
const running = () => S.mode === 'running';
let world = null, monitor, toast, debrief, startCard, reasoning, mirrorPanel, ring, guideRing = null, hoverRing = null;
const sound = new SoundManager();
let xrStarting = false, activeXRSession = null, reportTimer = null;

function stopAudioAndSpeech(closeCtx = false) {
  voiceService.stop();
  if (closeCtx) sound.dispose();
  else sound.suspend();
}

// hands[0], hands[1] are XR inputs; hands[2] is the mouse.
const hands = [
  { i: 0, xr: true, held: null, connected: false, gamepad: null },
  { i: 1, xr: true, held: null, connected: false, gamepad: null },
  { i: 2, xr: false, held: null },
];
const controllers = [], grips = [], xrHands = [];
const raycaster = new THREE.Raycaster();
raycaster.far = 5;
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), toastGoal = new THREE.Vector3(), m4 = new THREE.Matrix4(), q1 = new THREE.Quaternion();
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------- feedback ----------
function beep(freq, dur = 0.07, gain = 0.05, delay = 0) {
  if (S.paused || S.mode === 'ended') return;
  sound.beep(freq, dur, gain, delay);
}
function playHoverTick() {
  if (S.paused || S.mode === 'ended') return;
  sound.playHoverTick();
}
function playConfirmChime() {
  if (S.paused || S.mode === 'ended') return;
  sound.playConfirmChime();
}
function flashHintToast(html, dur = 1.6) {
  if (S.profile?.difficulty === 'hard') return;
  S.hintToastUntil = S.time + dur;
  S.hintToastHtml = html;
  const el = $('hint');
  if (el) { el.innerHTML = html; el.hidden = false; }
}
function haptic(hand, strength = 0.5, ms = 50) {
  try { hand?.gamepad?.hapticActuators?.[0]?.pulse(strength, ms); } catch { /* not supported */ }
}
function say(text) {
  if (S.paused || S.mode === 'ended') return;
  voiceService.speak(text, {
    patientKey: S.profile?.patientKey || 'adebayo',
    phase: engine?.phase || 'prodrome',
    isHypo: engine?.sc?.diagnosis?.correct === 'hypoglycaemia',
    lang: getLang(),
  });
}
function notify(key, severity = 'neutral', params) {
  const isHypo = engine?.sc?.diagnosis?.correct === 'hypoglycaemia';
  const mappedKey = (isHypo && ['opening', 'phase_established', 'phase_severe', 'phase_recovering', 'phase_arrest', 'fb_airway'].includes(key))
    ? 'hypo_' + key
    : key;
  const text = t(mappedKey, params);
  toast.show(text, severity);
  if (severity === 'correct') beep(880, 0.09); else if (severity === 'incorrect') beep(180, 0.25, 0.08);
  say(text);
  return text;
}
function doAct(type, p) {
  S.lastActionAt = S.time;
  const r = engine.act(type, p);
  if (!r) return null;
  const text = notify(r.key, r.severity, r.params);
  if (r.severity !== 'neutral') S.feed.push({ clock: mmss(engine.t), text, sev: r.severity });
  updateClinicalHud();
  return r;
}

// ---------- tools ----------
const isHeld = (tool) => hands.some((h) => h.held === tool);
let xrManager = null;
const toolAnims = new Map();

function animateToolTo(tool, parent, targetPos, targetQuat, speed = 12) {
  if (!tool || !parent) return;
  tool.updateMatrixWorld(true);
  parent.updateMatrixWorld(true);
  const wPos = new THREE.Vector3(), wQuat = new THREE.Quaternion();
  tool.getWorldPosition(wPos);
  tool.getWorldQuaternion(wQuat);
  parent.add(tool);
  parent.worldToLocal(wPos);
  const pQuat = new THREE.Quaternion();
  parent.getWorldQuaternion(pQuat);
  wQuat.premultiply(pQuat.invert());
  tool.position.copy(wPos);
  tool.quaternion.copy(wQuat);
  toolAnims.set(tool, {
    pos: targetPos.clone(),
    quat: targetQuat.clone(),
    speed,
  });
}

function updateToolAnimations(dt) {
  for (const [tool, anim] of toolAnims) {
    const k = 1 - Math.exp(-dt * anim.speed);
    tool.position.lerp(anim.pos, k);
    tool.quaternion.slerp(anim.quat, k);
    if (tool.position.distanceTo(anim.pos) < 0.0015 && tool.quaternion.angleTo(anim.quat) < 0.01) {
      tool.position.copy(anim.pos);
      tool.quaternion.copy(anim.quat);
      toolAnims.delete(tool);
    }
  }
}

function anchor(hand) {
  if (xrManager) return xrManager.getAnchor(hand);
  const j = xrHands[hand.i]?.joints?.['index-finger-tip'];
  return xrHands[hand.i]?.visible && j ? j : grips[hand.i];
}
function grab(hand, tool) {
  if (hand.held) release(hand);
  for (const h of hands) if (h.held === tool) h.held = null;
  hand.held = tool;
  const targetParent = hand.xr ? anchor(hand) : deskHolder;
  animateToolTo(tool, targetParent, new THREE.Vector3(0, hand.xr ? -0.04 : 0, 0), new THREE.Quaternion(), 16);
  if (!hand.xr) deskGlove.visible = true;
  const tKind = tool.userData?.ia?.tool;
  const diff = S.profile?.difficulty || 'easy';
  const showRings = diff === 'easy';
  if (diff === 'hard') {
    // Hard mode: no hints or prompts
  } else if (tKind === 'injector') {
    if (showRings && world?.patient?.thighRing) world.patient.thighRing.visible = true;
    flashHintToast('<b>&#10003; HOLDING ADRENALINE 1:1000</b> &bull; Click &amp; hold patient\'s anterolateral thigh (10s) &bull; Right-click or Q to put down', 1.8);
  } else if (tKind === 'mirror') {
    if (showRings && world?.patient?.mouthRing) world.patient.mouthRing.visible = true;
    flashHintToast('<b>&#10003; HOLDING MOUTH MIRROR</b> &bull; Click patient\'s mouth to inspect airway &bull; Right-click or Q to put down', 1.8);
  } else if (tKind === 'mask') {
    if (showRings && world?.patient?.mouthRing) world.patient.mouthRing.visible = true;
    flashHintToast('<b>&#10003; HOLDING HIGH-FLOW O2 MASK</b> &bull; Click patient\'s face/mouth to apply 15 L/min &bull; Right-click or Q to put down', 1.8);
  } else {
    flashHintToast(`<b>&#10003; HOLDING ${tool.userData?.ia?.drug?.toUpperCase() || 'TOOL'}</b> &bull; Click patient to administer &bull; Right-click or Q to put down`, 1.8);
  }
  haptic(hand, 0.4, 30); playConfirmChime();
}
function release(hand) {
  if (S.hold && S.hold.hand === hand) finishHold(false);
  const tool = hand.held;
  if (!tool) return;
  hand.held = null;
  if (!hand.xr) deskGlove.visible = false;
  if (world?.patient?.thighRing) world.patient.thighRing.visible = false;
  if (world?.patient?.mouthRing) world.patient.mouthRing.visible = false;
  if (S.time >= S.hintToastUntil) $('hint').textContent = t('hint_controls');
  const h = tool.userData.home;
  animateToolTo(tool, h.parent, h.position, h.quaternion, 12);
}
function consume(hand) {
  const tool = hand.held;
  if (!tool) return;
  toolAnims.delete(tool);
  hand.held = null; tool.userData.ia.enabled = false; tool.removeFromParent();
  if (!hand.xr) deskGlove.visible = false;
  if (world?.patient?.thighRing) world.patient.thighRing.visible = false;
  if (world?.patient?.mouthRing) world.patient.mouthRing.visible = false;
  if (S.time >= S.hintToastUntil) $('hint').textContent = t('hint_controls');
}
function placeMask(hand) {
  const mask = hand.held;
  hand.held = null; mask.userData.ia.enabled = false;
  if (!hand.xr) deskGlove.visible = false;
  if (world?.patient?.mouthRing) world.patient.mouthRing.visible = false;
  animateToolTo(mask, world.patient.maskMount, new THREE.Vector3(0, 0, 0), new THREE.Quaternion(), 11);
  playConfirmChime();
  flashHintToast('<b>&#10003; APPLIED:</b> High-Flow O2 Mask (15 L/min)', 1.8);
  doAct('oxygen');
}
function inspectAirway() {
  S.mirrorUntil = Infinity;
  if (world?.patient?.mouthRing) world.patient.mouthRing.visible = false;
  playConfirmChime();
  flashHintToast('<b>ORAL VIEW OPEN:</b> Inspect airway findings, then click <b>Next</b> to open quiz', 3.0);
  if (engine.f.airwayAt === null) doAct('inspect_airway');
  if (engine.sc.diagnosis.correct === 'anaphylaxis') {
    say('"Airway inspected: severe pharyngeal angioedema and uvular swelling detected."');
  } else {
    say('"Airway inspected: oral airway is clear with no swelling."');
  }
}

// ---------- holds: radial pulse and auto-injector depot ----------
function startHold(type, hand, zoneObj) {
  if (S.hold) return;
  S.hold = {
    type, hand, zoneObj, t: 0, buzz: 0,
    need: type === 'pulse' ? PULSE_SECONDS : engine.sc.adrenaline.holdSeconds,
  };
  playConfirmChime();
  if (type === 'pulse') {
    flashHintToast('<b>&#10003; TOUCH REGISTERED:</b> Palpating radial pulse (hold 3s)&hellip;', 1.6);
  } else if (type === 'inject') {
    haptic(hand, 1, 80);
    flashHintToast('<b>&#10003; INJECTION STARTED:</b> Holding IM Adrenaline 0.5mg in thigh (10s)&hellip;', 1.8);
    if (hand.held && world?.patient?.root) {
      // Smoothly glide the auto-injector onto the lateral thigh surface at a 90-degree IM angle
      const thighLocal = zoneObj.position.clone().add(new THREE.Vector3(-0.02, 0.065, 0.01));
      const injQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.22, 0, 0.35));
      animateToolTo(hand.held, world.patient.root, thighLocal, injQuat, 14);
    }
  }
}
function beginInject(hand, zoneObj) {
  const site = zoneObj.userData.ia.site;
  if (engine.sc.adrenaline.validSites.includes(site)) startHold('inject', hand, zoneObj);
  else { doAct('inject', { site, held: 0 }); haptic(hand, 1, 200); }
}
function finishHold(done) {
  const h = S.hold;
  if (!h) return;
  S.hold = null; ring.visible = false;
  if (h.type === 'pulse') {
    if (done) { const r = doAct('assess_pulse'); if (r && S.pulseShown === null) S.pulseShown = r.params.hr; S.pulseCooldown = S.time + 5; } else toast.ttl = 0;
  } else {
    doAct('inject', { site: h.zoneObj.userData.ia.site, held: done ? h.need : h.t });
    consume(h.hand);
  }
}
function updateHold(dt) {
  const h = S.hold;
  if (!h) return;
  if (h.hand.xr && h.type === 'pulse' && h.byProximity && !near(handPos(h.hand), h.zoneObj, 0.12)) { finishHold(false); return; }
  h.t += dt;
  const frac = Math.min(1, h.t / h.need);
  toast.show(t(h.type === 'pulse' ? 'hold_pulse' : 'hold_inject', { s: Math.ceil(h.need - h.t) }), 'neutral', 0.4, frac);
  const step = Math.max(1, Math.round(frac * 48));
  if (ring.userData.step !== step || ring.userData.holdType !== h.type) {
    ring.userData.step = step;
    ring.userData.holdType = h.type;
    ring.geometry.setDrawRange(0, step * 6);
    ring.material.color.setHex(h.type === 'inject' ? 0x34d399 : 0x67e8f9);
  }
  h.zoneObj.getWorldPosition(ring.position);
  if (h.type === 'inject') ring.position.y += 0.05;
  camera.getWorldPosition(v1); ring.lookAt(v1); ring.visible = true;
  if (h.type === 'inject') { h.buzz -= dt; if (h.buzz <= 0) { h.buzz = 0.5; haptic(h.hand, 0.3, 60); } }
  if (h.t >= h.need) finishHold(true);
}

// ---------- shared actions ----------
function startCheckup() {
  if (S.mode !== 'ready') return;
  S.mode = 'running';
  S.startCooldownUntil = S.time + 0.35;
  S.lastActionAt = S.time;
  S.mediumRevealed = new Set();
  startCard.mesh.visible = false; startCard.mesh.userData.ia.enabled = false;
  if ($('hint')) $('hint').hidden = renderer.xr.isPresenting || S.profile?.difficulty === 'hard';
  if ($('clinicalHud')) $('clinicalHud').hidden = renderer.xr.isPresenting;
  updateClinicalHud();
  reasoning.mesh.visible = true;
  engine.start();
  playConfirmChime();
  flashHintToast('<b>&#10003; SESSION STARTED:</b> Assess the patient', 1.6);
  notify('opening');
}
function activate(obj) {
  const ia = obj.userData.ia;
  if (ia.id === 'start') startCheckup();
  else if (ia.id === 'assistant') {
    world.assistant?.userData?.nod?.();
    say('"Nurse Sarah: Calling emergency services now! Resuscitation kit and oxygen ready."');
    playConfirmChime();
    flashHintToast('<b>&#10003; ACTIVATED:</b> Summoning Nurse Sarah (Calling Emergency Services)', 1.8);
    doAct('call_help');
  }
  else if (ia.id === 'recline') {
    world.patient.setSupine();
    playConfirmChime();
    flashHintToast('<b>&#10003; ACTIVATED:</b> Dental Chair Laid Flat (Supine)', 1.8);
    doAct('position_supine');
  }
  else if (ia.id === 'boxlid') {
    if (world.openBox()) doAct('open_drug_box');
    playConfirmChime();
    flashHintToast('<b>&#10003; OPENED:</b> Emergency Resuscitation Drug Box', 1.8);
    // Straight-on close overhead view of the open emergency resuscitation drug box (all 7 compartments clearly visible)
    setCamStep('zoom_box_' + S.time.toFixed(2), [0.06, 1.36, -0.26], [0.66, 0.96, -0.26], 0.88);
  }
  else if (ia.id === 'dx') {
    if (S.time < (S.quizCooldownUntil || 0)) return;
    S.quizCooldownUntil = S.time + 0.18;
    const f = engine.f;
    const step = !S.symDone ? 1 : f.dxAt === null ? 2 : !S.txPicked ? 3 : 4;
    const idx = ia.idx ?? 0;
    const isEasy = S.profile?.difficulty === 'easy';
    const isHypo = engine.sc.diagnosis.correct === 'hypoglycaemia';
    const rightSymId = isHypo ? 'sym_hypo' : 'sym_anaphylaxis';
    const rightTxId = isHypo ? 'tx_glucose' : 'tx_adrenaline';
    if (step === 1) {
      const sid = reasoning?.symItems?.[idx]?.id || rightSymId;
      if (sid === rightSymId || !isEasy) {
        S.symPicked = sid;
        playConfirmChime();
        if (isEasy) {
          S.quizCooldownUntil = S.time + 0.90;
          flashHintToast('<b>&#10003; CORRECT SYMPTOMS:</b> Moving to Differential Diagnosis...', 1.5);
          setTimeout(() => { if (running() && S.symPicked === sid) S.symDone = true; }, 750);
        } else {
          S.symDone = true;
          flashHintToast('<b>&#10003; SYMPTOMS LOGGED:</b> Proceed to Differential Diagnosis', 1.6);
        }
      } else {
        if (!S.symWrong.includes(sid)) S.symWrong.push(sid);
        sound.beep(260, 0.12, 0.05);
        flashHintToast(isHypo ? '<b>&#10005; Not quite:</b> Patient has sweating, tremor &amp; clear airway' : '<b>&#10005; Not quite:</b> Patient reported throat tightness, swelling &amp; weak rapid pulse', 2.2);
      }
    } else if (step === 2) {
      if (isEasy && ia.dx === engine.sc.diagnosis.correct) {
        S.dxPicked = ia.dx;
        S.quizCooldownUntil = S.time + 0.90;
        playConfirmChime();
        flashHintToast('<b>&#10003; CORRECT DIAGNOSIS:</b> Moving to Treatment...', 1.5);
        setTimeout(() => { if (running() && S.dxPicked === ia.dx) doAct('diagnose', { id: ia.dx }); }, 750);
      } else {
        const r = doAct('diagnose', { id: ia.dx });
        if (r?.severity === 'incorrect') {
          S.dxWrong.push(ia.dx);
          sound.beep(260, 0.12, 0.05);
        } else {
          playConfirmChime();
          flashHintToast('<b>&#10003; CONFIRMED:</b> Working Diagnosis — now select Treatment', 1.8);
        }
      }
    } else if (step === 3) {
      const tid = reasoning?.txItems?.[idx]?.id || rightTxId;
      if (!isEasy) {
        // Medium & Hard modes: no immediate green/red feedback on treatment selection
        S.txPicked = tid;
        playConfirmChime();
        flashHintToast('<b>TREATMENT SELECTED:</b> Proceed to manage emergency &amp; open the drug box', 1.8);
      } else if (tid === rightTxId) {
        S.txPicked = tid;
        S.quizCooldownUntil = S.time + 0.90;
        playConfirmChime();
        flashHintToast(isHypo ? '<b>&#10003; CORRECT TREATMENT:</b> Oral Glucose Gel / Dextrose 40%' : '<b>&#10003; CORRECT TREATMENT:</b> IM Adrenaline 0.5mg + High-Flow O2', 1.8);
      } else {
        if (!S.txWrong.includes(tid)) S.txWrong.push(tid);
        sound.beep(260, 0.12, 0.05);
        flashHintToast(isHypo ? '<b>&#10005; Incorrect:</b> First-line treatment for hypoglycaemia is Oral Glucose Gel' : '<b>&#10005; Incorrect:</b> First-line treatment for anaphylaxis is IM Adrenaline 0.5mg + High-Flow O2', 2.4);
      }
    }
  }
  else if (ia.id === 'debrief_replay') {
    playConfirmChime();
    resetSession({ toLanding: false });
  }
  else if (ia.id === 'debrief_exit') {
    playConfirmChime();
    (renderer.xr.getSession() || activeXRSession)?.end();
  }
}
function useToolOn(hand, zoneObj) {
  const tool = hand.held.userData.ia, site = zoneObj.userData.ia?.site;
  const isMouthTarget = site === 'mouth' || zoneObj === world.patient.headMesh || zoneObj === world.patient.teethMesh;
  if (tool.tool === 'injector' && BODY_SITES.includes(site)) beginInject(hand, zoneObj);
  else if (tool.tool === 'mirror' && isMouthTarget) { inspectAirway(2.4); release(hand); }
  else if (tool.tool === 'mask' && isMouthTarget) placeMask(hand);
  else if (tool.tool === 'oral' && isMouthTarget) { doAct('drug', { id: tool.drug }); consume(hand); }
  else notify('fb_no_effect');
}
function pickFrom(rc, hand = hands[2]) {
  const hits = rc.intersectObjects(world.pickables, true);
  if (S.mode === 'ready') {
    for (const hit of hits) {
      let o = hit.object; while (o && !o.userData.ia) o = o.parent;
      if (o?.userData?.ia?.id === 'start' && o.visible) return o;
    }
    return null;
  }
  const heldTool = hand?.held?.userData?.ia?.tool;
  if (heldTool === 'injector') {
    for (const hit of hits) {
      let o = hit.object; while (o && !o.userData.ia) o = o.parent;
      if (o?.userData?.ia?.enabled && BODY_SITES.includes(o.userData.ia.site)) return o;
    }
  } else if (heldTool === 'mirror' || heldTool === 'mask' || heldTool === 'oral') {
    for (const hit of hits) {
      let o = hit.object; while (o && !o.userData.ia) o = o.parent;
      if (o?.userData?.ia?.enabled && o.userData.ia.site === 'mouth') return o;
    }
  } else if (!heldTool) {
    // Prioritize the current scenario's definitive drug if ray intersects overlapping drug-box tool colliders
    const isHypo = engine?.sc?.diagnosis?.correct === 'hypoglycaemia';
    for (const hit of hits) {
      let o = hit.object; while (o && !o.userData.ia) o = o.parent;
      const ia = o?.userData?.ia;
      if (ia?.enabled && ia.kind === 'tool' && !isHeld(o) && (isHypo ? ia.drug === 'glucose' : ia.tool === 'injector')) return o;
    }
    // When hand is empty, prioritize targets/tools and the radial wrist zone over thigh/abdomen zones so wrist clicks never fail!
    for (const hit of hits) {
      let o = hit.object; while (o && !o.userData.ia) o = o.parent;
      if (!o || !o.userData.ia.enabled) continue;
      if (o.userData.ia.kind === 'target' || (o.userData.ia.kind === 'tool' && !isHeld(o)) || o.userData.ia.site === 'wrist') return o;
    }
  }
  for (const hit of hits) {
    let o = hit.object;
    while (o && !o.userData.ia) o = o.parent;
    if (!o || !o.userData.ia.enabled) continue;
    if (o.userData.ia.kind === 'tool' && isHeld(o)) continue;
    return o;
  }
  return null;
}

function setHoveredTarget(obj) {
  if (S.hoveredObj === obj) return;
  const prev = S.hoveredObj;
  if (prev && (prev.userData?.ia?.kind === 'tool' || prev.userData?.ia?.id === 'recline') && !isHeld(prev)) {
    prev.scale.setScalar(1.0);
  }
  S.hoveredObj = obj || null;
  if (obj && (obj.userData?.ia?.kind === 'tool' || obj.userData?.ia?.id === 'recline') && !isHeld(obj)) {
    obj.scale.setScalar(1.14);
  }
  if (obj && obj.userData?.ia?.enabled) {
    playHoverTick();
  }
  S.hoverDx = obj?.userData?.ia?.id === 'dx' ? obj.userData.ia.dx : null;
  S.hoverIdx = obj?.userData?.ia?.id === 'dx' ? (obj.userData.ia.idx ?? null) : null;
}

function updateHoverVisuals() {
  if (!world || !hoverRing) return;
  if (S.mode === 'ended' || S.paused || S.time < S.mirrorUntil) {
    hoverRing.visible = false;
    if (world.patient.wristRing) world.patient.wristRing.visible = false;
    if (world.patient.mouthRing) world.patient.mouthRing.visible = false;
    if (world.patient.thighRing) world.patient.thighRing.visible = false;
    return;
  }
  const obj = S.hoveredObj;
  const ia = obj?.userData?.ia;
  const heldTool = hands.find((h) => h.held)?.held?.userData?.ia?.tool;
  const easy = S.profile?.difficulty === 'easy';

  if (world.patient.wristRing) {
    world.patient.wristRing.visible = running() && (ia?.site === 'wrist' || S.hold?.type === 'pulse' || (easy && engine.f.pulseAt === null));
  }
  if (world.patient.mouthRing) {
    world.patient.mouthRing.visible = running() && (ia?.site === 'mouth' || heldTool === 'mirror' || heldTool === 'mask');
  }
  if (world.patient.thighRing) {
    world.patient.thighRing.visible = running() && (ia?.site === 'thigh' || S.hold?.type === 'inject' || heldTool === 'injector');
  }

  if (!S.hold && obj && ia?.enabled && obj !== startCard?.mesh && ia?.id !== 'dx' && !isHeld(obj)) {
    obj.updateMatrixWorld(true);
    obj.getWorldPosition(hoverRing.position);
    if (obj === world.assistantHit) hoverRing.position.y += 0.28;
    else if (obj === world.lid) { hoverRing.position.x -= 0.11; hoverRing.position.y -= 0.01; }
    else if (obj?.userData?.ia?.id === 'mirror') { hoverRing.position.x += 0.10; hoverRing.position.y += 0.01; }
    else hoverRing.position.y += 0.03;
    camera.getWorldPosition(v1);
    hoverRing.lookAt(v1);
    const pulse = 1.0 + Math.sin(S.time * 8) * 0.08;
    hoverRing.scale.setScalar(pulse);
    hoverRing.visible = true;
  } else {
    hoverRing.visible = false;
  }
}

// ---------- desktop input ----------
let down = null, lastHoverMs = 0;
const mouse = new THREE.Vector2();
function pickMouse(e) {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  return pickFrom(raycaster);
}
canvas.addEventListener('pointerdown', (e) => {
  if (!world || S.mode === 'ended' || S.paused || e.button !== 0 || renderer.xr.isPresenting) return;
  if (running() && S.time < S.mirrorUntil) {
    S.mirrorUntil = 0;
    S.quizCooldownUntil = S.time + 0.15;
    mirrorPanel.visible = false;
    if (engine.f.pulseAt !== null && engine.f.airwayAt !== null) {
      const step = !S.symDone ? 1 : engine.f.dxAt === null ? 2 : !S.txPicked ? 3 : 4;
      reasoning.draw({
        step, pulse: S.pulseShown, airway: true, hover: S.hoverDx, hoverIdx: S.hoverIdx, wrong: S.dxWrong,
        symWrong: S.symWrong, symPicked: S.symPicked, dxPicked: S.dxPicked, txWrong: S.txWrong, txPicked: S.txPicked, txShowFeedback: S.profile?.difficulty === 'easy',
        dx: engine.sc.diagnosis.correct, feed: [],
      }, t);
      if (step <= 3) {
        reasoning.mesh.visible = true;
        reasoning.mesh.position.set(-0.22, 1.24, -0.58);
        reasoning.mesh.scale.setScalar(0.78);
        camera.getWorldPosition(v1);
        reasoning.mesh.lookAt(v1);
        reasoning.mesh.updateMatrixWorld(true);
      }
    }
    return;
  }
  const target = pickMouse(e), hand = hands[2];
  const ia = target?.userData.ia;
  // During Patient Briefing ('ready'), only allow clicking START CHECKUP
  if (S.mode === 'ready') {
    if (ia?.id === 'start') {
      down = { x: e.clientX, y: e.clientY, moved: false, target, consumed: false };
    }
    return;
  }
  down = { x: e.clientX, y: e.clientY, moved: false, target, consumed: false };
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  if (!running() || S.time < (S.startCooldownUntil || 0) || ia?.kind !== 'zone') return;
  if (ia.site === 'wrist' && hand.held?.userData?.ia?.tool !== 'injector') {
    if (hand.held) release(hand);
    startHold('pulse', hand, target);
    down.consumed = true;
  } else if (hand.held?.userData.ia.tool === 'injector' && BODY_SITES.includes(ia.site)) {
    beginInject(hand, target);
    down.consumed = true;
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!world || S.paused || renderer.xr.isPresenting) return;
  if (down) {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
    if (down.moved && !down.target) {
      camera.rotation.y -= e.movementX * 0.003;
      camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - e.movementY * 0.003, -1.3, 0.5);
    }
  } else if (S.mode !== 'ended') {
    const now = performance.now();
    if (now - lastHoverMs < 40) return;
    lastHoverMs = now;
    const o = pickMouse(e);
    canvas.style.cursor = o ? 'pointer' : 'grab';
    setHoveredTarget(o);
  }
});
canvas.addEventListener('pointerup', () => {
  if (!down) return;
  const d = down; down = null;
  if (S.paused) return;
  const hand = hands[2];
  if (S.hold && S.hold.hand === hand) {
    // IM Adrenaline ALWAYS requires full 10s long-hold; pulse allows quick tap in Easy/Medium
    if (S.hold.type === 'pulse' && (S.hold.t < 0.45 || S.profile?.difficulty !== 'hard')) return;
    finishHold(false);
    return;
  }
  if (S.mode === 'ended' || d.moved || d.consumed || !d.target) return;
  const ia = d.target.userData.ia;
  if (ia.kind === 'target') { if (running() || ia.id === 'start') activate(d.target); return; }
  if (!running()) return;
  if (ia.kind === 'tool') grab(hand, d.target);
  else if (hand.held) useToolOn(hand, d.target);
});
canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); if (running() && !S.paused) release(hands[2]); });
const lookKeys = new Set();
addEventListener('keydown', (e) => {
  if (S.mode === 'landing' || S.mode === 'ended') return;
  if (e.key === 'Escape') {
    if (S.paused) { setPaused(false); return; }
    if (running() && hands[2].held) { release(hands[2]); return; }
    setPaused(true);
    return;
  }
  if (S.paused) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', 'A', 'D', 'W', 'S'].includes(e.key)) {
    lookKeys.add(e.key.toLowerCase());
  }
  if (running() && e.key === 'q') release(hands[2]);
  if (running() && (e.key === 'v' || e.key === 'V')) toggleCamView();
  if (S.mode === 'ready' && (e.key === 'Enter' || e.key === ' ')) startCheckup();
});
addEventListener('keyup', (e) => lookKeys.delete(e.key.toLowerCase()));
addEventListener('resize', () => {
  if (renderer.xr.isPresenting) return;
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- XR input (Bare-Hand Pinch, Select & Direct Index-Tip Poke) ----------
function handPos(hand) {
  if (xrManager) return xrManager.getHandWorldPos(hand);
  return (hand.held || anchor(hand)).getWorldPosition(new THREE.Vector3());
}
function near(p, obj, margin = 0.03) {
  if (!obj) return false;
  obj.updateMatrixWorld(true);
  const rad = obj.userData?.ia?.radius ?? 0.06;
  return p.distanceTo(obj.getWorldPosition(v2)) < rad + margin;
}
function nearest(p, list, margin) {
  let best = null, bd = Infinity;
  for (const o of list) {
    const ia = o?.userData?.ia;
    if (!ia || !ia.enabled || (ia.kind === 'tool' && isHeld(o))) continue;
    o.updateMatrixWorld(true);
    const d = p.distanceTo(o.getWorldPosition(v2));
    const reach = (ia.radius ?? (ia.kind === 'tool' ? 0.18 : 0.08)) + margin;
    // Slight priority bonus for the Adrenaline auto-injector when drug box colliders overlap
    const effDist = ia.tool === 'injector' ? d - 0.035 : d;
    if (d < reach && effDist < bd) { best = o; bd = effDist; }
  }
  return best;
}
function onSelectStart(hand) {
  if (!world || S.paused) return;
  const p = handPos(hand);
  const hasRay = xrManager ? xrManager.aimRay(hand) : false;
  if (S.mode === 'ended') {
    const debriefBtns = [debrief?.replayHit, debrief?.exitHit].filter(Boolean);
    const nearBtn = nearest(p, debriefBtns, 0.06);
    if (nearBtn) { activate(nearBtn); return; }
    const hitBtn = hasRay ? pickFrom(raycaster, hand) : null;
    if (hitBtn?.userData?.ia?.id === 'debrief_replay' || hitBtn?.userData?.ia?.id === 'debrief_exit') {
      activate(hitBtn);
      return;
    }
    (renderer.xr.getSession() || activeXRSession)?.end();
    return;
  }
  if (S.mode === 'ready') { startCheckup(); haptic(hand, 0.6, 60); return; }
  if (!running()) return;
  if (S.time < S.mirrorUntil) {
    S.mirrorUntil = 0;
    S.quizCooldownUntil = S.time + 0.15;
    mirrorPanel.visible = false;
    return;
  }
  if (reasoning?.mesh) reasoning.mesh.updateMatrixWorld(true);
  const zones = Object.values(world.patient.zones);

  if (hand.held) {
    const z = nearest(p, zones, 0.08);
    if (z) { useToolOn(hand, z); return; }
    const tgt = nearest(p, world.targets, 0.08);
    if (tgt) { activate(tgt); haptic(hand, 0.5, 40); return; }
    const tl = nearest(p, world.tools, 0.08);
    if (tl) { grab(hand, tl); return; }
    const hit = hasRay ? pickFrom(raycaster, hand) : null;
    if (hit?.userData?.ia?.kind === 'zone') { useToolOn(hand, hit); return; }
    if (hit?.userData?.ia?.kind === 'tool') { grab(hand, hit); return; }
    if (hit?.userData?.ia?.kind === 'target') { activate(hit); haptic(hand, 0.5, 40); return; }
    release(hand);
    return;
  }
  const wristNear = nearest(p, [world.patient.zones.wrist, world.patient.zones.wristL], 0.08);
  if (wristNear && !S.hold) { startHold('pulse', hand, wristNear); S.hold.byProximity = true; return; }
  const tool = nearest(p, world.tools, 0.08);
  if (tool) { grab(hand, tool); return; }
  const tgt = nearest(p, world.targets, 0.08);
  if (tgt) { activate(tgt); haptic(hand, 0.5, 40); return; }
  // Nothing within direct hand reach: fall back to bare-hand / controller pointing ray (seated or limited-reach users).
  const hit = hasRay ? pickFrom(raycaster, hand) : null;
  if (!hit) return;
  if (hit.userData.ia.kind === 'tool') grab(hand, hit);
  else if (hit.userData.ia.kind === 'target') { activate(hit); haptic(hand, 0.5, 40); }
  else if (hit.userData.ia.kind === 'zone' && hit.userData.ia.site === 'wrist') startHold('pulse', hand, hit);
}
function setupXRInputs() {
  xrManager = new XRManager({
    renderer,
    scene,
    hands,
    controllers,
    grips,
    xrHands,
    raycaster,
    onSelectStart: (hand) => onSelectStart(hand),
    onSelectEnd: (hand) => {
      if (S.hold && S.hold.hand === hand) {
        if (S.hold.t < 0.45 || S.profile?.difficulty !== 'hard') return;
        finishHold(false);
      }
    },
    onSqueeze: (hand) => release(hand),
  });
  xrManager.setup();
}
function updateXR() {
  if (!xrManager || !world || S.paused) return;
  if (reasoning?.mesh) reasoning.mesh.updateMatrixWorld(true);
  let xrHover = null;
  for (let i = 0; i < 2; i++) {
    const hand = hands[i];
    const active = xrManager.isHandActive(i);
    if (!active) continue;
    const p = handPos(hand);

    // Update XR hover candidate (proximity first, then raycast fallback) and style pointer ray
    if (!xrHover) {
      const zones = Object.values(world.patient.zones);
      xrHover = hand.held
        ? nearest(p, zones, 0.08) || nearest(p, world.targets, 0.08)
        : nearest(p, [world.patient.zones.wrist, world.patient.zones.wristL], 0.08)
          || nearest(p, world.tools, 0.08)
          || nearest(p, world.targets, 0.08);
      if (!xrHover && xrManager.aimRay(hand)) {
        xrHover = pickFrom(raycaster, hand);
      }
      const rayLine = controllers[i]?.children?.[0];
      if (rayLine?.material) {
        rayLine.material.color.setHex(xrHover ? 0x34d399 : 0x22d3ee);
        rayLine.material.opacity = xrHover ? 0.88 : 0.42;
      }
      const rayReticle = controllers[i]?.children?.[1];
      if (rayReticle) {
        rayReticle.visible = !!xrHover;
        if (xrHover) {
          xrHover.updateMatrixWorld(true);
          const d = controllers[i].getWorldPosition(v1).distanceTo(xrHover.getWorldPosition(v2));
          rayReticle.position.set(0, 0, -Math.min(1.5, Math.max(0.25, d)));
          rayReticle.material.color.setHex(0x34d399);
        }
      }
    }

    // 0. Direct index-finger poke on Debrief Replay / Exit buttons when scenario has ended
    if (S.mode === 'ended' && debrief?.mesh?.visible && S.time >= xrManager.pokeCooldownUntil) {
      const pokedDebrief = nearest(p, [debrief.replayHit, debrief.exitHit].filter(Boolean), 0.04);
      if (pokedDebrief) {
        xrManager.pokeCooldownUntil = S.time + 0.65;
        activate(pokedDebrief);
        haptic(hand, 0.6, 50);
        continue;
      }
    }

    // 1. Direct index-finger poke on StartCard when in 'ready' state
    if (S.mode === 'ready' && startCard?.mesh?.visible && near(p, startCard.mesh, 0.06)) {
      startCheckup();
      haptic(hand, 0.6, 60);
      xrManager.pokeCooldownUntil = S.time + 0.6;
      continue;
    }
    if (!running()) continue;

    const z = world.patient.zones;
    if (!hand.held) {
      // 2. Direct bare-hand touch on either radial wrist zone (within 0.14m) starts 3s pulse check
      const dWristR = p.distanceTo(z.wrist.getWorldPosition(v2));
      const dWristL = p.distanceTo(z.wristL.getWorldPosition(v2));
      const wristHit = dWristR < 0.14 ? z.wrist : dWristL < 0.14 ? z.wristL : null;
      if (!S.hold && S.time > S.pulseCooldown && wristHit) {
        startHold('pulse', hand, wristHit);
        S.hold.byProximity = true;
        continue;
      }
      // 3. Direct bare-hand index poke on 3D targets (Diagnosis options, Nurse Sarah, Chair Recline, Drug Box Lid)
      if (S.time >= xrManager.pokeCooldownUntil) {
        const pokedTarget = nearest(p, world.targets, 0.02);
        if (pokedTarget) {
          xrManager.pokeCooldownUntil = S.time + 0.65;
          activate(pokedTarget);
          haptic(hand, 0.5, 40);
          continue;
        }
      }
    } else {
      const tool = hand.held.userData.ia.tool;
      // 4. Bringing Mouth Mirror to mouth inspects airway and cleanly returns mirror to tray
      if (tool === 'mirror' && near(p, z.mouth, 0.08)) {
        inspectAirway(2.4);
        release(hand);
      }
      // 5. Pressing IM Adrenaline auto-injector into anterolateral thigh begins 10s depot hold
      else if (tool === 'injector' && !S.hold && (near(p, z.thigh, 0.06) || near(p, z.thighL, 0.06))) {
        beginInject(hand, near(p, z.thigh, 0.06) ? z.thigh : z.thighL);
      }
      // 6. Bringing High-Flow O2 Mask to patient's face mounts the mask
      else if (tool === 'mask' && near(p, z.mouth, 0.08)) {
        placeMask(hand);
      }
    }
  }
  setHoveredTarget(xrHover);
}

// ---------- session ----------
const PATIENT_ROSTER = {
  adebayo: { name: 'Mrs. Alex Adebayo', age: 68, tone: 'VI', history: 'Type 1 Diabetes, Severe Penicillin Allergy', visit: 'Routine Dental Procedure' },
  patel: { name: 'Mr. Aarav Patel', age: 34, tone: 'IV', history: 'Asthma, Controlled Hypertension', visit: 'Crown Preparation' },
  miller: { name: 'Mrs. Sarah Miller', age: 74, tone: 'II', history: 'Ischaemic Heart Disease, Insulin Therapy', visit: 'Periodontal Scaling' },
  chen: { name: 'Master David Chen', age: 8, tone: 'IV', history: 'Brittle Asthma, Multiple Nut & Latex Allergies', visit: 'Fissure Sealant Checkup' },
};

let mirrorCanvas = null, mirrorCtx = null, mirrorTex = null;
const camGoalPos = new THREE.Vector3(-0.48, 1.38, -0.22);
const camGoalLook = new THREE.Vector3(0.08, 0.92, -0.72);
const camCurLook = new THREE.Vector3(0.08, 0.92, -0.72);
const lastCamPos = new THREE.Vector3(-0.48, 1.38, -0.22);
const projVec = new THREE.Vector3();
let camGoalFovScale = 1.0, camCurFovScale = 1.0;

function applyDifficultyUI() {
  if (!world || !S.profile) return;
  if (world.guideLabels) {
    for (const lbl of world.guideLabels) lbl.visible = S.profile.difficulty !== 'hard';
  }
  const protoCard = $('hudProtocolCard'), chkList = $('hudChecklist'), actFeed = $('hudActionFeed'), protoTitle = $('hudProtoTitle');
  if (protoCard && chkList && actFeed && protoTitle) {
    if (S.profile.difficulty === 'hard') {
      protoCard.hidden = true;
    } else if (S.profile.difficulty === 'medium') {
      protoCard.hidden = false;
      protoTitle.textContent = 'CLINICAL PROTOCOL';
      chkList.hidden = false;
      actFeed.hidden = true;
    } else {
      protoCard.hidden = false;
      protoTitle.textContent = engine?.sc?.diagnosis?.correct === 'hypoglycaemia' ? 'BNF HYPOGLYCAEMIA PROTOCOL' : 'RCUK 2021 RESUS PROTOCOL';
      chkList.hidden = false;
      actFeed.hidden = true;
    }
  }
}

function resetHudToBaseline() {
  if ($('hudHr')) $('hudHr').textContent = '--';
  if ($('hudSpo2')) $('hudSpo2').textContent = '--';
  if ($('hudBp')) { $('hudBp').textContent = '--/--'; $('hudBp').style.color = '#e2e8f0'; }
  if ($('hudRr')) $('hudRr').textContent = '--';
  if ($('hudClock')) $('hudClock').textContent = '00:00';
  if ($('hudPhase')) $('hudPhase').textContent = 'READY';
  if ($('hudVitalsCard')) $('hudVitalsCard').style.borderColor = 'rgba(34, 211, 238, 0.38)';
  if ($('hudActionFeed')) $('hudActionFeed').innerHTML = '';
  S.mediumRevealed = new Set();
  for (const id of ['chkPulse', 'chkAirway', 'chkDx', 'chkHelp', 'chkSupine', 'chkAdr', 'chkO2']) {
    const el = $(id);
    if (el) {
      el.classList.remove('done', 'next-step');
      el.hidden = S.profile?.difficulty === 'medium';
    }
  }
  if ($('pill')) {
    $('pill').classList.remove('crisis');
    if ($('pillState')) $('pillState').textContent = t('pill_active');
  }
  if ($('ecgCanvas')) {
    const ctx = $('ecgCanvas').getContext('2d');
    ctx.clearRect(0, 0, $('ecgCanvas').width, $('ecgCanvas').height);
  }
}

function resetSession({ toLanding = false } = {}) {
  if (reportTimer) { clearTimeout(reportTimer); reportTimer = null; }
  stopAudioAndSpeech(toLanding);
  for (const h of hands) {
    if (S.hold && S.hold.hand === h) S.hold = null;
    release(h);
    h.held = null;
  }
  deskGlove.visible = false;
  toolAnims.clear();
  down = null;

  engine.reset();
  S.mode = toLanding ? 'landing' : 'ready';
  S.paused = false;
  S.time = 0;
  S.hold = null;
  S.mirrorUntil = 0;
  S.quizCooldownUntil = 0;
  S.pulseCooldown = 0;
  S.beat = 0;
  S.monitorClock = 0;
  S.hudClock = 0;
  S.score = null;
  S.feed = [];
  S.dxWrong = [];
  S.symDone = false;
  S.symWrong = [];
  S.symPicked = null;
  S.dxPicked = null;
  S.txPicked = null;
  S.txWrong = [];
  setHoveredTarget(null);
  S.hoverDx = null;
  S.hoverIdx = null;
  S.pulseShown = null;
  S.lastStepKey = null;
  S.camAutoUntil = 0;
  S.hintToastUntil = 0;
  S.hintToastHtml = '';

  if (world) world.reset(engine.vitals);
  if (hoverRing) hoverRing.visible = false;
  if (startCard) {
    startCard.setPatient(engine.sc.patient);
    startCard.mesh.visible = !toLanding;
    startCard.mesh.userData.ia.enabled = !toLanding;
  }
  if (reasoning) {
    reasoning.mesh.visible = false;
    reasoning.mesh.position.set(0.76, 1.36, -1.02);
    reasoning.mesh.rotation.set(0.06, -0.58, 0);
    reasoning.mesh.scale.setScalar(0.78);
    reasoning.shuffleOptions?.();
    for (const h of reasoning.hits) h.userData.ia.enabled = true;
    reasoning.draw({
      step: 1, pulse: null, airway: false, hover: null, hoverIdx: null, wrong: [],
      symWrong: [], symPicked: null, dxPicked: null, txWrong: [], txPicked: null, txShowFeedback: S.profile?.difficulty === 'easy',
      dx: engine.sc.diagnosis.correct, feed: [],
    }, t);
  }
  if (debrief) {
    debrief.mesh.visible = false;
    if (debrief.replayHit) debrief.replayHit.userData.ia.enabled = false;
    if (debrief.exitHit) debrief.exitHit.userData.ia.enabled = false;
  }
  if (toast) { toast.ttl = 0; toast.mesh.visible = false; }
  if (mirrorPanel) mirrorPanel.visible = false;
  if (ring) ring.visible = false;
  if (guideRing) guideRing.visible = false;
  if (monitor && world?.monitorAnchor?.visible) {
    monitor.draw(engine.vitals, false, 0, t);
  }

  camGoalPos.set(-0.48, 1.38, -0.22);
  camGoalLook.set(0.08, 0.92, -0.72);
  camCurLook.set(0.08, 0.92, -0.72);
  lastCamPos.set(-0.48, 1.38, -0.22);
  camGoalFovScale = 1.0;
  camCurFovScale = 1.0;
  camera.position.set(-0.48, 1.38, -0.22);
  camera.lookAt(0.08, 0.92, -0.72);
  fitCamera();

  resetHudToBaseline();
  if ($('pauseModal')) $('pauseModal').hidden = true;
  if ($('report')) { $('report').hidden = true; $('report').innerHTML = ''; }
  if ($('guideArrow')) $('guideArrow').hidden = true;

  if (toLanding) {
    if ($('start')) $('start').hidden = false;
    openDisciplineStage('EMERGENCY');
    syncDossierUI();
    if ($('pill')) $('pill').hidden = true;
    if ($('hint')) $('hint').hidden = true;
    if ($('clinicalHud')) $('clinicalHud').hidden = true;
  } else {
    const inXR = renderer.xr.isPresenting;
    if ($('start')) $('start').hidden = true;
    sound.init();
    applyDifficultyUI();
    if ($('pill')) $('pill').hidden = inXR;
    if ($('hint')) { $('hint').hidden = true; $('hint').textContent = t('hint_controls'); }
    // Keep RCUK protocol, pause & timer hidden during Patient Briefing ('ready') until START CHECKUP is clicked
    if ($('clinicalHud')) $('clinicalHud').hidden = true;
    updateEasyGuide();
  }
}

function begin(inXR, ar) {
  if (S.mode !== 'landing') return;
  enforceActiveModuleLocks();
  const rosterKeys = Object.keys(PATIENT_ROSTER);
  let patKey = $('fPatient')?.value || 'random';
  if (patKey === 'random' || !Object.prototype.hasOwnProperty.call(PATIENT_ROSTER, patKey)) {
    let lastPat = '';
    try { lastPat = sessionStorage.getItem('pearl_last_pat') || ''; } catch { /* ignore */ }
    const pool = rosterKeys.filter((k) => k !== lastPat);
    patKey = pool[Math.floor(Math.random() * pool.length)];
    try { sessionStorage.setItem('pearl_last_pat', patKey); } catch { /* ignore */ }
  }
  const chosenPatient = PATIENT_ROSTER[patKey];

  let disVal = $('fDisease')?.value || 'random';
  if (disVal === 'random' || !['anaphylaxis', 'hypoglycaemia'].includes(disVal)) {
    let lastDis = '';
    try { lastDis = sessionStorage.getItem('pearl_last_dis') || ''; } catch { /* ignore */ }
    disVal = lastDis === 'anaphylaxis' ? 'hypoglycaemia' : lastDis === 'hypoglycaemia' ? 'anaphylaxis' : (Math.random() < 0.5 ? 'anaphylaxis' : 'hypoglycaemia');
    try { sessionStorage.setItem('pearl_last_dis', disVal); } catch { /* ignore */ }
  }
  const baseSc = disVal === 'hypoglycaemia' ? hypoglycaemia : anaphylaxis;
  const scClone = structuredClone(baseSc);
  scClone.patient.name = chosenPatient.name;
  scClone.patient.age = chosenPatient.age;
  engine = new ClinicalEngine(scClone);
  bindEngineEvents();
  setPatientName(chosenPatient.name);

  const rawDiff = $('fDifficulty')?.value || 'easy';
  const validDiff = ['easy', 'medium', 'hard'].includes(rawDiff) ? rawDiff : 'easy';
  if ($('fDifficulty')) $('fDifficulty').value = validDiff;

  S.profile = {
    name: ($('fName')?.value || '').trim(),
    pillar: 'EMERGENCY',
    discipline: 'Dental',
    tone: chosenPatient.tone,
    patientKey: patKey,
    diseaseMode: disVal,
    difficulty: validDiff,
  };
  if ($('fTone')) $('fTone').value = chosenPatient.tone;
  setLang('en');
  document.documentElement.lang = getLang();
  $('start').hidden = true;
  sound.init();
  renderer.shadowMap.enabled = !inXR;

  if (!world) {
    let loadedAssets = 0;
    const loadEl = $('loadingScreen');
    const loadTxt = $('loadText');
    const loadFill = $('loadBarFill');
    if (loadEl && !inXR) {
      loadEl.hidden = false;
      if (loadTxt) loadTxt.textContent = 'Loading 3D environment (0/3)';
      if (loadFill) loadFill.style.width = '12%';
    }
    const hideLoader = () => {
      if (loadEl) loadEl.hidden = true;
      if (startCard?.mesh && S.mode === 'ready') startCard.mesh.visible = true;
    };
    const safetyTimer = setTimeout(hideLoader, 30000);
    const onAssetLoaded = () => {
      loadedAssets = Math.min(3, loadedAssets + 1);
      if (loadTxt) loadTxt.textContent = `Loading 3D environment (${loadedAssets}/3)`;
      if (loadFill) loadFill.style.width = `${Math.round((loadedAssets / 3) * 100)}%`;
      if (loadedAssets >= 3) {
        clearTimeout(safetyTimer);
        setTimeout(hideLoader, 120);
      }
    };
    world = buildWorld(scene, { phototype: S.profile.tone, patientKey: S.profile.patientKey, onAssetLoaded });
    monitor = new Monitor(); world.monitorAnchor.add(monitor.mesh);
    toast = new Toast(); scene.add(toast.mesh);
    debrief = new Debrief(); scene.add(debrief.mesh);

    // Position StartCard as a prominent central Patient Briefing HUD within 0.62m comfortable reach
    startCard = new StartCard(t, engine.sc.patient);
    startCard.mesh.position.set(-0.14, 1.12, -0.52);
    startCard.mesh.scale.setScalar(inXR ? 1.08 : 0.86);
    startCard.mesh.visible = false;
    scene.add(startCard.mesh);

    // Position ReasoningPanel / RCUK Checklist neatly in upper-right peripheral FOV in VR/AR
    reasoning = new ReasoningPanel(engine.sc.diagnosis.options);
    reasoning.mesh.position.set(0.76, 1.36, -1.02);
    reasoning.mesh.rotation.set(0.06, -0.58, 0);
    reasoning.mesh.scale.setScalar(inXR ? 1.15 : 0.78);
    scene.add(reasoning.mesh);
    world.pickables.push(startCard.mesh, ...reasoning.hits, debrief.replayHit, debrief.exitHit);
    world.targets.push(...reasoning.hits, debrief.replayHit, debrief.exitHit);

    // Widescreen High-Definition Intra-Oral Endoscopy AR Visor (768x480, 16:10 aspect ratio)
    mirrorCanvas = document.createElement('canvas');
    mirrorCanvas.width = 768; mirrorCanvas.height = 480;
    mirrorCtx = mirrorCanvas.getContext('2d');
    mirrorTex = new THREE.CanvasTexture(mirrorCanvas);
    mirrorTex.colorSpace = THREE.SRGBColorSpace;
    mirrorTex.anisotropy = 4;

    mirrorPanel = new THREE.Group();
    const view = new THREE.Mesh(
      new THREE.PlaneGeometry(0.416, 0.26),
      new THREE.MeshBasicMaterial({ map: mirrorTex, toneMapped: false, depthTest: false, depthWrite: false })
    );
    view.renderOrder = 999;
    const frameMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.436, 0.312),
      new THREE.MeshBasicMaterial({ color: 0x050e17, depthTest: false, depthWrite: false })
    );
    frameMesh.position.set(0, 0.018, -0.002); frameMesh.renderOrder = 998;
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.444, 0.320),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, depthTest: false, depthWrite: false })
    );
    edge.position.set(0, 0.018, -0.004); edge.renderOrder = 997;
    const cap = makeLabel(t('mirror_view'), 0.416, 0.032, { bg: '#050e17', fg: '#67e8f9', px: 512 });
    cap.material.depthTest = false; cap.material.depthWrite = false; cap.renderOrder = 999;
    cap.position.set(0, 0.148, 0);
    mirrorPanel.add(edge, frameMesh, view, cap);
    mirrorPanel.position.set(-0.22, 1.24, -0.58);
    mirrorPanel.scale.setScalar(1.28);
    mirrorPanel.visible = false;
    scene.add(mirrorPanel);

    // Pre-allocated 48-segment progress ring (uses setDrawRange for zero GPU buffer reallocation during holds)
    ring = new THREE.Mesh(
      new THREE.RingGeometry(0.042, 0.056, 48, 1, Math.PI / 2, -Math.PI * 2),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, side: THREE.DoubleSide, depthTest: false, transparent: true })
    );
    ring.renderOrder = 998; ring.visible = false; scene.add(ring);

    // Easy-Mode 3D Pulsing Step Guide Beacon (automatically highlights the exact next 3D target!)
    guideRing = new THREE.Group();
    const grOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.052, 0.068, 36),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.92 })
    );
    grOuter.renderOrder = 996;
    const grInner = new THREE.Mesh(
      new THREE.RingGeometry(0.024, 0.032, 36),
      new THREE.MeshBasicMaterial({ color: 0x34d399, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.92 })
    );
    grInner.renderOrder = 996;
    guideRing.add(grOuter, grInner);
    guideRing.visible = false;
    scene.add(guideRing);

    // Interactive 3D Hover Lock Reticle (subtle cyan highlight ring on any hovered target)
    hoverRing = new THREE.Group();
    const hrOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.062, 0.078, 36),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.92 })
    );
    hrOuter.renderOrder = 997;
    const hrInner = new THREE.Mesh(
      new THREE.RingGeometry(0.030, 0.038, 36),
      new THREE.MeshBasicMaterial({ color: 0xa5f3fc, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.88 })
    );
    hrInner.renderOrder = 997;
    hoverRing.add(hrOuter, hrInner);
    hoverRing.visible = false;
    scene.add(hoverRing);
  } else {
    world.setPatient(S.profile.tone, S.profile.patientKey);
  }

  world.blob.visible = inXR;
  world.monitorAnchor.visible = inXR;
  world.room.visible = !ar;
  scene.background = ar ? null : BG;
  applyLightingProfile(ar);

  resetSession({ toLanding: false });
}
function finish() {
  if (S.mode === 'ended') return;
  S.mode = 'ended';
  S.paused = false;
  if ($('pauseModal')) $('pauseModal').hidden = true;
  for (const h of hands) { if (S.hold && S.hold.hand === h) S.hold = null; release(h); }
  stopAudioAndSpeech(false);
  setHoveredTarget(null);
  ring.visible = false; if (guideRing) guideRing.visible = false; if (hoverRing) hoverRing.visible = false; mirrorPanel.visible = false; reasoning.mesh.visible = false;
  if ($('guideArrow')) $('guideArrow').hidden = true;
  for (const h of reasoning.hits) h.userData.ia.enabled = false;
  S.score = engine.score();
  const inXR = renderer.xr.isPresenting;
  debrief.draw(S.score, t, inXR);
  debrief.mesh.scale.setScalar(inXR ? 1.18 : 1.0);
  camera.getWorldPosition(v1); camera.getWorldDirection(v2);
  debrief.mesh.position.copy(v1).addScaledVector(v2, inXR ? 0.72 : 0.85);
  debrief.mesh.lookAt(v1);
  debrief.mesh.updateMatrixWorld(true);
  $('hint').hidden = true; $('pill').hidden = true;
  if ($('clinicalHud')) $('clinicalHud').hidden = true;
  if (reportTimer) { clearTimeout(reportTimer); reportTimer = null; }
  if (!inXR) reportTimer = setTimeout(showReport, 1800);
}
function redoWithLoadingScreen() {
  const loadEl = $('loadingScreen'), barEl = $('loadBar'), txtEl = $('loadText');
  if (loadEl) {
    loadEl.hidden = false;
    loadEl.style.opacity = '1';
    if (barEl) barEl.style.width = '35%';
    if (txtEl) txtEl.textContent = 'Resetting clinical simulation...';
  }
  resetSession({ toLanding: false });
  if (barEl) barEl.style.width = '100%';
  setTimeout(() => {
    if (loadEl) {
      loadEl.style.opacity = '0';
      setTimeout(() => { loadEl.hidden = true; loadEl.style.opacity = '1'; }, 240);
    }
  }, 380);
}

function showReport() {
  if (reportTimer) { clearTimeout(reportTimer); reportTimer = null; }
  stopAudioAndSpeech(true);
  if ($('pauseModal')) $('pauseModal').hidden = true;
  if ($('guideArrow')) $('guideArrow').hidden = true;
  if ($('clinicalHud')) $('clinicalHud').hidden = true;
  if ($('pill')) $('pill').hidden = true;
  if ($('hint')) $('hint').hidden = true;
  if (debrief?.mesh) debrief.mesh.visible = false;
  renderReport($('report'), {
    engine, score: S.score || engine.score(), profile: S.profile, cpd: CPD,
    patientLabel: `${engine.sc.patient.name}, ${engine.sc.patient.age}yo`,
    onHome: () => resetSession({ toLanding: true }),
    onRedo: () => redoWithLoadingScreen(),
  });
}
engine.on((ev) => {
  if (ev.type === 'phase') {
    const sev = ev.phase === 'arrest' ? 'incorrect' : ev.phase === 'recovering' || ev.phase === 'resolved' ? 'correct' : 'neutral';
    notify('phase_' + ev.phase, sev);
  } else if (ev.type === 'end') finish();
});

function handleXRSessionEnd() {
  activeXRSession = null;
  xrStarting = false;
  // Cleanly release any XR-held tools and reset XR hand state
  for (let i = 0; i < 2; i++) {
    release(hands[i]);
    hands[i].connected = false;
    hands[i].gamepad = null;
  }
  // Restore 3D room, background, shadows, and desktop viewport/camera
  scene.background = BG;
  applyLightingProfile(false);
  renderer.shadowMap.enabled = true;
  if (world) {
    if (world.room) world.room.visible = true;
    if (world.blob) world.blob.visible = false;
    if (world.monitorAnchor) world.monitorAnchor.visible = false;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.setSize(innerWidth, innerHeight);
  camera.position.copy(camGoalPos);
  camera.lookAt(camGoalLook);
  fitCamera();

  if (S.mode === 'ended') {
    showReport();
  } else if (S.mode === 'ready' || S.mode === 'running') {
    // Seamlessly transition from VR/AR to live Desktop Clinic UI without a frozen canvas or reload
    $('start').hidden = true;
    $('pill').hidden = false;
    $('hint').hidden = false;
    if ($('clinicalHud')) $('clinicalHud').hidden = false;
    updateClinicalHud();
    updateEasyGuide();
  }
}

async function enterXR(mode) {
  if (xrStarting || activeXRSession || renderer.xr.isPresenting) return;
  if (!navigator.xr) {
    if ($('xrNote')) $('xrNote').textContent = 'WebXR is not available in this browser.';
    return;
  }
  xrStarting = true;
  try {
    const session = await navigator.xr.requestSession(mode, { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] });
    activeXRSession = session;
    session.addEventListener('end', handleXRSessionEnd, { once: true });
    await renderer.xr.setSession(session);
    if (S.mode === 'landing') {
      begin(true, mode === 'immersive-ar');
    } else if (world) {
      // Switching an already-initialized session into XR
      const isAR = mode === 'immersive-ar';
      world.room.visible = !isAR;
      scene.background = isAR ? null : BG;
      applyLightingProfile(isAR);
      renderer.shadowMap.enabled = false;
      world.blob.visible = true;
      world.monitorAnchor.visible = true;
  world.monitorAnchor.scale.setScalar(inXR ? 1.42 : 1.0);
      $('start').hidden = true;
      $('pill').hidden = true;
      $('hint').hidden = true;
      if ($('clinicalHud')) $('clinicalHud').hidden = true;
      if ($('guideArrow')) $('guideArrow').hidden = true;
    }
    xrStarting = false;
  } catch (err) {
    xrStarting = false;
    activeXRSession = null;
    if ($('xrNote')) $('xrNote').textContent = 'Could not start the headset session: ' + err.message;
  }
}
$('btnDesktop').onclick = () => begin(false, false);
$('btnVR').onclick = () => enterXR('immersive-vr');
$('btnAR').onclick = () => enterXR('immersive-ar');

// ---------- 2-Stage PEARL Landing Flow & Hardened Module Locks ----------
const DISABLED_STAGE_BTNS = ['tabP', 'tabA', 'tabR', 'tabL', 'pickMedical', 'pickNursing', 'pickParamedic'];

function enforceActiveModuleLocks() {
  for (const id of DISABLED_STAGE_BTNS) {
    const btn = $(id);
    if (!btn) continue;
    btn.disabled = true;
    btn.tabIndex = -1;
    btn.setAttribute('aria-disabled', 'true');
    btn.classList.remove('on', 'featured');
  }
  const tabE = $('tabE');
  if (tabE) {
    tabE.disabled = false;
    tabE.classList.add('featured');
  }
  const pickDental = $('pickDental');
  if (pickDental) {
    pickDental.disabled = false;
    pickDental.classList.add('on');
    pickDental.setAttribute('aria-pressed', 'true');
  }
  const disSel = $('fDisease');
  if (disSel && !['random', 'anaphylaxis', 'hypoglycaemia'].includes(disSel.value)) {
    disSel.value = 'random';
  }
}

function bindStageLocks() {
  enforceActiveModuleLocks();
  const blockEvt = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    enforceActiveModuleLocks();
    return false;
  };
  for (const id of DISABLED_STAGE_BTNS) {
    const btn = $(id);
    if (!btn) continue;
    for (const evName of ['click', 'dblclick', 'keydown', 'keyup', 'keypress', 'touchstart', 'touchend', 'pointerdown', 'pointerup']) {
      btn.addEventListener(evName, blockEvt, true);
    }
    btn.onfocus = () => btn.blur();
  }
  const disSel = $('fDisease');
  if (disSel) {
    const lockDisease = () => {
      enforceActiveModuleLocks();
    };
    disSel.addEventListener('change', lockDisease, true);
    disSel.addEventListener('input', lockDisease, true);
    disSel.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        enforceActiveModuleLocks();
      }
    }, true);
  }
}
bindStageLocks();

function openDisciplineStage(pillarName = 'EMERGENCY') {
  if (pillarName !== 'EMERGENCY') return;
  enforceActiveModuleLocks();
  const s1 = $('stagePearl'), s2 = $('stageDiscipline'), crumb = $('activePillarCrumb'), foot = $('pearlFooter');
  if (s1) s1.hidden = true;
  if (foot) foot.hidden = true;
  if (s2) s2.hidden = false;
  if (crumb) crumb.innerHTML = 'P.E.A.R.L. &bull; EMERGENCY &bull; SELECT DISCIPLINE &amp; CASE';
}
function openPearlStage() {
  enforceActiveModuleLocks();
  const s1 = $('stagePearl'), s2 = $('stageDiscipline'), foot = $('pearlFooter');
  if (s1) s1.hidden = false;
  if (foot) foot.hidden = false;
  if (s2) s2.hidden = true;
}
if ($('tabE')) $('tabE').onclick = () => openDisciplineStage('EMERGENCY');
if ($('btnBackToPearl')) $('btnBackToPearl').onclick = openPearlStage;

function syncDossierUI() {
  enforceActiveModuleLocks();
  let patVal = $('fPatient')?.value || 'random';
  if (patVal !== 'random' && !Object.prototype.hasOwnProperty.call(PATIENT_ROSTER, patVal)) {
    patVal = 'random';
    if ($('fPatient')) $('fPatient').value = 'random';
  }
  const disVal = $('fDisease')?.value || 'random';
  const titleEl = $('dossierCharTitle'), subEl = $('dossierCharSub'), badgeEl = $('dossierBadge');
  if (!titleEl || !subEl) return;
  const pName = patVal === 'random' ? 'Random Patient' : `${PATIENT_ROSTER[patVal].name} (${PATIENT_ROSTER[patVal].age}yo)`;
  const dName = disVal === 'random' ? 'Random Acute Emergency' : disVal === 'hypoglycaemia' ? 'Severe Hypoglycaemia' : 'Acute Anaphylaxis';
  titleEl.innerHTML = `${pName} &bull; ${dName}`;
  subEl.innerHTML = 'Routine Dental Checkup';
  if (badgeEl) badgeEl.textContent = (patVal === 'random' || disVal === 'random') ? 'Random Case' : dName;
  if ($('fTone') && patVal !== 'random') $('fTone').value = PATIENT_ROSTER[patVal].tone;
  const curDiff = $('fDifficulty')?.value || 'easy';
  document.querySelectorAll('#diffPills .diff-pill').forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.diff === curDiff);
  });
}
if ($('fPatient')) $('fPatient').onchange = syncDossierUI;
if ($('fDisease')) $('fDisease').onchange = syncDossierUI;
if ($('fDifficulty')) $('fDifficulty').onchange = syncDossierUI;
if ($('fElevenKey')) {
  $('fElevenKey').value = voiceService.apiKey;
  $('fElevenKey').onchange = () => voiceService.setApiKey($('fElevenKey').value);
  $('fElevenKey').oninput = () => voiceService.setApiKey($('fElevenKey').value);
}
document.querySelectorAll('#diffPills .diff-pill').forEach((btn) => {
  btn.onclick = () => {
    if ($('fDifficulty')) $('fDifficulty').value = btn.dataset.diff;
    syncDossierUI();
  };
});
if ($('btnCaseSettings')) {
  $('btnCaseSettings').onclick = () => {
    const p = $('caseSetupPanel');
    if (p) p.hidden = !p.hidden;
  };
}

// Live ECG Lead II Waveform & RCUK Protocol HUD Updater
function updateClinicalHud() {
  if ($('clinicalHud')?.hidden) return;
  const f = engine.f;
  const v = engine.vitals;
  const monitored = f.monitoring || S.pulseShown !== null;

  if ($('hudClock')) $('hudClock').textContent = mmss(engine.t);
  if ($('hudPhase')) $('hudPhase').textContent = running() ? engine.phase.toUpperCase() : 'READY';

  const ecg = $('ecgCanvas');
  if (ecg) {
    const ctx = ecg.getContext('2d');
    const w = ecg.width, h = ecg.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 15) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    if (monitored) {
      if ($('hudHr')) $('hudHr').textContent = String(Math.round(v.hr));
      if ($('hudSpo2')) $('hudSpo2').textContent = String(Math.round(v.spo2));
      if ($('hudBp')) {
        $('hudBp').textContent = `${Math.round(v.sbp)}/${Math.round(v.dbp)}`;
        $('hudBp').style.color = v.sbp < 90 ? '#fb7185' : '#e2e8f0';
      }
      if ($('hudRr')) $('hudRr').textContent = String(Math.round(v.rr));
      drawEcgWaveform(ctx, 0, 0, w, h, v, S.time, engine.phase);
    } else {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '700 10.5px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('HOLD WRIST (3s) TO CHECK PULSE', w / 2, h / 2);
    }
  }

  // Update scenario-specific Protocol Title & Checklist items (Easy) or Unassisted Action Log (Medium)
  const isHypo = engine.sc.diagnosis.correct === 'hypoglycaemia';
  if ($('hudProtoTitle') && S.profile?.difficulty === 'easy') {
    $('hudProtoTitle').textContent = isHypo ? 'BNF HYPOGLYCAEMIA PROTOCOL' : 'RCUK 2021 RESUS PROTOCOL';
  }
  if ($('chkDx')) $('chkDx').innerHTML = `<i>&#10003;</i> 3. Confirm ${isHypo ? 'Hypoglycaemia' : 'Anaphylaxis'}`;
  if ($('chkSupine')) $('chkSupine').hidden = isHypo;
  if ($('chkAdr')) $('chkAdr').innerHTML = `<i>&#10003;</i> ${isHypo ? '5. Oral Glucose Gel (40%)' : '6. IM Adrenaline 0.5mg (10s)'}`;
  if ($('chkO2')) {
    $('chkO2').hidden = isHypo;
    $('chkO2').innerHTML = '<i>&#10003;</i> 7. High-Flow O2 Mask (15L)';
  }
  const steps = [
    ['chkPulse', f.pulseAt !== null],
    ['chkAirway', f.airwayAt !== null],
    ['chkDx', f.dxAt !== null],
    ['chkHelp', f.helpAt !== null],
    ...(!isHypo ? [['chkSupine', f.supineAt !== null]] : []),
    ['chkAdr', f.adrenalineAt !== null],
    ...(!isHypo ? [['chkO2', f.oxygenAt !== null]] : []),
  ];
  const isMedium = S.profile?.difficulty === 'medium';
  const idleFor = S.time - (S.lastActionAt || 0);
  if (!S.mediumRevealed) S.mediumRevealed = new Set();
  let nextFound = false;
  for (const [id, done] of steps) {
    const el = $(id);
    if (!el) continue;
    el.classList.toggle('done', !!done);
    const isNext = running() && !done && !nextFound;
    el.classList.toggle('next-step', isNext);
    if (isMedium && isNext && idleFor >= 5.0) S.mediumRevealed.add(id);
    el.hidden = isMedium && !done && !S.mediumRevealed.has(id);
    if (isNext) nextFound = true;
  }

  if (S.profile?.difficulty === 'medium' && $('hudActionFeed')) {
    const recent = S.feed.slice(-6);
    $('hudActionFeed').innerHTML = recent.length
      ? recent.map((it) => `<li class="${it.sev === 'correct' ? 'done' : ''}"><i>${it.sev === 'correct' ? '&#10003;' : '!'}</i> [${it.clock}] ${it.text}</li>`).join('')
      : '<li><i>&bull;</i> Unassisted OSCE mode &mdash; no step-by-step hints</li>';
  }
  if ($('hudVitalsCard')) {
    const critical = monitored && (v.sbp < 90 || v.spo2 < 92);
    $('hudVitalsCard').style.borderColor = critical ? 'rgba(244, 63, 94, 0.85)' : 'rgba(34, 211, 238, 0.38)';
  }
}

// ---------- Pause Menu (Resume, Restart, Exit) ----------
function setPaused(p) {
  if (S.mode !== 'ready' && S.mode !== 'running') return;
  S.paused = !!p;
  if (S.paused) {
    stopAudioAndSpeech(false);
  } else {
    sound.resume();
  }
  if ($('pauseModal')) $('pauseModal').hidden = !S.paused;
}
if ($('btnPause')) $('btnPause').onclick = () => setPaused(true);
function toggleCamView() {
  if (S.mode !== 'running' || renderer.xr.isPresenting) return;
  S.camView = S.camView === 'birdseye' ? 'beside' : 'birdseye';
  const isBird = S.camView === 'birdseye';
  if ($('btnCamView')) $('btnCamView').textContent = isBird ? "VIEW: BIRD'S-EYE" : 'VIEW: BESIDE';
  if ($('clinicalHud')) $('clinicalHud').classList.toggle('hud-large', isBird);
  S.lastStepKey = '';
  if (isBird) {
    camGoalPos.set(0.08, 1.82, 0.06);
    camGoalLook.set(0.04, 0.88, -0.44);
    camGoalFovScale = 0.96;
  } else {
    camGoalPos.set(-0.46, 1.32, -0.08);
    camGoalLook.set(0.08, 0.86, -0.34);
    camGoalFovScale = 0.95;
  }
  S.camAutoUntil = S.time + 1.35;
}
if ($('btnCamView')) $('btnCamView').onclick = toggleCamView;
if ($('btnResume')) $('btnResume').onclick = () => setPaused(false);
if ($('btnRestart')) {
  $('btnRestart').onclick = () => redoWithLoadingScreen();
}
if ($('btnExit')) {
  $('btnExit').onclick = () => resetSession({ toLanding: true });
}
// Auto-resume scenario if user clicked "Restart Scenario" from Pause Menu
try {
  const saved = sessionStorage.getItem('pearl_auto_restart');
  if (saved) {
    sessionStorage.removeItem('pearl_auto_restart');
    const cfg = JSON.parse(saved);
    if ($('fPatient') && cfg.pat) $('fPatient').value = cfg.pat;
    if ($('fDifficulty') && cfg.diff) $('fDifficulty').value = cfg.diff;
    if ($('fName') && cfg.name) $('fName').value = cfg.name;
    if ($('fLang') && cfg.lang) $('fLang').value = cfg.lang;
    setTimeout(() => begin(false, false), 50);
  }
} catch { /* ignore */ }

// Interactive Checklist Click Assistance (clicking a step on the right visibly animates & performs that step!)
function bindEasyChecklistClicks() {
  const actStep = (stepId) => {
    if (!world || S.profile?.difficulty === 'hard' || S.paused) return;
    if (S.mode === 'ready') startCheckup();
    if (!running()) return;
    // If an active hold (pulse or injection) is in progress when the user clicks the next step, complete it cleanly first
    if (S.hold) finishHold(true);
    const hand = hands[2], f = engine.f;
    if (stepId === 'chkPulse' && f.pulseAt === null) {
      if (hand.held) release(hand);
      setCamStep('step1_pulse', [-0.42, 1.26, -0.06], [0.02, 0.84, -0.22], 0.86);
      startHold('pulse', hand, world.patient.zones.wrist);
    } else if (stepId === 'chkAirway' && f.airwayAt === null) {
      grab(hand, world.mirrorTool);
      setCamStep('step2_mouth', [-0.34, 1.26, -0.38], [0.08, 0.96, -0.70], 0.80);
      inspectAirway(2.4);
      release(hand);
    } else if (stepId === 'chkDx' && f.dxAt === null) {
      if (f.pulseAt === null) {
        const r = doAct('assess_pulse');
        if (r && S.pulseShown === null) S.pulseShown = r.params.hr;
      }
      if (f.airwayAt === null) doAct('inspect_airway');
      S.mirrorUntil = S.time;
      setCamStep('step3_dx', [-0.46, 1.34, -0.22], [-0.08, 1.12, -0.62], 0.92);
      doAct('diagnose', { id: engine.sc.diagnosis.correct });
    } else if (stepId === 'chkHelp' && f.helpAt === null) {
      setCamStep('step4_help', [-0.44, 1.36, -0.22], [0.34, 1.10, -0.88], 0.90);
      activate(world.assistantHit);
    } else if (stepId === 'chkSupine' && f.supineAt === null) {
      setCamStep('step5_supine', [-0.36, 1.24, -0.14], [-0.56, 1.10, -0.62], 0.86);
      activate(world.recline);
    } else if (stepId === 'chkAdr' && f.adrenalineAt === null) {
      if (!world.isBoxOpen()) activate(world.lid);
      const isHypo = engine.sc.diagnosis.correct === 'hypoglycaemia';
      if (isHypo) {
        const gluTool = world.tools.find((tl) => tl.userData?.ia?.drug === 'glucose' && tl.userData?.ia?.enabled);
        if (gluTool && hand.held !== gluTool) grab(hand, gluTool);
        if (hand.held?.userData?.ia?.drug === 'glucose') {
          setCamStep('mask_mouth', [-0.36, 1.28, -0.36], [0.08, 0.95, -0.68], 0.84);
          useToolOn(hand, world.patient.zones.mouth);
        }
      } else {
        const adrTool = world.tools.find((tl) => tl.userData?.ia?.tool === 'injector' && tl.userData?.ia?.enabled);
        if (adrTool && hand.held !== adrTool) grab(hand, adrTool);
        if (hand.held?.userData?.ia?.tool === 'injector') {
          setCamStep('inject_thigh', [-0.40, 1.26, 0.04], [0.04, 0.82, -0.06], 0.82);
          beginInject(hand, world.patient.zones.thigh);
        }
      }
    } else if (stepId === 'chkO2' && f.oxygenAt === null) {
      if (hand.held !== world.maskTool && world.maskTool.userData?.ia?.enabled) grab(hand, world.maskTool);
      if (hand.held === world.maskTool) {
        setCamStep('mask_mouth', [-0.36, 1.28, -0.36], [0.08, 0.95, -0.68], 0.84);
        placeMask(hand);
      }
    }
  };
  ['chkPulse', 'chkAirway', 'chkDx', 'chkHelp', 'chkSupine', 'chkAdr', 'chkO2'].forEach((id) => {
    const el = $(id);
    if (el) el.onclick = () => actStep(id);
  });
}
bindEasyChecklistClicks();

// Dynamic Camera Framing & Directional Attention Arrow for Easy Mode
function setCamStep(stepKey, pos, look, fovScale = 1.0) {
  if (S.camView === 'birdseye') return;
  if (S.lastStepKey === stepKey) return;
  S.lastStepKey = stepKey;
  camGoalPos.set(...pos);
  camGoalLook.set(...look);
  camGoalFovScale = fovScale;
  S.camAutoUntil = S.time + 1.35;
}

function updateCameraZoom(dt) {
  if (camera.position.distanceTo(lastCamPos) > 0.35) {
    S.camAutoUntil = 0;
  }
  if (down && down.moved) {
    S.camAutoUntil = 0;
  }
  if (S.camAutoUntil > S.time && running()) {
    const k = 1 - Math.exp(-dt * 4.5);
    camera.position.lerp(camGoalPos, k);
    camCurLook.lerp(camGoalLook, k);
    camera.lookAt(camCurLook);
    camCurFovScale += (camGoalFovScale - camCurFovScale) * k;
    const baseV = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(48)) / camera.aspect);
    const baseFov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(baseV), 58, 86);
    camera.fov = baseFov * camCurFovScale;
    camera.updateProjectionMatrix();
  }
  lastCamPos.copy(camera.position);
}

// Updates the 3D pulsing guide beacon, screen-space directional arrow (up/down/left/right), and smart camera zoom/angle
// Strictly synchronized 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 with #hudChecklist and #report!
function updateEasyGuide() {
  const arrowEl = $('guideArrow'), arrowTxt = $('guideArrowText');
  if (!guideRing || !world) return;
  const diff = S.profile?.difficulty || 'easy';
  const idleFor = S.time - (S.lastActionAt || 0);
  const showGuide = diff === 'easy' || (diff === 'medium' && S.mode === 'running' && idleFor >= 5.0);
  if (!showGuide || S.mode === 'landing' || S.mode === 'ended' || S.paused || renderer.xr.isPresenting || !$('start')?.hidden) {
    guideRing.visible = false;
    if (arrowEl) arrowEl.hidden = true;
    if (diff === 'hard' && $('hint')) $('hint').hidden = true;
    if (diff === 'medium' && S.mode === 'running' && S.time >= S.hintToastUntil && $('hint')) $('hint').hidden = true;
    return;
  }
  if (S.hold) {
    guideRing.visible = false;
    if (arrowEl) arrowEl.hidden = true;
    return;
  }

  const f = engine.f, hand = hands[2], heldTool = hand.held?.userData?.ia?.tool;
  const pName = engine.sc.patient.name;
  let targetObj = null, targetWorldPos = null, msg = '', arrowLabel = '';

  if (S.mode === 'ready') {
    guideRing.visible = false;
    if (arrowEl) arrowEl.hidden = true;
    if ($('hint') && S.time >= S.hintToastUntil) $('hint').hidden = true;
    return;
  } else if (f.pulseAt === null) {
    targetObj = world.patient.zones.wrist;
    arrowLabel = 'STEP 1: CLICK WRIST TO CHECK PULSE';
    msg = `<b>STEP 1 OF 7 (CHECK PULSE):</b> Click the glowing ring on ${pName}'s right wrist to palpate radial pulse`;
    setCamStep('step1_pulse', [-0.42, 1.26, -0.06], [0.02, 0.84, -0.22], 0.86);
  } else if (f.airwayAt === null) {
    if (heldTool === 'mirror') {
      targetObj = world.patient.zones.mouth;
      if (world.patient.mouthRing) world.patient.mouthRing.visible = true;
      arrowLabel = 'STEP 2: CLICK MOUTH TO INSPECT AIRWAY';
      msg = `<b>STEP 2 OF 7 (INSPECT AIRWAY):</b> Now click ${pName}'s mouth to inspect the airway`;
      setCamStep('step2_mouth', [-0.34, 1.26, -0.38], [0.08, 0.96, -0.70], 0.80);
    } else {
      targetObj = world.mirrorTool;
      arrowLabel = 'STEP 2: PICK UP MOUTH MIRROR';
      msg = '<b>STEP 2 OF 7 (INSPECT AIRWAY):</b> Click the glowing Mouth Mirror on the bracket tray';
      setCamStep('step2_mirror', [-0.48, 1.32, -0.14], [-0.32, 0.88, -0.46], 0.88);
    }
  } else if (!S.symDone || f.dxAt === null || !S.txPicked) {
    const isHypo = engine.sc.diagnosis.correct === 'hypoglycaemia';
    if (S.time < S.mirrorUntil) {
      guideRing.visible = false;
      if (arrowEl) arrowEl.hidden = true;
      if (world.patient.mouthRing) world.patient.mouthRing.visible = false;
      if (world.patient.wristRing) world.patient.wristRing.visible = false;
      return;
    } else if (!S.symDone) {
      targetObj = reasoning?.hits?.[reasoning.getRightIdx(1, isHypo)] || reasoning?.mesh || null;
      arrowLabel = 'STEP 3A: CLICK PRESENTING SYMPTOMS';
      msg = '<b>STEP 3A (SYMPTOMS):</b> Click the presenting symptoms observed on the patient';
      setCamStep('step3_sym', [-0.46, 1.34, -0.22], [-0.08, 1.12, -0.62], 0.92);
    } else if (f.dxAt === null) {
      targetObj = reasoning?.hits?.[reasoning.getRightIdx(2, isHypo)] || reasoning?.mesh || null;
      arrowLabel = isHypo ? 'STEP 3B: CLICK HYPOGLYCAEMIA' : 'STEP 3B: CLICK ACUTE ANAPHYLAXIS';
      msg = isHypo
        ? '<b>STEP 3B (DIAGNOSE):</b> Click <b>Severe hypoglycaemic crisis</b> on the Differential panel'
        : '<b>STEP 3B (DIAGNOSE):</b> Click <b>Acute anaphylaxis</b> on the Differential panel';
      setCamStep('step3_dx', [-0.46, 1.34, -0.22], [-0.08, 1.12, -0.62], 0.92);
    } else {
      targetObj = reasoning?.hits?.[reasoning.getRightIdx(3, isHypo)] || reasoning?.mesh || null;
      arrowLabel = isHypo ? 'STEP 3C: SELECT ORAL GLUCOSE' : 'STEP 3C: SELECT IM ADRENALINE + O2';
      msg = isHypo
        ? '<b>STEP 3C (TREATMENT):</b> Select <b>Oral Glucose Gel / Dextrose 40%</b> to proceed'
        : '<b>STEP 3C (TREATMENT):</b> Select <b>IM Adrenaline 0.5mg + High-Flow O2</b> to proceed';
      setCamStep('step3_tx', [-0.46, 1.34, -0.22], [-0.08, 1.12, -0.62], 0.92);
    }
  } else if (f.helpAt === null) {
    targetObj = world.assistantHit;
    arrowLabel = 'STEP 4: CLICK NURSE SARAH (EMERGENCY SERVICES)';
    msg = '<b>STEP 4 (EMERGENCY SERVICES):</b> Click Nurse Sarah (in teal scrubs) to summon emergency services';
    setCamStep('step4_help', [-0.44, 1.36, -0.22], [0.34, 1.10, -0.88], 0.90);
  } else if (engine.sc.diagnosis.correct !== 'hypoglycaemia' && f.supineAt === null) {
    targetObj = world.recline;
    arrowLabel = 'STEP 5: CLICK CHAIR POSITION (LAY FLAT)';
    msg = '<b>STEP 5 OF 7 (LAY CHAIR FLAT):</b> Click the glowing <b>CHAIR POSITION</b> button behind the mirror table';
    setCamStep('step5_supine', [-0.36, 1.24, -0.14], [-0.56, 1.10, -0.62], 0.86);
  } else if (f.adrenalineAt === null) {
    const isHypo = engine.sc.diagnosis.correct === 'hypoglycaemia';
    if (isHypo && heldTool === 'oral' && hand.held?.userData?.ia?.drug === 'glucose') {
      targetObj = world.patient.zones.mouth;
      arrowLabel = 'STEP 6: GIVE GLUCOSE GEL TO MOUTH';
      msg = `<b>STEP 6 OF 7 (GLUCOSE):</b> Click ${pName}'s mouth to administer Oral Glucose Gel`;
      setCamStep('mask_mouth', [-0.36, 1.28, -0.36], [0.08, 0.95, -0.68], 0.84);
    } else if (!isHypo && heldTool === 'injector') {
      targetObj = world.patient.zones.thigh;
      if (world.patient.thighRing) world.patient.thighRing.visible = true;
      arrowLabel = 'STEP 6: CLICK THIGH TO INJECT ADRENALINE';
      msg = `<b>STEP 6 OF 7 (ADRENALINE):</b> Click the glowing green <b>VASTUS LATERALIS</b> ring on ${pName}'s mid-thigh to inject IM Adrenaline`;
      setCamStep('inject_thigh', [-0.40, 1.26, 0.04], [0.04, 0.82, -0.06], 0.82);
    } else if (!world.isBoxOpen()) {
      targetObj = world.lid;
      arrowLabel = 'STEP 6: CLICK RED DRUG BOX TO OPEN';
      msg = '<b>STEP 6 OF 7 (EMERGENCY BOX):</b> Click the red <b>EMERGENCY RESUSCITATION DRUGS</b> box to open it';
      setCamStep('step6_openbox', [0.06, 1.36, -0.26], [0.66, 0.96, -0.26], 0.88);
    } else if (isHypo) {
      targetObj = world.tools.find((tl) => tl.userData?.ia?.drug === 'glucose' && tl.userData?.ia?.enabled) || null;
      arrowLabel = 'STEP 6: PICK UP GLUCOSE GEL';
      msg = '<b>STEP 6 OF 7 (GLUCOSE):</b> Click the orange <b>GLUCOSE GEL</b> tube inside the open red box';
      setCamStep('step6_pickadr', [0.06, 1.36, -0.26], [0.66, 0.96, -0.26], 0.88);
    } else {
      targetObj = world.tools.find((tl) => tl.userData?.ia?.tool === 'injector' && tl.userData?.ia?.enabled) || null;
      arrowLabel = 'STEP 6: PICK UP ADRENALINE INJECTOR';
      msg = '<b>STEP 6 OF 7 (ADRENALINE):</b> Click the yellow <b>ADRENALINE</b> auto-injector inside the open red box';
      setCamStep('step6_pickadr', [0.06, 1.36, -0.26], [0.66, 0.96, -0.26], 0.88);
    }
  } else if (engine.sc.diagnosis.correct !== 'hypoglycaemia' && f.oxygenAt === null) {
    if (heldTool === 'mask') {
      targetObj = world.patient.zones.mouth;
      if (world.patient.mouthRing) world.patient.mouthRing.visible = true;
      arrowLabel = 'STEP 7: CLICK MOUTH TO APPLY OXYGEN';
      msg = `<b>STEP 7 OF 7 (HIGH-FLOW O2):</b> Click ${pName}'s face/mouth to apply 15 L/min Oxygen`;
      setCamStep('mask_mouth', [-0.36, 1.28, -0.36], [0.08, 0.95, -0.68], 0.84);
    } else {
      targetObj = world.maskTool;
      arrowLabel = 'STEP 7: PICK UP OXYGEN MASK';
      msg = '<b>STEP 7 OF 7 (HIGH-FLOW O2):</b> Click the <b>OXYGEN MASK</b> inside the open red box';
      setCamStep('step7_picko2', [0.06, 1.36, -0.26], [0.66, 0.96, -0.26], 0.88);
    }
  } else {
    targetObj = null;
    msg = '<b>ALL 7 PROTOCOL STEPS COMPLETED!</b> &bull; Patient vitals stabilising &mdash; awaiting ambulance handover';
    setCamStep('step_done', [-0.46, 1.36, -0.22], [0.08, 0.94, -0.68], 0.95);
  }

  if (msg && S.time >= S.hintToastUntil) {
    $('hint').hidden = false;
    $('hint').innerHTML = msg;
  }
  if (targetObj) {
    targetObj.getWorldPosition(guideRing.position);
    if (targetObj === world.assistantHit) guideRing.position.y += 0.28;
    else if (targetObj === world.lid) { guideRing.position.x -= 0.11; guideRing.position.y -= 0.01; }
    else if (targetObj?.userData?.ia?.id === 'mirror') { guideRing.position.x += 0.10; guideRing.position.y += 0.01; }
    else if (targetObj !== startCard?.mesh && targetObj !== reasoning?.hits?.[0]) guideRing.position.y += 0.03;

    targetWorldPos = guideRing.position.clone();
    camera.getWorldPosition(v1);
    guideRing.lookAt(v1);
    const pulse = 1 + Math.sin(S.time * 6) * 0.14;
    guideRing.scale.setScalar(pulse);
    guideRing.visible = targetObj !== startCard?.mesh && targetObj !== mirrorPanel && targetObj !== reasoning?.hits?.[0];
  } else {
    guideRing.visible = false;
  }

  // Update 2D Screen-Space Directional Arrow (points Down / Up / Left / Right directly at target or screen edge!)
  if (arrowEl && arrowTxt && targetWorldPos && arrowLabel) {
    projVec.copy(targetWorldPos).project(camera);
    let behind = projVec.z > 1;
    let nx = behind ? -projVec.x : projVec.x;
    let ny = behind ? -projVec.y : projVec.y;
    let sx = (nx * 0.5 + 0.5) * innerWidth;
    let sy = (-ny * 0.5 + 0.5) * innerHeight;

    const padX = 130, padY = 95;
    let dir = 'down';
    let prefix = '';

    if (behind || sx < padX || sx > innerWidth - padX || sy < padY || sy > innerHeight - padY) {
      // Off-screen or at screen edge: point Left / Right / Up / Down toward where the user should look!
      if (sx < padX) { sx = padX; dir = 'left'; prefix = '◀ LOOK LEFT • '; }
      else if (sx > innerWidth - padX) { sx = innerWidth - padX; dir = 'right'; prefix = 'LOOK RIGHT ▶ • '; }
      if (sy < padY) { sy = padY; dir = 'up'; prefix = '▲ LOOK UP • '; }
      else if (sy > innerHeight - padY) { sy = innerHeight - padY; dir = 'down'; prefix = '▼ LOOK DOWN • '; }
      sy = THREE.MathUtils.clamp(sy, padY, innerHeight - padY);
      sx = THREE.MathUtils.clamp(sx, padX, innerWidth - padX);
    } else {
      // On-screen: orient arrow (Down, Up, Left, or Right) so it never collides with HUD panels and points straight at target!
      if (sy < 210) {
        dir = 'up';
        sy += 34;
      } else if (sx < 250) {
        dir = 'left';
        sx += 34;
      } else if (sx > innerWidth - 250) {
        dir = 'right';
        sx -= 34;
      } else {
        dir = 'down';
        sy -= 26;
      }
    }

    arrowEl.className = dir === 'down' ? '' : `dir-${dir}`;
    arrowEl.style.left = `${Math.round(sx)}px`;
    arrowEl.style.top = `${Math.round(sy)}px`;
    arrowTxt.textContent = prefix + arrowLabel;
    arrowEl.hidden = false;
  } else if (arrowEl) {
    arrowEl.hidden = true;
  }
}

async function updateXRSupport() {
  const note = $('xrNote');
  if (!navigator.xr) {
    if ($('btnVR')) $('btnVR').disabled = true;
    if ($('btnAR')) $('btnAR').disabled = true;
    if (note) note.textContent = 'Desktop mode. Open this page in the Meta Quest Browser for VR and passthrough.';
    return;
  }
  const [vr, ar] = await Promise.all(['immersive-vr', 'immersive-ar'].map((m) => navigator.xr.isSessionSupported(m).catch(() => false)));
  if ($('btnVR')) $('btnVR').disabled = !vr;
  if ($('btnAR')) $('btnAR').disabled = !ar;
  if (note) {
    note.textContent = vr || ar ? 'Headset detected. Stand or sit with about one metre of clear space in front of you.'
      : 'Desktop mode. Open this page in the Meta Quest Browser for VR and passthrough.';
  }
}
updateXRSupport();
if (navigator.xr && typeof navigator.xr.addEventListener === 'function') {
  navigator.xr.ondevicechange = updateXRSupport;
}
addEventListener('pagehide', () => {
  if (reportTimer) { clearTimeout(reportTimer); reportTimer = null; }
  stopAudioAndSpeech(true);
  if (activeXRSession) {
    try { activeXRSession.end().catch(() => {}); } catch { /* ignore */ }
    activeXRSession = null;
  }
});

// ---------- frame loop ----------
setupXRInputs();
const clock = new THREE.Clock();
function frame(dt) {
  if (world) {
    if (S.paused) {
      renderer.render(scene, camera);
      return;
    }
    S.time += dt;
    if (!renderer.xr.isPresenting && lookKeys.size) {
      const yaw = (lookKeys.has('arrowleft') || lookKeys.has('a') ? 1 : 0) - (lookKeys.has('arrowright') || lookKeys.has('d') ? 1 : 0);
      const pitch = (lookKeys.has('arrowup') || lookKeys.has('w') ? 1 : 0) - (lookKeys.has('arrowdown') || lookKeys.has('s') ? 1 : 0);
      if (yaw) camera.rotation.y += yaw * dt * 1.45;
      if (pitch) camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x + pitch * dt * 1.15, -1.3, 0.5);
    }
    if (renderer.xr.isPresenting) updateXR();
    if (running()) {
      const timeScale = S.profile?.difficulty === 'hard' ? 1.25 : 1.0;
      engine.tick(dt * timeScale);
      if (running()) { // engine.tick may have ended the scenario
        S.beat += dt * engine.vitals.hr / 60;
        if (S.beat >= 1) {
          S.beat -= 1;
          if (engine.f.monitoring) sound.playTelemetryBeep(engine.vitals, engine.phase);
          if (S.hold?.type === 'pulse') { haptic(S.hold.hand, 0.9, 45); beep(90, 0.05, 0.12); }
        }
        sound.updateRespiratoryAudio(engine.vitals, engine.phase, dt, running());
        updateHold(dt);
        const f = engine.f;
        const readyForPanel = f.pulseAt !== null && f.airwayAt !== null;
        const step = !readyForPanel ? 1 : !S.symDone ? 1 : f.dxAt === null ? 2 : !S.txPicked ? 3 : 4;
        reasoning.draw({
          step,
          pulse: S.pulseShown, airway: f.airwayAt !== null, hover: S.hoverDx, hoverIdx: S.hoverIdx, wrong: S.dxWrong,
          symWrong: S.symWrong, symPicked: S.symPicked, dxPicked: S.dxPicked, txWrong: S.txWrong, txPicked: S.txPicked, txShowFeedback: S.profile?.difficulty === 'easy',
          dx: engine.sc.diagnosis.correct, feed: S.txPicked ? S.feed.slice(-6) : [],
        }, t);
        if (readyForPanel && step <= 3 && S.time >= S.mirrorUntil) {
          reasoning.mesh.visible = true;
          reasoning.mesh.position.set(-0.22, 1.24, -0.58);
          reasoning.mesh.scale.setScalar(0.78);
          camera.getWorldPosition(v1);
          reasoning.mesh.lookAt(v1);
        } else {
          reasoning.mesh.visible = renderer.xr.isPresenting;
          reasoning.mesh.position.set(0.76, 1.36, -1.02);
          reasoning.mesh.rotation.set(0.06, -0.58, 0);
          reasoning.mesh.scale.setScalar(renderer.xr.isPresenting ? 1.15 : 0.78);
        }
      }
    }
    world.update(dt);
    updateToolAnimations(dt);
    const isRecovered = engine.phase === 'recovering' || engine.phase === 'resolved';
    const inDistress = running() && !isRecovered;
    world.patient.update(engine.vitals, dt, inDistress, isRecovered);
    updateEasyGuide();
    updateHoverVisuals();
    updateCameraZoom(dt);
    S.hudClock -= dt;
    if (S.hudClock <= 0 && !$('clinicalHud')?.hidden) { S.hudClock = 0.08; updateClinicalHud(); }
    S.monitorClock -= dt;
    if (S.monitorClock <= 0 && world.monitorAnchor.visible) { S.monitorClock = 0.12; monitor.draw(engine.vitals, engine.f.monitoring, engine.t, t, S.time, engine.phase); }

    camera.getWorldPosition(v1); camera.getWorldDirection(v2);
    v3.set(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(q1));
    if (S.mode === 'ready') startCard.mesh.lookAt(v1);

    // Feedback card drifts toward the lower field of view rather than being head-locked.
    toast.update(dt);
    toastGoal.copy(v1).addScaledVector(v2, 0.75).addScaledVector(v3, -0.27);
    toast.mesh.position.lerp(toastGoal, renderer.xr.isPresenting ? 1 - Math.exp(-dt * 5) : 1);
    toast.mesh.lookAt(v1);

    const showMirror = running() && S.time < S.mirrorUntil;
    if (showMirror) {
      S.mirrorClock -= dt;
      if (S.mirrorClock <= 0) {
        S.mirrorClock = 0.066; // ~15 Hz endoscopy canvas refresh
        world.patient.drawOralEndoscopy(mirrorCtx, 768, 480, engine.vitals, S.time);
        mirrorTex.needsUpdate = true;
      }
      mirrorPanel.position.copy(v1).addScaledVector(v2, 0.54).addScaledVector(v3, -0.01);
      mirrorPanel.lookAt(v1);
    } else {
      S.mirrorClock = 0;
    }
    mirrorPanel.visible = showMirror;
  }
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(() => {
  const raw = clock.getDelta();
  S.fps += ((raw > 0 ? 1 / raw : 0) - S.fps) * 0.05;
  frame(Math.min(raw, 0.25));
});

// Handle for automated checks and debugging.
window.__pearlsim = {
  engine, S, hands, controllers, grips, xrHands, sound,
  onSelectStart, updateXR, setHoveredTarget, updateHoverVisuals, frame, startCheckup, enterXR, handleXRSessionEnd, stopAudioAndSpeech, showReport, resetSession,
  get xrManager() { return xrManager; }, get world() { return world; }, get reasoning() { return reasoning; }, get hoverRing() { return hoverRing; }, get audio() { return sound.ctx; },
  camera, scene, renderer,
};
