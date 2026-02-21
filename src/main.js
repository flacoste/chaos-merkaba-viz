import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTetrahedron, setRenderMode, updateMeshColors } from './tetrahedron.js';
import { createControlPanel } from './controls.js';
import {
  buildChaosSphere, setMorphProgress,
  updateChaosSphereColors, setChaosSphereRenderMode
} from './chaos-sphere.js';
import { createPhaseManager } from './phase-manager.js';
import { createParticleSystem } from './particles.js';
import { createHelpOverlay } from './help.js';

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
scene.add(tetraA);
scene.add(tetraB);

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
  setChaosSphereRenderMode(chaosSphereGroup, params.renderMode, 0, gp);
  scene.add(chaosSphereGroup);
}

// Lock shape alignment targets.
const backAngleA = Math.atan2(tetraA.userData.originalVerts[3].z, tetraA.userData.originalVerts[3].x);
const backAngleB = Math.atan2(tetraB.userData.originalVerts[3].z, tetraB.userData.originalVerts[3].x);
const TWO_PI = 2 * Math.PI;
const STELLA_LOCK_TARGET = ((backAngleA - backAngleB - Math.PI) % TWO_PI + TWO_PI) % TWO_PI;
const MERKABA_LOCK_TARGET = ((backAngleA - backAngleB) % TWO_PI + TWO_PI) % TWO_PI;
const ALIGNMENT_TOLERANCE = 0.03;

// Helper: get current 4 colors for a tetrahedron
function getTetraColors(mainColor, perVertex, vertexColorsObj) {
  if (perVertex) {
    return Object.values(vertexColorsObj).map(hex => new THREE.Color(hex));
  }
  const c = new THREE.Color(mainColor);
  return [c, c, c, c];
}

const OLD_STORAGE_KEY = 'chaos-merkaba-viz-settings';
const PRESETS_KEY = 'chaos-merkaba-viz-presets';

const DEFAULTS = Object.freeze({
  // Transform
  scale: 1.0,
  approachDuration: 0.5,     // minutes (0 = skip approach)

  // Rotation
  rotationSpeed: 0.5,
  directionA: 'Counterclockwise',
  directionB: 'Clockwise',

  // Fusion behavior
  fusionMode: 'Unlock',       // 'Unlock' | 'Spin Lock CW' | 'Spin Lock CCW'
  lockShape: 'Stella Octangula', // 'Stella Octangula' | 'Merkaba'
  rampDuration: 2.0,          // minutes to reach max speed (0 = disabled)
  rampMaxSpeed: 10.0,         // target speed for ramp (0-20)

  // Appearance
  renderMode: 'Glass',

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
    frontRight: '#800080',
    frontLeft: '#fd8c4e',
    back: '#228B22',
  }),

  // Colors - Pointing Down
  colorB: '#ffffff',
  perVertexB: false,
  vertexColorsB: Object.freeze({
    bottom: '#e2c72c',
    frontRight: '#42425c',
    frontLeft: '#4169E1',
    back: '#CC0000',
  }),

  // Chaos Sphere
  morphEnabled: true,
  chaosScale: 1.2,
  sphereRadius: 0.45,
  rayRadius: 0.10,
  coneRadius: 0.15,

  // Emission
  emitEnabled: true,
  emitDelay: 0.5,             // minutes after top speed
  coneAngle: 15,              // degrees
  emissionRate: 10,           // particles/sec/point
  particleSpeed: 3,           // units/sec
});

