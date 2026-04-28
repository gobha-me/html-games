// Cogfall — main entry point.
//
// This file is the only place that knows about every other module. It imports
// the modules with side-effects (canvas/SVG init, input listeners), wires up
// cross-module callbacks (turn → render+UI), and kicks off the initial UI
// (faction picker rendered into the setup modal).

import './styles/main.css';

// Side-effecting modules — importing them registers DOM listeners, etc.
// render/canvas adds the window resize listener; input/handlers adds the
// canvas mouse + keyboard listeners and the static-button click handlers.
import './render/canvas';
import './render/overlay';
import './input/handlers';

// UI modules with window.* handler exposure for inline onclick attributes.
// Importing them is enough — the `(window as any).foo = foo` lines run at
// module load.
import './ui/modals';
import './ui/selectionPanel';
import './ui/cityPanel';
import './ui/techModal';
import './ui/diploModal';
import './ui/setupModal';
import './ui/saveModal';

import { DOM_IDS } from './core/dom';
import { setRequestRedraw } from './systems/turn';
import { resizeCanvas, render } from './render/canvas';
import { updateUI } from './ui/topbar';
import { renderFactionList } from './ui/setupModal';
import { setupGame } from './systems/setup';
import { AUTOSAVE_KEY, hasAutosave, loadGameState, readSlot } from './core/save';
import { closeModal } from './ui/modals';
import { log } from './core/log';

// Wire the turn loop's redraw hook.
setRequestRedraw(() => {
  updateUI();
  render();
});

// Wire the "Begin the Awakening" button.
document.getElementById(DOM_IDS.START_GAME)?.addEventListener('click', setupGame);

// Wire the "Continue Last Game" button — visible only when an autosave exists.
const continueBtn = document.getElementById(DOM_IDS.CONTINUE_BTN);
if (continueBtn) {
  if (hasAutosave()) continueBtn.style.display = 'inline-block';
  continueBtn.addEventListener('click', () => {
    const data = readSlot(AUTOSAVE_KEY);
    if (!data) return;
    try {
      loadGameState(data);
    } catch (err) {
      window.alert(`Failed to load: ${err instanceof Error ? err.message : 'unknown error'}.`);
      return;
    }
    closeModal(DOM_IDS.SETUP_MODAL);
    resizeCanvas();
    log(`Records read. The Awakening resumes at turn ${data.turn}.`, 'flavor');
    updateUI();
    render();
  });
}

// Initial render: faction picker is visible inside the setup modal.
renderFactionList();
resizeCanvas();
