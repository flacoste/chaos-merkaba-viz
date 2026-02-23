# Chaos Merkaba Viz

A WebGL visualization of two tetrahedra that approach, fuse, and transform through several sacred geometry phases into a chaos sphere emitting particles.

Built with [Three.js](https://threejs.org/) and [Vite](https://vite.dev/).

## Phases

1. **Approach** — Two tetrahedra (red and white) drift toward each other
2. **Fusion** — The tetrahedra interlock, seeking alignment into a **Stella Octangula** or **Merkaba**
3. **Morph** — The locked shape morphs into an 8-rayed chaos sphere
4. **Emission** — Colored particles stream from each ray tip

## Features

- Glass, solid, and wireframe render modes
- Per-vertex coloring for each tetrahedron
- Configurable rotation speed, direction, and speed ramp
- Preset system with save/load/delete (persisted in localStorage)
- Fullscreen support
- Help overlay with keyboard shortcuts

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Controls

### Mouse

| Input | Action |
|-------|--------|
| Click | Pause / Resume |
| Double-click | Reset camera |
| Scroll | Zoom |
| Drag vertically | Orbit |
| Drag horizontally | Roll |
| Right-drag | Pan |

### Keyboard

| Key | Action |
|-----|--------|
| Space | Pause / Resume |
| F | Toggle fullscreen |
| Esc | Exit fullscreen |
| ? | Toggle help |

## Build

```bash
npm run build
```

Static files are output to `dist/`. Serve them with any static file server.

## License

MIT
