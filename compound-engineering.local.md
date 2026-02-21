---
review_agents: [performance-oracle, architecture-strategist, code-simplicity-reviewer]
plan_review_agents: [code-simplicity-reviewer]
---

# Review Context

Add project-specific review instructions here.
These notes are passed to all review agents during /workflows:review and /workflows:work.

- Three.js WebGL visualization app (vanilla JS, no framework, no TypeScript)
- Performance-critical: 60fps target with up to 4096 GPU-instanced particles
- Custom ShaderMaterial with velocity-aligned billboard streaks
- State machine manages animation phases (APPROACH → FUSE_LOCK → TRANSFORM → EMIT → STEADY)
- All timers use accumulated delta time (no wall-clock), pause-aware
- No test suite — validation is visual in the browser
