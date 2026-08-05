---
baseline_commit: 25a6e78
---

# Story 1.8: Offline progress, export, import, and print

Status: done

## Story

As a player,
I want my investigation progress to survive offline reloads and be portable as an export or print record,
so that I can safely continue, share, or retain my evidence without an account.

## Acceptance Criteria

1. **Given** valid case progress containing runs, inspected sources, theory-board work, review history, and recognition, **when** a persistence adapter saves it, **then** it stores a versioned record in IndexedDB through `idb`; **and** domain modules do not access IndexedDB or browser APIs directly.
2. **Given** a previously saved valid record, **when** I reload the application offline after its case assets have been loaded once, **then** the application restores the record and its decision history; **and** no network request is required to resume core play.
3. **Given** an exported record, **when** I choose export, **then** the application produces versioned JSON containing the player’s portable case record; **and** it excludes immutable case definitions and unrelated local data.
4. **Given** an imported record, **when** I choose import, **then** it is validated with Zod and migrated explicitly when supported; **and** an invalid or incompatible import leaves the last valid local progress intact with a neutral semantic explanation.
5. **Given** I choose to print my work, **when** the print view is opened, **then** a semantic CSS print view presents settings, observations, sources, comparison notes, conclusion, and stated limitations; **and** it does not depend on a canvas-only capture.
6. **Given** persistence and portability behavior, **when** tests run, **then** unit tests cover record validation and migrations; **and** Playwright covers export/import recovery and offline reload in Chromium, Firefox, and WebKit.

## Scope and sequencing

- Deliver the smallest reusable offline persistence and portability layer on top of Story 1.7’s authoritative in-memory state. This story owns IndexedDB persistence, restoration, import/export, explicit record migration, and semantic printing. It does **not** implement recognition rules (Story 1.9), new case content, scientific recalculation, accounts, telemetry, backend services, cloud saves, or a canvas print capture.
- Load and validate immutable case content first. Only after a valid `young-interference` definition is available may composition load a matching player record, validate/migrate it, and construct the authoritative restored state before semantic UI and Phaser mount.
- Persist/export a versioned player-progress projection only: case ID and compatible case-definition version/reference, phase, active control values, inspected source IDs, immutable runs, comparison selection/notes, theory draft, decision history, and an optional forward-compatible recognition snapshot. Never persist/export the immutable `caseDefinition`, authored sources/assets/rules, consultations, peer-review transient projection, DOM/Phaser objects, unrelated local data, or browser implementation details.
- Story 1.7’s decision history, Story 1.6’s theory/readiness/phase contract, Story 1.5’s source eligibility, and Story 1.4’s immutable records and comparison semantics remain the sole authority. Hydration must recreate only a fully validated state; it must never mutate old history entries or recalculate a historical result using a newer experiment model.
- Recognition behavior is still Story 1.9 scope. Design the portable record to accept an absent or empty optional recognition snapshot, but do not invent badges, reward logic, audio, or accessibility settings to populate it.

## Tasks / Subtasks

- [x] Define and validate a portable player case-record boundary (AC: 1, 3, 4, 6)
  - [x] Add `src/schemas/CaseRecordSchema.ts` with a strict Zod schema for the current portable record. Include an explicit portable `schemaVersion`, `caseId`, compatible case-definition version/reference, and only the progress projection listed above. The portable schema version is independent of the IndexedDB database’s integer version.
  - [x] Validate all nested records before they can reach store state: phase, primary-control values, source/run IDs, comparison selection and notes, theory draft, run record snapshots, and append-only decision history. Reject unknown fields and malformed/duplicate/incompatible references with typed, neutral `Result` failures.
  - [x] Reuse the existing immutable run and decision-history contracts; do not duplicate weaker lookalike types or use JSON parsing as validation. Stored runs retain their calculated result, timestamp, controls, linked evidence, and experiment-model version.
  - [x] Add `src/schemas/migrations/migrateCaseRecord.ts` as a pure explicit migration dispatcher. It may migrate only listed supported prior schema versions; malformed, future, and unsupported versions return a recoverable `invalid-import`/compatibility result without guessing or partial migration.
  - [x] Required import sequence: parse JSON as untrusted input → `CaseRecordSchema.safeParse`/version dispatch → pure migration if supported → validate the migrated current record again → validate it against the already-loaded immutable case definition → build candidate restored state. Do not write or replace any local record until the entire sequence succeeds.

