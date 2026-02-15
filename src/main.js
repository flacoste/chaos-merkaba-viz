import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTetrahedron, setRenderMode } from './tetrahedron.js';
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

// Shared params — lil-gui will bind to this later
const params = {
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
  colorA: '#ff0000',
  colorB: '#ffffff',
  transparency: 0.0,

  // Glass material
  transmission: 0.9,
  thickness: 0.5,
  roughness: 0.1,
  ior: 1.5,
  metalness: 0.0,
  clearcoat: 0.0,
  clearcoatRoughness: 0.0,
  iridescence: 0.0,
  iridescenceIOR: 1.3,
  sheen: 0.0,
  sheenRoughness: 0.0,
  sheenColor: '#ffffff',
  attenuationColor: '#ffffff',
  attenuationDistance: 0.0,

  // State (not exposed to GUI)
  currentSeparation: MAX_SEPARATION,
  fused: false,
};

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
  }
  pointerStart = null;
});

// Keyboard: +/- to adjust rotation speed
window.addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') {
    params.rotationSpeed = Math.min(Math.round((params.rotationSpeed + 0.1) * 100) / 100, 5.0);
    gui.controllersRecursive().find(c => c.property === 'rotationSpeed')?.updateDisplay();
  } else if (e.key === '-' || e.key === '_') {
    params.rotationSpeed = Math.max(Math.round((params.rotationSpeed - 0.1) * 100) / 100, 0.0);
    gui.controllersRecursive().find(c => c.property === 'rotationSpeed')?.updateDisplay();
  }
});

// Apply initial materials
setRenderMode(tetraA, params.renderMode, params.colorA, params.transparency);
setRenderMode(tetraB, params.renderMode, params.colorB, params.transparency);

// Reset function
function reset() {
  params.currentSeparation = MAX_SEPARATION;
  params.fused = false;
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
    }
  }
  tetraA.position.y = -params.currentSeparation / 2;
  tetraB.position.y = params.currentSeparation / 2;

  // Rotation (Y-axis only)
  if (params.autoRotate) {
    const signA = params.directionA === 'Clockwise' ? -1 : 1;
    const signB = params.directionB === 'Clockwise' ? -1 : 1;
    tetraA.rotation.y += signA * params.rotationSpeed * deltaTime;
    tetraB.rotation.y += signB * params.rotationSpeed * deltaTime;
  }

  orbitControls.update();
  renderer.render(scene, camera);
}
animate();

export { params, tetraA, tetraB, MAX_SEPARATION, scene, renderer, camera };
