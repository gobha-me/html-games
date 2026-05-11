# AAR — ai-editor session on issue #96 / PR #194 (Asteroids)

- **Incident date**: 2026-05-10
- **Reconstructed**: 2026-05-11 by Claude (Opus 4.7)
- **Sources**: git history on `origin/issue/96-new-game-asteroids-vector-style-top-down-shooter`, PR #194 body via `tea`, Issue #96 body via `tea`
- **Chat logs**: unavailable (pruned). Reconstruction is from git evidence only.

## Summary

The ai-editor session that implemented issue #96 (Asteroids) produced a working game (~680 lines + README + CSS, all isolated to `asteroids/`) but landed two unrelated workflow failures on PR #194:

1. A commit literally named "Create undefined" that added a 196-line file named `undefined` to the repo root.
2. A `root/index.html` edit that conflicts with main because the data-driven launcher (#191) had landed ~3h20m earlier and the session never rebased.

The game itself is salvageable. Both failures are workflow / tooling issues, not Asteroids-the-game issues.

## Timeline (UTC)

| Time | Event |
|---|---|
| 2026-05-06 13:46 | Issue #96 filed by xcaliber |
| 2026-05-09 15:28 | `48e28ae` Space Invaders 2P (#190) merges to `main` |
| 2026-05-10 14:58 | `9a72f08` games.json manifest + data-driven launcher (#191) merges to `main` |
| 2026-05-10 18:14 | ai-editor session begins on issue #96. First commit `3dda1f3` "Create undefined" creates a 196-line file literally named `undefined`. Branch base = `48e28ae`, **not** `9a72f08` (3h16m stale) |
| 2026-05-10 18:18–18:24 | Game files added correctly: `asteroids/js/game.js` (~680 lines), `asteroids/index.html`, `asteroids/README.md`, `asteroids/css/style.css` |
| 2026-05-10 18:24 | Root `index.html` modified to add hardcoded `<a class="card asteroids">` card and `--asteroids: #00ff88` CSS variable — using the **pre-#191** launcher pattern |
| 2026-05-10 18:31 | PR #194 opened |
| 2026-05-10 18:32 | `6c5332e` "Remove ghost file created by failed write_file call" — self-correction of `undefined` file. Cleanup arrives as a follow-up commit rather than via rewrite, so both commits ship to the PR |
| 2026-05-11 ~14:00 | PR has sat for ~24h with the conflict unresolved. Triaged. |

## Failure modes

### 1. Stale base — session branched off pre-#191 main

Local `main` was at `48e28ae` when the session began. `origin/main` was already `9a72f08`. The session never ran `git fetch` + reset/rebase before creating the issue branch. Result: the launcher edit used the obsolete hardcoded-card pattern. By the time PR #194 was opened (~17 minutes later), the conflict already existed.

### 2. Unguarded `write_file` argument — literal "undefined" path

`3dda1f3` added a 196-line file whose path string-equals `"undefined"`. The most likely explanation: the `file_path` argument to the tool was interpolated from a variable that was never set, e.g. `write_file(\`${unsetVar}\`, content)` producing the string `"undefined"`. The tool wrapper accepted the path and wrote the file. No real path on this repo resolves to `undefined` at the root.

### 3. Cleanup-as-follow-up — ghost commit reached the public PR

The correct recovery from a botched commit on a not-yet-pushed feature branch is `git reset --soft HEAD~1 && rm undefined` (or `git rebase -i` to drop), not a follow-up commit. The session opted for the follow-up, so reviewers see both `3dda1f3` "Create undefined" and `6c5332e` "Remove ghost file" on the PR.

### 4. Stale-PR not escalated

PR #194 sat with the conflict for ~24h. No auto-flag, no rebase nudge. The conflict was caused by another PR (#191) landing on the same file paths, which is a knowable, reportable condition.

## Lessons / corrective actions

1. **Pre-branch fetch.** Before `git checkout -b issue/N-…`, the ai-editor workflow should run `git fetch origin && git checkout origin/main` (or `git reset --hard origin/main` on an existing local `main`). The branch base on `48e28ae` when `origin/main = 9a72f08` was available indicates this step is not in the workflow today.

2. **Validate `file_path` in the write_file wrapper.** Reject paths that are empty, string-equal `"undefined"`, string-equal `"null"`, or contain `${` (unresolved template). These are unambiguously bugs — no real path resolves to those.

3. **Clean history before push.** When a botched commit is made on a feature branch that hasn't been published yet, the recovery should be in-place (reset/rebase), not a follow-up commit. A pre-push hook that flags commits matching `^(Create|Add) (undefined|null)$` or commits that exclusively add a file named `undefined` would have caught this.

4. **Stale-PR escalation.** When CI detects a PR conflicts with `main`, auto-comment with the SHA on `main` that introduced the conflict (here: `9a72f08`) and either rebase or close after N hours. PR #194 is the test case for this rule.

5. **Cross-PR awareness at session start.** Per-issue ai-editor sessions should query open PRs that touch the same paths they're about to touch. For Asteroids, the touched path was `index.html`, and #191 (which reshaped that file) was open / had just landed. A "PRs that touched paths I will touch in the last 24h" pre-flight check would have surfaced #191 and let the session use games.json from the start.

## Out-of-repo follow-ups

The `write_file` wrapper that produced the `undefined` filename lives outside this repo (in the ai-editor harness / its MCP servers). The corrective change there:

```
if (!file_path || file_path === "undefined" || file_path === "null" || file_path.includes("${")) {
    throw new Error("write_file: invalid file_path: " + JSON.stringify(file_path));
}
```

This AAR should travel with that wrapper change in a separate ticket.

## Resolution

Salvage path applied in a follow-up commit on the same `issue/96` branch:

- Drop `Create undefined` and `Remove ghost file` commits via rebase.
- Drop the hardcoded launcher edits to `index.html`.
- Add `--asteroids: #00ff88` to the `:root` block in `index.html`.
- Add an `asteroids` entry to `games.json`.
- Squash the 5 remaining game-file commits + the 2 new edits into a single `feat: add Asteroids (#96)` commit.
- Force-push and re-trigger PR #194.

The Asteroids game files themselves (~680 lines + README + CSS) are preserved as-shipped by the original session.
