# Persistent Settings Design

## Goal

Save GUI settings to localStorage so they persist across browser sessions. Add a "Reset Default Settings" button to restore defaults. Rename the existing "Reset" button to "Restart" to better describe what it does (re-separates the tetrahedra so they approach again).

## Approach

Approach 1: Persist at the params level. Store the entire params object (minus transient keys) as JSON in localStorage under a single key.

## Data Model

- Extract current hardcoded param values into a frozen `DEFAULTS` constant in `main.js`.
- Persistent keys: everything in params except `currentSeparation` and `fused` (transient animation state).
- On load: read localStorage, parse JSON, shallow-merge saved values into a copy of DEFAULTS. Nested objects (`vertexColorsA`, `vertexColorsB`) get their own merge so new default keys are picked up.
- localStorage key: `"chaos-merkaba-viz-settings"`
- Format: JSON string of the persistable subset of params.

## Controls Changes

### main.js

- Define `DEFAULTS` as a frozen object with all current hardcoded values.
- Add `loadSettings()`: reads localStorage, parses JSON, merges into a copy of DEFAULTS, returns merged params.
- Add `saveSettings()`: serializes persistable keys from params into localStorage.
- On startup, initialize `params` from `loadSettings()` instead of the inline object.
- Pass `saveSettings` to `createControlPanel`.

### controls.js

- Every `onChange` callback also calls `saveSettings()` to persist current state.
- Rename existing "Reset" button label to "Restart" (same function).
- Add new "Reset Default Settings" button that:
  1. Clears localStorage
  2. Resets all params keys back to DEFAULTS
  3. Refreshes GUI via `gui.controllersRecursive().forEach(c => c.updateDisplay())`
  4. Reapplies materials and colors to the meshes

### No new files

All changes stay in `main.js` and `controls.js`.

## Decisions

- Auto-save on every GUI change (no manual save button).
- Always play the approach animation on page load (animation state is not persisted).
