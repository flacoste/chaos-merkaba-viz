# Per-Vertex Coloring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-vertex coloring to each tetrahedron (4 colors per tetra, 8 total), with subdivided faces showing solid corner triangles and gradient center triangles.

**Architecture:** Use `TetrahedronGeometry(radius, 1)` for subdivision, vertex color `BufferAttribute` for per-vertex coloring, and a `perVertex` toggle to switch between uniform main color and individual vertex colors. Remove wireframe mode entirely.

**Tech Stack:** Three.js (BufferGeometry, vertex colors, MeshStandardMaterial, MeshPhysicalMaterial), lil-gui

---

### Task 1: Update materials.js — remove wireframe, add vertex color support

**Files:**
- Modify: `src/materials.js`

**Step 1: Rewrite materials.js**

Replace the entire file. Remove `createWireframeMaterial`. Update `createSolidMaterial` and `createGlassMaterial` to use `vertexColors: true` and base color white. Remove the `color` parameter from both functions since color comes from vertex attributes.

```javascript
import * as THREE from 'three';

export function createSolidMaterial(opacity = 1.0) {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    transparent: opacity < 1.0,
    opacity,
  });
}

export function createGlassMaterial(opacity = 0.5, glassParams = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    transmission: glassParams.transmission ?? 0.5,
    thickness: glassParams.thickness ?? 1.0,
    roughness: glassParams.roughness ?? 0.35,
    ior: glassParams.ior ?? 1.5,
    transparent: true,
    opacity,
    flatShading: true,
    side: THREE.DoubleSide,
  });
}
```

**Step 2: Commit**

```bash
git add src/materials.js
git commit -m "refactor: remove wireframe material, add vertex color support"
```

---

### Task 2: Update tetrahedron.js — subdivided geometry and vertex color functions

**Files:**
- Modify: `src/tetrahedron.js`

**Step 1: Rewrite tetrahedron.js**

Major changes:
- Geometry uses detail=1 (16 faces instead of 4)
- New `computeOriginalVertices()` — extracts the 4 original vertex positions from a reference geometry
- New `buildVertexColors()` — assigns colors to each vertex in the subdivided geometry (corner triangles solid, center triangles gradient)
- New `updateMeshColors()` — high-level function for color updates from GUI
- Updated `setRenderMode()` — removes wireframe case, removes color parameter
- Removed all edges/wireframe code

