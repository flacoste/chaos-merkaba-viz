# Tetraviz Design Document

## Purpose

A meditative, artistic 3D visualization of two regular tetrahedra that approach each other, fuse into a star tetrahedron (stella octangula), and rotate. Built for contemplative geometric exploration.

## Stack

- **Three.js** — 3D rendering
- **lil-gui** — Control panel with sliders, dropdowns, color pickers
- **Vite** — Bundler, produces a self-contained static build (no server needed)
- **Vanilla JS** — No framework

## Project Structure

```
tetraviz/
├── index.html
├── src/
│   ├── main.js           # App bootstrap, scene setup, animation loop
│   ├── tetrahedron.js    # Tetrahedron geometry & material management
│   ├── controls.js       # lil-gui panel setup, all slider/toggle bindings
│   ├── materials.js      # Material definitions (solid, wireframe, glass)
│   └── fullscreen.js     # Fullscreen toggle logic
├── package.json
└── vite.config.js
```

## Scene & Geometry

- Two regular tetrahedra created with `THREE.TetrahedronGeometry`
- **Bottom tetrahedron (A):** Points up, colored red, rotates counterclockwise
- **Top tetrahedron (B):** Points down (rotated 180° on X-axis), colored white, rotates clockwise
- Both share the same center point; separation is along the Y-axis
- PerspectiveCamera with OrbitControls for camera manipulation
- Background: pure black (`0x000000`)
- Lighting: ambient light + directional light(s) for solid/glass modes

## Motion

- Tetrahedra start separated at 80% of max distance
- They approach each other along the Y-axis at a configurable speed
- When separation reaches 0, movement stops — they hold as the fused star tetrahedron
- Rotation continues throughout (before, during, and after fusion)
- Reset button snaps back to initial separation and restarts approach; rotation is uninterrupted

## Rotation

- Axis: locked to Y-axis (through vertex to center)
- Top tetrahedron: clockwise
- Bottom tetrahedron: counterclockwise
- Speed: configurable via slider
- Auto-rotate toggle to pause/resume

## Rendering Modes

Three switchable modes via dropdown:

### Solid
- `MeshStandardMaterial` with `flatShading: true`
- Responds to scene lighting
- Configurable color per tetrahedron

### Wireframe
- `EdgesGeometry` + `LineBasicMaterial` for clean edge rendering
- Ignores lighting — pure color on black
- Transparency maps to line opacity

### Glass
- `MeshPhysicalMaterial` with `transmission`, `thickness`, `roughness`, `ior`
- Semi-transparent with refraction effects
- `transparent: true`, opacity controlled by transparency slider
- Default render mode

## Control Panel (lil-gui, right side)

### Transform Folder
| Control | Type | Default | Description |
|---------|------|---------|-------------|
| Scale | Slider | 1.0 | Uniform scale of both tetrahedra |
| Initial separation | Slider | 80% of max | Starting distance apart |
| Approach speed | Slider | slow | How fast they move toward each other |

### Rotation Folder
| Control | Type | Default | Description |
|---------|------|---------|-------------|
| Auto-rotate | Checkbox | On | Enable/disable continuous rotation |
| Rotation speed | Slider | slow | Angular velocity |

### Appearance Folder
| Control | Type | Default | Description |
|---------|------|---------|-------------|
| Render mode | Dropdown | Glass | Solid / Wireframe / Glass |
| Color A (bottom, up) | Color picker | Red | Bottom tetrahedron color |
| Color B (top, down) | Color picker | White | Top tetrahedron color |
| Transparency | Slider | tuned | Opacity (0 = opaque, 1 = fully transparent) |

### Actions
| Control | Type | Description |
|---------|------|-------------|
| Reset | Button | Return to initial separation, restart approach |
| Fullscreen | Button | Enter fullscreen mode |

## Fullscreen Mode

- Triggers `canvas.requestFullscreen()`
- Panel hides in fullscreen
- Escape exits fullscreen, panel reappears
- Animation continues with current parameter settings

## Animation Loop

Each frame (`requestAnimationFrame`):
1. Compute `deltaTime`
2. If not yet fused: translate each tetrahedron along Y toward center by `approachSpeed * deltaTime`, clamp at 0
3. Rotate each mesh around Y: top clockwise, bottom counterclockwise, at `rotationSpeed * deltaTime`
4. Render scene

All parameters read from a live params object bound to lil-gui — slider changes take effect immediately.

## Build & Deployment

- `npm run dev` — local dev server with hot reload
- `npm run build` — produces static files in `dist/`
- `dist/` can be deployed anywhere (GitHub Pages, Netlify, or just opened locally)
