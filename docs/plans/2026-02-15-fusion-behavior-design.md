# Fusion Behavior Modes & Speed Ramp

## Summary

Add configurable behavior for when the two tetrahedra fuse into a merkaba. Three fusion modes (unlock, spin-lock CW, spin-lock CCW) plus an independent speed ramp that gradually increases rotation speed after fusion.

## New Settings

### Persistent (saved to localStorage)

| Setting | Type | Range | Default | Description |
|---------|------|-------|---------|-------------|
| `fusionMode` | Dropdown | Unlock / Spin Lock CW / Spin Lock CCW | Unlock | Behavior after tetrahedra fuse |
| `rampDuration` | Slider | 0.0 - 5.0 (minutes) | 0.0 | Time to reach ramp max speed after fusion. 0 = disabled |
| `rampMaxSpeed` | Slider | 0.0 - 20.0 | 10.0 | Target speed for the ramp |

### Transient (not saved)

| State | Type | Description |
|-------|------|-------------|
| `rampStartTime` | number or null | Timestamp when ramp began |
| `rampBaseSpeed` | number | Snapshot of rotationSpeed at ramp activation |
| `lockAchieved` | boolean | Whether spin-lock alignment has been reached |

## Fusion Modes

### Unlock (default, current behavior)

After fusion, both tetrahedra continue spinning independently with their own direction settings. No change from existing behavior.

### Spin Lock CW / Spin Lock CCW

After spatial fusion (`fused = true`), tetrahedra enter a **seeking phase**:

1. Both keep spinning with their current independent directions/speeds
2. Each frame, compute the XZ-plane angle of the front-right vertex for each tetrahedron
3. Detect when corresponding named vertices are directly opposite each other (180 degrees apart in XZ projection) -- this is the proper merkaba alignment where front-right opposes front-right, front-left opposes front-left, back opposes back
4. When alignment is detected (within ~0.05 radian tolerance), snap both tetrahedra to the exact alignment angle
5. Set `lockAchieved = true`; from this point, rotate both together in the direction specified by the mode (CW or CCW)

In spin-lock modes, the per-tetrahedron direction settings (directionA, directionB) are ignored once lock is achieved.

### Alignment Detection

Both tetrahedra have 3-fold symmetry around Y. The base vertices are spaced 120 degrees apart. After B is flipped (rotateX(PI)), its vertex XZ angles are negated relative to A's.

To detect the correct alignment:
- Compute initial XZ angle of front-right vertex for A and B at rotation.y = 0
- During animation, effective angle = initialAngle + rotation.y
- Corresponding vertices are opposite when: `(angleA - angleB) mod 2PI ~= PI`
- Due to 3-fold symmetry and the flip, this alignment occurs at a specific relative rotation offset

## Speed Ramp

Independent of fusion mode. Activated at the moment of spatial fusion.

### Behavior

- On fusion: snapshot current `rotationSpeed` as `rampBaseSpeed`, record current time as `rampStartTime`
- Each frame while ramp is active: `effectiveSpeed = lerp(rampBaseSpeed, rampMaxSpeed, elapsed / (rampDuration * 60))`
- When elapsed >= duration: clamp to `rampMaxSpeed`, ramp complete
- The effective speed replaces `rotationSpeed` in the animation loop
- +/- keyboard shortcuts modify `rotationSpeed` directly, which cancels the ramp and takes immediate effect

### Edge Cases

- `rampDuration = 0`: ramp disabled, rotation uses `rotationSpeed` as normal
- Restart/reset: clears ramp state (`rampStartTime = null`, `lockAchieved = false`)

## GUI Layout

New controls added to the **Rotation** folder:

```
Rotation
  +-- Auto-Rotate         [checkbox]
  +-- Rotation Speed       [slider 0-5]
  +-- Fusion Mode          [dropdown: Unlock / Spin Lock CW / Spin Lock CCW]
  +-- Ramp Duration (min)  [slider 0-5]
  +-- Ramp Max Speed       [slider 0-20]
```

Per-tetrahedron direction controls remain in "Pointing Up" / "Pointing Down" folders.

## Files to Modify

- `src/main.js`: Add new defaults, transient state, animation loop logic for fusion modes and ramp
- `src/controls.js`: Add new GUI controls in the Rotation folder
