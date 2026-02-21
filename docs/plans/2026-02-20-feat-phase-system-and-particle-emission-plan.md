---
title: "feat: Phase State Machine and Particle Emission"
type: feat
status: active
date: 2026-02-20
deepened: 2026-02-21
origin: docs/brainstorms/2026-02-20-phase-system-and-particle-emission-brainstorm.md
---

# Phase State Machine and Particle Emission

## Overview

Refactor the animation system around a formal phase state machine and add a new particle emission visualization. The current codebase manages animation state through scattered boolean flags (`fused`, `lockAchieved`, `morphProgress`, etc.) checked inline in the animation loop. This refactor replaces that with an explicit phase progression: Approach → Fuse & Lock → Transform → Emit. The Emit phase is a new feature: trailing streak particles emitted from shape vertices/ray tips in configurable conic sprays.

## Problem Statement / Motivation

With three visualizations already (approach, lock/morph, chaos sphere), adding a fourth (particle emission) would further complicate the implicit boolean-flag state management. The animation loop in `main.js` (lines 322–429) is a nested conditional tree that is increasingly difficult to extend. A formal state machine:

- Makes phase transitions explicit and debuggable
- Provides clean lifecycle hooks (`enter`/`update`/`exit`) per phase
- Simplifies the animation loop to a single `phaseManager.update()` call
- Makes adding future phases straightforward

(see brainstorm: `docs/brainstorms/2026-02-20-phase-system-and-particle-emission-brainstorm.md`)

## Proposed Solution

### Phase State Machine

New module `src/phase-manager.js` implementing a linear state machine with 4 phases:

| Phase | Name | Entry Condition | Exit Condition | Skippable? |
|-------|------|----------------|----------------|------------|
| 1 | `APPROACH` | Initial state | Approach duration elapsed (separation reaches 0) | Yes (duration = 0) |
| 2 | `FUSE_LOCK` | Separation = 0 | `lockAchieved = true`. In Unlock mode: immediate (treated as "already locked"). | No |
| 3 | `TRANSFORM` | Lock achieved + morph enabled | `morphProgress = 1.0` (speed reaches ramp max) | Yes (morph disabled) |
| 4 | `EMIT` | Top speed reached + emit delay elapsed | Emission fully ramped → advances to STEADY | Yes (emit disabled) |

After the last enabled phase completes (or is skipped), the system enters a `STEADY` terminal state where all visuals persist, particles continue emitting, and no further phase transitions occur.

**Phase progression rules** (see brainstorm):
- Linear only — phases never go backward
- Skippable phases are bypassed entirely; the state machine advances to the next enabled phase
- Rotation and speed ramp run independently, not owned by any single phase
- Phase 2 (Fuse & Lock) is always mandatory

**Parameter change behavior:**
- Changes relevant to the **current phase** → restart that phase (`exit()` then `enter()`)
- Changes relevant to **future phases** → stored, applied when that phase is entered
- **fusionMode changes** → always trigger a full animation restart (back to Phase 1)

**Parameter-to-phase relevance map:**

| Parameter | Relevant Phase(s) |
|-----------|--------------------|
| `approachDuration` | Phase 1 (Approach) |
| `fusionMode` | **Full restart** (affects all phases) |
| `lockShape` | Phase 2 (Fuse & Lock) |
| `directionA`, `directionB` | No phase restart — applied immediately |
| `rotationSpeed` | No phase restart — applied immediately |
| `rampDuration`, `rampMaxSpeed` | Phase 3 (Transform) + Phase 4 (Emit) timing |
| `morphEnabled` | Phase 3 (Transform) — if disabled while in Phase 3, skip to next |
| `emitEnabled` | Phase 4 (Emit) |
| `emitDelay`, `coneAngle`, `emissionRate`, `particleSpeed` | Phase 4 (Emit) |
| `scale`, colors, render mode | No phase restart — applied immediately as visual-only changes |

#### Research Insights: State Machine Architecture

**Recommended pattern: Plain object map with function values.** Each state is a dictionary entry with `enter`, `update`, `exit` functions. The runner handles transitions, guard evaluation, and skip-forward logic. States return signal strings (`'next'`, `'restart'`, or a specific state name) from `update()` — the runner interprets them.

**Key implementation detail — the runner:**

```javascript
function createSequenceMachine(stateDefinitions, stateOrder, ctx) {
  let currentName = null, currentState = null;

  function transitionTo(name) {
    if (currentState && currentState.exit) currentState.exit(ctx);
    let idx = stateOrder.indexOf(name);
    // Skip states whose canEnter guard returns false
    while (idx < stateOrder.length) {
      const candidate = stateDefinitions[stateOrder[idx]];
      if (!candidate.canEnter || candidate.canEnter(ctx)) break;
      idx++;
    }
    if (idx >= stateOrder.length) idx = stateOrder.length - 1;
    currentName = stateOrder[idx];
    currentState = stateDefinitions[currentName];
    ctx.stateElapsed = 0;
    if (currentState.enter) currentState.enter(ctx);
  }

  function update(dt) {
    if (!currentState) return;
    const signal = currentState.update(ctx, dt);
    if (signal === 'next') {
      const nextIdx = stateOrder.indexOf(currentName) + 1;
      if (nextIdx < stateOrder.length) transitionTo(stateOrder[nextIdx]);
    } else if (signal === 'restart') transitionTo(stateOrder[0]);
    else if (signal) transitionTo(signal);
  }

  transitionTo(stateOrder[0]);
  return { update, transitionTo, getCurrentState: () => currentName };
}
```

