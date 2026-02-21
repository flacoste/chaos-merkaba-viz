---
title: "feat: Preset-based settings panel with reorganized drawers"
type: feat
status: active
date: 2026-02-21
origin: docs/brainstorms/2026-02-21-preset-settings-panel-brainstorm.md
---

# feat: Preset-based settings panel with reorganized drawers

## Overview

Replace the auto-persist-on-every-change settings model with a named preset framework, and reorganize the panel from 8 always-open folders into 7 logically grouped drawers (all starting closed). Users can save, load, and delete named collections of all 28 settings. A protected "Default" preset and additional shipped presets provide reliable starting points.

## Problem Statement / Motivation

The current auto-save model makes experimentation risky — every slider drag permanently changes the persisted state. There's no way to bookmark interesting configurations or quickly return to a known-good state. The panel organization also doesn't match the mental model of the animation (global settings → per-shape settings → per-phase settings).

## Proposed Solution

Two interrelated changes (see brainstorm: `docs/brainstorms/2026-02-21-preset-settings-panel-brainstorm.md`):

1. **Preset framework:** Replace `saveSettings()`/`loadSettings()` with a preset system. Settings changes are ephemeral until the user explicitly saves. A dropdown at the top shows the active preset with a "(modified)" suffix when dirty.

2. **Panel reorganization:** Restructure from the current flat 8-folder layout into a semantic hierarchy: Global, Pointing Up Tetrahedron, Pointing Down Tetrahedron, Approach, Fuse, Chaos Sphere, Particles.

## Technical Considerations

### lil-gui "(modified)" dropdown implementation

lil-gui's `OptionController` requires the selected value to match one of the option values. To show "PresetName (modified)", dynamically add/remove a "(modified)" entry in the options list:

```js
// When dirty: add temporary option
const opts = [...presetNames];
opts.push(`${activePreset} (modified)`);
presetCtrl.options(opts);
presetObj.currentPreset = `${activePreset} (modified)`;
presetCtrl.updateDisplay();

// When clean (preset selected or saved): remove it
presetCtrl.options(presetNames);
presetObj.currentPreset = activePreset;
presetCtrl.updateDisplay();
```

The `OptionController.options()` method (lil-gui 0.21) rebuilds `<select>` children in-place and preserves onChange callbacks. This is safe for dynamic updates.

### Preset application side-effect sequence

When loading a preset, follow the existing `resetDefaults` pattern in `controls.js:101-118`:

1. Deep-clone preset values into `params` (special handling for `vertexColorsA`/`vertexColorsB` via `Object.assign`)
2. `gui.controllersRecursive().forEach(c => c.updateDisplay())` — sync all GUI widgets
3. `applyMaterials(params, tetraA, tetraB)` — update render modes
4. `applyColors(params, tetraA, tetraB)` — update mesh colors
5. `rebuildChaosSphere()` — rebuild geometry
6. `updateGlassVisibility()` — show/hide Glass sub-drawer
7. `resetFn()` — restart animation from APPROACH

### Dirty detection

Compare current `params` against a deep-cloned reference copy of the active preset. Run on every `onChange` callback (replaces the current `saveSettings()` calls). For 28 keys this is trivial in cost. Handle:
- **Floats:** Round to slider step precision before comparison
- **Colors:** Normalize to lowercase hex
- **Nested objects:** Key-by-key comparison for `vertexColorsA`/`vertexColorsB`

### `lastPreset` persistence

`lastPreset` is written to localStorage immediately on preset selection and on save. This is an exception to the "no auto-persist" rule — it's meta-state (which preset is active), not settings data. This ensures closing the browser after selecting a preset remembers the selection.

### Forward compatibility

When loading any preset (shipped or user), merge onto a deep copy of `DEFAULTS` so new keys added in future versions get default values. This matches the existing `loadSettings()` pattern.

## System-Wide Impact

