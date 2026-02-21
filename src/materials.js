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

export function createStreakMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: `
      attribute vec3 aOffset;
      attribute vec3 aVelocity;
      attribute vec4 aColor;

      varying vec2 vUv;
      varying vec4 vColor;

      const float STREAK_LENGTH = 0.15;
      const float STREAK_WIDTH = 0.02;

      void main() {
        vUv = uv;
        vColor = aColor;

        vec3 worldPos = aOffset;
        vec3 vel = aVelocity;
        float speed = sqrt(dot(vel, vel));
        vec3 forward = speed > 0.001 ? vel / speed : vec3(0.0, 1.0, 0.0);
        vec3 toCamera = normalize(cameraPosition - worldPos);
        vec3 right = normalize(cross(forward, toCamera));

        float len = speed * STREAK_LENGTH;
        float wid = STREAK_WIDTH;

        // Offset so head (uv.x=1) is at worldPos, trail extends behind
        vec3 displaced = worldPos
          + forward * (position.x - 0.5) * len
          + right   * position.y * wid;

        gl_Position = projectionMatrix * viewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec4 vColor;

      void main() {
        float crossFade = 1.0 - pow(abs(vUv.y - 0.5) * 2.0, 2.0);
        float taper = smoothstep(0.0, 0.4, vUv.x);
        float headGlow = smoothstep(0.8, 1.0, vUv.x) * 0.6;
        float alpha = crossFade * taper * vColor.a;
        gl_FragColor = vec4(vColor.rgb * (1.0 + headGlow), alpha);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    transparent: true,
    side: THREE.DoubleSide,
  });
}
