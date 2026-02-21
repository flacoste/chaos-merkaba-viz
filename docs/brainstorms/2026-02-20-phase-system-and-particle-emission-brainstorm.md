# Phase System & Particle Emission Brainstorm

**Date:** 2026-02-20
**Status:** Draft

## What We're Building

Two intertwined changes to the chaos-merkaba-viz application:

1. **Formal Phase State Machine** — Replace the current scattered boolean flags (`fused`, `lockAchieved`, `morphProgress`, etc.) with an explicit phase system that models the visualization as a linear progression of emanation phases. Each phase builds on the previous, with rotation continuing throughout.

2. **Particle Emission Phase** — A new fourth phase where each vertex/ray tip emits trailing streak particles in a configurable conic spray pattern. Particles match the color of their emission point, travel to the viewport edge, and despawn. Emission begins after a configurable delay once the shape reaches top rotation speed.

## Why This Approach

### Phase System
The current codebase uses implicit state (boolean flags checked in conditionals throughout the animation loop) to manage what are effectively distinct phases. With four phases now, the flag-based approach becomes unwieldy. A formal state machine:
- Makes phase transitions explicit and debuggable
- Provides clean hooks for entering/exiting each phase
- Simplifies the animation loop (delegate to current phase's update)
- Makes it straightforward to add future phases

### Particle Rendering
Points + custom ShaderMaterial chosen over instanced meshes or line segments because:
- Single draw call for all particles (best performance)
- Custom shader enables proper trailing streak effect with glow
- Well-established Three.js pattern for particle systems
- Can handle thousands of particles without frame drops

## Key Decisions

### Phases of Emanation

| Phase | Name | Duration / Trigger | Skippable? | What Happens |
|-------|------|--------------------|------------|--------------|
| 1 | **Approach** | Configurable duration (default: 30s, range: 0–5 min) | Yes — set duration to 0 | Two tetrahedra move toward each other along Y axis. Speed is derived from duration (distance / time) rather than set directly. |
| 2 | **Fuse & Lock** | Driven by rotation speed and alignment | No — always runs | Tetrahedra merge, seek rotational alignment, snap to lock (Stella Octangula or Merkaba). Two internal sub-states: *seeking* (spinning independently toward alignment) and *locked* (snapped, rotating together). |
| 3 | **Transform** | Driven by speed ramp (begins at 80% of ramp max, completes at 100%) | Yes — disable morph | Locked shape morphs into chaos sphere. When disabled, state machine skips directly to Emit. |
| 4 | **Emit** | Configurable delay after reaching top speed (default: 30s, range: 0–5 min) | Yes — disable emission | Vertex/ray points emit trailing streak particles in conic sprays. |

**Phase progression rules:**
- Phases progress linearly. Skippable phases (1, 3, 4) are bypassed entirely when disabled — the state machine advances to the next enabled phase.
- Phase 2 (Fuse & Lock) is the only mandatory phase.
- Rotation continues throughout all phases (it's not phase-specific).
- The speed ramp overlaps phases 2 and 3 — it starts at fusion and drives both the lock-seeking behavior and the morph transition. It remains independent infrastructure (not owned by a single phase).
- Phase transitions can overlap visually (e.g., morph blending while approaching top speed).
- **Parameter changes during animation:** If a user modifies a parameter relevant to the current phase, that phase restarts. Changes to parameters for other phases are ignored — they'll be picked up automatically when that phase is entered.

### Particle Emission Details

- **Trigger:** Configurable delay after reaching ramp max speed (default: 30 seconds, range: 0–5 minutes, slider in 0.5-minute increments)
- **Emission source (adaptive):** From ray tips when chaos sphere is visible; from vertex points of the spinning shape when not morphed
- **Particle style:** Trailing streaks (elongated along velocity vector via custom shader)
- **Color:** Matches the emission point's color (inherits from per-vertex color system)
- **Spray pattern:** Conic spread centered on the outward direction from each point, with configurable cone angle (slider)
- **Travel distance:** Particles travel to the viewport edge at constant opacity and size — no fade-out, no shrink
- **End of life:** Particles despawn when they leave the visible area; new ones continuously spawn
- **Ramp-in:** Emission rate gradually builds over several seconds once triggered (not instant)
- **Works with morph disabled:** If no morph, particles emit from vertex points of the locked Merkaba/Stella Octangula after the delay

### State Machine Architecture

- New module: `phase-manager.js`
- Phase enum: `APPROACH`, `FUSE_LOCK`, `TRANSFORM`, `EMIT`
- Each phase has: `enter()`, `update(dt, effectiveSpeed)`, `exit()` lifecycle methods
- The animation loop calls `phaseManager.update()` instead of inline conditionals
- Phase transitions are checked each frame; when conditions are met, current phase exits and next phase enters
- Transient state (timers, progress values) lives on each phase object rather than in a shared params bag

### Particle System Architecture

- New module: `particles.js`
- Single `THREE.Points` object with a shared `BufferGeometry`
- Pre-allocated typed arrays for position, velocity, color, age, alive status (object pool pattern)
- Custom `ShaderMaterial` for trailing streak rendering (vertex shader elongates along velocity)
- Emission rate controlled by the emit phase, gradually increasing
- Per-frame CPU update: advance positions, despawn out-of-bounds particles, spawn new ones from emission points
- Particle count cap for performance safety (configurable or auto-tuned)

### Control Panel Changes

**Existing controls modified:**
- **Approach Speed** → replaced with **Approach Duration** (slider, 0–5 minutes, default: 0.5 minutes). Setting to 0 skips the approach phase (shapes start fused).

**New "Emission" folder in lil-gui:**
- **Emit Enabled** (toggle, default: true)
- **Emit Delay** (slider, 0–5 minutes, default: 0.5 minutes) — time after reaching top speed before particles begin
- **Cone Angle** (slider, degrees, range TBD during planning)
- **Emission Rate** (slider, controls particles spawned per second per emission point)

## Open Questions

*None — all questions resolved during brainstorming.*

## Resolved Questions

1. **Phase model?** → Linear progression with overlap. Rotation continues throughout all phases.
2. **Emission trigger?** → Time-based delay after reaching top speed (default 30s, range 0–5 min). Single setting, works whether morphing or not.
3. **Particle visual style?** → Trailing streaks (comet-like).
4. **Emission source?** → Adaptive: ray tips when chaos sphere is visible, vertex points when not morphed.
5. **Emission ramp-in?** → Gradual build over several seconds.
6. **Particle lifetime?** → Travel to viewport edge, no fade, despawn when off-screen.
7. **Boundary behavior?** → Despawn at edge, continuously spawn new particles.
8. **Spray angle?** → Configurable via slider.
9. **Rendering approach?** → THREE.Points with custom ShaderMaterial for streak effect.
10. **Refactor scope?** → Formal state machine with explicit phase enum and lifecycle methods.
11. **Phase timing model?** → Each phase is time-based. Approach uses a configurable duration (default 30s) instead of a speed. Emit uses a configurable delay after top speed.
12. **Which phases are skippable?** → Approach (set duration to 0), Transform (disable morph), Emit (disable emission). Fuse & Lock is always required.
13. **Parameter changes mid-animation?** → If a parameter is relevant to the current phase, that phase restarts. Parameters for other phases are applied when those phases are entered.
