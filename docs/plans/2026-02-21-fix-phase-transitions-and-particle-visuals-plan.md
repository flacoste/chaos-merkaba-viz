---
title: "fix: Phase transition behavior and particle visual issues"
type: fix
status: completed
date: 2026-02-21
origin: docs/plans/2026-02-20-feat-phase-system-and-particle-emission-plan.md
---

# Fix Phase Transition Behavior and Particle Visuals

## Overview

Seven fixes to the phase state machine parameter-change behavior and the particle streak visual quality based on user testing feedback. The state machine restarts too aggressively on parameter changes, and the particle streaks have two visual defects (trailing into shape geometry and rendering through opaque objects).

## Proposed Solution

### Fix 1: fusionMode restarts at FUSE_LOCK, not APPROACH

**File:** `src/phase-manager.js:240-243`

**Problem:** `onParamChange('fusionMode')` calls `machine.restart()` which goes back to APPROACH. The approach phase is about separation — changing between Unlock/Spin Lock only affects locking behavior.

**Fix:** Replace `machine.restart()` with `machine.transitionTo(FUSE_LOCK)`. This re-enters the fuse/lock phase with the new fusion mode. If currently in APPROACH, do nothing (fusionMode will apply when FUSE_LOCK is naturally reached).

```javascript
if (paramName === 'fusionMode') {
  const currentIdx = PHASE_ORDER.indexOf(machine.getCurrentState());
  if (currentIdx >= 1) { // at or past FUSE_LOCK
    machine.transitionTo(FUSE_LOCK);
  }
  return;
}
```

### Fix 2: Emit params applied live without restart

**File:** `src/phase-manager.js:12-23`

**Problem:** `emitDelay`, `coneAngle`, `emissionRate`, `particleSpeed` are in `PARAM_PHASE_MAP` mapped to EMIT. Changing any of them during EMIT or STEADY triggers `transitionTo(EMIT)`, restarting the phase (resetting delay timer, stopping emission, etc.).

**Fix:** Remove these four params from `PARAM_PHASE_MAP`. They are already read fresh from `params` each frame:
- `params.emissionRate` → `main.js:463`
- `params.coneAngle` → `main.js:471`
- `params.particleSpeed` → `main.js:472`
- `params.emitDelay` → `phase-manager.js:149` (compared against accumulated time each frame)

After removal, `onParamChange()` will get `undefined` from the map and return early (no-op). New values take effect immediately on the next frame.

Also remove the `getPhaseManager().onParamChange(...)` calls from `controls.js:44-51` for these four params (leave just `saveSettings()`).

### Fix 3: emitEnabled toggle respects current state

**Files:** `src/phase-manager.js:238-280`

**Problem:** Toggling emitEnabled OFF during STEADY transitions to EMIT (skipped since disabled) → STEADY, but `ctx.emitting` is never set to false. Emission continues. Toggling it back ON transitions to EMIT which sets `ctx.emitting = false` and restarts the delay — confusing.

**Fix:** Special-case `emitEnabled` in `onParamChange`:

```javascript
if (paramName === 'emitEnabled') {
  if (!ctx.params.emitEnabled) {
    // Disabled: stop emission immediately
    ctx.emitting = false;
    ctx.emitAccumulator = 0;
  } else {
    // Enabled: if past EMIT, start emission immediately (skip delay)
    const currentIdx = PHASE_ORDER.indexOf(machine.getCurrentState());
    if (currentIdx >= PHASE_ORDER.indexOf(EMIT)) {
      ctx.emitting = true;
      ctx.emitRampElapsed = 0;  // 3-second ramp-in
      ctx.emitAccumulator = 0;
    }
  }
  return;
}
```

Remove `emitEnabled` from `PARAM_PHASE_MAP`.

### Fix 4: morphEnabled toggle on during STEADY restores chaos sphere

**File:** `src/phase-manager.js:247-255`

**Problem:** The morphEnabled handler only acts when currently in TRANSFORM. From STEADY, toggling morph ON does nothing — `ctx.morphProgress` stays 0.

**Fix:** Extend the handler to also set `ctx.morphProgress = 1.0` when past TRANSFORM:

```javascript
if (paramName === 'morphEnabled') {
  if (!ctx.params.morphEnabled) {
    ctx.morphProgress = 0;
  } else {
    // If past TRANSFORM, restore morph instantly
    const currentIdx = PHASE_ORDER.indexOf(machine.getCurrentState());
    if (currentIdx > PHASE_ORDER.indexOf(TRANSFORM)) {
      ctx.morphProgress = 1.0;
    }
  }
  if (machine.getCurrentState() === TRANSFORM) {
    machine.transitionTo(TRANSFORM);
  }
  return;
}
```

