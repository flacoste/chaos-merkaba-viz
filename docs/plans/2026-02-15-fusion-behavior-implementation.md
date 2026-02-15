# Fusion Behavior Modes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add configurable post-fusion behavior (unlock / spin-lock CW / spin-lock CCW) with an independent speed ramp that gradually increases rotation after fusion.

**Architecture:** New persistent settings (`fusionMode`, `rampDuration`, `rampMaxSpeed`) are added to `DEFAULTS` and exposed via lil-gui in the Rotation folder. The animation loop is refactored to compute an effective speed (accounting for ramp) and handle three rotation states: independent (unlock/pre-fusion), seeking (spin-lock, waiting for alignment), and locked (spin-lock, aligned). Alignment detection uses the XZ-plane angle of the front-right vertex to determine when corresponding vertices are directly opposite.

**Tech Stack:** Three.js, lil-gui, vanilla JS (ES modules), Vite

---

### Task 1: Add new defaults and transient state

**Files:**
- Modify: `src/main.js:38-78` (DEFAULTS object)
- Modify: `src/main.js:102-105` (transient state in loadSettings)
- Modify: `src/main.js:175-178` (reset function)

**Step 1: Add fusion settings to DEFAULTS**

In `src/main.js`, add three new keys to the `DEFAULTS` object, after the `directionB` line (line 47):

```javascript
  // Fusion behavior
  fusionMode: 'Unlock',       // 'Unlock' | 'Spin Lock CW' | 'Spin Lock CCW'
  rampDuration: 0.0,          // minutes to reach max speed (0 = disabled)
  rampMaxSpeed: 10.0,         // target speed for ramp (0-20)
```

**Step 2: Add transient state to loadSettings**

In `src/main.js`, after `base.fused = false;` (line 104), add:

```javascript
  base.rampStartTime = null;
  base.rampBaseSpeed = 0;
  base.lockAchieved = false;
```

**Step 3: Update reset function**

In `src/main.js`, replace the `reset()` function (lines 175-178) with:

```javascript
function reset() {
  params.currentSeparation = MAX_SEPARATION;
  params.fused = false;
  params.rampStartTime = null;
  params.rampBaseSpeed = 0;
  params.lockAchieved = false;
}
```

**Step 4: Verify in browser**

Run: `npx vite` (or whatever dev server is configured)
Expected: App loads without errors. No visual change — new settings are at default values.

**Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat: add fusion mode and ramp defaults/transient state"
```

---

### Task 2: Add GUI controls for fusion mode and ramp

**Files:**
- Modify: `src/controls.js:14-16` (Rotation folder)

**Step 1: Add new controls to Rotation folder**

In `src/controls.js`, after the `rotationSpeed` slider (line 16), add:

```javascript
  rotation.add(params, 'fusionMode', ['Unlock', 'Spin Lock CW', 'Spin Lock CCW']).name('Fusion Mode').onChange(saveSettings);
  rotation.add(params, 'rampDuration', 0.0, 5.0, 0.1).name('Ramp Duration (min)').onChange(saveSettings);
  rotation.add(params, 'rampMaxSpeed', 0.0, 20.0, 0.1).name('Ramp Max Speed').onChange(saveSettings);
```

**Step 2: Verify in browser**

Expected: Three new controls appear in the Rotation folder. Changing them persists across page reload (check localStorage).

**Step 3: Commit**

```bash
git add src/controls.js
git commit -m "feat: add fusion mode and ramp GUI controls"
```

---

### Task 3: Compute merkaba alignment target angle

**Files:**
- Modify: `src/main.js` (after tetrahedra creation, around line 34)

**Step 1: Compute target relative rotation angle**

After the tetrahedra are created and added to the scene (after line 34), add:

```javascript
// Compute the target relative rotation angle for merkaba alignment.
// When the two tetrahedra are at this relative Y rotation, corresponding
// named vertices (front-right↔front-right, etc.) are directly opposite
// each other in the XZ plane, forming a proper star tetrahedron.
const frontRightA = tetraA.userData.originalVerts[1]; // [apex, frontRight, frontLeft, back]
const alphaA = Math.atan2(frontRightA.z, frontRightA.x);
const MERKABA_TARGET_DELTA = Math.PI - 2 * alphaA;
```

**Explanation:** Tetrahedron A's front-right vertex starts at XZ angle `α`. Tetrahedron B is flipped via `rotateX(PI)`, so its front-right starts at XZ angle `-α`. For them to be 180° apart: `(α + rotA) - (-α + rotB) = π`, giving target `rotA - rotB = π - 2α`.

**Step 2: Verify no errors**

Expected: App loads without errors. No visual change yet.

**Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: compute merkaba alignment target angle"
```

