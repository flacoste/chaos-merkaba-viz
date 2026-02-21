# Camera Roll Controls

**Date:** 2026-02-21
**Status:** Ready for planning

## What We're Building

Replacing the horizontal mouse drag behavior from azimuthal orbit (moving the camera around the shape) to camera roll (tilting the camera like tilting your head sideways). Since the merkaba continuously rotates around Y, horizontal orbiting just shifts the phase of that rotation and doesn't feel meaningfully different. Camera roll, by contrast, tilts the shape's spin axis in the viewport — a genuinely new perspective.

**Vertical drag** remains unchanged: it orbits the camera over and under the shape (polar angle), which already provides a satisfying change in viewpoint.

## Why This Approach

**Approach chosen:** Lock OrbitControls' azimuth + custom roll overlay

- Lock OrbitControls' horizontal orbit by setting `minAzimuthAngle = maxAzimuthAngle` to the current azimuth angle
- Add a custom pointer handler that maps horizontal drag delta to a roll angle
- Each frame, after `orbitControls.update()`, apply the roll rotation to the camera by rotating `camera.up` around the view direction
- Implement smooth damping via exponential interpolation to match OrbitControls' existing feel

**Why not the alternatives:**

- *Fully custom camera controller:* Reimplements vertical orbit, zoom, and damping that OrbitControls handles well. Over-engineered for this change.
- *Subclass/patch OrbitControls:* Depends on internal methods like `handleMouseMoveRotate` that can change between Three.js versions. Fragile.

## Key Decisions

1. **Horizontal drag = camera roll** — tilts the camera around its view direction (local Z-axis), making the shape's rotation axis appear diagonal
2. **Vertical drag unchanged** — continues to orbit the camera over/under the shape via OrbitControls' polar angle
3. **Roll persists with damping** — the tilt stays where you leave it and accumulates, with smooth damping matching OrbitControls' feel
4. **Transient state** — roll angle is not saved in presets and resets on page reload
5. **Zoom, pan, and click-to-pause unaffected** — scroll zoom, right-click pan, and the existing click-to-pause mechanism continue to work as-is
6. **Double-click resets roll** — double-click (or double-tap) smoothly animates the roll back to upright

## Technical Notes

- OrbitControls azimuth can be locked via `minAzimuthAngle` and `maxAzimuthAngle` properties
- Camera roll is achieved by rotating `camera.up` around the camera's forward direction vector
- The existing `pointerdown`/`pointerup` handler for click-to-pause uses a 3px movement threshold — the custom roll handler must coexist with this
- Double-click reset must coexist with OrbitControls' default double-click behavior (which resets the orbit target); may need to override or disable OrbitControls' `dblclick` handler
- OrbitControls' `enableDamping` is already `true`; the custom roll damping should use a similar interpolation factor for consistency

## Open Questions

None — all key decisions have been resolved through review.
