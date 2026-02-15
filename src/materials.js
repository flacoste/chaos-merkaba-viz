import * as THREE from 'three';

export function createSolidMaterial(opacity = 1.0) {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    transparent: opacity < 1.0,
    opacity,
  });
}

export function createGlassMaterial(opacity = 0.5, glassParams = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
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
