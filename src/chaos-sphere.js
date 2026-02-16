import * as THREE from 'three';
import { createSolidMaterial, createGlassMaterial } from './materials.js';
import { TETRA_RADIUS } from './tetrahedron.js';

/**
 * Paint vertex colors on a geometry with a single uniform color.
 */
function paintUniformColor(geometry, color) {
  const count = geometry.attributes.position.count;
  const existing = geometry.attributes.color;
  const colors = existing ? existing.array : new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  if (existing) {
    existing.needsUpdate = true;
  } else {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
}

/**
 * Paint vertex colors on a sphere geometry with a psychedelic round-robin
 * mix of all provided colors. GPU interpolation blends adjacent vertices.
 */
function paintSphereColors(geometry, allColors) {
  const count = geometry.attributes.position.count;
  const existing = geometry.attributes.color;
  const colors = existing ? existing.array : new Float32Array(count * 3);
  const n = allColors.length;
  for (let i = 0; i < count; i++) {
    const c = allColors[i % n];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  if (existing) {
    existing.needsUpdate = true;
  } else {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
}

/**
 * Compute the 8 ray directions for the chaos sphere.
 *
 * Tetra A's vertices are used as-is (normalized). Tetra B's vertices are
 * rotated by -lockTarget around Y (to match the lock alignment in tetra A's
 * reference frame), then normalized.
 *
 * @param {THREE.Vector3[]} vertsA - 4 original vertices of tetra A
 * @param {THREE.Vector3[]} vertsB - 4 original vertices of tetra B
 * @param {number} lockTarget - lock alignment target angle (radians)
 * @returns {THREE.Vector3[]} 8 unit vectors (4 from A, 4 from B)
 */
function computeRayDirections(vertsA, vertsB, lockTarget) {
  const rotMatrix = new THREE.Matrix4().makeRotationY(-lockTarget);
  const directions = [];

  for (let i = 0; i < 4; i++) {
    directions.push(vertsA[i].clone().normalize());
  }
  for (let i = 0; i < 4; i++) {
    directions.push(vertsB[i].clone().applyMatrix4(rotMatrix).normalize());
  }
  return directions;
}

/**
 * Build the chaos sphere group.
 *
 * @param {THREE.Vector3[]} vertsA - 4 original vertices of tetra A
 * @param {THREE.Vector3[]} vertsB - 4 original vertices of tetra B
 * @param {number} lockTarget - lock alignment target (radians)
 * @param {object} opts - { sphereRadius, rayRadius, coneRadius }
 * @param {THREE.Color[]} colorsA - 4 colors for tetra A vertices
 * @param {THREE.Color[]} colorsB - 4 colors for tetra B vertices
 * @returns {THREE.Group}
 */
export function buildChaosSphere(vertsA, vertsB, lockTarget, opts, colorsA, colorsB) {
  const { sphereRadius, rayRadius, coneRadius } = opts;
  const coneHeight = coneRadius * 1.5;
  const cylinderLength = TETRA_RADIUS - sphereRadius;
  const allColors = [...colorsA, ...colorsB];
  const rayDirections = computeRayDirections(vertsA, vertsB, lockTarget);

  const group = new THREE.Group();

  // Central sphere with psychedelic vertex colors
  const sphereGeo = new THREE.SphereGeometry(sphereRadius, 32, 16);
  paintSphereColors(sphereGeo, allColors);
  const sphereMat = createGlassMaterial();
  const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
  group.add(sphereMesh);

  // 8 rays (cylinder + cone each)
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const dir = rayDirections[i];
    const color = i < 4 ? colorsA[i] : colorsB[i - 4];

    // Cylinder: translate geometry so pivot (y=0) is at the base
    const cylGeo = new THREE.CylinderGeometry(rayRadius, rayRadius, cylinderLength, 8);
    cylGeo.translate(0, cylinderLength / 2, 0);
    paintUniformColor(cylGeo, color);
    const cylMat = createGlassMaterial();
    const cylMesh = new THREE.Mesh(cylGeo, cylMat);
    cylMesh.position.y = sphereRadius;

    // Cone: translate geometry so base is at y=0
    const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 8);
    coneGeo.translate(0, coneHeight / 2, 0);
    paintUniformColor(coneGeo, color);
    const coneMat = createGlassMaterial();
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.y = sphereRadius + cylinderLength;

    // Sub-group oriented along the ray direction
    const rayGroup = new THREE.Group();
    rayGroup.add(cylMesh);
    rayGroup.add(coneMesh);

    // Rotate from default +Y to the ray direction
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), dir
    );
    rayGroup.quaternion.copy(quat);

    group.add(rayGroup);
    rays.push({ cylMesh, coneMesh, cylinderLength, coneHeight });
  }

  // Store references for animation
  group.userData.sphereMesh = sphereMesh;
  group.userData.rays = rays;
  group.userData.sphereRadius = sphereRadius;

  group.visible = false;
  return group;
}

/**
 * Update morph progress on the chaos sphere.
 * progress=0: fully hidden. progress=1: fully visible.
 *
 * @param {THREE.Group} group - the chaos sphere group
 * @param {number} progress - morph progress 0-1
 */
export function setMorphProgress(group, progress) {
  if (progress <= 0) {
    group.visible = false;
    return;
  }
  group.visible = true;

  const { sphereMesh, rays, sphereRadius } = group.userData;

  // Sphere grows from nothing
  sphereMesh.scale.setScalar(progress);

  // Rays extend outward, cones ride the tips
  for (const ray of rays) {
    ray.cylMesh.scale.y = progress;
    ray.coneMesh.position.y = sphereRadius + ray.cylinderLength * progress;
    ray.coneMesh.scale.setScalar(progress);
  }
}

/**
 * Update vertex colors on the chaos sphere to match current tetra colors.
 *
 * @param {THREE.Group} group - the chaos sphere group
 * @param {THREE.Color[]} colorsA - 4 colors for tetra A
 * @param {THREE.Color[]} colorsB - 4 colors for tetra B
 */
export function updateChaosSphereColors(group, colorsA, colorsB) {
  const { sphereMesh, rays } = group.userData;
  const allColors = [...colorsA, ...colorsB];

  paintSphereColors(sphereMesh.geometry, allColors);

  for (let i = 0; i < 8; i++) {
    const color = i < 4 ? colorsA[i] : colorsB[i - 4];
    const ray = rays[i];
    paintUniformColor(ray.cylMesh.geometry, color);
    paintUniformColor(ray.coneMesh.geometry, color);
  }
}

/**
 * Apply render mode (solid/glass) to all chaos sphere meshes.
 *
 * @param {THREE.Group} group - the chaos sphere group
 * @param {string} mode - 'Solid' or 'Glass'
 * @param {number} transparency - 0-1
 * @param {object} glassParams - { transmission, thickness, roughness, ior }
 */
export function setChaosSphereRenderMode(group, mode, transparency, glassParams) {
  const opacity = 1.0 - transparency;
  group.traverse((child) => {
    if (child.isMesh) {
      if (child.material) child.material.dispose();
      if (mode === 'Solid') {
        child.material = createSolidMaterial(opacity);
      } else {
        child.material = createGlassMaterial(opacity, glassParams);
      }
    }
  });
}
