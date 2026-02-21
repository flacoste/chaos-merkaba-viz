import * as THREE from 'three';
import { createStreakMaterial } from './materials.js';

const MAX_PARTICLES = 4096;
const DESPAWN_DISTANCE = 20;

// --- Cone sampling utilities ---

// Duff et al. (2017) branchless orthonormal basis construction
function createEmissionBasis(nx, ny, nz) {
  const sign = nz >= 0 ? 1.0 : -1.0;
  const a = -1.0 / (sign + nz);
  const b = nx * ny * a;
  return {
    nx, ny, nz,
    t1x: 1.0 + sign * nx * nx * a, t1y: sign * b, t1z: -sign * nx,
    t2x: b, t2y: sign + ny * ny * a, t2z: -ny,
  };
}

// Update an existing basis object in-place (zero-allocation hot path)
function updateEmissionBasis(basis, nx, ny, nz) {
  const sign = nz >= 0 ? 1.0 : -1.0;
  const a = -1.0 / (sign + nz);
  const b = nx * ny * a;
  basis.nx = nx; basis.ny = ny; basis.nz = nz;
  basis.t1x = 1.0 + sign * nx * nx * a; basis.t1y = sign * b; basis.t1z = -sign * nx;
  basis.t2x = b; basis.t2y = sign + ny * ny * a; basis.t2z = -ny;
}

// Write a cone-sampled direction into a Float32Array at the given offset.
// Zero-allocation hot path.
function sampleConeDirectionInto(out, offset, basis, cosThetaMax) {
  const xi1 = Math.random();
  const xi2 = Math.random();
  const cosTheta = 1.0 - xi1 * (1.0 - cosThetaMax);
  const sinTheta = Math.sqrt(1.0 - cosTheta * cosTheta);
  const phi = 2.0 * Math.PI * xi2;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Local cone direction in the basis frame
  const lx = sinTheta * cosPhi;
  const ly = sinTheta * sinPhi;
  const lz = cosTheta;

  // Transform to world space using the orthonormal basis
  out[offset]     = lx * basis.t1x + ly * basis.t2x + lz * basis.nx;
  out[offset + 1] = lx * basis.t1y + ly * basis.t2y + lz * basis.ny;
  out[offset + 2] = lx * basis.t1z + ly * basis.t2z + lz * basis.nz;
}

// --- Particle system ---

