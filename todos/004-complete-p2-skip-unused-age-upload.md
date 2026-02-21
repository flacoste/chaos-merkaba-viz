# Skip unused aAge attribute GPU upload

## Problem Statement
The `aAge` instanced buffer attribute is uploaded to the GPU every frame (16 KB) but never read by the vertex or fragment shader. The CPU-side age tracking (increment in update loop, reset in emit) runs but the data never reaches the shader pipeline.

## Findings
- `ageAttr.needsUpdate = true` set every frame
- Location: `src/particles.js:183`
- `ages[i] += dt` computed per alive particle every frame
- Location: `src/particles.js:165`
- `aAge` attribute created and bound to geometry
- Location: `src/particles.js:74-76`
- Neither vertex nor fragment shader in `src/materials.js` declares or uses `aAge`
- 16 KB wasted GPU upload per frame

## Proposed Solutions

### Option 1: Remove needsUpdate, keep CPU-side data
- Remove `ageAttr.needsUpdate = true` from `update()`
- Keep `ages` array and CPU-side tracking for future age-based fading
- **Pros**: Eliminates 16 KB/frame GPU upload, trivial change, preserves future extensibility
- **Cons**: None
- **Effort**: Small (1 line)
- **Risk**: Low

## Recommended Action
Option 1 — remove the GPU upload line.

## Technical Details
- **Affected Files**: `src/particles.js`
- **Related Components**: Particle system GPU buffer management
- **Database Changes**: No

## Resources
- Original finding: Performance review (performance-oracle agent), confirmed by code-simplicity-reviewer

## Acceptance Criteria
- [ ] `ageAttr.needsUpdate = true` removed from update()
- [ ] Particle visuals unchanged (shader doesn't use age)
- [ ] CPU-side age tracking preserved for future use

## Work Log

### 2026-02-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

**Learnings:**
- Don't upload GPU data that no shader reads — easy to miss when attribute is set up speculatively

## Notes
Source: Triage session on 2026-02-21
