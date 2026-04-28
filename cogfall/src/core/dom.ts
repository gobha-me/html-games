// Centralized DOM IDs. Every getElementById call across the codebase should
// reference one of these constants. Eliminates a class of typo bugs that
// would otherwise only surface at runtime when a panel silently doesn't
// update.

export const DOM_IDS = {
  // Canvas + overlay
  MAP_CANVAS: 'map-canvas',
  OVERLAY_SVG: 'overlay-svg',

  // Bars
  TOP_BAR: 'top-bar',
  BOTTOM_BAR: 'bottom-bar',

  // Panels
  LEFT_PANEL: 'left-panel',
  RIGHT_PANEL: 'right-panel',
  EVENT_LOG: 'event-log',
  TOOLTIP: 'tooltip',
  AI_THINKING: 'ai-thinking',
  AI_THINKING_TEXT: 'ai-thinking-text',

  // Top-bar resource displays
  CUR_FACTION_EMBLEM: 'cur-faction-emblem',
  CUR_FACTION_NAME: 'cur-faction-name',
  CUR_TURN: 'cur-turn',
  R_GOLD: 'r-gold',
  R_GOLD_D: 'r-gold-d',
  R_AETHER: 'r-aether',
  R_AETHER_D: 'r-aether-d',
  R_SCI_D: 'r-sci-d',

  // Bottom-bar
  STATUS_TEXT: 'status-text',
  NEXT_UNIT_BTN: 'next-unit-btn',
  END_TURN_BTN: 'end-turn-btn',
  TECH_BTN: 'tech-btn',
  DIPLO_BTN: 'diplo-btn',
  RECORDS_BTN: 'records-btn',

  // Selection panel
  SELECTION_CONTENT: 'selection-content',
  RIGHT_TITLE: 'right-title',
  RIGHT_CONTENT: 'right-content',

  // Modals
  SETUP_MODAL: 'setup-modal',
  TECH_MODAL: 'tech-modal',
  DIPLO_MODAL: 'diplo-modal',
  SAVE_MODAL: 'save-modal',
  GAME_OVER_MODAL: 'game-over-modal',

  // Modal contents
  FACTION_LIST: 'faction-list',
  TECH_TREE_CONTAINER: 'tech-tree-container',
  RESEARCH_STATUS: 'research-status',
  DIPLO_CONTENT: 'diplo-content',
  SAVE_CONTENT: 'save-content',
  GAME_OVER_CONTENT: 'game-over-content',
  CONTINUE_BTN: 'continue-btn',

  // Setup form fields
  MAP_SIZE: 'map-size',
  OPPONENT_COUNT: 'opponent-count',
  DIFFICULTY: 'difficulty',
  GAME_SPEED: 'game-speed',
  SETUP_SEED: 'setup-seed',
  SEED_REGEN: 'seed-regen',
  START_GAME: 'start-game',
} as const;

export type DomId = (typeof DOM_IDS)[keyof typeof DOM_IDS];

export function $(id: DomId): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`DOM element #${id} not found`);
  return el;
}
