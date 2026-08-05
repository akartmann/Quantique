# Deferred Work

## Epic coverage-map story references

The current `_bmad-output/planning-artifacts/epics.md` FR coverage map still contains pre-existing references to nonexistent Story 1.10 and a likely stale reference from FR11 to Story 1.9. Reconcile FR11, FR17, and FR28 with the actual Epic 1 story numbering in a dedicated traceability pass.

## Deferred from: code review of 1-7-consultations-peer-review-and-revision-history (2026-08-04)

- Provide a player-facing non-destructive reset surface — only a pure phase-reset helper exists; this is pre-existing and not altered by Story 1.7, though AC 8 expects reset access.

## Deferred from: review of improve-reference-mechanism (2026-08-05)

- **Stale e2e notebook button.** ~6 e2e specs (`curated-record` snapshots test, `accessibility`, `theory-board`, `offline-reload`, `progress-portability`, `inquiry-recognition`) click a button named `Record prepared observation` that no longer exists in `src/` — the notebook record button now needs a `prepareRun` arg `main.ts` never passes (and is labelled `Record fixture observation`). These fail on baseline `090356b`. Reconcile the notebook-recording e2e flows with the current Phaser-laboratory "Run experiment" recording path.
- **Run-experiment disabled-state e2e mismatch.** `young-experiment.spec.ts:19` asserts `aria-disabled='true'` then clicks "Run experiment", but the button is hard-`disabled`, so Playwright cannot click it. Pre-existing on baseline. Decide whether the control should be soft-disabled (`aria-disabled` + click-to-explain) or update the test.

## Deferred from: code review of 1-10-scene-router-and-adventure-flow (2026-08-05)

- **`LectureBookScene` couples directly to `LaboratoryScene` instead of routing through the store.** `src/game/main.ts:50-53`. The persistent book overlay is auto-started, never routed, and suppresses apparatus input via `(visible) => laboratoryScene.setApparatusInputEnabled(!visible)` — direct scene→scene reach-in, outside the store pattern the architecture's Communication rules prescribe. **Owned by Story 2.1**, which folds the reading experience into `LibraryScene` and retires the coupling; deferring avoids building a store-routed overlay slice that 2.1 would discard. Carry forward: the game always has ≥2 active scenes (so "the active scene" is no longer single-valued), and because nothing ever stops this scene its `scroll` listener and `LectureBookRenderer` are never released. Also note Task 3's "preserve the existing `onLectureBookReady` wiring for `LaboratoryScene`" was marked complete but the constructor parameter was in fact removed.
- **Production offline-readiness race before the worker caches `asset-manifest.json`.** `tests/e2e/offline-reload.spec.ts:73` gained a wait for the warm-up boot to finish before cutting the network. That fix is legitimate and masks nothing — the race reproduces 8 / 8 at baseline `c5eba0f` under `--workers=1`, i.e. fully independent of the scene-router work, contrary to the story's Debug Log claim that routing shifted boot timing. What remains untracked is the production window itself: a real user who reloads and loses connectivity before the fetch-through worker has cached `case.json` and `asset-manifest.json` gets `content-unavailable` and a blank boot rather than a degraded one. Decide whether the worker should pre-cache content atomically (cache-then-activate) instead of caching as it fetches.
- **`#game-container` is `aria-hidden="true"` while becoming the authoritative surface.** `index.html:36`. Story 1.10 makes the routed Phaser canvas the surface that mirrors the authoritative phase, and later stories (2.1 Library, 1.11 Colleagues, 1.6-rework/2.3 Theory Board, 1.12 dialogue) move real content into it. Any scene-only content is unreachable for assistive tech, and outside `experiment` there is no DOM mirror. A11y projection through the Phaser surface was descoped for this story; it needs an owner before the DOM panels are retired.
