# Help Screen & Keyboard Shortcuts

**Date:** 2026-02-21
**Status:** Brainstorm
**Goal:** Add a help/splash screen and keyboard shortcuts as the final v1.0 feature.

## What We're Building

A help overlay that displays on every page load, pausing the animation until dismissed. It serves as both an introduction to the visualization and a controls reference.

### Help Screen Content

1. **Title:** "Chaos Merkaba Viz"
2. **Three inline SVG wireframes** of the shapes: Merkaba, Stella Octangula, Chaosphere
3. **Brief description:** The visualization moves through several phases; parameters can be changed via the control panel
4. **Mouse controls** (Unicode/symbolic glyphs as labels):
   - Click: pause/start animation
   - Double-click: reset camera
   - Scroll: zoom in/out
   - Vertical drag: orbit up/down
   - Horizontal drag: camera roll
   - Right-drag / two-finger: pan
5. **Keyboard shortcuts** (key cap style labels):
   - `Space`: pause/start animation
   - `F`: enter fullscreen
   - `Escape`: exit fullscreen
   - `?`: toggle help screen

### Behavior

- **On page load:** Animation renders at least one frame (so the frosted glass has content to blur), then pauses. Help screen is shown.
- **Dismissal:** Click anywhere or press any key closes the help screen and always starts/resumes animation (regardless of prior pause state).
- **Re-opening:** Press `?` at any time to toggle the help screen back on (pauses animation). Dismissal always unpauses — no state restoration.
- **Fullscreen interaction:** Help screen only works outside fullscreen. If `?` is pressed while in fullscreen, exit fullscreen first, then show help.
- **Every visit:** No localStorage persistence. Shows on every page load.

### Visual Design

- **Frosted glass overlay:** `backdrop-filter: blur()` with dark tint over the frozen visualization
- Must fit on one screen (no scrolling)
- Typography should match the quality of the visualization itself
- Dark, atmospheric feel consistent with the black-background aesthetic

## Why This Approach

- **Single `src/help.js` module:** Follows existing module pattern (`controls.js`, `particles.js`). Exports `createHelpOverlay()` returning show/hide/toggle functions.
- **Template literal HTML + injected `<style>` tag:** Matches the project's no-framework, no-CSS-file, inline-style conventions.
- **Inline SVG wireframes:** No asset pipeline changes, resolution-independent, and the geometric shapes are simple enough to represent as line drawings. Keeps the project's zero-static-asset approach.
- **Keyboard listeners in `main.js`:** Central event handling alongside existing pointer listeners. The help module provides the toggle; `main.js` wires up the keys.

## Key Decisions

1. **Vague phase description** — Don't enumerate all five phases individually; just note the visualization moves through phases
2. **SVG wireframes** for shape previews — lightweight, inline, no build changes
3. **Every page load** — No localStorage, always show on load
4. **Frosted glass** — `backdrop-filter: blur()` with dark tint
5. **Click/any-key to dismiss** — Splash screen behavior; any interaction starts the experience
6. **Canvas stays as fullscreen target** — Help screen exits fullscreen if needed rather than changing the fullscreen architecture
7. **Space bar** pauses/starts animation, same as click
8. **Dismiss always unpauses** — no pause state restoration needed

## Open Questions

None — all questions resolved during brainstorming.
