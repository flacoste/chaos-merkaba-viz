// Help overlay module — frosted glass splash screen with controls reference

const STYLE_CSS = `
#help-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  background: rgba(0, 0, 0, 0.72);
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: auto;
  cursor: pointer;
}
#help-overlay.visible {
  opacity: 1;
}
#help-overlay.hidden {
  pointer-events: none;
}

.help-content {
  max-width: 560px;
  width: 90vw;
  text-align: center;
  color: rgba(255, 255, 255, 0.92);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
  -webkit-user-select: none;
}

.help-title {
  font-size: 1.8rem;
  font-weight: 300;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0 0 1.2rem;
  color: rgba(255, 255, 255, 0.95);
}

/* --- Shape figures --- */
.help-shapes {
  display: flex;
  justify-content: center;
  gap: 2.4rem;
  margin-bottom: 1.2rem;
}
.help-shapes figure {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}
.help-shapes svg {
  width: 56px;
  height: 56px;
}
.help-shapes figcaption {
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

/* --- Description --- */
.help-description {
  font-size: 0.85rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 1.4rem;
  max-width: 440px;
  margin-left: auto;
  margin-right: auto;
}

/* --- Controls grid --- */
.help-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.2rem 2rem;
  max-width: 420px;
  margin: 0 auto 1.4rem;
  text-align: left;
}
.help-controls-header {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
  padding-bottom: 0.35rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 0.35rem;
}
.help-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.18rem 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.75);
}
.help-row .label {
  min-width: 5.5rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}
.help-row .action {
  color: rgba(255, 255, 255, 0.85);
}

/* kbd key caps */
kbd {
  display: inline-block;
  min-width: 1.6em;
  padding: 0.15em 0.45em;
  font-family: inherit;
  font-size: 0.75rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 4px;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06);
}

/* --- Dismiss prompt --- */
.help-dismiss {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.04em;
  margin: 0;
  animation: help-pulse 2.5s ease-in-out infinite;
}
@keyframes help-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.65; }
}
`;

// --- SVG wireframes ---

const SVG_MERKABA = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Up tetrahedron (red) -->
  <polygon points="32,7 10,45 54,45" stroke="#ff4444" stroke-width="1.2" stroke-linejoin="round" opacity="0.9"/>
  <!-- Down tetrahedron (white) — aligned back vertices: same orientation, flipped -->
  <polygon points="32,57 10,19 54,19" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" opacity="0.8"/>
  <!-- Inner depth lines (3D cue) -->
  <line x1="32" y1="7" x2="32" y2="57" stroke="rgba(255,255,255,0.15)" stroke-width="0.6"/>
  <line x1="10" y1="45" x2="54" y2="19" stroke="rgba(255,255,255,0.15)" stroke-width="0.6"/>
  <line x1="54" y1="45" x2="10" y2="19" stroke="rgba(255,255,255,0.15)" stroke-width="0.6"/>
</svg>`;

const SVG_STELLA = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Up tetrahedron (red) -->
  <polygon points="32,6 11,44 53,44" stroke="#ff4444" stroke-width="1.2" stroke-linejoin="round" opacity="0.9"/>
  <!-- Down tetrahedron (white) — anti-aligned: rotated 60° forming hexagram -->
  <polygon points="32,58 11,20 53,20" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" opacity="0.8"/>
  <!-- Hexagonal core outline -->
  <polygon points="21.5,24 42.5,24 53,32 42.5,40 21.5,40 11,32"
    stroke="rgba(255,255,255,0.2)" stroke-width="0.5" fill="none"/>
</svg>`;

