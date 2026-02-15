# Persistent Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Save GUI settings to localStorage so they persist across sessions, add a "Reset Default Settings" button, and rename the existing "Reset" to "Restart".

**Architecture:** Extract hardcoded defaults into a `DEFAULTS` constant. Add `loadSettings()`/`saveSettings()` functions that serialize the persistable subset of params to localStorage. Wire every GUI onChange to auto-save. Add a reset-to-defaults button.

**Tech Stack:** JavaScript, lil-gui, localStorage

---

### Task 1: Extract DEFAULTS constant and persistence functions in main.js

**Files:**
- Modify: `src/main.js`

**Step 1: Define DEFAULTS and TRANSIENT_KEYS**

At the top of `main.js` (after imports, before scene setup), replace the inline `params` object with a `DEFAULTS` constant and persistence helpers. Replace this block (lines 37-81):

```js
// Shared params — lil-gui will bind to this later
const params = {
  // Transform
  scale: 1.0,
  ...
  fused: false,
};
```

With:

```js
const STORAGE_KEY = 'tetraviz-settings';
const TRANSIENT_KEYS = ['currentSeparation', 'fused'];

const DEFAULTS = Object.freeze({
  // Transform
  scale: 1.0,
  approachSpeed: 0.3,

  // Rotation
  autoRotate: true,
  rotationSpeed: 0.5,
  directionA: 'Counterclockwise',
  directionB: 'Clockwise',

  // Appearance
  renderMode: 'Glass',
  transparency: 0.0,

  // Glass material
  transmission: 0.5,
  thickness: 1.0,
  roughness: 0.35,
  ior: 1.5,

  // Colors - Pointing Up
  colorA: '#ff0000',
  perVertexA: false,
  vertexColorsA: Object.freeze({
    top: '#d6ff33',
    frontRight: '#42425c',
    frontLeft: '#fd8c4e',
    back: '#CC0000',
  }),

  // Colors - Pointing Down
  colorB: '#ffffff',
  perVertexB: false,
  vertexColorsB: Object.freeze({
    bottom: '#e2c72c',
    frontRight: '#800080',
    frontLeft: '#4169E1',
    back: '#228B22',
  }),
});

function loadSettings() {
  const base = {
    ...DEFAULTS,
    vertexColorsA: { ...DEFAULTS.vertexColorsA },
    vertexColorsB: { ...DEFAULTS.vertexColorsB },
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      for (const key of Object.keys(saved)) {
        if (key === 'vertexColorsA' || key === 'vertexColorsB') {
          Object.assign(base[key], saved[key]);
        } else {
          base[key] = saved[key];
        }
      }
    }
  } catch {
    // Corrupted storage — use defaults
  }
  // Always add transient state fresh
  base.currentSeparation = MAX_SEPARATION;
  base.fused = false;
  return base;
}

function saveSettings() {
  const toSave = {};
  for (const key of Object.keys(DEFAULTS)) {
    toSave[key] = params[key];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

// Shared params — initialized from saved settings or defaults
const params = loadSettings();
```

Note: `loadSettings()` references `MAX_SEPARATION` which is defined on line 30, so this block must come after that constant.

**Step 2: Update exports**

Replace the existing export line at the bottom of `main.js`:

```js
export { params, tetraA, tetraB, MAX_SEPARATION, scene, renderer, camera };
```

With:

```js
export { params, DEFAULTS, saveSettings, tetraA, tetraB, MAX_SEPARATION, scene, renderer, camera };
```

**Step 3: Verify**

Run: `npm run dev`

Open browser. The app should load and behave identically to before (no saved settings yet, so DEFAULTS are used). Check the browser console for errors.

**Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: extract DEFAULTS constant and add load/save settings"
```

---

### Task 2: Wire auto-save into controls.js

**Files:**
- Modify: `src/controls.js`

**Step 1: Import saveSettings and update function signature**

Replace the import line at the top of `controls.js`:

```js
import { setRenderMode, updateMeshColors } from './tetrahedron.js';
```

With:

```js
import { setRenderMode, updateMeshColors } from './tetrahedron.js';
import { saveSettings } from './main.js';
```

**Step 2: Add saveSettings call to every onChange**

In `createControlPanel`, add `.onChange(saveSettings)` or append `saveSettings()` to existing onChange handlers.

For controllers that currently have NO onChange (plain `add` calls), chain `.onChange(saveSettings)`:

```js
// Transform folder
transform.add(params, 'scale', 0.1, 3.0, 0.01).name('Scale').onChange(saveSettings);
transform.add(params, 'approachSpeed', 0.0, 2.0, 0.01).name('Approach Speed').onChange(saveSettings);

