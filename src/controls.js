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
  rotation.add(params, 'directionA', ['Clockwise', 'Counterclockwise']).name('Direction A (bottom)');
  rotation.add(params, 'directionB', ['Clockwise', 'Counterclockwise']).name('Direction B (top)');

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