// Shipped presets beyond Default. Users can overwrite these; deletions are ephemeral.
const SHIPPED_PRESETS = Object.freeze({
  '8 Rays Chaos Sphere': {
    scale: 1, approachDuration: 0.5, rotationSpeed: 0.5,
    directionA: 'Counterclockwise', directionB: 'Clockwise',
    fusionMode: 'Unlock', lockShape: 'Stella Octangula',
    rampDuration: 2, rampMaxSpeed: 10,
    renderMode: 'Glass', transmission: 0.5, thickness: 1, roughness: 0.35, ior: 1.5,
    colorA: '#ff0000', perVertexA: true,
    vertexColorsA: { top: '#d6ff33', frontRight: '#800080', frontLeft: '#fd8c4e', back: '#228B22' },
    colorB: '#ffffff', perVertexB: true,
    vertexColorsB: { bottom: '#e2c72c', frontRight: '#42425c', frontLeft: '#4169E1', back: '#CC0000' },
    morphEnabled: true, chaosScale: 1.2, sphereRadius: 0.45, rayRadius: 0.1, coneRadius: 0.15,
    emitEnabled: true, emitDelay: 0.5, coneAngle: 15, emissionRate: 10, particleSpeed: 3,
  },
  'Stella Octangula': {
    scale: 1, approachDuration: 0.5, rotationSpeed: 0.5,
    directionA: 'Counterclockwise', directionB: 'Clockwise',
    fusionMode: 'Spin Lock CCW', lockShape: 'Stella Octangula',
    rampDuration: 2, rampMaxSpeed: 10,
    renderMode: 'Glass', transmission: 0.5, thickness: 1, roughness: 0.35, ior: 1.5,
    colorA: '#ff0000', perVertexA: false,
    vertexColorsA: { top: '#d6ff33', frontRight: '#800080', frontLeft: '#fd8c4e', back: '#228B22' },
    colorB: '#ffffff', perVertexB: false,
    vertexColorsB: { bottom: '#e2c72c', frontRight: '#42425c', frontLeft: '#4169E1', back: '#CC0000' },
    morphEnabled: false, chaosScale: 1.2, sphereRadius: 0.45, rayRadius: 0.1, coneRadius: 0.15,
    emitEnabled: true, emitDelay: 0.5, coneAngle: 15, emissionRate: 10, particleSpeed: 3,
  },
  'Merkaba': {
    scale: 1, approachDuration: 0.5, rotationSpeed: 0.5,
    directionA: 'Counterclockwise', directionB: 'Clockwise',
    fusionMode: 'Spin Lock CW', lockShape: 'Merkaba',
    rampDuration: 2, rampMaxSpeed: 10,
    renderMode: 'Glass', transmission: 0.5, thickness: 1, roughness: 0.35, ior: 1.5,
    colorA: '#ff0000', perVertexA: false,
    vertexColorsA: { top: '#d6ff33', frontRight: '#800080', frontLeft: '#fd8c4e', back: '#228B22' },
    colorB: '#ffffff', perVertexB: false,
    vertexColorsB: { bottom: '#e2c72c', frontRight: '#42425c', frontLeft: '#4169E1', back: '#CC0000' },
    morphEnabled: false, chaosScale: 1.2, sphereRadius: 0.45, rayRadius: 0.1, coneRadius: 0.15,
    emitEnabled: true, emitDelay: 0.5, coneAngle: 15, emissionRate: 10, particleSpeed: 3,
  },
  'Black Chaos Sphere': {
    scale: 1, approachDuration: 0.5, rotationSpeed: 0.5,
    directionA: 'Counterclockwise', directionB: 'Clockwise',
    fusionMode: 'Spin Lock CW', lockShape: 'Stella Octangula',
    rampDuration: 2, rampMaxSpeed: 10,
    renderMode: 'Glass', transmission: 0.5, thickness: 1, roughness: 0.35, ior: 1.5,
    colorA: '#5a5858', perVertexA: false,
    vertexColorsA: { top: '#d6ff33', frontRight: '#800080', frontLeft: '#fd8c4e', back: '#228B22' },
    colorB: '#5a5858', perVertexB: false,
    vertexColorsB: { bottom: '#e2c72c', frontRight: '#42425c', frontLeft: '#4169E1', back: '#CC0000' },
    morphEnabled: true, chaosScale: 1.2, sphereRadius: 0.45, rayRadius: 0.1, coneRadius: 0.15,
    emitEnabled: false, emitDelay: 0.5, coneAngle: 15, emissionRate: 10, particleSpeed: 3,
  },
});