**Context object pattern:** Bundle shared state into a single context object passed to every lifecycle method. The context *references* `params` and Three.js objects (does not own them) and *owns* transient state like `stateElapsed` and `morphProgress`. No back-references to the machine — states communicate via return signals only.

**Idempotent enter/exit rules:**
- Always *set* to known values in `enter()`, never toggle
- Guard resource allocation: `if (ctx.tempMesh) { scene.remove(...); }` before creating fresh
- The runner must always call `exit()` before re-entering the same state (standard UML self-transition semantics)

**Testing strategy:** The pure-function nature means tests need no browser or Three.js renderer. Create minimal stub objects, pass synthetic `dt` values (e.g., `dt = 30.0` to simulate 30 seconds in one call), assert on context values.

### Particle Emission System

New module `src/particles.js` implementing a GPU-instanced particle system:

- **Rendering:** `THREE.InstancedBufferGeometry` with a thin quad base geometry and per-instance attributes (position, velocity, color, age). A custom `ShaderMaterial` orients each quad along its velocity vector to produce trailing streaks. Rendered as `THREE.Mesh` (not `THREE.Points`).
- **Pool:** Pre-allocated `Float32Array` buffers for position (×3), velocity (×3), color (×4). Fixed pool of **4096 particles**. Dead particles are swap-compacted to keep alive particles contiguous, then `geometry.instanceCount = aliveCount` limits GPU work.
- **Emission source (adaptive):** Ray tips when chaos sphere is visible (`morphProgress > 0`); tetrahedron vertex positions when not morphed
- **Particle style:** Trailing streaks — vertex shader builds a velocity-aligned billboard from each quad, stretching it along the velocity direction with soft cross-section falloff and head-to-tail taper
- **Color:** Each particle inherits the RGBA color of its emission point (from per-vertex color system)
- **Spray:** Conic spread with configurable angle (5°–45°, default 15°), uniform in solid angle
- **Lifetime:** Particles travel at constant opacity and size until they leave the visible area (world-space distance check: despawn at `distance > 20` units from origin). No fade.
- **Emission ramp-in:** 3-second linear ramp from 0 to full emission rate when Emit phase activates
- **Emission rate:** 1–50 particles/sec/point, default 10. At 8 points × 50/sec = 400/sec max, well within the 4096 pool
- **Particle speed:** 1–10 units/sec, default 3. Controls how fast particles travel outward from emission points
- **Pause:** Particles freeze when `params.paused` is true (consistent with all other animation)

**Shader approach:** Custom `ShaderMaterial` with velocity-aligned billboard technique:

- Vertex shader: reads per-instance `aOffset` (position), `aVelocity`, `aColor`, `aAge`. Computes a local frame from velocity and camera direction: `forward = normalize(velocity)`, `right = cross(forward, toCamera)`. Displaces quad vertices along `forward` (streak length) and `right` (streak width). Uses auto-injected `cameraPosition`, `viewMatrix`, `projectionMatrix`.
- Fragment shader: soft cross-section falloff (`1 - (distFromCenter)^2`), head-to-tail taper via `smoothstep`, head glow highlight. `AdditiveBlending`, `depthWrite: false`, `transparent: true`, `side: DoubleSide`.

#### Research Insights: Why InstancedBufferGeometry Over THREE.Points

**Critical finding:** `gl_PointSize` always produces a **square** screen-aligned quad. This is a hardware-level WebGL constraint — there is no way to create directional, velocity-elongated streaks with point sprites. Additional limitations:

- `gl_PointSize` is capped at 63px on many GPUs (the WebGL spec only guarantees 1.0)
- Point sprites cannot be rotated in screen space
- `gl_PointCoord` axes are fixed — no way to orient a texture along the velocity

**`InstancedBufferGeometry` with thin quads** is the industry-standard solution (used by Unity's "Stretched Billboard", Unreal's trail particles, professional WebGL demos). The approach:

1. Base geometry: a unit `PlaneGeometry` (4 vertices, 2 triangles)
2. Per-instance data via `InstancedBufferAttribute`: position, velocity, color, age
3. Vertex shader constructs orientation from velocity + camera direction
4. Single draw call for all particles (same performance as `THREE.Points`)

**Decision matrix:**

| Approach | Streak Quality | Performance | Why |
|----------|---------------|-------------|-----|
| `THREE.Points` + `gl_PointSize` | Cannot do streaks | Best | Round only — square quads |
| **`InstancedBufferGeometry` + thin quads** | **Excellent** | **Excellent** | **Chosen — velocity-aligned billboards** |
| `THREE.InstancedMesh` + `setMatrixAt` | Good | Higher CPU | Matrix construction overhead per particle |
| `THREE.Line2` / `LineMaterial` | Mediocre | OK | No glow/softness, known artifacts |
| `THREE.LineSegments` | 1px only | Best | `lineWidth > 1` broken cross-browser (ANGLE) |

