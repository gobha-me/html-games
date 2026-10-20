// Main — entry point, UI management, event handling
import { Game } from './game.js';
import { wordLists } from './word-lists.js';

// DOM elements
const canvas = document.getElementById('game-canvas');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('gameover-screen');
const pauseOverlay = document.getElementById('pause-overlay');
const hud = document.getElementById('hud');
const inputBar = document.getElementById('input-bar');
const inputDisplay = document.getElementById('input-display');

const scoreDisplay = document.getElementById('hud-score');
const wpmDisplay = document.getElementById('hud-wpm');
const accuracyDisplay = document.getElementById('hud-accuracy');
const livesContainer = document.getElementById('hud-lives');

const finalScore = document.getElementById('final-score');
const finalWPM = document.getElementById('final-wpm');
const finalAccuracy = document.getElementById('final-accuracy');
const finalWords = document.getElementById('final-words');
const finalCombo = document.getElementById('final-combo');
const finalMode = document.getElementById('final-mode');

const modeButtons = document.querySelectorAll('.mode-btn');
const wordlistButtons = document.querySelectorAll('.wordlist-btn');
const startBtn = document.getElementById('start-btn');
const playAgainBtn = document.getElementById('play-again-btn');

// State
let game = null;
let selectedMode = 'endless';
let selectedWordList = 'english';

// Initialize game
game = new Game(canvas);

// ── Mode selection ──
modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedMode = btn.dataset.mode;
        game.setMode(selectedMode);
        game.audio.selectClick();
    });
});

// ── Word list selection ──
wordlistButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        wordlistButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedWordList = btn.dataset.list;
        game.setWordList(selectedWordList);
        game.audio.selectClick();
    });
});

// ── Start game ──
startBtn.addEventListener('click', () => {
    game.setMode(selectedMode);
    game.setWordList(selectedWordList);
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.style.display = 'flex';
    inputBar.style.display = 'flex';
    updateLivesDisplay(3);
    game.start();
});

// ── Play again ──
playAgainBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

// ── Keyboard input ──
document.addEventListener('keydown', (e) => {
    // Ignore if in menu screens
    if (!game.running || game.gameOver) {
        // Allow Enter/Space to start from start screen
        if (!startScreen.classList.contains('hidden') && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            startBtn.click();
        }
        return;
    }

    // Pause toggle
    if (e.key === 'Escape') {
        e.preventDefault();
        game.togglePause();
        pauseOverlay.classList.toggle('hidden', !game.paused);
        return;
    }

    if (game.paused) return;

    // Handle typing
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        game.handleKeyPress(e.key.toLowerCase());
        updateInputDisplay();
    }

    // Backspace resets current word
    if (e.key === 'Backspace') {
        e.preventDefault();
        game.handleBackspace();
        updateInputDisplay();
    }
});

// ── Game callbacks ──
game.onLifeLost = (lives) => {
    updateLivesDisplay(lives);
};

game.onWordComplete = (combo) => {
    updateInputDisplay();
};

game.onStatsUpdate = (summary) => {
    scoreDisplay.textContent = summary.score;
    wpmDisplay.textContent = summary.wpm;
    accuracyDisplay.textContent = summary.accuracy + '%';
};

game.onTimerUpdate = (time) => {
    // Timer is rendered on canvas
};

game.onGameOver = (summary) => {
    hud.style.display = 'none';
    inputBar.style.display = 'none';
    pauseOverlay.classList.add('hidden');

    // Populate game over screen
    finalScore.textContent = summary.score;
    finalWPM.textContent = summary.wpm;
    finalAccuracy.textContent = summary.accuracy + '%';
    finalWords.textContent = summary.wordsCompleted;
    finalCombo.textContent = summary.maxCombo;
    finalMode.textContent = summary.mode === 'timed' ? 'Timed 60s' : 'Endless';

    // Show new best indicators
    const scoreCard = finalScore.closest('.stat-card');
    const wpmCard = finalWPM.closest('.stat-card');
    scoreCard.classList.toggle('new-best', summary.newHighScore);
    wpmCard.classList.toggle('new-best', summary.newBestWPM);

    gameOverScreen.classList.remove('hidden');
};

// ── UI helpers ──
function updateLivesDisplay(lives) {
    livesContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const heart = document.createElement('span');
        heart.className = 'heart' + (i >= lives ? ' lost' : '');
        heart.textContent = '❤️';
        livesContainer.appendChild(heart);
    }
}

function updateInputDisplay() {
    if (!game || !game.targetWord || !game.targetWord.alive) {
        inputDisplay.innerHTML = '<span class="cursor"></span>';
        return;
    }

    const matched = game.targetWord.getMatchedText();
    const remaining = game.targetWord.getRemainingText();
    inputDisplay.innerHTML =
        `<span class="matched">${matched}</span>${remaining}<span class="cursor"></span>`;
}

// ── Resize handling ──
window.addEventListener('resize', () => {
    if (game && game.renderer) {
        game.renderer.resize();
        game.spawner.setCanvasWidth(canvas.clientWidth);
    }
});

// ── Initial setup ──
updateLivesDisplay(3);
updateInputDisplay();

// Select defaults
document.querySelector('.mode-btn[data-mode="endless"]').classList.add('selected');
document.querySelector('.wordlist-btn[data-list="english"]').classList.add('selected');