// --- Preset persistence ---

/** Deep-clone a settings object (handles nested vertexColors). */
function cloneSettings(src) {
  return {
    ...src,
    vertexColorsA: { ...src.vertexColorsA },
    vertexColorsB: { ...src.vertexColorsB },
  };
}

/** Merge a preset onto DEFAULTS so missing keys get default values. */
function mergeOntoDefaults(preset) {
  const base = cloneSettings(DEFAULTS);
  for (const key of Object.keys(preset)) {
    if (!(key in DEFAULTS)) continue;
    if (key === 'vertexColorsA' || key === 'vertexColorsB') {
      Object.assign(base[key], preset[key]);
    } else {
      base[key] = preset[key];
    }
  }
  return base;
}

/** Read raw preset store from localStorage. */
function readPresetStore() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        lastPreset: data.lastPreset || 'Default',
        presets: data.presets || {},
      };
    }
  } catch {
    // Corrupted — wipe and start fresh
    localStorage.removeItem(PRESETS_KEY);
  }
  return { lastPreset: 'Default', presets: {} };
}

/** Write preset store to localStorage. */
function writePresetStore(store) {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(store));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      window.alert('Cannot save — localStorage is full.');
    }
  }
}

/** Get the effective preset map: Default + shipped + user overrides. */
function getEffectivePresets() {
  const store = readPresetStore();
  const effective = { Default: DEFAULTS };
  // Shipped presets (code-defined order)
  for (const [name, values] of Object.entries(SHIPPED_PRESETS)) {
    effective[name] = values;
  }
  // User overrides win on name collision
  for (const [name, values] of Object.entries(store.presets)) {
    effective[name] = values;
  }
  return effective;
}

/** Get ordered preset names: Default first, then shipped (code order), then user (alpha). */
function getPresetNames() {
  const store = readPresetStore();
  const shippedNames = Object.keys(SHIPPED_PRESETS);
  const userNames = Object.keys(store.presets)
    .filter(n => n !== 'Default' && !shippedNames.includes(n))
    .sort();
  return ['Default', ...shippedNames, ...userNames];
}

/** Save (or overwrite) a user preset. */
function saveUserPreset(name, settings) {
  const store = readPresetStore();
  store.presets[name] = cloneSettings(settings);
  store.lastPreset = name;
  writePresetStore(store);
}

/** Delete a user preset. Returns true if the preset was actually in storage. */
function deleteUserPreset(name) {
  const store = readPresetStore();
  const existed = name in store.presets;
  delete store.presets[name];
  store.lastPreset = 'Default';
  writePresetStore(store);
  return existed;
}

/** Persist which preset is currently active (meta-state). */
function setLastPreset(name) {
  const store = readPresetStore();
  store.lastPreset = name;
  writePresetStore(store);
}

/** Get the last-active preset name, validated against available presets. */
function getLastPreset() {
  const store = readPresetStore();
  const effective = getEffectivePresets();
  if (store.lastPreset in effective) return store.lastPreset;
  return 'Default';
}

/** Migrate: silently clear old storage key on first run. */
function migrateOldStorage() {
  if (localStorage.getItem(OLD_STORAGE_KEY)) {
    localStorage.removeItem(OLD_STORAGE_KEY);
  }
}

/** Load initial params from the last-active preset. */
function loadInitialParams() {
  migrateOldStorage();
  const presetName = getLastPreset();
  const effective = getEffectivePresets();
  const preset = effective[presetName] || DEFAULTS;
  const result = mergeOntoDefaults(preset);
  result.paused = false;
  return result;
}

// Shared params — initialized from last-active preset or defaults
const params = loadInitialParams();

