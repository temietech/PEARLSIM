// Run with: node test/engine.test.mjs
import assert from 'node:assert/strict';
import { ClinicalEngine } from '../src/engine.js';
import { anaphylaxis } from '../src/scenario-anaphylaxis.js';

function run(script, maxT = 400) {
  const e = new ClinicalEngine(anaphylaxis);
  e.start();
  const todo = [...script].sort((a, b) => a.t - b.t);
  while (!e.ended && e.t < maxT) {
    e.tick(0.1);
    while (todo.length && todo[0].t <= e.t + 1e-9) {
      const a = todo.shift();
      e.act(a.type, a.p);
    }
  }
  return e;
}

const ideal = [
  { t: 8, type: 'assess_pulse' },
  { t: 15, type: 'inspect_airway' },
  { t: 17, type: 'diagnose', p: { id: 'anaphylaxis' } },
  { t: 18, type: 'call_help' },
  { t: 22, type: 'position_supine' },
  { t: 26, type: 'open_drug_box' },
  { t: 40, type: 'inject', p: { site: 'thigh', held: 10 } },
  { t: 48, type: 'oxygen' },
];

// 1. Ideal management resolves and scores highly.
let e = run(ideal);
let s = e.score();
assert.equal(e.outcome, 'resolved');
assert.ok(s.pass, 'ideal run passes');
assert.ok(s.overall >= 95, `ideal overall ${s.overall}`);

// 2. Determinism: identical inputs give identical logs and vitals.
const e2 = run(ideal);
assert.deepEqual(e2.log, e.log);
assert.deepEqual(e2.vitals, e.vitals);

// 3. No treatment ends in arrest at a fixed time.
e = run([]);
assert.equal(e.outcome, 'arrest');
assert.equal(e.t, 145);

// 4. GTN is contraindicated: it skips a phase and blocks a pass even if rescued.
e = run([{ t: 10, type: 'drug', p: { id: 'gtn' } }, { t: 30, type: 'inject', p: { site: 'thigh', held: 10 } }]);
assert.equal(e.log.find((l) => l.type === 'phase').t, 10);
assert.equal(e.outcome, 'resolved');
assert.equal(e.score().pass, false);

// 5. Wrong site does not deliver the drug; early release is a partial dose.
e = run([{ t: 20, type: 'inject', p: { site: 'deltoid', held: 0 } }]);
assert.equal(e.outcome, 'arrest');
assert.equal(e.score().errors.siteErrors, 1);
e = run([{ t: 20, type: 'inject', p: { site: 'thigh', held: 4 } }]);
assert.equal(e.outcome, 'arrest');
assert.equal(e.score().errors.partialDoses, 1);
assert.ok(e.t > 145, 'partial dose only delays deterioration');

// 6. Salbutamol before adrenaline is a sequence error.
e = run([{ t: 10, type: 'drug', p: { id: 'salbutamol' } }, { t: 30, type: 'inject', p: { site: 'thigh', held: 10 } }]);
assert.equal(e.score().seq.adrenalineFirst, false);

// 7. Diagnosis is locked until both assessments are done; wrong answers cost recognition marks.
e = run([{ t: 5, type: 'diagnose', p: { id: 'anaphylaxis' } }]);
assert.equal(e.f.dxAt, null);
e = run([...ideal.filter((a) => a.type !== 'diagnose'), { t: 16, type: 'diagnose', p: { id: 'syncope' } }, { t: 17, type: 'diagnose', p: { id: 'anaphylaxis' } }]);
assert.equal(e.score().domains.recognition, 85);
assert.equal(e.score().grade, 'A');

console.log('engine: all assertions passed');
