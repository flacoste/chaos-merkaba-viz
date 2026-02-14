import * as THREE from 'three';
import { createSolidMaterial, createWireframeMaterial, createGlassMaterial } from './materials.js';

const TETRA_RADIUS = 1;

export function createTetrahedron(color, flipUpsideDown = false) {
  const geometry = new THREE.TetrahedronGeometry(TETRA_RADIUS, 0);
  // Start with glass (default mode)
  const material = createGlassMaterial(color);
  const mesh = new THREE.Mesh(geometry, material);

  if (flipUpsideDown) {
    mesh.rotation.x = Math.PI;
  }

  // Store edges for wireframe mode
  const edgesGeometry = new THREE.EdgesGeometry(geometry);
  const edgesMaterial = createWireframeMaterial(color);
  const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
  edges.visible = false;
  mesh.add(edges);

  // Attach references for mode switching
  mesh.userData.baseColor = color;
  mesh.userData.edges = edges;

  return mesh;
}

export function setRenderMode(mesh, mode, color, transparency) {
  const edges = mesh.userData.edges;

  // Dispose old material
  if (mesh.material) mesh.material.dispose();

  switch (mode) {
    case 'Solid':
      mesh.material = createSolidMaterial(color);
      mesh.material.transparent = transparency > 0;
      mesh.material.opacity = 1.0 - transparency;
      mesh.visible = true;
      edges.visible = false;
      break;

    case 'Wireframe':
      // Hide mesh faces, show edges only
      mesh.material = new THREE.MeshBasicMaterial({ visible: false });
      edges.material.dispose();
      edges.material = createWireframeMaterial(color, 1.0 - transparency);
      mesh.visible = true;
      edges.visible = true;
      break;

    case 'Glass':
      mesh.material = createGlassMaterial(color, 1.0 - transparency);
      mesh.visible = true;
      edges.visible = false;
      break;
  }
}
