# Chaos Sphere Morph — Design

## Overview

When the locked Stella Octangula or Merkaba reaches high rotation speed via the speed ramp, it morphs into a **chaos sphere** — a central sphere with 8 rays (cylinders + cone tips) extending outward. Each ray corresponds to one of the 8 tetrahedron vertices, preserving its color. The central sphere displays a psychedelic full-mix gradient of all 8 colors.

## Geometry

The chaos sphere is a `THREE.Group` containing:

- **Central sphere**: `SphereGeometry` (configurable radius, default 0.45). Vertex colors paint all 8 vertex colors evenly distributed across the surface (round-robin across vertex buffer) for a psychedelic full-mix effect. GPU interpolation blends adjacent vertices.
- **8 rays**: Each a sub-group of `CylinderGeometry` (configurable radius, default 0.10) + `ConeGeometry` (configurable radius, default 0.15). Each ray points outward from the center along the direction of its corresponding tetrahedron vertex (normalized from origin). Each ray is a single solid color matching its source vertex. Cone height is derived as `coneRadius * 1.5`.

Ray directions are derived from the 8 original vertex positions of the current lock shape (4 from tetra A, 4 from tetra B). Tetra B's vertices are rotated by `-lockTarget` around Y to match the lock alignment in tetra A's reference frame. Rays must be rebuilt when the lock shape changes (Stella Octangula vs Merkaba have different vertex arrangements).

The group is built at scene init and starts hidden (`visible = false`).

## Morph Trigger & Progress

**Prerequisites** (all must be true):
- `morphEnabled` toggle is ON
- `fusionMode` is Spin Lock CW or CCW (not Unlock)
- `rampStartTime` is not null (ramp is running)
- `rampMaxSpeed > 0`
- `lockAchieved = true`
- `fused = true`

Note: `autoRotate` is NOT a prerequisite — the chaos sphere persists and freezes in place when rotation is paused.

**Progress formula**:
```
morphProgress = clamp((effectiveSpeed - 0.8 * rampMaxSpeed) / (0.2 * rampMaxSpeed), 0, 1)
```

Morph starts at 80% of ramp max speed (`morphProgress = 0`) and completes at 100% (`morphProgress = 1`). Linear interpolation.

**Edge case**: If `rampMaxSpeed <= rampBaseSpeed`, speed never increases past base and the morph never triggers.

## Animation (Approach C — Hybrid Scale + Crossfade)

**Scale remapping**: To avoid the chaos sphere looking too small at early morph progress, the internal geometry scale is remapped: `scale = 0.4 + 0.6 * morphProgress`. This means the chaos sphere starts at 40% of final size when it first appears, filling the tetrahedra volume from the start for a smoother morph feel.

**Morph-in** (`morphProgress` 0 → 1):
- Tetrahedra opacity: `1 - morphProgress` (fade out)
- Chaos sphere visibility: ON when `morphProgress > 0`
- All geometry (sphere, cylinders, cones) scales uniformly by the remapped scale value
- Ray base position tracks the scaled sphere surface with slight overlap (0.03) to prevent gaps
- Cone tips reposition to ride the end of each extending ray
- Chaos sphere group Y-rotation synced with tetra A each frame

**Morph-out** (speed drops below 80%, e.g., ramp cancelled via +/- keys):
- `morphProgress` decreases back toward 0
- Morph reverses smoothly: rays retract, sphere shrinks, tetrahedra fade back in
- Fully reversible at any point

**Rotation**: The chaos sphere group inherits the locked rotation direction and speed. Its Y-rotation is set to the same value as tetra A (the lock reference frame) each frame. When auto-rotate is paused, the chaos sphere freezes in place.

## Controls

New **"Chaos Sphere"** folder in GUI, positioned after Rotation:

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| Morph Enabled | toggle | — | false |
| Scale | slider | 0.5–3.0 | 1.2 |
| Sphere Radius | slider | 0.05–0.5 | 0.45 |
| Ray Radius | slider | 0.01–0.15 | 0.10 |
| Cone Radius | slider | 0.02–0.3 | 0.15 |

All settings are persistent (localStorage). The folder is always visible — morph just won't trigger if prerequisites aren't met.