#### Research Insights: Cone Sampling Math

**Uniform solid-angle sampling** is the only correct formula for visually even particle spray. Sampling `theta` linearly causes visible center clustering.

The formula (from Physically Based Rendering, Pharr et al.):
```
cosTheta = 1 - xi1 * (1 - cos(thetaMax))
sinTheta = sqrt(1 - cosTheta^2)
phi = 2 * PI * xi2
```

**Orthonormal basis construction** uses the Duff et al. (2017) method — branchless, no singularity at any direction (including exact -Z), no trigonometric functions:

```javascript
function createEmissionBasis(nx, ny, nz) {
  const sign = nz >= 0 ? 1.0 : -1.0;
  const a = -1.0 / (sign + nz);
  const b = nx * ny * a;
  return {
    nx, ny, nz,
    t1x: 1.0 + sign * nx * nx * a, t1y: sign * b, t1z: -sign * nx,
    t2x: b, t2y: sign + ny * ny * a, t2z: -ny,
  };
}
```

**Precompute per emitter** (8 calls total at setup, or when directions change due to rotation). Only recompute `cos(thetaMax)` when cone angle slider changes. Per-particle cost: 2 `Math.random()`, 1 `sqrt`, 1 `cos`, 1 `sin`, 12 multiplies — negligible.

**Zero-allocation variant** writes directly into `Float32Array` via `sampleConeDirectionInto(out, offset, basis, cosThetaMax)` to avoid object creation in hot loops.

#### Research Insights: Performance

**CPU budget:** 4096 particles with simple `position += velocity * dt` costs ~0.2ms per frame. Well within the 16.67ms budget at 60fps. CPU bottleneck threshold is ~50,000 particles.

**Buffer strategy:**
- Use `geometry.instanceCount = aliveCount` to skip dead particles on the GPU entirely (not `setDrawRange`, which controls base geometry vertices, not instances)
- **Swap-compact** dead particles: when particle `i` dies, swap its data with the last alive particle and decrement `aliveCount`. This keeps alive particles contiguous for `instanceCount`
- Use `DynamicDrawUsage` on per-frame-updated attributes (position, age). Set before first render — cannot be changed after.
- **Velocities need GPU upload** — the vertex shader reads velocity to orient streak quads. Mark the velocity `InstancedBufferAttribute` as `DynamicDrawUsage`.
- Use **separate buffers** per attribute (not interleaved). CPU writes are sequential per-attribute; interleaved layout defeats the prefetcher for strided writes. Three.js `InterleavedBufferAttribute` also has limited API support for `addUpdateRange`.

**Frustum culling:** Set `mesh.frustumCulled = false`. Particles span the entire viewport; the bounding sphere test would always pass but requires `computeBoundingSphere()` on each position update. Disabling it avoids both the recomputation and a class of disappearing-particle bugs from stale bounding volumes.

**Fill rate:** At 4096 particles with ~10×10 pixel coverage each, total fragment count is ~400K — negligible on desktop. `AdditiveBlending` is order-independent (no depth sorting needed) and cheaper than normal alpha blending.

**Disposal order:** Remove from scene → dispose geometry → dispose material (and any textures in uniforms) → null references. Monitor with `renderer.info.memory`.

### Approach Duration Change

Replace `approachSpeed` (units/sec) with `approachDuration` (minutes):
- Range: 0–5 minutes, default 0.5 minutes (30 seconds)
- Speed derived as `MAX_SEPARATION / (approachDuration * 60)` each frame
- Duration = 0 → shapes start fused (skip Phase 1, enter Phase 2 immediately)

### Ramp-Disabled Behavior

When `rampDuration = 0` (no speed ramp):
- Current `rotationSpeed` is treated as "top speed"
- Phase 3 (Transform): morph triggers immediately at lock (instant completion, `morphProgress = 1`)
- Phase 4 (Emit): emit delay timer starts immediately at lock (or after Transform completes)

### Phase Timers

All phase timers use **accumulated delta time** (not wall-clock `performance.now()`). This prevents phantom time accumulation when the browser tab is backgrounded, and respects the existing pause system. The current ramp timer (`rampStartTime`-based) should also be migrated to accumulated delta time.

#### Research Insights: Accumulated Delta Time

The game loop owns timing. The state machine receives `dt` as a parameter and never calls `performance.now()` or `requestAnimationFrame` itself. Each state tracks its own elapsed time by accumulating `dt`:

```javascript
enter(ctx) { ctx.stateElapsed = 0; },
update(ctx, dt) {
  ctx.stateElapsed += dt;
  const progress = Math.min(ctx.stateElapsed / duration, 1.0);
  // ...
}
```

**Benefits over wall-clock:**
- Pause is automatic — if `update` is not called during pause, `stateElapsed` does not advance. No `pausedDuration` bookkeeping.
- State restarts are trivial — reset `stateElapsed = 0` in `enter()`.
- Deterministic — the same sequence of `dt` values produces the same result regardless of when they occur. Enables testing with synthetic `dt`.
- No clock synchronization bugs across pause boundaries.