---

### Task 4: Implement speed ramp logic

**Files:**
- Modify: `src/main.js:214-231` (animation loop — approach + rotation sections)

**Step 1: Trigger ramp on fusion**

Replace the approach section (lines 214-223) with:

```javascript
  // Approach
  if (!params.fused) {
    params.currentSeparation -= params.approachSpeed * deltaTime;
    if (params.currentSeparation <= 0) {
      params.currentSeparation = 0;
      params.fused = true;
      // Activate speed ramp if duration > 0
      if (params.rampDuration > 0) {
        params.rampStartTime = now;
        params.rampBaseSpeed = params.rotationSpeed;
      }
    }
  }
  tetraA.position.y = -params.currentSeparation / 2;
  tetraB.position.y = params.currentSeparation / 2;
```

**Step 2: Add effective speed computation**

Replace the rotation section (lines 225-231) with:

```javascript
  // Rotation (Y-axis only)
  if (params.autoRotate) {
    // Compute effective speed (with ramp if active)
    let effectiveSpeed = params.rotationSpeed;
    if (params.rampStartTime !== null) {
      const elapsedSec = (now - params.rampStartTime) / 1000;
      const durationSec = params.rampDuration * 60;
      const progress = Math.min(elapsedSec / durationSec, 1.0);
      effectiveSpeed = params.rampBaseSpeed + (params.rampMaxSpeed - params.rampBaseSpeed) * progress;
    }

    const signA = params.directionA === 'Clockwise' ? -1 : 1;
    const signB = params.directionB === 'Clockwise' ? -1 : 1;
    tetraA.rotation.y += signA * effectiveSpeed * deltaTime;
    tetraB.rotation.y += signB * effectiveSpeed * deltaTime;
  }
```

**Step 3: Verify in browser**

- Set `rampDuration` to 0.5 (30 seconds), `rampMaxSpeed` to 10
- Let tetrahedra fuse
- Expected: After fusion, rotation speed gradually increases over 30 seconds to 10
- Set `rampDuration` to 0 → no ramp, constant speed

**Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: implement speed ramp on fusion"
```

---

### Task 5: Implement spin-lock seeking and locking

**Files:**
- Modify: `src/main.js` (the rotation section just written in Task 4)

**Step 1: Replace the rotation block with full fusion mode logic**

Replace the rotation section written in Task 4 with:

```javascript
  // Rotation (Y-axis only)
  if (params.autoRotate) {
    // Compute effective speed (with ramp if active)
    let effectiveSpeed = params.rotationSpeed;
    if (params.rampStartTime !== null) {
      const elapsedSec = (now - params.rampStartTime) / 1000;
      const durationSec = params.rampDuration * 60;
      const progress = Math.min(elapsedSec / durationSec, 1.0);
      effectiveSpeed = params.rampBaseSpeed + (params.rampMaxSpeed - params.rampBaseSpeed) * progress;
    }

    const isSpinLock = params.fusionMode !== 'Unlock';

    if (params.fused && isSpinLock && params.lockAchieved) {
      // Locked: rotate both together in the mode's direction
      const sign = params.fusionMode === 'Spin Lock CW' ? -1 : 1;
      const delta = sign * effectiveSpeed * deltaTime;
      tetraA.rotation.y += delta;
      tetraB.rotation.y += delta;
    } else if (params.fused && isSpinLock && !params.lockAchieved) {
      // Seeking: rotate independently, check for alignment each frame
      const signA = params.directionA === 'Clockwise' ? -1 : 1;
      const signB = params.directionB === 'Clockwise' ? -1 : 1;
      tetraA.rotation.y += signA * effectiveSpeed * deltaTime;
      tetraB.rotation.y += signB * effectiveSpeed * deltaTime;

      // Check merkaba alignment
      const relAngle = tetraA.rotation.y - tetraB.rotation.y;
      const TWO_PI = 2 * Math.PI;
      const normalized = ((relAngle % TWO_PI) + TWO_PI) % TWO_PI;
      const target = ((MERKABA_TARGET_DELTA % TWO_PI) + TWO_PI) % TWO_PI;
      const diff = Math.abs(normalized - target);
      if (diff < 0.08 || diff > (TWO_PI - 0.08)) {
        // Snap to exact alignment: keep A, adjust B
        tetraB.rotation.y = tetraA.rotation.y - MERKABA_TARGET_DELTA;
        params.lockAchieved = true;
      }
    } else {
      // Unlock mode or pre-fusion: independent rotation
      const signA = params.directionA === 'Clockwise' ? -1 : 1;
      const signB = params.directionB === 'Clockwise' ? -1 : 1;
      tetraA.rotation.y += signA * effectiveSpeed * deltaTime;
      tetraB.rotation.y += signB * effectiveSpeed * deltaTime;
    }
  }
