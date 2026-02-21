# Move lock-seeking rotation logic into FUSE_LOCK phase

## Problem Statement
The alignment-checking rotation logic (~30 lines) that determines when FUSE_LOCK exits lives in the animation loop (`main.js:396-423`), not in the FUSE_LOCK phase definition. The phase's exit condition (`ctx.lockAchieved`) is set by code outside the state machine, creating a split-brain architecture where understanding FUSE_LOCK requires reading both `phase-manager.js` and the animation loop.

## Findings
- Lock-seeking logic (alignment check + force-snap timeout) in animation loop
- Location: `src/main.js:396-423`
- FUSE_LOCK update just checks `if (ctx.lockAchieved) return 'next'`
- Location: `src/phase-manager.js:79-81`
- Phase comment acknowledges: "lockAchieved is set externally by rotation alignment check in main.js"
- The animation loop owns both the rotation delta application AND the lock decision logic

## Proposed Solutions

### Option 1: Pass checkAlignment callback through ctx
- Add a `checkAlignment(effectiveSpeed, dt)` function to `ctx` defined in main.js
- FUSE_LOCK's `update()` calls `ctx.checkAlignment(speed, dt)` which sets `ctx.lockAchieved`
- Animation loop still applies rotation deltas to Three.js objects (it owns the scene graph)
- Phase owns the decision of when lock is achieved
- **Pros**: Phase encapsulates its own exit condition, cleaner separation
- **Cons**: ctx gains a callback, slightly more wiring
- **Effort**: Medium
- **Risk**: Low

### Option 2: Add tetraA/tetraB references to ctx
- FUSE_LOCK reads rotation values directly from mesh objects
- **Pros**: Phase has full control
- **Cons**: Phase now coupled to Three.js scene graph objects
- **Effort**: Medium
- **Risk**: Medium (leaks rendering concerns into state machine)

## Recommended Action
Option 1 — callback approach inverts the dependency cleanly.

## Technical Details
- **Affected Files**: `src/main.js`, `src/phase-manager.js`
- **Related Components**: FUSE_LOCK phase, rotation logic, animation loop
- **Database Changes**: No

## Resources
- Original finding: Architecture review (architecture-strategist agent)

## Acceptance Criteria
- [ ] Lock-seeking decision logic lives in FUSE_LOCK phase
- [ ] Animation loop only applies rotation deltas, does not determine lock
- [ ] Force-snap timeout (3s) still works
- [ ] Alignment tolerance still frame-rate dependent
- [ ] Visual lock behavior unchanged

## Work Log

### 2026-02-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

**Learnings:**
- State machine value is diminished when exit conditions are determined externally

## Notes
Source: Triage session on 2026-02-21