## Technical Considerations

### Architecture Impacts

**Files modified:**
- `src/main.js` — Animation loop gutted and delegated to phase manager. Boolean flags removed from `params`. `DEFAULTS` updated with new params. `computeEffectiveSpeed()` extracted as a shared utility. `reset()` delegates to phase manager. Keyboard +/- speed controls removed.
- `src/controls.js` — Approach Speed replaced with Approach Duration. New Emission folder added after Chaos Sphere. Emission sub-controls hidden when emit disabled (matching Glass folder pattern).
- `src/materials.js` — New `createStreakMaterial()` factory function for the instanced particle shader.

**Files added:**
- `src/phase-manager.js` — State machine runner (`createSequenceMachine`), phase definitions with lifecycle methods, `onParamChange()` handler with parameter-to-phase mapping.
- `src/particles.js` — Particle system builder (InstancedBufferGeometry + instanced attributes), update loop, emission logic with cone sampling, swap-compact pool management, disposal.

**Files unchanged:**
- `src/tetrahedron.js` — No changes needed. Vertex positions accessed via `mesh.userData.originalVerts`.
- `src/chaos-sphere.js` — No changes needed. Ray tip positions accessed via `group.userData.rays` and `rayGroup.matrixWorld`.

### Performance Implications

- Particle system adds one draw call (all particles in a single instanced `THREE.Mesh`)
- At max emission (400 particles/sec, 4096 pool), CPU work is ~4096 position updates + bounds checks per frame (~0.2ms — negligible)
- Custom streak shader is lightweight (no texture sampling, arithmetic only)
- `DynamicDrawUsage` hint on position/velocity/age buffers for efficient GPU upload
- `geometry.instanceCount = aliveCount` ensures GPU only processes alive instances
- World-space distance check for despawn (cheaper than screen-space projection)
- `frustumCulled = false` avoids stale bounding sphere recomputation

### Unlock Mode Behavior

Unlock mode now allows all phases (see brainstorm). In Unlock mode:
- Phase 2 (Fuse & Lock) treats fusion as "immediately locked" — skip seeking, advance to next phase
- Transform and Emit proceed as normal
- This changes the current behavior where morph requires Spin Lock

## System-Wide Impact

- **State lifecycle:** The phase manager owns phase transitions. The animation loop becomes a thin dispatcher. Risk: circular dependency with `main.js` (controls already has this pattern — phase manager will follow the same getter/import approach).
- **Error propagation:** Phase `enter()`/`exit()` must be idempotent. If `exit()` disposes resources and is called twice (restart scenario), it must not throw. Rule: always *set* to known values, never toggle. Guard resource deallocation with null checks.
- **Integration test scenarios:** (1) Full pipeline with all phases enabled → particles emit. (2) Skip approach + morph disabled → particles from vertices. (3) Pause during transform, resume → morph continues. (4) Change fusionMode during emit → full restart. (5) Tab switch during ramp → no time jump on return.

## Acceptance Criteria

### Functional Requirements

- [ ] Phase state machine progresses linearly through Approach → Fuse & Lock → Transform → Emit → Steady
- [ ] Each phase can be skipped via its configuration (approach duration=0, morph disabled, emit disabled)
- [ ] Phase 2 (Fuse & Lock) is always mandatory and cannot be skipped
- [ ] Unlock mode allows all phases (treats fusion as immediately locked)
- [ ] Parameter changes restart current phase if relevant; fusionMode changes trigger full restart
- [ ] Approach Duration slider (0–5 min, default 0.5 min) replaces Approach Speed
- [ ] Particles emit as trailing streaks from 8 points in configurable conic sprays
- [ ] Particle color matches emission point's vertex color
- [ ] Emission source is adaptive: ray tips when morphed, vertex points when not
- [ ] Emit Delay slider (0–5 min, default 0.5 min) controls delay after reaching top speed
- [ ] Cone Angle slider (5°–45°, default 15°) controls spray spread
- [ ] Emission Rate slider (1–50/sec/point, default 10) controls particle density
- [ ] Particle Speed slider (1–10 units/sec, default 3) controls outward travel speed
- [ ] Particles travel to viewport edge at constant opacity/size, despawn off-screen
- [ ] Emission rate gradually builds over 3 seconds when Emit phase activates
- [ ] All new settings persist to localStorage following existing pattern
- [ ] Restart button resets to Phase 1 (or first enabled phase), disposes particles
- [ ] Reset Defaults resets all new params and disposes particle system
- [ ] Emission controls hidden when Emit Enabled is off (matching Glass folder pattern)

### Non-Functional Requirements

- [ ] No frame rate drop below 30fps with max emission settings (4096 particles)
- [ ] No WebGL memory leaks on restart/reset (geometry and material disposed)
- [ ] Phase timers use accumulated delta time (no phantom time on tab switch)
- [ ] Particles freeze during pause (consistent with existing behavior)

## Implementation Phases

### Phase A: State Machine Foundation

