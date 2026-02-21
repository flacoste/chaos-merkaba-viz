# Pre-allocate emission point and basis buffers

## Problem Statement
`computeEmissionPoints()` and `setEmissionPoints()` allocate ~28 short-lived objects per frame during emission (array, 8 point objects, 4-8 THREE.Color, 8 basis objects via `.map()`). At 60fps this creates ~1200 throwaway objects/sec, pressuring V8's minor GC and causing potential jank spikes of 0.5-2ms.

## Findings
- `computeEmissionPoints()` creates a new array + 8 point objects + 4-8 THREE.Color objects per call
- Location: `src/main.js:226-279`
- `setEmissionPoints()` calls `.map()` creating 8 new basis objects per call
- Location: `src/particles.js:95-98`
- `getTetraColors()` creates new THREE.Color objects from hex strings each call
- Location: `src/main.js:78-84`
- Called every emitting frame from animation loop (`src/main.js:471-473`)

## Proposed Solutions

### Option 1: Pre-allocate and update in-place
- Pre-allocate `_emissionPoints[8]`, `_emissionBases[8]`, `_colorsA[4]`, `_colorsB[4]` at module level
- Update fields in-place each frame instead of creating new objects
- `setEmissionPoints()` uses a for-loop updating existing basis objects instead of `.map()`
- **Pros**: Zero allocation in hot path, simple change
- **Cons**: Slightly more verbose code
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1 - Pre-allocate all reusable buffers and update in-place.

## Technical Details
- **Affected Files**: `src/main.js`, `src/particles.js`
- **Related Components**: Particle emission pipeline, animation loop
- **Database Changes**: No

## Resources
- Original finding: Performance review (performance-oracle agent)
- Related: Also addresses OPT-4 (getTetraColors allocation)

## Acceptance Criteria
- [ ] No new object allocations per frame during emission
- [ ] Emission visual behavior unchanged
- [ ] 60fps maintained at default and max emission rates

## Work Log

### 2026-02-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- Ready to be picked up and worked on

**Learnings:**
- Short-lived objects in 60fps loops cause GC pressure even if individually cheap

## Notes
Source: Triage session on 2026-02-21
