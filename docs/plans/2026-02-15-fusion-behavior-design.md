# Fusion Behavior Modes & Speed Ramp

## Summary

Add configurable behavior for when the two tetrahedra fuse. Three fusion modes (unlock, spin-lock CW, spin-lock CCW), two lock shapes (Stella Octangula, Merkaba), plus an independent speed ramp that gradually increases rotation speed after fusion.

## New Settings

### Persistent (saved to localStorage)

| Setting | Type | Range | Default | Description |
|---------|------|-------|---------|-------------|
| `fusionMode` | Dropdown | Unlock / Spin Lock CW / Spin Lock CCW | Unlock | Behavior after tetrahedra fuse |
| `lockShape` | Dropdown | Stella Octangula / Merkaba | Stella Octangula | Target shape for spin-lock alignment |
| `rampDuration` | Slider | 0.0 - 5.0 (minutes) | 0.0 | Time to reach ramp max speed after fusion. 0 = disabled |
| `rampMaxSpeed` | Slider | 0.0 - 20.0 | 10.0 | Target speed for the ramp |

### Transient (not saved)

| State | Type | Description |
|-------|------|-------------|
| `rampStartTime` | number or null | Timestamp when ramp began |
| `rampBaseSpeed` | number | Snapshot of rotationSpeed at ramp activation |
| `lockAchieved` | boolean | Whether spin-lock alignment has been reached |
| `fuseTime` | number or null | Timestamp when spatial fusion occurred (for fallback snap) |

## Fusion Modes

### Unlock (default, current behavior)

After fusion, both tetrahedra continue spinning independently with their own direction settings. No change from existing behavior.

### Spin Lock CW / Spin Lock CCW

After spatial fusion (`fused = true`), tetrahedra enter a **seeking phase**:

1. Both keep spinning with their current independent directions/speeds
2. Each frame, check the relative rotation angle against the target for the selected lock shape
3. When alignment is detected (within adaptive tolerance), snap both tetrahedra to exact alignment
4. Set `lockAchieved = true`; from this point, rotate both together in the direction specified by the mode (CW or CCW)
5. Fallback: if alignment not found within 3 seconds (e.g., same-direction spinning), force-snap

In spin-lock modes, the per-tetrahedron direction settings (directionA, directionB) are ignored once lock is achieved.

## Lock Shapes

### Stella Octangula (compact 3D star)

Corresponding named vertices (back↔back, frontRight↔frontRight, etc.) are **180° apart** in the XZ plane. This places vertices at opposite cube corners, forming the classic compound of two tetrahedra.

### Merkaba (flat Star of David)

Corresponding named vertices are at the **same XZ angle**. This produces the hexagonal Star of David pattern when viewed from above.

### Alignment Detection Math

**IMPORTANT — sign convention:** Three.js Y-rotation gives `effectiveAngle = origAngle - rotation.y` (subtraction, not addition).

Target is the value of `(rotA - rotB) mod 2π` that achieves the desired alignment, computed from the "back" vertex (index 3) of each tetrahedron:

- **Stella Octangula**: `(backAngleA - backAngleB - π) mod 2π`
- **Merkaba**: `(backAngleA - backAngleB) mod 2π`

**Vertex index reversal:** Because tetrahedron B is flipped via `rotateX(PI)`, the `atan2(z, x)` sort order reverses. `originalVerts[i]` for A and B are NOT corresponding physical vertices, but they ARE the vertices with the same UI label (both called "back", both called "frontRight", etc.). The formulas above correctly align by UI-label correspondence.

## Speed Ramp

Independent of fusion mode. Activated at the moment of spatial fusion.

### Behavior

- On fusion: snapshot current `rotationSpeed` as `rampBaseSpeed`, record current time as `rampStartTime`
- Each frame while ramp is active: `effectiveSpeed = lerp(rampBaseSpeed, max(rampMaxSpeed, rampBaseSpeed), elapsed / (rampDuration * 60))`
- When elapsed >= duration: clamp to max speed, ramp complete
- The effective speed replaces `rotationSpeed` in the animation loop
- +/- keyboard shortcuts modify `rotationSpeed` directly, which cancels the ramp and takes immediate effect

### Edge Cases

- `rampDuration = 0`: ramp disabled, rotation uses `rotationSpeed` as normal
- `rampMaxSpeed < rampBaseSpeed`: clamped to `rampBaseSpeed` (never ramps downward)
- Restart/reset: clears all transient state
- Changing `fusionMode` or `lockShape` while locked: resets `lockAchieved`, triggers re-seeking
- Changing from Unlock to Spin Lock while fused: starts seeking from current rotations

## GUI Layout

New controls added to the **Rotation** folder:

```
Rotation
  +-- Auto-Rotate         [checkbox]
  +-- Rotation Speed       [slider 0-5]
  +-- Fusion Mode          [dropdown: Unlock / Spin Lock CW / Spin Lock CCW]
  +-- Lock Shape           [dropdown: Stella Octangula / Merkaba]
  +-- Ramp Duration (min)  [slider 0-5]
  +-- Ramp Max Speed       [slider 0-20]
```

Per-tetrahedron direction controls remain in "Pointing Up" / "Pointing Down" folders.

## Files Modified

- `src/main.js`: Defaults, transient state, alignment target constants, animation loop (seeking/locking/ramp)
- `src/controls.js`: GUI controls in Rotation folder, onChange handlers that reset `lockAchieved`