```

**Step 2: Verify in browser — Unlock mode**

- Set Fusion Mode to "Unlock"
- Let tetrahedra fuse
- Expected: Both continue spinning independently (same as before)

**Step 3: Verify in browser — Spin Lock CW**

- Click Restart, set Fusion Mode to "Spin Lock CW"
- Let tetrahedra fuse
- Expected: After fusion, they continue spinning briefly, then snap together into a merkaba and rotate clockwise as one unit

**Step 4: Verify in browser — Spin Lock CCW**

- Click Restart, set Fusion Mode to "Spin Lock CCW"
- Expected: Same seeking behavior, then locked counterclockwise rotation

**Step 5: Verify spin-lock + ramp combined**

- Set Fusion Mode to "Spin Lock CW", rampDuration to 0.5, rampMaxSpeed to 15
- Click Restart
- Expected: Fuse → seek → lock → speed gradually increases to 15 over 30 seconds

**Step 6: Commit**

```bash
git add src/main.js
git commit -m "feat: implement spin-lock seeking and locking"
```

---

### Task 6: Update keyboard handlers for ramp interaction

**Files:**
- Modify: `src/main.js:147-158` (keyboard handler)

**Step 1: Update +/- key handler to cancel ramp**

Replace the keyboard handler (lines 147-158) with:

```javascript
// Keyboard: +/- to adjust rotation speed (cancels ramp)
window.addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') {
    params.rampStartTime = null; // cancel ramp
    params.rotationSpeed = Math.min(Math.round((params.rotationSpeed + 0.1) * 100) / 100, 5.0);
    gui.controllersRecursive().find(c => c.property === 'rotationSpeed')?.updateDisplay();
    saveSettings();
  } else if (e.key === '-' || e.key === '_') {
    params.rampStartTime = null; // cancel ramp
    params.rotationSpeed = Math.max(Math.round((params.rotationSpeed - 0.1) * 100) / 100, 0.0);
    gui.controllersRecursive().find(c => c.property === 'rotationSpeed')?.updateDisplay();
    saveSettings();
  }
});
```

**Step 2: Verify in browser**

- Set rampDuration to 1.0, rampMaxSpeed to 15, let tetrahedra fuse
- While ramp is increasing speed, press `-`
- Expected: Speed immediately drops to rotationSpeed value, ramp is cancelled

**Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: +/- keys cancel active speed ramp"
```

---

### Task 7: Final integration verification

**Step 1: Full test matrix**

Test each combination in the browser:

| Fusion Mode | Ramp | Expected |
|------------|------|----------|
| Unlock | Off (0) | Current behavior, independent spinning |
| Unlock | On (1 min, max 15) | Independent spinning, speed ramps up after fusion |
| Spin Lock CW | Off | Seek → lock → constant CW rotation |
| Spin Lock CW | On | Seek → lock → CW rotation with increasing speed |
| Spin Lock CCW | Off | Seek → lock → constant CCW rotation |
| Spin Lock CCW | On | Seek → lock → CCW rotation with increasing speed |

**Step 2: Test edge cases**

- Restart during ramp → ramp clears, starts fresh
- Reset Default Settings → all new settings return to defaults
- Settings persist across page reload
- +/- keys cancel ramp mid-ramp
- Both tetrahedra spinning same direction → seeking still finds lock point (may take longer)

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address integration issues"
```