```javascript
import * as THREE from 'three';
import { createSolidMaterial, createGlassMaterial } from './materials.js';

const TETRA_RADIUS = 1;

/**
 * Compute the 4 original vertex positions of the tetrahedron.
 * Returns [apex, base1, base2, base3] where apex is the highest-Y vertex
 * (or lowest-Y if flipped) and base vertices are sorted by atan2(z, x).
 */
function computeOriginalVertices(flipUpsideDown) {
  const refGeo = new THREE.TetrahedronGeometry(TETRA_RADIUS, 0);
  const alignQuat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 1, 1).normalize(),
    new THREE.Vector3(0, 1, 0)
  );
  refGeo.applyQuaternion(alignQuat);
  if (flipUpsideDown) refGeo.rotateX(Math.PI);

  // Extract unique vertices from the non-indexed geometry
  const pos = refGeo.attributes.position;
  const verts = [];
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (!verts.some(e => e.distanceTo(v) < 0.001)) {
      verts.push(v);
    }
  }
  refGeo.dispose();

  // Sort: apex first (highest Y for upright, lowest Y for flipped)
  verts.sort((a, b) => flipUpsideDown ? a.y - b.y : b.y - a.y);
  const apex = verts[0];
  const base = verts.slice(1);
  // Sort base vertices by angle for consistent ordering
  base.sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  return [apex, ...base];
}

/**
 * Build the vertex color attribute for a subdivided tetrahedron geometry.
 *
 * For each face (3 consecutive vertices in the non-indexed geometry):
 * - Corner triangle (has a vertex at an original position): all 3 verts get that vertex's color
 * - Center triangle (all midpoints): each vert gets the average of its 2 nearest original vertex colors
 *
 * @param {THREE.BufferGeometry} geometry - Subdivided tetrahedron geometry (detail=1)
 * @param {THREE.Vector3[]} originalVerts - The 4 original vertex positions [apex, base1, base2, base3]
 * @param {THREE.Color[]} colors - 4 colors matching the originalVerts order
 */
export function buildVertexColors(geometry, originalVerts, colors) {
  const posAttr = geometry.attributes.position;
  const count = posAttr.count;
  const colorArr = new Float32Array(count * 3);
  const EPSILON = 0.01;

  for (let face = 0; face < count; face += 3) {
    const vInfos = [];
    for (let i = 0; i < 3; i++) {
      const vi = face + i;
      const pos = new THREE.Vector3(
        posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi)
      );
      const dists = originalVerts.map((ov, idx) => ({
        idx, dist: pos.distanceTo(ov)
      }));
      dists.sort((a, b) => a.dist - b.dist);
      vInfos.push({
        vi,
        isOriginal: dists[0].dist < EPSILON,
        nearest: dists[0].idx,
        secondNearest: dists[1].idx,
      });
    }

    if (vInfos.some(v => v.isOriginal)) {
      // Corner triangle — all vertices get the corner vertex's color
      const cornerIdx = vInfos.find(v => v.isOriginal).nearest;
      const c = colors[cornerIdx];
      for (let i = 0; i < 3; i++) {
        const vi = face + i;
        colorArr[vi * 3] = c.r;
        colorArr[vi * 3 + 1] = c.g;
        colorArr[vi * 3 + 2] = c.b;
      }
    } else {
      // Center triangle — each midpoint blends its 2 nearest original vertex colors
      for (let i = 0; i < 3; i++) {
        const vi = face + i;
        const info = vInfos[i];
        const c1 = colors[info.nearest];
        const c2 = colors[info.secondNearest];
        colorArr[vi * 3] = (c1.r + c2.r) / 2;
        colorArr[vi * 3 + 1] = (c1.g + c2.g) / 2;
        colorArr[vi * 3 + 2] = (c1.b + c2.b) / 2;
      }
    }
  }

  if (geometry.attributes.color) {
    geometry.attributes.color.array.set(colorArr);
    geometry.attributes.color.needsUpdate = true;
  } else {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorArr, 3));
  }
}

export function createTetrahedron(color, flipUpsideDown = false) {
  const geometry = new THREE.TetrahedronGeometry(TETRA_RADIUS, 1);

  const defaultVertex = new THREE.Vector3(1, 1, 1).normalize();
  const targetUp = new THREE.Vector3(0, 1, 0);
  const alignQuat = new THREE.Quaternion().setFromUnitVectors(defaultVertex, targetUp);
  geometry.applyQuaternion(alignQuat);

  if (flipUpsideDown) {
    geometry.rotateX(Math.PI);
  }

  const originalVerts = computeOriginalVertices(flipUpsideDown);

  // Build initial vertex colors (uniform main color)
  const c = new THREE.Color(color);
  buildVertexColors(geometry, originalVerts, [c, c, c, c]);

  const material = createGlassMaterial();
  const mesh = new THREE.Mesh(geometry, material);

  mesh.userData.baseColor = color;
  mesh.userData.originalVerts = originalVerts;

  return mesh;
}

/**
 * Update vertex colors on a mesh based on the current color settings.
 *
 * @param {THREE.Mesh} mesh - The tetrahedron mesh (must have userData.originalVerts)
 * @param {string} mainColor - Hex string for the uniform main color
 * @param {boolean} perVertex - Whether to use per-vertex colors
 * @param {object} vertexColorsObj - Object with 4 hex color values (order matches originalVerts)
 */
export function updateMeshColors(mesh, mainColor, perVertex, vertexColorsObj) {
  const originalVerts = mesh.userData.originalVerts;
  let colors;
  if (perVertex) {
    colors = Object.values(vertexColorsObj).map(hex => new THREE.Color(hex));
  } else {
    const c = new THREE.Color(mainColor);
    colors = [c, c, c, c];
  }
  buildVertexColors(mesh.geometry, originalVerts, colors);
}

export function setRenderMode(mesh, mode, transparency, glassParams = {}) {
  if (mesh.material) mesh.material.dispose();

  const opacity = 1.0 - transparency;
  switch (mode) {
    case 'Solid':
      mesh.material = createSolidMaterial(opacity);
      mesh.visible = true;
      break;
    case 'Glass':
      mesh.material = createGlassMaterial(opacity, glassParams);
      mesh.visible = true;
      break;
  }
}
```

**Step 2: Commit**

```bash
git add src/tetrahedron.js
git commit -m "feat: subdivided geometry with per-vertex color support"
```

