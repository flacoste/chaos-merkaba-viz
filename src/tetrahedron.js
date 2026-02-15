import * as THREE from 'three';
import { createSolidMaterial, createWireframeMaterial, createGlassMaterial } from './materials.js';

const TETRA_RADIUS = 1;

export function createTetrahedron(color, flipUpsideDown = false) {
  const geometry = new THREE.TetrahedronGeometry(TETRA_RADIUS, 0);

  // Align geometry so a vertex points along +Y and the opposite face center along -Y.
  // Default TetrahedronGeometry has vertices at cube corners (1,1,1)/sqrt(3) etc.
  // Rotate so (1,1,1)/sqrt(3) maps to (0,1,0).
  const defaultVertex = new THREE.Vector3(1, 1, 1).normalize();
  const targetUp = new THREE.Vector3(0, 1, 0);
  const alignQuat = new THREE.Quaternion().setFromUnitVectors(defaultVertex, targetUp);
  geometry.applyQuaternion(alignQuat);

  // Flip the geometry itself (not the mesh) so both meshes share the same
  // world-space Y-axis. This keeps Y-rotation direction consistent for both.
  if (flipUpsideDown) {
    geometry.rotateX(Math.PI);
  }

  const material = createGlassMaterial(color);
  const mesh = new THREE.Mesh(geometry, material);

  // Store edges for wireframe mode — must use aligned geometry
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