Extract the implicit state management from `main.js` into `src/phase-manager.js`.

**Tasks:**

1. **Create `src/phase-manager.js` with phase enum and lifecycle**
   - Define phases: `APPROACH`, `FUSE_LOCK`, `TRANSFORM`, `EMIT`, `STEADY`
   - Each phase object: `{ name, enter(ctx), update(ctx, dt), exit(ctx), canEnter(ctx) }`
   - `ctx` is a context object providing access to `params`, tetrahedra, chaos sphere, scene
   - Use `createSequenceMachine(stateDefinitions, stateOrder, ctx)` runner pattern — states return `'next'`, `'restart'`, or `null` from `update()`
   - `canEnter()` checks skip conditions (e.g., `approachDuration > 0` for Approach)
   - `restart()` method resets to first enabled phase
   - Context object bundles references (params, Three.js objects) and owns transient state (stateElapsed, morphProgress, lockAchieved)

2. **Migrate Approach logic (main.js lines 328–339) into `APPROACH` phase**
   - `enter()`: set `ctx.currentSeparation = MAX_SEPARATION`, compute approach speed from duration (always set, never toggle)
   - `update()`: `ctx.stateElapsed += dt`, decrement separation, return `'next'` when complete
   - `exit()`: ensure `ctx.currentSeparation = 0`, set fused state
   - Handle `approachDuration = 0` via `canEnter()` returning false

3. **Migrate Fuse & Lock logic (main.js lines 340–385) into `FUSE_LOCK` phase**
   - `enter()`: activate ramp if `rampDuration > 0`, set `ctx.subState = 'seeking'` (or `'locked'` if Unlock mode)
   - `update()`: handle seeking alignment, lock snap, 3-second timeout
   - `exit()`: ensure `ctx.lockAchieved = true`
   - Internal sub-state: `seeking` vs `locked`

4. **Migrate Transform logic (main.js lines 387–429) into `TRANSFORM` phase**
   - `enter()`: reset morph progress to 0, show chaos sphere group (guard: `if (group) scene.add(group)`)
   - `update()`: compute morph progress from speed, apply via `setMorphProgress()`, fade tetra opacity. Return `'next'` at `morphProgress >= 1.0`
   - `exit()`: ensure morph complete or reversed
   - `canEnter()`: check `ctx.params.morphEnabled`

5. **Create `EMIT` phase (placeholder — no particles yet)**
   - `enter()`: start emit delay timer (`ctx.emitDelayElapsed = 0`)
   - `update()`: `ctx.emitDelayElapsed += dt`, after delay set `ctx.emitting = true`, return `'next'` to advance to STEADY (particles added in Phase B — this placeholder just handles timing)
   - `exit()`: `ctx.emitting = false`
   - `canEnter()`: check `ctx.params.emitEnabled`

6. **Create `STEADY` terminal phase**
   - `enter()`: no-op
   - `update()`: no-op (return `null` — rotation handled independently)
   - `exit()`: no-op

7. **Replace `approachSpeed` with `approachDuration` in DEFAULTS and controls**
   - `src/main.js`: change `DEFAULTS.approachSpeed` → `DEFAULTS.approachDuration` (default: 0.5 minutes)
   - `src/controls.js`: replace Approach Speed slider with Approach Duration slider (0–5 min, step 0.1)
   - Derive speed: `MAX_SEPARATION / (approachDuration * 60)`

8. **Migrate all phase timers to accumulated delta time**
   - Replace `rampStartTime` / `performance.now()` approach with `rampElapsed += dt` accumulator
   - Emit delay uses same pattern: `emitDelayElapsed += dt`
   - Approach uses `approachElapsed += dt` compared to `approachDuration * 60`

9. **Refactor animation loop in `main.js`**
   - Remove inline boolean logic (lines 322–429)
   - Replace with: `if (!params.paused) { phaseManager.update(dt); }`
   - Keep rotation application and speed ramp computation in `main.js` (independent of phases)
   - Keep `computeEffectiveSpeed()` in `main.js` — pass effective speed via context object

10. **Wire parameter-change handlers**
    - Controls `onChange` callbacks call `phaseManager.onParamChange(paramName)` instead of direct state resets
    - Phase manager checks the declarative `PARAM_RESTART_MAP` object
    - Only restart if current phase is at or past the affected phase's position in the order
    - fusionMode changes call `phaseManager.restart()`
    - `reset()` button calls `phaseManager.restart()`

11. **Handle ramp-disabled edge case**
    - In `TRANSFORM.update()`: if `rampDuration = 0`, set `morphProgress = 1` immediately, return `'next'`
    - In `EMIT.enter()`: if `rampDuration = 0`, start emit delay timer immediately (current speed = top speed)

12. **Update `loadSettings()` and `saveSettings()`**
    - Add new params to `DEFAULTS`: `approachDuration`, `emitEnabled`, `emitDelay`, `coneAngle`, `emissionRate`, `particleSpeed`
    - Remove `approachSpeed` from `DEFAULTS`
    - Handle migration: if localStorage has `approachSpeed` but no `approachDuration`, convert (or just use new default)

