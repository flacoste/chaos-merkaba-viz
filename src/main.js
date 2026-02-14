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
    tetraA.rotation.y -= params.rotationSpeed * deltaTime; // counterclockwise
    tetraB.rotation.y += params.rotationSpeed * deltaTime; // clockwise
  }

  orbitControls.update();
  renderer.render(scene, camera);
}
animate();

export { params, tetraA, tetraB, MAX_SEPARATION, scene, renderer, camera };
