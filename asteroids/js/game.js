/**
 * Asteroids — Vector-style top-down shooter
 * Classic gameplay with CRT glow, procedural asteroids, UFO bonus enemy, hyperspace.
 */
(function () {
    "use strict";

    // ── Canvas ──
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const W = 900;
    const H = 640;
    canvas.width = W;
    canvas.height = H;

    // ── Audio (Web Audio API oscillators) ──
    let audioCtx = null;
    function ensureAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    function playTone(freq, dur, type = "square", vol = 0.08) {
        try {
            ensureAudio();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(vol, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + dur);
        } catch (_) { /* silent */ }
    }
    const SFX = {
        shoot: () => playTone(880, 0.08, "square", 0.06),
        thrust: () => playTone(60, 0.12, "sawtooth", 0.03),
        hit: () => playTone(200, 0.2, "sawtooth", 0.1),
        explode: () => { playTone(80, 0.3, "sawtooth", 0.12); playTone(50, 0.4, "square", 0.08); },
        hyperspace: () => playTone(440, 0.3, "sine", 0.1),
        ufoShoot: () => playTone(300, 0.1, "triangle", 0.05),
        ufoHit: () => { playTone(150, 0.3, "square", 0.1); playTone(100, 0.4, "sawtooth", 0.08); },
        levelUp: () => { playTone(523, 0.1); setTimeout(() => playTone(659, 0.1), 100); setTimeout(() => playTone(784, 0.15), 200); },
        death: () => { playTone(300, 0.15, "sawtooth", 0.15); setTimeout(() => playTone(200, 0.2, "sawtooth", 0.12), 150); setTimeout(() => playTone(100, 0.3, "sawtooth", 0.1), 300); },
    };

    // ── State ──
    let state = "START"; // START | PLAYING | PAUSED | GAME_OVER
    let score = 0;
    let lives = 3;
    let level = 1;
    let highScore = parseInt(localStorage.getItem("asteroids_high") || "0", 10);
    let ship, asteroids, bullets, ufoBullets, particles, ufo;
    let ufoTimer = 0;
    let keys = {};
    let lastTime = 0;
    let thrustCooldown = 0;

    // ── Utility ──
    function rand(min, max) { return Math.random() * (max - min) + min; }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function wrap(obj) {
        if (obj.x < -20) obj.x = W + 20;
        if (obj.x > W + 20) obj.x = -20;
        if (obj.y < -20) obj.y = H + 20;
        if (obj.y > H + 20) obj.y = -20;
    }

    // ── Procedural asteroid shape ──
    function makeAsteroidShape(radius, vertices = 12) {
        const pts = [];
        for (let i = 0; i < vertices; i++) {
            const angle = (i / vertices) * Math.PI * 2;
            const r = radius * rand(0.7, 1.3);
            pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        }
        return pts;
    }

    // ── Ship ──
    function createShip() {
        return {
            x: W / 2, y: H / 2,
            vx: 0, vy: 0,
            angle: -Math.PI / 2,
            radius: 14,
            invincible: 120, // frames
            visible: true,
            blinkTimer: 0,
        };
    }

    // ── Asteroid ──
    function createAsteroid(x, y, size) {
        const sizes = { large: 40, medium: 22, small: 12 };
        const r = sizes[size] || 40;
        const speed = size === "large" ? rand(0.5, 1.5) : size === "medium" ? rand(1, 2.5) : rand(1.5, 3.5);
        const angle = rand(0, Math.PI * 2);
        return {
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: r,
            size,
            shape: makeAsteroidShape(r),
            rot: 0,
            rotSpeed: rand(-0.02, 0.02),
        };
    }

    function spawnWave() {
        asteroids = [];
        const count = 3 + level;
        for (let i = 0; i < count; i++) {
            let x, y;
            do {
                x = rand(0, W);
                y = rand(0, H);
            } while (dist({ x, y }, ship) < 150); // keep away from ship
            asteroids.push(createAsteroid(x, y, "large"));
        }
    }

    // ── Bullet ──
    function createBullet(from, angle, speed = 7) {
        return {
            x: from.x + Math.cos(angle) * 18,
            y: from.y + Math.sin(angle) * 18,
            vx: Math.cos(angle) * speed + (from.vx || 0) * 0.3,
            vy: Math.sin(angle) * speed + (from.vy || 0) * 0.3,
            life: 60,
        };
    }

    // ── UFO ──
    function createUFO() {
        const fromLeft = Math.random() < 0.5;
        return {
            x: fromLeft ? -30 : W + 30,
            y: rand(60, H * 0.4),
            vx: fromLeft ? rand(1.5, 3) : rand(-3, -1.5),
            vy: rand(-0.3, 0.3),
            radius: 18,
            shootTimer: 0,
            shootInterval: rand(60, 120),
        };
    }

    // ── Particles ──
    function spawnExplosion(x, y, count = 12, color = "#00ff88", speed = 3) {
        for (let i = 0; i < count; i++) {
            const angle = rand(0, Math.PI * 2);
            const s = rand(0.5, speed);
            particles.push({
                x, y,
                vx: Math.cos(angle) * s,
                vy: Math.sin(angle) * s,
                life: rand(20, 50),
                maxLife: 50,
                color,
            });
        }
    }

    // ── Init ──
    function initGame() {
        score = 0;
        lives = 3;
        level = 1;
        ship = createShip();
        bullets = [];
        ufoBullets = [];
        particles = [];
        ufo = null;
        ufoTimer = 0;
        spawnWave();
        updateHUD();
    }

    // ── HUD ──
    function updateHUD() {
        document.getElementById("score-display").textContent = score;
        document.getElementById("level-display").textContent = level;
        document.getElementById("lives-display").textContent = "♥".repeat(Math.max(0, lives));
    }

    // ── Overlay ──
    function showOverlay(title, sub, body, btnText) {
        document.getElementById("overlay-title").textContent = title;
        document.getElementById("overlay-sub").textContent = sub;
        document.getElementById("overlay-body").innerHTML = body;
        document.getElementById("overlay-btn").textContent = btnText;
        document.getElementById("overlay").classList.remove("hidden");
    }
    function hideOverlay() {
        document.getElementById("overlay").classList.add("hidden");
    }

    function showStartScreen() {
        const body = `
            <dl class="controls">
                <dt>← →</dt><dd>Rotate ship</dd>
                <dt>↑</dt><dd>Thrust</dd>
                <dt>Space</dt><dd>Fire</dd>
                <dt>H</dt><dd>Hyperspace (risky!)</dd>
                <dt>P</dt><dd>Pause</dd>
            </dl>
            ${highScore > 0 ? `<div class="high-score">HIGH SCORE: ${highScore}</div>` : ""}
        `;
        showOverlay("ASTEROIDS", "Vector Space Shooter", body, "START GAME");
    }

    function showGameOver() {
        if (score > highScore) {
            highScore = score;
            localStorage.setItem("asteroids_high", String(highScore));
        }
        const body = `
            <div style="font-family:'Orbitron',monospace;font-size:28px;color:#00ff88;margin-bottom:8px;">${score}</div>
            <div style="color:var(--muted);margin-bottom:16px;">FINAL SCORE</div>
            <div style="color:var(--muted);">Level reached: ${level}</div>
            ${score >= highScore && score > 0 ? `<div class="high-score">★ NEW HIGH SCORE ★</div>` : `<div class="high-score">HIGH SCORE: ${highScore}</div>`}
        `;
        showOverlay("GAME OVER", "", body, "PLAY AGAIN");
    }

    // ── Drawing ──
    function drawVectorLine(x1, y1, x2, y2, color = "#00ff88", width = 1.5, glow = true) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (glow) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
        } else {
            ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawShip() {
        if (!ship.visible) return;
        if (ship.invincible > 0) {
            ship.blinkTimer++;
            if (Math.floor(ship.blinkTimer / 4) % 2 === 0) return;
        }

        const { x, y, angle } = ship;
        const noseX = x + Math.cos(angle) * 18;
        const noseY = y + Math.sin(angle) * 18;
        const leftX = x + Math.cos(angle + 2.5) * 14;
        const leftY = y + Math.sin(angle + 2.5) * 14;
        const rightX = x + Math.cos(angle - 2.5) * 14;
        const rightY = y + Math.sin(angle - 2.5) * 14;

        // Ship body
        drawVectorLine(noseX, noseY, leftX, leftY, "#00ff88", 1.5);
        drawVectorLine(leftX, leftY, rightX, rightY, "#00ff88", 1.5);
        drawVectorLine(rightX, rightY, noseX, noseY, "#00ff88", 1.5);

        // Engine flame
        if (keys["ArrowUp"] || keys["w"]) {
            const flameLen = rand(8, 18);
            const fAngle = angle + Math.PI;
            const fLeftX = x + Math.cos(fAngle + 0.4) * 8;
            const fLeftY = y + Math.sin(fAngle + 0.4) * 8;
            const fRightX = x + Math.cos(fAngle - 0.4) * 8;
            const fRightY = y + Math.sin(fAngle - 0.4) * 8;
            const tipX = x + Math.cos(fAngle) * (14 + flameLen);
            const tipY = y + Math.sin(fAngle) * (14 + flameLen);
            drawVectorLine(fLeftX, fLeftY, tipX, tipY, "#f59e0b", 1.2);
            drawVectorLine(fRightX, fRightY, tipX, tipY, "#f59e0b", 1.2);
        }
    }

    function drawAsteroids() {
        for (const a of asteroids) {
            ctx.strokeStyle = "#e0e0f0";
            ctx.lineWidth = 1.2;
            ctx.shadowColor = "#e0e0f0";
            ctx.shadowBlur = 4;
            ctx.beginPath();
            for (let i = 0; i < a.shape.length; i++) {
                const p = a.shape[i];
                const rx = p.x * Math.cos(a.rot) - p.y * Math.sin(a.rot);
                const ry = p.x * Math.sin(a.rot) + p.y * Math.cos(a.rot);
                if (i === 0) ctx.moveTo(a.x + rx, a.y + ry);
                else ctx.lineTo(a.x + rx, a.y + ry);
            }
            ctx.closePath();
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
    }

    function drawBullet(b, color = "#00ff88") {
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function drawUFO() {
        if (!ufo) return;
        const { x, y } = ufo;
        // Saucer shape
        drawVectorLine(x - 18, y, x - 8, y - 8, "#f43f5e", 1.5);
        drawVectorLine(x - 8, y - 8, x + 8, y - 8, "#f43f5e", 1.5);
        drawVectorLine(x + 8, y - 8, x + 18, y, "#f43f5e", 1.5);
        drawVectorLine(x + 18, y, x + 12, y + 6, "#f43f5e", 1.5);
        drawVectorLine(x + 12, y + 6, x - 12, y + 6, "#f43f5e", 1.5);
        drawVectorLine(x - 12, y + 6, x - 18, y, "#f43f5e", 1.5);
        // Dome
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 1;
        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(x, y - 8, 6, Math.PI, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawParticles() {
        for (const p of particles) {
            const alpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    // ── Update ──
    function updateShip() {
        const rotSpeed = 0.05;
        if (keys["ArrowLeft"] || keys["a"]) ship.angle -= rotSpeed;
        if (keys["ArrowRight"] || keys["d"]) ship.angle += rotSpeed;

        if (keys["ArrowUp"] || keys["w"]) {
            const thrust = 0.12;
            ship.vx += Math.cos(ship.angle) * thrust;
            ship.vy += Math.sin(ship.angle) * thrust;
            thrustCooldown--;
            if (thrustCooldown <= 0) {
                SFX.thrust();
                thrustCooldown = 8;
            }
        }

        // Damping
        ship.vx *= 0.995;
        ship.vy *= 0.995;

        // Speed cap
        const speed = Math.hypot(ship.vx, ship.vy);
        if (speed > 6) {
            ship.vx = (ship.vx / speed) * 6;
            ship.vy = (ship.vy / speed) * 6;
        }

        ship.x += ship.vx;
        ship.y += ship.vy;
        wrap(ship);

        if (ship.invincible > 0) ship.invincible--;
    }

    function updateBullets() {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += b.vx;
            b.y += b.vy;
            b.life--;
            wrap(b);
            if (b.life <= 0) bullets.splice(i, 1);
        }
        for (let i = ufoBullets.length - 1; i >= 0; i--) {
            const b = ufoBullets[i];
            b.x += b.vx;
            b.y += b.vy;
            b.life--;
            wrap(b);
            if (b.life <= 0) ufoBullets.splice(i, 1);
        }
    }

    function updateAsteroids() {
        for (const a of asteroids) {
            a.x += a.vx;
            a.y += a.vy;
            a.rot += a.rotSpeed;
            wrap(a);
        }
    }

    function updateUFO() {
        if (!ufo) {
            ufoTimer++;
            if (ufoTimer > 600 + rand(0, 400)) {
                ufo = createUFO();
                ufoTimer = 0;
            }
            return;
        }
        ufo.x += ufo.vx;
        ufo.y += ufo.vy;
        // Keep in bounds vertically
        if (ufo.y < 40) ufo.vy = Math.abs(ufo.vy);
        if (ufo.y > H * 0.5) ufo.vy = -Math.abs(ufo.vy);

        // Shoot at ship
        ufo.shootTimer++;
        if (ufo.shootTimer >= ufo.shootInterval && ship.invincible <= 0) {
            const angle = Math.atan2(ship.y - ufo.y, ship.x - ufo.x);
            ufoBullets.push(createBullet(ufo, angle, 4));
            ufo.shootTimer = 0;
            ufo.shootInterval = rand(60, 120);
            SFX.ufoShoot();
        }

        // Remove if off screen
        if (ufo.x < -60 || ufo.x > W + 60) ufo = null;
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.97;
            p.vy *= 0.97;
            p.life--;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    // ── Collisions ──
    function checkCollisions() {
        // Bullets vs asteroids
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            for (let ai = asteroids.length - 1; ai >= 0; ai--) {
                const a = asteroids[ai];
                if (dist(b, a) < a.radius + 3) {
                    bullets.splice(bi, 1);
                    splitAsteroid(a, ai);
                    break;
                }
            }
        }

        // Bullets vs UFO
        if (ufo) {
            for (let bi = bullets.length - 1; bi >= 0; bi--) {
                if (dist(bullets[bi], ufo) < ufo.radius + 3) {
                    const pts = [50, 100, 150, 200][Math.floor(rand(0, 4))];
                    score += pts;
                    updateHUD();
                    spawnExplosion(ufo.x, ufo.y, 20, "#f43f5e", 4);
                    SFX.ufoHit();
                    bullets.splice(bi, 1);
                    ufo = null;
                    break;
                }
            }
        }

        // Ship vs asteroids
        if (ship.invincible <= 0) {
            for (const a of asteroids) {
                if (dist(ship, a) < a.radius + ship.radius - 4) {
                    shipHit();
                    break;
                }
            }
        }

        // UFO bullets vs ship
        if (ship.invincible <= 0 && ufoBullets.length > 0) {
            for (let i = ufoBullets.length - 1; i >= 0; i--) {
                if (dist(ufoBullets[i], ship) < ship.radius + 3) {
                    ufoBullets.splice(i, 1);
                    shipHit();
                    break;
                }
            }
        }

        // Level clear
        if (asteroids.length === 0) {
            level++;
            SFX.levelUp();
            spawnWave();
            ufo = null;
            ufoTimer = 0;
            updateHUD();
        }
    }

    function splitAsteroid(a, index) {
        SFX.explode();
        spawnExplosion(a.x, a.y, 10, "#e0e0f0", 2);

        const pts = { large: 20, medium: 50, small: 100 };
        score += pts[a.size] || 20;
        updateHUD();

        if (a.size === "large") {
            asteroids.push(createAsteroid(a.x + rand(-10, 10), a.y + rand(-10, 10), "medium"));
            asteroids.push(createAsteroid(a.x + rand(-10, 10), a.y + rand(-10, 10), "medium"));
        } else if (a.size === "medium") {
            asteroids.push(createAsteroid(a.x + rand(-5, 5), a.y + rand(-5, 5), "small"));
            asteroids.push(createAsteroid(a.x + rand(-5, 5), a.y + rand(-5, 5), "small"));
        }
        asteroids.splice(index, 1);
    }

    function shipHit() {
        lives--;
        SFX.death();
        spawnExplosion(ship.x, ship.y, 25, "#00ff88", 4);
        updateHUD();

        if (lives <= 0) {
            state = "GAME_OVER";
            showGameOver();
            return;
        }

        // Respawn
        ship.x = W / 2;
        ship.y = H / 2;
        ship.vx = 0;
        ship.vy = 0;
        ship.angle = -Math.PI / 2;
        ship.invincible = 180;
    }

    // ── Hyperspace ──
    function hyperspace() {
        SFX.hyperspace();
        spawnExplosion(ship.x, ship.y, 8, "#818cf8", 2);
        ship.x = rand(80, W - 80);
        ship.y = rand(80, H - 80);
        ship.vx = 0;
        ship.vy = 0;
        ship.invincible = 90;
        // 15% chance of instant death
        if (Math.random() < 0.15) {
            lives--;
            updateHUD();
            if (lives <= 0) {
                state = "GAME_OVER";
                showGameOver();
            } else {
                spawnExplosion(ship.x, ship.y, 20, "#f43f5e", 4);
                ship.x = W / 2;
                ship.y = H / 2;
                ship.invincible = 180;
            }
        }
    }

    // ── Input ──
    let shootCooldown = 0;
    document.addEventListener("keydown", (e) => {
        keys[e.key] = true;

        if (state === "PLAYING") {
            if ((e.key === " " || e.key === "Spacebar") && shootCooldown <= 0) {
                bullets.push(createBullet(ship, ship.angle));
                SFX.shoot();
                shootCooldown = 10;
            }
            if (e.key === "h" || e.key === "H") {
                hyperspace();
            }
            if (e.key === "p" || e.key === "P") {
                state = "PAUSED";
            }
        } else if (state === "PAUSED") {
            if (e.key === "p" || e.key === "P") {
                state = "PLAYING";
            }
        }

        // Prevent scrolling
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
            e.preventDefault();
        }
    });

    document.addEventListener("keyup", (e) => {
        keys[e.key] = false;
    });

    // ── Button ──
    document.getElementById("overlay-btn").addEventListener("click", () => {
        try { ensureAudio(); } catch (_) {}
        hideOverlay();
        initGame();
        state = "PLAYING";
    });

    // ── Main Loop ──
    function gameLoop(timestamp) {
        requestAnimationFrame(gameLoop);

        if (state !== "PLAYING") {
            // Still draw the background
            ctx.fillStyle = "#0a0a1a";
            ctx.fillRect(0, 0, W, H);
            return;
        }

        // Update
        if (shootCooldown > 0) shootCooldown--;
        updateShip();
        updateBullets();
        updateAsteroids();
        updateUFO();
        updateParticles();
        checkCollisions();

        // Draw
        ctx.fillStyle = "#0a0a1a";
        ctx.fillRect(0, 0, W, H);

        // Subtle grid
        ctx.strokeStyle = "rgba(0, 255, 136, 0.03)";
        ctx.lineWidth = 0.5;
        for (let x = 0; x < W; x += 60) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 0; y < H; y += 60) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        drawAsteroids();
        drawShip();
        drawUFO();
        for (const b of bullets) drawBullet(b, "#00ff88");
        for (const b of ufoBullets) drawBullet(b, "#f43f5e");
        drawParticles();

        // Pause overlay
        if (state === "PAUSED") {
            ctx.fillStyle = "rgba(10, 10, 26, 0.7)";
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "#00ff88";
            ctx.font = "36px Orbitron, monospace";
            ctx.textAlign = "center";
            ctx.shadowColor = "#00ff88";
            ctx.shadowBlur = 16;
            ctx.fillText("PAUSED", W / 2, H / 2);
            ctx.shadowBlur = 0;
            ctx.font = "14px Inter, sans-serif";
            ctx.fillStyle = "#7a7a9a";
            ctx.fillText("Press P to resume", W / 2, H / 2 + 32);
        }
    }

    // ── Start ──
    showStartScreen();
    requestAnimationFrame(gameLoop);
})();
