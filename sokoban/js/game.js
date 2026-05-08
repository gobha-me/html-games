/**
 * Sokoban — Main Game Logic
 * Vanilla JS, DOM-based rendering
 */

(function () {
  "use strict";

  // ── Constants ──
  const WALL = "#";
  const FLOOR = " ";
  const TARGET = ".";
  const BOX = "$";
  const PLAYER = "@";
  const BOX_ON_TARGET = "*";
  const PLAYER_ON_TARGET = "+";

  const STORAGE_KEY = "sokoban_progress";

  // ── State ──
  let currentLevel = 0;
  let board = [];       // 2D array of chars
  let playerRow = 0;
  let playerCol = 0;
  let initialBoard = []; // snapshot for reset
  let initialPlayer = { r: 0, c: 0 };
  let history = [];     // undo stack: [{board, playerRow, playerCol}]
  let moves = 0;
  let pushes = 0;
  let levelComplete = false;
  let bestMoves = {};   // per-level best move counts

  // ── DOM refs ──
  let boardEl, movesEl, pushesEl, undoBtn, resetBtn;
  let prevBtn, nextBtn, levelSelect;

  // ── Initialization ──
  function init() {
    boardEl = document.getElementById("board");
    movesEl = document.getElementById("moves-display");
    pushesEl = document.getElementById("pushes-display");
    undoBtn = document.getElementById("undo-btn");
    resetBtn = document.getElementById("reset-btn");
    prevBtn = document.getElementById("prev-btn");
    nextBtn = document.getElementById("next-btn");
    levelSelect = document.getElementById("level-select");

    loadProgress();
    populateLevelSelect();
    loadLevel(currentLevel);
    bindEvents();
  }

  function populateLevelSelect() {
    LEVELS.forEach((lvl, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `Level ${i + 1}: ${lvl.name}`;
      levelSelect.appendChild(opt);
    });
  }

  function loadProgress() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data) {
        currentLevel = data.currentLevel ?? 0;
        bestMoves = data.bestMoves ?? {};
      }
    } catch (e) {
      // ignore
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentLevel, bestMoves })
      );
    } catch (e) {
      // ignore
    }
  }

  // ── Level Loading ──
  function loadLevel(index) {
    if (index < 0 || index >= LEVELS.length) return;
    currentLevel = index;
    const level = LEVELS[index];
    board = level.map.map((row) => row.split(""));
    initialBoard = board.map((row) => [...row]);

    // Find player position
    playerRow = 0;
    playerCol = 0;
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        if (board[r][c] === PLAYER || board[r][c] === PLAYER_ON_TARGET) {
          playerRow = r;
          playerCol = c;
        }
      }
    }

    initialPlayer = { r: playerRow, c: playerCol };
    history = [];
    moves = 0;
    pushes = 0;
    levelComplete = false;

    render();
    updateUI();
    saveProgress();
    levelSelect.value = index;
  }

  // ── Rendering ──
  function render() {
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = `repeat(${board[0].length}, 1fr)`;

    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        const ch = board[r][c];

        if (ch === WALL) {
          cell.classList.add("wall");
        } else {
          cell.classList.add("floor");
          if (ch === TARGET || ch === PLAYER_ON_TARGET) {
            cell.classList.add("target");
          }
          if (ch === BOX || ch === BOX_ON_TARGET) {
            cell.classList.add("box");
            if (ch === BOX_ON_TARGET) cell.classList.add("box-ok");
          }
          if (ch === PLAYER || ch === PLAYER_ON_TARGET) {
            cell.classList.add("player");
          }
        }

        boardEl.appendChild(cell);
      }
    }
  }

  function updateUI() {
    movesEl.textContent = moves;
    pushesEl.textContent = pushes;

    const best = bestMoves[currentLevel];
    document.getElementById("best-display").textContent =
      best !== undefined ? best : "—";

    undoBtn.disabled = history.length === 0 || levelComplete;
    resetBtn.disabled = levelComplete;
    prevBtn.disabled = currentLevel === 0;
    nextBtn.disabled = currentLevel === LEVELS.length - 1;
  }

  // ── Movement ──
  function move(dr, dc) {
    if (levelComplete) return;

    const nr = playerRow + dr;
    const nc = playerCol + dc;

    if (!isValid(nr, nc)) return;

    const target = board[nr][nc];

    // Wall check
    if (target === WALL) return;

    // Box push
    if (target === BOX || target === BOX_ON_TARGET) {
      const br = nr + dr;
      const bc = nc + dc;

      if (!isValid(br, bc)) return;
      if (board[br][bc] === WALL || board[br][bc] === BOX || board[br][bc] === BOX_ON_TARGET) {
        return; // can't push into wall or another box
      }

      // Save state for undo
      saveState();

      // Move box
      board[br][bc] = board[br][bc] === TARGET ? BOX_ON_TARGET : BOX;
      board[nr][nc] = target === BOX_ON_TARGET ? TARGET : FLOOR;
      pushes++;
    } else {
      saveState();
    }

    // Move player
    board[playerRow][playerCol] =
      board[playerRow][playerCol] === PLAYER_ON_TARGET ? TARGET : FLOOR;
    board[nr][nc] = board[nr][nc] === TARGET ? PLAYER_ON_TARGET : PLAYER;
    playerRow = nr;
    playerCol = nc;
    moves++;

    render();
    updateUI();
    checkWin();
  }

  function isValid(r, c) {
    return r >= 0 && r < board.length && c >= 0 && c < board[0].length;
  }

  function saveState() {
    history.push({
      board: board.map((row) => [...row]),
      playerRow,
      playerCol,
      moves,
      pushes,
    });
  }

  function undo() {
    if (history.length === 0 || levelComplete) return;
    const state = history.pop();
    board = state.board;
    playerRow = state.playerRow;
    playerCol = state.playerCol;
    moves = state.moves;
    pushes = state.pushes;
    render();
    updateUI();
  }

  function resetLevel() {
    if (levelComplete) return;
    board = initialBoard.map((row) => [...row]);
    playerRow = initialPlayer.r;
    playerCol = initialPlayer.c;
    history = [];
    moves = 0;
    pushes = 0;
    render();
    updateUI();
  }

  // ── Win Detection ──
  function checkWin() {
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        if (board[r][c] === BOX) return; // box not on target
      }
    }

    // All boxes on targets!
    levelComplete = true;

    // Update best
    if (bestMoves[currentLevel] === undefined || moves < bestMoves[currentLevel]) {
      bestMoves[currentLevel] = moves;
    }
    saveProgress();
    updateUI();

    // Show celebration
    setTimeout(() => showCelebration(), 300);
  }

  function showCelebration() {
    const overlay = document.createElement("div");
    overlay.className = "celebration-overlay";
    overlay.innerHTML = `
      <div class="celebration">
        <div class="celebration-icon">🎉</div>
        <h2>Level Complete!</h2>
        <p>Moves: ${moves} · Pushes: ${pushes}</p>
        ${bestMoves[currentLevel] === moves ? '<p class="best-msg">🏆 New Best!</p>' : ""}
        <div class="celebration-buttons">
          ${currentLevel < LEVELS.length - 1
            ? '<button class="btn btn-primary" id="next-level-btn">Next Level →</button>'
            : '<p class="all-done">🏆 All 20 levels complete!</p>'}
          <button class="btn" id="replay-btn">Replay</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const nextBtn = overlay.querySelector("#next-level-btn");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        overlay.remove();
        loadLevel(currentLevel + 1);
      });
    }

    overlay.querySelector("#replay-btn").addEventListener("click", () => {
      overlay.remove();
      loadLevel(currentLevel);
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ── Event Binding ──
  function bindEvents() {
    // Keyboard
    document.addEventListener("keydown", (e) => {
      // Don't capture if focus is on an input/select
      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "SELECT" ||
          document.activeElement.tagName === "TEXTAREA")
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          move(-1, 0);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          move(1, 0);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          move(0, -1);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          move(0, 1);
          break;
        case "z":
        case "Z":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            undo();
          }
          break;
        case "r":
        case "R":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            resetLevel();
          }
          break;
        case "u":
        case "U":
          undo();
          break;
      }
    });

    // Buttons
    undoBtn.addEventListener("click", undo);
    resetBtn.addEventListener("click", resetLevel);
    prevBtn.addEventListener("click", () => loadLevel(currentLevel - 1));
    nextBtn.addEventListener("click", () => loadLevel(currentLevel + 1));
    levelSelect.addEventListener("change", (e) => {
      loadLevel(parseInt(e.target.value, 10));
    });

    // Touch / swipe support
    let touchStartX = 0;
    let touchStartY = 0;

    boardEl.addEventListener("touchstart", (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    boardEl.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < 30) return; // too small

      if (absDx > absDy) {
        move(0, dx > 0 ? 1 : -1);
      } else {
        move(dy > 0 ? 1 : -1, 0);
      }
    }, { passive: true });
  }

  // ── Boot ──
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
