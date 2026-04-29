// Phase 2n-1 styled confirm modal — replaces window.confirm in saveModal
// (and is available to any future call site that needs Yes/No). Mirrors
// the passoverModal Promise+DOM_IDS pattern, but resolves to a boolean.
//
// Only one confirm can be open at a time; calling openConfirm while another
// is pending resolves the previous one as Cancel and starts a new one.
//
// Phase 2n-2: openError reuses the same DOM frame with the Cancel button
// hidden — gives load-error paths a styled OK-only acknowledgement instead
// of window.alert, matching the rest of the UI.

import { DOM_IDS } from '../core/dom';
import { closeModal, openModal } from './modals';

interface ConfirmOpts {
  title: string;
  body: string;
  confirmText?: string;
  cancelText?: string;
  hideCancel?: boolean;
}

let pending: ((ok: boolean) => void) | null = null;

export function openConfirm(opts: ConfirmOpts): Promise<boolean> {
  if (pending) {
    pending(false);
    pending = null;
  }
  return new Promise((resolve) => {
    const titleEl = document.getElementById(DOM_IDS.CONFIRM_TITLE);
    const bodyEl = document.getElementById(DOM_IDS.CONFIRM_BODY);
    const okBtn = document.getElementById(DOM_IDS.CONFIRM_OK) as HTMLButtonElement | null;
    const cancelBtn = document.getElementById(DOM_IDS.CONFIRM_CANCEL) as HTMLButtonElement | null;
    if (titleEl) titleEl.textContent = opts.title;
    if (bodyEl) bodyEl.textContent = opts.body;
    if (okBtn) okBtn.textContent = opts.confirmText ?? 'OK';
    if (cancelBtn) {
      cancelBtn.textContent = opts.cancelText ?? 'Cancel';
      cancelBtn.style.display = opts.hideCancel ? 'none' : '';
    }
    pending = resolve;
    openModal(DOM_IDS.CONFIRM_MODAL);
    setTimeout(() => okBtn?.focus(), 0);
  });
}

/** Styled replacement for window.alert. OK-only acknowledgement; resolves
 * when the user dismisses. Reuses the confirm DOM frame with Cancel hidden. */
export async function openError(
  title: string,
  body: string,
  okText = 'OK'
): Promise<void> {
  await openConfirm({ title, body, confirmText: okText, hideCancel: true });
}

/** Open exactly when a confirm is awaiting input. closeAllModals checks
 * this so ESC during a pending confirm doesn't ambiguously resolve the
 * promise. */
export function isConfirmPending(): boolean {
  return pending !== null;
}

function resolvePending(ok: boolean): void {
  closeModal(DOM_IDS.CONFIRM_MODAL);
  const r = pending;
  pending = null;
  r?.(ok);
}

document
  .getElementById(DOM_IDS.CONFIRM_OK)
  ?.addEventListener('click', () => resolvePending(true));
document
  .getElementById(DOM_IDS.CONFIRM_CANCEL)
  ?.addEventListener('click', () => resolvePending(false));