The animation loop already handles `ctx.morphProgress > 0` by showing the chaos sphere and fading tetrahedra (`main.js:431-452`).

### Fix 5: approachDuration only affects APPROACH phase

**File:** `src/phase-manager.js:12-23`

**Problem:** `approachDuration` is in `PARAM_PHASE_MAP` mapped to APPROACH. When past APPROACH (e.g., in FUSE_LOCK), changing it triggers `transitionTo(APPROACH)` which restarts the entire sequence.

**Fix:** Remove `approachDuration` from `PARAM_PHASE_MAP`. Add special-case handling:

```javascript
if (paramName === 'approachDuration') {
  if (machine.getCurrentState() === APPROACH) {
    machine.transitionTo(APPROACH);
  }
  return;
}
```

Remove the `getPhaseManager().onParamChange(...)` call from `controls.js:16` and replace with the phase-check only approach. Actually, keep the onParamChange call — the special case handles the "only if in APPROACH" logic.

### Fix 6: Offset particle spawn position from surface

**File:** `src/particles.js:130-133`

**Problem:** Particles spawn exactly at the emission point on the shape surface. The streak trail extends backward from the head INTO the geometry, creating visible artifacts at the emission point.

**Fix:** Offset the spawn position outward along the emission normal by a small amount. Combined with Fix 7 (depth testing), the trail portion behind geometry will be properly hidden.

```javascript
// In emit(), after reading ep:
const SPAWN_OFFSET = 0.12;
offsets[s3]     = ep.px + ep.nx * SPAWN_OFFSET;
offsets[s3 + 1] = ep.py + ep.ny * SPAWN_OFFSET;
offsets[s3 + 2] = ep.pz + ep.nz * SPAWN_OFFSET;
```

The offset value (0.12) is small enough to look connected to the emission point but large enough to clear the surface geometry.

### Fix 7: Enable depth testing on particle streaks

**File:** `src/materials.js:77`, `src/main.js:458`

**Problem:** The streak material has `depthTest: false`, so particles always render on top of everything — including when they're behind the chaos sphere or tetrahedra. This breaks spatial perception.

**Fix:** Two changes:
1. Change `depthTest: false` to `depthTest: true` in `createStreakMaterial()` (keep `depthWrite: false` — particles shouldn't occlude each other)
2. Set `particleSystem.mesh.renderOrder = 1` when creating the particle system in `main.js`, ensuring particles render after the scene geometry writes to the depth buffer

```javascript
// materials.js line 77:
depthTest: true,   // was: false

// main.js line 458, after creating particle system:
particleSystem.mesh.renderOrder = 1;
```

This correctly occludes particles behind opaque geometry and the chaos sphere (which writes to depth buffer). `AdditiveBlending` remains order-independent so no sorting is needed among particles.

## Acceptance Criteria

- [x] Changing fusionMode restarts at FUSE_LOCK, not APPROACH — separation is preserved
- [x] Changing coneAngle, emissionRate, particleSpeed, emitDelay during emission applies immediately without restarting
- [x] Toggling emitEnabled OFF during STEADY stops particle emission immediately
- [x] Toggling emitEnabled ON during STEADY starts emission with 3s ramp (no delay wait)
- [x] Emission controls drawer remains functional — can toggle emit on/off repeatedly
- [x] Toggling morphEnabled ON during STEADY brings back the chaos sphere instantly
- [x] Toggling morphEnabled OFF during STEADY hides the chaos sphere (already works)
- [x] Changing approachDuration after leaving APPROACH has no effect
- [x] Changing approachDuration during APPROACH restarts with new duration
- [x] No visible streak artifacts at emission points (no trail clipping into geometry)
- [x] Particles behind the chaos sphere/tetrahedra are properly occluded
- [x] Particles still glow additively when overlapping each other

## Files Modified

| File | Changes |
|------|---------|
| `src/phase-manager.js` | Rewrite `onParamChange`: fusionMode → FUSE_LOCK, special-case emitEnabled/morphEnabled/approachDuration, remove 5 params from PARAM_PHASE_MAP |
| `src/particles.js` | Add spawn offset along emission normal in `emit()` |
| `src/materials.js` | Change `depthTest: false` → `depthTest: true` in streak material |
| `src/main.js` | Set `renderOrder = 1` on particle mesh |
| `src/controls.js` | Remove unnecessary `onParamChange()` calls for live-applied params |

## Sources

- Origin plan: `docs/plans/2026-02-20-feat-phase-system-and-particle-emission-plan.md`
- Phase manager: `src/phase-manager.js:238-280` (onParamChange)
- Animation loop emission: `src/main.js:455-478`
- Streak material: `src/materials.js:28-81`
- Particle spawn: `src/particles.js:108-150`
