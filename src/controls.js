import GUI from 'lil-gui';
import { setRenderMode, updateMeshColors } from './tetrahedron.js';
import {
  DEFAULTS, SHIPPED_PRESETS, getPhaseManager,
  rebuildChaosSphere, getChaosSphereGroup, getTetraColors,
  setChaosSphereRenderMode, updateChaosSphereColors,
  cloneSettings, mergeOntoDefaults,
  getEffectivePresets, getPresetNames,
  saveUserPreset, deleteUserPreset,
  setLastPreset, getLastPreset,
} from './main.js';

export function createControlPanel(params, tetraA, tetraB, MAX_SEPARATION, resetFn, fullscreenFn) {
  const gui = new GUI({ title: 'Chaos Merkaba Viz' });

  // --- Preset state ---
  let activePresetName = getLastPreset();
  let activePresetValues = cloneSettings(mergeOntoDefaults(
    getEffectivePresets()[activePresetName] || DEFAULTS
  ));
  let isDirty = false;

  // Proxy object for the preset dropdown binding
  const presetObj = { currentPreset: activePresetName };

  // --- Helper: deep compare params against reference ---
  function checkDirty() {
    for (const key of Object.keys(DEFAULTS)) {
      if (key === 'vertexColorsA' || key === 'vertexColorsB') {
        const cur = params[key];
        const ref = activePresetValues[key];
        for (const vk of Object.keys(ref)) {
          if ((cur[vk] || '').toLowerCase() !== (ref[vk] || '').toLowerCase()) return true;
        }
      } else if (typeof DEFAULTS[key] === 'number') {
        // Round to avoid float precision issues
        if (Math.round(params[key] * 1000) !== Math.round(activePresetValues[key] * 1000)) return true;
      } else if (typeof DEFAULTS[key] === 'string') {
        const a = typeof params[key] === 'string' && params[key].startsWith('#')
          ? params[key].toLowerCase() : params[key];
        const b = typeof activePresetValues[key] === 'string' && activePresetValues[key].startsWith('#')
          ? activePresetValues[key].toLowerCase() : activePresetValues[key];
        if (a !== b) return true;
      } else {
        if (params[key] !== activePresetValues[key]) return true;
      }
    }
    return false;
  }

  function updateDropdownDisplay() {
    const names = getPresetNames();
    const wasDirty = isDirty;
    isDirty = checkDirty();

    if (isDirty) {
      const modifiedLabel = `${activePresetName} (modified)`;
      const opts = [...names, modifiedLabel];
      presetCtrl.options(opts);
      presetObj.currentPreset = modifiedLabel;
      presetCtrl.updateDisplay();
    } else if (wasDirty) {
      // Was dirty, now clean — restore normal options
      presetCtrl.options(names);
      presetObj.currentPreset = activePresetName;
      presetCtrl.updateDisplay();
    }

    // Update delete button visibility
    updateDeleteVisibility();
  }

  function markDirty() {
    updateDropdownDisplay();
  }

  // --- Helper: apply a preset to params and scene ---
  function applyPreset(presetName) {
    const effective = getEffectivePresets();
    const preset = effective[presetName];
    if (!preset) return;

    const merged = mergeOntoDefaults(preset);

    // Copy values into params
    for (const key of Object.keys(DEFAULTS)) {
      if (key === 'vertexColorsA' || key === 'vertexColorsB') {
        Object.assign(params[key], merged[key]);
      } else {
        params[key] = merged[key];
      }
    }

    // Update state
    activePresetName = presetName;
    activePresetValues = cloneSettings(merged);
    isDirty = false;
    presetObj.currentPreset = presetName;

    // Sync GUI
    gui.controllersRecursive().forEach(c => c.updateDisplay());

    // Rebuild dropdown options (clean, no modified suffix)
    presetCtrl.options(getPresetNames());
    presetObj.currentPreset = presetName;
    presetCtrl.updateDisplay();

    // Side effects
    applyMaterials(params, tetraA, tetraB);
    applyColors(params, tetraA, tetraB);
    rebuildChaosSphere();
    updateGlassVisibility();

    // Persist last preset and restart
    setLastPreset(presetName);
    resetFn();

    updateDeleteVisibility();
  }

  // --- Top area: Fullscreen, Restart ---
  gui.add({ fullscreen: fullscreenFn }, 'fullscreen').name('Fullscreen');
  gui.add({ restart: resetFn }, 'restart').name('Restart');

  // --- Preset controls ---
  const presetCtrl = gui.add(presetObj, 'currentPreset', getPresetNames())
    .name('Preset')
    .onChange((value) => {
      // Ignore selection of the "(modified)" entry — it's just a display label
      if (value.endsWith(' (modified)')) return;
      applyPreset(value);
    });

  // Save button
  gui.add({
    save: () => {
      const defaultName = activePresetName === 'Default' ? '' : activePresetName;
      const name = window.prompt('Save preset as:', defaultName);
      if (name === null) return; // Cancelled

      const trimmed = name.trim();
      if (!trimmed) return; // Empty

      if (trimmed.toLowerCase() === 'default') {
        window.alert('Cannot overwrite the Default preset.');
        return;
      }

      // Check for overwrite
      const existingNames = getPresetNames();
      if (existingNames.includes(trimmed)) {
        if (!window.confirm(`Overwrite '${trimmed}'?`)) return;
      }

      // Save current params as preset
      const toSave = {};
      for (const key of Object.keys(DEFAULTS)) {
        toSave[key] = params[key];
      }
      saveUserPreset(trimmed, toSave);

      // Update state
      activePresetName = trimmed;
      activePresetValues = cloneSettings(mergeOntoDefaults(toSave));
      isDirty = false;
      presetObj.currentPreset = trimmed;

      // Rebuild dropdown
      presetCtrl.options(getPresetNames());
      presetObj.currentPreset = trimmed;
      presetCtrl.updateDisplay();

      updateDeleteVisibility();
    }
  }, 'save').name('Save Preset');

  // Delete button
  const deleteCtrl = gui.add({
    deletePreset: () => {
      if (activePresetName === 'Default') return;

      if (!window.confirm(`Delete preset '${activePresetName}'?`)) return;

      deleteUserPreset(activePresetName);

      // If it was a shipped preset, it still exists in code — restore to shipped values
      // If it was a user preset, it's gone
      // Either way, switch to Default
      applyPreset('Default');
    }
  }, 'deletePreset').name('Delete Preset');

  function updateDeleteVisibility() {
    deleteCtrl.domElement.style.display = activePresetName === 'Default' ? 'none' : '';
  }
  updateDeleteVisibility();

  // === DRAWERS (all start closed) ===

  // --- 1. Global ---
  const global = gui.addFolder('Global');
  global.add(params, 'scale', 0.1, 3.0, 0.01).name('Scale').onChange(markDirty);
  global.add(params, 'rotationSpeed', 0.0, 5.0, 0.01).name('Rotation Speed').onChange(markDirty);
  global.add(params, 'renderMode', ['Solid', 'Glass']).name('Render Mode')
    .onChange(() => { applyMaterials(params, tetraA, tetraB); updateGlassVisibility(); markDirty(); });

  // Glass sub-drawer inside Global
  const glass = global.addFolder('Glass');
  const glassOnChange = () => { applyMaterials(params, tetraA, tetraB); markDirty(); };
  glass.add(params, 'transmission', 0.0, 1.0, 0.01).name('Transmission').onChange(glassOnChange);
  glass.add(params, 'thickness', 0.0, 5.0, 0.01).name('Thickness').onChange(glassOnChange);
  glass.add(params, 'roughness', 0.0, 1.0, 0.01).name('Roughness').onChange(glassOnChange);
  glass.add(params, 'ior', 1.0, 2.5, 0.01).name('IOR').onChange(glassOnChange);

  function updateGlassVisibility() {
    glass.show(params.renderMode === 'Glass');
  }
  updateGlassVisibility();

  global.close();

  // --- 2 & 3. Tetrahedron drawers ---
  function addTetraFolder(name, mesh, colorKey, perVertexKey, vcKey, dirKey, labels) {
    const folder = gui.addFolder(name);
    folder.add(params, dirKey, ['Clockwise', 'Counterclockwise']).name('Direction').onChange(markDirty);
    folder.addColor(params, colorKey).name('Main Color')
      .onChange(() => { applyColors(params, tetraA, tetraB); markDirty(); });
    folder.add(params, perVertexKey).name('Per-Vertex Colors')
      .onChange(() => { applyColors(params, tetraA, tetraB); markDirty(); });

    const vcFolder = folder.addFolder('Vertex Colors');
    const vcObj = params[vcKey];
    const keys = Object.keys(vcObj);
    for (let i = 0; i < keys.length; i++) {
      vcFolder.addColor(vcObj, keys[i]).name(labels[i])
        .onChange(() => { applyColors(params, tetraA, tetraB); markDirty(); });
    }
    folder.close();
    return folder;
  }

  addTetraFolder('Pointing Up Tetrahedron', tetraA,
    'colorA', 'perVertexA', 'vertexColorsA', 'directionA',
    ['Top', 'Front Right', 'Front Left', 'Back']);

  addTetraFolder('Pointing Down Tetrahedron', tetraB,
    'colorB', 'perVertexB', 'vertexColorsB', 'directionB',
    ['Bottom', 'Front Right', 'Front Left', 'Back']);

  // --- 4. Approach ---
  const approach = gui.addFolder('Approach');
  approach.add(params, 'approachDuration', 0.0, 5.0, 0.1).name('Duration (min)')
    .onChange(() => { getPhaseManager().onParamChange('approachDuration'); markDirty(); });
  approach.close();

  // --- 5. Fuse ---
  const fuse = gui.addFolder('Fuse');
  fuse.add(params, 'fusionMode', ['Unlock', 'Spin Lock CW', 'Spin Lock CCW']).name('Fusion Mode')
    .onChange(() => { getPhaseManager().onParamChange('fusionMode'); markDirty(); });
  fuse.add(params, 'lockShape', ['Stella Octangula', 'Merkaba']).name('Lock Shape')
    .onChange(() => { getPhaseManager().onParamChange('lockShape'); rebuildChaosSphere(); markDirty(); });
  fuse.add(params, 'rampDuration', 0.0, 5.0, 0.1).name('Ramp Duration (min)')
    .onChange(() => { getPhaseManager().onParamChange('rampDuration'); markDirty(); });
  fuse.add(params, 'rampMaxSpeed', 0.0, 20.0, 0.1).name('Ramp Max Speed')
    .onChange(() => { getPhaseManager().onParamChange('rampMaxSpeed'); markDirty(); });
  fuse.close();

  // --- 6. Chaos Sphere ---
  const chaosSphereFolder = gui.addFolder('Chaos Sphere');
  chaosSphereFolder.add(params, 'morphEnabled').name('Morph Enabled')
    .onChange(() => { getPhaseManager().onParamChange('morphEnabled'); markDirty(); });
  const rebuildOnChange = () => { rebuildChaosSphere(); markDirty(); };
  chaosSphereFolder.add(params, 'chaosScale', 0.5, 3.0, 0.01).name('Scale').onChange(markDirty);
  chaosSphereFolder.add(params, 'sphereRadius', 0.05, 0.5, 0.01).name('Sphere Radius').onChange(rebuildOnChange);
  chaosSphereFolder.add(params, 'rayRadius', 0.01, 0.15, 0.01).name('Ray Radius').onChange(rebuildOnChange);
  chaosSphereFolder.add(params, 'coneRadius', 0.02, 0.3, 0.01).name('Cone Radius').onChange(rebuildOnChange);
  chaosSphereFolder.close();

  // --- 7. Particles ---
  const particles = gui.addFolder('Particles');
  particles.add(params, 'emitEnabled').name('Emit Enabled')
    .onChange(() => { getPhaseManager().onParamChange('emitEnabled'); markDirty(); });
  particles.add(params, 'emitDelay', 0.0, 5.0, 0.1).name('Emit Delay (min)').onChange(markDirty);
  particles.add(params, 'coneAngle', 5, 45, 1).name('Cone Angle (deg)').onChange(markDirty);
  particles.add(params, 'emissionRate', 1, 50, 1).name('Emission Rate').onChange(markDirty);
  particles.add(params, 'particleSpeed', 1, 10, 0.5).name('Particle Speed').onChange(markDirty);
  particles.close();

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
