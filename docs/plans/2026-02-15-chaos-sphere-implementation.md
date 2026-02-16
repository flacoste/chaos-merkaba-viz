# Chaos Sphere Morph Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Morph the locked Stella Octangula / Merkaba into a chaos sphere (central sphere + 8 colored rays with cone tips) when rotation speed reaches 80–100% of ramp max speed.

**Architecture:** New `src/chaos-sphere.js` module handles geometry creation and morph animation. `src/main.js` adds morph progress calculation to the animation loop and manages the chaos sphere lifecycle. `src/controls.js` adds a "Chaos Sphere" settings folder.

**Tech Stack:** Three.js (SphereGeometry, CylinderGeometry, ConeGeometry, Group), lil-gui, localStorage

---

### Task 1: Add Chaos Sphere Defaults and Settings Infrastructure

**Files:**
- Modify: `src/main.js:52-98` (DEFAULTS object)
- Modify: `src/main.js:200-208` (reset function)

**Step 1: Add chaos sphere defaults to DEFAULTS object**

In `src/main.js`, add after the `vertexColorsB` block (line 97, before the closing `}`):

```javascript
  // Chaos Sphere
  morphEnabled: false,
  chaosScale: 1.2,
  sphereRadius: 0.33,
  rayRadius: 0.10,
  coneRadius: 0.15,
```

**Step 2: Verify the app still loads**

Run: `npx vite` (or existing dev server)
Expected: App loads without errors, no visible changes

**Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: add chaos sphere defaults to settings"
```

---

### Task 2: Create chaos-sphere.js — Geometry Building

**Files:**
- Create: `src/chaos-sphere.js`

**Step 1: Create the chaos sphere module**

Create `src/chaos-sphere.js` with the full geometry building logic:

```javascript
import * as THREE from 'three';
import { createSolidMaterial, createGlassMaterial } from './materials.js';

const TETRA_RADIUS = 1; // Must match tetrahedron.js

/**
 * Paint vertex colors on a geometry with a single uniform color.
 */
function paintUniformColor(geometry, color) {
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

/**
 * Paint vertex colors on a sphere geometry with a psychedelic round-robin
 * mix of all provided colors. GPU interpolation blends adjacent vertices.
 */
function paintSphereColors(geometry, allColors) {
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const n = allColors.length;
  for (let i = 0; i < count; i++) {
    const c = allColors[i % n];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

/**
 * Compute the 8 ray directions for the chaos sphere.
 *
 * Tetra A's vertices are used as-is (normalized). Tetra B's vertices are
 * rotated by -lockTarget around Y (to match the lock alignment in tetra A's
 * reference frame), then normalized.
 *
 * @param {THREE.Vector3[]} vertsA - 4 original vertices of tetra A
 * @param {THREE.Vector3[]} vertsB - 4 original vertices of tetra B
 * @param {number} lockTarget - lock alignment target angle (radians)
 * @returns {THREE.Vector3[]} 8 unit vectors (4 from A, 4 from B)
 */
function computeRayDirections(vertsA, vertsB, lockTarget) {
  const rotMatrix = new THREE.Matrix4().makeRotationY(-lockTarget);
  const directions = [];

  for (let i = 0; i < 4; i++) {
    directions.push(vertsA[i].clone().normalize());
  }
  for (let i = 0; i < 4; i++) {
    directions.push(vertsB[i].clone().applyMatrix4(rotMatrix).normalize());
  }
  return directions;
}

/**
 * Build the chaos sphere group.
 *
 * @param {THREE.Vector3[]} vertsA - 4 original vertices of tetra A
 * @param {THREE.Vector3[]} vertsB - 4 original vertices of tetra B
 * @param {number} lockTarget - lock alignment target (radians)
 * @param {object} opts - { sphereRadius, rayRadius, coneRadius }
 * @param {THREE.Color[]} colorsA - 4 colors for tetra A vertices
 * @param {THREE.Color[]} colorsB - 4 colors for tetra B vertices
 * @returns {THREE.Group}
 */
export function buildChaosSphere(vertsA, vertsB, lockTarget, opts, colorsA, colorsB) {
  const { sphereRadius, rayRadius, coneRadius } = opts;
  const coneHeight = coneRadius * 1.5;
  const cylinderLength = TETRA_RADIUS - sphereRadius;
  const allColors = [...colorsA, ...colorsB];
  const rayDirections = computeRayDirections(vertsA, vertsB, lockTarget);

  const group = new THREE.Group();

  // Central sphere with psychedelic vertex colors
  const sphereGeo = new THREE.SphereGeometry(sphereRadius, 32, 16);
  paintSphereColors(sphereGeo, allColors);
  const sphereMat = createGlassMaterial();
  const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
  group.add(sphereMesh);

  // 8 rays (cylinder + cone each)
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const dir = rayDirections[i];
    const color = i < 4 ? colorsA[i] : colorsB[i - 4];

    // Cylinder: translate geometry so pivot (y=0) is at the base
    const cylGeo = new THREE.CylinderGeometry(rayRadius, rayRadius, cylinderLength, 8);
    cylGeo.translate(0, cylinderLength / 2, 0);
    paintUniformColor(cylGeo, color);
    const cylMat = createGlassMaterial();
    const cylMesh = new THREE.Mesh(cylGeo, cylMat);
    cylMesh.position.y = sphereRadius;

    // Cone: translate geometry so base is at y=0
    const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 8);
    coneGeo.translate(0, coneHeight / 2, 0);
    paintUniformColor(coneGeo, color);
    const coneMat = createGlassMaterial();
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.y = sphereRadius + cylinderLength;

    // Sub-group oriented along the ray direction
    const rayGroup = new THREE.Group();
    rayGroup.add(cylMesh);
    rayGroup.add(coneMesh);

    // Rotate from default +Y to the ray direction
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), dir
    );
    rayGroup.quaternion.copy(quat);

    group.add(rayGroup);
    rays.push({ cylMesh, coneMesh, cylinderLength, coneHeight });
  }

  // Store references for animation
  group.userData.sphereMesh = sphereMesh;
  group.userData.rays = rays;
  group.userData.sphereRadius = sphereRadius;

  group.visible = false;
  return group;
}

