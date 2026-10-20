// Renderer — canvas drawing for words, particles, and effects
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.resize();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.clientWidth * dpr;
        this.canvas.height = this.canvas.clientHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = this.canvas.clientWidth;
        this.height = this.canvas.clientHeight;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    // Draw a single word with matched/remaining text
    drawWord(word, isTarget) {
        const ctx = this.ctx;
        const x = word.getDisplayX();
        const y = word.y;

        ctx.save();

        // Background glow for target word
        if (isTarget && !word.isDying) {
            ctx.shadowColor = '#00d4ff';
            ctx.shadowBlur = 15;
        }

        // Word background pill
        const textWidth = ctx.measureText(word.text).width;
        const padding = 10;
        const pillWidth = textWidth + padding * 2;
        const pillHeight = 30;
        const pillX = x - padding;
        const pillY = y - pillHeight / 2;

        ctx.fillStyle = word.isDying
            ? `rgba(46, 213, 115, ${word.opacity * 0.2})`
            : word.highlight
                ? 'rgba(0, 212, 255, 0.15)'
                : 'rgba(22, 33, 62, 0.7)';

        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 6);
        ctx.fill();

        // Border
        ctx.strokeStyle = word.isDying
            ? `rgba(46, 213, 115, ${word.opacity * 0.5})`
            : isTarget && !word.isDying
                ? 'rgba(0, 212, 255, 0.4)'
                : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 6);
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Matched text (green)
        const matched = word.getMatchedText();
        const remaining = word.getRemainingText();

        ctx.font = 'bold 16px "Orbitron", monospace';
        ctx.textBaseline = 'middle';

        // Draw matched portion
        if (matched.length > 0) {
            ctx.fillStyle = word.isDying
                ? `rgba(46, 213, 115, ${word.opacity})`
                : '#2ed573';
            ctx.fillText(matched, x, y);
        }

        // Draw remaining portion
        if (remaining.length > 0) {
            const matchedWidth = ctx.measureText(matched).width;
            ctx.fillStyle = word.isDying
                ? `rgba(224, 224, 240, ${word.opacity * 0.5})`
                : word.hitBottom
                    ? '#ff4757'
                    : '#e0e0f0';
            ctx.fillText(remaining, x + matchedWidth, y);
        }

        ctx.restore();
    }

    // Draw all active words, highlighting the target (lowest alive word)
    drawWords(words) {
        // Find target word (lowest non-dying word)
        const target = words
            .filter(w => !w.isDying && !w.hitBottom)
            .sort((a, b) => b.y - a.y)[0];

        for (const word of words) {
            this.drawWord(word, word === target);
        }
    }

    // Spawn particles at a position
    spawnParticles(x, y, count = 12, color = '#00d4ff') {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = 60 + Math.random() * 120;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 1.5 + Math.random(),
                size: 2 + Math.random() * 3,
                color
            });
        }
    }

    // Update and draw particles
    updateParticles(dt) {
        const ctx = this.ctx;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 100 * dt; // gravity
            p.life -= p.decay * dt;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Draw danger zone line at bottom
    drawDangerZone() {
        const ctx = this.ctx;
        const y = this.height - 60;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 71, 87, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(this.width - 20, y);
        ctx.stroke();
        ctx.restore();
    }

    // Draw combo indicator
    drawCombo(combo, x, y) {
        if (combo < 2) return;

        const ctx = this.ctx;
        ctx.save();

        const scale = 1 + Math.min(combo * 0.05, 0.5);
        ctx.font = `bold ${14 * scale}px "Orbitron", monospace`;
        ctx.fillStyle = combo >= 10 ? '#ffa502' : combo >= 5 ? '#00d4ff' : '#2ed573';
        ctx.textAlign = 'center';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        ctx.fillText(`${combo}x COMBO`, x, y);

        ctx.restore();
    }

    // Draw timer for timed mode
    drawTimer(timeRemaining) {
        const ctx = this.ctx;
        ctx.save();

        ctx.font = 'bold 14px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = timeRemaining <= 10 ? '#ff4757' : '#e0e0f0';

        const minutes = Math.floor(timeRemaining / 60);
        const seconds = Math.floor(timeRemaining % 60);
        ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, this.width / 2, 50);

        ctx.restore();
    }
}
