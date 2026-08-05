---
baseline_commit: d58379f
---

# Story 1.9: Inclusive feedback and inquiry recognition

Status: ready-for-dev

## Story

As a player,
I want accessible feedback and recognition for careful investigation,
so that I am encouraged to test, replicate, and make appropriately limited claims rather than rush to a “correct” answer.

## Acceptance Criteria

1. **Given** a player action, completed run, source inspection, or review result, **when** feedback is presented, **then** essential meaning is available through semantic text and accessible state announcements; **and** colour, animation, and sound are never the sole carrier of that meaning.
2. **Given** I replicate a run, inspect sources, test an optional variable, or make a well-calibrated claim, **when** recognition is evaluated, **then** I receive non-competitive recognition based on those inquiry actions; **and** it neither gates completion nor rewards speed, perfect answers, or overclaiming.
3. **Given** optional adjustment, measurement, or archival audio is available, **when** I use the application, **then** captions or text equivalents are available and I can independently control that audio; **and** no essential scientific information is lost when sound is unavailable.
4. **Given** focus moves after an action, error, or feedback update, **when** the semantic UI changes, **then** focus recovery and announcements preserve keyboard-only navigation; **and** release acceptance includes manual screen-reader and non-colour-encoding checks.
5. **Given** progression and recognition rules, **when** they are reviewed for release, **then** they model only knowledge and confidence with non-gating inquiry recognition; **and** they contain no currency, energy, inventory, stat system, premium gate, advertising, or randomized reward.

## Scope and implementation decisions

- Deliver recognition as a deterministic, inspectable projection of authoritative progress—not as score, XP, a timer, a counter, a Phaser-only effect, or UI-local state. Recognition must never change case phase, conclusion readiness, peer-review outcome, campaign unlocking, or availability of any action.
- Recognize the four authored inquiry behaviours only:
  1. **Source discipline:** a successful first inspection of each reviewed contextual source.
  2. **Replication:** at least two immutable run records with identical authored primary-control values. Do not infer this from the current UI controls or a click event.
  3. **Variable curiosity:** at least two immutable run records that differ in an authored primary-control value. This is the current safe interpretation of “optional variable”; do not award it merely for changing a control, and do not imply that either result is scientifically correct.
  4. **Calibrated conclusion:** a saved reviewed revision with no `overreach` issue, after the existing evidence/readiness checks have succeeded. Use the existing pure peer-review projection; never parse or log learner conclusion text in a new evaluator.
- Recognition must be idempotent and deduplicated. A repeated source-inspection attempt, rejected action, identical rerender, import, restore, or repeated review must not mint a duplicate recognition item or another success announcement.
- The existing Young content has no audio asset and the project has no audio adapter. Do not introduce an unreviewed historical asset, synthetic “success” sound, or a dependency just to create feedback. Add a typed, optional audio-preference/adapter seam only if it can be exercised with an authored, reviewed audio entry; when it is exercised, it must offer a labelled independent mute/volume control and adjacent text/caption equivalent. The app remains fully usable and scientifically complete without audio.
- Keep export/import/offline records compatible and atomic. The existing `recognition: {}` placeholder is an explicit Story 1.8 handoff: replace it with strict typed data, preserve it on projection/hydration, and reject malformed recognition before state replacement. A valid existing record with the empty legacy placeholder must migrate explicitly; never silently discard valid progress.

## Tasks / Subtasks

- [ ] Define pure, data-driven recognition rules and immutable state (AC: 1, 2, 5)
  - [ ] Create `src/domain/recognition/recognitionRules.ts`. It must be pure TypeScript and accept only `CaseDefinition` plus authoritative progress/history snapshots; it must not import Phaser, DOM, browser APIs, IndexedDB, clock/timer APIs, or persistence code.
  - [ ] Define a compact typed recognition contract with stable IDs, semantic label, explanatory text, and achieved state. Prefer a fixed readonly set keyed by the four behaviours above, with no numeric points, streaks, rank, rarity, currency, inventory, randomization, or hidden completion flag.
  - [ ] Derive source discipline only from reviewed inspected-source IDs; derive replication/variable curiosity only from immutable `RunRecord.controls`; derive calibration only from a completed reviewed revision and its feedback. Do not inspect Phaser scene state, DOM state, input origin, elapsed time, or result value.
  - [ ] Preserve current scientific authority: runs retain recorded result/model/timestamp; the finite `context → prediction → experiment → synthesis → review → debrief` machine and `evaluateConclusionReadiness` remain the only completion authorities.
  - [ ] Extend `src/core/store/AppState.ts` with deeply frozen recognition state. Compute/recompute it inside the successful immutable reducer transition path, never in a component subscription. Preserve existing invalidation of stale consultation/peer-review projections, append-only decision history, and rejected-transition behaviour.
  - [ ] Extend `src/core/store/AppAction.ts` only if a narrowly typed acknowledgement/action is genuinely necessary. Do not add a general state patch, reward action, counter, or UI-owned mutation. Add public selectors in `src/core/store/selectors.ts` for the semantic panel and portable projection.