/**
 * Update morph progress on the chaos sphere.
 * progress=0: fully hidden. progress=1: fully visible.
 *
 * @param {THREE.Group} group - the chaos sphere group
 * @param {number} progress - morph progress 0–1
 */
export function setMorphProgress(group, progress) {
  if (progress <= 0) {
    group.visible = false;
    return;
  }
  group.visible = true;

  const { sphereMesh, rays, sphereRadius } = group.userData;

  // Sphere grows from nothing
  sphereMesh.scale.setScalar(progress);

  // Rays extend outward, cones ride the tips
  for (const ray of rays) {
    ray.cylMesh.scale.y = progress;
    ray.coneMesh.position.y = sphereRadius + ray.cylinderLength * progress;
    ray.coneMesh.scale.setScalar(progress);
  }
}

/**
 * Update vertex colors on the chaos sphere to match current tetra colors.
 *
 * @param {THREE.Group} group - the chaos sphere group
 * @param {THREE.Color[]} colorsA - 4 colors for tetra A
 * @param {THREE.Color[]} colorsB - 4 colors for tetra B
 */
export function updateChaosSphereColors(group, colorsA, colorsB) {
  const { sphereMesh, rays } = group.userData;
  const allColors = [...colorsA, ...colorsB];

  // Repaint sphere
  paintSphereColors(sphereMesh.geometry, allColors);
  sphereMesh.geometry.attributes.color.needsUpdate = true;

  // Repaint rays
  for (let i = 0; i < 8; i++) {
    const color = i < 4 ? colorsA[i] : colorsB[i - 4];
    const ray = rays[i];
    paintUniformColor(ray.cylMesh.geometry, color);
    ray.cylMesh.geometry.attributes.color.needsUpdate = true;
    paintUniformColor(ray.coneMesh.geometry, color);
    ray.coneMesh.geometry.attributes.color.needsUpdate = true;
  }
}

/**
 * Apply render mode (solid/glass) to all chaos sphere meshes.
 *
 * @param {THREE.Group} group - the chaos sphere group
 * @param {string} mode - 'Solid' or 'Glass'
 * @param {number} transparency - 0–1
 * @param {object} glassParams - { transmission, thickness, roughness, ior }
 */
