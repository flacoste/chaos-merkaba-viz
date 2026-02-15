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
  return new THREE.MeshPhysicalMaterial({
    color,
    transmission: glassParams.transmission ?? 0.5,
    thickness: glassParams.thickness ?? 1.0,
    roughness: glassParams.roughness ?? 0.35,
    ior: glassParams.ior ?? 1.5,
    transparent: true,
    opacity,
    flatShading: true,
    side: THREE.DoubleSide,
  });
}