// Phase context — all transient animation state lives here
const ctx = {
  params,
  MAX_SEPARATION,
  // Transient state (reset by phase enter() methods)
  currentSeparation: MAX_SEPARATION,
  fused: false,
  lockAchieved: false,
  morphProgress: 0,
  rampElapsed: 0,
  rampActive: false,
  rampBaseSpeed: 0,
  stateElapsed: 0,
  approachSpeed: 0,
  emitting: false,
  emitDelayElapsed: 0,
  emitRampElapsed: 0,
  emitAccumulator: 0,

  computeEffectiveSpeed() {
    let speed = this.params.rotationSpeed;
    if (this.rampActive) {
      const durationSec = this.params.rampDuration * 60;
      const progress = durationSec > 0 ? Math.min(this.rampElapsed / durationSec, 1.0) : 1.0;
      const effectiveMax = Math.max(this.params.rampMaxSpeed, this.rampBaseSpeed);
      speed = this.rampBaseSpeed + (effectiveMax - this.rampBaseSpeed) * progress;
    }
    return speed;
  },

  // Alignment check callback — called by FUSE_LOCK phase to determine lock
  checkAlignment(effectiveSpeed, dt) {
    const target = this.params.lockShape === 'Merkaba' ? MERKABA_LOCK_TARGET : STELLA_LOCK_TARGET;
    const relAngle = tetraA.rotation.y - tetraB.rotation.y;
    const normalized = ((relAngle % TWO_PI) + TWO_PI) % TWO_PI;
    const diff = Math.abs(normalized - target);
    const frameTolerance = Math.max(ALIGNMENT_TOLERANCE, effectiveSpeed * dt * 1.1);
    if (diff < frameTolerance || diff > (TWO_PI - frameTolerance)) {
      const k = Math.round((relAngle - target) / TWO_PI);
      tetraB.rotation.y = tetraA.rotation.y - (target + k * TWO_PI);
      this.lockAchieved = true;
    }
    // Force-snap after 3 seconds
    if (!this.lockAchieved && this.stateElapsed > 3.0) {
      const k = Math.round((relAngle - target) / TWO_PI);
      tetraB.rotation.y = tetraA.rotation.y - (target + k * TWO_PI);
      this.lockAchieved = true;
    }
  },
};

// Phase manager
let phaseManager = createPhaseManager(ctx);
phaseManager.restart();
function getPhaseManager() { return phaseManager; }

// Particle system (created lazily when emission starts)
let particleSystem = null;
const _tmpVec = new THREE.Vector3();

// Pre-allocated emission buffers (zero-allocation hot path)
const _emissionPoints = Array.from({ length: 8 }, () => ({
  px: 0, py: 0, pz: 0, nx: 0, ny: 0, nz: 0, r: 0, g: 0, b: 0,
}));
const _colorsA = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
const _colorsB = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];

function fillTetraColors(out, mainColor, perVertex, vertexColorsObj) {
  if (perVertex) {
    const vals = Object.values(vertexColorsObj);
    for (let i = 0; i < 4; i++) out[i].set(vals[i]);
  } else {
    for (let i = 0; i < 4; i++) out[i].set(mainColor);
  }
}