- **Interaction graph:** Preset selection → copy values to params → update GUI displays → apply materials → apply colors → rebuild chaos sphere → update glass visibility → reset animation. Same chain as current `resetDefaults`.
- **Error propagation:** localStorage read/write wrapped in try/catch. Corrupted JSON falls back to Default. `QuotaExceededError` on save triggers `window.alert()`.
- **State lifecycle risks:** The reference copy of the active preset (for dirty detection) must be a deep clone, not a reference. Otherwise mutating `params.vertexColorsA` would also mutate the reference, making dirty detection always report "clean."
- **API surface parity:** No external APIs. All changes are internal to the client-side app.

## Acceptance Criteria

### Panel Restructuring
- [x] Panel title changed from "Tetraviz" to "Chaos Merkaba Viz"
- [x] Top area contains: Fullscreen button, Restart button, Preset dropdown, Save button, Delete button
- [x] 7 drawers created in order: Global, Pointing Up Tetrahedron, Pointing Down Tetrahedron, Approach, Fuse, Chaos Sphere, Particles
- [x] All drawers start closed
- [x] Glass sub-drawer inside Global, hidden when Render Mode is Solid
- [x] Direction is the first setting in each Tetrahedron drawer
- [x] Settings correctly mapped to their new drawers (see layout below)

### Preset Framework
- [x] Protected "Default" preset always exists, cannot be deleted or overwritten
- [x] Shipped presets defined in code, overwritable by users, reappear on reload if deleted
- [x] Selecting a preset applies all 28 settings and restarts animation from APPROACH
- [x] Dropdown shows "PresetName (modified)" when any setting diverges from active preset
- [x] Save button opens `window.prompt()` pre-filled with current preset name
- [x] Saving as "Default" (case-insensitive) is rejected with `window.alert()`
- [x] Saving over an existing preset shows `window.confirm("Overwrite 'X'?")`
- [x] Delete button shows `window.confirm()` before deleting
- [x] Delete button hidden when "Default" is selected
- [x] Deleting a shipped preset removes user override, immediately restores shipped values in dropdown, switches to Default
- [x] Deleting a user preset removes it from storage and dropdown, switches to Default
- [x] Empty/whitespace-only preset names treated as cancel

### Persistence
- [x] localStorage key `'chaos-merkaba-viz-presets'` stores `{ lastPreset, presets }`
- [x] `lastPreset` written immediately on preset selection and save
- [x] User presets stored in `presets` map; shipped presets NOT stored unless overwritten
- [x] On launch: load `lastPreset` or fall back to "Default"
- [x] Modified state not preserved across browser close (base preset loaded clean)
- [x] Old `'chaos-merkaba-viz-settings'` key silently cleared on first run

### Edge Cases
- [x] Corrupted localStorage JSON falls back to Default
- [x] `QuotaExceededError` caught and reported via `window.alert()`
- [x] Missing keys in stored presets filled from DEFAULTS (forward compatibility)
- [x] Preset dropdown ordering: Default first, then shipped presets (code order), then user presets (alphabetical)

## Drawer Layout Reference

### 1. Global
- Scale (0.1–3.0)
- Rotation Speed (0.0–5.0)
- Render Mode (Solid / Glass)
- **Glass sub-drawer** (hidden when Solid): Transmission, Thickness, Roughness, IOR

### 2. Pointing Up Tetrahedron
- Direction (Clockwise / Counterclockwise) — first
- Main Color
- Per-Vertex Colors toggle
- Vertex Colors sub-drawer (Top, Front Right, Front Left, Back)

### 3. Pointing Down Tetrahedron
- Direction (Clockwise / Counterclockwise) — first
- Main Color
- Per-Vertex Colors toggle
- Vertex Colors sub-drawer (Bottom, Front Right, Front Left, Back)

### 4. Approach
- Duration (min) (0.0–5.0)

### 5. Fuse
- Fusion Mode (Unlock / Spin Lock CW / Spin Lock CCW)
- Lock Shape (Stella Octangula / Merkaba)
- Ramp Duration (min) (0.0–5.0)
- Ramp Max Speed (0.0–20.0)

