# Tetraviz Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a meditative 3D visualization of two tetrahedra that approach, fuse into a star tetrahedron, and rotate — with a full control panel and fullscreen mode.

**Architecture:** Single-page app with one Three.js scene containing two tetrahedron meshes. A shared params object drives all animation and appearance. lil-gui binds directly to params for instant reactivity. Vite bundles to static files.

**Tech Stack:** Three.js, lil-gui, Vite, vanilla JS

**Design doc:** `docs/plans/2026-02-14-chaos-merkaba-viz-design.md`

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`

**Step 1: Initialize project and install dependencies**

Run:
```bash
npm init -y
npm install three lil-gui
npm install -D vite
```

**Step 2: Create vite.config.js**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
});
```

The `base: './'` ensures the built app works when opened as local files (relative paths).

**Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tetraviz</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

**Step 4: Create minimal src/main.js**

```js
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
```

**Step 5: Add npm scripts to package.json**

Add to the `"scripts"` section:
```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

**Step 6: Verify — run dev server**

Run: `npm run dev`
Expected: Dev server starts, browser shows a black screen (empty scene). No errors in console.

**Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html src/main.js
git commit -m "feat: scaffold project with Vite, Three.js, and empty scene"
```

---

### Task 2: Tetrahedron Geometry & Basic Scene

**Files:**
- Create: `src/tetrahedron.js`
- Modify: `src/main.js`

**Step 1: Create src/tetrahedron.js**

This module creates a tetrahedron mesh with a given color and orientation.

```js
import * as THREE from 'three';

const TETRA_RADIUS = 1;

export function createTetrahedron(color, flipUpsideDown = false) {
  const geometry = new THREE.TetrahedronGeometry(TETRA_RADIUS, 0);
  const material = new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);

  if (flipUpsideDown) {
    mesh.rotation.x = Math.PI; // 180° flip
  }

  return mesh;
}
```

**Step 2: Add lighting and tetrahedra to main.js**

Replace `src/main.js` with:

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTetrahedron } from './tetrahedron.js';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Camera
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 6);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// Tetrahedra
const MAX_SEPARATION = 3;
const tetraA = createTetrahedron(0xff0000, false); // red, points up
const tetraB = createTetrahedron(0xffffff, true);  // white, points down
const initialSep = MAX_SEPARATION * 0.8;
tetraA.position.y = -initialSep / 2;
tetraB.position.y = initialSep / 2;
scene.add(tetraA);
scene.add(tetraB);

// OrbitControls
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  orbitControls.update();
  renderer.render(scene, camera);
}
animate();
```

**Step 3: Verify**

Run: `npm run dev`
Expected: Two tetrahedra visible — red pointing up (bottom), white pointing down (top), separated vertically. Camera orbits with mouse drag. Black background.

**Step 4: Commit**

```bash
git add src/tetrahedron.js src/main.js
git commit -m "feat: add two tetrahedra with lighting and orbit controls"
```

---

### Task 3: Params Object & Animation Loop

**Files:**
- Modify: `src/main.js`

This task adds the shared params object and the core animation logic (approach + rotation).

**Step 1: Add params and animation logic to main.js**

Add before the animation loop:

```js
// Shared params — lil-gui will bind to this later
const params = {
  // Transform
  scale: 1.0,
  initialSeparation: 0.8, // fraction of MAX_SEPARATION
  approachSpeed: 0.3,

  // Rotation
  autoRotate: true,
  rotationSpeed: 0.5,

  // State (not exposed to GUI)
  currentSeparation: MAX_SEPARATION * 0.8,
  fused: false,
};

export { params, tetraA, tetraB, MAX_SEPARATION, scene, renderer, camera };
```

Replace the animate function:

```js
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const deltaTime = (now - lastTime) / 1000; // seconds
  lastTime = now;

  // Scale
  tetraA.scale.setScalar(params.scale);
  tetraB.scale.setScalar(params.scale);

  // Approach
  if (!params.fused) {
    params.currentSeparation -= params.approachSpeed * deltaTime;
    if (params.currentSeparation <= 0) {
      params.currentSeparation = 0;
      params.fused = true;
    }
  }
  tetraA.position.y = -params.currentSeparation / 2;
  tetraB.position.y = params.currentSeparation / 2;

  // Rotation (Y-axis only)
  if (params.autoRotate) {
    tetraA.rotation.y -= params.rotationSpeed * deltaTime; // counterclockwise
    tetraB.rotation.y += params.rotationSpeed * deltaTime; // clockwise
  }

  orbitControls.update();
  renderer.render(scene, camera);
}
animate();
```

**Step 2: Verify**

Run: `npm run dev`
Expected: The two tetrahedra slowly approach each other while rotating in opposite directions. They meet in the center and stop moving but keep rotating.

**Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: add params-driven animation (approach + rotation)"
```

---

### Task 4: Materials System

**Files:**
- Create: `src/materials.js`
- Modify: `src/tetrahedron.js`

**Step 1: Create src/materials.js**

