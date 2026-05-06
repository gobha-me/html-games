// High Score Table Manager - localStorage-backed top 10 list

const HighScoreManager = {
    STORAGE_KEY: 'spaceInvadersHighScores',
    MAX_ENTRIES: 10,

    scores: [],

    init() {
        this.load();
    },

    load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            this.scores = data ? JSON.parse(data) : [];
        } catch (e) {
            this.scores = [];
        }
        // Ensure sorted descending
        this.scores.sort((a, b) => b.score - a.score);
        // Trim to max entries
        if (this.scores.length > this.MAX_ENTRIES) {
            this.scores = this.scores.slice(0, this.MAX_ENTRIES);
        }
    },

    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.scores));
    },

    /**
     * Check if a score qualifies for the top 10.
     * Returns true if the table isn't full or the score beats the lowest entry.
     */
    qualifies(score) {
        if (this.scores.length < this.MAX_ENTRIES) return true;
        return score > this.scores[this.scores.length - 1].score;
    },

    /**
     * Get the minimum score needed to enter the table.
     * Returns 0 if the table isn't full yet.
     */
    getMinScore() {
        if (this.scores.length < this.MAX_ENTRIES) return 0;
        return this.scores[this.scores.length - 1].score;
    },

    /**
     * Add a new entry and save. Returns the rank (1-based) of the new entry.
     */
    addEntry(initials, score) {
        this.scores.push({ initials: initials.toUpperCase(), score, date: Date.now() });
        this.scores.sort((a, b) => b.score - a.score);
        if (this.scores.length > this.MAX_ENTRIES) {
            this.scores = this.scores.slice(0, this.MAX_ENTRIES);
        }
        this.save();
        // Return rank (1-based index)
        return this.scores.findIndex(e => e.initials === initials && e.score === score) + 1;
    },

    /**
     * Get all scores as an array of {initials, score, date}.
     */
    getAll() {
        return [...this.scores];
    },

    /**
     * Get the highest score (for backward compatibility with single high score display).
     */
    getTopScore() {
        return this.scores.length > 0 ? this.scores[0].score : 0;
    },

    /**
     * Reset all high scores.
     */
    reset() {
        this.scores = [];
        localStorage.removeItem(this.STORAGE_KEY);
    }
};
