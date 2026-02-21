// Phase names
const APPROACH = 'APPROACH';
const FUSE_LOCK = 'FUSE_LOCK';
const TRANSFORM = 'TRANSFORM';
const EMIT = 'EMIT';
const STEADY = 'STEADY';

const PHASE_ORDER = [APPROACH, FUSE_LOCK, TRANSFORM, EMIT, STEADY];

// --- Phase definitions ---

const phases = {
  [APPROACH]: {
    canEnter(ctx) {
      return ctx.params.approachDuration > 0;
    },
    enter(ctx) {
      ctx.currentSeparation = ctx.MAX_SEPARATION;
      ctx.fused = false;
      ctx.lockAchieved = false;
      ctx.morphProgress = 0;
      ctx.rampActive = false;
      ctx.rampElapsed = 0;
      ctx.rampBaseSpeed = 0;
      ctx.emitting = false;
      const durationSec = ctx.params.approachDuration * 60;
      ctx.approachSpeed = durationSec > 0 ? ctx.MAX_SEPARATION / durationSec : Infinity;
    },
    update(ctx, dt) {
      ctx.currentSeparation -= ctx.approachSpeed * dt;
      if (ctx.currentSeparation <= 0) {
        ctx.currentSeparation = 0;
        return 'next';
      }
      return null;
    },
    exit(ctx) {
      ctx.currentSeparation = 0;
    },
  },

  [FUSE_LOCK]: {
    // Always mandatory — no canEnter guard
    enter(ctx) {
      ctx.fused = true;
      ctx.currentSeparation = 0;
      ctx.lockAchieved = false;
      ctx.morphProgress = 0;
      ctx.emitting = false;

      // In Unlock mode, treat as immediately locked
      if (ctx.params.fusionMode === 'Unlock') {
        ctx.lockAchieved = true;
      }

      // Start speed ramp if configured
      if (ctx.params.rampDuration > 0) {
        ctx.rampElapsed = 0;
        ctx.rampActive = true;
        ctx.rampBaseSpeed = ctx.params.rotationSpeed;
      }
    },
    update(ctx, dt) {
      ctx.stateElapsed += dt;

      // Check alignment via callback (defined in main.js, owns scene graph access)
      if (!ctx.lockAchieved && ctx.checkAlignment) {
        const speed = ctx.computeEffectiveSpeed();
        ctx.checkAlignment(speed, dt);
      }

      if (ctx.lockAchieved) return 'next';
      return null;
    },
    exit(ctx) {
      ctx.lockAchieved = true;
    },
  },

  [TRANSFORM]: {
    canEnter(ctx) {
      return ctx.params.morphEnabled;
    },
    enter(ctx) {
      ctx.morphProgress = 0;
    },
    update(ctx, dt) {
      // If ramp is disabled, morph completes instantly
      if (!ctx.rampActive || ctx.params.rampDuration <= 0) {
        ctx.morphProgress = 1.0;
        return 'next';
      }

      // Morph progress driven by effective speed:
      // starts at 80% of ramp max, completes at 100%
      const speed = ctx.computeEffectiveSpeed();
      const maxSpeed = Math.max(ctx.params.rampMaxSpeed, ctx.rampBaseSpeed);
      if (maxSpeed <= 0) {
        ctx.morphProgress = 1.0;
        return 'next';
      }
      ctx.morphProgress = Math.max(0, Math.min(1,
        (speed - 0.8 * maxSpeed) / (0.2 * maxSpeed)
      ));

      if (ctx.morphProgress >= 1.0) {
        ctx.morphProgress = 1.0;
        return 'next';
      }
      return null;
    },
  },

  [EMIT]: {
    canEnter(ctx) {
      return ctx.params.emitEnabled;
    },
    enter(ctx) {
      ctx.emitDelayElapsed = 0;
      ctx.emitting = false;
      ctx.emitRampElapsed = 0;
      ctx.emitAccumulator = 0;
    },
    update(ctx, dt) {
      if (!ctx.emitting) {
        // Wait for emit delay
        ctx.emitDelayElapsed += dt;
        const delaySec = ctx.params.emitDelay * 60;
        if (ctx.emitDelayElapsed >= delaySec) {
          ctx.emitting = true;
          ctx.emitRampElapsed = 0;
        }
        return null;
      }

      // Emitting — ramp timer advanced in animation loop (works in both EMIT and STEADY)
      // Once fully ramped, advance to STEADY
      if (ctx.emitRampElapsed >= 3.0) {
        return 'next';
      }
      return null;
    },
  },

  [STEADY]: {
    update() {
      return null;
    },
  },
};