// Rotation folder
rotation.add(params, 'autoRotate').name('Auto-Rotate').onChange(saveSettings);
rotation.add(params, 'rotationSpeed', 0.0, 5.0, 0.01).name('Rotation Speed').onChange(saveSettings);
```

For controllers that already have an onChange, add `saveSettings()` inside the existing callback:

```js
// In addTetraFolder:
folder.add(params, dirKey, ['Clockwise', 'Counterclockwise']).name('Direction').onChange(saveSettings);
folder.addColor(params, colorKey).name('Main Color')
  .onChange(() => { applyColors(params, tetraA, tetraB); saveSettings(); });
folder.add(params, perVertexKey).name('Per-Vertex Colors')
  .onChange(() => { applyColors(params, tetraA, tetraB); saveSettings(); });

// In vertex colors loop:
vcFolder.addColor(vcObj, keys[i]).name(labels[i])
  .onChange(() => { applyColors(params, tetraA, tetraB); saveSettings(); });

// Appearance folder:
appearance.add(params, 'renderMode', ['Solid', 'Glass']).name('Render Mode')
  .onChange(() => { applyMaterials(params, tetraA, tetraB); updateGlassVisibility(); saveSettings(); });
appearance.add(params, 'transparency', 0.0, 1.0, 0.01).name('Transparency')
  .onChange(() => { applyMaterials(params, tetraA, tetraB); saveSettings(); });

// Glass folder:
const glassOnChange = () => { applyMaterials(params, tetraA, tetraB); saveSettings(); };
```

**Step 3: Verify**

Run: `npm run dev`

Open browser. Change a setting (e.g., scale slider). Open DevTools > Application > Local Storage. Verify `tetraviz-settings` key exists with JSON containing the updated value. Refresh the page — the setting should persist.

**Step 4: Commit**

```bash
git add src/controls.js
git commit -m "feat: auto-save settings to localStorage on every change"
```

---

### Task 3: Rename Reset to Restart, add Reset Default Settings button

**Files:**
- Modify: `src/controls.js`
- Modify: `src/main.js`

**Step 1: Import DEFAULTS in controls.js**

Update the import from main.js:

```js
import { saveSettings, DEFAULTS } from './main.js';
```

**Step 2: Rename Reset to Restart**

In `createControlPanel`, change line 66:

```js
gui.add({ reset: resetFn }, 'reset').name('Reset');
```

To:

```js
gui.add({ restart: resetFn }, 'restart').name('Restart');
```

**Step 3: Add Reset Default Settings button**

After the Restart button and before the Fullscreen button, add:

```js
gui.add({
  resetDefaults: () => {
    localStorage.removeItem('tetraviz-settings');
    // Reset all persistent keys to defaults
    for (const key of Object.keys(DEFAULTS)) {
      if (key === 'vertexColorsA' || key === 'vertexColorsB') {
        Object.assign(params[key], DEFAULTS[key]);
      } else {
        params[key] = DEFAULTS[key];
      }
    }
    // Refresh GUI
    gui.controllersRecursive().forEach(c => c.updateDisplay());
    // Reapply materials and colors
    applyMaterials(params, tetraA, tetraB);
    applyColors(params, tetraA, tetraB);
    updateGlassVisibility();
    // Also restart the animation
    resetFn();
  }
}, 'resetDefaults').name('Reset Default Settings');
```

Note: `updateGlassVisibility` is currently a local function inside `createControlPanel`, so it's already accessible. `applyMaterials` and `applyColors` are module-level functions in `controls.js`, also accessible.

**Step 4: Verify**

Run: `npm run dev`

1. Change several settings (scale, colors, render mode).
2. Refresh — settings should persist.
3. Click "Reset Default Settings" — all controls should snap back to defaults, localStorage should be cleared.
4. Refresh — should load with defaults again.
5. Click "Restart" — tetrahedra should re-separate and approach again.

**Step 5: Commit**

```bash
git add src/main.js src/controls.js
git commit -m "feat: rename Reset to Restart, add Reset Default Settings button"
```