export function setChaosSphereRenderMode(group, mode, transparency, glassParams) {
  const opacity = 1.0 - transparency;
  group.traverse((child) => {
    if (child.isMesh) {
      if (child.material) child.material.dispose();
      if (mode === 'Solid') {
        child.material = createSolidMaterial(opacity);
      } else {
        child.material = createGlassMaterial(opacity, glassParams);
      }
    }
  });
}
```

**Step 2: Verify the module parses correctly**

Run: dev server should still load without errors (module not imported yet)

**Step 3: Commit**

```bash
git add src/chaos-sphere.js
git commit -m "feat: add chaos-sphere.js geometry building module"
```

---

### Task 3: Wire Chaos Sphere into Scene (main.js)

**Files:**
- Modify: `src/main.js:1-5` (imports)
- Modify: `src/main.js:29-34` (after tetra creation)
- Modify: `src/main.js:186-198` (after initial materials/colors)
- Modify: `src/main.js:200-208` (reset function)
- Modify: `src/main.js:319` (exports)

**Step 1: Add imports and helper functions**

At top of `src/main.js`, add to imports:

```javascript
import {
  buildChaosSphere, setMorphProgress,
  updateChaosSphereColors, setChaosSphereRenderMode
} from './chaos-sphere.js';
```

After the `ALIGNMENT_TOLERANCE` line (line 48), add helper functions:

```javascript
// Helper: get current 4 colors for a tetrahedron
function getTetraColors(mainColor, perVertex, vertexColorsObj) {
  if (perVertex) {
    return Object.values(vertexColorsObj).map(hex => new THREE.Color(hex));
  }
  const c = new THREE.Color(mainColor);
  return [c, c, c, c];
}
```

**Step 2: Add chaos sphere build/rebuild function and initial build**

After the line `scene.add(tetraB);` (line 34), add:

```javascript
// Chaos sphere
let chaosSphereGroup = null;

