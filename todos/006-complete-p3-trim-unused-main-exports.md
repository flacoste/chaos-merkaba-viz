# Trim unused exports from main.js

## Problem Statement
`main.js` exports 15 symbols but only 9 are consumed by the sole importer (`controls.js`). The 6 unused exports (`params`, `tetraA`, `tetraB`, `MAX_SEPARATION`, `scene`, `renderer`, `camera`, `ctx`) create unnecessary public API surface and invite circular dependency patterns.

## Findings
- main.js exports 15 symbols
- Location: `src/main.js:490-495`
- Only `controls.js` imports from main.js, using 9 symbols
- Location: `src/controls.js:3-7`
- 6 exports have zero consumers — these values are passed as function arguments instead

## Proposed Solutions

### Option 1: Remove unused exports
- Reduce export list to the 9 symbols controls.js uses:
  `saveSettings, DEFAULTS, STORAGE_KEY, getPhaseManager, rebuildChaosSphere, getChaosSphereGroup, getTetraColors, setChaosSphereRenderMode, updateChaosSphereColors`
- **Pros**: Cleaner API boundary, less invitation for circular deps
- **Cons**: None — removed exports have zero consumers
- **Effort**: Small (trivial)
- **Risk**: Low

## Recommended Action
Option 1 — delete unused exports.

## Technical Details
- **Affected Files**: `src/main.js`
- **Related Components**: Module dependency graph
- **Database Changes**: No

## Resources
- Original finding: Code simplicity review (code-simplicity-reviewer agent), confirmed by architecture-strategist

## Acceptance Criteria
- [ ] Export list trimmed to 9 consumed symbols
- [ ] No import errors (app still loads)

## Work Log

### 2026-02-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

**Learnings:**
- Unused exports accumulate when values are also passed as arguments

## Notes
Source: Triage session on 2026-02-21