const SVG_CHAOSPHERE = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Central sphere -->
  <circle cx="32" cy="32" r="7" stroke="rgba(255,255,255,0.7)" stroke-width="1" fill="none"/>
  <!-- 8 rays with arrow tips -->
  ${[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
    const rad = deg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const x1 = 32 + cos * 9;
    const y1 = 32 + sin * 9;
    const x2 = 32 + cos * 27;
    const y2 = 32 + sin * 27;
    // Arrow tip
    const tipLen = 4;
    const tipAng = 0.45;
    const ax = x2 - tipLen * Math.cos(rad - tipAng);
    const ay = y2 - tipLen * Math.sin(rad - tipAng);
    const bx = x2 - tipLen * Math.cos(rad + tipAng);
    const by = y2 - tipLen * Math.sin(rad + tipAng);
    const colors = ['#ff4444', '#ffffff', '#ff4444', '#ffffff', '#ff4444', '#ffffff', '#ff4444', '#ffffff'];
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
      stroke="${colors[i]}" stroke-width="1.3" opacity="0.8"/>
    <polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}"
      stroke="${colors[i]}" stroke-width="1" fill="none" opacity="0.8"/>`;
  }).join('\n  ')}
</svg>`;

// --- HTML content ---

function buildHTML() {
  return `
<div class="help-content">
  <h1 class="help-title">Chaos Merkaba Viz</h1>

  <div class="help-shapes">
    <figure>${SVG_MERKABA}<figcaption>Merkaba</figcaption></figure>
    <figure>${SVG_STELLA}<figcaption>Stella Octangula</figcaption></figure>
    <figure>${SVG_CHAOSPHERE}<figcaption>Chaosphere</figcaption></figure>
  </div>

  <p class="help-description">
    Two tetrahedra approach, fuse, and transform through several phases
    into a chaos sphere emitting particles. Open the control panel to
    change parameters and presets.
  </p>

  <div class="help-controls">
    <div>
      <div class="help-controls-header">Mouse</div>
      <div class="help-row"><span class="label">Click</span><span class="action">Pause / Start</span></div>
      <div class="help-row"><span class="label">Double-click</span><span class="action">Reset camera</span></div>
      <div class="help-row"><span class="label">Scroll</span><span class="action">Zoom</span></div>
      <div class="help-row"><span class="label">Drag \u2195</span><span class="action">Orbit</span></div>
      <div class="help-row"><span class="label">Drag \u2194</span><span class="action">Roll</span></div>
      <div class="help-row"><span class="label">Right-drag</span><span class="action">Pan</span></div>
    </div>
    <div>
      <div class="help-controls-header">Keyboard</div>
      <div class="help-row"><span class="label"><kbd>Space</kbd></span><span class="action">Pause / Start</span></div>
      <div class="help-row"><span class="label"><kbd>F</kbd></span><span class="action">Fullscreen</span></div>
      <div class="help-row"><span class="label"><kbd>Esc</kbd></span><span class="action">Exit fullscreen</span></div>
      <div class="help-row"><span class="label"><kbd>?</kbd></span><span class="action">Toggle help</span></div>
    </div>
  </div>

  <p class="help-dismiss">Click or press any key to start</p>
</div>`;
}

// --- Module API ---

export function createHelpOverlay({ onDismiss } = {}) {
  // Inject styles once
  const style = document.createElement('style');
  style.textContent = STYLE_CSS;
  document.head.appendChild(style);

  // Create overlay element
  const overlay = document.createElement('div');
  overlay.id = 'help-overlay';
  overlay.className = 'hidden';
  overlay.innerHTML = buildHTML();
  document.body.appendChild(overlay);

  let visible = false;

  // Click to dismiss
  overlay.addEventListener('pointerdown', (e) => {
    if (!visible) return;
    e.stopPropagation();
    if (onDismiss) onDismiss();
  });

  function show() {
    visible = true;
    overlay.classList.remove('hidden');
    // Force reflow so transition triggers from opacity 0
    overlay.offsetHeight; // eslint-disable-line no-unused-expressions
    overlay.classList.add('visible');
  }

  function hide() {
    visible = false;
    overlay.classList.remove('visible');
    overlay.classList.add('hidden');
  }

  function toggle() {
    if (visible) hide();
    else show();
  }

  function isVisible() {
    return visible;
  }

  return { show, hide, toggle, isVisible };
}
