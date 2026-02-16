# Animation Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish animation controls — replace auto-rotate toggle with global click-to-pause, update defaults (morph on, 2min ramp), and reset ramp/morph when key parameters change.

**Architecture:** Three changes to `src/main.js` and `src/controls.js`. A new `resetRamp()` helper centralizes ramp state resets. A transient `paused` flag with pause-time accounting replaces the persisted `autoRotate` setting.

**Tech Stack:** Three.js, lil-gui, vanilla JS

---

### Task 1: Remove autoRotate from DEFAULTS and persistence

**Files:**
- Modify: `src/main.js:92-144` (DEFAULTS)
- Modify: `src/main.js:200-215` (click handler — will be replaced in Task 3)

**Step 1: Remove autoRotate from DEFAULTS**

In `src/main.js`, remove line 98 (`autoRotate: true,`) from the DEFAULTS object.

**Step 2: Remove autoRotate GUI control**

In `src/controls.js`, remove line 19:
```javascript
rotation.add(params, 'autoRotate').name('Auto-Rotate').onChange(saveSettings);
```

**Step 3: Verify the app loads without errors**

Run: `npx vite dev` and open in browser. Confirm:
- No "Auto-Rotate" checkbox in GUI
- Rotation still works (the animation loop still references `params.autoRotate` — it will be loaded from localStorage as `true` for existing users, or `undefined` for fresh users, which is falsy)

*Note: Rotation may stop for fresh users at this point — that's expected, we fix it in Task 2.*

**Step 4: Commit**

```bash
git add src/main.js src/controls.js
git commit -m "remove autoRotate setting from defaults and GUI"
```

---

### Task 2: Add global pause flag and update animation loop

**Files:**
- Modify: `src/main.js:168-175` (transient state in loadSettings)
- Modify: `src/main.js:284-416` (animation loop)

**Step 1: Add pause transient state**

In `src/main.js` `loadSettings()`, after line 174 (`base.fuseTime = null;`), add:
```javascript
base.paused = false;
base.pausedDuration = 0;
base.pauseStartTime = null;
```

Also in `reset()` (line 250-259), add these same resets:
```javascript
params.paused = false;
params.pausedDuration = 0;
params.pauseStartTime = null;
```

**Step 2: Guard animation loop with pause check**

In `src/main.js` `animate()`, replace the `if (params.autoRotate)` guard on line 326 with a top-level pause guard. The animation loop body (after `lastTime = now;`) should be wrapped:

```javascript
if (!params.paused) {
  // ... all existing animation code (scale, approach, rotation, morph) ...
}
```

Remove the `if (params.autoRotate)` check on line 326 — rotation now always runs when unpaused.

**Step 3: Update ramp elapsed time to account for pauses**

In `computeEffectiveSpeed()`, change line 295 from:
```javascript
const elapsedSec = (now - params.rampStartTime) / 1000;
```
to:
```javascript
const elapsedSec = (now - params.rampStartTime - params.pausedDuration) / 1000;
```

**Step 4: Verify**

Run app. Confirm:
- Rotation runs automatically on load (no autoRotate check needed)
- All animations run (approach, rotation, ramp, morph)

**Step 5: Commit**

```bash
git add src/main.js
git commit -m "add global pause flag and remove autoRotate from animation loop"
```

---

### Task 3: Update click handler for global pause

**Files:**
- Modify: `src/main.js:200-215` (click handler)

**Step 1: Replace click handler**

Replace the entire click handler block (lines 200-215) with:

```javascript
// Click to toggle pause (distinguish from orbit drag)
let pointerStart = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerStart = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerStart) return;
  const dx = e.clientX - pointerStart.x;
  const dy = e.clientY - pointerStart.y;
  if (dx * dx + dy * dy < 9) {
    params.paused = !params.paused;
    if (params.paused) {
      params.pauseStartTime = performance.now();
    } else if (params.pauseStartTime !== null) {
      params.pausedDuration += performance.now() - params.pauseStartTime;
      params.pauseStartTime = null;
    }
  }
  pointerStart = null;
});
```

Key differences from old handler:
- Toggles `paused` instead of `autoRotate`
- Tracks pause duration for ramp timer correction
- No `saveSettings()` call (pause is transient)
- No GUI update needed (no checkbox to sync)

