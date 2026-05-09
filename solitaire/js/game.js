/**
 * Solitaire — Klondike Game Engine
 * Full game logic, UI rendering, drag-and-drop, undo, scoring.
 */
(function () {
  'use strict';

  const { Card, Deck, RANK_VALUES, isRed, isBlack, dailySeed } = window.SolitaireCards;

  // ── DOM refs ────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const board = $('#board');
  const stockEl = $('#stock');
  const wasteEl = $('#waste');
  const foundationsEl = $('#foundations');
  const tableauEl = $('#tableau');
  const scoreDisplay = $('#score-display');
  const movesDisplay = $('#moves-display');
  const timerDisplay = $('#timer-display');
  const drawModeBtn = $('#draw-mode-btn');
  const newGameBtn = $('#new-game-btn');
  const undoBtn = $('#undo-btn');
  const autoCompleteBtn = $('#auto-complete-btn');
  const scoringModeBtn = $('#scoring-mode-btn');
  const dailySeedDisplay = $('#daily-seed');

  // ── Game state ──────────────────────────────────────────────
  let state = {
    tableau: [],       // 7 piles, each array of Cards
    foundations: [],   // 4 piles (spades, hearts, diamonds, clubs)
    stock: [],         // draw pile
    waste: [],         // face-up drawn cards
    score: 0,
    moves: 0,
    startTime: null,
    timerInterval: null,
    drawMode: 3,       // 1 or 3
    scoringMode: 'standard', // 'standard' or 'vegas'
    undoStack: [],
    gameOver: false,
    won: false,
    selectedCard: null,  // { pileType, pileIndex, cardIndex }
    dragData: null
  };

  // ── Stats (localStorage) ────────────────────────────────────
  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem('solitaire-stats')) || { played: 0, won: 0, bestScore: 0, streak: 0 };
    } catch { return { played: 0, won: 0, bestScore: 0, streak: 0 }; }
  }

  function saveStats(stats) {
    try { localStorage.setItem('solitaire-stats', JSON.stringify(stats)); } catch {}
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    // Restore preferences
    const prefs = JSON.parse(localStorage.getItem('solitaire-prefs') || '{}');
    if (prefs.drawMode) state.drawMode = prefs.drawMode;
    if (prefs.scoringMode) state.scoringMode = prefs.scoringMode;

    updateModeButtons();
    newGame();

    // Event listeners
    newGameBtn.addEventListener('click', newGame);
    undoBtn.addEventListener('click', undo);
    autoCompleteBtn.addEventListener('click', tryAutoComplete);
    drawModeBtn.addEventListener('click', toggleDrawMode);
    scoringModeBtn.addEventListener('click', toggleScoringMode);
    stockEl.addEventListener('click', drawFromStock);

    // Keyboard
    document.addEventListener('keydown', handleKeyboard);
  }

  function newGame() {
    // Clear timer
    if (state.timerInterval) clearInterval(state.timerInterval);

    // Create and shuffle deck
    const seed = dailySeed();
    const deck = new Deck(seed).shuffle();

    // Deal to tableau
    state.tableau = [];
    for (let i = 0; i < 7; i++) {
      const pile = [];
      for (let j = 0; j <= i; j++) {
        const card = deck.deal(1)[0];
        card.faceUp = (j === i); // only top card face-up
        pile.push(card);
      }
      state.tableau.push(pile);
    }

    // Remaining cards go to stock
    state.stock = deck.cards;
    state.waste = [];
    state.foundations = [[], [], [], []];
    state.score = state.scoringMode === 'vegas' ? -52 : 0;
    state.moves = 0;
    state.undoStack = [];
    state.gameOver = false;
    state.won = false;
    state.selectedCard = null;
    state.startTime = Date.now();

    // Timer
    state.timerInterval = setInterval(updateTimer, 1000);

    // Stats
    const stats = loadStats();
    stats.played++;
    saveStats(stats);

    // Render
    dailySeedDisplay.textContent = `Seed: ${seed}`;
    render();
    updateHUD();
  }

  // ── Drawing ─────────────────────────────────────────────────
  function drawFromStock() {
    if (state.gameOver) return;

    saveUndoState();

    if (state.stock.length === 0) {
      // Recycle waste to stock
      if (state.waste.length === 0) return;
      state.stock = state.waste.reverse();
      state.stock.forEach(c => { c.faceUp = false; });
      state.waste = [];
      if (state.scoringMode === 'vegas') state.score -= 52;
    } else {
      const count = Math.min(state.drawMode, state.stock.length);
      const drawn = state.stock.splice(state.stock.length - count, count);
      drawn.forEach(c => { c.faceUp = true; });
      state.waste.push(...drawn);
    }

    state.moves++;
    state.selectedCard = null;
    render();
    updateHUD();
  }

  // ── Move validation ─────────────────────────────────────────
  function canPlaceOnTableau(card, pileIndex) {
    const pile = state.tableau[pileIndex];
    if (pile.length === 0) {
      return card.rank === 'K'; // only King on empty pile
    }
    const top = pile[pile.length - 1];
    if (!top.faceUp) return false;
    return top.value === card.value + 1 && isRed(card.suit) !== isRed(top.suit);
  }

  function canPlaceOnFoundation(card, foundationIndex) {
    const pile = state.foundations[foundationIndex];
    if (pile.length === 0) {
      return card.rank === 'A'; // only Ace on empty foundation
    }
    const top = pile[pile.length - 1];
    return top.suit === card.suit && card.value === top.value + 1;
  }

  // ── Move execution ──────────────────────────────────────────
  function moveCards(fromType, fromIndex, cardIndex, toType, toIndex) {
    let cards;

    if (fromType === 'tableau') {
      const pile = state.tableau[fromIndex];
      cards = pile.splice(cardIndex);
      // Flip new top card if face-down
      if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
        pile[pile.length - 1].faceUp = true;
        if (state.scoringMode === 'standard') state.score += 5;
      }
    } else if (fromType === 'waste') {
      cards = [state.waste.pop()];
    } else if (fromType === 'foundation') {
      cards = [state.foundations[fromIndex].pop()];
      if (state.scoringMode === 'standard') state.score -= 10;
    } else {
      return false;
    }

    if (toType === 'tableau') {
      state.tableau[toIndex].push(...cards);
    } else if (toType === 'foundation') {
      if (cards.length !== 1) {
        // Can't move multiple cards to foundation — revert
        revertMove(fromType, fromIndex, cards);
        return false;
      }
      state.foundations[toIndex].push(cards[0]);
      if (state.scoringMode === 'standard') state.score += 10;
    }

    state.moves++;
    state.selectedCard = null;
    render();
    updateHUD();
    checkWin();
    return true;
  }

  function revertMove(fromType, fromIndex, cards) {
    if (fromType === 'tableau') {
      state.tableau[fromIndex].push(...cards);
    } else if (fromType === 'waste') {
      state.waste.push(...cards);
    } else if (fromType === 'foundation') {
      state.foundations[fromIndex].push(...cards);
    }
  }

  // ── Undo ────────────────────────────────────────────────────
  function saveUndoState() {
    const snapshot = {
      tableau: state.tableau.map(pile => pile.map(c => ({ id: c.id, faceUp: c.faceUp }))),
      foundations: state.foundations.map(pile => pile.map(c => c.id)),
      stock: state.stock.map(c => c.id),
      waste: state.waste.map(c => c.id),
      score: state.score,
      moves: state.moves
    };
    state.undoStack.push(snapshot);
    if (state.undoStack.length > 50) state.undoStack.shift();
  }

  function undo() {
    if (state.undoStack.length === 0 || state.gameOver) return;

    const snapshot = state.undoStack.pop();

    // Rebuild cards from IDs
    const cardMap = {};
    const deck = new Deck(null); // unshuffled, just to get all cards
    // We need to rebuild from the deal — simpler: store full state
    // Actually, let's just rebuild the game from the snapshot IDs
    // For simplicity, rebuild all cards fresh
    const allCards = {};
    for (const suit of ['♠', '♥', '♦', '♣']) {
      for (const rank of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) {
        const c = new Card(suit, rank);
        allCards[`${rank}${suit}`] = c;
      }
    }

    state.tableau = snapshot.tableau.map(pile =>
      pile.map(({ id, faceUp }) => { const c = allCards[id]; c.faceUp = faceUp; return c; })
    );
    state.foundations = snapshot.foundations.map(pile =>
      pile.map(id => allCards[id])
    );
    state.stock = snapshot.stock.map(id => allCards[id]);
    state.waste = snapshot.waste.map(id => allCards[id]);
    state.score = snapshot.score;
    state.moves = snapshot.moves;
    state.selectedCard = null;

    render();
    updateHUD();
  }

  // ── Auto-complete ───────────────────────────────────────────
  function canAutoComplete() {
    // All tableau cards must be face-up
    for (const pile of state.tableau) {
      for (const card of pile) {
        if (!card.faceUp) return false;
      }
    }
    return true;
  }

  function tryAutoComplete() {
    if (state.gameOver || !canAutoComplete()) return;

    // Check if remaining cards can all go to foundations
    // Simple check: for each card, there must be a valid foundation path
    // For now, just try to move them greedily
    let moved = true;
    let safety = 0;
    while (moved && safety < 100) {
      moved = false;
      safety++;

      // Check waste
      if (state.waste.length > 0) {
        const card = state.waste[state.waste.length - 1];
        for (let i = 0; i < 4; i++) {
          if (canPlaceOnFoundation(card, i)) {
            saveUndoState();
            state.waste.pop();
            state.foundations[i].push(card);
            if (state.scoringMode === 'standard') state.score += 10;
            state.moves++;
            moved = true;
            break;
          }
        }
      }

      // Check tableau tops
      if (!moved) {
        for (let i = 0; i < 7; i++) {
          const pile = state.tableau[i];
          if (pile.length === 0) continue;
          const card = pile[pile.length - 1];
          for (let j = 0; j < 4; j++) {
            if (canPlaceOnFoundation(card, j)) {
              saveUndoState();
              pile.pop();
              state.foundations[j].push(card);
              if (state.scoringMode === 'standard') state.score += 10;
              state.moves++;
              moved = true;
              break;
            }
          }
          if (moved) break;
        }
      }
    }

    render();
    updateHUD();
    checkWin();
  }

  // ── Win check ───────────────────────────────────────────────
  function checkWin() {
    const total = state.foundations.reduce((sum, p) => sum + p.length, 0);
    if (total === 52) {
      state.gameOver = true;
      state.won = true;
      if (state.timerInterval) clearInterval(state.timerInterval);

      const stats = loadStats();
      stats.won++;
      stats.streak++;
      if (state.score > stats.bestScore) stats.bestScore = state.score;
      saveStats(stats);

      setTimeout(() => {
        showOverlay('🎉 You Win!', `Score: ${state.score} · Moves: ${state.moves}`);
      }, 500);
    }
  }

  // ── Rendering ───────────────────────────────────────────────
  function render() {
    renderStock();
    renderWaste();
    renderFoundations();
    renderTableau();
    updateAutoCompleteButton();
  }

  function renderStock() {
    stockEl.innerHTML = '';
    if (state.stock.length > 0) {
      const card = document.createElement('div');
      card.className = 'card card-back stock-card';
      card.innerHTML = `<div class="card-back-pattern"></div>`;
      card.innerHTML += `<span class="stock-count">${state.stock.length}</span>`;
      stockEl.appendChild(card);
    } else {
      stockEl.innerHTML = '<div class="card card-empty stock-empty">↻</div>';
    }
  }

  function renderWaste() {
    wasteEl.innerHTML = '';
    if (state.waste.length === 0) return;

    // Show last 3 cards fanned
    const start = Math.max(0, state.waste.length - 3);
    for (let i = start; i < state.waste.length; i++) {
      const card = state.waste[i];
      const el = card.render();
      el.style.marginLeft = i > start ? '-80px' : '0';
      el.style.position = 'absolute';
      el.style.left = `${(i - start) * 20}px`;
      el.style.zIndex = i - start;
      el.style.cursor = 'pointer';

      if (i === state.waste.length - 1) {
        el.addEventListener('click', () => selectCard('waste', 0, i));
        el.addEventListener('dblclick', () => autoMoveToFoundation('waste', 0, i));
        setupDrag(el, 'waste', 0, i);
      }

      wasteEl.appendChild(el);
    }
    wasteEl.style.minHeight = '130px';
  }

  function renderFoundations() {
    foundationsEl.innerHTML = '';
    const suitOrder = ['♠', '♥', '♦', '♣'];

    for (let i = 0; i < 4; i++) {
      const pile = state.foundations[i];
      const slot = document.createElement('div');
      slot.className = 'foundation-slot';
      slot.dataset.foundationIndex = i;

      if (pile.length === 0) {
        slot.innerHTML = `<span class="foundation-placeholder">${suitOrder[i]}</span>`;
      } else {
        const top = pile[pile.length - 1];
        const el = top.render();
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => selectCard('foundation', i, pile.length - 1));
        slot.appendChild(el);
      }

      // Drop target
      slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('drop-target'); });
      slot.addEventListener('dragleave', () => slot.classList.remove('drop-target'));
      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('drop-target');
        handleDrop('foundation', i);
      });
      slot.addEventListener('click', () => handleDrop('foundation', i));

      foundationsEl.appendChild(slot);
    }
  }

  function renderTableau() {
    tableauEl.innerHTML = '';

    for (let i = 0; i < 7; i++) {
      const pile = state.tableau[i];
      const col = document.createElement('div');
      col.className = 'tableau-column';
      col.dataset.tableauIndex = i;

      // Drop target for empty columns
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop-target'); });
      col.addEventListener('dragleave', () => col.classList.remove('drop-target'));
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drop-target');
        handleDrop('tableau', i);
      });

      if (pile.length === 0) {
        col.innerHTML = '<div class="tableau-empty-slot">K</div>';
        col.addEventListener('click', () => handleDrop('tableau', i));
      } else {
        for (let j = 0; j < pile.length; j++) {
          const card = pile[j];
          const el = card.render();
          el.style.position = 'absolute';
          el.style.top = `${j * (card.faceUp ? 28 : 14)}px`;
          el.style.zIndex = j;
          el.style.cursor = card.faceUp ? 'pointer' : 'default';

          if (card.faceUp) {
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              selectCard('tableau', i, j);
            });
            el.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              autoMoveToFoundation('tableau', i, j);
            });
            setupDrag(el, 'tableau', i, j);
          } else {
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              // Click on face-down card: flip it if it's the top face-down
              const firstFaceDown = pile.findIndex(c => !c.faceUp);
              if (j === firstFaceDown) {
                // Check if all cards above are already on foundations or moved
                // Actually, just flip the top face-down card
                card.faceUp = true;
                if (state.scoringMode === 'standard') state.score += 5;
                state.moves++;
                render();
                updateHUD();
              }
            });
          }

          col.appendChild(el);
        }
        // Set column height
        const lastCard = pile[pile.length - 1];
        const height = (pile.length - 1) * (lastCard.faceUp ? 28 : 14) + 130;
        col.style.minHeight = `${height}px`;
      }

      tableauEl.appendChild(col);
    }
  }

  // ── Selection ───────────────────────────────────────────────
  function selectCard(pileType, pileIndex, cardIndex) {
    if (state.gameOver) return;

    // If already selected, try to move to this spot
    if (state.selectedCard) {
      const sel = state.selectedCard;
      if (sel.pileType === pileType && sel.pileIndex === pileIndex && sel.cardIndex === cardIndex) {
        // Deselect
        state.selectedCard = null;
        render();
        return;
      }
      // Try to move selected card here
      if (moveCards(sel.pileType, sel.pileIndex, sel.cardIndex, pileType, pileIndex)) {
        return;
      }
    }

    // Select this card
    state.selectedCard = { pileType, pileIndex, cardIndex };
    render();
    highlightSelected();
  }

  function highlightSelected() {
    if (!state.selectedCard) return;
    const { pileType, pileIndex, cardIndex } = state.selectedCard;

    let container;
    if (pileType === 'waste') {
      container = wasteEl;
    } else if (pileType === 'foundation') {
      container = foundationsEl.children[pileIndex];
    } else if (pileType === 'tableau') {
      container = tableauEl.children[pileIndex];
    }

    if (!container) return;
    const cards = container.querySelectorAll('.card');
    for (let i = cardIndex; i < cards.length; i++) {
      cards[i].classList.add('selected');
    }
  }

  // ── Drag and Drop ───────────────────────────────────────────
  function setupDrag(el, pileType, pileIndex, cardIndex) {
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
      state.dragData = { pileType, pileIndex, cardIndex };
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      state.dragData = null;
    });
  }

  function handleDrop(toType, toIndex) {
    if (!state.dragData && !state.selectedCard) return;

    const data = state.dragData || state.selectedCard;
    if (!data) return;

    // Validate
    const pile = data.pileType === 'tableau' ? state.tableau[data.pileIndex]
      : data.pileType === 'waste' ? state.waste
      : state.foundations[data.pileIndex];
    if (!pile || pile.length === 0) return;

    const card = data.pileType === 'tableau' ? pile[data.cardIndex]
      : data.pileType === 'waste' ? pile[pile.length - 1]
      : pile[pile.length - 1];
    if (!card || !card.faceUp) return;

    if (toType === 'tableau') {
      if (!canPlaceOnTableau(card, toIndex)) return;
    } else if (toType === 'foundation') {
      if (!canPlaceOnFoundation(card, toIndex)) return;
    }

    saveUndoState();
    moveCards(data.pileType, data.pileIndex, data.cardIndex, toType, toIndex);
  }

  // ── Auto-move to foundation (double-click) ──────────────────
  function autoMoveToFoundation(fromType, fromIndex, cardIndex) {
    if (state.gameOver) return;

    let card;
    if (fromType === 'tableau') {
      const pile = state.tableau[fromIndex];
      card = pile[cardIndex];
      // Can only auto-move if it's the top card
      if (cardIndex !== pile.length - 1) return;
    } else if (fromType === 'waste') {
      card = state.waste[state.waste.length - 1];
    } else {
      return;
    }

    if (!card || !card.faceUp) return;

    for (let i = 0; i < 4; i++) {
      if (canPlaceOnFoundation(card, i)) {
        saveUndoState();
        moveCards(fromType, fromIndex, cardIndex, 'foundation', i);
        return;
      }
    }
  }

  // ── HUD updates ─────────────────────────────────────────────
  function updateHUD() {
    scoreDisplay.textContent = state.score;
    movesDisplay.textContent = state.moves;
    undoBtn.disabled = state.undoStack.length === 0;
  }

  function updateTimer() {
    if (!state.startTime) return;
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function updateAutoCompleteButton() {
    autoCompleteBtn.disabled = !canAutoComplete() || state.gameOver;
    autoCompleteBtn.title = canAutoComplete() ? 'Auto-complete remaining cards' : 'All tableau cards must be face-up';
  }

  // ── Mode toggles ────────────────────────────────────────────
  function toggleDrawMode() {
    state.drawMode = state.drawMode === 1 ? 3 : 1;
    updateModeButtons();
    savePrefs();
  }

  function toggleScoringMode() {
    state.scoringMode = state.scoringMode === 'standard' ? 'vegas' : 'standard';
    updateModeButtons();
    savePrefs();
  }

  function updateModeButtons() {
    drawModeBtn.textContent = `Draw ${state.drawMode}`;
    scoringModeBtn.textContent = state.scoringMode === 'vegas' ? 'Vegas' : 'Standard';
  }

  function savePrefs() {
    localStorage.setItem('solitaire-prefs', JSON.stringify({
      drawMode: state.drawMode,
      scoringMode: state.scoringMode
    }));
  }

  // ── Keyboard ────────────────────────────────────────────────
  function handleKeyboard(e) {
    if (e.key === 'n' || e.key === 'N') {
      newGame();
    } else if (e.key === 'u' || e.key === 'U') {
      undo();
    } else if (e.key === 'a' || e.key === 'A') {
      tryAutoComplete();
    } else if (e.key === '1') {
      state.drawMode = 1;
      updateModeButtons();
      savePrefs();
    } else if (e.key === '3') {
      state.drawMode = 3;
      updateModeButtons();
      savePrefs();
    }
  }

  // ── Overlay ─────────────────────────────────────────────────
  function showOverlay(title, body) {
    const overlay = $('#overlay');
    $('#overlay-title').textContent = title;
    $('#overlay-body').textContent = body;
    $('#overlay-btn').textContent = 'Play Again';
    overlay.classList.add('visible');
    $('#overlay-btn').onclick = () => {
      overlay.classList.remove('visible');
      newGame();
    };
  }

  // ── Start ───────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
