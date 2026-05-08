// Word spawner — manages word creation, difficulty scaling, and word list selection
import { getWords } from './word-lists.js';
import { Word } from './word.js';

export class WordSpawner {
    constructor(config = {}) {
        this.wordListName = config.wordList || 'english';
        this.spawnInterval = config.spawnInterval || 2.5; // seconds between spawns
        this.baseSpeed = config.baseSpeed || 30; // pixels per second
        this.minSpawnX = config.minSpawnX || 60;
        this.maxSpawnX = config.maxSpawnX || 0; // set from canvas width
        this.canvasWidth = config.canvasWidth || 800;

        this.timeSinceLastSpawn = 0;
        this.activeWords = [];
        this.score = 0;
        this.wordsCompleted = 0;
        this.difficultyLevel = 0;

        // Difficulty scaling
        this.spawnIntervalMin = 0.8;
        this.spawnIntervalDecay = 0.03; // seconds less per level
        this.speedIncrease = 3; // px/s per level
        this.levelThreshold = 5; // words completed per level

        // Word length progression
        this.currentDifficulty = 'easy';
        this.difficultyProgression = ['easy', 'medium', 'hard'];
    }

    setCanvasWidth(width) {
        this.canvasWidth = width;
        this.maxSpawnX = width - 150;
    }

    setWordList(name) {
        this.wordListName = name;
    }

    update(dt) {
        this.timeSinceLastSpawn += dt;

        // Spawn new word when interval elapsed
        if (this.timeSinceLastSpawn >= this.spawnInterval) {
            this.spawnWord();
            this.timeSinceLastSpawn = 0;
        }
    }

    spawnWord() {
        const words = getWords(this.wordListName, this.currentDifficulty);
        const text = words[Math.floor(Math.random() * words.length)];

        // Find a spawn position that doesn't overlap too much with existing words
        const x = this.findSpawnPosition();

        const speed = this.baseSpeed + (this.difficultyLevel * this.speedIncrease);
        const word = new Word(text, x, -20, speed);
        this.activeWords.push(word);
    }

    findSpawnPosition() {
        // Try to find a position not too close to existing words
        const attempts = 5;
        for (let i = 0; i < attempts; i++) {
            const x = this.minSpawnX + Math.random() * (this.maxSpawnX - this.minSpawnX);
            const tooClose = this.activeWords.some(w =>
                !w.isDying && Math.abs(w.x - x) < 80 && w.y < 80
            );
            if (!tooClose) return x;
        }
        // Fallback: random position
        return this.minSpawnX + Math.random() * (this.maxSpawnX - this.minSpawnX);
    }

    increaseDifficulty() {
        this.wordsCompleted++;

        if (this.wordsCompleted % this.levelThreshold === 0) {
            this.difficultyLevel++;

            // Reduce spawn interval
            this.spawnInterval = Math.max(
                this.spawnIntervalMin,
                this.spawnInterval - this.spawnIntervalDecay
            );

            // Progress word difficulty
            const diffIndex = Math.min(
                Math.floor(this.difficultyLevel / 3),
                this.difficultyProgression.length - 1
            );
            this.currentDifficulty = this.difficultyProgression[diffIndex];
        }
    }

    removeWord(word) {
        const index = this.activeWords.indexOf(word);
        if (index > -1) {
            this.activeWords.splice(index, 1);
        }
    }

    getActiveWords() {
        return this.activeWords.filter(w => w.alive);
    }

    reset() {
        this.timeSinceLastSpawn = 0;
        this.activeWords = [];
        this.score = 0;
        this.wordsCompleted = 0;
        this.difficultyLevel = 0;
        this.spawnInterval = 2.5;
        this.currentDifficulty = 'easy';
    }
}
