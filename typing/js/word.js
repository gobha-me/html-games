// Word entity — represents a single falling word
export class Word {
    constructor(text, x, y, speed) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.matched = 0; // number of correctly typed characters
        this.alive = true;
        this.hitBottom = false;
        this.opacity = 1;
        this.shake = 0; // shake offset for wrong key
        this.shakeTimer = 0;
        this.deathTimer = 0;
        this.isDying = false;
        this.highlight = false; // briefly highlight on match
    }

    update(dt, canvasHeight) {
        if (this.isDying) {
            this.deathTimer += dt;
            this.opacity = Math.max(0, 1 - this.deathTimer / 0.4);
            if (this.deathTimer > 0.4) this.alive = false;
            return;
        }

        this.y += this.speed * dt;

        // Shake decay
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            this.shake *= 0.85;
            if (this.shakeTimer <= 0) this.shake = 0;
        }

        // Check if hit bottom
        if (this.y >= canvasHeight - 60) {
            this.hitBottom = true;
            this.alive = false;
        }
    }

    typeChar(char) {
        if (this.isDying || !this.alive) return { result: 'ignored' };

        const expected = this.text[this.matched];

        if (char === expected) {
            this.matched++;
            this.highlight = true;
            setTimeout(() => this.highlight = false, 100);

            if (this.matched >= this.text.length) {
                this.isDying = true;
                return { result: 'complete' };
            }
            return { result: 'match' };
        } else {
            this.shake = 4;
            this.shakeTimer = 0.15;
            return { result: 'mismatch' };
        }
    }

    getDisplayX() {
        return this.x + this.shake;
    }

    // Get the portion of text that's been matched
    getMatchedText() {
        return this.text.substring(0, this.matched);
    }

    getRemainingText() {
        return this.text.substring(this.matched);
    }
}