```js
import * as THREE from 'three';

export function createSolidMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
  });
}

export function createWireframeMaterial(color, opacity = 1.0) {
  return new THREE.LineBasicMaterial({
    color,
    opacity,
    transparent: opacity < 1.0,
  });
}

export function createGlassMaterial(color, opacity = 0.5) {
  return new THREE.MeshPhysicalMaterial({
    color,
    transmission: 0.9,
    thickness: 0.5,
    roughness: 0.1,
    ior: 1.5,
    transparent: true,
    opacity,
    flatShading: true,
    side: THREE.DoubleSide,
  });
}
```

**Step 2: Update src/tetrahedron.js to support render mode switching**

Replace the file:

```js
import * as THREE from 'three';
import { createSolidMaterial, createWireframeMaterial, createGlassMaterial } from './materials.js';

const TETRA_RADIUS = 1;

export function createTetrahedron(color, flipUpsideDown = false) {
  const geometry = new THREE.TetrahedronGeometry(TETRA_RADIUS, 0);
  // Start with glass (default mode)
  const material = createGlassMaterial(color);
  const mesh = new THREE.Mesh(geometry, material);

  if (flipUpsideDown) {
    mesh.rotation.x = Math.PI;
  }

  // Store edges for wireframe mode
  const edgesGeometry = new THREE.EdgesGeometry(geometry);
  const edgesMaterial = createWireframeMaterial(color);
  const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
  edges.visible = false;
  mesh.add(edges);

  // Attach references for mode switching
  mesh.userData.baseColor = color;
  mesh.userData.edges = edges;

  return mesh;
}

export function setRenderMode(mesh, mode, color, transparency) {
  const edges = mesh.userData.edges;

  // Dispose old material
  if (mesh.material) mesh.material.dispose();

  switch (mode) {
    case 'Solid':
      mesh.material = createSolidMaterial(color);
      mesh.material.transparent = transparency > 0;
      mesh.material.opacity = 1.0 - transparency;
      mesh.visible = true;
      edges.visible = false;
      break;

    case 'Wireframe':
      // Hide mesh faces, show edges only
      mesh.material = new THREE.MeshBasicMaterial({ visible: false });
      edges.material.dispose();
      edges.material = createWireframeMaterial(color, 1.0 - transparency);
      mesh.visible = true;
      edges.visible = true;
      break;

    case 'Glass':
      mesh.material = createGlassMaterial(color, 1.0 - transparency);
      mesh.visible = true;
      edges.visible = false;
      break;
  }
}
```

**Step 3: Verify**

Run: `npm run dev`
Expected: Tetrahedra now render in glass mode by default. No visual regression — approach and rotation still work.

**Step 4: Commit**

```bash
git add src/materials.js src/tetrahedron.js
git commit -m "feat: add materials system with solid, wireframe, and glass modes"
```

---

### Task 5: Control Panel

**Files:**
- Create: `src/controls.js`
- Modify: `src/main.js`

**Step 1: Create src/controls.js**

```js
import GUI from 'lil-gui';
import { setRenderMode } from './tetrahedron.js';

export function createControlPanel(params, tetraA, tetraB, MAX_SEPARATION, resetFn, fullscreenFn) {
  const gui = new GUI({ title: 'Tetraviz' });

  // Transform folder
  const transform = gui.addFolder('Transform');
  transform.add(params, 'scale', 0.1, 3.0, 0.01).name('Scale');
  transform.add(params, 'initialSeparation', 0.1, 1.0, 0.01).name('Initial Separation')
    .onChange(() => resetFn());
  transform.add(params, 'approachSpeed', 0.0, 2.0, 0.01).name('Approach Speed');

  // Rotation folder
  const rotation = gui.addFolder('Rotation');
  rotation.add(params, 'autoRotate').name('Auto-Rotate');
  rotation.add(params, 'rotationSpeed', 0.0, 5.0, 0.01).name('Rotation Speed');

  // Appearance folder
  const appearance = gui.addFolder('Appearance');
  appearance.add(params, 'renderMode', ['Solid', 'Wireframe', 'Glass']).name('Render Mode')
    .onChange(() => applyMaterials(params, tetraA, tetraB));
  appearance.addColor(params, 'colorA').name('Color A (bottom)')
    .onChange(() => applyMaterials(params, tetraA, tetraB));
  appearance.addColor(params, 'colorB').name('Color B (top)')
    .onChange(() => applyMaterials(params, tetraA, tetraB));
  appearance.add(params, 'transparency', 0.0, 1.0, 0.01).name('Transparency')
    .onChange(() => applyMaterials(params, tetraA, tetraB));

  // Actions
  gui.add({ reset: resetFn }, 'reset').name('Reset');
  gui.add({ fullscreen: fullscreenFn }, 'fullscreen').name('Fullscreen');

  return gui;
}

function applyMaterials(params, tetraA, tetraB) {
  setRenderMode(tetraA, params.renderMode, params.colorA, params.transparency);
  setRenderMode(tetraB, params.renderMode, params.colorB, params.transparency);
}
```

**Step 2: Update src/main.js — integrate control panel**

Add to the params object:
```js
  // Appearance
  renderMode: 'Glass',
  colorA: '#ff0000',
  colorB: '#ffffff',
  transparency: 0.0,
```

