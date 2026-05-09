/**
 * Solitaire — Card & Deck utilities
 * Handles card creation, deck shuffling (with seeded RNG for daily deals),
 * and DOM rendering.
 */

// ── Seeded PRNG (Mulberry32) ──────────────────────────────────
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Derive a daily seed from the current date (YYYYMMDD)
function dailySeed() {
  const d = new Date();
  const str = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

// ── Constants ─────────────────────────────────────────────────
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_VALUES = {};
RANKS.forEach((r, i) => { RANK_VALUES[r] = i + 1; });
const RED_SUITS = new Set(['♥', '♦']);

function isRed(suit) { return RED_SUITS.has(suit); }
function isBlack(suit) { return !RED_SUITS.has(suit); }

// ── Card class ────────────────────────────────────────────────
class Card {
  constructor(suit, rank, faceUp = false) {
    this.suit = suit;
    this.rank = rank;
    this.faceUp = faceUp;
    this.el = null; // DOM element reference
  }

  get value() { return RANK_VALUES[this.rank]; }
  get color() { return isRed(this.suit) ? 'red' : 'black'; }
  get id() { return `${this.rank}${this.suit}`; }

  // Create the DOM element for this card
  render() {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.cardId = this.id;

    if (!this.faceUp) {
      el.classList.add('card-back');
      // Back design: pattern via CSS
      const back = document.createElement('div');
      back.className = 'card-back-pattern';
      el.appendChild(back);
    } else {
      el.classList.add('card-front');
      el.classList.add(this.color);

      // Top-left corner
      const top = document.createElement('div');
      top.className = 'card-corner';
      top.innerHTML = `<span class="rank">${this.rank}</span><span class="suit">${this.suit}</span>`;
      el.appendChild(top);

      // Center suit (large)
      const center = document.createElement('div');
      center.className = 'card-center';
      center.textContent = this.suit;
      el.appendChild(center);

      // Bottom-right corner (rotated)
      const bottom = document.createElement('div');
      bottom.className = 'card-corner card-corner-bottom';
      bottom.innerHTML = `<span class="rank">${this.rank}</span><span class="suit">${this.suit}</span>`;
      el.appendChild(bottom);
    }

    this.el = el;
    return el;
  }

  // Update DOM to reflect faceUp state change
  updateRender() {
    if (this.el) {
      const parent = this.el.parentNode;
      if (parent) {
        parent.removeChild(this.el);
      }
      this.render();
      if (parent) {
        parent.appendChild(this.el);
      }
    }
  }

  flip() {
    this.faceUp = !this.faceUp;
    this.updateRender();
  }
}

// ── Deck class ────────────────────────────────────────────────
class Deck {
  constructor(seed = null) {
    this.cards = [];
    this.rng = seed !== null ? mulberry32(seed) : null;

    // Build standard 52-card deck
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(new Card(suit, rank));
      }
    }
  }

  // Fisher-Yates shuffle
  shuffle() {
    const rng = this.rng || (() => Math.random());
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    return this;
  }

  deal(count = 1) {
    return this.cards.splice(0, count);
  }

  get remaining() { return this.cards.length; }
}

// ── Export for use in game.js ─────────────────────────────────
if (typeof window !== 'undefined') {
  window.SolitaireCards = {
    Card,
    Deck,
    SUITS,
    RANKS,
    RANK_VALUES,
    isRed,
    isBlack,
    dailySeed,
    mulberry32
  };
}
