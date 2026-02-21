---
title: "feat: Camera roll on horizontal drag"
type: feat
status: completed
date: 2026-02-21
origin: docs/brainstorms/2026-02-21-camera-roll-controls-brainstorm.md
---

# feat: Camera roll on horizontal drag

## Overview

Replace horizontal mouse drag from azimuthal orbit to camera roll (head-tilt). Since the merkaba rotates continuously around Y, horizontal orbiting just shifts the phase — not visually interesting. Camera roll tilts the spin axis in the viewport, providing a genuinely new perspective.

(see brainstorm: docs/brainstorms/2026-02-21-camera-roll-controls-brainstorm.md)

## Key Decisions (from brainstorm)

1. Horizontal drag = camera roll (tilt around view direction)
2. Vertical drag unchanged (polar orbit via OrbitControls)
3. Roll persists with damping, accumulates
4. Transient state — not saved in presets, resets on page reload
5. Zoom, pan, click-to-pause unaffected
6. Double-click resets roll to upright with smooth animation

## Critical Technical Correction

**Do NOT modify `camera.up`.** OrbitControls computes an internal quaternion `_quat` once at construction from the initial `camera.up` and reuses it every frame. Modifying `camera.up` creates a mismatch that causes polar orbit to drift/break at higher roll angles.

**Instead:** Apply roll as a post-`orbitControls.update()` rotation directly on `camera.quaternion` around the camera's local Z-axis. This preserves OrbitControls' assumption that `camera.up` is always `(0, 1, 0)`.

## Implementation

All changes are in `src/main.js`. No new files. No changes to `controls.js` or presets.

### Step 1: Lock OrbitControls azimuth

After OrbitControls construction (~line 472), lock horizontal orbit:

```js
orbitControls.minAzimuthAngle = 0;
orbitControls.maxAzimuthAngle = 0;
```

Lock to 0 since the camera starts at `(0, 0, 6)` with azimuth 0.

### Step 2: Add roll state variables

Module-level variables near the existing `pointerStart` declaration (~line 482):

```js
let rollAngle = 0;           // current accumulated roll (radians)
let rollDelta = 0;           // pending roll from current drag (radians, for damping)
let isDraggingRoll = false;  // whether a roll drag is active
let rollResetActive = false; // whether the reset animation is running
```

### Step 3: Add pointermove handler for roll

Add a `pointermove` listener on `renderer.domElement` (after existing pointer handlers, ~line 495). Track horizontal delta and accumulate into `rollDelta`:

```js
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!pointerStart) return;
  isDraggingRoll = true;
  rollResetActive = false; // cancel any reset animation
  const sensitivity = (2 * Math.PI) / renderer.domElement.clientHeight;
  rollDelta += e.movementX * sensitivity;
});
```

Only fires when a drag is active (`pointerStart` is set on `pointerdown`). Right-click drags are handled by OrbitControls for panning — they also set `pointerStart`, so extend `pointerdown` to record the button and skip roll in `pointermove` if it was a right-click. Sensitivity matches OrbitControls' azimuthal rotation formula. `e.movementX` gives per-event delta.

### Step 4: Update pointerup to clear drag state

Augment the existing `pointerup` handler to reset `isDraggingRoll`:

```js
// Inside existing pointerup handler, after pause toggle logic:
isDraggingRoll = false;
```

### Step 5: Debounce click-to-pause for double-click coexistence

Replace the immediate pause toggle with a 300ms debounce. If a second click arrives within 300ms, cancel the pending toggle (it's a double-click):

```js
let pauseToggleTimeout = null;

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerStart) return;
  const dx = e.clientX - pointerStart.x;
  const dy = e.clientY - pointerStart.y;
  if (dx * dx + dy * dy < 9) {
    if (pauseToggleTimeout) {
      clearTimeout(pauseToggleTimeout);
      pauseToggleTimeout = null;
    } else {
      pauseToggleTimeout = setTimeout(() => {
        params.paused = !params.paused;
        pauseToggleTimeout = null;
      }, 300);
    }
  }
  pointerStart = null;
  isDraggingRoll = false;
});
```

### Step 6: Add dblclick handler for roll reset

```js
renderer.domElement.addEventListener('dblclick', () => {
  // Normalize roll to [-PI, PI] for shortest path back to 0
  rollAngle = Math.atan2(Math.sin(rollAngle), Math.cos(rollAngle));
  rollResetActive = true;
  rollDelta = 0;
});
```

### Step 7: Apply roll in animation loop

Add reusable objects at module level (near roll state variables, avoid per-frame allocations):

```js
const _rollQuat = new THREE.Quaternion();
const _viewDir = new THREE.Vector3();
```

Between `orbitControls.update()` (line 653) and `renderer.render()` (line 654):

```js
orbitControls.update();

// Apply camera roll
if (rollResetActive) {
  // Animate roll toward 0 with fast ease-out
  rollAngle *= Math.pow(1 - 0.1, dt * 60);
  if (Math.abs(rollAngle) < 0.001) {
    rollAngle = 0;
    rollResetActive = false;
  }
} else {
  // Apply drag delta with damping (matching OrbitControls' pattern)
  rollAngle += rollDelta * 0.05;            // dampingFactor scales the delta
  rollDelta *= (1 - 0.05);                  // decay the delta
  if (Math.abs(rollDelta) < 0.0001) rollDelta = 0;
}

// Rotate camera around its local Z-axis by rollAngle
if (rollAngle !== 0) {
  _viewDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _rollQuat.setFromAxisAngle(_viewDir, rollAngle);
  camera.quaternion.premultiply(_rollQuat);
}

renderer.render(scene, camera);
```

## Acceptance Criteria

- [x] Horizontal left-drag tilts camera (visible as rotated scene)
- [x] Vertical drag still orbits over/under the shape correctly, even when rolled
- [x] Roll persists after mouse release, with smooth damping momentum
- [x] Double-click smoothly animates roll back to upright
- [x] Single click still toggles pause (no flicker on double-click)
- [x] Scroll zoom works normally
- [x] Right-click pan works normally
- [x] Page reload resets roll to 0
- [x] Preset switching does not affect roll
- [x] No per-frame object allocations (reuse quaternion/vector)

## Sources

- **Origin brainstorm:** [docs/brainstorms/2026-02-21-camera-roll-controls-brainstorm.md](docs/brainstorms/2026-02-21-camera-roll-controls-brainstorm.md) — key decisions: roll via head-tilt, lock azimuth + custom overlay approach, transient state, double-click reset
- **OrbitControls setup:** `src/main.js:470-472`
- **Existing pointer handlers:** `src/main.js:481-494`
- **Animation loop:** `src/main.js:553-656` (orbitControls.update at 653, render at 654)
- **Camera init:** `src/main.js:17-18`
