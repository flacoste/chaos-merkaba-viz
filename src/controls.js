import GUI from 'lil-gui';
import { setRenderMode } from './tetrahedron.js';

export function createControlPanel(params, tetraA, tetraB, MAX_SEPARATION, resetFn, fullscreenFn) {
  const gui = new GUI({ title: 'Tetraviz' });

  // Transform folder
  const transform = gui.addFolder('Transform');
  transform.add(params, 'scale', 0.1, 3.0, 0.01).name('Scale');
  transform.add(params, 'approachSpeed', 0.0, 2.0, 0.01).name('Approach Speed');

  // Rotation folder
  const rotation = gui.addFolder('Rotation');
  rotation.add(params, 'autoRotate').name('Auto-Rotate');
  rotation.add(params, 'rotationSpeed', 0.0, 5.0, 0.01).name('Rotation Speed');
  rotation.add(params, 'directionA', ['Clockwise', 'Counterclockwise']).name('Pointing Up');
  rotation.add(params, 'directionB', ['Clockwise', 'Counterclockwise']).name('Pointing Down');

  // Appearance folder
  const appearance = gui.addFolder('Appearance');
  appearance.add(params, 'renderMode', ['Solid', 'Wireframe', 'Glass']).name('Render Mode')
    .onChange(() => { applyMaterials(params, tetraA, tetraB); updateGlassVisibility(); });
  appearance.addColor(params, 'colorA').name('Pointing Up')
    .onChange(() => applyMaterials(params, tetraA, tetraB));
  appearance.addColor(params, 'colorB').name('Pointing Down')
    .onChange(() => applyMaterials(params, tetraA, tetraB));
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

  // Show/hide glass folder based on render mode
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
  setRenderMode(tetraA, params.renderMode, params.colorA, params.transparency, gp);
  setRenderMode(tetraB, params.renderMode, params.colorB, params.transparency, gp);
}
