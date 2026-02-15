import * as THREE from 'three';

export function createSolidMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
  });
}

export function createWireframeMaterial(color, opacity = 1.0) {
  return new THREE.LineBasicMaterial({
    color,
    opacity,
    transparent: opacity < 1.0,
  });
}

export function createGlassMaterial(color, opacity = 0.5, glassParams = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    transmission: glassParams.transmission ?? 0.9,
    thickness: glassParams.thickness ?? 0.5,
    roughness: glassParams.roughness ?? 0.1,
    ior: glassParams.ior ?? 1.5,
    metalness: glassParams.metalness ?? 0.0,
    clearcoat: glassParams.clearcoat ?? 0.0,
    clearcoatRoughness: glassParams.clearcoatRoughness ?? 0.0,
    iridescence: glassParams.iridescence ?? 0.0,
    iridescenceIOR: glassParams.iridescenceIOR ?? 1.3,
    sheen: glassParams.sheen ?? 0.0,
    sheenRoughness: glassParams.sheenRoughness ?? 0.0,
    sheenColor: glassParams.sheenColor ?? '#ffffff',
    transparent: true,
    opacity,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  if (glassParams.attenuationDistance > 0) {
    mat.attenuationColor = new THREE.Color(glassParams.attenuationColor ?? '#ffffff');
    mat.attenuationDistance = glassParams.attenuationDistance;
  }

  return mat;
}
