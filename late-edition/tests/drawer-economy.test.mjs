import assert from 'node:assert/strict';
import test from 'node:test';
import { FILE_DRAWER } from '../js/config.js';
import { makeSim } from './helpers.mjs';

// No synthetic scoops, stat resets, free money, clock jumps or disabled rivals:
// this bot plays 20 full 210-second nights through dispatch and layout APIs.
function play(seed, greedy) {
  const sim = makeSim({ seed });
  let squeezeCash = 0;
  let squeezes = 0;
  let filed = 0;
  for (let tick = 0; sim.editionsPrinted < 20 && tick < 18000; tick++) {
    sim.editionSummary = null; // Dismiss the morning report, as the UI does.
    assert.equal(sim.gameOver, false, `seed ${seed}, greedy ${greedy}, night ${sim.edition}: ${sim.gameOverReason}`);
    if (sim.activeDilemma) {
      if (!sim.resolveDilemma(true)) sim.resolveDilemma(false);
    }
    if (sim.phase === 'desk') {
      if (sim.pressHp < 80) sim.fortifyPressRoom();
      for (const op of sim.operatives.filter((entry) => entry.role === 'reporter')) {
        if (sim.leads.some((lead) => lead.uid === op.targetLeadId)) continue;
        const lead = [...sim.leads].sort((a, b) => b.baseValue - a.baseValue)
          .find((entry) => !sim.operatives.some((other) => other.targetLeadId === entry.uid));
        if (lead) sim.dispatchOperativeToLead(op.id, lead.uid);
      }
    } else {
      // Keep enough ink on the page to pay for credibility; trade the surplus.
      for (const slot of ['banner', 'above_fold', 'photo_expose', 'editorial']) {
        if (sim.frontPage[slot]) continue;
        const copy = [...sim.scoopedStories].sort((a, b) => b.baseValue - a.baseValue)[0];
        if (copy) assert.equal(sim.placeStory(copy.uid, slot).ok, true);
      }
      if (greedy) {
        for (const copy of [...sim.scoopedStories]) {
          const result = sim.spike(copy.uid);
          if (result.ok) filed++;
          else assert.equal(result.reason, 'drawer-full');
        }
      }
    }
    if (greedy) {
      for (const file of [...sim.spikedStories]) {
        // Attack repeated use in one tick until the command burns/rejects.
        for (let attempt = 0; attempt < 20; attempt++) {
          const result = sim.useFile(file.uid, 'squeeze', 'cash');
          if (!result.ok) {
            assert.ok(['unknown-file', 'subject-unavailable'].includes(result.reason));
            if (result.reason === 'subject-unavailable') sim.shredFile(file.uid);
            break;
          }
          squeezeCash += result.effects.cash;
          squeezes++;
          assert.ok(attempt < 5, 'A file must never permit unlimited same-tick payments');
        }
      }
    }
    assert.ok(sim.cash <= FILE_DRAWER.economy20NightCashCeiling,
      `seed ${seed}: $${sim.cash} exceeds the documented 20-night cash ceiling`);
    sim.step(0.25);
  }
  assert.equal(sim.editionsPrinted, 20, 'Bot must actually finish all 20 nights');
  assert.equal(sim.gameOver, false);
  assert.ok(sim.cash > 0 && sim.credibility > 0 && sim.pressHp > 0);
  assert.ok(squeezeCash <= filed * 900, 'Each fresh weight-5 file has a hard lifetime ceiling of $900');
  return { cash: sim.cash, squeezeCash, squeezes, filed };
}

test('ECONOMY BOUND: greedy cash bot and never-spike bot remain finite and viable over 20 seeded nights', (context) => {
  const runs = [];
  for (let seed = 0; seed < 20; seed++) {
    const greedy = play(seed, true);
    const ink = play(seed, false);
    assert.ok(greedy.squeezes > 0 && greedy.filed > 0, 'Every greedy seed must exercise leverage');
    assert.equal(ink.filed, 0);
    assert.equal(ink.squeezes, 0);
    runs.push({ seed, greedy: greedy.cash, ink: ink.cash, leverage: greedy.squeezeCash });
  }
  context.diagnostic(`20 seeds × 20 nights × 2 policies; max cash $${Math.max(...runs.flatMap((run) => [run.greedy, run.ink]))}; max squeeze income $${Math.max(...runs.map((run) => run.leverage))}; ceiling $${FILE_DRAWER.economy20NightCashCeiling}`);
});