- [ ] Make recognition portable, validated, and backward-safe (AC: 2, 5)
  - [ ] Replace the opaque optional `recognition: z.record(z.string(), z.unknown())` boundary in `src/schemas/CaseRecordSchema.ts` with a strict, versioned recognition schema matching the domain contract. Reject unknown keys, duplicate IDs, invalid labels/descriptions, impossible combinations, and recognition that cannot be justified by the imported progress/history.
  - [ ] Update `src/core/store/CaseRecordProjection.ts` to project the frozen authoritative recognition state instead of `{}`; update `createAppStateFromCaseRecord` to validate and hydrate it rather than losing it. Hydrated recognition must be consistent with the loaded immutable definition and evidence.
  - [ ] Update `src/schemas/migrations/migrateCaseRecord.ts` explicitly for records produced by Story 1.8 with an empty recognition object or absent recognition. Revalidate after migration, preserve all valid progress/history, and reject future/unsupported/malformed records neutrally. Do not bump or weaken unrelated run, source, comparison, theory, or review contracts.
  - [ ] Preserve Story 1.8’s import ordering and atomicity: parse untrusted JSON → schema/version dispatch → explicit migration → revalidation → validate against loaded immutable definition → build candidate state → persist/replace. On any failure, leave both current in-memory state and last valid IndexedDB record untouched.
  - [ ] Keep `CaseRecordRepository`, IndexedDB, export/import, and service-worker caching as separate adapter concerns. Domain modules remain free of browser APIs; do not create a second progress or recognition store.

- [ ] Provide one calm, semantic recognition and feedback surface (AC: 1, 2, 4, 5)
  - [ ] Add a focused component such as `src/ui/recognition/InquiryRecognitionPanel.ts`, mounted from `src/main.ts` through a named `index.html` root. It reads selectors and dispatches typed public actions only; it never evaluates or persists recognition itself.
  - [ ] Present each achieved recognition with a short explicit text label and evidence-based explanation. Use calm declarative copy (for example, “Replication recorded” / “Two observations use the same setup for comparison”), never score language, exclamation-led praise, “right/wrong”, “perfect”, “winner”, or implication that the case is complete.
  - [ ] Use a persistent, initially empty `role="status"` / polite live region for concise changed-state announcements. Do not move focus to a routine status update and do not re-announce unchanged recognition on every store render. Reserve assertive alerts for genuinely urgent system failures only.
  - [ ] Follow existing `CuratedRecord`, notebook, theory, review, and progress-panel conventions: stable `data-*` focus key, focus restoration after `replaceChildren`, semantic heading/region, `unsubscribe` teardown, and no global mutable feedback bus. A new panel must not steal focus from the control that initiated the action.
  - [ ] Integrate with existing local semantic feedback rather than duplicating it. Existing run/source/review messages must remain readable and recoverable; recognition adds context but must not hide errors, consultation, peer feedback, or decision history.
  - [ ] Update `public/style.css` and `index.html` using the UX spine: text contrast ≥4.5:1, visible focus treatment, 44×44 px interactive targets, named labels, text + non-colour cue for every state, reduced-motion-safe styling, responsive sequential/tablet layout, and no flashing or celebratory burst. Do not repurpose the `signal` colour as a score/answer indicator; use the error colour only for input/persistence failures, never for scientific-review feedback.

- [ ] Handle optional audio accessibly without making it a dependency (AC: 1, 3, 4)
  - [ ] If an authored reviewed audio entry is added to the case manifest during implementation, validate it at the existing content boundary and keep playback in a constructor-injected adapter (for example, `src/adapters/audio/PhaserAudioAdapter.ts`), never in a reducer, domain module, or Phaser update loop.
  - [ ] Add a semantic settings control only for available optional audio: clear name, mute on/off, 0–1 volume semantics, keyboard operation, persistent preference through the existing local-record/settings boundary, and a text/caption equivalent adjacent to the triggering feedback. Audio failure, autoplay lock, or no-audio device is a recoverable silent degradation—never a raw error, blocker, or loss of scientific meaning.
  - [ ] Phaser audio is global and can outlive a scene. Stop/destroy any owned sound on scene shutdown, respect browser user-gesture/autoplay constraints, avoid per-frame audio work, and do not rely on sound completion to update recognition or state.
  - [ ] If no reviewed audio content is added, retain the explicit audio-unavailable semantic state and test it. Do not create a decorative placeholder asset merely to make the setting visible.

