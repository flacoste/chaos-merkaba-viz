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

export function createGlassMaterial(color, opacity = 0.5) {
  return new THREE.MeshPhysicalMaterial({
    color,
    transmission: 0.9,
    thickness: 0.5,
    roughness: 0.1,
    ior: 1.5,
    transparent: true,
    opacity,
    flatShading: true,
    side: THREE.DoubleSide,
  });
}