function rebuildChaosSphere() {
  if (chaosSphereGroup) {
    scene.remove(chaosSphereGroup);
    chaosSphereGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  const lockTarget = params.lockShape === 'Merkaba' ? MERKABA_LOCK_TARGET : STELLA_LOCK_TARGET;
  const colorsA = getTetraColors(params.colorA, params.perVertexA, params.vertexColorsA);
  const colorsB = getTetraColors(params.colorB, params.perVertexB, params.vertexColorsB);
  chaosSphereGroup = buildChaosSphere(
    tetraA.userData.originalVerts,
    tetraB.userData.originalVerts,
    lockTarget,
    { sphereRadius: params.sphereRadius, rayRadius: params.rayRadius, coneRadius: params.coneRadius },
    colorsA, colorsB
  );
  // Apply current render mode
  const gp = { transmission: params.transmission, thickness: params.thickness, roughness: params.roughness, ior: params.ior };
  setChaosSphereRenderMode(chaosSphereGroup, params.renderMode, params.transparency, gp);
  scene.add(chaosSphereGroup);
}
```

**Step 3: Call initial build after colors/materials are applied**

After line 198 (`updateMeshColors(tetraB, ...)`), add:

```javascript
// Build initial chaos sphere
rebuildChaosSphere();
```

**Step 4: Update reset function**

In the `reset()` function, add after `params.fuseTime = null;`:

```javascript
  // Hide chaos sphere
  if (chaosSphereGroup) chaosSphereGroup.visible = false;
```

**Step 5: Update exports**

Replace the export line with:

```javascript
export {
  params, DEFAULTS, STORAGE_KEY, saveSettings,
  tetraA, tetraB, MAX_SEPARATION, scene, renderer, camera,
  rebuildChaosSphere, chaosSphereGroup, getTetraColors,
  setChaosSphereRenderMode, updateChaosSphereColors,
};
```

Note: `chaosSphereGroup` is a `let` variable. Exporting it gives the initial reference. When `rebuildChaosSphere` reassigns it, importers won't see the update through a named import. To handle this, export a getter instead:

```javascript
function getChaosSphereGroup() { return chaosSphereGroup; }

export {
  params, DEFAULTS, STORAGE_KEY, saveSettings,
  tetraA, tetraB, MAX_SEPARATION, scene, renderer, camera,
  rebuildChaosSphere, getChaosSphereGroup, getTetraColors,
  setChaosSphereRenderMode, updateChaosSphereColors,
};
```

**Step 6: Verify app loads**

Run: dev server
Expected: App loads, chaos sphere is built but invisible (visible=false). No visual changes.

**Step 7: Commit**

```bash
git add src/main.js
git commit -m "feat: wire chaos sphere into scene lifecycle"
```

---

### Task 4: Add Chaos Sphere Controls

**Files:**
- Modify: `src/controls.js:1-5` (imports)
- Modify: `src/controls.js:22-23` (after rotation folder, before tetra folders)

**Step 1: Update imports**

In `src/controls.js`, update the main.js import:

```javascript
import {
  saveSettings, DEFAULTS, STORAGE_KEY,
  rebuildChaosSphere, getChaosSphereGroup, getTetraColors,
  setChaosSphereRenderMode, updateChaosSphereColors,
} from './main.js';
```

**Step 2: Add Chaos Sphere folder**

After the rotation folder's last control (line 22, after `rampMaxSpeed`), add:

```javascript
  // Chaos Sphere folder
  const chaosSphereFolder = gui.addFolder('Chaos Sphere');
  chaosSphereFolder.add(params, 'morphEnabled').name('Morph Enabled').onChange(saveSettings);
  const rebuildOnChange = () => { rebuildChaosSphere(); saveSettings(); };
  chaosSphereFolder.add(params, 'chaosScale', 0.5, 3.0, 0.01).name('Scale').onChange(rebuildOnChange);
  chaosSphereFolder.add(params, 'sphereRadius', 0.05, 0.5, 0.01).name('Sphere Radius').onChange(rebuildOnChange);
  chaosSphereFolder.add(params, 'rayRadius', 0.01, 0.15, 0.01).name('Ray Radius').onChange(rebuildOnChange);
  chaosSphereFolder.add(params, 'coneRadius', 0.02, 0.3, 0.01).name('Cone Radius').onChange(rebuildOnChange);
```

**Step 3: Update lockShape onChange to also rebuild chaos sphere**

Change the lockShape onChange (line 20) from:

```javascript
  rotation.add(params, 'lockShape', ['Stella Octangula', 'Merkaba']).name('Lock Shape')
    .onChange(() => { params.lockAchieved = false; saveSettings(); });
```

To:

```javascript
  rotation.add(params, 'lockShape', ['Stella Octangula', 'Merkaba']).name('Lock Shape')
    .onChange(() => { params.lockAchieved = false; rebuildChaosSphere(); saveSettings(); });
```

**Step 4: Update applyColors to also update chaos sphere colors**

Modify the `applyColors` function:

```javascript
function applyColors(params, tetraA, tetraB) {
  updateMeshColors(tetraA, params.colorA, params.perVertexA, params.vertexColorsA);
  updateMeshColors(tetraB, params.colorB, params.perVertexB, params.vertexColorsB);
  // Update chaos sphere colors
  const group = getChaosSphereGroup();
  if (group) {
    const colorsA = getTetraColors(params.colorA, params.perVertexA, params.vertexColorsA);
    const colorsB = getTetraColors(params.colorB, params.perVertexB, params.vertexColorsB);
    updateChaosSphereColors(group, colorsA, colorsB);
  }
}
```

**Step 5: Update applyMaterials to also update chaos sphere materials**

Modify the `applyMaterials` function:

```javascript
function applyMaterials(params, tetraA, tetraB) {
  const gp = glassParamsFrom(params);
  setRenderMode(tetraA, params.renderMode, params.transparency, gp);
  setRenderMode(tetraB, params.renderMode, params.transparency, gp);
  // Update chaos sphere materials
  const group = getChaosSphereGroup();
  if (group) {
    setChaosSphereRenderMode(group, params.renderMode, params.transparency, gp);
  }
}
```

**Step 6: Update resetDefaults to include chaos sphere settings**

The existing resetDefaults handler iterates `Object.keys(DEFAULTS)` and restores all values, so it already handles the new keys. However, it also needs to rebuild the chaos sphere. Add `rebuildChaosSphere();` after `applyColors(...)` in the resetDefaults handler:

```javascript
      applyColors(params, tetraA, tetraB);
      rebuildChaosSphere();
      updateGlassVisibility();
```

**Step 7: Verify controls appear**

Run: dev server
Expected: "Chaos Sphere" folder visible in GUI with 5 controls. Changing sliders triggers rebuild (no visual effect yet since chaos sphere is hidden). Settings persist on page reload.

**Step 8: Commit**

```bash
git add src/controls.js
git commit -m "feat: add chaos sphere controls folder"
```

---

### Task 5: Add Morph Logic to Animation Loop

**Files:**
- Modify: `src/main.js:233-316` (animate function)

**Step 1: Add morph progress calculation and animation**

In the animate function, after the speed ramp calculation block (after line 271, the `effectiveSpeed` calculation), and before the `const isSpinLock` line, add:

```javascript
    // Chaos sphere morph
    let morphProgress = 0;
    if (
      params.morphEnabled &&
      params.fused &&
      params.lockAchieved &&
      params.fusionMode !== 'Unlock' &&
      params.rampStartTime !== null &&
      params.rampMaxSpeed > 0
    ) {
      morphProgress = Math.max(0, Math.min(1,
        (effectiveSpeed - 0.8 * params.rampMaxSpeed) / (0.2 * params.rampMaxSpeed)
      ));
    }

    if (chaosSphereGroup) {
      setMorphProgress(chaosSphereGroup, morphProgress);
      if (morphProgress > 0) {
        // Scale: combine scene scale with chaos sphere scale
        chaosSphereGroup.scale.setScalar(params.scale * params.chaosScale * morphProgress);
        // Sync rotation with tetra A (the reference frame for lock alignment)
        chaosSphereGroup.rotation.y = tetraA.rotation.y;
      }
    }
```

Wait — there's a conflict here. `setMorphProgress` sets individual sub-mesh scales (sphere, rays), but we also want the group scale. Let me reconsider.

Actually, `setMorphProgress` handles the INTERNAL animation (sphere growing, rays extending). The GROUP scale handles the overall size (scene scale * chaos scale). These are independent and compose correctly in Three.js (group scale multiplies child scales).

But I had `setMorphProgress` setting internal scales based on progress, AND I'm setting group scale to include `* morphProgress`. That double-applies the progress to the sphere. Let me fix: the group scale should NOT include morphProgress. The internal animation in `setMorphProgress` already handles the growing effect.

Corrected:

```javascript
    if (chaosSphereGroup) {
      setMorphProgress(chaosSphereGroup, morphProgress);
      if (morphProgress > 0) {
        chaosSphereGroup.scale.setScalar(params.scale * params.chaosScale);
        chaosSphereGroup.rotation.y = tetraA.rotation.y;
        // Fade tetrahedra opacity
        const baseOpacity = 1.0 - params.transparency;
        const tetraOpacity = baseOpacity * (1 - morphProgress);
        tetraA.material.opacity = tetraOpacity;
        tetraA.material.transparent = true;
        tetraB.material.opacity = tetraOpacity;
        tetraB.material.transparent = true;
        tetraA.visible = morphProgress < 1;
        tetraB.visible = morphProgress < 1;
      } else {
        // Restore tetra opacity when morph inactive
        const baseOpacity = 1.0 - params.transparency;
        tetraA.material.opacity = baseOpacity;
        tetraA.material.transparent = baseOpacity < 1.0;
        tetraA.visible = true;
        tetraB.material.opacity = baseOpacity;
        tetraB.material.transparent = baseOpacity < 1.0;
        tetraB.visible = true;
      }
    }
```

**Step 2: Also apply chaos sphere group scale in the Scale section**

In the Scale section of animate (around line 241), after the tetra scale lines, add:

```javascript
  if (chaosSphereGroup && chaosSphereGroup.visible) {
    chaosSphereGroup.scale.setScalar(params.scale * params.chaosScale);
  }
```

Actually this is redundant with the morph block. Remove it and keep the scale setting only in the morph block. The group is only visible during morph anyway.

**Step 3: Verify the morph works end-to-end**

Run: dev server
Configure:
1. Enable "Morph Enabled" toggle
2. Set Fusion Mode to "Spin Lock CW"
3. Set Ramp Duration to 0.5 minutes
4. Set Ramp Max Speed to 10.0
5. Watch: tetrahedra approach, fuse, lock, ramp up
6. At ~80% speed: chaos sphere should start appearing, tetrahedra fading
7. At 100% speed: chaos sphere fully visible, tetrahedra hidden
8. Press `-` key to slow down: morph should reverse

Expected: Smooth morph transition with rays extending and sphere growing

**Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: add morph progress calculation and animation to loop"
```

---

### Task 6: Edge Cases and State Invalidation

**Files:**
- Modify: `src/controls.js` (fusionMode onChange)
- Modify: `src/main.js` (reset function, morph edge cases)

**Step 1: Reset morph when fusionMode changes to Unlock**

The existing fusionMode onChange resets `lockAchieved`. Since the morph prerequisites check for fusionMode !== 'Unlock' AND lockAchieved, changing to Unlock naturally stops the morph (morphProgress becomes 0). The tetra opacity restore in the `else` branch handles the rest. No change needed.

**Step 2: Reset morph when morphEnabled is toggled off mid-morph**

The morphProgress calculation already checks `params.morphEnabled`, so toggling it off sets morphProgress to 0 and the else branch restores tetra opacity. No change needed.

**Step 3: Handle ramp cancellation via +/- keys**

The +/- key handler sets `params.rampStartTime = null`, which causes `effectiveSpeed` to drop to `params.rotationSpeed` (the base speed). Since the morph formula uses `effectiveSpeed`, the morphProgress naturally drops. The else branch restores tetra opacity. No change needed.

**Step 4: Verify edge cases**

Run: dev server
Test each scenario:
1. Toggle morphEnabled off during morph → tetrahedra restore
2. Change fusionMode to Unlock during morph → tetrahedra restore
3. Press `-` key during morph → morph reverses smoothly
4. Press Restart during morph → everything resets
5. Change lock shape during morph → chaos sphere rebuilds with new ray directions

**Step 5: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: handle chaos sphere morph edge cases"
```

---

### Task 7: Visual Polish and Final Verification

**Files:**
- Possibly: `src/chaos-sphere.js` (tuning)

**Step 1: Full integration test**

Run: dev server
Full scenario walkthrough:
1. Set: Fusion Mode = "Spin Lock CW", Lock Shape = "Stella Octangula"
2. Set: Ramp Duration = 1.0 min, Ramp Max Speed = 10.0
3. Enable: Morph Enabled = true
4. Enable: Per-Vertex Colors for both tetrahedra
5. Watch full sequence: approach → fuse → lock → ramp → morph
6. Verify: 8 rays have correct individual vertex colors
7. Verify: central sphere has psychedelic multi-color gradient
8. Verify: glass material properties apply to chaos sphere
9. Switch to Solid mode → verify chaos sphere updates
10. Change Lock Shape to Merkaba → verify ray directions change
11. Change vertex colors → verify chaos sphere colors update live
12. Adjust chaos sphere Scale/Radii → verify geometry rebuilds
13. Restart → verify clean reset

**Step 2: Commit any polish fixes**

```bash
git add -A
git commit -m "fix: chaos sphere visual polish"
```

---

## Notes for Implementer

- **Three.js Y-rotation convention**: `effectiveAngle = origAngle - rotation.y` (subtraction, not addition). This matters for ray direction computation.
- **Vertex index reversal**: Tetra B is flipped via `rotateX(PI)`, so `originalVerts[i]` indices don't correspond between A and B. This is already handled since we use all 4 vertices of each tetra independently (no cross-referencing by index).
- **Glass material opacity**: Setting `opacity: 0` on glass material with `transmission > 0` may still show glass refraction. Use `mesh.visible = false` to fully hide.
- **Module export of `let` variable**: `chaosSphereGroup` is reassigned by `rebuildChaosSphere`. Use `getChaosSphereGroup()` getter to always get the current reference.
- **Geometry disposal**: Always dispose old geometries/materials before rebuilding to prevent GPU memory leaks.
