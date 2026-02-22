---
title: Keyboard Modal Dismiss with Modifier-Key Filtering
module: Help Overlay / Keyboard Shortcuts
problem_type: architecture-pattern
tags:
  - keyboard-events
  - modal-overlay
  - modifier-keys
  - event-filtering
  - help-overlay
date: 2026-02-22
severity: medium
symptoms:
  - Help overlay dismisses immediately after opening via Shift+?
  - Timestamp debounce masks root cause instead of fixing it
root_cause_summary: >
  The "any key dismisses" modal gate catches modifier-only keydown events
  (Shift release after pressing ?) causing immediate dismissal. A 300ms
  timestamp cooldown masked this but was fragile and semantically wrong.
---

# Keyboard Modal Dismiss with Modifier-Key Filtering

## Problem

A help overlay opens when the user presses `?` (which requires Shift on most keyboards) and dismisses on "any key press." The overlay would immediately dismiss because releasing Shift fires a separate `keydown` event with `e.key === 'Shift'`, which the modal gate catches.

### Symptom

Pressing `?` to open help would flash the overlay briefly then dismiss it, or require a 300ms timestamp cooldown to suppress the Shift release event.

### What Didn't Work

**Timestamp-based cooldown** (`performance.now() - lastToggle < 300`):
- Masked the bug with a timing hack
- Required state tracking (`lastHelpToggle` variable)
- Added `performance.now()` calls in 4 separate locations
- Arbitrary 300ms magic number with no semantic meaning
- Fragile across platforms with different event timing

## Root Cause

When pressing `?` on a standard keyboard:

1. User presses Shift (held down)
2. User presses `/` while Shift is held -> `keydown` fires with `e.key === '?'`
3. Help overlay opens via `showHelp()`
4. User releases Shift -> `keydown` fires with `e.key === 'Shift'`
5. Modal gate sees `help.isVisible() === true`, catches the Shift keydown, calls `dismissHelp()`

Step 4 is the root cause: modifier key releases fire as separate `keydown` events that the "any key" gate does not distinguish from intentional dismiss keys.

## Solution

Filter modifier-only key events in the modal gate instead of using a timestamp cooldown.

### Before (workaround)

```javascript
let lastHelpToggle = 0;

function dismissHelp() {
  help.hide();
  params.paused = false;
  gui.domElement.style.display = '';
  if (pauseToggleTimeout) { clearTimeout(pauseToggleTimeout); pauseToggleTimeout = null; }
  lastHelpToggle = performance.now();
}

function showHelp() {
  params.paused = true;
  gui.domElement.style.display = 'none';
  help.show();
  if (pauseToggleTimeout) { clearTimeout(pauseToggleTimeout); pauseToggleTimeout = null; }
  lastHelpToggle = performance.now();
}

// Modal gate
if (help.isVisible()) {
  if (performance.now() - lastHelpToggle < 300) return;  // timing hack
  dismissHelp();
  return;
}

case '?':
  if (performance.now() - lastHelpToggle < 300) return;  // duplicate check
  showHelp();
  break;
```

### After (root-cause fix)

```javascript
function dismissHelp() {
  help.hide();
  params.paused = false;
  gui.domElement.style.display = '';
  if (pauseToggleTimeout) { clearTimeout(pauseToggleTimeout); pauseToggleTimeout = null; }
}

function showHelp() {
  params.paused = true;
  gui.domElement.style.display = 'none';
  help.show();
  if (pauseToggleTimeout) { clearTimeout(pauseToggleTimeout); pauseToggleTimeout = null; }
}

// Modal gate — filter modifier-only keys
if (help.isVisible()) {
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
  dismissHelp();
  return;
}

case '?':
  showHelp();
  break;
```

**Net change**: -5 lines, +1 line. Removed `lastHelpToggle` variable, 2 timestamp assignments, 2 timestamp checks. Added 1 modifier-key filter.

## Why the Modifier-Key Filter Is Superior

| Aspect | Timestamp Cooldown | Modifier-Key Filter |
|--------|-------------------|-------------------|
| Targets | Symptom (timing) | Root cause (event type) |
| State required | `lastHelpToggle` + `performance.now()` | None |
| Magic numbers | 300ms (arbitrary) | None |
| Platform reliability | Fragile (timing varies) | Robust (key names are standard) |
| Code clarity | "Wait 300ms" (why?) | "Ignore modifier releases" (obvious) |
| Side effects | Delays ALL keyboard interactions | Only filters modifier-only events |

## Prevention

### Reusable Pattern

Any modal that dismisses on "any key" AND opens via a shortcut requiring Shift (like `?`, `!`, `@`, `#`, `$`, `%`, `^`, `&`, `*`, `(`, `)`) needs this filter:

```javascript
const MODIFIER_KEYS = ['Shift', 'Control', 'Alt', 'Meta'];

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;

  if (modal.isVisible()) {
    if (MODIFIER_KEYS.includes(e.key)) return;
    modal.dismiss();
    return;
  }

  // Normal shortcut handling...
});
```

### When Timestamp Debouncing IS Appropriate

- Distinguishing click vs double-click (legitimate timing distinction)
- Rate-limiting high-frequency events (scroll, resize)
- Preventing rapid repeated API calls

### When Timestamp Debouncing IS a Code Smell

- Masking a missing event filter (this case)
- Arbitrary interval with no user-testing justification
- Applied to keyboard events without documenting why

### Review Checklist for Keyboard Shortcut Handlers

- [ ] Shortcut uses Shift? -> Filter modifier-only keys in dismiss gate
- [ ] Using `keydown`? -> Correct (avoid `keyup` for modals)
- [ ] Modal state checked before dismiss? -> Verify `isVisible()` guard
- [ ] No arbitrary debounce intervals? -> Justify or remove
- [ ] Tested Shift/Ctrl/Alt/Meta release while modal is open?
- [ ] `e.repeat` filtered to prevent held-key repeats?
- [ ] Active element check to avoid capturing input field keystrokes?

## Related Documentation

- [three-js-orbitcontrols-camera-quaternion-sync.md](three-js-orbitcontrols-camera-quaternion-sync.md) — Pointer event handling patterns, 300ms click/double-click debounce (legitimate use of timing), `pointerdown` button tracking
- [preset-based-settings-panel-pattern.md](preset-based-settings-panel-pattern.md) — State management patterns for DOM overlays coexisting with 3D controls

## Technical Details

- **Files**: `src/main.js` (keyboard handler), `src/help.js` (overlay module)
- **Commit**: `5e61706` on branch `add-help-screen-and-keyboard-shortcuts`
- **Discovered by**: code-simplicity-reviewer agent during multi-agent code review