---

### Task 3: Update main.js — new color params, remove wireframe references

**Files:**
- Modify: `src/main.js`

**Step 1: Update params and initial setup**

Changes:
- Add `perVertexA`, `perVertexB`, `vertexColorsA`, `vertexColorsB` to params
- Remove `colorA`/`colorB` from the old "Appearance" conceptual group (they stay as params but are now under per-tetra folders)
- Update `setRenderMode` calls to remove the color argument
- Import only `createTetrahedron, setRenderMode` (no wireframe imports)

Key param additions:

```javascript
// Colors - Pointing Up
colorA: '#ff0000',
perVertexA: false,
vertexColorsA: {
  top: '#CCFF00',
  frontLeft: '#FF6600',
  frontRight: '#4169E1',
  back: '#CC0000',
},

// Colors - Pointing Down
colorB: '#ffffff',
perVertexB: false,
vertexColorsB: {
  bottom: '#FFD700',
  frontRight: '#800080',
  frontLeft: '#1C1C2E',
  back: '#228B22',
},
```

Key change in initial material application:

```javascript
// Old:
// setRenderMode(tetraA, params.renderMode, params.colorA, params.transparency);
// setRenderMode(tetraB, params.renderMode, params.colorB, params.transparency);

// New:
setRenderMode(tetraA, params.renderMode, params.transparency);
setRenderMode(tetraB, params.renderMode, params.transparency);
```

Everything else in main.js stays the same (animation loop, orbit controls, click/keyboard handlers, fullscreen, resize).

**Step 2: Commit**

```bash
git add src/main.js
git commit -m "feat: add per-vertex color params, update setRenderMode calls"
```

---

### Task 4: Update controls.js — restructured GUI with per-tetra folders

**Files:**
- Modify: `src/controls.js`

**Step 1: Rewrite controls.js**

Major changes:
- Import `updateMeshColors` from tetrahedron.js
- Remove rotation direction from the Rotation folder (moved to per-tetra folders)
- Add `addTetraFolder()` helper that creates per-tetra folder with Direction, Main Color, Per-Vertex toggle, and Vertex Colors subfolder
- Remove Wireframe from render mode options
- Color changes call `applyColors()` (updates vertex color attribute only)
- Material changes call `applyMaterials()` (creates new material, preserves vertex colors)

