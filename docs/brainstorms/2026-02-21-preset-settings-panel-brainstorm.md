# Brainstorm: Preset-Based Settings Panel

**Date:** 2026-02-21
**Status:** Draft

## What We're Building

A restructured Settings panel that replaces the current auto-persist-on-every-change model with a **preset framework**. Users can save, load, and delete named collections of settings. The panel is also reorganized into logical groups: global settings, per-tetrahedron settings, and per-animation-phase settings.

### Current State
- lil-gui panel titled "Tetraviz" with 8 folders, all open by default
- 28 settings auto-saved to localStorage on every change
- Single `DEFAULTS` object with a "Reset Default Settings" button
- No preset system, no naming, no save/load workflow

### Target State
- Panel titled "Chaos Merkaba Viz" with preset controls at the top
- 7 drawers (all start closed), reorganized by logical grouping
- Preset-based persistence: only named presets and last-selected preset stored in localStorage
- Protected "Default" preset that replaces the reset button, plus additional shipped presets
- Settings changes are ephemeral until explicitly saved

## Why This Approach

The auto-save model is friction-free but makes it hard to experiment. You can't easily return to a known-good configuration or share interesting parameter combinations. A preset system gives users:
- **Bookmarks** for interesting configurations
- **Safe experimentation** — switch back to a preset to undo all tweaks
- **The "Default" preset** as a reliable reset mechanism
- **Simpler mental model** — settings are either saved (preset) or temporary (modified)

## Key Decisions

### Preset Framework

1. **Protected "Default" preset** — Always exists, cannot be deleted or overwritten. Contains the hardcoded `DEFAULTS` values. Replaces the "Reset Default Settings" button.

2. **Shipped presets** — Additional built-in presets defined in code alongside Default. Unlike Default, these CAN be overwritten by the user (saved version stored in localStorage takes priority). If a user deletes a shipped preset, it reappears on next page load with its original values — deletions of shipped presets are ephemeral. New shipped presets are authored by tweaking settings in the app, then using `JSON.stringify(params)` in the console to capture values into a source file.

3. **Preset selection applies and restarts** — Selecting a preset from the dropdown immediately applies all settings and restarts the animation from the APPROACH phase.

4. **Modified state indicator** — When any setting is changed from the active preset, the dropdown shows `"PresetName (modified)"`. Makes it clear which preset was the starting point and that unsaved changes exist.

5. **Save workflow** — Single "Save" button. Uses `window.prompt()` pre-filled with the current preset name. User can keep the name (overwrite) or type a new name (save as new). If the name matches "Default", reject with an alert.

6. **Delete workflow** — Delete/trash button next to the dropdown. Uses `window.confirm()` before deleting the currently selected preset. Hidden when "Default" is selected (cannot delete the protected preset). After deletion, revert to "Default" preset.

7. **No auto-persist** — Settings changes are ephemeral. Closing the browser without saving loses modifications.

### Persistence (localStorage)

Store under a single key (e.g., `'chaos-merkaba-viz-presets'`):
```json
{
  "lastPreset": "MyPreset",
  "presets": {
    "MyPreset": { ...all 28 settings... },
    "Colorful": { ...all 28 settings... }
  }
}
```

- `lastPreset` — Name of the last selected preset. On launch, load this preset. Falls back to "Default" if missing or invalid.
- `presets` — User-saved/overwritten presets only. Shipped presets (including "Default") are NOT stored here unless the user overwrites one. On load, the effective preset list is: shipped presets (from code) merged with localStorage presets (localStorage wins on name collision).
- Old `'chaos-merkaba-viz-settings'` key is silently cleared on first run (no migration).

### Resume Behavior

- On launch: load the preset named in `lastPreset`, or "Default" if none
- If the user was in a "(modified)" state when they closed the browser, those modifications are lost — the base preset is restored clean
- `lastPreset` is updated whenever a preset is selected from the dropdown or a new preset is saved

### Panel Layout

**Top area (not in any drawer):**
- Title: "Chaos Merkaba Viz"
- Fullscreen button
- Restart button
- Preset dropdown (lists: "Default", ...shipped presets, ...user presets, plus "(modified)" suffix when dirty)
- Save button
- Delete button

**Drawers (all start closed):**

#### 1. Global
- Scale (0.1–3.0)
- Rotation Speed (0.0–5.0)
- Render Mode (Solid / Glass)
- **Glass sub-drawer** (hidden when Solid):
  - Transmission, Thickness, Roughness, IOR

#### 2. Pointing Up Tetrahedron
- Direction (Clockwise / Counterclockwise) — *first setting*
- Main Color
- Per-Vertex Colors toggle
- Vertex Colors sub-drawer (Top, Front Right, Front Left, Back)

#### 3. Pointing Down Tetrahedron
- Direction (Clockwise / Counterclockwise) — *first setting*
- Main Color
- Per-Vertex Colors toggle
- Vertex Colors sub-drawer (Bottom, Front Right, Front Left, Back)

#### 4. Approach
- Duration (min) (0.0–5.0)

#### 5. Fuse
- Fusion Mode (Unlock / Spin Lock CW / Spin Lock CCW)
- Lock Shape (Stella Octangula / Merkaba)
- Ramp Duration (min) (0.0–5.0)
- Ramp Max Speed (0.0–20.0)

#### 6. Chaos Sphere
- Morph Enabled (toggle)
- Scale (0.5–3.0)
- Sphere Radius (0.05–0.5)
- Ray Radius (0.01–0.15)
- Cone Radius (0.02–0.3)

#### 7. Particles
- Emit Enabled (toggle)
- Emit Delay (min) (0.0–5.0)
- Cone Angle (deg) (5–45)
- Emission Rate (1–50)
- Particle Speed (1–10)

### User Input via window.prompt() / window.confirm()

- **Save:** `window.prompt("Save preset as:", currentPresetName)` — returns the name or null (cancel)
- **Overwrite check:** If the entered name matches an existing user preset, `window.confirm("Overwrite 'X'?")` before saving
- **Delete:** `window.confirm("Delete preset 'X'?")` — returns true/false
- **Protected preset guard:** If user tries to save as "Default", show `window.alert("Cannot overwrite the Default preset.")` and re-prompt

### Implementation Notes

- **lil-gui limitations:** No built-in text input or dropdown-with-actions. The preset dropdown can use lil-gui's dropdown controller (string type with array of options). Save/Delete can be lil-gui button controllers. The dropdown options list will need to be rebuilt dynamically when presets are added/removed.
- **Dirty detection:** Compare current `params` values against the active preset's stored values. Any difference → mark as modified. Comparison must handle nested objects (vertexColorsA/B).
- **Migration:** On first load, if old `'chaos-merkaba-viz-settings'` key exists, silently clear it. No import—user starts fresh on "Default".

## Open Questions

*None — all questions resolved during brainstorming.*
