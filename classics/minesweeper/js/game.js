/**
 * Minesweeper — HTML Games
 * Classic Minesweeper with modern UI, three difficulty levels,
 * first-click safety, chord-reveal, and best-time tracking.
 */

// ── Difficulty presets ──
const DIFFICULTIES = {
    easy:   { rows: 9,  cols: 9,  mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard:   { rows: 16, cols: 30, mines: 99 },
};

// ── DOM refs ──
const boardEl       = document.getElementById('board');
const mineCountEl   = document.getElementById('mine-count');
const timerEl       = document.getElementById('timer');
const bestTimeEl    = document.getElementById('best-time');
const newGameBtn    = document.getElementById('new-game-btn');
const diffBtns      = document.querySelectorAll('.diff-btn');

// ── Game state ──
let grid       = [];   // 2-D array of cell objects
let rows       = 0;
let cols       = 0;
let totalMines = 0;
let revealed   = 0;
let flagged    = 0;
let gameOver   = false;
let firstClick = true;
let timer      = 0;
let timerId    = null;
let difficulty = 'easy';

// ── Cell factory ──
function createCell(r, c) {
    return { r, c, mine: false, revealed: false, flagged: false, count: 0 };
}

// ── Initialise empty grid ──
function initGrid() {
    grid = [];
    for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
            grid[r][c] = createCell(r, c);
        }
    }
}

// ── Place mines (avoid first-click cell and its neighbours) ──
function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < totalMines) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        // skip safe zone
        if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
        if (grid[r][c].mine) continue;
        grid[r][c].mine = true;
        placed++;
    }
    // compute neighbour counts
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c].mine) continue;
            grid[r][c].count = countAdjacentMines(r, c);
        }
    }
}

function countAdjacentMines(r, c) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].mine) {
                count++;
            }
        }
    }
    return count;
}

// ── Render the board DOM ──
function renderBoard() {
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 32px)`;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.addEventListener('click', onLeftClick);
            cell.addEventListener('contextmenu', onRightClick);
            cell.addEventListener('auxclick', onMiddleClick);
            boardEl.appendChild(cell);
        }
    }
}

function getCellEl(r, c) {
    return boardEl.children[r * cols + c];
}

function refreshCell(r, c) {
    const cell = grid[r][c];
    const el = getCellEl(r, c);
    el.className = 'cell';
    el.textContent = '';

    if (cell.revealed) {
        el.classList.add('revealed');
        if (cell.mine) {
            el.classList.add('mine');
        } else if (cell.count > 0) {
            el.textContent = cell.count;
            el.classList.add('n' + cell.count);
        }
    } else if (cell.flagged) {
        el.classList.add('flagged');
    }
}

// ── Reveal logic ──
function reveal(r, c) {
    const cell = grid[r][c];
    if (cell.revealed || cell.flagged || gameOver) return;

    cell.revealed = true;
    revealed++;
    refreshCell(r, c);

    if (cell.mine) {
        const el = getCellEl(r, c);
        el.classList.add('mine-hit');
        if (typeof ArcadeSFX !== 'undefined') ArcadeSFX.explosion(0.25, 0.16);
        endGame(false);
        return;
    }

    if (typeof ArcadeSFX !== 'undefined' && cell.count > 0) {
        ArcadeSFX.beep(480 + cell.count * 60, 0.04, 'sine', 0.06);
    }

    // flood-fill for empty cells
    if (cell.count === 0) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                    reveal(nr, nc);
                }
            }
        }
    }

    checkWin();
}

// ── Chord reveal (middle-click on a number) ──
function chordReveal(r, c) {
    const cell = grid[r][c];
    if (!cell.revealed || cell.count === 0) return;

    // count adjacent flags
    let adjFlags = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].flagged) {
                adjFlags++;
            }
        }
    }

    if (adjFlags === cell.count) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !grid[nr][nc].flagged) {
                    reveal(nr, nc);
                }
            }
        }
    }
}

// ── Flag / unflag ──
function toggleFlag(r, c) {
    const cell = grid[r][c];
    if (cell.revealed || gameOver) return;
    cell.flagged = !cell.flagged;
    flagged += cell.flagged ? 1 : -1;
    if (typeof ArcadeSFX !== 'undefined') ArcadeSFX.beep(cell.flagged ? 660 : 380, 0.05, 'triangle', 0.07);
    mineCountEl.textContent = totalMines - flagged;
    refreshCell(r, c);
}

// ── Event handlers ──
function onLeftClick(e) {
    e.preventDefault();
    const r = +e.target.dataset.r;
    const c = +e.target.dataset.c;
    if (firstClick) {
        firstClick = false;
        placeMines(r, c);
        startTimer();
    }
    reveal(r, c);
}

function onRightClick(e) {
    e.preventDefault();
    const r = +e.target.dataset.r;
    const c = +e.target.dataset.c;
    toggleFlag(r, c);
}

function onMiddleClick(e) {
    e.preventDefault();
    const r = +e.target.dataset.r;
    const c = +e.target.dataset.c;
    chordReveal(r, c);
}

// ── Timer ──
function startTimer() {
    stopTimer();
    timer = 0;
    timerEl.textContent = '000';
    timerId = setInterval(() => {
        timer++;
        timerEl.textContent = String(timer).padStart(3, '0');
        if (timer >= 999) stopTimer();
    }, 1000);
}

function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
}

// ── Win / Lose ──
function checkWin() {
    const safeCells = rows * cols - totalMines;
    if (revealed === safeCells) {
        endGame(true);
    }
}

function endGame(won) {
    gameOver = true;
    stopTimer();

    if (won) {
        if (typeof ArcadeSFX !== 'undefined') ArcadeSFX.playPattern([523, 659, 784, 1046], 0.1, 0.04, 'triangle', 0.1);
        newGameBtn.textContent = '😎 You Win!';
        // auto-flag remaining mines
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c].mine && !grid[r][c].flagged) {
                    grid[r][c].flagged = true;
                    refreshCell(r, c);
                }
            }
        }
        mineCountEl.textContent = '0';
        saveBestTime();
    } else {
        newGameBtn.textContent = '💥 Game Over';
        // reveal all mines
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c].mine && !grid[r][c].revealed) {
                    grid[r][c].revealed = true;
                    refreshCell(r, c);
                }
            }
        }
    }
}

// ── Best time (localStorage) ──
function loadBestTime() {
    const key = `minesweeper_best_${difficulty}`;
    const val = localStorage.getItem(key);
    return val ? parseInt(val, 10) : null;
}

function saveBestTime() {
    const key = `minesweeper_best_${difficulty}`;
    const current = loadBestTime();
    if (current === null || timer < current) {
        localStorage.setItem(key, timer);
        bestTimeEl.textContent = String(timer).padStart(3, '0');
    }
}

function displayBestTime() {
    const best = loadBestTime();
    bestTimeEl.textContent = best !== null ? String(best).padStart(3, '0') : '--';
}

// ── New game ──
function newGame() {
    stopTimer();
    const cfg = DIFFICULTIES[difficulty];
    rows = cfg.rows;
    cols = cfg.cols;
    totalMines = cfg.mines;
    revealed = 0;
    flagged = 0;
    gameOver = false;
    firstClick = true;
    timer = 0;

    mineCountEl.textContent = totalMines;
    timerEl.textContent = '000';
    newGameBtn.textContent = '😊 New Game';
    displayBestTime();

    initGrid();
    renderBoard();
}

// ── Difficulty buttons ──
diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        diffBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        difficulty = btn.dataset.diff;
        newGame();
    });
});

newGameBtn.addEventListener('click', newGame);

// ── Start ──
newGame();
