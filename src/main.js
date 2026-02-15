import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTetrahedron, setRenderMode, updateMeshColors } from './tetrahedron.js';
import { createControlPanel } from './controls.js';

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

// Compute the target relative rotation angle for merkaba alignment.
// When the two tetrahedra are at this relative Y rotation, corresponding
// named vertices (front-right↔front-right, etc.) are directly opposite
// each other in the XZ plane, forming a proper star tetrahedron.
const frontRightA = tetraA.userData.originalVerts[1]; // [apex, frontRight, frontLeft, back]
const alphaA = Math.atan2(frontRightA.z, frontRightA.x);
const MERKABA_TARGET_DELTA = Math.PI - 2 * alphaA;

const STORAGE_KEY = 'tetraviz-settings';

const DEFAULTS = Object.freeze({
  // Transform
  scale: 1.0,
  approachSpeed: 0.3,

  // Rotation
  autoRotate: true,
  rotationSpeed: 0.5,
  directionA: 'Counterclockwise',
  directionB: 'Clockwise',

  // Fusion behavior
  fusionMode: 'Unlock',       // 'Unlock' | 'Spin Lock CW' | 'Spin Lock CCW'
  rampDuration: 0.0,          // minutes to reach max speed (0 = disabled)
  rampMaxSpeed: 10.0,         // target speed for ramp (0-20)

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
        if (!(key in DEFAULTS)) continue;
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
  base.rampStartTime = null;
  base.rampBaseSpeed = 0;
  base.lockAchieved = false;
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

// OrbitControls
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Click to toggle auto-rotate (distinguish from orbit drag)
let pointerStart = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerStart = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerStart) return;
  const dx = e.clientX - pointerStart.x;
  const dy = e.clientY - pointerStart.y;
  if (dx * dx + dy * dy < 9) {
    params.autoRotate = !params.autoRotate;
    gui.controllersRecursive().find(c => c.property === 'autoRotate')?.updateDisplay();
    saveSettings();
  }
  pointerStart = null;
});

// Keyboard: +/- to adjust rotation speed (cancels ramp)
window.addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') {
    params.rampStartTime = null; // cancel ramp
    params.rotationSpeed = Math.min(Math.round((params.rotationSpeed + 0.1) * 100) / 100, 5.0);
    gui.controllersRecursive().find(c => c.property === 'rotationSpeed')?.updateDisplay();
    saveSettings();
  } else if (e.key === '-' || e.key === '_') {
    params.rampStartTime = null; // cancel ramp
    params.rotationSpeed = Math.max(Math.round((params.rotationSpeed - 0.1) * 100) / 100, 0.0);
    gui.controllersRecursive().find(c => c.property === 'rotationSpeed')?.updateDisplay();
    saveSettings();
  }
});

// Apply initial materials
const initialGlass = {
  transmission: params.transmission,
  thickness: params.thickness,
  roughness: params.roughness,
  ior: params.ior,
};
setRenderMode(tetraA, params.renderMode, params.transparency, initialGlass);
setRenderMode(tetraB, params.renderMode, params.transparency, initialGlass);

// Apply initial colors (needed when restoring saved per-vertex settings)
updateMeshColors(tetraA, params.colorA, params.perVertexA, params.vertexColorsA);
updateMeshColors(tetraB, params.colorB, params.perVertexB, params.vertexColorsB);

// Reset function
function reset() {
  params.currentSeparation = MAX_SEPARATION;
  params.fused = false;
  params.rampStartTime = null;
  params.rampBaseSpeed = 0;
  params.lockAchieved = false;
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

// Animation loop
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
      // Activate speed ramp if duration > 0
      if (params.rampDuration > 0) {
        params.rampStartTime = now;
        params.rampBaseSpeed = params.rotationSpeed;
      }
    }
  }
  tetraA.position.y = -params.currentSeparation / 2;
  tetraB.position.y = params.currentSeparation / 2;

  // Rotation (Y-axis only)
  if (params.autoRotate) {
    // Compute effective speed (with ramp if active)
    let effectiveSpeed = params.rotationSpeed;
    if (params.rampStartTime !== null) {
      const elapsedSec = (now - params.rampStartTime) / 1000;
      const durationSec = params.rampDuration * 60;
      const progress = Math.min(elapsedSec / durationSec, 1.0);
      effectiveSpeed = params.rampBaseSpeed + (params.rampMaxSpeed - params.rampBaseSpeed) * progress;
    }

    const isSpinLock = params.fusionMode !== 'Unlock';

    if (params.fused && isSpinLock && params.lockAchieved) {
      // Locked: rotate both together in the mode's direction
      const sign = params.fusionMode === 'Spin Lock CW' ? -1 : 1;
      const delta = sign * effectiveSpeed * deltaTime;
      tetraA.rotation.y += delta;
      tetraB.rotation.y += delta;
    } else if (params.fused && isSpinLock && !params.lockAchieved) {
      // Seeking: rotate independently, check for alignment each frame
      const signA = params.directionA === 'Clockwise' ? -1 : 1;
      const signB = params.directionB === 'Clockwise' ? -1 : 1;
      tetraA.rotation.y += signA * effectiveSpeed * deltaTime;
      tetraB.rotation.y += signB * effectiveSpeed * deltaTime;

      // Check merkaba alignment
      const relAngle = tetraA.rotation.y - tetraB.rotation.y;
      const TWO_PI = 2 * Math.PI;
      const normalized = ((relAngle % TWO_PI) + TWO_PI) % TWO_PI;
      const target = ((MERKABA_TARGET_DELTA % TWO_PI) + TWO_PI) % TWO_PI;
      const diff = Math.abs(normalized - target);
      if (diff < 0.08 || diff > (TWO_PI - 0.08)) {
        // Snap to exact alignment: keep A, adjust B
        tetraB.rotation.y = tetraA.rotation.y - MERKABA_TARGET_DELTA;
        params.lockAchieved = true;
      }
    } else {
      // Unlock mode or pre-fusion: independent rotation
      const signA = params.directionA === 'Clockwise' ? -1 : 1;
      const signB = params.directionB === 'Clockwise' ? -1 : 1;
      tetraA.rotation.y += signA * effectiveSpeed * deltaTime;
      tetraB.rotation.y += signB * effectiveSpeed * deltaTime;
    }
  }

  orbitControls.update();
  renderer.render(scene, camera);
}
animate();

export { params, DEFAULTS, STORAGE_KEY, saveSettings, tetraA, tetraB, MAX_SEPARATION, scene, renderer, camera };
