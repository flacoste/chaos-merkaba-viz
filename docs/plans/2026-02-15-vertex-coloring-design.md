# Per-Vertex Coloring Design

## Overview

Replace single-color-per-tetrahedron with per-vertex coloring. Each tetrahedron has 4 vertices, so 8 colors total. Each triangular face is subdivided into 4 sub-triangles: 3 corner triangles (solid vertex color) and 1 center triangle (smooth gradient blending the 3 vertex colors).

## Geometry

- Switch from `TetrahedronGeometry(radius, 0)` (4 faces) to `TetrahedronGeometry(radius, 1)` (16 faces)
- Each original face subdivides into 4 triangles:
  - 3 corner triangles: all 3 vertices get the nearest original vertex's color
  - 1 center triangle: each midpoint vertex gets the average of its 2 adjacent original vertex colors, producing a smooth 3-way gradient via GPU interpolation
- `flatShading: true` is kept (affects normals/lighting only, not vertex color interpolation)
- Color data stored as a `color` BufferAttribute on the geometry

## Materials

- **Wireframe mode removed** entirely
- **Solid**: `MeshStandardMaterial` with `vertexColors: true`, `flatShading: true`, base color white
- **Glass**: `MeshPhysicalMaterial` with `vertexColors: true`, `flatShading: true`, base color white, plus existing glass params
- Material base color set to white (0xffffff) so vertex colors display unmodified (Three.js multiplies material color by vertex color)

## Color State

Per-tetrahedron params:

```js
// Pointing Up
colorA: '#ff0000',           // main color
perVertexA: false,           // toggle: false = main color, true = vertex colors
vertexColorsA: ['#CCFF00', '#FF6600', '#4169E1', '#CC0000'],  // [Top, FrontLeft, FrontRight, Back]

// Pointing Down
colorB: '#ffffff',           // main color
perVertexB: false,           // toggle
vertexColorsB: ['#FFD700', '#800080', '#1C1C2E', '#228B22'],  // [Bottom, FrontRight, FrontLeft, Back]
```

Toggle OFF (default): all vertices use the main color.
Toggle ON: each vertex uses its individual color. Changing main color never overwrites vertex color values.

## GUI Layout

```
Tetraviz
├── Transform (Scale, Approach Speed)
├── Rotation (Auto-Rotate, Speed)
├── Pointing Up
│   ├── Direction (Clockwise/Counterclockwise)
│   ├── Main Color
│   ├── Per-Vertex Colors (boolean toggle)
│   └── Vertex Colors (subfolder, always visible)
│       ├── Top
│       ├── Front Left
│       ├── Front Right
│       └── Back
├── Pointing Down
│   ├── Direction
│   ├── Main Color
│   ├── Per-Vertex Colors (boolean toggle)
│   └── Vertex Colors (subfolder, always visible)
│       ├── Bottom
│       ├── Front Right
│       ├── Front Left
│       └── Back
├── Appearance (Render Mode [Solid/Glass], Transparency)
├── Glass (Transmission, Thickness, Roughness, IOR)
├── Reset
└── Fullscreen
```

## Color Update Flow

1. Any color/toggle change triggers `applyColors()`
2. Checks `perVertexX` toggle per tetrahedron
3. If off: build color attribute with all vertices = main color
4. If on: build color attribute using the 4 vertex colors (corners solid, center midpoints averaged)
5. Set `geometry.attributes.color.needsUpdate = true`

## Files Changed

| File | Changes |
|------|---------|
| `tetrahedron.js` | Use detail=1 geometry, add `buildVertexColors()`, remove wireframe/edges code |
| `materials.js` | Add `vertexColors: true` to Solid and Glass, set base color to white, remove `createWireframeMaterial` |
| `controls.js` | Restructure GUI with per-tetra folders, add vertex color pickers and toggle, remove Wireframe option |
| `main.js` | Add vertex color params, wire up color update pipeline, remove wireframe-related code |
