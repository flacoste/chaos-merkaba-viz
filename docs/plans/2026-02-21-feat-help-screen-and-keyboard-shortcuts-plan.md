---
title: "feat: Add help screen overlay and keyboard shortcuts"
type: feat
status: completed
date: 2026-02-21
origin: docs/brainstorms/2026-02-21-help-screen-and-keyboard-shortcuts-brainstorm.md
---

# Help Screen Overlay & Keyboard Shortcuts

## Overview

Add a frosted-glass help overlay that displays on every page load and keyboard shortcuts (`Space`, `F`, `Escape`, `?`). This is the final feature for v1.0.

## Problem Statement / Motivation

The visualization has no onboarding. New visitors see shapes moving with no context about what they're seeing or how to interact. Mouse controls (click-to-pause, double-click reset, drag-to-roll) are entirely undiscoverable. Adding a help screen provides context and documents all controls in one place.

## Proposed Solution

Create a new `src/help.js` module that builds a DOM overlay with the help content, and add a `keydown` listener in `main.js` for keyboard shortcuts. The overlay shows on every page load (no localStorage), pausing the animation. Any interaction dismisses it and starts the animation.

(See brainstorm: `docs/brainstorms/2026-02-21-help-screen-and-keyboard-shortcuts-brainstorm.md`)

## Technical Approach

### New file: `src/help.js`

Exports `createHelpOverlay()` which:
1. Injects a `<style>` tag into `<head>` with all overlay styles
2. Creates a full-viewport `<div id="help-overlay">` appended to `document.body`
3. Returns `{ show(), hide(), toggle(), isVisible() }`

**DOM structure:**
```html
<div id="help-overlay">
  <div class="help-content">
    <h1>Chaos Merkaba Viz</h1>
    <div class="help-shapes">
      <figure><svg><!-- merkaba wireframe --></svg><figcaption>Merkaba</figcaption></figure>
      <figure><svg><!-- stella wireframe --></svg><figcaption>Stella Octangula</figcaption></figure>
      <figure><svg><!-- chaosphere wireframe --></svg><figcaption>Chaosphere</figcaption></figure>
    </div>
    <p class="help-description">...</p>
    <div class="help-controls">
      <div class="help-mouse"><!-- mouse controls --></div>
      <div class="help-keyboard"><!-- keyboard shortcuts --></div>
    </div>
    <p class="help-dismiss">Click anywhere or press any key to start</p>
  </div>
</div>
```

**Styling:**
- Full viewport: `position: fixed; inset: 0; z-index: 1000`
- Frosted glass: `backdrop-filter: blur(12px); background: rgba(0,0,0,0.7)`
- Content centered with flexbox, max-width constrained to fit one screen
- CSS opacity transition (~200ms) for fade-in/fade-out
- `pointer-events: auto` on the overlay to block all canvas interaction
- z-index above lil-gui (lil-gui uses inline styles, typically z-index ~999)

**SVG wireframes** (inline template literals):
- **Merkaba**: Two overlapping equilateral triangles (up/down) with aligned vertices — Star of David with aligned rear vertices
- **Stella Octangula**: Two overlapping equilateral triangles with anti-aligned vertices — classic Star of David
- **Chaosphere**: Central circle with 8 radiating arrow lines

**Controls layout** — two columns (mouse | keyboard) with icon-label pairs:
- Mouse: Unicode glyphs (e.g., click symbol, scroll, drag arrows)
- Keyboard: styled `<kbd>` elements for key caps

### Changes to `src/main.js`

**1. Import and initialize help overlay:**
```js
import { createHelpOverlay } from './help.js';
// After GUI creation (~line 582):
const help = createHelpOverlay();
```

**2. First-load sequence** (after `animate()` call at line 721):
```js
animate();
// Pause after first frame renders, show help
params.paused = true;
gui.domElement.style.display = 'none';
help.show();
```

The rAF loop continues running (matching existing pause behavior). OrbitControls and camera damping still update each frame, but the overlay blocks pointer events from reaching the canvas, so the camera stays frozen.

**3. Centralized dismiss/show helpers** in `main.js`:

```js
function dismissHelp() {
  help.hide();
  params.paused = false;
  gui.domElement.style.display = '';
  if (pauseToggleTimeout) {
    clearTimeout(pauseToggleTimeout);
    pauseToggleTimeout = null;
  }
}

function showHelp() {
  params.paused = true;
  gui.domElement.style.display = 'none';
  help.show();
  if (pauseToggleTimeout) {
    clearTimeout(pauseToggleTimeout);
    pauseToggleTimeout = null;
  }
}
```

Both the keydown handler and the overlay click-to-dismiss call these same functions — no duplication.

**4. Keyboard handler** (new `document.addEventListener('keydown', ...)`):

