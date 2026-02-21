# Eliminate redundant sqrt in streak vertex shader

## Problem Statement
The streak vertex shader computes `length(vel)` then `normalize(vel)`, each of which internally computes `sqrt(dot(vel, vel))`. This doubles the sqrt operations: 4096 instances * 4 vertices = 16,384 redundant sqrts per frame. Measurable on mobile GPUs.

## Findings
- `length(vel)` computes `sqrt(dot(vel, vel))`
- `normalize(vel)` computes `vel / sqrt(dot(vel, vel))` — same sqrt recomputed
- Location: `src/materials.js:47-48`
- 2 sqrt ops per vertex-instance, reducible to 1

## Proposed Solutions

### Option 1: Manual length + division
```glsl
float speedSq = dot(vel, vel);
float speed = sqrt(speedSq);
vec3 forward = speed > 0.001 ? vel / speed : vec3(0.0, 1.0, 0.0);
```
- **Pros**: Halves sqrt count, trivial change
- **Cons**: None
- **Effort**: Small (3 lines)
- **Risk**: Low

## Recommended Action
Option 1 — replace length+normalize with dot+sqrt+divide.

## Technical Details
- **Affected Files**: `src/materials.js`
- **Related Components**: Streak particle rendering
- **Database Changes**: No

## Resources
- Original finding: Performance review (performance-oracle agent)

## Acceptance Criteria
- [ ] Vertex shader uses single sqrt instead of two
- [ ] Streak visuals unchanged
- [ ] No GLSL compilation errors

## Work Log

### 2026-02-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

**Learnings:**
- length() + normalize() is a common redundant-sqrt pattern in GLSL

## Notes
Source: Triage session on 2026-02-21
