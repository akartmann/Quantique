# Deferred Work

## Epic coverage-map story references

The current `_bmad-output/planning-artifacts/epics.md` FR coverage map still contains pre-existing references to nonexistent Story 1.10 and a likely stale reference from FR11 to Story 1.9. Reconcile FR11, FR17, and FR28 with the actual Epic 1 story numbering in a dedicated traceability pass.

## Deferred from: code review of 1-7-consultations-peer-review-and-revision-history (2026-08-04)

- Provide a player-facing non-destructive reset surface — only a pure phase-reset helper exists; this is pre-existing and not altered by Story 1.7, though AC 8 expects reset access.

## Deferred from: review of improve-reference-mechanism (2026-08-05)

- **Stale e2e notebook button.** ~6 e2e specs (`curated-record` snapshots test, `accessibility`, `theory-board`, `offline-reload`, `progress-portability`, `inquiry-recognition`) click a button named `Record prepared observation` that no longer exists in `src/` — the notebook record button now needs a `prepareRun` arg `main.ts` never passes (and is labelled `Record fixture observation`). These fail on baseline `090356b`. Reconcile the notebook-recording e2e flows with the current Phaser-laboratory "Run experiment" recording path.
- **Run-experiment disabled-state e2e mismatch.** `young-experiment.spec.ts:19` asserts `aria-disabled='true'` then clicks "Run experiment", but the button is hard-`disabled`, so Playwright cannot click it. Pre-existing on baseline. Decide whether the control should be soft-disabled (`aria-disabled` + click-to-explain) or update the test.
