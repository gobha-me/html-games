// Stats — WPM calculation, accuracy tracking, localStorage persistence
export class Stats {
    constructor() {
        this.startTime = null;
        this.totalKeystrokes = 0;
        this.correctKeystrokes = 0;
        this.wordsCompleted = 0;
        this.totalCharsTyped = 0;
        this.combo = 0;
        this.maxCombo = 0;
    }

    start() {
        this.startTime = performance.now();
    }

    recordKeystroke(correct) {
        this.totalKeystrokes++;
        if (correct) {
            this.correctKeystrokes++;
            this.totalCharsTyped++;
        }
    }

    recordWordComplete() {
        this.wordsCompleted++;
        this.combo++;
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }
    }

    recordMiss() {
        this.combo = 0;
    }

    getElapsedSeconds() {
        if (!this.startTime) return 0;
        return (performance.now() - this.startTime) / 1000;
    }

    // Words per minute (based on correct characters, 5 chars = 1 word)
    getWPM() {
        const minutes = this.getElapsedSeconds() / 60;
        if (minutes === 0) return 0;
        return Math.round((this.correctKeystrokes / 5) / minutes);
    }

    // Accuracy percentage
    getAccuracy() {
        if (this.totalKeystrokes === 0) return 100;
        return Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100);
    }

    getScore() {
        // Base score: words completed * 10
        // Combo bonus: each combo adds 5 extra
        // Accuracy bonus: multiplier based on accuracy
        const baseScore = this.wordsCompleted * 10;
        const comboBonus = this.combo > 1 ? (this.combo - 1) * 5 : 0;
        const accuracyMultiplier = this.getAccuracy() / 100;
        return Math.round((baseScore + comboBonus) * accuracyMultiplier);
    }

    getSummary() {
        return {
            score: this.getScore(),
            wpm: this.getWPM(),
            accuracy: this.getAccuracy(),
            wordsCompleted: this.wordsCompleted,
            maxCombo: this.maxCombo,
            elapsed: Math.round(this.getElapsedSeconds())
        };
    }

    // Persist high scores to localStorage
    saveHighScore(mode, score) {
        const key = `typing_highscore_${mode}`;
        const current = parseInt(localStorage.getItem(key) || '0', 10);
        if (score > current) {
            localStorage.setItem(key, score.toString());
            return true; // new high score
        }
        return false;
    }

    getHighScore(mode) {
        return parseInt(localStorage.getItem(`typing_highscore_${mode}`) || '0', 10);
    }

    saveBestWPM(wpm) {
        const current = parseInt(localStorage.getItem('typing_best_wpm') || '0', 10);
        if (wpm > current) {
            localStorage.setItem('typing_best_wpm', wpm.toString());
            return true;
        }
        return false;
    }

    getBestWPM() {
        return parseInt(localStorage.getItem('typing_best_wpm') || '0', 10);
    }

    reset() {
        this.startTime = null;
        this.totalKeystrokes = 0;
        this.correctKeystrokes = 0;
        this.wordsCompleted = 0;
        this.totalCharsTyped = 0;
        this.combo = 0;
        this.maxCombo = 0;
    }
}
