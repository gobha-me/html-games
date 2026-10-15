// WebGL2 2.5D Deformable Sand, Ocean Shader & Articulated Soft-Body Athlete Renderer
(function () {
  const VS_SOURCE = `#version 300 es
  in vec2 a_pos;
  out vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    v_uv.y = 1.0 - v_uv.y;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }`;

  const FS_SOURCE = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;

  uniform float u_time;
  uniform int u_theme; // 0 = sunset, 1 = noon, 2 = neon
  uniform vec2 u_res;
  uniform vec4 u_ball; // x, y, z, solarCharge
  uniform vec4 u_players[4]; // x, y, z, team
  uniform vec4 u_trails[24]; // x, y, radius, age(0..1)

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    // Quantize UV slightly for crisp HD-2D modern pixel-art aesthetic
    vec2 pixUv = floor(v_uv * vec2(640.0, 360.0)) / vec2(640.0, 360.0);
    vec2 px = pixUv * u_res;

    // Theme palettes
    vec3 skyTop, skyHorizon, sunColor, oceanDeep, oceanShallow, sandLit, sandShadow, lightDir;
    if (u_theme == 0) {
      // Golden Hour Sunset
      skyTop = vec3(0.14, 0.09, 0.32);
      skyHorizon = vec3(0.98, 0.45, 0.34);
      sunColor = vec3(1.0, 0.84, 0.42);
      oceanDeep = vec3(0.06, 0.19, 0.38);
      oceanShallow = vec3(0.14, 0.56, 0.68);
      sandLit = vec3(0.96, 0.76, 0.54);
      sandShadow = vec3(0.62, 0.38, 0.44);
      lightDir = normalize(vec3(-0.45, -0.52, 0.72));
    } else if (u_theme == 1) {
      // Tropical High Noon
      skyTop = vec3(0.08, 0.46, 0.88);
      skyHorizon = vec3(0.55, 0.88, 0.99);
      sunColor = vec3(1.0, 0.98, 0.86);
      oceanDeep = vec3(0.03, 0.36, 0.68);
      oceanShallow = vec3(0.12, 0.85, 0.82);
      sandLit = vec3(0.99, 0.91, 0.74);
      sandShadow = vec3(0.72, 0.60, 0.48);
      lightDir = normalize(vec3(-0.18, -0.28, 0.94));
    } else {
      // Cyber-Beach Neon Night
      skyTop = vec3(0.03, 0.02, 0.10);
      skyHorizon = vec3(0.36, 0.07, 0.46);
      sunColor = vec3(1.0, 0.18, 0.68);
      oceanDeep = vec3(0.02, 0.06, 0.18);
      oceanShallow = vec3(0.08, 0.52, 0.75);
      sandLit = vec3(0.32, 0.25, 0.48);
      sandShadow = vec3(0.15, 0.10, 0.28);
      lightDir = normalize(vec3(0.35, -0.45, 0.82));
    }

    // 1. Sky & Setting Sun (top 18% of screen)
    if (pixUv.y < 0.18) {
      float t = pixUv.y / 0.18;
      vec3 col = mix(skyTop, skyHorizon, pow(t, 0.75));
      vec2 sunPos = vec2(0.5, 0.11);
      float dSun = length((pixUv - sunPos) * vec2(u_res.x / u_res.y, 1.0));
      if (dSun < 0.065) {
        float stripe = step(0.22, fract(pixUv.y * 95.0 - u_time * 0.4));
        col = mix(col, sunColor, stripe);
      } else {
        col += sunColor * exp(-dSun * 14.0) * 0.45;
      }
      outColor = vec4(col, 1.0);
      return;
    }

    // 2. Animated Ocean & Rolling Shoreline Foam (0.18 .. 0.33)
    float waveLine = 0.315 + 0.012 * sin(pixUv.x * 18.0 + u_time * 2.1) + 0.006 * cos(pixUv.x * 37.0 - u_time * 1.4);
    if (pixUv.y < waveLine) {
      float wt = (pixUv.y - 0.18) / max(0.001, (waveLine - 0.18));
      vec3 water = mix(oceanDeep, oceanShallow, pow(wt, 0.85));
      float caustic = noise(vec2(pixUv.x * 48.0 + u_time * 0.8, pixUv.y * 95.0 - u_time * 1.6));
      water += vec3(0.18, 0.32, 0.38) * step(0.68, caustic) * wt;

      // Sun shimmer column on water
      float shimmerX = abs(pixUv.x - 0.5 + 0.02 * sin(pixUv.y * 80.0 + u_time * 3.0));
      if (shimmerX < 0.08 * (1.0 - wt * 0.5)) {
        water = mix(water, sunColor, 0.55);
      }

      // White/cyan surf foam at wave edge
      if (waveLine - pixUv.y < 0.014) {
        water = mix(water, vec3(0.94, 0.98, 1.0), 0.85);
      }
      outColor = vec4(water, 1.0);
      return;
    }

    // 3. Normal-Mapped Deformable Beach Sand & Court (0.315 .. 1.0)
    // Compute procedural sand ripples + dynamic footprint/dive craters
    float hC = noise(pixUv * vec2(140.0, 220.0)) * 0.18;
    float hX = noise((pixUv + vec2(0.002, 0.0)) * vec2(140.0, 220.0)) * 0.18;
    float hY = noise((pixUv + vec2(0.0, 0.002)) * vec2(140.0, 220.0)) * 0.18;

    float craterDepth = 0.0;
    vec2 craterGrad = vec2(0.0);
    for (int i = 0; i < 24; i++) {
      vec4 tr = u_trails[i];
      if (tr.z <= 0.0) continue;
      vec2 d = px - tr.xy;
      float r = tr.z;
      float dist2 = dot(d, d);
      if (dist2 < r * r * 2.2) {
        float fade = 1.0 - tr.w;
        float normD = sqrt(dist2) / r;
        // Indent center, raised sand rim at normD ~ 0.85
        float profile = (normD < 1.0) ? (-cos(normD * 3.14159) * 0.5 - 0.2) : exp(-(normD - 1.0) * 4.0) * 0.3;
        craterDepth += profile * fade;
        vec2 dir = d / max(1.0, sqrt(dist2));
        craterGrad += dir * sin(min(normD, 1.35) * 3.14159) * fade * 0.85;
      }
    }

    vec3 sandNormal = normalize(vec3((hC - hX) * 4.5 - craterGrad.x, (hC - hY) * 4.5 - craterGrad.y, 1.0));
    float ndl = clamp(dot(sandNormal, vec3(-lightDir.x, -lightDir.y, lightDir.z)), 0.0, 1.0);
    vec3 sandCol = mix(sandShadow, sandLit, smoothstep(0.15, 0.85, ndl));

    // Wet sand dark band near tide line
    float tideWet = clamp(1.0 - (pixUv.y - waveLine) / 0.045, 0.0, 1.0);
    if (tideWet > 0.0) {
      sandCol = mix(sandCol, sandCol * 0.68 + oceanShallow * 0.18, tideWet * 0.75);
      float wetSpec = pow(max(0.0, dot(reflect(lightDir, sandNormal), vec3(0.0, 0.0, 1.0))), 24.0);
      sandCol += sunColor * wetSpec * tideWet * 0.55;
    }

    // Sand sparkle micro-crystals
    float sparkle = hash21(floor(pixUv * vec2(640.0, 360.0)));
    if (sparkle > 0.992) {
      sandCol += sunColor * 0.35;
    }

    // 4. Perspective Court Boundary Lines (Trapezoid)
    // Court world coordinates: X in [220..1060], Y in [295..655]
    float yNorm = (px.y - 295.0) / (655.0 - 295.0);
    if (yNorm >= -0.02 && yNorm <= 1.02) {
      float halfW = mix(340.0, 445.0, clamp(yNorm, 0.0, 1.0));
      float leftX = 640.0 - halfW;
      float rightX = 640.0 + halfW;

      bool onSideline = (abs(px.x - leftX) < 3.2 || abs(px.x - rightX) < 3.2) && yNorm >= 0.0 && yNorm <= 1.0;
      bool onBaseline = (abs(px.y - 295.0) < 3.0 || abs(px.y - 655.0) < 3.5) && px.x >= leftX && px.x <= rightX;
      bool onCenterLine = (abs(px.x - 640.0) < 2.2) && yNorm >= 0.0 && yNorm <= 1.0;

      if (onSideline || onBaseline) {
        sandCol = (u_theme == 2) ? vec3(0.18, 0.95, 1.0) : vec3(0.98, 0.96, 0.90);
      } else if (onCenterLine) {
        sandCol = mix(sandCol, vec3(0.15, 0.12, 0.18), 0.45);
      }
    }

    // 5. Player & Ball Soft Ground Shadows
    for (int i = 0; i < 4; i++) {
      vec4 pl = u_players[i];
      vec2 shOffset = vec2(pl.z * 0.22, pl.z * 0.06);
      vec2 d = (px - (pl.xy + shOffset)) * vec2(1.0, 1.85);
      float r = max(14.0, 26.0 - pl.z * 0.08);
      if (length(d) < r) {
        sandCol *= mix(0.48, 0.85, length(d) / r);
      }
    }

    vec2 bDiff = (px - u_ball.xy) * vec2(1.0, 1.75);
    float bRad = max(8.0, 18.0 - u_ball.z * 0.04);
    if (length(bDiff) < bRad) {
      sandCol *= 0.42;
    }

    if (u_ball.w > 0.5) {
      // Solar Overdrive energy aura on court under ball
      float dGlow = length(px - u_ball.xy);
      sandCol += vec3(1.0, 0.42, 0.15) * exp(-dGlow * 0.035) * 0.45 * u_ball.w;
    }

    outColor = vec4(sandCol, 1.0);
  }`;

  class SunbreakRenderer {
    constructor(glCanvas, hudCanvas) {
      this.glCanvas = glCanvas;
      this.hudCanvas = hudCanvas;
      this.ctx = hudCanvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;

      // Offscreen low-res pixel-art buffer for crisp HD-2D sprite scaling
      this.spriteCanvas = document.createElement('canvas');
      this.spriteCanvas.width = 640;
      this.spriteCanvas.height = 360;
      this.sctx = this.spriteCanvas.getContext('2d');
      this.sctx.imageSmoothingEnabled = false;

      this.theme = 'sunset';
      this.trails = [];
      this.initGL();
    }

    initGL() {
      const gl = this.glCanvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
      this.gl = gl;
      if (!gl) {
        document.getElementById('renderer-pill').textContent = 'Canvas2D HD-Pixel Fallback';
        return;
      }

      const compile = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
          console.error('Shader error:', gl.getShaderInfoLog(sh));
          return null;
        }
        return sh;
      };

      const vs = compile(gl.VERTEX_SHADER, VS_SOURCE);
      const fs = compile(gl.FRAGMENT_SHADER, FS_SOURCE);
      if (!vs || !fs) {
        this.gl = null;
        return;
      }

      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error('Link error:', gl.getProgramInfoLog(prog));
        this.gl = null;
        return;
      }

      this.prog = prog;
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      const loc = gl.getAttribLocation(prog, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      this.uTime = gl.getUniformLocation(prog, 'u_time');
      this.uTheme = gl.getUniformLocation(prog, 'u_theme');
      this.uRes = gl.getUniformLocation(prog, 'u_res');
      this.uBall = gl.getUniformLocation(prog, 'u_ball');
      this.uPlayers = gl.getUniformLocation(prog, 'u_players');
      this.uTrails = gl.getUniformLocation(prog, 'u_trails');
    }

    addSandTrail(x, y, radius = 18) {
      this.trails.unshift({ x, y, radius, age: 0 });
      if (this.trails.length > 24) {
        this.trails.pop();
      }
    }

    updateTrails(dt) {
      for (let i = this.trails.length - 1; i >= 0; i--) {
        this.trails[i].age += dt * 0.085;
        if (this.trails[i].age >= 1.0) {
          this.trails.splice(i, 1);
        }
      }
    }

    rgbCss(arr, mult = 1.0, alpha = 1.0) {
      const r = Math.max(0, Math.min(255, Math.round(arr[0] * 255 * mult)));
      const g = Math.max(0, Math.min(255, Math.round(arr[1] * 255 * mult)));
      const b = Math.max(0, Math.min(255, Math.round(arr[2] * 255 * mult)));
      return alpha < 1.0 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
    }

    renderBackground(time, state) {
      const gl = this.gl;
      if (!gl) {
        // Fallback 2D background if WebGL2 unavailable
        const ctx = this.ctx;
        ctx.fillStyle = '#d89b65';
        ctx.fillRect(0, 0, 1280, 720);
        return;
      }

      gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
      gl.useProgram(this.prog);
      gl.bindVertexArray(this.vao);

      const themeIdx = this.theme === 'noon' ? 1 : this.theme === 'neon' ? 2 : 0;
      gl.uniform1f(this.uTime, time);
      gl.uniform1i(this.uTheme, themeIdx);
      gl.uniform2f(this.uRes, 1280.0, 720.0);

      const b = state.ball;
      gl.uniform4f(this.uBall, b.x, b.y, b.z, b.solarSpike ? 1.0 : 0.0);

      const pArr = new Float32Array(16);
      state.players.forEach((p, idx) => {
        pArr[idx * 4 + 0] = p.x;
        pArr[idx * 4 + 1] = p.y;
        pArr[idx * 4 + 2] = p.z;
        pArr[idx * 4 + 3] = p.team;
      });
      gl.uniform4fv(this.uPlayers, pArr);

      const tArr = new Float32Array(24 * 4);
      for (let i = 0; i < 24; i++) {
        if (i < this.trails.length) {
          tArr[i * 4 + 0] = this.trails[i].x;
          tArr[i * 4 + 1] = this.trails[i].y;
          tArr[i * 4 + 2] = this.trails[i].radius;
          tArr[i * 4 + 3] = this.trails[i].age;
        }
      }
      gl.uniform4fv(this.uTrails, tArr);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /**
     * Renders an articulated 2.5D athlete with real-time normal-mapped lighting,
     * specular sweat/ocean sheen, clinging sand grains, and independent Left/Right
     * bust & glute/hip spring-damper soft-body physics.
     */
    drawAthlete25D(ctx, p, scale = 1.0, isCloseup = false) {
      const prof = p.profile;
      const rig = p.rig;
      const facing = p.facing || (p.team === 0 ? 1 : -1);

      // Convert world court coordinates to pixel-art canvas (or closeup center)
      const cx = isCloseup ? 0 : p.x * 0.5;
      const cy = isCloseup ? 0 : (p.y - p.z * 0.88) * 0.5;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale * (prof.heightScale || 1.0), scale * (prof.heightScale || 1.0));

      // Dive rotation tilt
      if (p.actionState === 'dive') {
        ctx.rotate(facing * 0.92);
      } else if (p.z > 6) {
        ctx.rotate(facing * Math.max(-0.22, Math.min(0.24, -p.vz * 0.0005)));
      }

      const skinBase = this.rgbCss(prof.skinBase);
      const skinShadow = this.rgbCss(prof.skinShadow);
      const skinHighlight = this.rgbCss(prof.skinBase, 1.16);
      const suitMain = this.rgbCss(prof.suitPrimary);
      const suitTrim = this.rgbCss(prof.suitTrim);
      const hairMain = this.rgbCss(prof.hairColor);
      const hairHi = this.rgbCss(prof.hairHighlight);

      // Lighting vector for normal-mapped soft-body specular roll
      const lightX = this.theme === 'neon' ? 0.45 : -0.45;
      const lightY = -0.62;
      const wet = rig.wetness;

      // 1. Verlet Hair Ponytail (drawn behind shoulders)
      ctx.lineCap = 'round';
      for (let i = 0; i < rig.hairNodes.length - 1; i++) {
        const n0 = rig.hairNodes[i];
        const n1 = rig.hairNodes[i + 1];
        ctx.strokeStyle = i === 0 ? hairHi : hairMain;
        ctx.lineWidth = Math.max(2.2, 6.2 - i * 0.95);
        ctx.beginPath();
        ctx.moveTo(n0.x, n0.y - 22);
        ctx.lineTo(n1.x, n1.y - 22);
        ctx.stroke();
      }

      // Stride & jump knee bend animation
      const stride = p.z > 2 ? 0.55 : Math.sin(rig.stridePhase) * (Math.hypot(p.vx, p.vy) > 15 ? 1.0 : 0.08);
      const squat = p.actionState === 'dig' ? 3.5 : 0;

      // 2. Back Leg & Front Leg (Toned Thighs, Calves, Sand-Dusted Shins)
      const drawLeg = (hipOffsetX, phaseSign, isFront) => {
        const kneeX = hipOffsetX + phaseSign * stride * 5.5 + facing * 1.2;
        const kneeY = -12 + squat * 0.5;
        const footX = hipOffsetX - phaseSign * stride * 6.5;
        const footY = 0;

        // Thigh
        ctx.strokeStyle = isFront ? skinBase : skinShadow;
        ctx.lineWidth = 5.6 * (prof.hipScale || 1.0);
        ctx.beginPath();
        ctx.moveTo(hipOffsetX, -22 + squat);
        ctx.lineTo(kneeX, kneeY);
        ctx.stroke();

        // Specular thigh sheen
        if (isFront && wet > 0.25) {
          ctx.strokeStyle = `rgba(255, 248, 230, ${0.28 * wet})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(hipOffsetX + facing * 1.1, -21 + squat);
          ctx.lineTo(kneeX + facing * 1.1, kneeY - 1);
          ctx.stroke();
        }

        // Calf & Ankle
        ctx.strokeStyle = isFront ? skinBase : skinShadow;
        ctx.lineWidth = 4.1;
        ctx.beginPath();
        ctx.moveTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
        ctx.stroke();

        // Clinging golden sand on lower legs after diving
        if (rig.sandCoat > 0.12) {
          ctx.strokeStyle = `rgba(244, 206, 142, ${Math.min(0.75, rig.sandCoat * 0.8)})`;
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo((kneeX + footX) * 0.5, (kneeY + footY) * 0.5);
          ctx.lineTo(footX, footY);
          ctx.stroke();
        }

        // Bare foot / ankle wrap
        ctx.fillStyle = suitTrim;
        ctx.fillRect(footX - 2, footY - 2.5, 4.5, 2.2);
      };

      drawLeg(-facing * 2.6, -1, false);

      // 3. Pelvis, Hips & Independent Glute/Hip Soft-Body Spring Nodes
      const hipY = -23.5 + squat;
      const hL = rig.hipL;
      const hR = rig.hipR;
      const hipRad = 4.6 * (prof.hipScale || 1.0);

      // Back glute/hip curve (deforms with hipL)
      const gluteX = -facing * 3.4 + hL.x * 0.35;
      const gluteY = hipY + 1.0 + hL.y * 0.38;
      ctx.fillStyle = skinShadow;
      ctx.beginPath();
      ctx.arc(gluteX, gluteY, hipRad, 0, Math.PI * 2);
      ctx.fill();

      // Front hip curve (deforms with hipR)
      const frontHipX = facing * 2.2 + hR.x * 0.32;
      const frontHipY = hipY + 0.6 + hR.y * 0.35;
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.arc(frontHipX, frontHipY, hipRad * 0.96, 0, Math.PI * 2);
      ctx.fill();

      // Glute specular sun highlight shifted by spring velocity
      ctx.fillStyle = `rgba(255, 245, 225, ${0.34 * wet})`;
      ctx.beginPath();
      ctx.arc(
        gluteX - lightX * 1.4 + hL.x * 0.15,
        gluteY + lightY * 1.4 + hL.y * 0.15,
        hipRad * 0.42,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // High-cut Bikini Bottom & Side Ties
      ctx.fillStyle = suitMain;
      ctx.beginPath();
      ctx.moveTo(-5.2, hipY - 2.2 + hL.y * 0.2);
      ctx.lineTo(5.2, hipY - 2.2 + hR.y * 0.2);
      ctx.lineTo(facing * 2.6, hipY + 4.2 + hR.y * 0.25);
      ctx.lineTo(-facing * 3.0, hipY + 3.8 + hL.y * 0.25);
      ctx.closePath();
      ctx.fill();

      // Bikini hip tie ribbon flutter
      ctx.strokeStyle = suitTrim;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(0, hipY - 1.8);
      ctx.lineTo(-facing * 3.5 + hL.x * 0.6, hipY + 2.5 + Math.abs(hL.y) * 0.5);
      ctx.stroke();

      // Front Leg drawn over back hip
      drawLeg(facing * 2.4, 1, true);

      // 4. Sculpted Hourglass Waist, Midriff & Ribcage
      const waistY = -30.5 + squat * 0.7;
      const chestY = -37.2 + squat * 0.5;

      // Back arm (drawn behind ribcage)
      const swingAngle =
        p.actionState === 'spike'
          ? -2.35 + p.actionTimer * 9.5
          : p.actionState === 'set'
          ? -1.85
          : p.actionState === 'dig'
          ? 0.72
          : Math.sin(rig.stridePhase) * 0.55;

      ctx.strokeStyle = skinShadow;
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(-facing * 3.2, chestY);
      ctx.lineTo(
        -facing * 3.2 + facing * Math.sin(swingAngle + 0.5) * 11,
        chestY + Math.cos(swingAngle + 0.5) * 11
      );
      ctx.stroke();

      // Midriff & Ribcage silhouette
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.moveTo(-4.2, hipY - 1.5);
      ctx.quadraticCurveTo(-3.1, waistY, -5.2, chestY);
      ctx.lineTo(5.2, chestY);
      ctx.quadraticCurveTo(3.1, waistY, 4.2, hipY - 1.5);
      ctx.closePath();
      ctx.fill();

      // Toned abdominal line & warm subsurface rim shadow
      ctx.strokeStyle = skinShadow;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(facing * 1.1, chestY + 2.5);
      ctx.lineTo(facing * 0.9, waistY + 2.2);
      ctx.stroke();

      // 5. Coupled Left/Right Bust Soft-Body Oscillators + Dynamic Normal-Lit Specular Shader
      const bScale = prof.bustScale || 1.1;
      const baseBustR = 3.95 * bScale;

      // Position Left and Right bust hemispheres in 2.5D 3/4 view
      const bBack = facing > 0 ? rig.bustL : rig.bustR;
      const bFront = facing > 0 ? rig.bustR : rig.bustL;

      const bxBack = facing * 3.4 + bBack.x * 0.42;
      const byBack = chestY + 2.4 + bBack.y * 0.48;

      const bxFront = facing * 1.1 + bFront.x * 0.42;
      const byFront = chestY + 2.7 + bFront.y * 0.48;

      // Halterneck straps connecting shoulders to dynamic bust nodes
      ctx.strokeStyle = suitTrim;
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.moveTo(0, chestY - 3.2);
      ctx.lineTo(bxBack, byBack - baseBustR * 0.55);
      ctx.moveTo(-facing * 1.2, chestY - 3.2);
      ctx.lineTo(bxFront, byFront - baseBustR * 0.55);
      ctx.stroke();

      const renderSoftHemisphere = (bx, by, node, radius, isFrontSphere) => {
        // Under-bust ambient occlusion shadow (shifts and compresses with vertical bounce)
        const aoStretch = Math.max(0.5, 1.0 + node.y * 0.08);
        ctx.fillStyle = skinShadow;
        ctx.beginPath();
        ctx.arc(bx, by + 1.15 * aoStretch, radius * 0.98, 0, Math.PI * 2);
        ctx.fill();

        // Main skin hemisphere
        ctx.fillStyle = isFrontSphere ? skinBase : skinHighlight;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fill();

        // Bikini cup (covers lower/outer 68% of hemisphere, leaving upper cleavage & normal highlight)
        ctx.fillStyle = suitMain;
        ctx.beginPath();
        ctx.arc(bx - facing * 0.35, by + 0.55, radius * 0.94, -0.15, Math.PI + 0.35);
        ctx.closePath();
        ctx.fill();

        // Trim band along bikini cup edge
        ctx.strokeStyle = suitTrim;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(bx, by, radius * 0.92, 0.15, Math.PI - 0.15);
        ctx.stroke();

        // Real-time normal-mapped upper skin slope & wet specular highlight
        // As node.y moves up/down, normal tilts toward/away from key light
        const normalTiltX = -node.x * 0.18 - lightX * 1.15;
        const normalTiltY = -node.y * 0.18 + lightY * 1.25;
        const specIntensity = Math.max(0.22, Math.min(0.95, 0.45 + wet * 0.45 - node.y * 0.04));

        ctx.fillStyle = `rgba(255, 248, 232, ${specIntensity})`;
        ctx.beginPath();
        ctx.arc(
          bx + normalTiltX + facing * 0.6,
          by + normalTiltY - radius * 0.28,
          radius * 0.34,
          0,
          Math.PI * 2
        );
        ctx.fill();
      };

      // Draw far hemisphere first, cleavage shadow crease in between, then near hemisphere
      renderSoftHemisphere(bxBack, byBack, bBack, baseBustR * 0.94, false);

      // Dynamic cleavage shadow line between the two independent oscillators
      ctx.strokeStyle = skinShadow;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo((bxBack + bxFront) * 0.5, Math.min(byBack, byFront) - baseBustR * 0.55);
      ctx.lineTo((bxBack + bxFront) * 0.5 + facing * 0.7, Math.max(byBack, byFront) + baseBustR * 0.25);
      ctx.stroke();

      renderSoftHemisphere(bxFront, byFront, bFront, baseBustR, true);

      // 6. Neck, Head, Hair Bangs & Sun Visor
      const headY = chestY - 7.8;
      ctx.fillStyle = skinShadow;
      ctx.fillRect(-1.6, chestY - 4.2, 3.2, 3.8);

      // Head oval
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.arc(facing * 0.6, headY, 5.1, 0, Math.PI * 2);
      ctx.fill();

      // Hair crown & bangs
      ctx.fillStyle = hairMain;
      ctx.beginPath();
      ctx.arc(0, headY - 0.8, 5.4, Math.PI * 0.85, Math.PI * 2.15);
      ctx.fill();

      // Translucent Arcade Sun Visor
      ctx.fillStyle = this.rgbCss(prof.visorColor, 1.0, 0.88);
      ctx.beginPath();
      ctx.moveTo(facing * 1.2, headY - 2.2);
      ctx.lineTo(facing * 7.4, headY - 1.1);
      ctx.lineTo(facing * 2.2, headY + 0.2);
      ctx.closePath();
      ctx.fill();

      // Eye highlight
      ctx.fillStyle = '#181425';
      ctx.fillRect(facing * 2.4, headY - 0.6, 1.4, 1.6);

      // 7. Foreground Articulated Arm (Dig / Set / Spike Whip)
      const frontArmX = -facing * 1.6;
      const frontArmY = chestY + 0.6;
      const handX = frontArmX + facing * Math.sin(swingAngle) * 12.5;
      const handY = frontArmY + Math.cos(swingAngle) * 12.5;

      ctx.strokeStyle = skinBase;
      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.moveTo(frontArmX, frontArmY);
      ctx.lineTo(handX, handY);
      ctx.stroke();

      // Wristband
      ctx.fillStyle = suitMain;
      ctx.beginPath();
      ctx.arc(handX, handY, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    drawNetAndBall(sctx, state, time) {
      // Perspective Net at X = 320 (half of 640 internal HD-2D width)
      const netX = 320;
      const netTopY = 116;
      const netBotY = 328;

      // Net shadow on sand
      sctx.strokeStyle = 'rgba(15, 10, 28, 0.38)';
      sctx.lineWidth = 5;
      sctx.beginPath();
      sctx.moveTo(netX + 12, 148);
      sctx.lineTo(netX + 12, netBotY);
      sctx.stroke();

      // Net mesh grid
      sctx.fillStyle = 'rgba(22, 30, 48, 0.42)';
      sctx.fillRect(netX - 2, netTopY, 4, netBotY - netTopY - 18);

      for (let y = netTopY + 4; y < netBotY - 18; y += 6) {
        sctx.fillStyle = 'rgba(230, 242, 255, 0.35)';
        sctx.fillRect(netX - 2, y, 4, 1);
      }

      // Top net tape (flashes neon in night mode or when ball grazes cord)
      sctx.fillStyle = this.theme === 'neon' ? '#ff36b5' : '#ffffff';
      sctx.fillRect(netX - 3, netTopY - 2, 6, netBotY - netTopY - 18);
      sctx.fillStyle = '#ff477e';
      sctx.fillRect(netX - 4, netTopY - 4, 8, 6);
      sctx.fillRect(netX - 4, netBotY - 6, 8, 8);

      // Ball landing target reticle on sand
      if (state.ballLanding) {
        const lx = state.ballLanding.x * 0.5;
        const ly = state.ballLanding.y * 0.5;
        const pulse = 1.0 + 0.2 * Math.sin(time * 14.0);
        sctx.strokeStyle = state.ball.solarSpike ? '#ff477e' : '#2ce6ff';
        sctx.lineWidth = 1.5;
        sctx.beginPath();
        sctx.ellipse(lx, ly, 11 * pulse, 6 * pulse, 0, 0, Math.PI * 2);
        sctx.stroke();

        sctx.beginPath();
        sctx.moveTo(lx - 5, ly);
        sctx.lineTo(lx + 5, ly);
        sctx.moveTo(lx, ly - 3);
        sctx.lineTo(lx, ly + 3);
        sctx.stroke();
      }

      // Ball trail & 2.5D Volleyball
      const b = state.ball;
      const bx = b.x * 0.5;
      const by = (b.y - b.z * 0.88) * 0.5;

      if (b.trail && b.trail.length > 1) {
        for (let i = 0; i < b.trail.length; i++) {
          const tr = b.trail[i];
          const alpha = ((i + 1) / b.trail.length) * (b.solarSpike ? 0.65 : 0.28);
          sctx.fillStyle = b.solarSpike ? `rgba(255, 92, 54, ${alpha})` : `rgba(44, 230, 255, ${alpha})`;
          sctx.beginPath();
          sctx.arc(tr.x * 0.5, (tr.y - tr.z * 0.88) * 0.5, 4.5 + (i / b.trail.length) * 3.5, 0, Math.PI * 2);
          sctx.fill();
        }
      }

      // Volleyball sphere with rotating panels
      const rad = 8.2;
      sctx.save();
      sctx.translate(bx, by);
      sctx.rotate(b.spinAngle || 0);

      sctx.fillStyle = b.solarSpike ? '#ffde59' : '#f8fafc';
      sctx.beginPath();
      sctx.arc(0, 0, rad, 0, Math.PI * 2);
      sctx.fill();

      // Tri-color arcade volleyball panels
      sctx.strokeStyle = '#ff477e';
      sctx.lineWidth = 2.2;
      sctx.beginPath();
      sctx.arc(0, 0, rad * 0.72, -0.5, 1.4);
      sctx.stroke();

      sctx.strokeStyle = '#2ce6ff';
      sctx.beginPath();
      sctx.arc(0, 0, rad * 0.72, 2.0, 3.8);
      sctx.stroke();

      // Specular highlight on ball
      sctx.fillStyle = 'rgba(255,255,255,0.85)';
      sctx.beginPath();
      sctx.arc(-2.5, -2.5, 2.2, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();
    }

    renderScene(time, state) {
      this.renderBackground(time, state);

      const sctx = this.sctx;
      sctx.clearRect(0, 0, 640, 360);

      // Sort athletes by Y depth for proper painter's order
      const sorted = [...state.players].sort((a, b) => a.y - b.y);

      // Draw underfoot player indicators (P1..P4 / Partner Target)
      sorted.forEach((p) => {
        const px = p.x * 0.5;
        const py = p.y * 0.5;
        sctx.save();
        if (p.controllerType !== 'ai') {
          sctx.strokeStyle = p.team === 0 ? '#ffb84d' : '#2ce6ff';
          sctx.lineWidth = 1.8;
          sctx.beginPath();
          sctx.ellipse(px, py, 13, 6.5, 0, 0, Math.PI * 2);
          sctx.stroke();
        } else if (p.isPartnerTarget) {
          sctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          sctx.setLineDash([3, 3]);
          sctx.beginPath();
          sctx.ellipse(px, py, 11, 5.5, 0, 0, Math.PI * 2);
          sctx.stroke();
        }
        sctx.restore();
      });

      // Draw back-row athletes, net/ball, front-row athletes
      sorted.forEach((p) => {
        this.drawAthlete25D(sctx, p, 1.15, false);
      });

      this.drawNetAndBall(sctx, state, time);

      // Blit crisp HD-2D pixel-art layer onto 1280x720 HUD canvas
      const ctx = this.ctx;
      ctx.clearRect(0, 0, 1280, 720);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.spriteCanvas, 0, 0, 1280, 720);

      // Draw Player Tags & Timing Callouts on crisp 1280x720 overlay
      state.players.forEach((p) => {
        const sx = p.x;
        const sy = p.y - p.z * 0.88 - 68;
        ctx.font = '800 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        const label = p.badgeText || p.profile.name;
        ctx.fillStyle = 'rgba(6, 12, 24, 0.78)';
        const w = ctx.measureText(label).width + 10;
        ctx.fillRect(sx - w * 0.5, sy - 11, w, 15);
        ctx.fillStyle = p.controllerType !== 'ai' ? '#ffb84d' : '#9ab0c9';
        ctx.fillText(label, sx, sy);
      });

      // Floating hit-timing / super-spike callouts
      state.callouts.forEach((c) => {
        ctx.save();
        ctx.font = '900 18px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = c.color || '#ffb84d';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 8;
        ctx.fillText(c.text, c.x, c.y);
        ctx.restore();
      });

      // Picture-in-Picture / Cut-In Close-Up Physics & Pose Cam Window
      if (state.poseCamActive || state.cutInTimer > 0) {
        this.renderPoseCamOverlay(ctx, state, time);
      }
    }

    renderPoseCamOverlay(ctx, state, time) {
      const focusPlayer = state.players[state.poseCamPlayerIdx || 0] || state.players[0];
      const rig = focusPlayer.rig;
      const prof = focusPlayer.profile;

      const cardW = state.poseCamActive ? 410 : 320;
      const cardH = state.poseCamActive ? 360 : 250;
      const cardX = state.poseCamActive ? 845 : 935;
      const cardY = 64;

      ctx.save();
      // Glass card background
      ctx.fillStyle = 'rgba(8, 16, 30, 0.90)';
      ctx.strokeStyle = prof.signatureColor || '#ffb84d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();

      // Header
      ctx.fillStyle = prof.signatureColor || '#ffb84d';
      ctx.font = '900 13px Inter, sans-serif';
      ctx.textAlign = 'left';
      const title = state.poseCamActive
        ? `POSE & SOFT-BODY TELEMETRY // ${prof.name}`
        : `${prof.name} — ${state.cutInLabel || prof.signatureMove}`;
      ctx.fillText(title, cardX + 14, cardY + 22);

      // Render zoomed 2.5D character into sprite buffer region & blit crisp
      this.sctx.clearRect(0, 0, 180, 180);
      this.sctx.save();
      this.sctx.translate(88, 145);
      this.drawAthlete25D(this.sctx, focusPlayer, 2.75, true);
      this.sctx.restore();

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        this.spriteCanvas,
        0,
        0,
        180,
        180,
        cardX + 12,
        cardY + 28,
        cardH - 36,
        cardH - 36
      );

      // Live Spring-Damper Telemetry Bars & Phase Plot on right side of card
      const tx = cardX + cardW - 155;
      let ty = cardY + 48;
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillStyle = '#d6e4f5';
      ctx.fillText(`Profile: ${state.physicsPreset.toUpperCase()}`, tx, ty);
      ty += 18;
      ctx.fillText(`Wetness Sheen: ${Math.round(rig.wetness * 100)}%`, tx, ty);
      ty += 16;
      ctx.fillText(`Sand Cling: ${Math.round(rig.sandCoat * 100)}%`, tx, ty);
      ty += 22;

      // 2D Oscillator Phase Reticle (Bust L/R & Hip L/R)
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(tx, ty, 130, 82);
      ctx.fillStyle = '#9ab0c9';
      ctx.font = '700 10px Inter, sans-serif';
      ctx.fillText('L/R SPRING PHASE', tx + 6, ty + 13);

      const midX = tx + 65;
      const midY = ty + 48;
      // Bust L dot
      ctx.fillStyle = '#ff477e';
      ctx.beginPath();
      ctx.arc(midX - 18 + rig.bustL.x * 2.4, midY + rig.bustL.y * 2.4, 5, 0, Math.PI * 2);
      ctx.fill();
      // Bust R dot
      ctx.fillStyle = '#ffb84d';
      ctx.beginPath();
      ctx.arc(midX + 18 + rig.bustR.x * 2.4, midY + rig.bustR.y * 2.4, 5, 0, Math.PI * 2);
      ctx.fill();
      // Hip L/R dots
      ctx.fillStyle = '#2ce6ff';
      ctx.beginPath();
      ctx.arc(midX + rig.hipL.x * 2.2, midY + 16 + rig.hipL.y * 2.2, 4, 0, Math.PI * 2);
      ctx.fill();

      if (state.poseCamActive) {
        ty += 102;
        ctx.fillStyle = '#ffb84d';
        ctx.font = '800 10px Inter, sans-serif';
        ctx.fillText('[1-6] Switch Athlete', tx, ty);
        ctx.fillText('[SPACE] Jump Impulse', tx, ty + 15);
        ctx.fillText('[K] Spike Torque Whip', tx, ty + 30);
        ctx.fillText('[L] Sand Dive & Splash', tx, ty + 45);
      }

      ctx.restore();
    }
  }

  window.SunbreakRenderer = SunbreakRenderer;
})();