- [x] Extend the store with a safe validated restoration seam (AC: 1, 2, 4)
  - [x] Update `src/core/store/AppState.ts` to expose a narrowly typed factory that maps a validated case record plus the immutable loaded definition into a frozen `AppState`, or an equivalent validated hydrate path. Keep `createInitialAppState` for a fresh investigation.
  - [x] Update `src/core/store/AppAction.ts` and `src/core/store/selectors.ts` only where needed for public persistence/print projections. Do not add a general-purpose mutable snapshot action, parallel progress store, or UI-owned validation.
  - [x] Preserve `createStore`’s successful-transition-only notifications. A rejected load, import, migration, or save must leave the exact current authoritative state intact and must not notify subscribers as though progress changed.
  - [x] Do not restore a record for a different case ID or incompatible definition version. Do not accept duplicate/unknown run IDs, uninspected/unknown selected sources, invalid comparison pairs, invalid timestamps, or mutable historical snapshots.

- [x] Implement IndexedDB persistence in adapter-owned repositories (AC: 1, 2, 4, 6)
  - [x] Add `src/adapters/persistence/IndexedDbRepository.ts` and `src/adapters/persistence/caseRecordRepository.ts`. Use the already pinned `idb` `8.0.3`, constructor-injected dependencies, a versioned database, and a `case-records` object store keyed by `caseId`.
  - [x] Keep all IndexedDB/browser access in these adapters. `src/domain/` remains pure TypeScript and imports neither `idb`, `indexedDB`, `window`, `document`, `File`, `Blob`, nor Phaser.
  - [x] Save only validated portable records after successful authoritative transitions; do not perform IndexedDB calls in a reducer, a Phaser scene, or any per-frame/update path. Coalesce/serialize writes safely if needed, but do not rely on unload to save progress.
  - [x] Treat blocked database upgrades, version-change events, database-open errors, read errors, and write errors as recoverable adapter failures. Preserve valid in-memory progress, give the UI a neutral semantic status, and never surface raw error details or learner-entered conclusion text.
  - [x] Keep service-worker asset caching separate from persistence. `src/adapters/OfflineCache.ts`/`public/sw.js` cache the loaded application/case assets; IndexedDB restores player data after those assets are available.

- [x] Implement safe export and import adapters plus a semantic portability surface (AC: 3, 4, 6)
  - [x] Add `src/adapters/export/exportCaseRecord.ts` to serialize only the validated portable projection as `application/json`, download through a temporary same-origin object URL, and revoke that URL after the download is initiated. Use a stable, descriptive case/version filename.
  - [x] Add `src/adapters/export/importCaseRecord.ts` to consume only a file explicitly selected by the player (`<input type="file" accept="application/json,.json">`). Treat all file text as untrusted, render no raw imported content, and report status through `textContent`.
  - [x] Add a focused semantic persistence/portability component (for example `src/ui/persistence/CaseProgressPanel.ts`) and mount it from `src/main.ts`. It must provide labelled Save/status, Export, Import, and Print controls, a polite `role="status"` recovery region, stable `data-*` focus keys, focus restoration after actions/failures, and teardown that unsubscribes/clears its mount.
  - [x] On invalid, incompatible, or failed imports, retain the pre-import state and stored record unchanged. Explain neutrally that the record could not be used and let the player continue; do not log imported learner conclusion text, overwrite history, or silently fall back to a partial record.

