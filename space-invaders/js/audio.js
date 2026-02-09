// Audio Manager using Web Audio API for synthesized sounds
const AudioManager = {
    context: null,
    enabled: true,

    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    },

    playSound(type) {
        if (!this.enabled || !this.context) return;

        const ctx = this.context;
        const now = ctx.currentTime;

        switch (type) {
            case 'shoot':
                this.playShoot(ctx, now);
                break;
            case 'explosion':
                this.playExplosion(ctx, now);
                break;
            case 'alienMove':
                this.playAlienMove(ctx, now);
                break;
            case 'ufo':
                this.playUFO(ctx, now);
                break;
            case 'playerHit':
                this.playPlayerHit(ctx, now);
                break;
            case 'gameOver':
                this.playGameOver(ctx, now);
                break;
            case 'newWave':
                this.playNewWave(ctx, now);
                break;
        }
    },

    playShoot(ctx, now) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        oscillator.start(now);
        oscillator.stop(now + 0.1);
    },

    playExplosion(ctx, now) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        oscillator.type = 'sawtooth';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);

        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.setValueAtTime(200, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.3);
        
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        oscillator.start(now);
        oscillator.stop(now + 0.3);
    },

    playAlienMove(ctx, now) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.setValueAtTime(220, now);
        
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        oscillator.start(now);
        oscillator.stop(now + 0.05);
    },

    playUFO(ctx, now) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.linearRampToValueAtTime(600, now + 0.5);
        oscillator.frequency.linearRampToValueAtTime(400, now + 1);
        
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.setValueAtTime(0.2, now + 1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.1);

        oscillator.start(now);
        oscillator.stop(now + 1.1);
    },

    playPlayerHit(ctx, now) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'square';
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.setValueAtTime(300, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.5);
        
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        oscillator.start(now);
        oscillator.stop(now + 0.5);
    },

    playGameOver(ctx, now) {
        for (let i = 0; i < 3; i++) {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            const startTime = now + i * 0.2;
            oscillator.frequency.setValueAtTime(440 - i * 100, startTime);
            oscillator.frequency.exponentialRampToValueAtTime(110 - i * 20, startTime + 0.3);
            
            gainNode.gain.setValueAtTime(0.3, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

            oscillator.start(startTime);
            oscillator.stop(startTime + 0.3);
        }
    },

    playNewWave(ctx, now) {
        const notes = [440, 554, 659, 880];
        notes.forEach((freq, i) => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            const startTime = now + i * 0.1;
            oscillator.frequency.setValueAtTime(freq, startTime);
            
            gainNode.gain.setValueAtTime(0.2, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

            oscillator.start(startTime);
            oscillator.stop(startTime + 0.15);
        });
    }
};
