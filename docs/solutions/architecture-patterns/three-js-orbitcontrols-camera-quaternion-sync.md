---
title: "Custom Camera Roll with OrbitControls via Post-Update Quaternion Sync"
date: 2026-02-21
category: architecture-patterns
tags:
  - three-js
  - camera-controls
  - quaternion
  - orbitcontrols
  - pointer-events
component: Camera Control System
severity: medium
symptoms:
  - "Horizontal mouse drag (azimuthal orbit) visually redundant with shape's Y-axis rotation"
  - "Modifying camera.up to achieve roll breaks OrbitControls polar orbit at higher angles"
  - "Double-click reset causes pause-state flicker from two rapid pointerup events"
root_cause: "OrbitControls caches internal _quat from camera.up at construction and never recalculates it"
---

# Custom Camera Roll with OrbitControls via Post-Update Quaternion Sync

## Problem

In a Three.js visualization where the shape rotates continuously around Y, OrbitControls' horizontal orbit (azimuthal rotation) just shifts the phase of the rotation — not visually interesting. We needed camera roll (head-tilt) on horizontal drag instead, while keeping vertical drag (polar orbit) working correctly.

## Root Cause

OrbitControls computes an internal quaternion `_quat` **once at construction** from `camera.up` and reuses it every frame for spherical coordinate transformations. It assumes `camera.up` never changes.

If you modify `camera.up` to achieve roll, the stale `_quat` creates a mismatch. Polar orbit drifts sideways, and at higher roll angles, vertical drags orbit in completely wrong directions. This is not a bug in OrbitControls — it's a design assumption that `camera.up` remains constant.

## What Didn't Work

The initial approach was to rotate `camera.up` around the view direction after `orbitControls.update()`:

```js
// BROKEN: mutating camera.up breaks OrbitControls' internal _quat
const viewDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
const rollQuat = new THREE.Quaternion().setFromAxisAngle(viewDir, rollAngle);
camera.up.applyQuaternion(rollQuat);
```

This causes OrbitControls' polar orbit to drift because `_quat` (based on the original up) no longer matches the actual `camera.up`.

## Working Solution

**Never touch `camera.up`.** Apply roll as a post-update rotation directly on `camera.quaternion` around the camera's local Z-axis.

### 1. Lock OrbitControls azimuth

```js
orbitControls.minAzimuthAngle = 0;
orbitControls.maxAzimuthAngle = 0;
```

### 2. Track roll state (module-level, transient)

```js
let rollAngle = 0;
let rollDelta = 0;
let rollResetActive = false;
const _rollQuat = new THREE.Quaternion();  // reuse, no per-frame alloc
const _viewDir = new THREE.Vector3();
```

### 3. Accumulate horizontal drag into rollDelta

```js
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!pointerStart || pointerButton !== 0) return;  // left-button only
  rollResetActive = false;
  const sensitivity = (2 * Math.PI) / renderer.domElement.clientHeight;
  rollDelta += e.movementX * sensitivity;
});
```

Track `pointerButton` from `pointerdown` — `pointermove.button` is unreliable.

### 4. Apply roll after orbitControls.update(), before render

```js
orbitControls.update();

// Damping (matches OrbitControls' pattern: dampingFactor 0.05)
rollAngle += rollDelta * 0.05;
rollDelta *= 0.95;

// Apply roll rotation around camera's local Z-axis
if (rollAngle !== 0) {
  _viewDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _rollQuat.setFromAxisAngle(_viewDir, rollAngle);
  camera.quaternion.premultiply(_rollQuat);
}

renderer.render(scene, camera);
```

OrbitControls' assumptions stay intact because `camera.up` is never modified. The roll is reapplied fresh each frame from the `rollAngle` variable.

### 5. Double-click reset with pause debounce

A double-click fires two `pointerup` events before `dblclick`. Without debouncing, pause toggles twice (flickers). Solution: delay pause toggle by 300ms; cancel it if a second click arrives.

```js
// Normalize to [-PI, PI] for shortest path, then animate toward 0
rollAngle = Math.atan2(Math.sin(rollAngle), Math.cos(rollAngle));
rollResetActive = true;
```

Use `Math.atan2(Math.sin(a), Math.cos(a))` for normalization — JavaScript's `%` preserves sign on negative numbers, making the naive modulo approach fail.

## Prevention Patterns

### Never modify camera.up with active OrbitControls

OrbitControls caches quaternion from `camera.up` at construction. Apply custom rotations as post-update quaternion operations on `camera.quaternion` instead.

### Debounce click handlers when dblclick exists

Browser fires two `pointerup` before `dblclick`. Any click handler on the same element needs a ~300ms debounce window.

### Track pointer button from pointerdown

`pointermove.button` is unreliable (always 0 during movement). Store `e.button` from `pointerdown` and check the stored value in `pointermove`.

### Normalize angles with atan2, not modulo

```js
// Correct: works for all angles including negative
Math.atan2(Math.sin(angle), Math.cos(angle))

// Broken for negative angles in JavaScript
((angle + Math.PI) % (2 * Math.PI)) - Math.PI
```

### Pre-allocate Three.js objects outside animation loops

Allocating `new THREE.Quaternion()` or `new THREE.Vector3()` per frame causes GC pressure. Create once at module scope and reuse with `.set()` / `.copy()`.

## Related Documentation

- [Brainstorm: Camera Roll Controls](../brainstorms/2026-02-21-camera-roll-controls-brainstorm.md)
- [Plan: Camera Roll Controls](../plans/2026-02-21-feat-camera-roll-controls-plan.md)
- [Pattern: Preset-Based Settings Panel](preset-based-settings-panel-pattern.md) — transient vs persisted state patterns
