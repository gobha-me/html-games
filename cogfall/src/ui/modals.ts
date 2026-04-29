// Modal show/hide utilities. window.closeModal is preserved for the static
// HTML inline `onclick="closeModal('tech-modal')"` handlers in index.html;
// migrating those to data-attributes + listeners is a Phase 2 polish item.

import { isConfirmPending } from './confirmModal';

export function openModal(id: string): void {
  document.getElementById(id)?.classList.add('show');
}

export function closeModal(id: string): void {
  document.getElementById(id)?.classList.remove('show');
}

export function closeAllModals(): void {
  document.querySelectorAll('.modal.show').forEach((m) => {
    // Phase 2m: passover-modal is also non-dismissable — ESC during a
    // hot-seat handoff would leak the next player's POV before they sit
    // down. Continue is the only exit.
    // Phase 2n-1: confirm-modal while pending is also non-dismissable —
    // ESC would ambiguously resolve the awaiting promise. Cancel is.
    if (m.id === 'setup-modal' || m.id === 'game-over-modal' || m.id === 'passover-modal') {
      return;
    }
    if (m.id === 'confirm-modal' && isConfirmPending()) return;
    m.classList.remove('show');
  });
}

// Static index.html has inline onclicks that call closeModal directly.
(window as Window & typeof globalThis & { closeModal: typeof closeModal }).closeModal = closeModal;