- [ ] Preserve dual-surface and persistence composition (AC: 1, 2, 4)
  - [ ] Keep `src/adapters/phaser/PhaserStoreAdapter.ts`, `LaboratoryScene.ts`, and renderer factories as visual projections. If a non-essential visual recognition cue is added, it must subscribe to the same store state, have a semantic equivalent, own and clean up its Phaser objects, and never calculate or mutate recognition.
  - [ ] Keep DOM/Phaser actions routed to the same typed store. A successful DOM-origin and Phaser-origin action with identical authoritative state must produce identical recognition; input `origin` remains diagnostic-only.
  - [ ] Keep `src/main.ts` composition order: load/freeze case definition, load/validate/migrate compatible record, construct restored/fresh store, mount semantic UI, then start Phaser. Persistence/audio failures must not prevent the laboratory from opening.
  - [ ] Do not add telemetry, accounts, cloud saves, a backend, remote config, analytics, network-critical play, or logging of learner-entered conclusions.

- [ ] Verify behaviour, accessibility, and regressions (AC: 1–5)
  - [ ] Add Vitest unit tests for every recognition rule, no-recognition boundary, deduplication/idempotence, deterministic restore, deep freeze, rejected action behaviour, source eligibility, identical-control replication, changed-control curiosity, and calibrated-vs-overreaching review. Assert that recognition does not alter phase, readiness, runs, or decision history.
  - [ ] Extend `CaseRecordSchema`/migration/repository tests for strict recognition validation, legacy empty recognition migration, projection/hydration round trip, impossible imported recognition, future versions, and atomic import/save failure. Ensure current valid records and all immutable historical snapshots remain intact.
  - [ ] Add integration tests using public store actions/selectors—not private component/Phaser fields—proving DOM and Phaser-origin equivalent actions produce the same recognition and no duplicate announcement/state.
  - [ ] Extend Playwright coverage for the named semantic recognition region, source/run/review feedback, keyboard focus retention/recovery, no-colour text readability, reduced-motion behaviour, audio-unavailable behaviour, and recognition persistence through export/import/offline reload. Run axe against the new surface.
  - [ ] Execute `npm test`, `npm run typecheck`, `npm run build`, accessibility E2E, and Chromium/Firefox/WebKit Playwright suites. Manually verify keyboard-only flow, screen-reader announcements, focus recovery, text scaling/zoom, non-colour meaning, no-sound operation, and audio controls/captions if audio is shipped. Axe is necessary but not sufficient.

## Dev Notes

### Current implementation: preserve and extend

| Path | Current behaviour to preserve | Story 1.9 change |
| --- | --- | --- |
| `src/core/store/AppState.ts` | Sole frozen authority; reducers invalidate stale consultation/review and append revision history | Add one frozen recognition projection to successful transitions and validated hydration. |
| `src/core/store/AppAction.ts`, `createStore.ts`, `selectors.ts` | Typed actions, successful-transition-only notifications, controlled replacement seam | Add only typed/public recognition access; no mutable reward store. |
| `src/core/store/CaseRecordProjection.ts` | Projects portable progress with deliberate `recognition: {}` handoff | Project typed recognition from state. |
| `src/schemas/CaseRecordSchema.ts`, `migrations/migrateCaseRecord.ts` | Strict record/import invariants, explicit migration, atomic failure recovery | Validate/migrate/hydrate recognition without weakening existing invariants. |
| `src/domain/evidence/RunRecord.ts` | Immutable controls, calculated result, timestamp, model version, linked evidence | Use its stored controls only; never recalculate a run or reward outcome/speed. |
| `src/domain/review/*` | Pure review and append-only decision history | Use its reviewed/no-overreach result; do not duplicate phrase matching. |
| `src/ui/*` panels | Semantic UI, polite status, stable focus restoration, clean teardown | Reuse this pattern for one non-intrusive recognition surface. |
| `src/adapters/phaser/*` | Store-driven visual layer with lifecycle cleanup | Any cue is non-essential projection only. |
| `src/main.ts`, `index.html`, `public/style.css` | Restores before mount; semantic landmarks, focus/print/reduced-motion baseline | Mount/style the new semantic surface without breaking existing panels or print. |

### Project context rules

