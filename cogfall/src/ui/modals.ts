// Modal show/hide utilities. window.closeModal is preserved for the static
// HTML inline `onclick="closeModal('tech-modal')"` handlers in index.html;
// migrating those to data-attributes + listeners is a Phase 2 polish item.

export function openModal(id: string): void {
  document.getElementById(id)?.classList.add('show');
}

export function closeModal(id: string): void {
  document.getElementById(id)?.classList.remove('show');
}

export function closeAllModals(): void {
  document.querySelectorAll('.modal.show').forEach((m) => {
    if (m.id !== 'setup-modal' && m.id !== 'game-over-modal') m.classList.remove('show');
  });
}

// Static index.html has inline onclicks that call closeModal directly.
(window as Window & typeof globalThis & { closeModal: typeof closeModal }).closeModal = closeModal;