**Validation:** After Phase A, the app should behave identically to the current version (minus the new Approach Duration slider). All existing functionality works through the phase manager. Emit phase exists but does nothing visible yet.

### Phase B: Particle System

Build the particle emission system and wire it into the Emit phase.

**Tasks:**

1. **Create `src/particles.js` — instanced particle system builder**
   - `createParticleSystem(maxParticles = 4096)`: returns `{ mesh, update, emit, dispose, setEmissionPoints, reset }`
   - Base geometry: `THREE.PlaneGeometry(1.0, 1.0, 1, 1)` — a unit quad, oriented by the vertex shader
   - Create `THREE.InstancedBufferGeometry` sharing the base quad's `index`, `position`, `uv`
   - Pre-allocate `Float32Array` buffers:
     - `offsets` (×3) — particle world position
     - `velocities` (×3) — particle velocity (needed on GPU for streak orientation)
     - `colors` (×4) — RGBA per particle
     - `ages` (×1) — current age (reserved for future visual effects; despawn is by distance)
   - Create `InstancedBufferAttribute` for each, set `DynamicDrawUsage` on offsets, velocities, ages
   - Track `aliveCount` for `geometry.instanceCount = aliveCount`
   - Swap-compact dead particles: when particle `i` dies, swap all its attribute data with the last alive particle and decrement `aliveCount`

2. **Add `createStreakMaterial()` to `src/materials.js`**
   - Vertex shader (velocity-aligned billboard):
     ```glsl
     attribute vec3 aOffset;
     attribute vec3 aVelocity;
     attribute vec4 aColor;
     varying vec2 vUv;
     varying vec4 vColor;

     const float STREAK_LENGTH = 0.15;
     const float STREAK_WIDTH = 0.02;

     void main() {
       vUv = uv;
       vColor = aColor;

       vec3 worldPos = aOffset;
       vec3 vel = aVelocity;
       float speed = length(vel);
       vec3 forward = speed > 0.001 ? normalize(vel) : vec3(0.0, 1.0, 0.0);
       vec3 toCamera = normalize(cameraPosition - worldPos);
       vec3 right = normalize(cross(forward, toCamera));

       float len = speed * STREAK_LENGTH;
       float wid = STREAK_WIDTH;

       vec3 displaced = worldPos
         + forward * position.x * len
         + right   * position.y * wid;

       gl_Position = projectionMatrix * viewMatrix * vec4(displaced, 1.0);
     }
     ```
   - Fragment shader (soft falloff + taper):
     ```glsl
     varying vec2 vUv;
     varying vec4 vColor;

     void main() {
       float crossFade = 1.0 - pow(abs(vUv.y - 0.5) * 2.0, 2.0);
       float taper = smoothstep(0.0, 0.4, vUv.x);
       float headGlow = smoothstep(0.8, 1.0, vUv.x) * 0.6;
       float alpha = crossFade * taper * vColor.a;
       gl_FragColor = vec4(vColor.rgb * (1.0 + headGlow), alpha);
     }
     ```
   - Material config: `AdditiveBlending`, `depthWrite: false`, `depthTest: false`, `transparent: true`, `side: THREE.DoubleSide`
   - Note: `cameraPosition`, `viewMatrix`, `projectionMatrix` are auto-injected by Three.js `ShaderMaterial`

3. **Implement cone sampling in `particles.js`**
   - `createEmissionBasis(nx, ny, nz)` — Duff et al. (2017) orthonormal basis, returns `{ nx, ny, nz, t1x, t1y, t1z, t2x, t2y, t2z }`
   - `sampleConeDirectionInto(out, offset, basis, cosThetaMax)` — zero-allocation, writes directly into `Float32Array`
   - Precompute `cosThetaMax = Math.cos(coneAngle * Math.PI / 180)` once per parameter change
   - Precompute basis per emitter (8 total), recompute each frame as shape rotates

4. **Implement particle emission logic in `particles.js`**
   - `setEmissionPoints(points)`: array of `{ position: Vector3, direction: Vector3, color: Color }` (8 entries)
   - `emit(count, coneAngle, particleSpeed)`: for each new particle:
     - Pick emitter round-robin across emission points
     - Sample direction from cone using precomputed basis
     - Set velocity = direction × `particleSpeed`
     - Copy color from emission point
     - Set age = 0
     - Write into next slot in the pool (wrap around to 0 if full, killing the oldest)
     - Increment `aliveCount` (or recycle oldest if pool is full)

5. **Implement particle update loop in `particles.js`**
   - `update(dt)`: for `i = 0` to `aliveCount - 1`:
     - `offsets[i*3] += velocities[i*3] * dt` (and y, z)
     - `ages[i] += dt`
     - Check despawn: `sqrt(x² + y² + z²) > 20` → swap-compact with last alive particle, decrement `aliveCount`, decrement `i` (re-check swapped particle)
     - After loop: `geometry.instanceCount = aliveCount`, mark `aOffset.needsUpdate = true`, `aVelocity.needsUpdate = true`, `aAge.needsUpdate = true`

