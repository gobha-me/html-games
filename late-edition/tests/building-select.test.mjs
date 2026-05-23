import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/sim/world-state.js';

// Milestone 1.1.1 (#334 · ICD-01 v0.6.6): building selection. Mirrors the
// unitAtTile/selectUnit/deselectAll pattern for buildings so a left-click on
// the HQ tile populates the §13 Selected dossier instead of silently
// deselecting the current unit. WorldFrame.selectedBuilding is the
// SelectedBuildingView | null projection; mutually exclusive with unit
// selection (selectBuilding/selectUnit/deselectAll clear each other).

test('fresh World: selectedBuildingId is null; snapshot().selectedBuilding is null', () => {
  const w = new World();
  assert.equal(w.selectedBuildingId, null);
  assert.equal(w.snapshot().selectedBuilding, null);
});

test('buildingAtTile finds bureau at (5, 5) and switchboard at (3, 3)', () => {
  const w = new World();
  const bureau = w.buildingAtTile({ x: 5, y: 5 });
  assert.ok(bureau);
  assert.equal(bureau.kind, 'bureau');
  const switchboard = w.buildingAtTile({ x: 3, y: 3 });
  assert.ok(switchboard);
  assert.equal(switchboard.kind, 'switchboard');
  // Empty tile returns null.
  assert.equal(w.buildingAtTile({ x: 0, y: 9 }), null);
});

test('selectBuilding stores id and projects SelectedBuildingView with district', () => {
  const w = new World();
  const bureau = w.buildings.find((b) => b.kind === 'bureau');
  w.selectBuilding(bureau.id);
  assert.equal(w.selectedBuildingId, bureau.id);
  const view = w.snapshot().selectedBuilding;
  assert.ok(view);
  assert.equal(view.id, bureau.id);
  assert.equal(view.kind, 'bureau');
  assert.equal(view.hp, bureau.hp);
  assert.equal(view.hp_max, bureau.hp_max);
  // Bureau at (5,5) is between district rects — falls back to default (docks).
  assert.ok(['docks', 'hillside'].includes(view.district));
});

test('SelectedBuildingView for Branch Bureau resolves to hillside district', () => {
  const w = new World();
  const branch = w.buildings.find((b) => b.kind === 'branch_bureau');
  w.selectBuilding(branch.id);
  const view = w.snapshot().selectedBuilding;
  assert.equal(view.kind, 'branch_bureau');
  // Branch Bureau is at (8,3) inside Hillside spawnRect (6..9, 1..4).
  assert.equal(view.district, 'hillside');
  // Surfaces the previously-invisible HP — that's the whole point of #334.
  assert.equal(view.hp_max, 20);
});

test('selectBuilding clears unit selection (mutual exclusivity)', () => {
  const w = new World();
  const reporter = w.units.find((u) => u.kind === 'reporter');
  w.selectUnit(reporter.id);
  assert.equal(reporter.selected, true);
  const bureau = w.buildings.find((b) => b.kind === 'bureau');
  w.selectBuilding(bureau.id);
  assert.equal(reporter.selected, false);
  assert.equal(w.selectedBuildingId, bureau.id);
});

test('selectUnit clears building selection', () => {
  const w = new World();
  const bureau = w.buildings.find((b) => b.kind === 'bureau');
  const reporter = w.units.find((u) => u.kind === 'reporter');
  w.selectBuilding(bureau.id);
  assert.equal(w.selectedBuildingId, bureau.id);
  w.selectUnit(reporter.id);
  assert.equal(w.selectedBuildingId, null);
  assert.equal(reporter.selected, true);
});

test('deselectAll clears both unit and building selection', () => {
  const w = new World();
  const bureau = w.buildings.find((b) => b.kind === 'bureau');
  w.selectBuilding(bureau.id);
  w.deselectAll();
  assert.equal(w.selectedBuildingId, null);
  assert.equal(w.snapshot().selectedBuilding, null);
});

test('selectBuilding with unknown id is a silent no-op (defensive)', () => {
  const w = new World();
  const reporter = w.units.find((u) => u.kind === 'reporter');
  w.selectUnit(reporter.id);
  w.selectBuilding('b-bogus');
  // Existing unit selection preserved; no phantom building selection.
  assert.equal(w.selectedBuildingId, null);
  assert.equal(reporter.selected, true);
});