// Returns the number of emission points filled into _emissionPoints
function computeEmissionPoints() {
  let count = 0;
  fillTetraColors(_colorsA, params.colorA, params.perVertexA, params.vertexColorsA);
  fillTetraColors(_colorsB, params.colorB, params.perVertexB, params.vertexColorsB);

  if (ctx.morphProgress > 0 && chaosSphereGroup && chaosSphereGroup.visible) {
    // Emit from ray tips
    chaosSphereGroup.updateMatrixWorld(true);
    const { rays } = chaosSphereGroup.userData;

    for (let i = 0; i < 8; i++) {
      const ray = rays[i];
      const rayGroup = ray.cylMesh.parent;
      const tipY = ray.coneMesh.position.y + ray.coneHeight * ray.coneMesh.scale.y;
      _tmpVec.set(0, tipY, 0);
      _tmpVec.applyMatrix4(rayGroup.matrixWorld);

      const len = _tmpVec.length() || 1;
      const color = i < 4 ? _colorsA[i] : _colorsB[i - 4];
      const pt = _emissionPoints[count];
      pt.px = _tmpVec.x; pt.py = _tmpVec.y; pt.pz = _tmpVec.z;
      pt.nx = _tmpVec.x / len; pt.ny = _tmpVec.y / len; pt.nz = _tmpVec.z / len;
      pt.r = color.r; pt.g = color.g; pt.b = color.b;
      count++;
    }
  } else if (ctx.fused) {
    // Emit from tetra vertex positions
    tetraA.updateMatrixWorld(true);
    tetraB.updateMatrixWorld(true);

    for (let i = 0; i < 4; i++) {
      _tmpVec.copy(tetraA.userData.originalVerts[i]);
      _tmpVec.applyMatrix4(tetraA.matrixWorld);
      const len = _tmpVec.length() || 1;
      const pt = _emissionPoints[count];
      pt.px = _tmpVec.x; pt.py = _tmpVec.y; pt.pz = _tmpVec.z;
      pt.nx = _tmpVec.x / len; pt.ny = _tmpVec.y / len; pt.nz = _tmpVec.z / len;
      pt.r = _colorsA[i].r; pt.g = _colorsA[i].g; pt.b = _colorsA[i].b;
      count++;
    }
    for (let i = 0; i < 4; i++) {
      _tmpVec.copy(tetraB.userData.originalVerts[i]);
      _tmpVec.applyMatrix4(tetraB.matrixWorld);
      const len = _tmpVec.length() || 1;
      const pt = _emissionPoints[count];
      pt.px = _tmpVec.x; pt.py = _tmpVec.y; pt.pz = _tmpVec.z;
      pt.nx = _tmpVec.x / len; pt.ny = _tmpVec.y / len; pt.nz = _tmpVec.z / len;
      pt.r = _colorsB[i].r; pt.g = _colorsB[i].g; pt.b = _colorsB[i].b;
      count++;
    }
  }

  return count;
}

// OrbitControls
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.minAzimuthAngle = 0;
orbitControls.maxAzimuthAngle = 0;

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Camera roll state (transient — not saved in presets)
let rollAngle = 0;
let rollDelta = 0;
let cameraResetActive = false;
let pauseToggleTimeout = null;
const _rollQuat = new THREE.Quaternion();
const _viewDir = new THREE.Vector3();
const _defaultCamPos = new THREE.Vector3(0, 0, 6);
const _defaultTarget = new THREE.Vector3(0, 0, 0);

// Click to toggle pause (distinguish from orbit drag)
let pointerStart = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerStart = { x: e.clientX, y: e.clientY, button: e.button };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerStart) return;
  const dx = e.clientX - pointerStart.x;
  const dy = e.clientY - pointerStart.y;
  if (dx * dx + dy * dy < 9) {
    // Debounce: delay pause toggle so double-click doesn't flicker
    if (pauseToggleTimeout) {
      clearTimeout(pauseToggleTimeout);
      pauseToggleTimeout = null;
    } else {
      pauseToggleTimeout = setTimeout(() => {
        params.paused = !params.paused;
        pauseToggleTimeout = null;
      }, 300);
    }
  }
  pointerStart = null;
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!pointerStart || pointerStart.button !== 0) return;
  cameraResetActive = false;
  const sensitivity = (2 * Math.PI) / renderer.domElement.clientHeight;
  rollDelta += e.movementX * sensitivity;
});
renderer.domElement.addEventListener('dblclick', () => {
  rollAngle = Math.atan2(Math.sin(rollAngle), Math.cos(rollAngle));
  cameraResetActive = true;
  rollDelta = 0;
});

// Apply initial materials
const initialGlass = {
  transmission: params.transmission,
  thickness: params.thickness,
  roughness: params.roughness,
  ior: params.ior,
};
setRenderMode(tetraA, params.renderMode, 0, initialGlass);
setRenderMode(tetraB, params.renderMode, 0, initialGlass);

