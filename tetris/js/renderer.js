/**
 * Tetris Canvas Renderer
 * Handles all visual rendering: board, pieces, ghost, previews, particles, UI.
 */

let boardCanvas, boardCtx;
let uiCanvas, uiCtx;
let animFrameId = null;

// Initialize canvases
function initRenderer() {
    boardCanvas = document.getElementById('board-canvas');
    boardCtx = boardCanvas.getContext('2d');
    uiCanvas = document.getElementById('ui-canvas');
    uiCtx = uiCanvas.getContext('2d');
    
    // Set canvas sizes
    const boardW = CONFIG.BOARD_WIDTH * CONFIG.BLOCK_SIZE;
    const boardH = CONFIG.BOARD_HEIGHT * CONFIG.BLOCK_SIZE;
    
    boardCanvas.width = boardW;
    boardCanvas.height = boardH;
    uiCanvas.width = boardW;
    uiCanvas.height = boardH;
}

// Draw a single block with glow effect
function drawBlock(ctx, x, y, color, size = CONFIG.BLOCK_SIZE, alpha = 1.0) {
    const padding = 1;
    const bx = x + padding;
    const by = y + padding;
    const bs = size - padding * 2;
    
    ctx.globalAlpha = alpha;
    
    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    
    // Main block
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bs, bs);
    
    // Inner highlight (top-left)
    ctx.shadowBlur = 0;
    const grad = ctx.createLinearGradient(bx, by, bx + bs, by + bs);
    grad.addColorStop(0, 'rgba(255,255,255,0.3)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, bs, bs);
    
    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bs - 1, bs - 1);
    
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

// Draw the board grid
function drawBoardGrid() {
    const ctx = boardCtx;
    const bs = CONFIG.BLOCK_SIZE;
    
    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CONFIG.BOARD_WIDTH * bs, CONFIG.BOARD_HEIGHT * bs);
    
    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    
    for (let c = 0; c <= CONFIG.BOARD_WIDTH; c++) {
        ctx.beginPath();
        ctx.moveTo(c * bs + 0.5, 0);
        ctx.lineTo(c * bs + 0.5, CONFIG.BOARD_HEIGHT * bs);
        ctx.stroke();
    }
    for (let r = 0; r <= CONFIG.BOARD_HEIGHT; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * bs + 0.5);
        ctx.lineTo(CONFIG.BOARD_WIDTH * bs, r * bs + 0.5);
        ctx.stroke();
    }
}

// Draw locked blocks on the board
function drawLockedBlocks() {
    const ctx = boardCtx;
    const bs = CONFIG.BLOCK_SIZE;
    
    for (let r = 0; r < CONFIG.BOARD_HEIGHT; r++) {
        for (let c = 0; c < CONFIG.BOARD_WIDTH; c++) {
            const cell = GameState.board[r][c];
            if (!cell) continue;
            
            // Check if this row is being cleared
            if (GameState.lineClearRows.includes(r)) {
                const progress = GameState.lineClearAnimProgress;
                drawBlock(ctx, c * bs, r * bs, cell.color, bs, 1 - progress);
                continue;
            }
            
            drawBlock(ctx, c * bs, r * bs, cell.color);
        }
    }
}

// Draw ghost piece
function drawGhostPiece() {
    if (!GameState.currentPiece || GameState.isLineClearing) return;
    
    const ctx = boardCtx;
    const bs = CONFIG.BLOCK_SIZE;
    const piece = GameState.currentPiece;
    const ghostY = getGhostY(piece);
    
    if (ghostY === piece.y) return;
    
    const shape = getShape(piece);
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            const bx = (piece.x + c) * bs;
            const by = (ghostY + r) * bs;
            
            ctx.globalAlpha = CONFIG.GHOST_ALPHA;
            ctx.strokeStyle = piece.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(bx + 2, by + 2, bs - 4, bs - 4);
            ctx.globalAlpha = 1;
        }
    }
}

// Draw current piece
function drawCurrentPiece() {
    if (!GameState.currentPiece || GameState.isLineClearing) return;
    
    const ctx = boardCtx;
    const bs = CONFIG.BLOCK_SIZE;
    const piece = GameState.currentPiece;
    const shape = getShape(piece);
    
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            const bx = (piece.x + c) * bs;
            const by = (piece.y + r) * bs;
            if (piece.y + r >= 0) {
                drawBlock(ctx, bx, by, piece.color);
            }
        }
    }
}