export function createParticleSystem() {
  // Base geometry: unit quad
  const baseGeo = new THREE.PlaneGeometry(1.0, 1.0, 1, 1);

  // Instanced geometry sharing the quad's attributes
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = baseGeo.index;
  geometry.setAttribute('position', baseGeo.getAttribute('position'));
  geometry.setAttribute('uv', baseGeo.getAttribute('uv'));

  // Pre-allocate typed arrays
  const offsets = new Float32Array(MAX_PARTICLES * 3);
  const velocities = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 4);
  const ages = new Float32Array(MAX_PARTICLES);

  // Create instanced attributes
  const offsetAttr = new THREE.InstancedBufferAttribute(offsets, 3);
  offsetAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aOffset', offsetAttr);

  const velocityAttr = new THREE.InstancedBufferAttribute(velocities, 3);
  velocityAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aVelocity', velocityAttr);

  const colorAttr = new THREE.InstancedBufferAttribute(colors, 4);
  colorAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aColor', colorAttr);

  const ageAttr = new THREE.InstancedBufferAttribute(ages, 1);
  ageAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aAge', ageAttr);

  let aliveCount = 0;
  geometry.instanceCount = 0;

  // Material
  const material = createStreakMaterial();

  // Mesh
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  // Emission state
  let emissionPoints = []; // { px, py, pz, nx, ny, nz, r, g, b }
  let emissionPointCount = 0;
  // Pre-allocate 8 basis objects (max emission points = 8 vertices)
  const emissionBases = Array.from({ length: 8 }, () => ({
    nx: 0, ny: 0, nz: 0, t1x: 0, t1y: 0, t1z: 0, t2x: 0, t2y: 0, t2z: 0,
  }));
  let cosThetaMax = Math.cos(15 * Math.PI / 180);
  let emitterIndex = 0;    // round-robin counter
  let recycleIndex = 0;    // ring-buffer index for pool-full recycling

  function setEmissionPoints(points, count) {
    emissionPoints = points;
    emissionPointCount = count;
    for (let i = 0; i < count; i++) {
      updateEmissionBasis(emissionBases[i], points[i].nx, points[i].ny, points[i].nz);
    }
  }

  let lastAngleDeg = -1;
  function setConeAngle(angleDeg) {
    if (angleDeg === lastAngleDeg) return;
    lastAngleDeg = angleDeg;
    cosThetaMax = Math.cos(angleDeg * Math.PI / 180);
  }

  // Temp buffer for cone sampling (reused across calls)
  const _tempDir = new Float32Array(3);

  // Spawn particles
  function emit(count, particleSpeed) {
    if (emissionPointCount === 0) return;

    for (let i = 0; i < count; i++) {
      // Pick emitter round-robin
      const ep = emissionPoints[emitterIndex % emissionPointCount];
      const basis = emissionBases[emitterIndex % emissionPointCount];
      emitterIndex++;

      // Find slot: use next free slot, or overwrite in ring-buffer order when full
      let slot;
      if (aliveCount < MAX_PARTICLES) {
        slot = aliveCount;
        aliveCount++;
      } else {
        slot = recycleIndex;
        recycleIndex = (recycleIndex + 1) % MAX_PARTICLES;
      }

      const s3 = slot * 3;
      const s4 = slot * 4;

      // Position: emission point, offset outward along normal to clear surface
      const SPAWN_OFFSET = 0.12;
      offsets[s3] = ep.px + ep.nx * SPAWN_OFFSET;
      offsets[s3 + 1] = ep.py + ep.ny * SPAWN_OFFSET;
      offsets[s3 + 2] = ep.pz + ep.nz * SPAWN_OFFSET;

      // Velocity: cone-sampled direction * speed
      sampleConeDirectionInto(_tempDir, 0, basis, cosThetaMax);
      velocities[s3] = _tempDir[0] * particleSpeed;
      velocities[s3 + 1] = _tempDir[1] * particleSpeed;
      velocities[s3 + 2] = _tempDir[2] * particleSpeed;

      // Color: from emission point
      colors[s4] = ep.r;
      colors[s4 + 1] = ep.g;
      colors[s4 + 2] = ep.b;
      colors[s4 + 3] = 1.0;

      // Age
      ages[slot] = 0;
    }
  }

  // Update all alive particles
  function update(dt) {
    let i = 0;
    while (i < aliveCount) {
      const i3 = i * 3;

      // Advance position
      offsets[i3] += velocities[i3] * dt;
      offsets[i3 + 1] += velocities[i3 + 1] * dt;
      offsets[i3 + 2] += velocities[i3 + 2] * dt;

      // Advance age
      ages[i] += dt;

      // Check despawn distance
      const x = offsets[i3], y = offsets[i3 + 1], z = offsets[i3 + 2];
      const distSq = x * x + y * y + z * z;

      if (distSq > DESPAWN_DISTANCE * DESPAWN_DISTANCE) {
        // Swap-compact: move last alive particle into this slot
        killParticle(i);
        // Don't increment i — re-check the swapped particle
      } else {
        i++;
      }
    }

    // Update GPU buffers
    geometry.instanceCount = aliveCount;
    offsetAttr.needsUpdate = true;
    velocityAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  function killParticle(i) {
    const last = aliveCount - 1;
    if (i !== last) {
      // Swap all attribute data
      const i3 = i * 3, l3 = last * 3;
      const i4 = i * 4, l4 = last * 4;

      offsets[i3] = offsets[l3];
      offsets[i3 + 1] = offsets[l3 + 1];
      offsets[i3 + 2] = offsets[l3 + 2];

      velocities[i3] = velocities[l3];
      velocities[i3 + 1] = velocities[l3 + 1];
      velocities[i3 + 2] = velocities[l3 + 2];

      colors[i4] = colors[l4];
      colors[i4 + 1] = colors[l4 + 1];
      colors[i4 + 2] = colors[l4 + 2];
      colors[i4 + 3] = colors[l4 + 3];

      ages[i] = ages[last];
    }
    aliveCount--;
  }

  function resetParticles() {
    aliveCount = 0;
    geometry.instanceCount = 0;
    emitterIndex = 0;
    recycleIndex = 0;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    baseGeo.dispose();
  }

  return {
    mesh,
    update,
    emit,
    dispose,
    setEmissionPoints,
    setConeAngle,
    resetParticles,
    getAliveCount: () => aliveCount,
  };
}