```javascript
import GUI from 'lil-gui';
import { setRenderMode, updateMeshColors } from './tetrahedron.js';

export function createControlPanel(params, tetraA, tetraB, MAX_SEPARATION, resetFn, fullscreenFn) {
  const gui = new GUI({ title: 'Tetraviz' });

  // Transform folder
  const transform = gui.addFolder('Transform');
  transform.add(params, 'scale', 0.1, 3.0, 0.01).name('Scale');
  transform.add(params, 'approachSpeed', 0.0, 2.0, 0.01).name('Approach Speed');

  // Rotation folder (shared settings only)
  const rotation = gui.addFolder('Rotation');
  rotation.add(params, 'autoRotate').name('Auto-Rotate');
  rotation.add(params, 'rotationSpeed', 0.0, 5.0, 0.01).name('Rotation Speed');

  // Per-tetrahedron folder builder
  function addTetraFolder(name, mesh, colorKey, perVertexKey, vcKey, dirKey, labels) {
    const folder = gui.addFolder(name);
    folder.add(params, dirKey, ['Clockwise', 'Counterclockwise']).name('Direction');
    folder.addColor(params, colorKey).name('Main Color')
      .onChange(() => applyColors(params, tetraA, tetraB));
    folder.add(params, perVertexKey).name('Per-Vertex Colors')
      .onChange(() => applyColors(params, tetraA, tetraB));

    const vcFolder = folder.addFolder('Vertex Colors');
    const vcObj = params[vcKey];
    const keys = Object.keys(vcObj);
    for (let i = 0; i < keys.length; i++) {
      vcFolder.addColor(vcObj, keys[i]).name(labels[i])
        .onChange(() => applyColors(params, tetraA, tetraB));
    }
    return folder;
  }

  addTetraFolder('Pointing Up', tetraA,
    'colorA', 'perVertexA', 'vertexColorsA', 'directionA',
    ['Top', 'Front Left', 'Front Right', 'Back']);

  addTetraFolder('Pointing Down', tetraB,
    'colorB', 'perVertexB', 'vertexColorsB', 'directionB',
    ['Bottom', 'Front Right', 'Front Left', 'Back']);

  // Appearance folder (no more Wireframe option)
  const appearance = gui.addFolder('Appearance');
  appearance.add(params, 'renderMode', ['Solid', 'Glass']).name('Render Mode')
    .onChange(() => { applyMaterials(params, tetraA, tetraB); updateGlassVisibility(); });
  appearance.add(params, 'transparency', 0.0, 1.0, 0.01).name('Transparency')
    .onChange(() => applyMaterials(params, tetraA, tetraB));

  // Glass folder
  const glass = gui.addFolder('Glass');
  const glassOnChange = () => applyMaterials(params, tetraA, tetraB);
  glass.add(params, 'transmission', 0.0, 1.0, 0.01).name('Transmission').onChange(glassOnChange);
  glass.add(params, 'thickness', 0.0, 5.0, 0.01).name('Thickness').onChange(glassOnChange);
  glass.add(params, 'roughness', 0.0, 1.0, 0.01).name('Roughness').onChange(glassOnChange);
  glass.add(params, 'ior', 1.0, 2.5, 0.01).name('IOR').onChange(glassOnChange);
  glass.close();

  function updateGlassVisibility() {
    glass.domElement.style.display = params.renderMode === 'Glass' ? '' : 'none';
  }
  updateGlassVisibility();

  // Actions
  gui.add({ reset: resetFn }, 'reset').name('Reset');
  gui.add({ fullscreen: fullscreenFn }, 'fullscreen').name('Fullscreen');

  return gui;
}

function glassParamsFrom(params) {
  return {
    transmission: params.transmission,
    thickness: params.thickness,
    roughness: params.roughness,
    ior: params.ior,
  };
}

function applyMaterials(params, tetraA, tetraB) {
  const gp = glassParamsFrom(params);
  setRenderMode(tetraA, params.renderMode, params.transparency, gp);
  setRenderMode(tetraB, params.renderMode, params.transparency, gp);
}

function applyColors(params, tetraA, tetraB) {
  updateMeshColors(tetraA, params.colorA, params.perVertexA, params.vertexColorsA);
  updateMeshColors(tetraB, params.colorB, params.perVertexB, params.vertexColorsB);
}
```

**Step 2: Commit**

```bash
git add src/controls.js
git commit -m "feat: restructure GUI with per-tetrahedron color folders"
```

---

### Task 5: Visual verification and label adjustment

**Step 1: Run the dev server**

```bash
npm run dev
```

**Step 2: Verify basic rendering**

- Both tetrahedra should render in Glass mode with uniform colors (red and white)
- Shapes should have 16 visible faces each (subdivided) but still look like tetrahedra
- Rotation, scaling, approach animation should all work as before

**Step 3: Toggle per-vertex colors ON for both tetrahedra**

- Tetra A (Pointing Up) should show 4 distinct vertex colors
- Tetra B (Pointing Down) should show 4 distinct vertex colors
- Each face should have 3 solid corner triangles and 1 gradient center triangle

**Step 4: Verify vertex label mapping**

The vertex labels (Top, Front Left, Front Right, Back) are mapped to spatial positions by sorting base vertices by `atan2(z, x)`. This ordering may not match the intuitive label names. To verify:

1. Set all 4 vertex colors to the same color except one (e.g., set Top to bright green, others to black)
2. Observe which vertex lights up
3. If "Top" doesn't correspond to the apex, the key ordering in `vertexColorsA`/`vertexColorsB` needs to be reordered

If labels are wrong, swap the key order in the `vertexColorsA`/`vertexColorsB` objects in `main.js` params and the corresponding `labels` arrays in `controls.js`. The `computeOriginalVertices` ordering is deterministic — only the label mapping may need adjustment.

**Step 5: Verify Glass mode**

- Toggle between Solid and Glass modes
- Per-vertex colors should tint the glass appropriately
- Glass parameters (transmission, thickness, roughness, IOR) should still work

**Step 6: Verify toggle behavior**

- Turn per-vertex OFF → should revert to uniform main color
- Change main color while per-vertex is ON → no visible change
- Turn per-vertex OFF → should show the new main color
- Turn per-vertex ON → should show original vertex colors (preserved)

**Step 7: Final commit**

If any label adjustments were made:

```bash
git add -A
git commit -m "fix: adjust vertex color label mapping after visual verification"
```