// --- State machine runner ---

function createSequenceMachine(stateDefinitions, stateOrder, ctx) {
  let currentName = null;
  let currentState = null;

  function transitionTo(name) {
    if (currentState && currentState.exit) currentState.exit(ctx);

    let idx = stateOrder.indexOf(name);

    // Skip states whose canEnter guard returns false
    while (idx < stateOrder.length) {
      const candidate = stateDefinitions[stateOrder[idx]];
      if (!candidate.canEnter || candidate.canEnter(ctx)) break;
      idx++;
    }
    if (idx >= stateOrder.length) idx = stateOrder.length - 1;

    currentName = stateOrder[idx];
    currentState = stateDefinitions[currentName];
    ctx.stateElapsed = 0;
    if (currentState.enter) currentState.enter(ctx);
  }

  function update(dt) {
    if (!currentState) return;
    const signal = currentState.update(ctx, dt);
    if (signal === 'next') {
      const nextIdx = stateOrder.indexOf(currentName) + 1;
      if (nextIdx < stateOrder.length) {
        transitionTo(stateOrder[nextIdx]);
      }
    }
  }

  function restart() {
    transitionTo(stateOrder[0]);
  }

  function getCurrentState() {
    return currentName;
  }

  return { update, restart, transitionTo, getCurrentState };
}

// --- Phase manager factory ---

export function createPhaseManager(ctx) {
  const machine = createSequenceMachine(phases, PHASE_ORDER, ctx);

  function onParamChange(paramName) {
    // fusionMode: restart at FUSE_LOCK (not APPROACH — separation is unrelated)
    if (paramName === 'fusionMode' || paramName === 'lockShape') {
      const currentIdx = PHASE_ORDER.indexOf(machine.getCurrentState());
      if (currentIdx >= PHASE_ORDER.indexOf(FUSE_LOCK)) {
        machine.transitionTo(FUSE_LOCK);
      }
      return;
    }

    // approachDuration: only restart if currently in APPROACH
    if (paramName === 'approachDuration') {
      if (machine.getCurrentState() === APPROACH) {
        machine.transitionTo(APPROACH);
      }
      return;
    }

    // morphEnabled: toggle morph on/off at any phase
    if (paramName === 'morphEnabled') {
      if (!ctx.params.morphEnabled) {
        ctx.morphProgress = 0;
      } else {
        // If past TRANSFORM, restore morph instantly
        const currentIdx = PHASE_ORDER.indexOf(machine.getCurrentState());
        if (currentIdx > PHASE_ORDER.indexOf(TRANSFORM)) {
          ctx.morphProgress = 1.0;
        }
      }
      if (machine.getCurrentState() === TRANSFORM) {
        machine.transitionTo(TRANSFORM);
      }
      return;
    }

    // emitEnabled: toggle emission on/off immediately
    if (paramName === 'emitEnabled') {
      if (!ctx.params.emitEnabled) {
        ctx.emitting = false;
        ctx.emitAccumulator = 0;
      } else {
        // If past EMIT, start emission immediately (skip delay, use ramp)
        const currentIdx = PHASE_ORDER.indexOf(machine.getCurrentState());
        if (currentIdx >= PHASE_ORDER.indexOf(EMIT)) {
          ctx.emitting = true;
          ctx.emitRampElapsed = 0;
          ctx.emitAccumulator = 0;
        }
      }
      return;
    }

    // Ramp params: reset the ramp, only restart if currently in TRANSFORM.
    if (paramName === 'rampDuration' || paramName === 'rampMaxSpeed') {
      if (ctx.rampActive) {
        ctx.rampElapsed = 0;
        ctx.rampBaseSpeed = ctx.params.rotationSpeed;
      }
      if (machine.getCurrentState() === TRANSFORM) {
        machine.transitionTo(TRANSFORM);
      }
      return;
    }
  }

  return {
    update: machine.update,
    restart: machine.restart,
    getCurrentState: machine.getCurrentState,
    onParamChange,
  };
}

