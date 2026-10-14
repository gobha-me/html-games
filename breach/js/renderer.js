// renderer.js — WebGL2 2.5D Normal-Mapped Deferred Lighting + World-Space Normal Rotation + Raycast Shadows
(function (global) {
  'use strict';

  const VERT_SRC = `#version 300 es
  precision highp float;

  layout(location = 0) in vec2 a_pos;
  layout(location = 1) in vec2 a_uv;
  layout(location = 2) in vec2 a_rot;   // (cos(theta), sin(theta)) for world-space normal rotation
  layout(location = 3) in vec4 a_tint;

  uniform vec2 u_resolution;
  uniform vec2 u_cameraShake;

  out vec2 v_uv;
  out vec2 v_worldPos;
  out vec2 v_rot;
  out vec4 v_tint;

  void main() {
    vec2 world = a_pos + u_cameraShake;
    vec2 clip = (world / u_resolution) * 2.0 - 1.0;
    clip.y = -clip.y;
    gl_Position = vec4(clip, 0.0, 1.0);
    v_uv = a_uv;
    v_worldPos = a_pos;
    v_rot = a_rot;
    v_tint = a_tint;
  }
  `;

  const FRAG_SRC = `#version 300 es
  precision highp float;

  in vec2 v_uv;
  in vec2 v_worldPos;
  in vec2 v_rot;
  in vec4 v_tint;

  uniform sampler2D u_albedoTex;
  uniform sampler2D u_normalTex;
  uniform sampler2D u_emissiveTex;
  uniform sampler2D u_visTex;

  uniform vec2 u_resolution;
  uniform vec3 u_ambient;
  uniform vec2 u_playerPos;
  uniform vec2 u_aimDir;
  uniform float u_overclock;
  uniform float u_time;

  #define MAX_LIGHTS 12
  uniform int u_lightCount;
  uniform vec4 u_lightPosRad[MAX_LIGHTS]; // xy = world pos, z = radius, w = intensity
  uniform vec3 u_lightColor[MAX_LIGHTS];

  out vec4 outColor;

  void main() {
    vec4 base = texture(u_albedoTex, v_uv);
    if (base.a < 0.03) discard;

    vec4 normSpec = texture(u_normalTex, v_uv);
    vec3 emis = texture(u_emissiveTex, v_uv).rgb;

    // Unpack tangent-space normal and rotate XY by sprite's world rotation (solves the rotating normal-map trap)
    vec3 nLocal = normSpec.xyz * 2.0 - 1.0;
    vec2 rotXY = vec2(
      nLocal.x * v_rot.x - nLocal.y * v_rot.y,
      nLocal.x * v_rot.y + nLocal.y * v_rot.x
    );
    vec3 N = normalize(vec3(rotXY, max(0.15, nLocal.z)));
    float specMask = normSpec.w;

    // Sample 2D visibility / line-of-sight shadow texture
    vec2 visUV = clamp(v_worldPos / u_resolution, 0.0, 1.0);
    float losVis = smoothstep(0.20, 0.85, texture(u_visTex, visUV).r);

    // Overhead architectural directional light (casts 2.5D normal-mapped bevel highlights across walls & tiles)
    vec3 overheadDir = normalize(vec3(-0.35, -0.45, 0.82));
    float overheadDiff = max(dot(N, overheadDir), 0.0);
    vec3 skyFill = (u_ambient * 2.4 + vec3(0.18, 0.23, 0.32)) * (0.55 + overheadDiff * 0.65);
    vec3 totalLight = skyFill * mix(0.38, 1.05, losVis);

    // Operative tactical visor flashlight cone
    vec2 toFrag = v_worldPos - u_playerPos;
    float distPlayer = length(toFrag);
    vec2 dirPlayer = distPlayer > 0.001 ? toFrag / distPlayer : u_aimDir;
    float coneDot = dot(dirPlayer, u_aimDir);
    float coneMask = smoothstep(0.30, 0.84, coneDot);
    float coneAtten = clamp(1.0 - distPlayer / 620.0, 0.0, 1.0);
    coneAtten *= coneAtten;

    // Close-range 360 aura around the operative
    float auraAtten = clamp(1.0 - distPlayer / 165.0, 0.0, 1.0);

    vec3 Lplayer = normalize(vec3(-toFrag, 64.0));
    float ndotlPlayer = max(dot(N, Lplayer), 0.0);
    vec3 Hplayer = normalize(Lplayer + vec3(0.0, 0.0, 1.0));
    float specPlayer = pow(max(dot(N, Hplayer), 0.0), 18.0) * specMask;

    vec3 flashCol = mix(vec3(0.60, 0.94, 1.0), vec3(0.0, 1.0, 0.95), u_overclock);
    float flashVis = mix(0.22, 1.0, losVis);
    totalLight += flashCol * (coneMask * coneAtten * 1.35 + auraAtten * 0.70) * (ndotlPlayer * 0.85 + 0.35) * flashVis;

    vec3 totalSpec = flashCol * specPlayer * (coneMask * coneAtten + auraAtten * 0.5) * flashVis * 0.75;

    // Dynamic point lights (neon fixtures, muzzle flashes, plasma bolts, breach charges)
    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (i >= u_lightCount) break;
      vec4 lpr = u_lightPosRad[i];
      vec2 lvec = lpr.xy - v_worldPos;
      float d = length(lvec);
      if (d < lpr.z) {
        float att = 1.0 - (d / lpr.z);
        att = att * att * lpr.w;
        vec3 L = normalize(vec3(lvec, 56.0));
        float ndl = max(dot(N, L), 0.0);
        vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
        float sp = pow(max(dot(N, H), 0.0), 20.0) * specMask;

        float shadowFactor = mix(0.52, 1.0, losVis);
        totalLight += u_lightColor[i] * att * (ndl * 0.9 + 0.30) * shadowFactor;
        totalSpec  += u_lightColor[i] * att * sp * shadowFactor * 0.65;
      }
    }

    vec3 albedo = base.rgb * v_tint.rgb;
    vec3 lit = albedo * totalLight + totalSpec + emis * (1.10 + u_overclock * 0.65);

    // Adrenaline Overclock grading (cyan neural grid pulse + scanline contrast)
    if (u_overclock > 0.01) {
      float scan = 0.94 + 0.06 * sin(v_worldPos.y * 1.6 + u_time * 18.0);
      vec3 ocTint = vec3(lit.r * 0.72, lit.g * 1.08, lit.b * 1.25) * scan;
      lit = mix(lit, ocTint, u_overclock * 0.65);
    }

    outColor = vec4(lit, base.a * v_tint.a);
  }
  `;

  class BreachRenderer {
    constructor(canvas, sprites) {
      this.canvas = canvas;
      this.sprites = sprites;
      this.width = canvas.width;
      this.height = canvas.height;

      // Offscreen persistent decal + HUD overlay canvas
      this.overlayCanvas = document.createElement('canvas');
      this.overlayCanvas.width = this.width;
      this.overlayCanvas.height = this.height;
      this.overlayCtx = this.overlayCanvas.getContext('2d');

      // Offscreen 2D visibility shadow map (320x180 low-res soft shadow mask)
      this.visCanvas = document.createElement('canvas');
      this.visCanvas.width = 320;
      this.visCanvas.height = 180;
      this.visCtx = this.visCanvas.getContext('2d');

      // Create a second visible 2D HUD canvas layered directly over the WebGL canvas
      this.fxCanvas = document.createElement('canvas');
      this.fxCanvas.width = this.width;
      this.fxCanvas.height = this.height;
      this.fxCanvas.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;z-index:5;';
      if (canvas.parentElement) {
        canvas.parentElement.appendChild(this.fxCanvas);
      }
      this.fxCtx = this.fxCanvas.getContext('2d');

      this.gl = null;
      this.isWebGL2 = false;
      this.maxSprites = 2048;
      this.floatsPerVertex = 10; // x, y, u, v, cos, sin, r, g, b, a
      this.vertexData = new Float32Array(this.maxSprites * 6 * this.floatsPerVertex);
      this.spriteCount = 0;

      this.initWebGL2();
    }

    initWebGL2() {
      let gl = null;
      try {
        gl = this.canvas.getContext('webgl2', {
          alpha: false,
          antialias: false,
          premultipliedAlpha: false,
          preserveDrawingBuffer: true,
        });
      } catch (_) {
        gl = null;
      }

      if (!gl) {
        this.isWebGL2 = false;
        this.ctx2d = this.canvas.getContext('2d');
        return;
      }

      const vs = this.compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
      const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
      if (!vs || !fs) {
        this.isWebGL2 = false;
        this.ctx2d = this.canvas.getContext('2d');
        return;
      }

      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.warn('WebGL2 link failed:', gl.getProgramInfoLog(prog));
        this.isWebGL2 = false;
        this.ctx2d = this.canvas.getContext('2d');
        return;
      }

      this.gl = gl;
      this.isWebGL2 = true;
      this.prog = prog;

      this.uLoc = {
        resolution:  gl.getUniformLocation(prog, 'u_resolution'),
        cameraShake: gl.getUniformLocation(prog, 'u_cameraShake'),
        albedoTex:   gl.getUniformLocation(prog, 'u_albedoTex'),
        normalTex:   gl.getUniformLocation(prog, 'u_normalTex'),
        emissiveTex: gl.getUniformLocation(prog, 'u_emissiveTex'),
        visTex:      gl.getUniformLocation(prog, 'u_visTex'),
        ambient:     gl.getUniformLocation(prog, 'u_ambient'),
        playerPos:   gl.getUniformLocation(prog, 'u_playerPos'),
        aimDir:      gl.getUniformLocation(prog, 'u_aimDir'),
        overclock:   gl.getUniformLocation(prog, 'u_overclock'),
        time:        gl.getUniformLocation(prog, 'u_time'),
        lightCount:  gl.getUniformLocation(prog, 'u_lightCount'),
        lightPosRad: gl.getUniformLocation(prog, 'u_lightPosRad'),
        lightColor:  gl.getUniformLocation(prog, 'u_lightColor'),
      };

      this.vao = gl.createVertexArray();
      this.vbo = gl.createBuffer();
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.vertexData.byteLength, gl.DYNAMIC_DRAW);

      const stride = this.floatsPerVertex * 4;
      // a_pos
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
      // a_uv
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
      // a_rot
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 16);
      // a_tint
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 24);

      this.albedoTex   = this.createTextureFromCanvas(gl, this.sprites.albedoCanvas, true);
      this.normalTex   = this.createTextureFromCanvas(gl, this.sprites.normalCanvas, true);
      this.emissiveTex = this.createTextureFromCanvas(gl, this.sprites.emissiveCanvas, true);
      this.visTex      = this.createTextureFromCanvas(gl, this.visCanvas, false);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    compileShader(gl, type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn('Shader compile error:', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }

    createTextureFromCanvas(gl, canvas, nearest) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      return tex;
    }

    pushQuad(cx, cy, w, h, spriteName, angle, r = 1, g = 1, b = 1, a = 1) {
      if (this.spriteCount >= this.maxSprites) return;
      const uv = this.sprites.getUV(spriteName);
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const hw = w * 0.5;
      const hh = h * 0.5;

      const corners = [
        [-hw, -hh, uv.u0, uv.v0],
        [ hw, -hh, uv.u1, uv.v0],
        [ hw,  hh, uv.u1, uv.v1],
        [-hw,  hh, uv.u0, uv.v1],
      ].map(([lx, ly, u, v]) => [
        cx + (lx * c - ly * s),
        cy + (lx * s + ly * c),
        u,
        v,
      ]);

      const indices = [0, 1, 2, 0, 2, 3];
      let offset = this.spriteCount * 6 * this.floatsPerVertex;
      for (let i = 0; i < 6; i++) {
        const pt = corners[indices[i]];
        this.vertexData[offset++] = pt[0];
        this.vertexData[offset++] = pt[1];
        this.vertexData[offset++] = pt[2];
        this.vertexData[offset++] = pt[3];
        this.vertexData[offset++] = c;
        this.vertexData[offset++] = s;
        this.vertexData[offset++] = r;
        this.vertexData[offset++] = g;
        this.vertexData[offset++] = b;
        this.vertexData[offset++] = a;
      }
      this.spriteCount++;
    }

    updateVisibilityMap(state) {
      const vctx = this.visCtx;
      const vw = this.visCanvas.width;
      const vh = this.visCanvas.height;
      const sx = vw / this.width;
      const sy = vh / this.height;

      vctx.fillStyle = '#383838';
      vctx.fillRect(0, 0, vw, vh);

      if (!state.visibilityPoly || state.visibilityPoly.length < 3) return;

      vctx.save();
      vctx.beginPath();
      state.visibilityPoly.forEach((pt, idx) => {
        if (idx === 0) vctx.moveTo(pt.x * sx, pt.y * sy);
        else vctx.lineTo(pt.x * sx, pt.y * sy);
      });
      vctx.closePath();
      vctx.fillStyle = '#ffffff';
      vctx.fill();
      vctx.restore();

      if (this.isWebGL2 && this.gl) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.visTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.visCanvas);
      }
    }

    render(state) {
      this.updateVisibilityMap(state);
      this.spriteCount = 0;

      const TS = state.tileSize;
      // 1. Floor & Architectural Tiles
      for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
          const cx = c * TS + TS * 0.5;
          const cy = r * TS + TS * 0.5;
          const cell = state.grid[r][c];
          // Base floor everywhere
          this.pushQuad(cx, cy, TS, TS, state.floorTile, 0);

          if (cell === 'E') {
            this.pushQuad(cx, cy, TS, TS, 'elevator_pad', 0);
          } else if (cell === '#') {
            this.pushQuad(cx, cy, TS, TS, 'wall_bulkhead', 0);
          } else if (cell === 'S') {
            this.pushQuad(cx, cy, TS, TS, 'server_rack', 0);
          } else if (cell === 'T') {
            this.pushQuad(cx, cy, TS, TS, 'exec_desk', 0);
          } else if (cell === 'D') {
            // Check orientation from neighboring walls
            const vertWall =
              (r > 0 && state.grid[r - 1][c] === '#') ||
              (r < state.rows - 1 && state.grid[r + 1][c] === '#');
            this.pushQuad(cx, cy, TS, TS, 'door_closed', vertWall ? Math.PI * 0.5 : 0);
          } else if (cell === 'G') {
            const vertGlass =
              (r > 0 && (state.grid[r - 1][c] === '#' || state.grid[r - 1][c] === 'G')) &&
              (r < state.rows - 1 && (state.grid[r + 1][c] === '#' || state.grid[r + 1][c] === 'G'));
            this.pushQuad(cx, cy, TS, TS, 'glass_wall', vertGlass ? Math.PI * 0.5 : 0);
          }
        }
      }

      // 2. Downed Corpses
      state.corpses.forEach((corpse) => {
        this.pushQuad(corpse.x, corpse.y, 56, 56, 'corpse_guard', corpse.angle, 0.85, 0.85, 0.95, 0.92);
      });

      // 3. Active Hostiles
      state.enemies.forEach((en) => {
        if (en.hp <= 0) return;
        const spriteName =
          en.type === 'heavy'
            ? 'guard_heavy'
            : en.type === 'exec'
            ? 'guard_exec'
            : en.type === 'turret'
            ? 'turret_drone'
            : 'guard_patrol';
        const flash = en.hitFlash > 0 ? 1.8 : 1.0;
        const stunTint = en.stunTimer > 0 ? 1.5 : 1.0;
        this.pushQuad(
          en.x,
          en.y,
          58,
          58,
          spriteName,
          en.angle,
          flash,
          flash * stunTint,
          flash * stunTint,
          1.0
        );
      });

      // 4. Operative Player
      if (state.player.hp > 0) {
        const pFlash = state.player.hitFlash > 0 ? 1.8 : 1.0;
        this.pushQuad(
          state.player.x,
          state.player.y,
          58,
          58,
          'operative',
          state.player.angle,
          pFlash,
          pFlash,
          pFlash,
          1.0
        );
      }

      if (this.isWebGL2 && this.gl) {
        this.renderWebGL2(state);
      } else {
        this.renderCanvasFallback(state);
      }

      this.renderVectorFX(state);
    }

    renderWebGL2(state) {
      const gl = this.gl;
      gl.viewport(0, 0, this.width, this.height);
      gl.clearColor(0.02, 0.03, 0.06, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(this.prog);
      gl.bindVertexArray(this.vao);

      gl.uniform2f(this.uLoc.resolution, this.width, this.height);
      gl.uniform2f(this.uLoc.cameraShake, state.shakeX, state.shakeY);
      gl.uniform3fv(this.uLoc.ambient, state.ambient);
      gl.uniform2f(this.uLoc.playerPos, state.player.x, state.player.y);
      gl.uniform2f(
        this.uLoc.aimDir,
        Math.cos(state.player.angle),
        Math.sin(state.player.angle)
      );
      gl.uniform1f(this.uLoc.overclock, state.overclockVisual);
      gl.uniform1f(this.uLoc.time, state.elapsedTime);

      // Pack up to 12 point lights (static level lights + dynamic muzzle/projectile/explosion lights)
      const allLights = state.activeLights.slice(0, 12);
      const posRad = new Float32Array(12 * 4);
      const colArr = new Float32Array(12 * 3);
      for (let i = 0; i < allLights.length; i++) {
        const L = allLights[i];
        posRad[i * 4 + 0] = L.x;
        posRad[i * 4 + 1] = L.y;
        posRad[i * 4 + 2] = L.radius;
        posRad[i * 4 + 3] = L.intensity;
        colArr[i * 3 + 0] = L.color[0];
        colArr[i * 3 + 1] = L.color[1];
        colArr[i * 3 + 2] = L.color[2];
      }
      gl.uniform1i(this.uLoc.lightCount, allLights.length);
      gl.uniform4fv(this.uLoc.lightPosRad, posRad);
      gl.uniform3fv(this.uLoc.lightColor, colArr);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.albedoTex);
      gl.uniform1i(this.uLoc.albedoTex, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.normalTex);
      gl.uniform1i(this.uLoc.normalTex, 1);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.emissiveTex);
      gl.uniform1i(this.uLoc.emissiveTex, 2);

      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.visTex);
      gl.uniform1i(this.uLoc.visTex, 3);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.vertexData.subarray(0, this.spriteCount * 6 * this.floatsPerVertex)
      );
      gl.drawArrays(gl.TRIANGLES, 0, this.spriteCount * 6);
    }

    renderCanvasFallback(state) {
      const ctx = this.ctx2d;
      ctx.save();
      ctx.fillStyle = '#05070e';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.translate(state.shakeX, state.shakeY);

      const drawCell = (cx, cy, w, h, name, angle) => {
        const uv = this.sprites.getUV(name);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.drawImage(
          this.sprites.albedoCanvas,
          uv.px,
          uv.py,
          64,
          64,
          -w * 0.5,
          -h * 0.5,
          w,
          h
        );
        ctx.restore();
      };

      const TS = state.tileSize;
      for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
          const cx = c * TS + TS * 0.5;
          const cy = r * TS + TS * 0.5;
          const cell = state.grid[r][c];
          drawCell(cx, cy, TS, TS, state.floorTile, 0);
          if (cell === 'E') drawCell(cx, cy, TS, TS, 'elevator_pad', 0);
          else if (cell === '#') drawCell(cx, cy, TS, TS, 'wall_bulkhead', 0);
          else if (cell === 'S') drawCell(cx, cy, TS, TS, 'server_rack', 0);
          else if (cell === 'T') drawCell(cx, cy, TS, TS, 'exec_desk', 0);
          else if (cell === 'D') drawCell(cx, cy, TS, TS, 'door_closed', 0);
          else if (cell === 'G') drawCell(cx, cy, TS, TS, 'glass_wall', 0);
        }
      }
      state.corpses.forEach((c) => drawCell(c.x, c.y, 56, 56, 'corpse_guard', c.angle));
      state.enemies.forEach((en) => {
        if (en.hp <= 0) return;
        const name =
          en.type === 'heavy'
            ? 'guard_heavy'
            : en.type === 'exec'
            ? 'guard_exec'
            : en.type === 'turret'
            ? 'turret_drone'
            : 'guard_patrol';
        drawCell(en.x, en.y, 58, 58, name, en.angle);
      });
      if (state.player.hp > 0) {
        drawCell(state.player.x, state.player.y, 58, 58, 'operative', state.player.angle);
      }
      ctx.restore();
    }

    renderVectorFX(state) {
      const ctx = this.fxCtx;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.save();
      ctx.translate(state.shakeX, state.shakeY);

      // 1. Persistent Floor Decals (blood pools, brass casings, shattered cyan glass shards, scorch marks)
      state.decals.forEach((d) => {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.angle);
        ctx.fillStyle = d.color;
        if (d.kind === 'blood') {
          ctx.beginPath();
          ctx.arc(0, 0, d.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-d.size * 0.5, -d.size * 0.25, d.size, d.size * 0.5);
        }
        ctx.restore();
      });

      // 2. Operative Laser Sight Raycast
      if (state.player.hp > 0 && state.laserEnd) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(state.player.x, state.player.y);
        ctx.lineTo(state.laserEnd.x, state.laserEnd.y);
        ctx.strokeStyle = state.overclockActive
          ? 'rgba(0, 245, 255, 0.72)'
          : 'rgba(255, 42, 133, 0.52)';
        ctx.lineWidth = state.overclockActive ? 2.2 : 1.4;
        ctx.stroke();

        // Laser terminal dot
        ctx.beginPath();
        ctx.arc(state.laserEnd.x, state.laserEnd.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = state.overclockActive ? '#00f0ff' : '#ff2a85';
        ctx.fill();
        ctx.restore();
      }

      // 3. High-velocity Bullet Tracers
      state.bullets.forEach((b) => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.028, b.y - b.vy * 0.028);
        ctx.strokeStyle = b.fromPlayer ? b.color : '#ff3b30';
        ctx.lineWidth = b.width || 2.6;
        ctx.shadowColor = b.fromPlayer ? b.color : '#ff3b30';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
      });

      // 4. Dynamic Sparks, Shockwaves & Floating Tactical Callouts
      state.particles.forEach((p) => {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        if (p.ring) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * (1.0 - alpha * 0.7), 0, Math.PI * 2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3.0;
          ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
        }
        ctx.restore();
      });

      // Enemy status indicators (STUNNED / ALERT / HVT)
      state.enemies.forEach((en) => {
        if (en.hp <= 0) return;
        if (en.stunTimer > 0) {
          ctx.fillStyle = '#00f0ff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('⚡ STUNNED', en.x, en.y - 30);
        } else if (en.type === 'exec') {
          ctx.fillStyle = '#ffb800';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('★ HVT EXEC', en.x, en.y - 30);
        } else if (en.alerted) {
          ctx.fillStyle = '#ff2a85';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', en.x, en.y - 28);
        }
      });

      // Floating Score / Kill Callouts
      state.callouts.forEach((c) => {
        const alpha = Math.max(0, c.life / c.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = c.color;
        ctx.fillText(c.text, c.x, c.y);
        ctx.restore();
      });

      // Extraction Prompt when all hostiles are eliminated
      if (state.enemiesRemaining === 0 && state.phase === 'playing') {
        ctx.save();
        ctx.strokeStyle = '#00ff9d';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(
          state.spawnPad.x,
          state.spawnPad.y,
          28 + Math.sin(state.elapsedTime * 7) * 5,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    }
  }

  global.BreachRenderer = BreachRenderer;
})(window);
