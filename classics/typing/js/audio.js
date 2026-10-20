// Audio — Web Audio API sound effects
export class Audio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Play a short tone
    playTone(frequency, duration, type = 'sine', volume = 0.1) {
        if (!this.enabled || !this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + duration);
    }

    // Correct character typed
    typeCorrect() {
        this.playTone(800, 0.05, 'sine', 0.05);
    }

    // Word completed
    wordComplete() {
        this.playTone(523, 0.1, 'sine', 0.08);
        setTimeout(() => this.playTone(659, 0.1, 'sine', 0.08), 50);
        setTimeout(() => this.playTone(784, 0.15, 'sine', 0.08), 100);
    }

    // Wrong character
    typeWrong() {
        this.playTone(200, 0.1, 'square', 0.06);
    }

    // Word missed (hit bottom)
    wordMissed() {
        this.playTone(300, 0.15, 'sawtooth', 0.06);
        setTimeout(() => this.playTone(200, 0.2, 'sawtooth', 0.06), 100);
    }

    // Game over
    gameOver() {
        this.playTone(400, 0.2, 'sine', 0.1);
        setTimeout(() => this.playTone(350, 0.2, 'sine', 0.1), 150);
        setTimeout(() => this.playTone(300, 0.2, 'sine', 0.1), 300);
        setTimeout(() => this.playTone(200, 0.4, 'sine', 0.1), 450);
    }

    // Combo milestone
    comboMilestone() {
        this.playTone(880, 0.08, 'sine', 0.1);
        setTimeout(() => this.playTone(1100, 0.12, 'sine', 0.1), 60);
    }

    // Mode select click
    selectClick() {
        this.playTone(600, 0.03, 'sine', 0.04);
    }
}