- [x] Add a dedicated semantic print record and print CSS (AC: 5)
  - [x] Add `src/ui/print/CaseRecordPrintView.ts`, rendered from public selectors/state rather than canvas pixels. It must include the current apparatus settings with labels/units, recorded observations (including immutable result/model/timestamp), inspected source labels/provenance where available, comparison notes, current conclusion, stated limitation, and decision-history information needed to retain the evidence record.
  - [x] Update `index.html` and `public/style.css` to add a labelled print mount/control and a scoped `@media print` layout. Hide non-record/play controls from printed output without deleting them from the interactive UI; do not depend on the Phaser canvas, colours, sound, or screenshots for printable meaning.
  - [x] Preserve current boot shell, Curated Record, laboratory controls, notebook, Theory Board, consultation/review/history mounts, 44×44 targets, visible focus treatment, contrast, narrow sequential layout, and reduced-motion behavior.

- [x] Compose restoration and persistence without breaking existing play (AC: 1–5)
  - [x] Update `src/main.ts`: register the offline cache as an enhancement; load the immutable case definition; open/load/validate any matching saved record; create restored or fresh store state; then mount all semantic UI and Phaser. A persistence failure must not block the available case from opening.
  - [x] Subscribe persistence outside the reducer after store creation. Save a current validated projection after successful transitions, and distinguish recoverable save/load/import messages from normal player feedback.
  - [x] Preserve the finite phase machine `context → prediction → experiment → synthesis → review → debrief`; a restored phase must remain legal for the restored evidence. UI and Phaser continue to dispatch typed actions/read selectors only and never mutate each other or state directly.

- [x] Verify record integrity, recovery, accessibility, and browser behavior (AC: 6)
  - [x] Add Vitest tests for valid current records; every field/nested invariant; strict unknown-field rejection; supported migrations; malformed/future/unsupported records; cross-case/version incompatibility; restore-state validation; and adapter atomicity. Assert that failed migration/import/save retains the previous valid record/state.
  - [x] Extend unit/integration coverage using public actions/selectors for saved runs, sources, comparison notes, theory draft, and append-only decision history. Verify no imported state can mutate historic run output, controls, timestamps, model versions, linked evidence, or prior decision snapshots.
  - [x] Add Playwright export tests using the download event, filename, and parsed JSON payload; import a valid record; then import malformed and incompatible records and confirm the last valid progress/history remains visible with neutral status and recovered focus.
  - [x] Extend `tests/e2e/offline-reload.spec.ts` to prove a saved investigation state and decision history restore after the service worker has cached case assets, without a network request. Exercise Chromium, Firefox, and WebKit as required by this story; do not silently retain the existing Chromium-only skip. If a runner capability blocks an engine, capture a concrete, reproducible limitation for the product decision rather than claiming cross-browser acceptance.
  - [x] Run and retain `npm test`, `npm run typecheck`, `npm run build`, accessibility E2E, and the Chromium/Firefox/WebKit Playwright suites. Tests assert semantic roles/labels and public behavior; never assert canvas pixels or Phaser private fields. Manually verify keyboard-only flow, announcements, focus recovery, print readability, non-colour meaning, and offline restore; Axe alone is insufficient.

### Review Findings

- [x] [Review][Patch] Make valid import replacement atomic with persistence [src/ui/persistence/CaseProgressPanel.ts:69]
- [x] [Review][Patch] Reject restored phases that bypass evidence and readiness gates [src/schemas/CaseRecordSchema.ts:125]
- [x] [Review][Patch] Validate each imported historical run control against the loaded definition [src/schemas/CaseRecordSchema.ts:96]
- [x] [Review][Patch] Validate decision-history snapshots against the reviewed-revision contract [src/schemas/CaseRecordSchema.ts:116]
- [x] [Review][Patch] Recover from blocked IndexedDB upgrades without stalling laboratory boot [src/adapters/persistence/IndexedDbRepository.ts:20]
- [x] [Review][Patch] Restrict the store replacement seam to genuinely validated restored state [src/core/store/createStore.ts:32]
- [x] [Review][Patch] Announce automatic persistence failures through the semantic status region [src/ui/persistence/CaseProgressPanel.ts:90]
- [x] [Review][Patch] Include complete decision-history evidence in the printed record [src/ui/print/CaseRecordPrintView.ts:69]

