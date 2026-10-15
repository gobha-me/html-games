// WebGL2 2.5D Deformable Sand, Ocean Shader, Keyed Pose-Morph Soft-Body Athlete & Normal-Lit Volleyball Renderer
(function () {
  const BG_VS_SOURCE = `#version 300 es
  in vec2 a_pos;
  out vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    v_uv.y = 1.0 - v_uv.y;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }`;

  const BG_FS_SOURCE = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;

  uniform float u_time;
  uniform int u_theme; // 0 = sunset, 1 = noon, 2 = neon
  uniform vec2 u_res;
  uniform vec4 u_ball; // x, y, z, fireLevel (0..2)
  uniform vec4 u_players[4]; // x, y, z, onFire (0..1)
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

    // 5. Player & Ball Soft Ground Shadows + NBA Jam "ON FIRE" Ground Scorch Aura
    for (int i = 0; i < 4; i++) {
      vec4 pl = u_players[i];
      vec2 shOffset = vec2(pl.z * 0.22, pl.z * 0.06);
      vec2 d = (px - (pl.xy + shOffset)) * vec2(1.0, 1.85);
      float r = max(14.0, 26.0 - pl.z * 0.08);
      float lenD = length(d);
      if (lenD < r) {
        sandCol *= mix(0.42, 0.88, lenD / r);
      }
      if (pl.w > 0.5 && lenD < r * 1.45) {
        // NBA Jam ON FIRE pulsing ember ring under feet
        float fireRing = exp(-abs(lenD - r * 0.85) * 0.18);
        sandCol += vec3(1.0, 0.38, 0.08) * fireRing * 0.65;
      }
    }

    vec2 bDiff = (px - u_ball.xy) * vec2(1.0, 1.75);
    float bRad = max(8.0, 20.0 - u_ball.z * 0.045);
    if (length(bDiff) < bRad) {
      sandCol *= 0.38;
    }

    if (u_ball.w > 0.2) {
      float dGlow = length(px - u_ball.xy);
      sandCol += vec3(1.0, 0.38, 0.12) * exp(-dGlow * 0.032) * 0.55 * u_ball.w;
    }

    outColor = vec4(sandCol, 1.0);
  }`;

  // WebGL2 Keyed Pose-Morph Soft-Body UV-Warped & Normal-Lit Character Sprite Shader
  const CHAR_VS_SOURCE = `#version 300 es
  in vec2 a_uv;
  out vec2 v_uv;
  uniform vec2 u_center; // pixel center in [0..1280, 0..720]
  uniform vec2 u_size;   // width, height in screen pixels (includes squash/stretch scale)
  uniform float u_flip;  // 1.0 or -1.0
  uniform float u_rot;   // radians
  uniform float u_shearX; // keyed transition horizontal shear
  uniform vec2 u_res;    // 1280, 720

  void main() {
    float footDist = 0.93 - a_uv.y;
    vec2 local = vec2(
      (a_uv.x - 0.5 + footDist * u_shearX) * u_size.x,
      (a_uv.y - 0.93) * u_size.y
    );
    float c = cos(u_rot);
    float s = sin(u_rot);
    vec2 rotPos = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
    vec2 screenPx = u_center + rotPos;

    vec2 ndc = (screenPx / u_res) * 2.0 - 1.0;
    ndc.y = -ndc.y;
    gl_Position = vec4(ndc, 0.0, 1.0);

    // Flip U horizontally when facing left (-1.0)
    v_uv = vec2(u_flip < 0.0 ? (1.0 - a_uv.x) : a_uv.x, a_uv.y);
  }`;

  const CHAR_FS_SOURCE = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;

  uniform sampler2D u_texAlbedo;
  uniform sampler2D u_texNormal;
  uniform sampler2D u_texAlbedoPrev;
  uniform float u_poseBlend; // 0.0 = pure current pose, >0 = morphing from previous keyframe pose
  uniform vec2 u_morphVec;   // anatomical correspondent UV shift from Pose A -> Pose B

  // 5 Anatomical UV Pin Zones: [u, v, radius] in unflipped texture UV space
  uniform vec3 u_zoneBustL;
  uniform vec3 u_zoneBustR;
  uniform vec3 u_zoneHipL;
  uniform vec3 u_zoneHipR;
  uniform vec3 u_zoneHair;

  // 5 Live Spring-Damper UV Displacement vectors + rest proportion scales
  uniform vec2 u_dispBustL;
  uniform vec2 u_dispBustR;
  uniform vec2 u_dispHipL;
  uniform vec2 u_dispHipR;
  uniform vec2 u_dispHair;
  uniform vec2 u_propScale; // x = bustScale, y = hipScale

  // Per-athlete palette customization & lighting
  uniform vec3 u_suitColor;
  uniform vec3 u_trimColor;
  uniform vec3 u_hairColor;
  uniform vec3 u_skinTint;
  uniform vec3 u_lightDir;
  uniform vec3 u_sunColor;
  uniform float u_wetness;
  uniform float u_sandCoat;
  uniform float u_flip;
  uniform float u_alpha;
  uniform float u_onFire; // NBA Jam ON FIRE rim aura (0..1)

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  void applySoftZone(
    vec2 uv,
    vec3 zone,
    vec2 disp,
    float scaleBoost,
    inout vec2 warpedUv,
    inout vec2 normalTilt,
    out float zoneWeight
  ) {
    vec2 d = (uv - zone.xy) * vec2(1.0, 1.22);
    float r = max(0.015, zone.z);
    float r2 = dot(d, d) / (r * r);
    if (r2 < 3.2) {
      float w = exp(-r2 * 1.45);
      zoneWeight = w;
      warpedUv -= disp * w;
      warpedUv -= (uv - zone.xy) * (scaleBoost - 1.0) * 0.34 * w;
      normalTilt += disp * 16.5 * w - (d / r) * (scaleBoost - 1.0) * 0.45 * w;
    } else {
      zoneWeight = 0.0;
    }
  }

  void main() {
    vec2 warpedUv = v_uv;
    vec2 normalTilt = vec2(0.0);
    float wBL = 0.0, wBR = 0.0, wHL = 0.0, wHR = 0.0, wHair = 0.0;

    float bBoost = u_propScale.x;
    float hBoost = u_propScale.y;

    applySoftZone(v_uv, u_zoneBustL, u_dispBustL, bBoost, warpedUv, normalTilt, wBL);
    applySoftZone(v_uv, u_zoneBustR, u_dispBustR, bBoost, warpedUv, normalTilt, wBR);
    applySoftZone(v_uv, u_zoneHipL,  u_dispHipL,  hBoost, warpedUv, normalTilt, wHL);
    applySoftZone(v_uv, u_zoneHipR,  u_dispHipR,  hBoost, warpedUv, normalTilt, wHR);
    applySoftZone(v_uv, u_zoneHair,  u_dispHair,  1.0,    warpedUv, normalTilt, wHair);

    // Keyed Pose A -> Pose B Correspondent UV Morphing:
    // Upper torso/arms warp smoothly along u_morphVec during keyframe transitions
    float upperMask = smoothstep(0.75, 0.20, v_uv.y);
    vec2 uvB = warpedUv + u_morphVec * (1.0 - u_poseBlend) * upperMask;
    vec2 uvA = warpedUv - u_morphVec * u_poseBlend * upperMask;

    vec4 colB = (uvB.x >= 0.0 && uvB.x <= 1.0 && uvB.y >= 0.0 && uvB.y <= 1.0)
      ? texture(u_texAlbedo, uvB)
      : vec4(0.0);
    vec4 texCol = colB;

    if (u_poseBlend < 0.99 && uvA.x >= 0.0 && uvA.x <= 1.0 && uvA.y >= 0.0 && uvA.y <= 1.0) {
      vec4 colA = texture(u_texAlbedoPrev, uvA);
      // Premultiplied-alpha keyframe morph blend
      float aMix = mix(colA.a, colB.a, u_poseBlend);
      if (aMix > 0.05) {
        vec3 rgbMix = (colA.rgb * colA.a * (1.0 - u_poseBlend) + colB.rgb * colB.a * u_poseBlend) / max(0.001, aMix);
        texCol = vec4(rgbMix, aMix);
      }
    }

    if (texCol.a < 0.12) {
      discard;
    }

    vec3 col = texCol.rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));

    // Classify source pixel material using exact measured RGB characteristics:
    float redOverGreen = col.r - col.g;
    float yellowness = min(col.r, col.g) - col.b;

    bool isHairEnvelope =
      warpedUv.y < 0.26 ||
      wHair > 0.08 ||
      (warpedUv.x < 0.44 && warpedUv.y < 0.64);

    bool isHairPixel = isHairEnvelope && (col.r > 0.22) && (col.g < 0.22) && (redOverGreen > 0.20);
    bool isBikiniPixel =
      !isHairEnvelope &&
      (col.r > 0.56) &&
      (redOverGreen > 0.48) &&
      (col.g <= col.b * 1.42);

    if (isHairPixel) {
      col = u_hairColor * (0.42 + lum * 1.35);
    } else if (isBikiniPixel) {
      col = u_suitColor * (0.38 + lum * 1.18);
    } else if (yellowness > 0.26 && col.r > 0.72 && col.g > 0.58 && (wBL + wBR + wHL + wHR) > 0.05) {
      col = mix(col, u_trimColor * (0.55 + lum * 0.75), 0.75);
    } else if (col.r > col.g && col.g > col.b && lum > 0.22) {
      col *= mix(vec3(1.0), u_skinTint / vec3(0.98, 0.78, 0.67), 0.55);
    }

    // Sample 2.5D Normal Map & perturb with live soft-body spring tilt
    vec3 nSample = texture(u_texNormal, clamp(uvB, 0.0, 1.0)).xyz * 2.0 - 1.0;
    nSample.x *= u_flip;
    vec3 N = normalize(vec3(
      nSample.x + normalTilt.x * u_flip,
      nSample.y + normalTilt.y,
      max(0.25, nSample.z)
    ));

    vec3 L = normalize(vec3(-u_lightDir.x, -u_lightDir.y, u_lightDir.z));
    float ndl = clamp(dot(N, L), 0.0, 1.0);

    float softZoneMask = clamp(wBL + wBR + wHL + wHR, 0.0, 1.0);
    float bounceShade = 0.88 + 0.24 * ndl;
    col *= mix(0.94 + 0.12 * ndl, bounceShade, softZoneMask);

    // Wetness / sweat specular highlights on curved anatomical surfaces
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 H = normalize(L + V);
    float specPower = mix(18.0, 36.0, u_wetness);
    float spec = pow(max(0.0, dot(N, H)), specPower);
    float specMask = (0.35 + 0.65 * softZoneMask) * (0.25 + 0.75 * u_wetness);
    col += u_sunColor * spec * specMask * 0.68;

    // Clinging golden beach sand grains on lower body & knees/hips after diving
    if (u_sandCoat > 0.08 && warpedUv.y > 0.46) {
      vec2 grainCell = floor(warpedUv * vec2(128.0, 160.0));
      float hGrain = hash21(grainCell);
      float lowerMask = smoothstep(0.46, 0.78, warpedUv.y);
      if (hGrain > (1.0 - u_sandCoat * 0.38 * lowerMask) && lum > 0.18) {
        col = mix(col, vec3(0.96, 0.80, 0.55), 0.72);
      }
    }

    // NBA Jam "ON FIRE" Rim Glow & Turbo Ghost Tint
    if (u_onFire > 0.05) {
      float rim = 1.0 - max(0.0, N.z);
      col += vec3(1.0, 0.42, 0.08) * pow(rim, 1.8) * u_onFire * 0.85;
    }

    outColor = vec4(clamp(col, 0.0, 1.0), texCol.a * u_alpha);
  }`;

  // WebGL2 Normal-Lit 32-Bit Pixel-Art Volleyball Shader (with Spin, Squash/Stretch & Fire Aura)
  const BALL_VS_SOURCE = `#version 300 es
  in vec2 a_uv;
  out vec2 v_uv;
  uniform vec2 u_center;
  uniform vec2 u_size;
  uniform float u_rot;
  uniform vec2 u_res;

  void main() {
    vec2 local = (a_uv - 0.5) * u_size;
    float c = cos(u_rot);
    float s = sin(u_rot);
    vec2 rotPos = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
    vec2 screenPx = u_center + rotPos;
    vec2 ndc = (screenPx / u_res) * 2.0 - 1.0;
    ndc.y = -ndc.y;
    gl_Position = vec4(ndc, 0.0, 1.0);
    v_uv = a_uv;
  }`;

  const BALL_FS_SOURCE = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;

  uniform sampler2D u_texAlbedo;
  uniform sampler2D u_texNormal;
  uniform float u_spin;
  uniform vec3 u_lightDir;
  uniform vec3 u_sunColor;
  uniform float u_fireLevel; // 0 = normal, 1 = solar spike, 2 = NBA Jam ON FIRE!
  uniform float u_alpha;

  void main() {
    // Rotate sampling UVs around (0.5, 0.5) by u_spin while keeping spherical lighting in screen space!
    vec2 d = v_uv - 0.5;
    float r = length(d);
    if (r > 0.48) discard;

    float c = cos(u_spin);
    float s = sin(u_spin);
    vec2 spunUv = vec2(d.x * c - d.y * s, d.x * s + d.y * c) + 0.5;

    vec4 texCol = texture(u_texAlbedo, spunUv);
    if (texCol.a < 0.15) discard;

    // Combine procedural 3D sphere normal with panel seam normal map
    vec3 seamN = texture(u_texNormal, spunUv).xyz * 2.0 - 1.0;
    float zSphere = sqrt(max(0.05, 0.23 - dot(d, d)));
    vec3 sphereN = normalize(vec3(d.x * 2.1 + seamN.x * 0.28, d.y * 2.1 + seamN.y * 0.28, zSphere));

    vec3 L = normalize(vec3(-u_lightDir.x, -u_lightDir.y, u_lightDir.z));
    float ndl = clamp(dot(sphereN, L), 0.0, 1.0);

    vec3 col = texCol.rgb * (0.68 + 0.42 * ndl);
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(0.0, dot(sphereN, H)), 28.0);
    col += u_sunColor * spec * 0.65;

    if (u_fireLevel > 0.1) {
      float rim = smoothstep(0.22, 0.47, r);
      vec3 flameCol = (u_fireLevel > 1.2) ? vec3(1.0, 0.28, 0.05) : vec3(1.0, 0.65, 0.15);
      col = mix(col, col + flameCol * 0.65, rim * min(1.0, u_fireLevel));
    }

    outColor = vec4(clamp(col, 0.0, 1.0), texCol.a * u_alpha);
  }`;

  // Hand-calibrated & visually verified anatomical UV landmarks + handSocket + head pins across all 8 poses
  const CALIBRATED_LANDMARKS = {
    pose_ready: {
      width: 256,
      height: 320,
      zones: {
        bustL: [0.535, 0.348, 0.062],
        bustR: [0.582, 0.354, 0.062],
        hipL: [0.345, 0.515, 0.082],
        hipR: [0.435, 0.520, 0.078],
        hair: [0.335, 0.235, 0.125],
        head: [0.575, 0.205],
        handSocket: [0.705, 0.495]
      }
    },
    pose_dig: {
      width: 256,
      height: 320,
      zones: {
        bustL: [0.545, 0.345, 0.062],
        bustR: [0.592, 0.350, 0.062],
        hipL: [0.348, 0.515, 0.082],
        hipR: [0.438, 0.520, 0.078],
        hair: [0.340, 0.235, 0.125],
        head: [0.585, 0.205],
        handSocket: [0.728, 0.525]
      }
    },
    pose_set: {
      width: 256,
      height: 320,
      zones: {
        bustL: [0.540, 0.355, 0.065],
        bustR: [0.590, 0.360, 0.065],
        hipL: [0.358, 0.520, 0.082],
        hipR: [0.445, 0.525, 0.078],
        hair: [0.335, 0.240, 0.125],
        head: [0.575, 0.210],
        handSocket: [0.675, 0.135]
      }
    },
    pose_jump_coil: {
      width: 256,
      height: 320,
      zones: {
        bustL: [0.535, 0.362, 0.064],
        bustR: [0.588, 0.368, 0.064],
        hipL: [0.338, 0.505, 0.084],
        hipR: [0.428, 0.515, 0.080],
        hair: [0.345, 0.195, 0.135],
        head: [0.618, 0.205],
        handSocket: [0.215, 0.425]
      }
    },
    pose_spike: {
      width: 256,
      height: 320,
      zones: {
        bustL: [0.565, 0.345, 0.065],
        bustR: [0.622, 0.348, 0.065],
        hipL: [0.495, 0.535, 0.082],
        hipR: [0.585, 0.538, 0.078],
        hair: [0.275, 0.285, 0.115],
        head: [0.565, 0.235],
        handSocket: [0.695, 0.155]
      }
    },
    pose_spike_follow: {
      width: 256,
      height: 320,
      zones: {
        bustL: [0.485, 0.388, 0.065],
        bustR: [0.535, 0.402, 0.065],
        hipL: [0.275, 0.465, 0.084],
        hipR: [0.355, 0.478, 0.080],
        hair: [0.485, 0.165, 0.135],
        head: [0.665, 0.315],
        handSocket: [0.785, 0.585]
      }
    },
    pose_dive: {
      width: 320,
      height: 224,
      zones: {
        bustL: [0.635, 0.525, 0.068],
        bustR: [0.665, 0.548, 0.068],
        hipL: [0.445, 0.525, 0.085],
        hipR: [0.478, 0.575, 0.080],
        hair: [0.425, 0.285, 0.125],
        head: [0.665, 0.355],
        handSocket: [0.855, 0.505]
      }
    },
    plate_closeup: {
      width: 384,
      height: 480,
      zones: {
        bustL: [0.575, 0.458, 0.095],
        bustR: [0.668, 0.468, 0.098],
        hipL: [0.415, 0.775, 0.115],
        hipR: [0.565, 0.785, 0.110],
        hair: [0.335, 0.245, 0.130],
        head: [0.625, 0.245],
        handSocket: [0.785, 0.725]
      }
    }
  };

  class SunbreakRenderer {
    constructor(glCanvas, hudCanvas) {
      this.glCanvas = glCanvas;
      this.hudCanvas = hudCanvas;
      this.ctx = hudCanvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;

      this.spriteCanvas = document.createElement('canvas');
      this.spriteCanvas.width = 640;
      this.spriteCanvas.height = 360;
      this.sctx = this.spriteCanvas.getContext('2d');
      this.sctx.imageSmoothingEnabled = false;

      this.theme = 'sunset';
      this.trails = [];
      this.impactRings = [];
      this.poseTextures = {};
      this.ballTexture = { texAlbedo: null, texNormal: null };
      this.assetsReady = false;

      this.initGL();
      this.loadPoseSprites();
    }

    initGL() {
      const gl = this.glCanvas.getContext('webgl2', {
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true
      });
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

      const makeProg = (vsSrc, fsSrc) => {
        const vs = compile(gl.VERTEX_SHADER, vsSrc);
        const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
        if (!vs || !fs) return null;
        const p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
          console.error('Link error:', gl.getProgramInfoLog(p));
          return null;
        }
        return p;
      };

      this.prog = makeProg(BG_VS_SOURCE, BG_FS_SOURCE);
      this.charProg = makeProg(CHAR_VS_SOURCE, CHAR_FS_SOURCE);
      this.ballProg = makeProg(BALL_VS_SOURCE, BALL_FS_SOURCE);
      if (!this.prog || !this.charProg || !this.ballProg) {
        this.gl = null;
        return;
      }

      // Fullscreen background quad VAO
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      const loc = gl.getAttribLocation(this.prog, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      this.uTime = gl.getUniformLocation(this.prog, 'u_time');
      this.uTheme = gl.getUniformLocation(this.prog, 'u_theme');
      this.uRes = gl.getUniformLocation(this.prog, 'u_res');
      this.uBall = gl.getUniformLocation(this.prog, 'u_ball');
      this.uPlayers = gl.getUniformLocation(this.prog, 'u_players');
      this.uTrails = gl.getUniformLocation(this.prog, 'u_trails');

      // Character & Ball UV quad VAO (0..1 UV coordinates)
      this.charVao = gl.createVertexArray();
      gl.bindVertexArray(this.charVao);
      const cbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, cbuf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
        gl.STATIC_DRAW
      );
      const cloc = gl.getAttribLocation(this.charProg, 'a_uv');
      gl.enableVertexAttribArray(cloc);
      gl.vertexAttribPointer(cloc, 2, gl.FLOAT, false, 0, 0);

      const cp = this.charProg;
      this.cu = {
        center: gl.getUniformLocation(cp, 'u_center'),
        size: gl.getUniformLocation(cp, 'u_size'),
        flip: gl.getUniformLocation(cp, 'u_flip'),
        rot: gl.getUniformLocation(cp, 'u_rot'),
        shearX: gl.getUniformLocation(cp, 'u_shearX'),
        res: gl.getUniformLocation(cp, 'u_res'),
        texAlbedo: gl.getUniformLocation(cp, 'u_texAlbedo'),
        texNormal: gl.getUniformLocation(cp, 'u_texNormal'),
        texAlbedoPrev: gl.getUniformLocation(cp, 'u_texAlbedoPrev'),
        poseBlend: gl.getUniformLocation(cp, 'u_poseBlend'),
        morphVec: gl.getUniformLocation(cp, 'u_morphVec'),
        zoneBustL: gl.getUniformLocation(cp, 'u_zoneBustL'),
        zoneBustR: gl.getUniformLocation(cp, 'u_zoneBustR'),
        zoneHipL: gl.getUniformLocation(cp, 'u_zoneHipL'),
        zoneHipR: gl.getUniformLocation(cp, 'u_zoneHipR'),
        zoneHair: gl.getUniformLocation(cp, 'u_zoneHair'),
        dispBustL: gl.getUniformLocation(cp, 'u_dispBustL'),
        dispBustR: gl.getUniformLocation(cp, 'u_dispBustR'),
        dispHipL: gl.getUniformLocation(cp, 'u_dispHipL'),
        dispHipR: gl.getUniformLocation(cp, 'u_dispHipR'),
        dispHair: gl.getUniformLocation(cp, 'u_dispHair'),
        propScale: gl.getUniformLocation(cp, 'u_propScale'),
        suitColor: gl.getUniformLocation(cp, 'u_suitColor'),
        trimColor: gl.getUniformLocation(cp, 'u_trimColor'),
        hairColor: gl.getUniformLocation(cp, 'u_hairColor'),
        skinTint: gl.getUniformLocation(cp, 'u_skinTint'),
        lightDir: gl.getUniformLocation(cp, 'u_lightDir'),
        sunColor: gl.getUniformLocation(cp, 'u_sunColor'),
        wetness: gl.getUniformLocation(cp, 'u_wetness'),
        sandCoat: gl.getUniformLocation(cp, 'u_sandCoat'),
        alpha: gl.getUniformLocation(cp, 'u_alpha'),
        onFire: gl.getUniformLocation(cp, 'u_onFire')
      };

      const bp = this.ballProg;
      this.bu = {
        center: gl.getUniformLocation(bp, 'u_center'),
        size: gl.getUniformLocation(bp, 'u_size'),
        rot: gl.getUniformLocation(bp, 'u_rot'),
        res: gl.getUniformLocation(bp, 'u_res'),
        texAlbedo: gl.getUniformLocation(bp, 'u_texAlbedo'),
        texNormal: gl.getUniformLocation(bp, 'u_texNormal'),
        spin: gl.getUniformLocation(bp, 'u_spin'),
        lightDir: gl.getUniformLocation(bp, 'u_lightDir'),
        sunColor: gl.getUniformLocation(bp, 'u_sunColor'),
        fireLevel: gl.getUniformLocation(bp, 'u_fireLevel'),
        alpha: gl.getUniformLocation(bp, 'u_alpha')
      };
    }

    loadPoseSprites() {
      const gl = this.gl;
      const poseNames = [
        'pose_ready',
        'pose_dig',
        'pose_set',
        'pose_jump_coil',
        'pose_spike',
        'pose_spike_follow',
        'pose_dive',
        'plate_closeup'
      ];

      const createGLTex = (img, isNearest = true) => {
        if (!gl) return null;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          isNearest ? gl.NEAREST : gl.LINEAR
        );
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MAG_FILTER,
          isNearest ? gl.NEAREST : gl.LINEAR
        );
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        return tex;
      };

      poseNames.forEach((name) => {
        const entry = {
          meta: CALIBRATED_LANDMARKS[name],
          imgAlbedo: new Image(),
          imgNormal: new Image(),
          texAlbedo: null,
          texNormal: null
        };
        this.poseTextures[name] = entry;

        entry.imgAlbedo.onload = () => {
          entry.texAlbedo = createGLTex(entry.imgAlbedo, true);
        };
        entry.imgNormal.onload = () => {
          entry.texNormal = createGLTex(entry.imgNormal, false);
        };

        entry.imgAlbedo.src = `assets/sprites/${name}.png`;
        entry.imgNormal.src = `assets/sprites/${name}_normal.png`;
      });

      // Load 32-bit HD Pixel-Art Volleyball & Normal Map
      const ballAlb = new Image();
      const ballNrm = new Image();
      ballAlb.onload = () => {
        this.ballTexture.texAlbedo = createGLTex(ballAlb, true);
      };
      ballNrm.onload = () => {
        this.ballTexture.texNormal = createGLTex(ballNrm, false);
      };
      ballAlb.src = 'assets/sprites/ball_vball.png';
      ballNrm.src = 'assets/sprites/ball_vball_normal.png';
    }

    /**
     * Computes the exact world/screen coordinates of an athlete's active hand/forearm contact socket
     * for the given poseKey so the volleyball tracks and contacts their actual hands/wrists!
     */
    getHandSocketWorld(p, poseKeyOverride = null) {
      const poseKey = poseKeyOverride || this.selectPoseKey(p, false);
      const entry = CALIBRATED_LANDMARKS[poseKey] || CALIBRATED_LANDMARKS.pose_ready;
      const hs = entry.zones.handSocket || [0.70, 0.48];
      const facing = p.facing || (p.team === 0 ? 1.0 : -1.0);
      const hScale = p.profile.heightScale || 1.0;
      const depthScale = 0.90 + ((p.y - 300) / 360) * 0.22;
      const drawH = 152.0 * depthScale * hScale * (poseKey === 'pose_dive' ? 0.74 : 1.0);
      const drawW = drawH * (entry.width / entry.height);

      // Horizontal offset from character center X in screen/world pixels
      const localDx = (hs[0] - 0.5) * drawW * facing;
      // Vertical height above the character's feet (0.93 is foot anchor V)
      const heightAboveFeetPx = (0.93 - hs[1]) * drawH;
      // Convert screen vertical offset into world Z height (screenY = y - z * 0.88)
      const socketWorldX = p.x + localDx;
      const socketWorldY = p.y;
      const socketWorldZ = p.z + heightAboveFeetPx / 0.88;

      return {
        x: socketWorldX,
        y: socketWorldY,
        z: socketWorldZ,
        screenX: p.x + localDx,
        screenY: p.y - p.z * 0.88 + 8 - heightAboveFeetPx
      };
    }

    selectPoseKey(p, isCloseup = false) {
      if (isCloseup) {
        if (p.posePreviewTimer > 0) {
          if (p.actionState === 'spike_follow') return 'pose_spike_follow';
          if (p.actionState === 'spike' || p.z > 16) return 'pose_spike';
          if (p.actionState === 'jump_coil') return 'pose_jump_coil';
          if (p.actionState === 'dive') return 'pose_dive';
          if (p.actionState === 'set') return 'pose_set';
          if (p.actionState === 'dig') return 'pose_dig';
        }
        return 'plate_closeup';
      }
      if (p.actionState === 'dive' || p.diveLockTimer > 0) return 'pose_dive';
      if (p.actionState === 'spike_follow') return 'pose_spike_follow';
      if (p.actionState === 'jump_coil') return 'pose_jump_coil';
      if (p.z > 14 || p.actionState === 'spike') return 'pose_spike';
      if (p.actionState === 'set') return 'pose_set';
      if (p.actionState === 'dig') return 'pose_dig';
      return 'pose_ready';
    }

    getThemeLighting() {
      if (this.theme === 'noon') {
        return {
          lightDir: [-0.18, -0.28, 0.94],
          sunColor: [1.0, 0.98, 0.86]
        };
      }
      if (this.theme === 'neon') {
        return {
          lightDir: [0.35, -0.45, 0.82],
          sunColor: [1.0, 0.28, 0.78]
        };
      }
      return {
        lightDir: [-0.45, -0.52, 0.72],
        sunColor: [1.0, 0.84, 0.42]
      };
    }

    /**
     * Renders a painted HD pixel-art athlete pose through the WebGL2 Keyed Pose-Morph
     * Soft-Body UV-Warp & 2.5D Normal-Mapped Specular Shader.
     */
    drawAthleteGL(p, centerX, centerY, baseHeightPx, isCloseup = false, alphaOverride = 1.0, poseKeyOverride = null) {
      const gl = this.gl;
      if (!gl || !this.charProg) return;

      const poseKey = poseKeyOverride || this.selectPoseKey(p, isCloseup);
      const entry = this.poseTextures[poseKey];
      if (!entry || !entry.texAlbedo || !entry.texNormal) return;

      // Track keyframe transitions automatically on the player object for smooth Pose A -> Pose B morphing
      if (!isCloseup && alphaOverride >= 0.99) {
        if (!p._renderPoseKey) {
          p._renderPoseKey = poseKey;
          p._prevPoseKey = poseKey;
          p._poseBlend = 1.0;
        } else if (p._renderPoseKey !== poseKey) {
          p._prevPoseKey = p._renderPoseKey;
          p._renderPoseKey = poseKey;
          p._poseBlend = 0.0;
        }
      }

      const prevKey = (!isCloseup && p._prevPoseKey) ? p._prevPoseKey : poseKey;
      const prevEntry = this.poseTextures[prevKey] || entry;
      const blendT = isCloseup ? 1.0 : Math.min(1.0, p._poseBlend !== undefined ? p._poseBlend : 1.0);
      // Cubic smoothstep easing for keyed transition
      const easedBlend = blendT * blendT * (3.0 - 2.0 * blendT);

      const prof = p.profile;
      const rig = p.rig;
      const facing = isCloseup ? 1.0 : p.facing || (p.team === 0 ? 1.0 : -1.0);
      const hScale = prof.heightScale || 1.0;

      // Keyed squash-and-stretch impulse during Pose A -> Pose B transitions & running stride
      const speedXY = Math.hypot(p.vx || 0, p.vy || 0);
      let bobY = 0;
      let rot = 0;
      let squashX = 1.0;
      let stretchY = 1.0;
      let shearX = 0.0;

      if (!isCloseup) {
        const transPulse = Math.sin(blendT * Math.PI); // 0 -> 1 -> 0 across keyframe transition
        if (poseKey === 'pose_jump_coil') {
          squashX = 1.0 + 0.14 * (1.0 - easedBlend * 0.4);
          stretchY = 1.0 - 0.14 * (1.0 - easedBlend * 0.4);
          shearX = facing * 0.08 * transPulse;
        } else if (poseKey === 'pose_spike') {
          squashX = 1.0 - 0.08 * transPulse;
          stretchY = 1.0 + 0.12 * transPulse;
          rot = facing * Math.max(-0.14, Math.min(0.16, -p.vz * 0.0004));
          shearX = -facing * 0.09 * transPulse;
        } else if (poseKey === 'pose_spike_follow') {
          squashX = 1.0 + 0.08 * transPulse;
          stretchY = 1.0 - 0.08 * transPulse;
          shearX = facing * 0.15 * transPulse;
          rot = facing * 0.10;
        } else if (poseKey === 'pose_dig' || poseKey === 'pose_set') {
          squashX = 1.0 + 0.08 * transPulse;
          stretchY = 1.0 - 0.07 * transPulse;
          shearX = facing * 0.06 * transPulse;
        } else if (poseKey === 'pose_ready' && p.z <= 1 && speedXY > 15) {
          bobY = -Math.abs(Math.sin(rig.stridePhase)) * 7.5;
          rot = facing * Math.sin(rig.stridePhase) * 0.075;
          shearX = (p.vx || 0) * 0.00028;
        }
      }

      const aspect = entry.meta.width / entry.meta.height;
      const drawH = baseHeightPx * hScale * (poseKey === 'pose_dive' ? 0.74 : 1.0) * stretchY;
      const drawW = drawH * aspect * (squashX / stretchY);

      gl.useProgram(this.charProg);
      gl.bindVertexArray(this.charVao);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.uniform2f(this.cu.center, centerX, centerY + bobY);
      gl.uniform2f(this.cu.size, drawW, drawH);
      gl.uniform1f(this.cu.flip, facing);
      gl.uniform1f(this.cu.rot, rot);
      gl.uniform1f(this.cu.shearX, shearX);
      gl.uniform2f(this.cu.res, 1280.0, 720.0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, entry.texAlbedo);
      gl.uniform1i(this.cu.texAlbedo, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, entry.texNormal);
      gl.uniform1i(this.cu.texNormal, 1);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, prevEntry.texAlbedo || entry.texAlbedo);
      gl.uniform1i(this.cu.texAlbedoPrev, 2);

      // Compute correspondent anatomical UV shift between Pose A and Pose B
      const z = entry.meta.zones;
      const zPrev = prevEntry.meta.zones;
      const morphU = ((z.head[0] - zPrev.head[0]) * 0.55 + (z.handSocket[0] - zPrev.handSocket[0]) * 0.25) * 0.35;
      const morphV = ((z.head[1] - zPrev.head[1]) * 0.55 + (z.handSocket[1] - zPrev.handSocket[1]) * 0.25) * 0.35;

      gl.uniform1f(this.cu.poseBlend, easedBlend);
      gl.uniform2f(this.cu.morphVec, morphU, morphV);

      gl.uniform3fv(this.cu.zoneBustL, z.bustL);
      gl.uniform3fv(this.cu.zoneBustR, z.bustR);
      gl.uniform3fv(this.cu.zoneHipL, z.hipL);
      gl.uniform3fv(this.cu.zoneHipR, z.hipR);
      gl.uniform3fv(this.cu.zoneHair, z.hair);

      const uvGain = isCloseup ? 0.0046 : 0.0038;
      gl.uniform2f(this.cu.dispBustL, rig.bustL.x * uvGain * facing, rig.bustL.y * uvGain);
      gl.uniform2f(this.cu.dispBustR, rig.bustR.x * uvGain * facing, rig.bustR.y * uvGain);
      gl.uniform2f(this.cu.dispHipL, rig.hipL.x * uvGain * 0.9 * facing, rig.hipL.y * uvGain * 0.9);
      gl.uniform2f(this.cu.dispHipR, rig.hipR.x * uvGain * 0.9 * facing, rig.hipR.y * uvGain * 0.9);

      const hRoot = rig.hairNodes[0];
      const hTip = rig.hairNodes[rig.hairNodes.length - 1];
      const hairDx = ((hTip.x - hRoot.x) + facing * 14.0) * 0.0022 * facing;
      const hairDy = ((hTip.y - hRoot.y) - 12.0) * 0.0022;
      gl.uniform2f(this.cu.dispHair, hairDx, hairDy);

      gl.uniform2f(this.cu.propScale, prof.bustScale || 1.08, prof.hipScale || 1.08);
      gl.uniform3fv(this.cu.suitColor, prof.suitPrimary);
      gl.uniform3fv(this.cu.trimColor, prof.suitTrim);
      gl.uniform3fv(this.cu.hairColor, prof.hairColor);
      gl.uniform3fv(this.cu.skinTint, prof.skinBase);

      const light = this.getThemeLighting();
      gl.uniform3fv(this.cu.lightDir, light.lightDir);
      gl.uniform3fv(this.cu.sunColor, light.sunColor);
      gl.uniform1f(this.cu.wetness, rig.wetness);
      gl.uniform1f(this.cu.sandCoat, rig.sandCoat);
      gl.uniform1f(this.cu.alpha, alphaOverride);
      gl.uniform1f(this.cu.onFire, p.onFire ? 1.0 : 0.0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disable(gl.BLEND);
    }

    /**
     * Renders the 32-bit HD Pixel-Art Volleyball in WebGL2 with directional spin,
     * velocity squash/stretch, afterimage trails, and NBA Jam ON FIRE aura.
     */
    drawBallGL(b) {
      const gl = this.gl;
      if (!gl || !this.ballProg || !this.ballTexture.texAlbedo || !this.ballTexture.texNormal) return;

      gl.useProgram(this.ballProg);
      gl.bindVertexArray(this.charVao);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.ballTexture.texAlbedo);
      gl.uniform1i(this.bu.texAlbedo, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.ballTexture.texNormal);
      gl.uniform1i(this.bu.texNormal, 1);

      const light = this.getThemeLighting();
      gl.uniform3fv(this.bu.lightDir, light.lightDir);
      gl.uniform3fv(this.bu.sunColor, light.sunColor);
      gl.uniform2f(this.bu.res, 1280.0, 720.0);

      const fireLvl = b.onFireBall ? 2.0 : b.solarSpike ? 1.0 : 0.0;
      gl.uniform1f(this.bu.fireLevel, fireLvl);

      // 1. Draw afterimage ghost volleyballs along trajectory when spiking or ON FIRE
      if (b.trail && b.trail.length > 1) {
        const step = fireLvl > 0.5 ? 1 : 2;
        for (let i = 0; i < b.trail.length; i += step) {
          const tr = b.trail[i];
          const tAlpha = ((i + 1) / b.trail.length) * (fireLvl > 0.5 ? 0.55 : 0.25);
          const tx = tr.x;
          const ty = tr.y - tr.z * 0.88;
          const sz = 16.0 + (i / b.trail.length) * 9.0;
          gl.uniform2f(this.bu.center, tx, ty);
          gl.uniform2f(this.bu.size, sz, sz);
          gl.uniform1f(this.bu.rot, 0.0);
          gl.uniform1f(this.bu.spin, (b.spinAngle || 0) - (b.trail.length - i) * 0.35);
          gl.uniform1f(this.bu.alpha, tAlpha);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
      }

      // 2. Draw main volleyball with velocity-aligned squash/stretch and impact compression
      const bx = b.x;
      const by = b.y - b.z * 0.88;
      const screenVx = b.vx || 0;
      const screenVy = (b.vy || 0) - (b.vz || 0) * 0.88;
      const spd = Math.hypot(screenVx, screenVy);
      const flightAngle = spd > 25 ? Math.atan2(screenVy, screenVx) : 0.0;

      const stretch = b.impactSquash > 0
        ? 1.0 - b.impactSquash * 0.28
        : 1.0 + Math.min(0.24, spd * 0.00022);
      const squash = 1.0 / Math.sqrt(stretch);
      const baseDiam = 28.0;

      gl.uniform2f(this.bu.center, bx, by);
      gl.uniform2f(this.bu.size, baseDiam * stretch, baseDiam * squash);
      gl.uniform1f(this.bu.rot, flightAngle);
      gl.uniform1f(this.bu.spin, b.spinAngle || 0);
      gl.uniform1f(this.bu.alpha, 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.disable(gl.BLEND);
    }

    addSandTrail(x, y, radius = 18) {
      this.trails.unshift({ x, y, radius, age: 0 });
      if (this.trails.length > 24) {
        this.trails.pop();
      }
    }

    addImpactRing(screenX, screenY, color = '#ffb84d', maxRadius = 38) {
      this.impactRings.push({ x: screenX, y: screenY, color, maxRadius, age: 0 });
    }

    updateTrails(dt, players = [], demoFreeze = false) {
      if (!demoFreeze) {
        for (let i = this.trails.length - 1; i >= 0; i--) {
          this.trails[i].age += dt * 0.085;
          if (this.trails[i].age >= 1.0) {
            this.trails.splice(i, 1);
          }
        }
        for (let i = this.impactRings.length - 1; i >= 0; i--) {
          this.impactRings[i].age += dt * 4.8;
          if (this.impactRings[i].age >= 1.0) {
            this.impactRings.splice(i, 1);
          }
        }
      }
      // Step per-athlete keyframe morph blend timer (120ms Pose A -> Pose B tween)
      players.forEach((p) => {
        if (p._poseBlend !== undefined && p._poseBlend < 1.0) {
          p._poseBlend = Math.min(1.0, p._poseBlend + dt * 8.5);
        }
      });
    }

    renderBackground(time, state) {
      const gl = this.gl;
      if (!gl) {
        const ctx = this.ctx;
        ctx.fillStyle = '#d89b65';
        ctx.fillRect(0, 0, 1280, 720);
        return;
      }

      gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
      gl.disable(gl.BLEND);
      gl.useProgram(this.prog);
      gl.bindVertexArray(this.vao);

      const themeIdx = this.theme === 'noon' ? 1 : this.theme === 'neon' ? 2 : 0;
      gl.uniform1f(this.uTime, time);
      gl.uniform1i(this.uTheme, themeIdx);
      gl.uniform2f(this.uRes, 1280.0, 720.0);

      const b = state.ball;
      const fireVal = b.onFireBall ? 1.8 : b.solarSpike ? 1.0 : 0.0;
      gl.uniform4f(this.uBall, b.x, b.y, b.z, fireVal);

      const pArr = new Float32Array(16);
      state.players.forEach((p, idx) => {
        pArr[idx * 4 + 0] = p.x;
        pArr[idx * 4 + 1] = p.y;
        pArr[idx * 4 + 2] = p.z;
        pArr[idx * 4 + 3] = p.onFire ? 1.0 : 0.0;
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

    drawNetAndReticle(sctx, state, time) {
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

      // Top net tape & posts
      sctx.fillStyle = this.theme === 'neon' ? '#ff36b5' : '#ffffff';
      sctx.fillRect(netX - 3, netTopY - 2, 6, netBotY - netTopY - 18);
      sctx.fillStyle = '#ff477e';
      sctx.fillRect(netX - 4, netTopY - 4, 8, 6);
      sctx.fillRect(netX - 4, netBotY - 6, 8, 8);

      // Ball landing target reticle + predicted hand-intercept ring on sand
      if (state.ballLanding) {
        const lx = state.ballLanding.x * 0.5;
        const ly = state.ballLanding.y * 0.5;
        const pulse = 1.0 + 0.22 * Math.sin(time * 16.0);
        sctx.strokeStyle = state.ball.onFireBall
          ? '#ff5500'
          : state.ball.solarSpike
          ? '#ff477e'
          : '#2ce6ff';
        sctx.lineWidth = 1.6;
        sctx.beginPath();
        sctx.ellipse(lx, ly, 12 * pulse, 6.5 * pulse, 0, 0, Math.PI * 2);
        sctx.stroke();

        sctx.beginPath();
        sctx.moveTo(lx - 5, ly);
        sctx.lineTo(lx + 5, ly);
        sctx.moveTo(lx, ly - 3);
        sctx.lineTo(lx, ly + 3);
        sctx.stroke();
      }
    }

    renderScene(time, state) {
      // 1. Render normal-mapped beach, ocean, shadows & sand craters on WebGL2 canvas
      this.renderBackground(time, state);

      // 2. Depth-sort athletes AND the normal-lit pixel-art volleyball by Y depth
      const renderables = state.players.map((p) => ({
        type: 'player',
        y: p.y,
        obj: p
      }));
      renderables.push({
        type: 'ball',
        y: state.ball.y + 4, // draw slightly in front of the striking athlete at the same Y
        obj: state.ball
      });
      renderables.sort((a, b) => a.y - b.y);

      renderables.forEach((item) => {
        if (item.type === 'player') {
          const p = item.obj;
          const screenX = p.x;
          const screenY = p.y - p.z * 0.88;
          const depthScale = 0.90 + ((p.y - 300) / 360) * 0.22;
          const baseH = 152.0 * depthScale;

          // NBA Jam Turbo Sprint / ON FIRE afterimage ghost trail
          if (p.ghostTrail && p.ghostTrail.length > 0) {
            p.ghostTrail.forEach((g, idx) => {
              const gScreenY = g.y - g.z * 0.88;
              const gAlpha = ((idx + 1) / (p.ghostTrail.length + 1)) * 0.34;
              this.drawAthleteGL(p, g.x, gScreenY + 8, baseH, false, gAlpha, g.poseKey);
            });
          }

          this.drawAthleteGL(p, screenX, screenY + 8, baseH, false, 1.0);
        } else {
          this.drawBallGL(item.obj);
        }
      });

      // 3. If Pose & Soft-Body Telemetry Studio or Cut-In is active, clear card studio box in WebGL2 & render close-up portrait!
      if (state.poseCamActive || state.cutInTimer > 0) {
        const focusPlayer = state.players[state.poseCamPlayerIdx || 0] || state.players[0];
        const cardW = state.poseCamActive ? 410 : 320;
        const cardH = state.poseCamActive ? 360 : 250;
        const cardX = state.poseCamActive ? 845 : 935;
        const cardY = 64;

        const gl = this.gl;
        if (gl) {
          gl.enable(gl.SCISSOR_TEST);
          gl.scissor(cardX, this.glCanvas.height - (cardY + cardH), cardW, cardH);
          gl.clearColor(0.035, 0.06, 0.12, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          const portraitCenterX = cardX + (state.poseCamActive ? 126 : 94);
          const portraitBottomY = cardY + cardH - 10;
          const portraitH = state.poseCamActive ? 322 : 216;
          this.drawAthleteGL(focusPlayer, portraitCenterX, portraitBottomY, portraitH, true, 1.0);
          gl.disable(gl.SCISSOR_TEST);
        }
      }

      // 4. Draw crisp underfoot rings, turbo bars, and net onto HUD overlay canvas
      const sctx = this.sctx;
      sctx.clearRect(0, 0, 640, 360);

      state.players.forEach((p) => {
        const px = p.x * 0.5;
        const py = p.y * 0.5;
        sctx.save();
        if (p.controllerType !== 'ai') {
          sctx.strokeStyle = p.onFire ? '#ff5500' : p.team === 0 ? '#ffb84d' : '#2ce6ff';
          sctx.lineWidth = p.onFire ? 2.4 : 1.8;
          sctx.beginPath();
          sctx.ellipse(px, py, 14, 7.0, 0, 0, Math.PI * 2);
          sctx.stroke();
        } else if (p.isPartnerTarget) {
          sctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          sctx.setLineDash([3, 3]);
          sctx.beginPath();
          sctx.ellipse(px, py, 12, 6.0, 0, 0, Math.PI * 2);
          sctx.stroke();
        }
        sctx.restore();
      });

      this.drawNetAndReticle(sctx, state, time);

      const ctx = this.ctx;
      ctx.clearRect(0, 0, 1280, 720);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.spriteCanvas, 0, 0, 1280, 720);

      // Draw hand-socket contact shockwave rings on 1280x720 HUD overlay
      this.impactRings.forEach((r) => {
        ctx.save();
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = Math.max(0, 1.0 - r.age);
        ctx.lineWidth = 3.2 * (1.0 - r.age * 0.6);
        ctx.beginPath();
        ctx.arc(r.x, r.y, 8 + r.age * r.maxRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      // Draw Player Tags, Turbo Meter & ON FIRE Badges on crisp 1280x720 overlay
      const cardActive = state.poseCamActive || state.cutInTimer > 0;
      const cX = state.poseCamActive ? 845 : 935;
      const cY = 64;
      const cW = state.poseCamActive ? 410 : 320;
      const cH = state.poseCamActive ? 360 : 250;

      state.players.forEach((p) => {
        const sx = p.x;
        const sy = p.y - p.z * 0.88 - 136;
        if (cardActive && sx > cX - 20 && sx < cX + cW + 20 && sy > cY - 10 && sy < cY + cH + 15) {
          return;
        }
        ctx.font = '800 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        const firePrefix = p.onFire ? '🔥 ' : '';
        const label = `${firePrefix}${p.badgeText || p.profile.name}`;
        ctx.fillStyle = p.onFire ? 'rgba(48, 12, 6, 0.88)' : 'rgba(6, 12, 24, 0.78)';
        const w = ctx.measureText(label).width + 12;
        ctx.fillRect(sx - w * 0.5, sy - 11, w, 16);
        ctx.fillStyle = p.onFire ? '#ff7b29' : p.controllerType !== 'ai' ? '#ffb84d' : '#9ab0c9';
        ctx.fillText(label, sx, sy);

        // Mini NBA Jam Turbo Sprint bar under player tag
        const turboPct = Math.max(0, Math.min(1, (p.turbo !== undefined ? p.turbo : 100) / 100));
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(sx - 22, sy + 6, 44, 3);
        ctx.fillStyle = p.onFire ? '#ff4500' : p.turboActive ? '#2ce6ff' : '#ffb84d';
        ctx.fillRect(sx - 22, sy + 6, 44 * turboPct, 3);
      });

      state.callouts.forEach((c) => {
        ctx.save();
        ctx.font = '900 19px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = c.color || '#ffb84d';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 8;
        ctx.fillText(c.text, c.x, c.y);
        ctx.restore();
      });

      if (cardActive) {
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
      const telemetryX = cardX + (state.poseCamActive ? 242 : 182);

      ctx.clearRect(cardX, cardY, cardW, cardH);

      ctx.save();
      ctx.fillStyle = 'rgba(6, 11, 22, 0.90)';
      ctx.beginPath();
      ctx.roundRect(telemetryX - 10, cardY + 30, cardX + cardW - telemetryX + 4, cardH - 36, 8);
      ctx.fill();

      ctx.fillStyle = 'rgba(6, 11, 22, 0.94)';
      ctx.beginPath();
      ctx.roundRect(cardX + 2, cardY + 2, cardW - 4, 28, [10, 10, 0, 0]);
      ctx.fill();

      ctx.strokeStyle = focusPlayer.onFire ? '#ff5500' : prof.signatureColor || '#ffb84d';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 12);
      ctx.stroke();

      ctx.fillStyle = focusPlayer.onFire ? '#ff7b29' : prof.signatureColor || '#ffb84d';
      ctx.font = '900 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      const title = state.poseCamActive
        ? `POSE & SOFT-BODY TELEMETRY // ${prof.name}`
        : `${prof.name} — ${state.cutInLabel || prof.signatureMove}`;
      ctx.fillText(title, cardX + 14, cardY + 20);

      const tx = telemetryX;
      let ty = cardY + 50;
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillStyle = '#d6e4f5';
      const poseLabel = this.selectPoseKey(focusPlayer, true)
        .replace('pose_', '')
        .replace('plate_', '')
        .toUpperCase();
      ctx.fillText(`Pose: ${poseLabel}`, tx, ty);
      ty += 17;
      ctx.fillText(`Rig: ${state.physicsPreset.toUpperCase()}`, tx, ty);
      ty += 17;
      ctx.fillText(`Wetness Sheen: ${Math.round(rig.wetness * 100)}%`, tx, ty);
      ty += 17;
      ctx.fillText(`Sand Cling: ${Math.round(rig.sandCoat * 100)}%`, tx, ty);
      ty += 18;

      const boxW = state.poseCamActive ? 152 : 124;
      const boxH = state.poseCamActive ? 86 : 74;
      ctx.fillStyle = 'rgba(4, 8, 18, 0.82)';
      ctx.fillRect(tx, ty, boxW, boxH);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.strokeRect(tx, ty, boxW, boxH);
      ctx.fillStyle = '#9ab0c9';
      ctx.font = '700 10px Inter, sans-serif';
      ctx.fillText('UV PIN SPRING PHASE', tx + 6, ty + 13);

      const midX = tx + boxW * 0.5;
      const midY = ty + boxH * 0.60;
      const clampX = (v) => Math.max(-24, Math.min(24, v));
      const clampY = (v) => Math.max(-16, Math.min(18, v));
      ctx.fillStyle = '#ff477e';
      ctx.beginPath();
      ctx.arc(midX - 18 + clampX(rig.bustL.x * 2.2), midY - 6 + clampY(rig.bustL.y * 2.2), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb84d';
      ctx.beginPath();
      ctx.arc(midX + 18 + clampX(rig.bustR.x * 2.2), midY - 6 + clampY(rig.bustR.y * 2.2), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2ce6ff';
      ctx.beginPath();
      ctx.arc(midX - 14 + clampX(rig.hipL.x * 2.0), midY + 12 + clampY(rig.hipL.y * 2.0), 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(midX + 14 + clampX(rig.hipR.x * 2.0), midY + 12 + clampY(rig.hipR.y * 2.0), 4.5, 0, Math.PI * 2);
      ctx.fill();

      if (state.poseCamActive) {
        ty += 102;
        ctx.fillStyle = '#ffb84d';
        ctx.font = '800 10px Inter, sans-serif';
        ctx.fillText('[1-6] Switch Athlete', tx, ty);
        ctx.fillText('[SPACE] Jump Coil->Arch', tx, ty + 15);
        ctx.fillText('[K] Spike Bow->Whip', tx, ty + 30);
        ctx.fillText('[L] Sand Dive Pose', tx, ty + 45);
      }

      ctx.restore();
    }
  }

  window.SunbreakRenderer = SunbreakRenderer;
})();
