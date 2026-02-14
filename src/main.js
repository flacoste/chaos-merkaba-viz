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
  initialSeparation: 0.8, // fraction of MAX_SEPARATION
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

  // State (not exposed to GUI)
  currentSeparation: MAX_SEPARATION * 0.8,
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

// Apply initial materials
setRenderMode(tetraA, params.renderMode, params.colorA, params.transparency);
setRenderMode(tetraB, params.renderMode, params.colorB, params.transparency);

// Reset function
function reset() {
  params.currentSeparation = params.initialSeparation * MAX_SEPARATION;
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
    const signA = params.directionA === 'Clockwise' ? 1 : -1;
    const signB = params.directionB === 'Clockwise' ? 1 : -1;
    tetraA.rotation.y += signA * params.rotationSpeed * deltaTime;
    tetraB.rotation.y += signB * params.rotationSpeed * deltaTime;
  }

  orbitControls.update();
  renderer.render(scene, camera);
}
animate();

export { params, tetraA, tetraB, MAX_SEPARATION, scene, renderer, camera };
