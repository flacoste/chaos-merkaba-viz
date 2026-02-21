# Cache setConeAngle to avoid per-frame trig

## Problem Statement
`setConeAngle()` computes `Math.cos(angleDeg * Math.PI / 180)` every emitting frame, but `params.coneAngle` only changes on user slider interaction. Unnecessary trig computation on every frame.

## Findings
- `setConeAngle(angleDeg)` called every emitting frame from animation loop
- Location: `src/particles.js:100-102`, called from `src/main.js:473`
- `params.coneAngle` only changes on user input, not per-frame

## Proposed Solutions

### Option 1: Cache last value and skip
```javascript
let _lastAngleDeg = -1;
function setConeAngle(angleDeg) {
  if (angleDeg === _lastAngleDeg) return;
  _lastAngleDeg = angleDeg;
  cosThetaMax = Math.cos(angleDeg * Math.PI / 180);
}
```
- **Pros**: Eliminates per-frame trig, trivial change
- **Cons**: None
- **Effort**: Small (4 lines)
- **Risk**: Low

## Recommended Action
Option 1 — add last-value cache.

## Technical Details
- **Affected Files**: `src/particles.js`
- **Related Components**: Cone sampling, particle emission
- **Database Changes**: No

## Resources
- Original finding: Performance review (performance-oracle agent)

## Acceptance Criteria
- [ ] Math.cos only called when coneAngle actually changes
- [ ] Cone sampling behavior unchanged

## Work Log

### 2026-02-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

**Learnings:**
- Per-frame setter calls with unchanged values are easy to miss

## Notes
Source: Triage session on 2026-02-21
