---
title: "Preset-Based Settings Panel with lil-gui"
date: "2026-02-21"
category: "architecture-patterns"
tags: ["settings-management", "preset-system", "localStorage", "lil-gui", "dirty-detection", "state-persistence"]
module: "controls & persistence"
severity: "medium"
status: "completed"
---

# Preset-Based Settings Panel with lil-gui

## Problem

The auto-save-on-every-change settings model had several limitations:

- **No presets** — Every slider drag permanently changed the persisted state. No way to bookmark interesting configurations or switch between them.
- **No dirty tracking** — No indication when settings diverged from a saved state. No concept of "unsaved changes."
- **No safe experimentation** — Returning to a known-good state required manually resetting all values.
- **Flat panel organization** — 8 folders all open by default, no semantic grouping by function.

## Solution

Replace auto-save with a named preset framework. Two files changed:

**`src/main.js`** — Persistence layer:
- `DEFAULTS` (frozen) + `SHIPPED_PRESETS` (frozen map) defined in code
- `cloneSettings()` deep-clones settings including nested `vertexColorsA`/`vertexColorsB`
- `mergeOntoDefaults()` fills missing keys from DEFAULTS (forward compatibility)
- `getEffectivePresets()` merges: Default + shipped + user overrides (localStorage wins on collision)
- `readPresetStore()`/`writePresetStore()` handle localStorage with `QuotaExceededError` and JSON parse error handling
- Migration: silently clears old localStorage key on first run

**`src/controls.js`** — Panel structure + preset UI:
- 7 drawers (all closed): Global, Pointing Up Tetrahedron, Pointing Down Tetrahedron, Approach, Fuse, Chaos Sphere, Particles
- Preset dropdown with dynamic "(modified)" suffix
- Save via `window.prompt()`, Delete via `window.confirm()`
- `applyPreset()` follows the proven side-effect sequence
- Dirty detection comparing params against a deep-cloned reference

## Key Technical Details

### lil-gui OptionController.options() is safe for dynamic updates

The base `Controller.options()` is destructive — it destroys the controller and creates a new one appended to the end. But `OptionController.options()` (v0.21) rebuilds `<select>` children in-place and preserves onChange callbacks:

```js
// Safe: updates dropdown options without destroying the controller
presetCtrl.options(['Default', 'My Preset', 'Another']);
presetObj.currentPreset = 'My Preset';
presetCtrl.updateDisplay();
```

`updateDisplay()` sets `selectedIndex` programmatically, which does NOT fire change events in browsers.

### Preset application side-effect sequence

When loading a preset, this exact order matters:

1. Copy values into `params` (deep-clone nested objects via `Object.assign`)
2. `gui.controllersRecursive().forEach(c => c.updateDisplay())` — sync all GUI widgets
3. `applyMaterials()` — update render modes on tetrahedra and chaos sphere
4. `applyColors()` — update mesh vertex colors
5. `rebuildChaosSphere()` — rebuild geometry (reads lockShape, colors, radii from params)
6. `updateGlassVisibility()` — show/hide Glass sub-drawer based on renderMode
7. `resetFn()` — restart animation from APPROACH phase

This sequence is derived from the existing `resetDefaults` handler pattern.

### Dirty detection handles type-specific comparison

```js
function checkDirty() {
  for (const key of Object.keys(DEFAULTS)) {
    if (key === 'vertexColorsA' || key === 'vertexColorsB') {
      // Nested objects: key-by-key, case-insensitive color comparison
      for (const vk of Object.keys(ref)) {
        if (cur[vk].toLowerCase() !== ref[vk].toLowerCase()) return true;
      }
    } else if (typeof DEFAULTS[key] === 'number') {
      // Floats: round to avoid precision issues from slider interactions
      if (Math.round(params[key] * 1000) !== Math.round(ref[key] * 1000)) return true;
    } else if (typeof DEFAULTS[key] === 'string' && params[key].startsWith('#')) {
      // Colors: normalize to lowercase hex
      if (params[key].toLowerCase() !== ref[key].toLowerCase()) return true;
    } else {
      if (params[key] !== ref[key]) return true;
    }
  }
  return false;
}
```

### Deep clone must handle nested objects

The reference copy for dirty detection MUST be a deep clone. If `vertexColorsA` is shared by reference, mutating a vertex color in `params` also mutates the reference, making dirty detection always report "clean":

```js
function cloneSettings(src) {
  return {
    ...src,
    vertexColorsA: { ...src.vertexColorsA },
    vertexColorsB: { ...src.vertexColorsB },
  };
}
```

## Common Pitfalls

1. **Reference equality for nested objects** — `===` always returns false for object copies. Use key-by-key comparison.
2. **Float precision drift** — Slider values like 0.5 can become 0.5000000000000001. Round before comparing.
3. **Color case mismatch** — lil-gui may return `#ABCDEF` vs stored `#abcdef`. Normalize to lowercase.
4. **Delete while modified** — Hide the delete button when dirty to prevent accidental preset deletion when the user's intent is unclear.
5. **Stale dropdown after save/delete** — Always rebuild dropdown options via `presetCtrl.options()` after any preset CRUD operation.
6. **Side-effect ordering** — Materials must be applied before chaos sphere rebuild (which reads material state). Always follow the documented sequence.

## Prevention

- Deep-clone all preset snapshots at creation time. Never hold references to mutable state.
- Centralize the preset application sequence in one function (`applyPreset`). Don't scatter side effects.
- Use `Object.freeze()` on `DEFAULTS` and `SHIPPED_PRESETS` to prevent accidental mutation.
- Wrap localStorage writes in try/catch for `QuotaExceededError`.
- Merge loaded presets onto DEFAULTS to handle schema evolution (new keys get defaults).

## Related Documentation

- **Origin brainstorm:** `docs/brainstorms/2026-02-21-preset-settings-panel-brainstorm.md`
- **Implementation plan:** `docs/plans/2026-02-21-feat-preset-settings-panel-plan.md`
- **Prior persistence design:** `docs/plans/2026-02-15-persistent-settings-design.md`
- **Prior persistence implementation:** `docs/plans/2026-02-15-persistent-settings-implementation.md`
- **Key source files:** `src/main.js`, `src/controls.js`