6. **Compute adaptive emission points**
   - When morphed (`morphProgress > 0`): compute ray tip world positions from `chaosSphereGroup.userData.rays` + `rayGroup.matrixWorld`
   - When not morphed: compute vertex world positions from `tetraA.userData.originalVerts` + `tetraA.matrixWorld` (+ tetraB)
   - Compute outward direction for each point: `normalize(position - origin)` (for cone axis)
   - Update emission points each frame before spawning (positions change as shape rotates)
   - Colors from `getTetraColors()` mapped to the 8 emission points (4 from tetra A colors, 4 from tetra B colors)

7. **Wire particles into `EMIT` phase**
   - `EMIT.enter()`: create particle system (if not exists), add `mesh` to scene, start delay timer
   - `EMIT.update()`: after delay elapsed, emit particles at gradually increasing rate (3s ramp-in: `rate = min(1, emitElapsed / 3) * emissionRate`), call `particleSystem.update(dt)`. Return `'next'` to advance to STEADY once emission is fully ramped (the particle system continues updating in STEADY).
   - `EMIT.exit()`: reset all particles (set `aliveCount = 0`, `geometry.instanceCount = 0`)
   - `STEADY.update()`: continue calling `particleSystem.update(dt)` and emitting particles — emission persists in the terminal state
   - On full restart / dispose: call `particleSystem.dispose()` to free geometry + material (correct order: remove from scene → dispose geometry → dispose material → null refs)
   - Set `mesh.frustumCulled = false`

8. **Add Emission controls to `src/controls.js`**
   - New "Emission" folder after Chaos Sphere folder
   - `emitEnabled` toggle (default: true) — `.onChange(() => { phaseManager.onParamChange('emitEnabled'); saveSettings(); })`
   - `emitDelay` slider (0–5 min, step 0.1, default: 0.5) — `.onChange(...)`
   - `coneAngle` slider (5–45 degrees, step 1, default: 15) — `.onChange(...)`
   - `emissionRate` slider (1–50, step 1, default: 10) — `.onChange(...)`
   - `particleSpeed` slider (1–10 units/sec, step 0.5, default: 3) — `.onChange(...)`
   - Hide delay/angle/rate/speed when emit disabled (matching Glass folder visibility pattern)

9. **Add new params to `DEFAULTS` and persistence**
   - `emitEnabled: true`
   - `emitDelay: 0.5` (minutes)
   - `coneAngle: 15` (degrees)
   - `emissionRate: 10` (particles/sec/point)
   - `particleSpeed: 3` (units/sec)

10. **Update `reset()` and Reset Defaults**
    - `reset()`: call `phaseManager.restart()`, dispose particle system
    - Reset Defaults: reset new params, dispose particle system, rebuild

### Phase C: Polish and Edge Cases

1. **Tune streak visual parameters**
   - Adjust `STREAK_LENGTH` and `STREAK_WIDTH` constants for best visual effect
   - Test with varying emission rates and cone angles
   - Consider adding age-based length/width tapering if visual quality demands it (shader already supports `vAgeFrac`)

2. **Handle morph toggle during Emit phase**
   - If morph disabled while emitting from ray tips: switch emission source to vertex points
   - Existing particles continue on their trajectories (no interruption)
   - New particles spawn from vertex positions

3. **Remove keyboard +/- speed controls**
   - Delete the keydown handler in `main.js` (lines 224–236) that adjusts `rotationSpeed` and cancels the ramp
   - Speed is now fully managed by the ramp system and the `rotationSpeed` slider — no keyboard override needed

4. **Tab-switch resilience**
   - Verify all phase timers use accumulated delta time
   - Test: background tab for 1 min, return — no state jumps

5. **Performance testing**
   - Test with max emission rate (400 particles/sec) for 60+ seconds
   - Verify no frame drops below 30fps
   - Verify no memory growth (check `renderer.info.memory`)
   - Verify swap-compact keeps `aliveCount` stable (no unbounded growth)

## Alternative Approaches Considered

1. **Keep boolean flags, just add particles** — Rejected because the boolean flag cascade is already at its complexity limit. Adding a fourth phase would make the animation loop unreadable. (see brainstorm: Phase System rationale)

2. **`THREE.Points` with `gl_PointSize` for particles** — Rejected after research: `gl_PointSize` always produces square screen-aligned quads, cannot create directional velocity-elongated streaks. Also capped at 63px on many GPUs. The original plan listed this as the primary approach with instanced quads as a fallback — research inverted this: instanced quads are the primary (and only viable) approach for streaks.

3. **`THREE.InstancedMesh` with `setMatrixAt`** — Considered: cleaner API, but `setMatrixAt` builds 4x4 matrices on the CPU per particle per frame, which is higher overhead than writing raw `Float32Array` attributes. For a custom shader system, `InstancedBufferGeometry` with raw attributes gives more control and better CPU performance.