// Draw particles
function drawParticles() {
    const ctx = boardCtx;
    
    for (const p of GameState.particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

// Draw a mini piece preview
function drawMiniPiece(ctx, type, x, y, blockSize = 18) {
    if (!type) return;
    
    const shape = TETROMINOES[type].states[0];
    const color = TETROMINOES[type].color;
    
    // Center the piece
    const w = shape[0].length * blockSize;
    const h = shape.length * blockSize;
    
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            drawBlock(ctx, x + c * blockSize, y + r * blockSize, color, blockSize);
        }
    }
}

// Draw UI overlay (next pieces, hold, score, level, lines)
function drawUI() {
    const ctx = uiCtx;
    const bs = CONFIG.BLOCK_SIZE;
    const boardW = CONFIG.BOARD_WIDTH * bs;
    const boardH = CONFIG.BOARD_HEIGHT * bs;
    
    ctx.clearRect(0, 0, boardW, boardH);
    
    // Only draw UI elements if game is active
    if (!GameState.isPlaying && !GameState.isGameOver) return;
    
    // ── Next Pieces (right side) ──
    const nextX = boardW + 12;
    let nextY = 20;
    
    ctx.fillStyle = '#e0e0f0';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', nextX + 50, nextY);
    nextY += 20;
    
    // Background panel
    ctx.fillStyle = 'rgba(18,18,42,0.8)';
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(nextX, nextY, 100, 120, 8);
    ctx.fill();
    ctx.stroke();
    
    nextY += 15;
    for (let i = 0; i < CONFIG.PREVIEW_COUNT; i++) {
        if (GameState.nextPieces[i]) {
            drawMiniPiece(ctx, GameState.nextPieces[i], nextX + 15, nextY + i * 38, 16);
        }
    }
    
    // ── Hold Piece (left side) ──
    const holdX = -112;
    let holdY = 20;
    
    ctx.fillStyle = GameState.canHold ? '#e0e0f0' : '#555';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOLD', holdX + 50, holdY);
    holdY += 20;
    
    // Background panel
    ctx.fillStyle = 'rgba(18,18,42,0.8)';
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(holdX, holdY, 100, 70, 8);
    ctx.fill();
    ctx.stroke();
    
    if (GameState.holdPiece) {
        drawMiniPiece(ctx, GameState.holdPiece, holdX + 20, holdY + 15, 18);
    }
    
    // ── Score Panel (below hold) ──
    const scoreY = holdY + 90;
    
    ctx.fillStyle = 'rgba(18,18,42,0.8)';
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(holdX, scoreY, 100, 140, 8);
    ctx.fill();
    ctx.stroke();
    
    ctx.textAlign = 'left';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#7a7a9a';
    ctx.fillText('SCORE', holdX + 10, scoreY + 20);
    
    ctx.font = 'bold 16px Orbitron, monospace';
    ctx.fillStyle = '#e0e0f0';
    ctx.fillText(GameState.score.toLocaleString(), holdX + 10, scoreY + 40);
    
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#7a7a9a';
    ctx.fillText('LEVEL', holdX + 10, scoreY + 65);
    
    ctx.font = 'bold 14px Orbitron, monospace';
    ctx.fillStyle = '#c084fc';
    ctx.fillText(GameState.level.toString(), holdX + 10, scoreY + 82);
    
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#7a7a9a';
    ctx.fillText('LINES', holdX + 10, scoreY + 105);
    
    ctx.font = 'bold 14px Orbitron, monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(GameState.lines.toString(), holdX + 10, scoreY + 122);
    
    // ── High Score ──
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#7a7a9a';
    ctx.textAlign = 'center';
    ctx.fillText('HI: ' + GameState.highScore.toLocaleString(), holdX + 50, scoreY + 138);
}

