# Chaos Sphere Morph — Design

## Overview

When the locked Stella Octangula or Merkaba reaches high rotation speed via the speed ramp, it morphs into a **chaos sphere** — a central sphere with 8 rays (cylinders + cone tips) extending outward. Each ray corresponds to one of the 8 tetrahedron vertices, preserving its color. The central sphere displays a psychedelic full-mix gradient of all 8 colors.

## Geometry

The chaos sphere is a `THREE.Group` containing:

- **Central sphere**: `SphereGeometry` (configurable radius, default 0.33). Vertex colors paint all 8 vertex colors evenly distributed across the surface (round-robin across vertex buffer) for a psychedelic full-mix effect. GPU interpolation blends adjacent vertices.
- **8 rays**: Each a sub-group of `CylinderGeometry` (configurable radius, default 0.10) + `ConeGeometry` (configurable radius, default 0.15). Each ray points outward from the center along the direction of its corresponding tetrahedron vertex (normalized from origin). Each ray is a single solid color matching its source vertex.

Ray directions are derived from the 8 original vertex positions of the current lock shape (4 from tetra A, 4 from tetra B). Rays must be rebuilt when the lock shape changes (Stella Octangula vs Merkaba have different vertex arrangements).

The group is built at scene init and starts hidden (`visible = false`).

## Morph Trigger & Progress

**Prerequisites** (all must be true):
- `morphEnabled` toggle is ON
- `fusionMode` is Spin Lock CW or CCW (not Unlock)
- `rampDuration > 0` (ramp is active)
- `lockAchieved = true`

**Progress formula**:
```
morphProgress = clamp((effectiveSpeed - 0.8 * rampMaxSpeed) / (0.2 * rampMaxSpeed), 0, 1)
```

Morph starts at 80% of ramp max speed (`morphProgress = 0`) and completes at 100% (`morphProgress = 1`). Linear interpolation.

**Edge case**: If `rampMaxSpeed <= rampBaseSpeed`, speed never increases past base and the morph never triggers.

## Animation (Approach C — Hybrid Scale + Crossfade)

**Morph-in** (`morphProgress` 0 → 1):
- Tetrahedra opacity: `1 - morphProgress` (fade out)
- Chaos sphere visibility: ON when `morphProgress > 0`
- Central sphere scale: `morphProgress` (uniform xyz, grows from nothing)
- Ray cylinder scale Y (length): `morphProgress * fullRayLength` (rays extend outward)
- Cone tips: reposition to ride the end of each extending ray
- Chaos sphere group Y-rotation synced with the locked tetrahedra rotation each frame

**Morph-out** (speed drops below 80%, e.g., ramp cancelled via +/- keys):
- `morphProgress` decreases back toward 0
- Morph reverses smoothly: rays retract, sphere shrinks, tetrahedra fade back in
- Fully reversible at any point

**Rotation**: The chaos sphere group inherits the locked rotation direction and speed. Its Y-rotation is set to the same value as the locked tetrahedra each frame.

## Controls

New **"Chaos Sphere"** folder in GUI, positioned after Rotation:

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| Morph Enabled | toggle | — | false |
| Scale | slider | 0.5–3.0 | 1.2 |
| Sphere Radius | slider | 0.05–0.5 | 0.33 |
| Ray Radius | slider | 0.01–0.15 | 0.10 |
| Cone Radius | slider | 0.02–0.3 | 0.15 |

All settings are persistent (localStorage). The folder is always visible — morph just won't trigger if prerequisites aren't met. Changing radii/scale while visible updates geometry immediately.

Material mode (solid/glass), transparency, and glass settings from Appearance/Glass folders apply to the chaos sphere.

## Color System

**Central sphere**: All 8 vertex colors distributed round-robin across the sphere's vertex buffer. GPU interpolation produces a psychedelic full-mix gradient. No spatial correspondence to ray positions.

**Rays and cones**: Each uses a single solid color matching its source vertex:
- Tetra A vertices: top, frontRight, frontLeft, back
- Tetra B vertices: bottom, frontRight, frontLeft, back
- If per-vertex colors are disabled for a tetrahedron, its 4 rays use that tetra's main color

Color updates flow through the existing `applyColors()` mechanism — when vertex/main colors change, chaos sphere colors are rebuilt to match.

## Architecture

**File changes:**
- **`src/chaos-sphere.js` (new)**: Geometry creation, vertex color assignment, ray direction calculation. Exports functions to build, update colors, update materials, and set morph progress.
- **`src/main.js`**: Import chaos sphere. Add morph progress calculation to animation loop (after speed ramp logic). Sync rotation. Handle tetrahedra opacity during morph.
- **`src/controls.js`**: Add "Chaos Sphere" folder with 5 settings. Wire onChange handlers for geometry rebuild and localStorage persistence.
- **`src/tetrahedron.js`**: No changes.
- **`src/materials.js`**: No changes.

**New persistent settings**: `morphEnabled`, `chaosScale`, `sphereRadius`, `rayRadius`, `coneRadius`

**New transient state**: `morphProgress` (computed each frame, never saved)

## Reset Behavior

- **Restart button**: Chaos sphere hides, morph state resets with other transient state
- **Lock shape change**: Rebuild ray directions from new vertex positions, reset morph
- **Fusion mode change to Unlock**: Morph prerequisites no longer met, chaos sphere hides
