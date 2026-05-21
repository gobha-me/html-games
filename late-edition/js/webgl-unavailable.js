// Late Edition — WebGL-unavailable fallback (v0.9.1).
// The renderer is a strong-band commitment (cel-shaded toon 3D); when the
// browser can't give us a WebGL context the page must still tell the player
// what happened instead of dying silently at the module-script entry. This
// module never imports THREE — it must stay loadable on machines where
// WebGL construction throws.
//
// hasWebGL() is a cheap probe used as a pre-flight before constructing the
// THREE.WebGLRenderer; mountWebGLUnavailable() is the fallback both the
// pre-flight short-circuit and the try/catch around `new Renderer(root)` in
// js/main.js call to paint the parchment "WebGL required" card.

export function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch (_err) {
    return false;
  }
}

export function mountWebGLUnavailable(root, err) {
  const msg = (err && (err.message || String(err))) || 'unknown error';
  root.innerHTML = `
    <div class="webgl-fallback-card">
      <div class="kicker">LATE EDITION</div>
      <div class="banner">WebGL required</div>
      <p class="body">
        This edition is rendered with cel-shaded 3D and needs WebGL.
        Try enabling hardware acceleration in your browser, or open the
        page in a different browser.
      </p>
      <details class="diag">
        <summary>Technical details</summary>
        <pre class="msg"></pre>
      </details>
    </div>
  `;
  // textContent (not innerHTML) so the error message can't inject markup.
  root.querySelector('.webgl-fallback-card .msg').textContent = msg;

  // Inline styles — the page stylesheet in index.html doesn't define this
  // card, and we can't depend on the renderer-row layout (#world is sized
  // by the corkboard grid; if the grid hasn't laid out yet, fall back to a
  // sensible block).
  const style = document.createElement('style');
  style.textContent = `
    .webgl-fallback-card {
      box-sizing: border-box;
      max-width: 520px;
      margin: 48px auto;
      padding: 28px 36px;
      background: var(--paper-2, #f4f1ea);
      border: 1px solid var(--ink, #0a0a0c);
      color: var(--ink, #0a0a0c);
      box-shadow: 6px 6px 0 var(--paper-shadow, #b6afa1);
      font-family: var(--serif, 'Bodoni Moda', 'Bodoni 72', 'Didot', serif);
    }
    .webgl-fallback-card .kicker {
      font-family: var(--mono, 'JetBrains Mono', ui-monospace, monospace);
      font-size: 11px;
      letter-spacing: 0.22em;
      color: var(--mid, #6b6864);
      margin-bottom: 10px;
    }
    .webgl-fallback-card .banner {
      font-family: var(--serif, 'Bodoni Moda', 'Bodoni 72', 'Didot', serif);
      font-weight: 900;
      font-size: 32px;
      letter-spacing: -0.01em;
      color: var(--red, #c0212a);
      border-bottom: 2px solid var(--ink, #0a0a0c);
      padding-bottom: 8px;
      margin-bottom: 14px;
    }
    .webgl-fallback-card .body {
      font-size: 16px;
      line-height: 1.45;
      margin: 0 0 14px;
    }
    .webgl-fallback-card .diag {
      font-family: var(--mono, 'JetBrains Mono', ui-monospace, monospace);
      font-size: 11px;
      color: var(--mid, #6b6864);
    }
    .webgl-fallback-card .diag summary {
      cursor: pointer;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .webgl-fallback-card .diag .msg {
      margin: 8px 0 0;
      padding: 8px 10px;
      background: var(--paper, #ece8df);
      border: 1px solid var(--rule, #c8c4bc);
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--ink, #0a0a0c);
    }
  `;
  root.appendChild(style);
}
