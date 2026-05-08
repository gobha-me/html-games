// Game — main game loop and state management
import { WordSpawner } from './word-spawner.js';
import { Renderer } from './renderer.js';
import { Stats } from './stats.js';
import { Audio } from './audio.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.spawner = new WordSpawner();
        this.stats = new Stats();
        this.audio = new Audio();

        this.mode = 'endless'; // 'endless' or 'timed'
        this.lives = 3;
        this.maxLives = 3;
        this.timedDuration = 60;
        this.timeRemaining = 60;

        this.running = false;
        this.paused = false;
        this.gameOver = false;

        this.lastTime = 0;
        this.targetWord = null; // the word currently being typed

        this.onGameOver = null;
        this.onLifeLost = null;
        this.onWordComplete = null;
        this.onStatsUpdate = null;
        this.onTimerUpdate = null;
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'timed') {
            this.timeRemaining = this.timedDuration;
        }
    }

    setWordList(name) {
        this.spawner.setWordList(name);
    }

    start() {
        this.spawner.setCanvasWidth(this.canvas.clientWidth);
        this.spawner.reset();
        this.stats.reset();
        this.renderer.particles = [];

        this.lives = this.maxLives;
        this.timeRemaining = this.timedDuration;
        this.running = true;
        this.paused = false;
        this.gameOver = false;
        this.targetWord = null;

        this.stats.start();
        this.lastTime = performance.now();
        this.audio.init();

        requestAnimationFrame((t) => this.loop(t));
    }

    loop(timestamp) {
        if (!this.running) return;

        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        if (!this.paused && !this.gameOver) {
            this.update(dt);
        }

        this.render();

        if (this.running) {
            requestAnimationFrame((t) => this.loop(t));
        }
    }

    update(dt) {
        // Update spawner
        this.spawner.update(dt);

        // Update words
        const words = this.spawner.getActiveWords();
        for (const word of words) {
            word.update(dt, this.canvas.clientHeight);

            // Check if word hit bottom
            if (word.hitBottom && !word._missHandled) {
                word._missHandled = true;
                this.handleMissedWord(word);
            }
        }

        // Clean up dead words
        for (const word of [...words]) {
            if (!word.alive && !word.isDying) {
                this.spawner.removeWord(word);
                if (this.targetWord === word) {
                    this.targetWord = null;
                }
            }
        }

        // Update particles
        this.renderer.updateParticles(dt);

        // Timed mode countdown
        if (this.mode === 'timed') {
            this.timeRemaining -= dt;
            if (this.timeRemaining <= 0) {
                this.timeRemaining = 0;
                this.endGame();
            }
            if (this.onTimerUpdate) {
                this.onTimerUpdate(this.timeRemaining);
            }
        }

        // Update stats display
        if (this.onStatsUpdate) {
            this.onStatsUpdate(this.stats.getSummary());
        }
    }

    handleMissedWord(word) {
        this.lives--;
        this.stats.recordMiss();
        this.audio.wordMissed();

        if (this.onLifeLost) {
            this.onLifeLost(this.lives);
        }

        if (this.lives <= 0) {
            this.endGame();
        }
    }

    handleKeyPress(char) {
        if (!this.running || this.paused || this.gameOver) return;

        // If no target word, find the lowest active word
        if (!this.targetWord || !this.targetWord.alive || this.targetWord.isDying) {
            const words = this.spawner.getActiveWords().filter(w => !w.isDying && !w.hitBottom);
            if (words.length === 0) return;
            this.targetWord = words.sort((a, b) => b.y - a.y)[0];
        }

        const result = this.targetWord.typeChar(char);

        if (result.result === 'match') {
            this.stats.recordKeystroke(true);
            this.audio.typeCorrect();
        } else if (result.result === 'complete') {
            this.stats.recordKeystroke(true);
            this.stats.recordWordComplete();
            this.spawner.increaseDifficulty();
            this.audio.wordComplete();

            // Spawn particles
            this.renderer.spawnParticles(
                this.targetWord.x + 20,
                this.targetWord.y,
                15,
                '#2ed573'
            );

            // Combo milestone sound
            if (this.stats.combo > 0 && this.stats.combo % 5 === 0) {
                this.audio.comboMilestone();
            }

            if (this.onWordComplete) {
                this.onWordComplete(this.stats.combo);
            }

            this.targetWord = null;
        } else if (result.result === 'mismatch') {
            this.stats.recordKeystroke(false);
            this.audio.typeWrong();
        }
    }

    handleBackspace() {
        // In this game, backspace resets the current target word progress
        if (this.targetWord && this.targetWord.matched > 0) {
            this.targetWord.matched = 0;
        }
    }

    togglePause() {
        if (this.gameOver) return;
        this.paused = !this.paused;
        if (!this.paused) {
            this.lastTime = performance.now();
        }
    }

    endGame() {
        this.gameOver = true;
        this.running = false;
        this.audio.gameOver();

        const summary = this.stats.getSummary();

        // Save high scores
        const newHighScore = this.stats.saveHighScore(this.mode, summary.score);
        const newBestWPM = this.stats.saveBestWPM(summary.wpm);

        if (this.onGameOver) {
            this.onGameOver({
                ...summary,
                newHighScore,
                newBestWPM,
                mode: this.mode
            });
        }
    }

    render() {
        this.renderer.clear();
        this.renderer.drawDangerZone();

        const words = this.spawner.getActiveWords();
        this.renderer.drawWords(words);

        // Draw combo
        if (this.stats.combo >= 2) {
            this.renderer.drawCombo(this.stats.combo, this.canvas.clientWidth / 2, this.canvas.clientHeight - 80);
        }

        // Draw timer for timed mode
        if (this.mode === 'timed') {
            this.renderer.drawTimer(this.timeRemaining);
        }
    }
}