// Apply initial colors (needed when restoring saved per-vertex settings)
updateMeshColors(tetraA, params.colorA, params.perVertexA, params.vertexColorsA);
updateMeshColors(tetraB, params.colorB, params.perVertexB, params.vertexColorsB);

// Build initial chaos sphere
rebuildChaosSphere();

// Reset function
function reset() {
  params.paused = false;
  if (chaosSphereGroup) chaosSphereGroup.visible = false;
  // Restore tetra visibility and opacity
  const isGlass = params.renderMode === 'Glass';
  tetraA.material.opacity = 1;
  tetraA.material.transparent = isGlass;
  tetraA.visible = true;
  tetraB.material.opacity = 1;
  tetraB.material.transparent = isGlass;
  tetraB.visible = true;
  // Reset particles
  if (particleSystem) {
    particleSystem.resetParticles();
  }
  phaseManager.restart();
}

// Fullscreen
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

// Control panel
gui = createControlPanel(params, tetraA, tetraB, MAX_SEPARATION, reset, fullscreenFn);

// Help overlay
let lastHelpToggle = 0;

function dismissHelp() {
  help.hide();
  params.paused = false;
  gui.domElement.style.display = '';
  if (pauseToggleTimeout) {
    clearTimeout(pauseToggleTimeout);
    pauseToggleTimeout = null;
  }
  lastHelpToggle = performance.now();
}

function showHelp() {
  params.paused = true;
  gui.domElement.style.display = 'none';
  help.show();
  if (pauseToggleTimeout) {
    clearTimeout(pauseToggleTimeout);
    pauseToggleTimeout = null;
  }
  lastHelpToggle = performance.now();
}

const help = createHelpOverlay({ onDismiss: dismissHelp });

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (gui.domElement.contains(document.activeElement)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Modal gate: any key dismisses help
  if (help.isVisible()) {
    if (performance.now() - lastHelpToggle < 300) return;
    dismissHelp();
    return;
  }

  switch (e.key) {
    case ' ':
      e.preventDefault();
      params.paused = !params.paused;
      break;

    case 'f':
    case 'F':
      fullscreenFn();
      break;

    case '?':
      if (performance.now() - lastHelpToggle < 300) return;
      if (document.fullscreenElement) {
        document.exitFullscreen().then(() => showHelp());
      } else {
        showHelp();
      }
      break;
  }
});

