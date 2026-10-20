/**
 * 2048 — Power Tiles Edition
 * Classic 2048 with a twist: every 10 moves a special "power tile" (⚡)
 * spawns. When two power tiles merge, they clear all tiles in a 3×3 area
 * centered on the merge point, giving you breathing room on a crowded board.
 */
(function () {
    'use strict';

    const SIZE = 4;
    const POWER_INTERVAL = 10;

    // DOM refs
    const tileLayer = document.getElementById('tile-layer');
    const scoreEl = document.getElementById('score');
    const bestEl = document.getElementById('best');
    const undoBtn = document.getElementById('undo-btn');
    const newGameBtn = document.getElementById('new-game-btn');
    const overlay = document.getElementById('overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayBtn = document.getElementById('overlay-btn');

    // State
    let grid;       // SIZE x SIZE array of { value, isPower, id }
    let score;
    let best;
    let moveCount;
    let won;
    let gameOver;
    let keepPlaying;
    let prevState;  // for undo
    let tileIdCounter;

    // ── Helpers ──
    function emptyGrid() {
        return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    }

    function cloneGrid(g) {
        return g.map(row => row.map(cell => cell ? { ...cell } : null));
    }

    function emptyCells(g) {
        const cells = [];
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++)
                if (!g[r][c]) cells.push({ r, c });
        return cells;
    }

    function spawnTile(g, forcePower) {
        const empty = emptyCells(g);
        if (!empty.length) return;
        const { r, c } = empty[Math.floor(Math.random() * empty.length)];
        const isPower = forcePower || (Math.random() < 0.05); // 5% chance normally
        g[r][c] = {
            value: isPower ? 2 : (Math.random() < 0.9 ? 2 : 4),
            isPower,
            id: ++tileIdCounter,
            isNew: true
        };
    }

    function saveState() {
        prevState = {
            grid: cloneGrid(grid),
            score,
            moveCount,
            won,
            keepPlaying
        };
        undoBtn.disabled = false;
    }

    // ── Movement ──
    function slideRow(row) {
        // Returns { newRow, scoreDelta, powerMerged }
        // powerMerged: index in newRow where power tiles merged (for explosion)
        let filtered = row.filter(Boolean);
        let merged = [];
        let scoreDelta = 0;
        let powerMerged = -1;
        let i = 0;

        while (i < filtered.length) {
            if (i + 1 < filtered.length && filtered[i].value === filtered[i + 1].value) {
                const newVal = filtered[i].value * 2;
                const isPower = filtered[i].isPower && filtered[i + 1].isPower;
                scoreDelta += newVal;
                merged.push({
                    value: newVal,
                    isPower,
                    id: ++tileIdCounter,
                    wasMerged: true
                });
                if (isPower) {
                    powerMerged = merged.length - 1;
                }
                i += 2;
            } else {
                merged.push({ ...filtered[i] });
                i++;
            }
        }

        while (merged.length < SIZE) merged.push(null);
        return { newRow: merged, scoreDelta, powerMerged };
    }

    function move(dir) {
        // dir: 'left', 'right', 'up', 'down'
        saveState();

        let moved = false;
        let totalScore = 0;
        let powerExplosions = []; // [{r, c}] positions of power merges

        const getRow = (i, d) => {
            switch (d) {
                case 'left':  return grid[i].slice();
                case 'right': return grid[i].slice().reverse();
                case 'up':    return [grid[0][i], grid[1][i], grid[2][i], grid[3][i]];
                case 'down':  return [grid[3][i], grid[2][i], grid[1][i], grid[0][i]];
            }
        };

        const setRow = (i, d, row) => {
            switch (d) {
                case 'left':  grid[i] = row; break;
                case 'right': grid[i] = row.reverse(); break;
                case 'up':
                    for (let j = 0; j < SIZE; j++) grid[j][i] = row[j];
                    break;
                case 'down':
                    for (let j = 0; j < SIZE; j++) grid[SIZE - 1 - j][i] = row[j];
                    break;
            }
        };

        for (let i = 0; i < SIZE; i++) {
            const row = getRow(i, dir);
            const orig = row.map(c => c ? c.value : 0).join(',');
            const result = slideRow(row);
            const after = result.newRow.map(c => c ? c.value : 0).join(',');

            if (orig !== after) moved = true;
            totalScore += result.scoreDelta;
            setRow(i, dir, result.newRow);

            if (result.powerMerged >= 0) {
                // Calculate the actual board position of the merge
                let mergePos;
                switch (dir) {
                    case 'left':  mergePos = { r: i, c: result.powerMerged }; break;
                    case 'right': mergePos = { r: i, c: SIZE - 1 - result.powerMerged }; break;
                    case 'up':    mergePos = { r: result.powerMerged, c: i }; break;
                    case 'down':  mergePos = { r: SIZE - 1 - result.powerMerged, c: i }; break;
                }
                powerExplosions.push(mergePos);
            }
        }

        // Apply power tile explosions
        for (const { r, c } of powerExplosions) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
                        if (grid[nr][nc]) {
                            totalScore += grid[nr][nc].value; // score for cleared tiles
                            grid[nr][nc] = null;
                        }
                    }
                }
            }
        }

        if (!moved) {
            prevState = null; // don't save if nothing happened
            return false;
        }

        if (typeof ArcadeSFX !== 'undefined') {
            if (powerExplosions.length > 0) {
                ArcadeSFX.explosion(0.18, 0.14);
            } else if (totalScore > 0) {
                ArcadeSFX.beep(520 + Math.min(totalScore, 512), 0.07, 'triangle', 0.08);
            } else {
                ArcadeSFX.blip(0.03, 0.05);
            }
        }

        score += totalScore;
        moveCount++;

        // Spawn new tile
        const spawnPower = (moveCount % POWER_INTERVAL === 0);
        spawnTile(grid, spawnPower);

        // Check win
        if (!won && !keepPlaying) {
            for (let r = 0; r < SIZE; r++)
                for (let c = 0; c < SIZE; c++)
                    if (grid[r][c] && grid[r][c].value === 2048) {
                        won = true;
                        showOverlay('win');
                    }
        }

        // Check game over
        if (!canMove()) {
            gameOver = true;
            showOverlay('lose');
        }

        updateUI();
        return true;
    }

    function canMove() {
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++) {
                if (!grid[r][c]) return true;
                const v = grid[r][c].value;
                if (c < SIZE - 1 && grid[r][c + 1] && grid[r][c + 1].value === v) return true;
                if (r < SIZE - 1 && grid[r + 1][c] && grid[r + 1][c].value === v) return true;
            }
        return false;
    }

    // ── Rendering ──
    function getTilePos(r, c) {
        const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size')) || 80;
        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 10;
        return {
            x: c * (cellSize + gap),
            y: r * (cellSize + gap)
        };
    }

    function render() {
        tileLayer.innerHTML = '';

        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const cell = grid[r][c];
                if (!cell) continue;

                const pos = getTilePos(r, c);
                const el = document.createElement('div');
                el.className = 'tile';

                // Value class
                if (cell.value <= 2048) {
                    el.classList.add(`tile-${cell.value}`);
                } else {
                    el.classList.add('tile-super');
                }

                if (cell.isPower) {
                    el.classList.add('power-tile');
                    el.textContent = '⚡';
                } else {
                    el.textContent = cell.value;
                }

                if (cell.isNew) {
                    el.classList.add('new');
                    cell.isNew = false;
                }
                if (cell.wasMerged) {
                    el.classList.add('merged');
                    cell.wasMerged = false;
                }

                el.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
                tileLayer.appendChild(el);
            }
        }
    }

    function updateUI() {
        scoreEl.textContent = score;
        if (score > best) {
            best = score;
            localStorage.setItem('2048-best', best);
        }
        bestEl.textContent = best;
        render();
    }

    // ── Overlay ──
    function showOverlay(type) {
        overlay.className = `overlay active ${type}`;
        if (type === 'win') {
            if (typeof ArcadeSFX !== 'undefined') ArcadeSFX.playPattern([523, 659, 784, 1046], 0.1, 0.04, 'triangle', 0.1);
            overlayTitle.textContent = '🎉 You reached 2048!';
            overlayBtn.textContent = 'Keep Playing';
            overlayBtn.onclick = () => {
                keepPlaying = true;
                overlay.className = 'overlay';
            };
        } else {
            overlayTitle.textContent = '💀 Game Over';
            overlayBtn.textContent = 'Try Again';
            overlayBtn.onclick = () => {
                overlay.className = 'overlay';
                newGame();
            };
        }
    }

    // ── Undo ──
    function undo() {
        if (!prevState) return;
        grid = prevState.grid;
        score = prevState.score;
        moveCount = prevState.moveCount;
        won = prevState.won;
        keepPlaying = prevState.keepPlaying;
        prevState = null;
        undoBtn.disabled = true;
        overlay.className = 'overlay';
        gameOver = false;
        updateUI();
    }

    // ── New Game ──
    function newGame() {
        grid = emptyGrid();
        score = 0;
        moveCount = 0;
        won = false;
        gameOver = false;
        keepPlaying = false;
        prevState = null;
        tileIdCounter = 0;
        undoBtn.disabled = true;
        overlay.className = 'overlay';

        spawnTile(grid);
        spawnTile(grid);
        updateUI();
    }

    // ── Input ──
    const KEY_MAP = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        a: 'left', d: 'right', w: 'up', s: 'down',
        A: 'left', D: 'right', W: 'up', S: 'down'
    };

    document.addEventListener('keydown', (e) => {
        const dir = KEY_MAP[e.key];
        if (dir && !gameOver) {
            e.preventDefault();
            move(dir);
        }
        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            undo();
        }
    });

    // Touch / swipe support
    let touchStartX, touchStartY;
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (gameOver) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) < 30) return; // too small

        if (absDx > absDy) {
            move(dx > 0 ? 'right' : 'left');
        } else {
            move(dy > 0 ? 'down' : 'up');
        }
    }, { passive: true });

    // Buttons
    undoBtn.addEventListener('click', undo);
    newGameBtn.addEventListener('click', newGame);

    // ── Init ──
    best = parseInt(localStorage.getItem('2048-best') || '0', 10);
    newGame();
})();
