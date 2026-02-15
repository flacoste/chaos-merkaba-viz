import GUI from 'lil-gui';
import { setRenderMode, updateMeshColors } from './tetrahedron.js';
import { saveSettings, DEFAULTS, STORAGE_KEY } from './main.js';

export function createControlPanel(params, tetraA, tetraB, MAX_SEPARATION, resetFn, fullscreenFn) {
  const gui = new GUI({ title: 'Tetraviz' });

  // Transform folder
  const transform = gui.addFolder('Transform');
  transform.add(params, 'scale', 0.1, 3.0, 0.01).name('Scale').onChange(saveSettings);
  transform.add(params, 'approachSpeed', 0.0, 2.0, 0.01).name('Approach Speed').onChange(saveSettings);

  // Rotation folder (shared settings only)
  const rotation = gui.addFolder('Rotation');
  rotation.add(params, 'autoRotate').name('Auto-Rotate').onChange(saveSettings);
  rotation.add(params, 'rotationSpeed', 0.0, 5.0, 0.01).name('Rotation Speed').onChange(saveSettings);

  // Per-tetrahedron folder builder
  function addTetraFolder(name, mesh, colorKey, perVertexKey, vcKey, dirKey, labels) {
    const folder = gui.addFolder(name);
    folder.add(params, dirKey, ['Clockwise', 'Counterclockwise']).name('Direction').onChange(saveSettings);
    folder.addColor(params, colorKey).name('Main Color')
      .onChange(() => { applyColors(params, tetraA, tetraB); saveSettings(); });
    folder.add(params, perVertexKey).name('Per-Vertex Colors')
      .onChange(() => { applyColors(params, tetraA, tetraB); saveSettings(); });

    const vcFolder = folder.addFolder('Vertex Colors');
    const vcObj = params[vcKey];
    const keys = Object.keys(vcObj);
    for (let i = 0; i < keys.length; i++) {
      vcFolder.addColor(vcObj, keys[i]).name(labels[i])
        .onChange(() => { applyColors(params, tetraA, tetraB); saveSettings(); });
    }
    return folder;
  }

  addTetraFolder('Pointing Up', tetraA,
    'colorA', 'perVertexA', 'vertexColorsA', 'directionA',
    ['Top', 'Front Right', 'Front Left', 'Back']);

  addTetraFolder('Pointing Down', tetraB,
    'colorB', 'perVertexB', 'vertexColorsB', 'directionB',
    ['Bottom', 'Front Right', 'Front Left', 'Back']);

  // Appearance folder (no more Wireframe option)
  const appearance = gui.addFolder('Appearance');
  appearance.add(params, 'renderMode', ['Solid', 'Glass']).name('Render Mode')
    .onChange(() => { applyMaterials(params, tetraA, tetraB); updateGlassVisibility(); saveSettings(); });
  appearance.add(params, 'transparency', 0.0, 1.0, 0.01).name('Transparency')
    .onChange(() => { applyMaterials(params, tetraA, tetraB); saveSettings(); });

  // Glass folder
  const glass = gui.addFolder('Glass');
  const glassOnChange = () => { applyMaterials(params, tetraA, tetraB); saveSettings(); };
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
  gui.add({ restart: resetFn }, 'restart').name('Restart');
  gui.add({
    resetDefaults: () => {
      localStorage.removeItem(STORAGE_KEY);
      // Reset all persistent keys to defaults
      for (const key of Object.keys(DEFAULTS)) {
        if (key === 'vertexColorsA' || key === 'vertexColorsB') {
          Object.assign(params[key], DEFAULTS[key]);
        } else {
          params[key] = DEFAULTS[key];
        }
      }
      // Refresh GUI
      gui.controllersRecursive().forEach(c => c.updateDisplay());
      // Reapply materials and colors
      applyMaterials(params, tetraA, tetraB);
      applyColors(params, tetraA, tetraB);
      updateGlassVisibility();
      // Also restart the animation
      resetFn();
    }
  }, 'resetDefaults').name('Reset Default Settings');
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