// Animation loop
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = (now - lastTime) / 1000; // seconds
  lastTime = now;

  if (!params.paused) {
    // Scale
    tetraA.scale.setScalar(params.scale);
    tetraB.scale.setScalar(params.scale);

    // Advance ramp timer (independent of phases)
    if (ctx.rampActive) {
      ctx.rampElapsed += dt;
    }

    // Update phase state machine
    phaseManager.update(dt);

    // Apply tetra positions from phase state
    tetraA.position.y = -ctx.currentSeparation / 2;
    tetraB.position.y = ctx.currentSeparation / 2;

    // Rotation (Y-axis only)
    const effectiveSpeed = ctx.computeEffectiveSpeed();
    const isSpinLock = params.fusionMode !== 'Unlock';
    const signA = params.directionA === 'Clockwise' ? -1 : 1;
    const signB = params.directionB === 'Clockwise' ? -1 : 1;

    if (ctx.fused && isSpinLock && ctx.lockAchieved) {
      // Locked: rotate both together in the mode's direction
      const sign = params.fusionMode === 'Spin Lock CW' ? -1 : 1;
      const delta = sign * effectiveSpeed * dt;
      tetraA.rotation.y += delta;
      tetraB.rotation.y += delta;
    } else {
      // Independent rotation (seeking, unlock, or pre-fusion)
      // Alignment detection handled by FUSE_LOCK phase via ctx.checkAlignment()
      tetraA.rotation.y += signA * effectiveSpeed * dt;
      tetraB.rotation.y += signB * effectiveSpeed * dt;
    }

    // Chaos sphere morph visuals
    if (chaosSphereGroup) {
      setMorphProgress(chaosSphereGroup, ctx.morphProgress);

      if (ctx.morphProgress > 0) {
        chaosSphereGroup.scale.setScalar(params.scale * params.chaosScale);
        chaosSphereGroup.rotation.y = tetraA.rotation.y;
        const tetraOpacity = 1 - ctx.morphProgress;
        tetraA.material.opacity = tetraOpacity;
        tetraA.material.transparent = true;
        tetraB.material.opacity = tetraOpacity;
        tetraB.material.transparent = true;
        tetraA.visible = ctx.morphProgress < 1;
        tetraB.visible = ctx.morphProgress < 1;
      } else {
        const isGlass = params.renderMode === 'Glass';
        tetraA.material.opacity = 1;
        tetraA.material.transparent = isGlass;
        tetraA.visible = true;
        tetraB.material.opacity = 1;
        tetraB.material.transparent = isGlass;
        tetraB.visible = true;
      }
    }

    // Particle emission
    if (ctx.emitting && !particleSystem) {
      particleSystem = createParticleSystem();
      particleSystem.mesh.renderOrder = 1;
      scene.add(particleSystem.mesh);
    }

    if (ctx.emitting && particleSystem) {
      ctx.emitRampElapsed += dt;
      const rampFactor = Math.min(1, ctx.emitRampElapsed / 3.0);
      const totalRate = params.emissionRate * 8 * rampFactor;
      ctx.emitAccumulator += totalRate * dt;
      const count = Math.floor(ctx.emitAccumulator);
      ctx.emitAccumulator -= count;

      if (count > 0) {
        const pointCount = computeEmissionPoints();
        if (pointCount > 0) {
          particleSystem.setEmissionPoints(_emissionPoints, pointCount);
          particleSystem.setConeAngle(params.coneAngle);
          particleSystem.emit(count, params.particleSpeed);
        }
      }
    }

    if (particleSystem) {
      particleSystem.update(dt);
    }
  }

  if (cameraResetActive) {
    // Smoothly animate camera back to default position, target, and roll
    const t = 1 - Math.pow(0.9, dt * 60);
    camera.position.lerp(_defaultCamPos, t);
    orbitControls.target.lerp(_defaultTarget, t);
    rollAngle *= (1 - t);

    const posDist = camera.position.distanceTo(_defaultCamPos);
    const targetDist = orbitControls.target.length();
    if (posDist < 0.01 && targetDist < 0.01 && Math.abs(rollAngle) < 0.001) {
      camera.position.copy(_defaultCamPos);
      orbitControls.target.set(0, 0, 0);
      rollAngle = 0;
      cameraResetActive = false;
    }
    // Sync OrbitControls' internal state every frame during reset,
    // so canceling mid-animation doesn't cause a camera jump
    orbitControls.update();
  } else {
    orbitControls.update();

    // Camera roll damping
    rollAngle += rollDelta * 0.05;
    rollDelta *= 0.95;
    if (Math.abs(rollDelta) < 0.0001) rollDelta = 0;
  }

  // Apply roll rotation around camera's local Z-axis
  if (rollAngle !== 0) {
    _viewDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
    _rollQuat.setFromAxisAngle(_viewDir, rollAngle);
    camera.quaternion.premultiply(_rollQuat);
  }

  renderer.render(scene, camera);
}
animate();

// First-load: pause after first frame, show help overlay
params.paused = true;
gui.domElement.style.display = 'none';
help.show();

function getChaosSphereGroup() { return chaosSphereGroup; }

export {
  DEFAULTS, SHIPPED_PRESETS, getPhaseManager,
  rebuildChaosSphere, getChaosSphereGroup, getTetraColors,
  setChaosSphereRenderMode, updateChaosSphereColors,
  cloneSettings, mergeOntoDefaults,
  getEffectivePresets, getPresetNames,
  saveUserPreset, deleteUserPreset,
  setLastPreset, getLastPreset,
};
