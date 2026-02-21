# Remove dead code from state machine

## Problem Statement
`phase-manager.js` contains ~39 lines of dead code: unreachable signal handlers, a mostly-dead abstraction (`PARAM_PHASE_MAP`), unused exports, empty lifecycle methods, and dead computation (`stateElapsed` incremented but never read in 3 phases).

## Findings
- `PARAM_PHASE_MAP` has 3 entries but only `lockShape` reaches the general path — `rampDuration` and `rampMaxSpeed` are handled by explicit `if` blocks that return early (lines 284-293)
- Location: `src/phase-manager.js:14-18, 295-305`
- `'restart'` signal handler (line 208) and arbitrary-string signal handler (line 210) are never returned by any phase
- Location: `src/phase-manager.js:208-211`
- Exported phase constants (`APPROACH`, `FUSE_LOCK`, etc.) have zero consumers
- Location: `src/phase-manager.js:316`
- Empty `exit()` on TRANSFORM (line 124), EMIT (lines 159-161), STEADY (line 171); empty `enter()` on STEADY (lines 165-167) — machine already guards with `if (currentState.exit)`
- `ctx.stateElapsed += dt` in APPROACH (line 41), TRANSFORM (line 98), EMIT (line 139) — value only read during FUSE_LOCK via `main.js:419`
- Redundant `ctx.stateElapsed = 0` in every phase `enter()` — machine already does this in `transitionTo()` (line 196)

## Proposed Solutions

### Option 1: Delete dead code, inline lockShape
- Delete `PARAM_PHASE_MAP` (lines 10-18) and general path (lines 295-305)
- Add `lockShape` to the `fusionMode` check: `if (paramName === 'fusionMode' || paramName === 'lockShape')`
- Delete signal handlers for `'restart'` and arbitrary strings (lines 208-211)
- Delete unused `export { APPROACH, ... }` line 316
- Delete empty `exit()` from TRANSFORM, EMIT, STEADY; empty `enter()` from STEADY
- Remove dead `stateElapsed += dt` from APPROACH, TRANSFORM, EMIT updates
- Remove redundant `stateElapsed = 0` from phase `enter()` methods
- **Pros**: ~39 fewer lines, fewer concepts, cleaner signal protocol (only `'next'` or `null`)
- **Cons**: None — all removed code is provably unreachable or unused
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1 — straightforward deletion of dead code.

## Technical Details
- **Affected Files**: `src/phase-manager.js`
- **Related Components**: State machine, onParamChange handler
- **Database Changes**: No

## Resources
- Original finding: Code simplicity review (code-simplicity-reviewer agent)

## Acceptance Criteria
- [ ] `PARAM_PHASE_MAP` and general path removed
- [ ] `lockShape` handled by fusionMode check
- [ ] Dead signal handlers removed
- [ ] Unused exports removed
- [ ] Empty lifecycle methods removed
- [ ] Dead stateElapsed increments removed
- [ ] Phase transitions still work correctly (manual visual test)

## Work Log

### 2026-02-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- Ready to be picked up and worked on

**Learnings:**
- PARAM_PHASE_MAP was over-abstraction that became dead infrastructure as special-case handlers were added

## Notes
Source: Triage session on 2026-02-21