4. **Line segments for particles** — Rejected: `lineWidth > 1` is broken on almost all platforms (ANGLE maps WebGL to Direct3D which doesn't support wide lines). 1px lines lack glow/softness. `Line2`/`LineMaterial` has known artifacts. (see brainstorm)

5. **GPGPU particle simulation** — Rejected: overkill for 4096 particles. GPGPU (via `GPUComputationRenderer`) is valuable at 10K-100K+ particles. At our scale, CPU-side `Float32Array` iteration is ~0.2ms, well within budget.

6. **Class-based state machine** — Considered but rejected in favor of the existing codebase's functional style. Phase objects are plain objects with function properties, not class instances. (see brainstorm)

## Dependencies & Risks

**Risks:**
- **State machine complexity** — The parameter-to-phase relevance map and restart semantics add cognitive overhead. Mitigation: keep the map as a literal `PARAM_RESTART_MAP` object in the code, well-commented. The `onParamChange` function is ~10 lines.
- **Circular dependencies** — `phase-manager.js` needs access to `params`, tetrahedra, chaos sphere (from `main.js`), while `main.js` calls `phaseManager.update()`. Mitigation: use the established getter pattern (`getChaosSphereGroup()`), pass context object to phase methods.
- **Streak shader tuning** — Getting the visual quality right for streaks requires iterating on `STREAK_LENGTH`, `STREAK_WIDTH`, and the fragment shader falloff. Risk is visual, not technical — the `InstancedBufferGeometry` approach is proven. Mitigation: start with reasonable defaults, tune in Phase C.
- **Swap-compact correctness** — The dead-particle compaction must correctly swap all attribute arrays in lockstep. Off-by-one errors would cause visual glitches. Mitigation: encapsulate swap logic in a single `killParticle(i)` function that swaps all arrays atomically.

**Dependencies:**
- Three.js `InstancedBufferGeometry` + `InstancedBufferAttribute` API (stable since r0.92+, we're on 0.182)
- Three.js `ShaderMaterial` with auto-injected `cameraPosition`, `viewMatrix`, `projectionMatrix`
- `AdditiveBlending` mode (standard Three.js feature)
- `DynamicDrawUsage` buffer hint (Three.js r0.144+)

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-20-phase-system-and-particle-emission-brainstorm.md](docs/brainstorms/2026-02-20-phase-system-and-particle-emission-brainstorm.md) — Key decisions carried forward: formal state machine with 4 phases, adaptive emission source, time-based phase model with skippable phases. Note: brainstorm specified `THREE.Points` for rendering — research during deepening changed this to `InstancedBufferGeometry` (see Enhancement Summary).

### Internal References

- Animation loop: `src/main.js:302-434`
- Boolean flag state: `src/main.js:328-429`
- Morph system: `src/chaos-sphere.js:151-178`
- Ray directions: `src/chaos-sphere.js:58-69`
- Ray geometry: `src/chaos-sphere.js:98-133`
- Vertex positions: `src/tetrahedron.js:11-38`
- Controls structure: `src/controls.js:9-145`
- Material factories: `src/materials.js:3-27`
- DEFAULTS/persistence: `src/main.js:92-186`
- Rebuild pattern: `src/main.js:43-65`

### External References — Research

- [Crafting a Dreamy Particle Effect with Three.js and GPGPU (Codrops, 2024)](https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/)
- [Three ways to create 3D particle effects (Varun Vachhar)](https://varun.ca/three-js-particles/)
- [Working around gl_PointSize limitations (WebGL Fundamentals)](https://webglfundamentals.org/webgl/lessons/webgl-qna-working-around-gl_pointsize-limitations-webgl.html)
- [Stretched Billboard Projected Particles (GameDev.net)](https://www.gamedev.net/forums/topic/696694-stretched-billboard-projected-particles/)
- [Game Programming Patterns — State (gameprogrammingpatterns.com)](https://gameprogrammingpatterns.com/state.html)
- [Implementing a Simple State Machine Library in JS (Kent C. Dodds)](https://kentcdodds.com/blog/implementing-a-simple-state-machine-library-in-javascript)
- [Physically Based Rendering — Cone Sampling (pbr-book.org)](https://pbr-book.org/3ed-2018/Monte_Carlo_Integration/2D_Sampling_with_Multidimensional_Transformations)
- [Scratchapixel — Cone Sampling with Duff et al. Basis](https://www.scratchapixel.com/lessons/3d-basic-rendering/introduction-to-lighting/introduction-to-lighting-spherical-light-cone-sampling.html)
- [Efficient Particle System in JavaScript/WebGL (WebGL Fundamentals)](https://webglfundamentals.org/webgl/lessons/webgl-qna-efficient-particle-system-in-javascript---webgl-.html)
- [Building Efficient Three.js Scenes (Codrops, 2025)](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/)
- [High-Speed Off-Screen Particles (NVIDIA GPU Gems 3)](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-23-high-speed-screen-particles)

### External References — Three.js API

- [Three.js InstancedBufferGeometry docs](https://threejs.org/docs/#api/en/core/InstancedBufferGeometry)
- [Three.js InstancedBufferAttribute docs](https://threejs.org/docs/#api/en/core/InstancedBufferAttribute)
- [Three.js ShaderMaterial docs](https://threejs.org/docs/#api/en/materials/ShaderMaterial)
- [Three.js Instanced Billboard Particles example](https://threejs.org/examples/webgl_buffergeometry_instancing_billboards.html)