**Step 2: Verify**

Run app. Click canvas:
- All animation freezes (approach, rotation, ramp timer, morph)
- Click again: everything resumes from where it left off
- Ramp timer progresses correctly after pause (doesn't skip ahead)
- OrbitControls drag still works (not confused with click)

**Step 3: Commit**

```bash
git add src/main.js
git commit -m "click to toggle global pause instead of auto-rotate"
```

---

### Task 4: Change defaults (morphEnabled, rampDuration)

**Files:**
- Modify: `src/main.js:92-144` (DEFAULTS)

**Step 1: Update defaults**

In DEFAULTS, change:
- `rampDuration: 0.0` → `rampDuration: 2.0`
- `morphEnabled: false` → `morphEnabled: true`

**Step 2: Verify**

Clear localStorage (`localStorage.removeItem('chaos-merkaba-viz-settings')`) and reload. Confirm:
- Ramp Duration slider shows 2.0
- Morph Enabled checkbox is checked
- After fusion + lock, speed ramps over 2 minutes and morph appears at 80%

**Step 3: Commit**

```bash
git add src/main.js
git commit -m "default morph enabled and 2-minute ramp duration"
```

---

### Task 5: Add resetRamp helper and wire onChange handlers

**Files:**
- Modify: `src/main.js:249-259` (near reset function — add resetRamp)
- Modify: `src/main.js:421-426` (exports)
- Modify: `src/controls.js:3-7` (imports)
- Modify: `src/controls.js:21-26` (onChange handlers)

**Step 1: Create resetRamp() in main.js**

Add after the existing `reset()` function:

```javascript
// Reset ramp to base speed (called when ramp-affecting params change)
function resetRamp() {
  if (params.rampStartTime === null || !params.fused) return;
  params.rampStartTime = performance.now();
  params.rampBaseSpeed = params.rotationSpeed;
  params.pausedDuration = 0;
  params.lockAchieved = false;
}
```

**Step 2: Export resetRamp**

Add `resetRamp` to the export list in main.js.

**Step 3: Import resetRamp in controls.js**

Add `resetRamp` to the import from `'./main.js'`.

**Step 4: Wire onChange handlers**

In `src/controls.js`, update these onChange handlers:

`rampDuration` (line 25):
```javascript
rotation.add(params, 'rampDuration', 0.0, 5.0, 0.1).name('Ramp Duration (min)')
  .onChange(() => { resetRamp(); saveSettings(); });
```

`rampMaxSpeed` (line 26):
```javascript
rotation.add(params, 'rampMaxSpeed', 0.0, 20.0, 0.1).name('Ramp Max Speed')
  .onChange(() => { resetRamp(); saveSettings(); });
```

`fusionMode` (lines 21-22):
```javascript
rotation.add(params, 'fusionMode', ['Unlock', 'Spin Lock CW', 'Spin Lock CCW']).name('Fusion Mode')
  .onChange(() => { params.lockAchieved = false; resetRamp(); saveSettings(); });
```

`lockShape` (lines 23-24):
```javascript
rotation.add(params, 'lockShape', ['Stella Octangula', 'Merkaba']).name('Lock Shape')
  .onChange(() => { params.lockAchieved = false; resetRamp(); rebuildChaosSphere(); saveSettings(); });
```

**Step 5: Verify**

Run app. Let it fuse and ramp up partially, then:
- Change Ramp Duration → speed drops to base, ramp restarts, morph resets
- Change Ramp Max Speed → same behavior
- Switch Fusion Mode → ramp resets, morph disappears, lock re-seeks
- Switch Lock Shape → ramp resets, lock re-seeks, chaos sphere rebuilds

**Step 6: Commit**

```bash
git add src/main.js src/controls.js
git commit -m "reset ramp and morph when ramp parameters or mode change"
```

---

## Verification Checklist

1. Fresh load (clear localStorage): morph enabled, ramp 2min, no auto-rotate checkbox
2. Click pauses ALL animation; click again resumes
3. Ramp timer correct after pause (no time skip)
4. Changing rampDuration/rampMaxSpeed resets ramp from base speed
5. Changing fusionMode/lockShape resets ramp and lock
6. Existing localStorage settings still load correctly (minus autoRotate)
7. Reset Defaults button works correctly
8. Keyboard +/- still cancels ramp
