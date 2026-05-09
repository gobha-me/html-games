/**
 * Tetris Core Game Logic
 * Handles piece movement, rotation, locking, line clears, and scoring.
 */

// Lock the current piece onto the board
function lockPiece() {
    const piece = GameState.currentPiece;
    const shape = getShape(piece);
    
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            const boardY = piece.y + r;
            const boardX = piece.x + c;
            
            // Game over if piece locks above the board
            if (boardY < 0) {
                endGame();
                return;
            }
            
            GameState.board[boardY][boardX] = {
                color: piece.color,
                type: piece.type,
            };
        }
    }
    
    // Check for line clears
    const clearedRows = checkLines();
    
    if (clearedRows.length > 0) {
        // Check for T-spin
        const isTSpin = piece.type === 'T' && checkTSpin(piece);
        
        // Start line clear animation
        GameState.isLineClearing = true;
        GameState.lineClearRows = clearedRows;
        GameState.lineClearAnimProgress = 0;
        
        // Spawn particles for cleared lines
        for (const row of clearedRows) {
            spawnLineParticles(row);
        }
        
        // Score after animation
        setTimeout(() => {
            clearLines(clearedRows);
            scoreLines(clearedRows.length, isTSpin);
            GameState.isLineClearing = false;
            GameState.lineClearRows = [];
            
            // Spawn next piece
            spawnPiece();
        }, CONFIG.LINE_CLEAR_ANIM_DURATION);
    } else {
        // Reset combo
        GameState.combo = -1;
        spawnPiece();
    }
    
    // Reset lock state
    GameState.isLocking = false;
    GameState.lockResets = 0;
    GameState.canHold = false;
}

// Check for completed lines
function checkLines() {
    const clearedRows = [];
    for (let r = 0; r < CONFIG.BOARD_HEIGHT; r++) {
        let full = true;
        for (let c = 0; c < CONFIG.BOARD_WIDTH; c++) {
            if (!GameState.board[r][c]) {
                full = false;
                break;
            }
        }
        if (full) {
            clearedRows.push(r);
        }
    }
    return clearedRows;
}

// Clear completed lines from the board
function clearLines(rows) {
    // Remove cleared rows (bottom to top to maintain indices)
    rows.sort((a, b) => b - a);
    for (const row of rows) {
        GameState.board.splice(row, 1);
        // Add empty row at top
        const emptyRow = [];
        for (let c = 0; c < CONFIG.BOARD_WIDTH; c++) {
            emptyRow.push(null);
        }
        GameState.board.unshift(emptyRow);
    }
}

// Check if a T-spin occurred
function checkTSpin(piece) {
    // T-spin: all 4 corners of the T piece's bounding box are filled
    // or the piece was rotated into its current position with wall kicks
    const corners = [
        [piece.x, piece.y],           // top-left
        [piece.x + 2, piece.y],       // top-right
        [piece.x, piece.y + 2],       // bottom-left
        [piece.x + 2, piece.y + 2],   // bottom-right
    ];
    
    let filledCorners = 0;
    for (const [cx, cy] of corners) {
        if (cx < 0 || cx >= CONFIG.BOARD_WIDTH || cy >= CONFIG.BOARD_HEIGHT) {
            filledCorners++; // Wall counts as filled
        } else if (cy >= 0 && GameState.board[cy][cx]) {
            filledCorners++;
        }
    }
    
    return filledCorners >= 3;
}

// Score line clears
function scoreLines(lineCount, isTSpin) {
    GameState.combo++;
    
    let baseScore = 0;
    
    if (isTSpin) {
        switch (lineCount) {
            case 0: baseScore = SCORING.T_SPIN_MINI; break;
            case 1: baseScore = SCORING.T_SPIN; break;
            case 2: baseScore = SCORING.T_SPIN_DOUBLE; break;
            case 3: baseScore = SCORING.T_SPIN_TRIPLE; break;
            case 4: baseScore = SCORING.TETRIS; break; // T-tetris still counts as tetris
        }
    } else {
        switch (lineCount) {
            case 1: baseScore = SCORING.SINGLE; break;
            case 2: baseScore = SCORING.DOUBLE; break;
            case 3: baseScore = SCORING.TRIPLE; break;
            case 4: baseScore = SCORING.TETRIS; break;
        }
    }
    
    // Level multiplier
    const score = baseScore * GameState.level;
    
    // Combo bonus
    if (GameState.combo > 0) {
        const comboBonus = (SCORING.COMBO_BASE + SCORING.COMBO_INCREMENT * GameState.combo) * GameState.level;
        GameState.score += score + comboBonus;
    } else {
        GameState.score += score;
    }
    
    // Update lines and level
    GameState.lines += lineCount;
    const newLevel = Math.floor(GameState.lines / 10) + 1;
    if (newLevel > GameState.level) {
        GameState.level = newLevel;
        GameState.dropInterval = getDropInterval(GameState.level);
    }
}

