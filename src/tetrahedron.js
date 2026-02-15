import * as THREE from 'three';
import { createSolidMaterial, createGlassMaterial } from './materials.js';

const TETRA_RADIUS = 1;

/**
 * Compute the 4 original vertex positions of the tetrahedron.
 * Returns [apex, base1, base2, base3] where apex is the highest-Y vertex
 * (or lowest-Y if flipped) and base vertices are sorted by atan2(z, x).
 */
function computeOriginalVertices(flipUpsideDown) {
  const refGeo = new THREE.TetrahedronGeometry(TETRA_RADIUS, 0);
  const alignQuat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 1, 1).normalize(),
    new THREE.Vector3(0, 1, 0)
  );
  refGeo.applyQuaternion(alignQuat);
  if (flipUpsideDown) refGeo.rotateX(Math.PI);

  // Extract unique vertices from the non-indexed geometry
  const pos = refGeo.attributes.position;
  const verts = [];
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (!verts.some(e => e.distanceTo(v) < 0.001)) {
      verts.push(v);
    }
  }
  refGeo.dispose();

  // Sort: apex first (highest Y for upright, lowest Y for flipped)
  verts.sort((a, b) => flipUpsideDown ? a.y - b.y : b.y - a.y);
  const apex = verts[0];
  const base = verts.slice(1);
  // Sort base vertices by angle for consistent ordering
  base.sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  return [apex, ...base];
}

/**
 * Build the vertex color attribute for a subdivided tetrahedron geometry.
 *
 * For each face (3 consecutive vertices in the non-indexed geometry):
 * - Corner triangle (has a vertex at an original position): all 3 verts get that vertex's color
 * - Center triangle (all midpoints): each vert gets the average of its 2 nearest original vertex colors
 */
export function buildVertexColors(geometry, originalVerts, colors) {
  const posAttr = geometry.attributes.position;
  const count = posAttr.count;
  const colorArr = new Float32Array(count * 3);
  const EPSILON = 0.01;

  for (let face = 0; face < count; face += 3) {
    const vInfos = [];
    for (let i = 0; i < 3; i++) {
      const vi = face + i;
      const pos = new THREE.Vector3(
        posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi)
      );
      const dists = originalVerts.map((ov, idx) => ({
        idx, dist: pos.distanceTo(ov)
      }));
      dists.sort((a, b) => a.dist - b.dist);
      vInfos.push({
        vi,
        isOriginal: dists[0].dist < EPSILON,
        nearest: dists[0].idx,
        secondNearest: dists[1].idx,
      });
    }

    if (vInfos.some(v => v.isOriginal)) {
      // Corner triangle — all vertices get the corner vertex's color
      const cornerIdx = vInfos.find(v => v.isOriginal).nearest;
      const c = colors[cornerIdx];
      for (let i = 0; i < 3; i++) {
        const vi = face + i;
        colorArr[vi * 3] = c.r;
        colorArr[vi * 3 + 1] = c.g;
        colorArr[vi * 3 + 2] = c.b;
      }
    } else {
      // Center triangle — each midpoint blends its 2 nearest original vertex colors
      for (let i = 0; i < 3; i++) {
        const vi = face + i;
        const info = vInfos[i];
        const c1 = colors[info.nearest];
        const c2 = colors[info.secondNearest];
        colorArr[vi * 3] = (c1.r + c2.r) / 2;
        colorArr[vi * 3 + 1] = (c1.g + c2.g) / 2;
        colorArr[vi * 3 + 2] = (c1.b + c2.b) / 2;
      }
    }
  }

  if (geometry.attributes.color) {
    geometry.attributes.color.array.set(colorArr);
    geometry.attributes.color.needsUpdate = true;
  } else {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorArr, 3));
  }
}

export function createTetrahedron(color, flipUpsideDown = false) {
  const geometry = new THREE.TetrahedronGeometry(TETRA_RADIUS, 1);

  const defaultVertex = new THREE.Vector3(1, 1, 1).normalize();
  const targetUp = new THREE.Vector3(0, 1, 0);
  const alignQuat = new THREE.Quaternion().setFromUnitVectors(defaultVertex, targetUp);
  geometry.applyQuaternion(alignQuat);

  if (flipUpsideDown) {
    geometry.rotateX(Math.PI);
  }

  const originalVerts = computeOriginalVertices(flipUpsideDown);

  // Build initial vertex colors (uniform main color)
  const c = new THREE.Color(color);
  buildVertexColors(geometry, originalVerts, [c, c, c, c]);

  const material = createGlassMaterial();
  const mesh = new THREE.Mesh(geometry, material);

  mesh.userData.baseColor = color;
  mesh.userData.originalVerts = originalVerts;

  return mesh;
}

/**
 * Update vertex colors on a mesh based on the current color settings.
 */
export function updateMeshColors(mesh, mainColor, perVertex, vertexColorsObj) {
  const originalVerts = mesh.userData.originalVerts;
  let colors;
  if (perVertex) {
    colors = Object.values(vertexColorsObj).map(hex => new THREE.Color(hex));
  } else {
    const c = new THREE.Color(mainColor);
    colors = [c, c, c, c];
  }
  buildVertexColors(mesh.geometry, originalVerts, colors);
}

export function setRenderMode(mesh, mode, transparency, glassParams = {}) {
  if (mesh.material) mesh.material.dispose();

  const opacity = 1.0 - transparency;
  switch (mode) {
    case 'Solid':
      mesh.material = createSolidMaterial(opacity);
      mesh.visible = true;
      break;
    case 'Glass':
      mesh.material = createGlassMaterial(opacity, glassParams);
      mesh.visible = true;
      break;
  }
}