// Draw start screen
function drawStartScreen() {
    const ctx = boardCtx;
    const bs = CONFIG.BLOCK_SIZE;
    const boardW = CONFIG.BOARD_WIDTH * bs;
    const boardH = CONFIG.BOARD_HEIGHT * bs;
    
    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, boardW, boardH);
    
    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c084fc';
    ctx.font = 'bold 36px Orbitron, monospace';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 20;
    ctx.fillText('TETRIS', boardW / 2, boardH / 2 - 60);
    ctx.shadowBlur = 0;
    
    // Subtitle
    ctx.fillStyle = '#7a7a9a';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('Falling Block Puzzle', boardW / 2, boardH / 2 - 30);
    
    // Start prompt
    ctx.fillStyle = '#e0e0f0';
    ctx.font = '16px Inter, sans-serif';
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.fillText('Press ENTER to Start', boardW / 2, boardH / 2 + 20);
    ctx.globalAlpha = 1;
    
    // Controls hint
    ctx.fillStyle = '#555';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('← → Move  |  ↑ Rotate  |  ↓ Soft Drop', boardW / 2, boardH / 2 + 60);
    ctx.fillText('Space: Hard Drop  |  C: Hold  |  P: Pause', boardW / 2, boardH / 2 + 78);
    
    // High score
    if (GameState.highScore > 0) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('High Score: ' + GameState.highScore.toLocaleString(), boardW / 2, boardH / 2 + 110);
    }
}

// Draw game over screen
function drawGameOverScreen() {
    const ctx = boardCtx;
    const bs = CONFIG.BLOCK_SIZE;
    const boardW = CONFIG.BOARD_WIDTH * bs;
    const boardH = CONFIG.BOARD_HEIGHT * bs;
    
    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, boardW, boardH);
    
    ctx.textAlign = 'center';
    
    // Game Over text
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 32px Orbitron, monospace';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 15;
    ctx.fillText('GAME OVER', boardW / 2, boardH / 2 - 40);
    ctx.shadowBlur = 0;
    
    // Score
    ctx.fillStyle = '#e0e0f0';
    ctx.font = '18px Inter, sans-serif';
    ctx.fillText('Score: ' + GameState.score.toLocaleString(), boardW / 2, boardH / 2 + 10);
    
    // New high score
    if (GameState.isNewHighScore) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 14px Inter, sans-serif';
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400);
        ctx.globalAlpha = 0.7 + pulse * 0.3;
        ctx.fillText('★ NEW HIGH SCORE ★', boardW / 2, boardH / 2 + 35);
        ctx.globalAlpha = 1;
    }
    
    // Restart prompt
    ctx.fillStyle = '#7a7a9a';
    ctx.font = '14px Inter, sans-serif';
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.fillText('Press ENTER to Restart', boardW / 2, boardH / 2 + 70);
    ctx.globalAlpha = 1;
}

// Draw pause overlay
function drawPauseOverlay() {
    const ctx = boardCtx;
    const bs = CONFIG.BLOCK_SIZE;
    const boardW = CONFIG.BOARD_WIDTH * bs;
    const boardH = CONFIG.BOARD_HEIGHT * bs;
    
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, boardW, boardH);
    
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e0e0f0';
    ctx.font = 'bold 28px Orbitron, monospace';
    ctx.shadowColor = '#818cf8';
    ctx.shadowBlur = 15;
    ctx.fillText('PAUSED', boardW / 2, boardH / 2);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = '#7a7a9a';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('Press P to Resume', boardW / 2, boardH / 2 + 30);
}

// Main render loop
function render() {
    if (!GameState.isPlaying && !GameState.isGameOver) {
        drawStartScreen();
        animFrameId = requestAnimationFrame(render);
        return;
    }
    
    // Draw board
    drawBoardGrid();
    drawLockedBlocks();
    
    if (!GameState.isGameOver) {
        drawGhostPiece();
        drawCurrentPiece();
    }
    
    drawParticles();
    
    // Draw UI
    drawUI();
    
    // Overlays
    if (GameState.isPaused) {
        drawPauseOverlay();
    }
    
    if (GameState.isGameOver) {
        drawGameOverScreen();
    }
    
    animFrameId = requestAnimationFrame(render);
}

// Start rendering
function startRenderLoop() {
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
    }
    render();
}

// Stop rendering
function stopRenderLoop() {
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
}

// Export
window.initRenderer = initRenderer;
window.drawBlock = drawBlock;
window.drawBoardGrid = drawBoardGrid;
window.drawLockedBlocks = drawLockedBlocks;
window.drawGhostPiece = drawGhostPiece;
window.drawCurrentPiece = drawCurrentPiece;
window.drawParticles = drawParticles;
window.drawMiniPiece = drawMiniPiece;
window.drawUI = drawUI;
window.drawStartScreen = drawStartScreen;
window.drawGameOverScreen = drawGameOverScreen;
window.drawPauseOverlay = drawPauseOverlay;
window.render = render;
window.startRenderLoop = startRenderLoop;
window.stopRenderLoop = stopRenderLoop;