## Dev Notes

### Required data flow

```text
loaded immutable case definition
  + IndexedDB record / explicit player-selected JSON
  → strict Zod schema validation
  → pure explicit migration (when supported)
  → revalidation + definition compatibility check
  → frozen restored AppState or unchanged current state on failure
  → selectors → semantic UI / Phaser projection
  → successful typed store transition
  → validated portable projection → adapter-owned IndexedDB save
  → export JSON and semantic print view
```

### Existing code to preserve and deliberately extend

| Path | Current behavior to preserve | Story 1.8 responsibility |
| --- | --- | --- |
| `src/core/store/AppState.ts`, `AppAction.ts`, `createStore.ts`, `selectors.ts` | Sole immutable application authority; failed transitions do not notify; frozen theory/review/history state | Add only a validated restore/projection seam; do not introduce a second state store or general unsafe snapshot action. |
| `src/domain/evidence/RunRecord.ts` | Validated immutable scientific record with controls, result, timestamp, model version, and linked evidence | Reuse and revalidate snapshots; never recompute or weaken historical records. |
| `src/domain/cases/CaseDefinition.ts`, `src/schemas/CaseDefinitionSchema.ts`, `src/adapters/content/loadCaseDefinition.ts` | Strict, immutable authored case contract loaded before application state | Keep immutable definition out of the portable record; use it to validate restored progress compatibility. |
| `src/domain/theory/conclusionReadiness.ts`, `src/domain/review/*` | Pure readiness/review logic and append-only decision-history input | Persist factual theory/history snapshots only; do not persist stale UI projections or re-evaluate history on restore. |
| `src/main.ts` | Loads case then always creates a fresh store and mounts semantic UI/Phaser | Await valid record restoration after definition loading, fall back safely to fresh state, and subscribe side effects outside reducer. |
| `src/adapters/OfflineCache.ts`, `public/sw.js` | Service-worker cache is a non-blocking same-origin asset cache | Keep cache lifecycle separate; build player persistence in dedicated adapters. |
| `src/ui/notebook/NotebookPanel.ts`, `src/ui/theory/TheoryBoard.ts`, `src/ui/review/*` | Semantic panels subscribe, render selectors, use polite status/focus keys, and tear down cleanly | Follow this pattern for portability and print; do not break existing mounts/focus behavior. |
| `index.html`, `public/style.css` | Current semantic landmarks and accessibility baseline | Add a labelled portability/print surface and print media styles without removing existing content. |
| `tests/e2e/offline-reload.spec.ts` | Proves cached boot shell offline only, currently Chromium-only | Upgrade to restored progress/history and cross-browser acceptance coverage. |

### Architecture and project-context guardrails

- Pinned dependencies: Phaser `4.2.1`, TypeScript `~5.7.2`, Vite `8.1.5`, `idb` `8.0.3`, Zod `4.4.3`, Vitest `4.1.10`, Playwright `1.61.1`, and `@axe-core/playwright` `4.12.1`. Add no dependency and perform no upgrade in this story.
- `src/domain/` is pure TypeScript. Only adapters perform IndexedDB, DOM, File API, Blob/URL, or other browser side effects. Use typed `Result` recovery, constructor-injected adapter dependencies, typed actions, and public selectors; never use a service locator/global mutable singleton.
- Case definitions/assets under `public/cases/`/`public/assets/` are immutable. Player progress belongs only in IndexedDB and a selected export/import record. Do not add accounts, analytics, telemetry, remote configuration, backend calls, or a network-critical path.
- Phaser mirrors store state only. It must not become persistence authority or perform IndexedDB/DOM/JSON work in update loops. Clean up subscriptions/display objects under normal scene lifecycle.
- Keep all essential actions/records semantic and keyboard-operable; preserve labels, values/units, announcements, focus behavior, non-colour encoding, and desktop browser support. Phones remain laboratory read-only.
- No hard fail, irreversible wrong choice, penalty, score/speed reward, answer revelation, raw learner-text logging, or silent data loss. Imports, saves, and migrations are expected recoverable boundaries.