```js
document.addEventListener('keydown', (e) => {
  // Ignore key repeats (held keys)
  if (e.repeat) return;

  // Ignore when typing in GUI inputs
  if (gui.domElement.contains(document.activeElement)) return;

  // Ignore shortcuts with modifier keys (allow Ctrl+F browser find, etc.)
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Modal gate: if help is visible, ANY key dismisses it
  if (help.isVisible()) {
    dismissHelp();
    return;
  }

  switch (e.key) {
    case ' ':
      e.preventDefault(); // Prevent page scroll
      params.paused = !params.paused;
      break;

    case 'f':
    case 'F':
      fullscreenFn();
      break;

    case '?':
      if (document.fullscreenElement) {
        document.exitFullscreen().then(() => showHelp());
      } else {
        showHelp();
      }
      break;
  }
});
```

**5. Overlay click-to-dismiss** — `createHelpOverlay()` accepts an `onDismiss` callback. The overlay div gets a click listener that calls it:

```js
const help = createHelpOverlay({ onDismiss: dismissHelp });
```

**6. Debounce for `?` spam:** Add a 300ms cooldown in `showHelp()` / `dismissHelp()` — track `lastHelpToggle = Date.now()` and ignore if within cooldown.

### Edge Cases Addressed

| Edge Case | Resolution |
|-----------|------------|
| Space while help visible | "Any key" dismisses — Space is consumed by dismiss, no separate pause toggle |
| F while help visible | Dismissed by "any key" gate, does not enter fullscreen |
| `?` rapid spam | 300ms cooldown after last state change |
| Click-to-pause timeout racing with `?` | Cancel `pauseToggleTimeout` when showing/dismissing help |
| Typing in lil-gui input | Guard: `gui.domElement.contains(document.activeElement)` |
| Escape in lil-gui input | Guard fires first → shortcut ignored → browser default blurs input |
| Escape while not in fullscreen, no help | No-op (help not visible, no fullscreen to exit) |
| Key held down | `e.repeat` guard ignores held keys |
| Modifier keys (Ctrl+F, Cmd+R) | Guard: `e.ctrlKey || e.metaKey || e.altKey` |
| Pointer drag in progress when help opens | `pointerStart` not reset, but overlay blocks `pointerup` on canvas — timeout would fire but help dismiss cancels it |
| Fullscreen + `?` | `await document.exitFullscreen()` then show help |
| Camera state during help | OrbitControls run but overlay blocks pointer events — camera frozen |

### What NOT to Change

- Fullscreen target stays as `renderer.domElement` (canvas) — no architectural change
- Click-to-pause logic unchanged — the overlay simply blocks events from reaching the canvas
- Animation loop structure unchanged — `params.paused` gates physics, rAF always runs

## Acceptance Criteria

- [x] Help overlay displays on every page load with frosted glass effect over the frozen first frame
- [x] Overlay contains title "Chaos Merkaba Viz", three SVG wireframes, phase description, mouse controls, and keyboard shortcuts
- [x] Click anywhere or press any key dismisses help and starts animation
- [x] `Space` toggles pause/start (same as click-to-pause)
- [x] `F` toggles fullscreen (enter/exit, same as GUI button)
- [x] `?` toggles help screen (pauses animation, hides GUI)
- [x] `?` while fullscreen exits fullscreen first, then shows help
- [x] Dismiss always unpauses regardless of prior pause state
- [x] Keyboard shortcuts are ignored while typing in lil-gui inputs
- [x] Keyboard shortcuts ignore modifier keys (Ctrl, Cmd, Alt)
- [x] Held keys (`e.repeat`) are ignored
- [x] Overlay fits on one screen without scrolling
- [x] lil-gui panel hidden while help is visible
- [x] 300ms debounce prevents `?` spam flicker
- [x] No regressions to existing click-to-pause, double-click reset, or orbit controls

## Dependencies & Risks

**Dependencies:** None — pure DOM/CSS addition with no new libraries.

**Risks:**
- `backdrop-filter: blur()` has broad support but is not available in older browsers. Fallback: solid dark background with slightly higher opacity. Acceptable degradation.
- SVG wireframe quality — the shapes need to look good at small sizes. May require iteration.
- "Fits on one screen" constraint may be tight on smaller viewports. Test at 1024x768 minimum.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-02-21-help-screen-and-keyboard-shortcuts-brainstorm.md](../brainstorms/2026-02-21-help-screen-and-keyboard-shortcuts-brainstorm.md) — Key decisions: frosted glass overlay, SVG wireframes, every-page-load, dismiss-always-unpauses, canvas stays fullscreen target
- Animation loop: `src/main.js:587-721`
- Click-to-pause handler: `src/main.js:493-515`
- Fullscreen handler: `src/main.js:564-579`
- GUI creation: `src/controls.js:13` (`createControlPanel()`)
- Lock targets (Merkaba vs Stella): `src/main.js:73-74`
- Chaos sphere structure: `src/chaos-sphere.js`
- Tetrahedron geometry: `src/tetrahedron.js`
