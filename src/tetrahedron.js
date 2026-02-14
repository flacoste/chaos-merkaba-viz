import * as THREE from 'three';

const TETRA_RADIUS = 1;

export function createTetrahedron(color, flipUpsideDown = false) {
  const geometry = new THREE.TetrahedronGeometry(TETRA_RADIUS, 0);
  const material = new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);

  if (flipUpsideDown) {
    mesh.rotation.x = Math.PI; // 180° flip
  }

  return mesh;
}