### 6. Chaos Sphere
- Morph Enabled (toggle)
- Scale (0.5–3.0)
- Sphere Radius (0.05–0.5)
- Ray Radius (0.01–0.15)
- Cone Radius (0.02–0.3)

### 7. Particles
- Emit Enabled (toggle)
- Emit Delay (min) (0.0–5.0)
- Cone Angle (deg) (5–45)
- Emission Rate (1–50)
- Particle Speed (1–10)

## Implementation Approach

### Files to modify

**`src/main.js`** — Moderate changes:
- Replace `STORAGE_KEY` with new preset key (`'chaos-merkaba-viz-presets'`)
- Replace `loadSettings()`/`saveSettings()` with preset-aware equivalents
- Add shipped presets alongside `DEFAULTS` (e.g., `SHIPPED_PRESETS` map)
- Add migration logic (clear old key on first run)
- Export new preset functions for use by `controls.js`
- Keep `DEFAULTS`, `reset()`, and all scene-management exports unchanged

**`src/controls.js`** — Major rewrite:
- Rename panel title to "Chaos Merkaba Viz"
- Add preset controls (dropdown, Save, Delete) at top
- Restructure folders into 7 drawers with new grouping
- Replace all `saveSettings()` calls in onChange with dirty-detection callback
- Add `applyPreset()` function following `resetDefaults` pattern
- Add dirty-detection logic with reference copy management
- Remove "Reset Default Settings" button (replaced by Default preset)

**No new files needed** — preset logic fits naturally in the existing two files.

### Key implementation details

**Preset state management (in controls.js scope):**
```
activePresetName   — string, the name of the currently selected preset
activePresetValues — deep clone of the preset's values (reference for dirty detection)
isDirty            — boolean, cached dirty flag
```

**Preset loading from localStorage + shipped presets merge:**
```
effective presets = { "Default": DEFAULTS, ...SHIPPED_PRESETS, ...localStorage.presets }
```
localStorage entries win on name collision (user overrides).

**onChange replacement pattern:**
```
// Before (every control):
.onChange(saveSettings)
.onChange(() => { someEffect(); saveSettings(); })

// After:
.onChange(markDirty)
.onChange(() => { someEffect(); markDirty(); })
```

Where `markDirty()` compares current `params` against `activePresetValues` and updates the dropdown display.

**For phase-aware controls** that call `getPhaseManager().onParamChange()`, the pattern becomes:
```
.onChange(() => { getPhaseManager().onParamChange('paramName'); markDirty(); })
```

## Dependencies & Risks

- **lil-gui dropdown dynamics:** The `OptionController.options()` in-place update is confirmed to work in v0.21. Low risk.
- **Side-effect ordering:** The existing `resetDefaults` pattern is proven. The preset application function follows the same sequence. Low risk.
- **Dirty detection false positives:** Float rounding and color normalization need care. Medium risk — test thoroughly with slider interactions.
- **No shipped presets defined yet:** The framework will be built, but actual shipped preset values need to be authored after implementation by tweaking settings in-app and capturing via `JSON.stringify(params)` in the console.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-02-21-preset-settings-panel-brainstorm.md](docs/brainstorms/2026-02-21-preset-settings-panel-brainstorm.md) — Key decisions: preset framework design, panel layout, persistence model, save/delete UX, shipped presets
- **Prior settings design:** [docs/plans/2026-02-15-persistent-settings-design.md](docs/plans/2026-02-15-persistent-settings-design.md) — Foundation for current auto-save implementation
- **Prior settings implementation:** [docs/plans/2026-02-15-persistent-settings-implementation.md](docs/plans/2026-02-15-persistent-settings-implementation.md) — Patterns for DEFAULTS, loadSettings, saveSettings
- **Key source files:** `src/controls.js` (panel structure), `src/main.js` (DEFAULTS, persistence, reset), `src/phase-manager.js` (onParamChange)
- **lil-gui API:** OptionController.options() for in-place dropdown updates (v0.21)