// Spawn particles for line clear
function spawnLineParticles(row) {
    for (let c = 0; c < CONFIG.BOARD_WIDTH; c++) {
        const cell = GameState.board[row][c];
        if (!cell) continue;
        
        for (let i = 0; i < 4; i++) {
            GameState.particles.push({
                x: c * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
                y: row * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8 - 2,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.02,
                color: cell.color,
                size: 2 + Math.random() * 3,
            });
        }
    }
}

// Spawn the next piece
function spawnPiece() {
    if (GameState.nextPieces.length === 0) {
        endGame();
        return;
    }
    
    const type = GameState.nextPieces.shift();
    GameState.nextPieces.push(getNextPiece());
    
    const piece = createPiece(type);
    
    // Check if spawn position is valid
    if (!isValidPosition(piece)) {
        endGame();
        return;
    }
    
    GameState.currentPiece = piece;
    GameState.isLocking = false;
    GameState.lockResets = 0;
}

// Move piece left
function moveLeft() {
    if (!GameState.currentPiece || GameState.isLineClearing) return;
    if (isValidPosition(GameState.currentPiece, -1, 0)) {
        GameState.currentPiece.x--;
        resetLockDelay();
    }
}

// Move piece right
function moveRight() {
    if (!GameState.currentPiece || GameState.isLineClearing) return;
    if (isValidPosition(GameState.currentPiece, 1, 0)) {
        GameState.currentPiece.x++;
        resetLockDelay();
    }
}

// Soft drop (move down faster)
function softDrop() {
    if (!GameState.currentPiece || GameState.isLineClearing) return;
    if (isValidPosition(GameState.currentPiece, 0, 1)) {
        GameState.currentPiece.y++;
        GameState.score += SCORING.SOFT_DROP;
        resetLockDelay();
    }
}

// Hard drop (instant drop)
function hardDrop() {
    if (!GameState.currentPiece || GameState.isLineClearing) return;
    
    const ghostY = getGhostY(GameState.currentPiece);
    const dropDistance = ghostY - GameState.currentPiece.y;
    GameState.score += dropDistance * SCORING.HARD_DROP;
    GameState.currentPiece.y = ghostY;
    
    // Spawn hard drop particles
    const shape = getShape(GameState.currentPiece);
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            const boardY = GameState.currentPiece.y + r;
            const boardX = GameState.currentPiece.x + c;
            if (boardY >= 0 && boardY < CONFIG.BOARD_HEIGHT) {
                for (let i = 0; i < 2; i++) {
                    GameState.particles.push({
                        x: boardX * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE / 2,
                        y: boardY * CONFIG.BLOCK_SIZE + CONFIG.BLOCK_SIZE,
                        vx: (Math.random() - 0.5) * 4,
                        vy: Math.random() * 2,
                        life: 0.8,
                        decay: 0.03,
                        color: GameState.currentPiece.color,
                        size: 2 + Math.random() * 2,
                    });
                }
            }
        }
    }
    
    lockPiece();
}

// Rotate piece (CW or CCW)
function rotate(direction = 1) {
    if (!GameState.currentPiece || GameState.isLineClearing) return;
    if (GameState.currentPiece.type === 'O') return; // O doesn't rotate
    
    const piece = GameState.currentPiece;
    const oldRotation = piece.rotation;
    const newRotation = (oldRotation + direction + 4) % 4;
    
    // Determine kick table
    const kickTable = piece.type === 'I' ? WALL_KICKS.I : WALL_KICKS.JLSTZ;
    const kickKey = `${oldRotation}>${newRotation}`;
    const kicks = kickTable[kickKey] || [[0, 0]];
    
    // Try each kick offset
    for (const [kx, ky] of kicks) {
        if (isValidPosition(piece, kx, -ky, newRotation)) {
            piece.x += kx;
            piece.y -= ky; // SRS uses y-up, we use y-down
            piece.rotation = newRotation;
            resetLockDelay();
            return;
        }
    }
}

// Hold piece
function holdCurrentPiece() {
    if (!GameState.currentPiece || !GameState.canHold || GameState.isLineClearing) return;
    
    const currentType = GameState.currentPiece.type;
    
    if (GameState.holdPiece) {
        // Swap with held piece
        GameState.currentPiece = createPiece(GameState.holdPiece);
        GameState.holdPiece = currentType;
    } else {
        // Store current, spawn next
        GameState.holdPiece = currentType;
        spawnPiece();
    }
    
    GameState.canHold = false;
    GameState.isLocking = false;
    GameState.lockResets = 0;
}