- Stack is pinned: Phaser `4.2.1`, TypeScript `~5.7.2`, Vite `8.1.5`, `idb` `8.0.3`, Zod `4.4.3`, Vitest `4.1.10`, Playwright `1.61.1`, and `@axe-core/playwright` `4.12.1`. Add no dependency or version upgrade.
- `src/domain/` is pure TypeScript. Adapters own browser effects; semantic UI and Phaser use selectors plus typed actions; authored case content/assets stay immutable under `public/cases/` and `public/assets/`.
- Valid local progress must survive failed save/import. Do not alter saved runs, decision history, source provenance, case definitions, or the evidence-to-conclusion gate.
- Essential controls and scientific meaning must be semantic, keyboard-operable, announced, and non-colour/non-audio-only. The Phaser canvas remains supplementary.
- No hard failure, irreversible wrong choice, speed reward, answer revelation, overclaim reward, raw learner-text logging, telemetry, or silent data loss.

### Previous-story intelligence and git patterns

- Story 1.8 intentionally deferred recognition: portable records accept the placeholder `recognition: {}` but no state/evaluator/UI exists. Extend this seam rather than inventing a second record format.
- Preserve Story 1.8 review fixes: strict per-run control validation, decision-history validation, legal restored phases, atomic valid import replacement, recoverable blocked IndexedDB upgrade, persistence status announcements, and complete semantic print history.
- Story 1.7 supplies pure peer review, no answer-revealing consultations, UTC-ordered append-only revisions, and invalidation of stale feedback. Story 1.6 owns readiness/phase authority; Stories 1.4–1.5 own immutable runs and source eligibility.
- Recent commits (`4663e19`, `25a6e78`, `b43f033`, `d58379f`) use narrow source/test changes and adversarial review patches. Preserve public actions, selectors, semantic roles/labels, and browser-facing contracts; never weaken existing assertions to accommodate the new UI.

### Traceability note

`deferred-work.md` identifies a stale FR map: export/print (FR11) was delivered by Story 1.8 and recognition appears under FR17/FR29 despite an obsolete reference to Story 1.10. This story owns inquiry recognition and inclusive feedback; do not reimplement Story 1.8 portability work or edit the epic map as part of feature implementation.

### Current technical information

- Routine feedback should use an initially present polite status region; a `status` role is advisory and should not receive focus. Avoid assertive live regions for ordinary recognition. [Source: MDN, ARIA status role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role); [Source: MDN, ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
- Phaser’s sound manager supports global mute and volume, but browser autoplay can delay playback until a user gesture. Treat audio as optional, preserve semantic text, and clean up scene-owned sounds. [Source: Phaser audio concepts](https://docs.phaser.io/phaser/concepts/audio); [Source: Phaser sound manager](https://docs.phaser.io/api-documentation/4.0.0/class/sound-basesoundmanager)
- Automated checks supplement—not replace—manual keyboard, focus, screen-reader, and non-colour acceptance across supported browsers.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.9; FR17, FR29; NFR3, NFR5–NFR8, NFR13, NFR18]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` — Game pillars, win/loss, replayability, audio direction, controls, and accessibility]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/DESIGN.md` — colours, component rules, contrast, non-colour encoding]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md` — voice, state/component patterns, accessibility floor, feedback feel]
- [Source: `_bmad-output/game-architecture.md` — state, persistence, events, UI boundary, project structure, testing]
- [Source: `_bmad-output/project-context.md` — pinned stack, engine, purity, testing, platform, and critical rules]
- [Source: `_bmad-output/implementation-artifacts/1-8-offline-progress-export-import-and-print.md` — recognition persistence handoff and atomic-record constraints]
- [Source: `src/core/store/AppState.ts`, `src/core/store/CaseRecordProjection.ts`, `src/schemas/CaseRecordSchema.ts`, `src/main.ts`, `src/ui/*`, `src/adapters/phaser/*` — current seams and behaviour]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Ultimate context engine analysis completed: complete Epic 1, GDD, UX, architecture, project context, prior story, current source/test seams, git history, and current official technical documentation reviewed.
- Parallel artifact analysis confirmed that recognition is intentionally reserved in the portable record but has no domain/state/UI implementation; this story closes that seam with strict, evidence-derived, non-gating state.
- Validation checklist applied: tasks prevent duplicate reward systems, untyped/invalid imported recognition, completion bypasses, raw learner-text analysis/logging, canvas/audio-only feedback, focus theft, noisy re-announcements, unreviewed audio assets, and Story 1.8 persistence regressions.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status set to `ready-for-dev`.

### File List

- `_bmad-output/implementation-artifacts/1-9-inclusive-feedback-and-inquiry-recognition.md` (created story record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status update)
