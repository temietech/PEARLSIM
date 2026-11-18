# PEARLSIM • WebXR AR Medical Hypoglycemia Simulation Prototype

An immersive Augmented Reality medical simulation prototype designed for the **Meta Quest 3** (and modern WebXR browsers). This application trains clinical learners on managing an acute hypoglycemic emergency in a Type 1 Diabetic patient, administering the correct life-saving intervention (**Glucagon 1mg**) versus the critical error of administering additional **Insulin (100 U/mL)**.

---

## 🌟 Key Architecture & Highlights

### 1. Strict Deterministic Physiological State Machine (`src/core/ClinicalStateMachine.js`)
*   **Zero LLM Hallucinations in Clinical Logic:** Patient vitals (Blood Glucose, Heart Rate, Systolic/Diastolic BP, SpO2, Respiration Rate, and Neurological Status) are strictly governed by a hard-coded deterministic state machine with continuous differential smoothing and physiological micro-fluctuations.
*   **State 0: Baseline:** Patient is stable but trending downward (Blood Glucose: 72 mg/dL -> 54 mg/dL, HR: 82 bpm, BP: 118/76 mmHg).
*   **State 1: Hypoglycemia Triggered:** Acute glucose crash (< 40 mg/dL). Sympathetic surge triggers tachycardia (HR: 122 bpm), tachypnea, diaphoresis, and fine motor shivering/tremors.
*   **State 2A: Correct Action (Glucagon Administered):** Vitals progressively stabilize and return to safe baseline over a strict 10-second curve (Blood Glucose climbs to 88 mg/dL, HR normalizes to 78 bpm, tremors cease).
*   **State 2B: Critical Error (Insulin Administered):** Catastrophic neuroglycopenia. Blood glucose bottoms out (< 20 mg/dL), severe bradycardia / cardiac arrest collapse (HR: 38 bpm), profound hypotensive shock (BP: 64/38 mmHg), coma, and immediate clinical Code Blue alarms trigger.

### 2. Spatial UI & Modern Glassmorphism Aesthetic (`src/ui/SpatialVitalsMonitor.js`)
*   **Glassmorphic Design:** Floating translucent frosted glass panels (`rgba(15, 23, 42, 0.85)` with specular borders and blur) providing high-contrast readability against any physical room passthrough environment.
*   **Live Sweeping ECG Waveform:** Real-time Lead II rhythm strip tracing P-QRS-T complexes. The sweep rate and R-wave peak dynamically synchronize with the patient's heart rate and trigger pulse audio beeps.
*   **High-Visibility Digital Readouts:** Glowing electric cyan/blue metrics (`#00f0ff` / `#38bdf8`), warning amber in hypoglycemia, and flashing crimson strobe during State 2B Code Blue.

### 3. Spatial Interaction & Syringe Administration (`src/scene/EquipmentTray.js` & `src/xr/XRManager.js`)
*   **WebXR Controller & Hand Tracking Support:** Quest Touch Plus controllers feature laser pointer beams and reticle dots; Quest Hand Tracking supports pinch-to-select gestures. Full desktop mouse click fallback is provided.
*   **Two Distinct 3D Syringes:**
    *   **Insulin Syringe:** Distinctive U-100 safety orange cap, flange, and plunger markings labeled `INSULIN 100 U/mL (CRITICAL RISK)`.
    *   **Glucagon Syringe:** Distinctive emergency red/amber casing with safety shield labeled `GLUCAGON 1 mg (CORRECT ACTION)`.
*   **3D Flight Animation:** When selected, the chosen syringe lifts off the tray, glides toward the patient's forearm IV cannula port, depresses the plunger with clinical audio feedback, and triggers the deterministic state machine.

### 4. LLM Dialogue Bridge (`src/core/llmBridge.js` & `src/ui/SpatialDialogueBubble.js`)
*   **Strict Boundary:** The LLM is strictly reserved for generating dynamic conversational dialogue and patient reactions to state changes.
*   `fetchPatientDialogue(currentState, lastIntervention, vitals)` sends a lightweight JSON payload on state transitions.
*   Renders dialogue in a floating 3D curved glass speech bubble anchored above the patient's head with a smooth typewriter animation.
*   Equipped with both a built-in clinical dialogue engine and an optional configurable external HTTP endpoint / API key.

### 5. WebXR AR Passthrough & Performance
*   Transparent canvas (`renderer.setClearColor(0x000000, 0)`) and `immersive-ar` session with `local-floor` reference space allow Meta Quest 3 full-color passthrough cameras to render the physical room behind the virtual gurney, patient, tray, and monitors.
*   Optimized render loop with throttled offscreen canvas textures ensuring high frame rates on standalone Quest headsets.
*   Integrated `GLTFLoader` with `DRACOLoader` support for importing custom `.glb` meshes.

---

## 🚀 Running the Prototype

### Quick Start
Run the zero-dependency built-in server:
```bash
node server.mjs
```
or
```bash
npm start
```

### Accessing on Meta Quest 3

#### Option A: USB Tethered / Port Forwarding (Recommended for development)
1. Connect your Meta Quest 3 to your PC via USB-C.
2. In Google Chrome on your PC, navigate to `chrome://inspect/#devices`.
3. Click **Port forwarding...** and add:
   *   Port: `8080`
   *   IP address and port: `localhost:8080`
4. Put on your Meta Quest 3, open the **Meta Quest Browser**, and go to:
   ```
   http://localhost:8080
   ```
5. Click **Enter AR (Quest 3)** on the top HUD. The passthrough cameras will activate and place the clinical bed, bedside tray, and vitals monitor directly into your room!

#### Option B: Local Network (Wi-Fi)
1. Ensure your Quest 3 is connected to the same Wi-Fi network as your PC.
2. In the Quest Browser, navigate to your computer's local IP address displayed in the terminal output (e.g. `http://192.168.1.X:8080`).

#### Option C: Desktop Browser Preview
*   Open `http://localhost:8080` in Chrome, Edge, or Firefox.
*   Use left-click to orbit, right-click to pan, and wheel to zoom.
*   Hover over the syringes on the tray to inspect tooltips, and click to trigger the administration animation.
*   Use the HUD buttons (`Trigger Hypoglycemia`, `Glucagon`, `Insulin`, `Reset`, `Audio On/Mute`) for rapid clinical testing.

---

## 📁 Project Structure

```
PEARLSIM/
├── index.html                   # WebXR viewport, DOM HUD overlay, and ESM importmap
├── server.mjs                   # Zero-dependency local dev server (Node core modules)
├── package.json                 # Project configuration and run scripts
├── src/
│   ├── main.js                  # Three.js scene orchestrator and XR session management
│   ├── style.css                # Glassmorphism aesthetic and clinical HUD styling
│   ├── core/
│   │   ├── ClinicalStateMachine.js # Strict deterministic physiological state engine
│   │   └── llmBridge.js            # Asynchronous LLM patient dialogue bridge
│   ├── ui/
│   │   ├── SpatialVitalsMonitor.js  # Floating 3D glass monitor with real-time ECG
│   │   └── SpatialDialogueBubble.js # 3D glass curved speech bubble with typewriter text
│   ├── scene/
│   │   ├── PatientEntity.js     # Procedural gurney, mannequin, breathing, shivering, IV port
│   │   └── EquipmentTray.js     # Bedside table with Insulin and Glucagon 3D syringes
│   ├── xr/
│   │   └── XRManager.js         # WebXR controllers, laser raycasters, hand tracking
│   └── audio/
│       └── SoundManager.js      # Web Audio telemetry pulse, tachycardia, and alarm synth
```
