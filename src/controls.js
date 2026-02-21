import GUI from 'lil-gui';
import { setRenderMode, updateMeshColors } from './tetrahedron.js';
import {
  saveSettings, DEFAULTS, STORAGE_KEY, getPhaseManager,
  rebuildChaosSphere, getChaosSphereGroup, getTetraColors,
  setChaosSphereRenderMode, updateChaosSphereColors,
} from './main.js';

export function createControlPanel(params, tetraA, tetraB, MAX_SEPARATION, resetFn, fullscreenFn) {
  const gui = new GUI({ title: 'Tetraviz' });

  // Transform folder
  const transform = gui.addFolder('Transform');
  transform.add(params, 'scale', 0.1, 3.0, 0.01).name('Scale').onChange(saveSettings);
  transform.add(params, 'approachDuration', 0.0, 5.0, 0.1).name('Approach Duration (min)')
    .onChange(() => { getPhaseManager().onParamChange('approachDuration'); saveSettings(); });

  // Rotation folder
  const rotation = gui.addFolder('Rotation');
  rotation.add(params, 'rotationSpeed', 0.0, 5.0, 0.01).name('Rotation Speed').onChange(saveSettings);
  rotation.add(params, 'fusionMode', ['Unlock', 'Spin Lock CW', 'Spin Lock CCW']).name('Fusion Mode')
    .onChange(() => { getPhaseManager().onParamChange('fusionMode'); saveSettings(); });
  rotation.add(params, 'lockShape', ['Stella Octangula', 'Merkaba']).name('Lock Shape')
    .onChange(() => { getPhaseManager().onParamChange('lockShape'); rebuildChaosSphere(); saveSettings(); });
  rotation.add(params, 'rampDuration', 0.0, 5.0, 0.1).name('Ramp Duration (min)')
    .onChange(() => { getPhaseManager().onParamChange('rampDuration'); saveSettings(); });
  rotation.add(params, 'rampMaxSpeed', 0.0, 20.0, 0.1).name('Ramp Max Speed')
    .onChange(() => { getPhaseManager().onParamChange('rampMaxSpeed'); saveSettings(); });

  // Chaos Sphere folder
  const chaosSphereFolder = gui.addFolder('Chaos Sphere');
  chaosSphereFolder.add(params, 'morphEnabled').name('Morph Enabled')
    .onChange(() => { getPhaseManager().onParamChange('morphEnabled'); saveSettings(); });
  const rebuildOnChange = () => { rebuildChaosSphere(); saveSettings(); };
  chaosSphereFolder.add(params, 'chaosScale', 0.5, 3.0, 0.01).name('Scale').onChange(saveSettings);
  chaosSphereFolder.add(params, 'sphereRadius', 0.05, 0.5, 0.01).name('Sphere Radius').onChange(rebuildOnChange);
  chaosSphereFolder.add(params, 'rayRadius', 0.01, 0.15, 0.01).name('Ray Radius').onChange(rebuildOnChange);
  chaosSphereFolder.add(params, 'coneRadius', 0.02, 0.3, 0.01).name('Cone Radius').onChange(rebuildOnChange);

  // Emission folder
  const emission = gui.addFolder('Emission');
  emission.add(params, 'emitEnabled').name('Emit Enabled')
    .onChange(() => { getPhaseManager().onParamChange('emitEnabled'); saveSettings(); });
  emission.add(params, 'emitDelay', 0.0, 5.0, 0.1).name('Emit Delay (min)')
    .onChange(saveSettings);
  emission.add(params, 'coneAngle', 5, 45, 1).name('Cone Angle (deg)')
    .onChange(saveSettings);
  emission.add(params, 'emissionRate', 1, 50, 1).name('Emission Rate')
    .onChange(saveSettings);
  emission.add(params, 'particleSpeed', 1, 10, 0.5).name('Particle Speed')
    .onChange(saveSettings);

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

  // Appearance folder
  const appearance = gui.addFolder('Appearance');
  appearance.add(params, 'renderMode', ['Solid', 'Glass']).name('Render Mode')
    .onChange(() => { applyMaterials(params, tetraA, tetraB); updateGlassVisibility(); saveSettings(); });

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
      for (const key of Object.keys(DEFAULTS)) {
        if (key === 'vertexColorsA' || key === 'vertexColorsB') {
          Object.assign(params[key], DEFAULTS[key]);
        } else {
          params[key] = DEFAULTS[key];
        }
      }
      gui.controllersRecursive().forEach(c => c.updateDisplay());
      applyMaterials(params, tetraA, tetraB);
      applyColors(params, tetraA, tetraB);
      rebuildChaosSphere();
      updateGlassVisibility();
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
  setRenderMode(tetraA, params.renderMode, 0, gp);
  setRenderMode(tetraB, params.renderMode, 0, gp);
  const group = getChaosSphereGroup();
  if (group) {
    setChaosSphereRenderMode(group, params.renderMode, 0, gp);
  }
}

function applyColors(params, tetraA, tetraB) {
  updateMeshColors(tetraA, params.colorA, params.perVertexA, params.vertexColorsA);
  updateMeshColors(tetraB, params.colorB, params.perVertexB, params.vertexColorsB);
  const group = getChaosSphereGroup();
  if (group) {
    const colorsA = getTetraColors(params.colorA, params.perVertexA, params.vertexColorsA);
    const colorsB = getTetraColors(params.colorB, params.perVertexB, params.vertexColorsB);
    updateChaosSphereColors(group, colorsA, colorsB);
  }
}