// Reset lock delay when piece moves
function resetLockDelay() {
    if (GameState.isLocking && GameState.lockResets < CONFIG.MAX_LOCK_RESETS) {
        GameState.lockTimer = performance.now();
        GameState.lockResets++;
    }
}

// Update game state (called each frame)
function update(timestamp) {
    if (!GameState.isPlaying || GameState.isPaused || GameState.isGameOver || GameState.isLineClearing) {
        return;
    }
    
    const piece = GameState.currentPiece;
    if (!piece) return;
    
    // Handle DAS (Delayed Auto Shift)
    handleDAS(timestamp);
    
    // Gravity: drop piece
    if (timestamp - GameState.lastDropTime >= GameState.dropInterval) {
        if (isValidPosition(piece, 0, 1)) {
            piece.y++;
            GameState.lastDropTime = timestamp;
            GameState.isLocking = false;
        } else {
            // Start lock delay
            if (!GameState.isLocking) {
                GameState.isLocking = true;
                GameState.lockTimer = timestamp;
            }
        }
    }
    
    // Lock delay
    if (GameState.isLocking) {
        if (timestamp - GameState.lockTimer >= CONFIG.LOCK_DELAY) {
            lockPiece();
        }
    }
    
    // Update particles
    updateParticles();
}

// Handle DAS/ARR for held keys
function handleDAS(timestamp) {
    const leftKey = 'ArrowLeft';
    const rightKey = 'ArrowRight';
    const downKey = 'ArrowDown';
    
    // Left
    if (GameState.keys[leftKey]) {
        if (!GameState.dasActive[leftKey]) {
            if (!GameState.dasTimer[leftKey]) {
                GameState.dasTimer[leftKey] = timestamp;
            } else if (timestamp - GameState.dasTimer[leftKey] >= CONFIG.DAS_DELAY) {
                GameState.dasActive[leftKey] = true;
                GameState.arrTimer[leftKey] = timestamp;
                moveLeft();
            }
        } else {
            if (timestamp - GameState.arrTimer[leftKey] >= CONFIG.ARR_DELAY) {
                GameState.arrTimer[leftKey] = timestamp;
                moveLeft();
            }
        }
    } else {
        delete GameState.dasTimer[leftKey];
        delete GameState.arrTimer[leftKey];
        GameState.dasActive[leftKey] = false;
    }
    
    // Right
    if (GameState.keys[rightKey]) {
        if (!GameState.dasActive[rightKey]) {
            if (!GameState.dasTimer[rightKey]) {
                GameState.dasTimer[rightKey] = timestamp;
            } else if (timestamp - GameState.dasTimer[rightKey] >= CONFIG.DAS_DELAY) {
                GameState.dasActive[rightKey] = true;
                GameState.arrTimer[rightKey] = timestamp;
                moveRight();
            }
        } else {
            if (timestamp - GameState.arrTimer[rightKey] >= CONFIG.ARR_DELAY) {
                GameState.arrTimer[rightKey] = timestamp;
                moveRight();
            }
        }
    } else {
        delete GameState.dasTimer[rightKey];
        delete GameState.arrTimer[rightKey];
        GameState.dasActive[rightKey] = false;
    }
    
    // Down (soft drop)
    if (GameState.keys[downKey]) {
        softDrop();
    }
}

// Update particles
function updateParticles() {
    for (let i = GameState.particles.length - 1; i >= 0; i--) {
        const p = GameState.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life -= p.decay;
        if (p.life <= 0) {
            GameState.particles.splice(i, 1);
        }
    }
}

// Start the game
function startGame() {
    resetGameState();
    loadHighScore();
    GameState.isPlaying = true;
    GameState.isPaused = false;
    GameState.isGameOver = false;
    GameState.lastDropTime = performance.now();
}

// Toggle pause
function togglePause() {
    if (!GameState.isPlaying || GameState.isGameOver) return;
    GameState.isPaused = !GameState.isPaused;
}

// End game
function endGame() {
    GameState.isPlaying = false;
    GameState.isGameOver = true;
    GameState.isNewHighScore = saveHighScore(GameState.score);
}

// Export
window.lockPiece = lockPiece;
window.checkLines = checkLines;
window.clearLines = clearLines;
window.checkTSpin = checkTSpin;
window.scoreLines = scoreLines;
window.spawnLineParticles = spawnLineParticles;
window.spawnPiece = spawnPiece;
window.moveLeft = moveLeft;
window.moveRight = moveRight;
window.softDrop = softDrop;
window.hardDrop = hardDrop;
window.rotate = rotate;
window.holdCurrentPiece = holdCurrentPiece;
window.resetLockDelay = resetLockDelay;
window.update = update;
window.startGame = startGame;
window.togglePause = togglePause;
window.endGame = endGame;