**Scale** only affects the group-level scale (applied per-frame in the animation loop), so it does NOT trigger a geometry rebuild. **Sphere Radius**, **Ray Radius**, and **Cone Radius** DO trigger a full geometry rebuild since they affect mesh construction.

Material mode (solid/glass) and glass settings from Appearance/Glass folders apply to the chaos sphere. Transparency was removed as a setting.

## Color System

**Central sphere**: All 8 vertex colors distributed round-robin across the sphere's vertex buffer. GPU interpolation produces a psychedelic full-mix gradient. No spatial correspondence to ray positions.

**Rays and cones**: Each uses a single solid color matching its source vertex:
- Tetra A vertices: top, frontRight, frontLeft, back
- Tetra B vertices: bottom, frontRight, frontLeft, back
- If per-vertex colors are disabled for a tetrahedron, its 4 rays use that tetra's main color

Color updates flow through the existing `applyColors()` mechanism — when vertex/main colors change, chaos sphere colors are rebuilt to match.

## Architecture

**File changes:**
- **`src/chaos-sphere.js` (new)**: Geometry creation, vertex color assignment, ray direction calculation. Exports: `buildChaosSphere`, `setMorphProgress`, `updateChaosSphereColors`, `setChaosSphereRenderMode`.
- **`src/main.js`**: Import chaos sphere. Add `rebuildChaosSphere()` lifecycle function. Add `getTetraColors()` helper. Add `computeEffectiveSpeed()` helper (extracted to avoid duplication). Add morph progress calculation to animation loop. Sync rotation. Handle tetrahedra opacity during morph. Export getter `getChaosSphereGroup()` for cross-module access.
- **`src/controls.js`**: Add "Chaos Sphere" folder with 5 settings. Wire onChange handlers for geometry rebuild (radii) and save-only (scale, toggle). Update `applyColors` and `applyMaterials` to also update chaos sphere.
- **`src/tetrahedron.js`**: Export `TETRA_RADIUS` constant (was previously module-private).
- **`src/materials.js`**: No changes.

**New persistent settings**: `morphEnabled`, `chaosScale`, `sphereRadius`, `rayRadius`, `coneRadius`

**New transient state**: `morphProgress` (computed each frame, never saved)

## Reset Behavior

- **Restart button**: Chaos sphere hides, morph state resets with other transient state
- **Lock shape change**: Rebuild chaos sphere with new ray directions, reset lock
- **Fusion mode change to Unlock**: Morph prerequisites no longer met, chaos sphere hides
- **Auto-rotate toggle off**: Chaos sphere persists and freezes (does NOT hide)

## Implementation Notes

These lessons were discovered during implementation:

1. **`let` variable re-export**: `chaosSphereGroup` is reassigned by `rebuildChaosSphere()`. ES module named imports are live bindings for `const`/`function` but NOT for `let`. Solution: export a `getChaosSphereGroup()` getter function.

2. **Color buffer reuse**: Paint functions (`paintUniformColor`, `paintSphereColors`) check for existing `color` attribute and write directly into the existing `Float32Array` + set `needsUpdate = true`, rather than allocating a new buffer every time. Matches the pattern in `tetrahedron.js:buildVertexColors`.

3. **Speed computation duplication**: `effectiveSpeed` was scoped inside the `if (params.autoRotate)` block and inaccessible to the morph block. Extracted `computeEffectiveSpeed()` as a local function inside `animate()` to avoid duplicating the ramp formula.

4. **Glass material transparency flag**: When restoring tetra opacity after morph-out, glass materials must keep `transparent = true` regardless of opacity value. Setting `transparent = false` on a `MeshPhysicalMaterial` with `transmission > 0` can cause rendering artifacts.

5. **Morph scale offset**: Starting the chaos sphere at scale 0 made it look like a tiny object growing inside the fading tetrahedra. Remapping to start at 40% makes the transition feel like a true morph rather than a replacement.

6. **Sphere-ray gap**: Rays must be positioned with slight overlap (0.03) inside the sphere surface to prevent visible gaps caused by tessellation differences between SphereGeometry and the mathematical radius.

7. **Uniform ray scaling**: Only scaling cylinder Y (length) left the radius at full width from the start, looking unnatural. Scaling all axes uniformly (`setScalar`) makes both radius and length grow together for an organic emergence effect.
