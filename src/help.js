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

// --- SVG shapes: hexagram (Star of David) representations ---
// Both are hexagrams with R=24, center=(32,32).
// Up-triangle (red): A(32,8) B(52.8,44) C(11.2,44)
// Down-triangle (gray): D(32,56) E(11.2,20) F(52.8,20)
// Inner hexagon: H1(38.9,20) H2(45.9,32) H3(38.9,44) H4(25.1,44) H5(18.1,32) H6(25.1,20)
//
// Merkaba: clean flat hexagram — center split horizontally, no internal edges.
// Stella: 3D shaded — two interlocking tetrahedra traced from reference image.
// UP tetra (red): T(31.8,3) BL(6.5,48) BR(57.3,46.6) ML(14.3,32.4)
// DN tetra (gray): B(32.5,61) UL(6,17.4) UR(58,18.1) MR(48.9,32.5)

const SVG_MERKABA = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <polygon points="32,8 38.9,20 25.1,20" fill="rgb(175,18,18)"/>
  <polygon points="52.8,44 38.9,44 45.9,32" fill="rgb(135,12,12)"/>
  <polygon points="11.2,44 18.1,32 25.1,44" fill="rgb(95,8,8)"/>
  <polygon points="32,56 25.1,44 38.9,44" fill="rgb(140,140,140)"/>
  <polygon points="52.8,20 45.9,32 38.9,20" fill="rgb(155,155,155)"/>
  <polygon points="11.2,20 25.1,20 18.1,32" fill="rgb(95,95,95)"/>
  <polygon points="25.1,20 38.9,20 45.9,32 18.1,32" fill="rgb(120,120,120)"/>
  <polygon points="18.1,32 45.9,32 38.9,44 25.1,44" fill="rgb(130,12,12)"/>
</svg>`;

const SVG_STELLA = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <polygon points="6,17.4 18.8,39.4 31.9,17.7" fill="rgba(220,225,235,0.9)"/>
  <polygon points="58,18.1 32.4,17.3 43.9,39.5" fill="rgba(190,195,210,0.87)"/>
  <polygon points="19.2,40.2 32.5,61 44.1,39.7" fill="rgba(155,160,180,0.84)"/>
  <polygon points="23.7,17.3 32.3,17.3 31.8,3" fill="rgb(200,30,30)"/>
  <polygon points="32.3,18.3 31.7,3 41.4,17.5" fill="rgb(185,25,25)"/>
  <polygon points="14.3,32.4 19.5,39.8 6.5,48" fill="rgb(160,18,18)"/>
  <polygon points="22.9,47.8 18.6,40.4 6.6,48" fill="rgb(135,14,14)"/>
  <polygon points="39.9,47.7 43.7,39.4 57.3,46.6" fill="rgb(150,16,16)"/>
  <polygon points="48.9,32.5 44.7,40 57.3,46.6" fill="rgb(125,12,12)"/>
  <polygon points="19.2,39.3 31.9,32.3 31.6,18" fill="rgb(170,20,20)"/>
  <polygon points="44.3,40.3 31.9,32.8 19.7,40.2" fill="rgb(110,10,10)"/>
  <polygon points="32.6,18 32.4,32.5 44.9,39.3" fill="rgb(145,15,15)"/>
  <g fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="0.5">
    <path d="M31.8,3L6.5,48 M31.8,3L57.3,46.6 M31.8,3L14.3,32.4 M6.5,48L57.3,46.6 M6.5,48L14.3,32.4 M57.3,46.6L14.3,32.4"/>
    <path d="M32.5,61L6,17.4 M32.5,61L58,18.1 M32.5,61L48.9,32.5 M6,17.4L58,18.1 M6,17.4L48.9,32.5 M58,18.1L48.9,32.5"/>
  </g>
</svg>`;

// --- Chaosphere: central sphere + 8 tapered 3D rays with cone tips ---
// Colors: per-vertex defaults. Swapped frontRight↔frontRight and frontLeft↔frontLeft
// between tetra A and B per user request.
const SVG_CHAOSPHERE = (() => {
  const rayColors = [
    '#d6ff33', // top A — lime
    '#42425c', // frontRight A — dark blue-gray (swapped from B)
    '#4169E1', // frontLeft A — blue (swapped from B)
    '#228B22', // back A — green
    '#e2c72c', // bottom B — yellow
    '#800080', // frontRight B — purple (swapped from A)
    '#fd8c4e', // frontLeft B — orange (swapped from A)
    '#CC0000', // back B — red
  ];
  const rays = rayColors.map((color, i) => {
    const deg = i * 45 - 90;
    const rad = deg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // Ray body: tapered polygon for 3D cylinder look
    const baseR = 9;
    const tipR = 22;
    const baseW = 1.6;
    const tipW = 0.5;
    // Perpendicular direction
    const px = -sin;
    const py = cos;
    const bx1 = 32 + cos * baseR + px * baseW;
    const by1 = 32 + sin * baseR + py * baseW;
    const bx2 = 32 + cos * baseR - px * baseW;
    const by2 = 32 + sin * baseR - py * baseW;
    const tx1 = 32 + cos * tipR + px * tipW;
    const ty1 = 32 + sin * tipR + py * tipW;
    const tx2 = 32 + cos * tipR - px * tipW;
    const ty2 = 32 + sin * tipR - py * tipW;
    // Cone arrow tip
    const coneBase = tipR;
    const coneTip = 27;
    const coneW = 2.8;
    const cx1 = 32 + cos * coneBase + px * coneW;
    const cy1 = 32 + sin * coneBase + py * coneW;
    const cx2 = 32 + cos * coneBase - px * coneW;
    const cy2 = 32 + sin * coneBase - py * coneW;
    const ctX = 32 + cos * coneTip;
    const ctY = 32 + sin * coneTip;
    return `<polygon points="${bx1.toFixed(1)},${by1.toFixed(1)} ${tx1.toFixed(1)},${ty1.toFixed(1)} ${tx2.toFixed(1)},${ty2.toFixed(1)} ${bx2.toFixed(1)},${by2.toFixed(1)}"
      fill="${color}" opacity="0.8"/>
    <polygon points="${cx1.toFixed(1)},${cy1.toFixed(1)} ${ctX.toFixed(1)},${ctY.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)}"
      fill="${color}" opacity="0.85"/>`;
  }).join('\n  ');
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="sg">
      <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  ${rays}
  <circle cx="32" cy="32" r="9" fill="url(#sg)"/>
  <circle cx="32" cy="32" r="7.5" stroke="rgba(255,255,255,0.5)" stroke-width="0.7" fill="rgba(30,30,30,0.6)"/>
</svg>`;
})();

// --- HTML content ---

const HELP_HTML = `
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

// --- Module API ---

export function createHelpOverlay({ onDismiss } = {}) {
  // Inject styles once
  if (!document.getElementById('help-overlay-styles')) {
    const style = document.createElement('style');
    style.id = 'help-overlay-styles';
    style.textContent = STYLE_CSS;
    document.head.appendChild(style);
  }

  // Create overlay element
  const overlay = document.createElement('div');
  overlay.id = 'help-overlay';
  overlay.className = 'hidden';
  overlay.innerHTML = HELP_HTML;
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

  function isVisible() {
    return visible;
  }

  return { show, hide, isVisible };
}
