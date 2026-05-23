import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, VERSION_TAGLINE } from '../js/version.js';

// 1.3.1 (#playtest-bug-6): the v1.3.0 playtest caught two stale hardcoded
// version strings in index.html (the <title> at v1.2.0 and the HUD masthead
// at v1.1.1). js/version.js is the new single source of truth; main.js
// boot-writes both surfaces from it. These tests pin the version literal
// so a future bump touches exactly one file *and* the bump shows up in CI
// before drifting onto the deploy.

test('VERSION is a non-empty semver-shaped string', () => {
  assert.equal(typeof VERSION, 'string');
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});

test('VERSION_TAGLINE is a non-empty string', () => {
  assert.equal(typeof VERSION_TAGLINE, 'string');
  assert.ok(VERSION_TAGLINE.length > 0);
});

test('VERSION is 1.4.0 (lock — bump this together with version.js)', () => {
  // This is the explicit version-bump checkpoint: changing js/version.js's
  // VERSION constant requires also bumping this lock. The deliberate
  // friction is the whole point — it's why we centralized.
  assert.equal(VERSION, '1.4.0');
});