Add imports and setup after the tetrahedra are created:
```js
import { createControlPanel } from './controls.js';
import { setRenderMode } from './tetrahedron.js';

// Apply initial materials
setRenderMode(tetraA, params.renderMode, params.colorA, params.transparency);
setRenderMode(tetraB, params.renderMode, params.colorB, params.transparency);

// Reset function
function reset() {
  params.currentSeparation = params.initialSeparation * MAX_SEPARATION;
  params.fused = false;
}

// Fullscreen function (placeholder, implemented in Task 6)
function toggleFullscreen() {
  renderer.domElement.requestFullscreen();
}

// Control panel
const gui = createControlPanel(params, tetraA, tetraB, MAX_SEPARATION, reset, toggleFullscreen);
```

**Step 3: Verify**

Run: `npm run dev`
Expected: lil-gui panel appears on the right. All sliders work:
- Scale changes tetrahedra size
- Approach speed changes how fast they merge
- Changing Initial Separation triggers a reset
- Render mode switches between Solid/Wireframe/Glass
- Color pickers change tetrahedra colors
- Transparency slider works
- Reset button snaps back to initial position

**Step 4: Commit**

```bash
git add src/controls.js src/main.js
git commit -m "feat: add lil-gui control panel with all parameters"
```

---

### Task 6: Fullscreen Mode

**Files:**
- Create: `src/fullscreen.js`
- Modify: `src/main.js`

**Step 1: Create src/fullscreen.js**

```js
export function setupFullscreen(canvas, gui) {
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      canvas.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      gui.domElement.style.display = 'none';
    } else {
      gui.domElement.style.display = '';
    }
  });

  return toggleFullscreen;
}
```

**Step 2: Integrate into main.js**

Replace the placeholder `toggleFullscreen` with:

```js
import { setupFullscreen } from './fullscreen.js';

// After gui is created:
const toggleFullscreen = setupFullscreen(renderer.domElement, gui);
```

Update the fullscreen function passed to `createControlPanel` — this requires a small refactor: create the GUI first with a placeholder, then wire up fullscreen. Alternatively, pass the renderer and gui separately. The simplest approach: create fullscreen fn that captures gui after it's assigned.

```js
let gui;
const fullscreenFn = () => {
  if (!document.fullscreenElement) {
    renderer.domElement.requestFullscreen();
    if (gui) gui.domElement.style.display = 'none';
  } else {
    document.exitFullscreen();
  }
};

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && gui) {
    gui.domElement.style.display = '';
  }
});

gui = createControlPanel(params, tetraA, tetraB, MAX_SEPARATION, reset, fullscreenFn);
```

**Step 3: Verify**

Run: `npm run dev`
Expected: Clicking "Fullscreen" button enters fullscreen, panel disappears. Pressing Escape exits fullscreen, panel returns. Animation continues throughout.

**Step 4: Commit**

```bash
git add src/fullscreen.js src/main.js
git commit -m "feat: add fullscreen mode with panel auto-hide"
```

---

### Task 7: Polish & Final Verification

**Files:**
- Modify: `src/main.js` (minor tweaks)

**Step 1: Tune default glass material appearance**

Verify the glass mode looks good with red and white. Adjust `MeshPhysicalMaterial` parameters in `materials.js` if needed:
- `transmission: 0.9` — high transmission for glass look
- `thickness: 0.5` — affects refraction depth
- `roughness: 0.1` — smooth glass surface
- `ior: 1.5` — standard glass index of refraction

Ensure `renderer.toneMapping = THREE.ACESFilmicToneMapping` is set (already done in Task 2).

**Step 2: Verify all controls end-to-end**

Run: `npm run dev`

Verification checklist:
- [ ] Both tetrahedra visible, correct colors (red bottom/up, white top/down)
- [ ] Auto-approach: they move toward each other and fuse
- [ ] Rotation: bottom counterclockwise, top clockwise
- [ ] Rotation continues after fusion
- [ ] Reset button works (snaps back, restarts approach)
- [ ] Scale slider works
- [ ] Approach speed slider works (including 0 = paused)
- [ ] Auto-rotate toggle pauses/resumes rotation
- [ ] Rotation speed slider works
- [ ] Render mode switches: Solid, Wireframe, Glass
- [ ] Color pickers change each tetrahedron independently
- [ ] Transparency slider works in all modes
- [ ] Fullscreen enters/exits, panel hides/shows
- [ ] OrbitControls: drag to orbit, scroll to zoom
- [ ] Window resize handled correctly

**Step 3: Build static output**

Run: `npm run build`
Expected: `dist/` folder created with `index.html`, JS bundle, no errors.

Run: `npm run preview`
Expected: Preview server shows the working app from the built files.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: polish and verify complete chaos-merkaba-viz app"
```

---

### Task 8: Verify static deployment works

**Step 1: Test dist/ folder as standalone files**

Run: `npx serve dist`
Expected: App loads and works fully from the static build.

**Step 2: Final commit if any changes**

```bash
git add -A
git commit -m "chore: final build verification"
```