### Current technical information

- `idb` `8.0.3` remains the project-pinned IndexedDB wrapper. Open with an integer database version and create/change stores only in its upgrade lifecycle; treat blocked/version-change cases as recoverable persistence failures. [Source: idb package documentation](https://www.npmjs.com/package/idb?activeTab=versions), [Source: MDN IndexedDB guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)
- Use Zod `safeParse` for non-throwing import boundaries. In Zod 4, `z.strictObject()` is the current strict-object API; validate again after a migration before state replacement. [Source: Zod basics](https://zod.dev/basics), [Source: Zod 4 changelog](https://zod.dev/v4/changelog?id=drops-symbol-support)
- The browser File API exposes only user-selected local files. Build export with an `application/json` Blob and revoke its temporary object URL after download initiation. [Source: MDN File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API), [Source: MDN URL.revokeObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static)
- Use semantic DOM plus `@media print` for printing; Playwright supports download-event assertions and offline browser contexts. [Source: MDN print CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing), [Source: Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext), [Source: Playwright Download](https://playwright.dev/docs/api/class-download)

### Previous-story intelligence and git patterns

- Story 1.7 (`4663e19`, reviewed by `25a6e78`) deliberately left progress in memory and deferred IndexedDB, migration, import/export, and print to this story. Extend its frozen authoritative state; do not rewrite it or add a parallel history/evidence store.
- Preserve the reviewed fixes from Story 1.7: stale review/consultation invalidation, valid chronological revision timestamps, locale-independent overreach evaluation, a nonblank conclusion requirement, visible basic help layers, legal phase progression, and public review/revision tests.
- Story 1.6 established the pure theory-readiness gate and phase authority. Story 1.5 established strict source content validation and safe focus restoration. Story 1.4 established immutable run snapshots/comparison semantics. All must survive reload/import intact.
- Recent commits use narrow source/test changes and preserve public actions, selectors, semantic roles/labels, and browser behavior. Follow that pattern and do not weaken old assertions to fit the new UI.

### Project Structure Notes

- Required NEW ownership: `src/schemas/CaseRecordSchema.ts`, `src/schemas/migrations/migrateCaseRecord.ts`, `src/adapters/persistence/IndexedDbRepository.ts`, `src/adapters/persistence/caseRecordRepository.ts`, `src/adapters/export/exportCaseRecord.ts`, `src/adapters/export/importCaseRecord.ts`, `src/ui/print/CaseRecordPrintView.ts`, and a focused semantic persistence panel.
- Expected UPDATE ownership: `src/main.ts`, store state/actions/selectors only as narrowly necessary, `index.html`, `public/style.css`, and record/offline/export/import tests. Keep existing directory conventions: PascalCase component files, camelCase non-class modules, camelCase JSON fields, and `noun.verb` event/action naming.

### Project Context Rules

- Essential progress and records must have semantic HTML representations; canvas-only capture is prohibited.
- Offline reload is a release gate: after a successful first load, a locally saved case must restore without a network request.
- Valid local progress survives failed imports or saves. Case definitions never mutate, and saved historical runs never recalculate against a new model.
- Tests must cover pure domain/schema logic with Vitest and browser behavior with Playwright; Axe augments but does not replace manual accessibility checks.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.8; FR11, FR17–FR18, FR24–FR25; NFR1, NFR5–NFR13, NFR18]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` — Measurement Notebook, Core Gameplay Loop, Controls and Input, Technical Specifications]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/reconcile-gdd.md` — carried-forward semantic, accessible, offline/portable UX constraints]
- [Source: `_bmad-output/game-architecture.md` — Data Persistence, Import/Export/Print, Error Handling, Project Structure, Architectural Boundaries, State Patterns, Testing]
- [Source: `_bmad-output/project-context.md` — Technology Stack, Organization, Testing, Platform, and Critical Don’t-Miss Rules]
- [Source: `_bmad-output/implementation-artifacts/1-7-consultations-peer-review-and-revision-history.md` — in-memory handoff, append-only decision history, review fixes, file/test patterns]
- [Source: `src/core/store/AppState.ts`, `src/core/store/createStore.ts`, `src/domain/evidence/RunRecord.ts`, `src/main.ts`, `src/adapters/OfflineCache.ts`, `src/ui/notebook/NotebookPanel.ts`, `tests/e2e/offline-reload.spec.ts` — current implementation state]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Ultimate context engine analysis completed: complete Epic 1/GDD/UX/architecture/project-context/current-code/previous-story/git-history and current official technical-documentation review.
- Parallel analysis confirmed that persistence, migration, portability, and print are absent; Story 1.7 supplies the authoritative in-memory state and semantic-panel conventions to extend.
- Validation checklist applied: the task list prevents duplicate progress state, invalid/partial imports, history/run mutation, immutable-content export, browser API leakage into domain, canvas-only printing, hidden data loss, and accessibility/test regressions.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status set to `ready-for-dev`.
- The story explicitly preserves the existing authority while adding adapter-owned offline persistence and a portable, semantic record.
- Cross-browser offline acceptance is called out because the existing E2E test is Chromium-only while this story requires Chromium, Firefox, and WebKit coverage.
- Implemented a strict versioned `CaseRecordSchema`, explicit v0→v1 migration, immutable hydrated state factory, and portable projection selector.
- Added adapter-owned IndexedDB, export/import, and print-dialog boundaries; saved progress restores only after the immutable case definition is available.
- Added accessible Save, Export, Import, and Print controls with focus restoration and neutral recovery messages; print output is semantic and uses scoped print CSS.
- Verified 108 Vitest tests, TypeScript, production build, accessibility E2E, Chromium portability/offline tests, and the cross-browser Playwright suite.

### File List

- `_bmad-output/implementation-artifacts/1-8-offline-progress-export-import-and-print.md` (created story record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status update)
- `index.html` (persistence and print mounts)
- `public/style.css` (progress controls and semantic print styles)
- `src/schemas/CaseRecordSchema.ts` (strict portable record validation and compatibility checks)
- `src/schemas/migrations/migrateCaseRecord.ts` (explicit supported record migrations)
- `src/core/store/AppState.ts` (validated immutable restore factory)
- `src/core/store/CaseRecordProjection.ts` (portable player-progress projection)
- `src/core/store/createStore.ts` (narrow validated-state replacement seam)
- `src/core/store/selectors.ts` (portable projection selector)
- `src/adapters/persistence/IndexedDbRepository.ts` (versioned IndexedDB boundary)
- `src/adapters/persistence/caseRecordRepository.ts` (validated record repository)
- `src/adapters/export/exportCaseRecord.ts` (JSON download adapter)
- `src/adapters/export/importCaseRecord.ts` (selected-file import adapter)
- `src/adapters/print/openPrintDialog.ts` (print adapter)
- `src/ui/persistence/CaseProgressPanel.ts` (accessible portability controls)
- `src/ui/print/CaseRecordPrintView.ts` (semantic printable record)
- `src/main.ts` (restore-before-mount composition and persistence subscription)
- `tests/unit/CaseRecordSchema.test.ts` (schema, migration, compatibility, and immutable hydration coverage)
- `tests/unit/CaseRecordRepository.test.ts` (repository atomicity coverage)
- `tests/e2e/progress-portability.spec.ts` (export/import/print recovery coverage)
- `tests/e2e/offline-reload.spec.ts` (saved progress and decision-history offline restore)
- `tests/e2e/accessibility.spec.ts` (portability and print accessibility coverage)

## Change Log

- 2026-08-05: Ultimate context engine analysis completed - comprehensive developer guide created; status set to ready-for-dev.
- 2026-08-05: Implemented offline persistence, validated export/import, semantic print record, and cross-browser recovery coverage; status set to review.
