/**
 * Forge Defense - Help / How-To-Play Overlay
 * Shows a first-run tutorial overlay explaining game mechanics.
 * Dismissed state is persisted in localStorage so it only shows once.
 */

const HELP_STORAGE_KEY = 'forge_defense_help_seen';

function showHelpOverlay() {
    const overlay = document.getElementById('help-overlay');
    if (!overlay) return;
    overlay.classList.add('visible');
}

function hideHelpOverlay() {
    const overlay = document.getElementById('help-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    // Mark as seen so it doesn't auto-show again
    localStorage.setItem(HELP_STORAGE_KEY, 'true');
}

function hasSeenHelp() {
    return localStorage.getItem(HELP_STORAGE_KEY) === 'true';
}

// Expose to global scope for onclick handlers
window.showHelpOverlay = showHelpOverlay;
window.hideHelpOverlay = hideHelpOverlay;
