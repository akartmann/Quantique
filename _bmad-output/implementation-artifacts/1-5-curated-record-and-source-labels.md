---
baseline_commit: f283c66c5e7df4d662012540135625194779e8b8
---

# Story 1.5: Curated Record and source labels

Status: ready-for-dev

## Story

As a player,
I want to inspect contextual sources with clear provenance labels,
so that I can distinguish evidence from reconstruction, interpretation, and fiction before using it in a conclusion.

## Acceptance Criteria

1. **Given** authored case content, **when** it is loaded, **then** each source record is validated with Zod before reaching domain logic; **and** invalid content returns a typed, recoverable failure.
2. **Given** a source in the Curated Record, **when** I inspect it through the semantic interface, **then** I can identify its title, creator or originating context, source type, provenance, rights status, and relevant case relationship; **and** that information is not Phaser-only.
3. **Given** primary material, reconstruction, later interpretation, or deliberate fiction, **when** it is presented, **then** its category is explicit text plus a non-colour-only visual treatment; **and** it remains understandable without sound.
4. **Given** I inspect a source, **when** the inspection is recorded, **then** the authoritative evidence state stores its source ID through a typed action; **and** the ID can later be referenced by notebook, theory-board, consultation, and review features.
5. **Given** incomplete rights information or unavailable source content, **when** I attempt inspection, **then** the interface provides a neutral semantic explanation and safe fallback; **and** never presents unreviewed historical material as verified evidence.
6. **Given** the Curated Record, **when** tests run, **then** unit tests cover source validation and provenance rules; **and** integration tests verify semantic labels and inspected-source state through public controls.

## Scope and sequencing

- This is a focused, incremental extension of Story 1.2's strict Young contract. Do not build Epic 3's general-purpose source/rights ledger, persistence (Story 1.8), prediction flow (Story 2.1), theory-board readiness (Story 1.6), consultations/review (Story 1.7), or historical debrief.
- The actual reviewed source corpus and release ledger remain future content work. The initial Young records must nevertheless be complete enough to meet the AC fields. Never invent unreviewed excerpts, claims, or rights clearance; an incomplete/unavailable item is not verified evidence.
- Keep exactly two required contextual artifacts for the minimal Young contract. The existing `contextualArtifacts` objects must evolve with a focused source-record shape rather than adding a parallel loader, data source, state store, or UI-local truth.
- Story 1.4 run records already own immutable `linkedEvidenceIds`. Do not mutate or backfill historical runs. At future run creation, copy the current frozen inspected-source ID list into `linkedEvidenceIds`; resolve readable source labels through selectors where needed.

## Tasks / Subtasks

- [ ] Define and validate focused authored source records (AC: 1, 2, 3, 5)
  - [ ] Extend `src/domain/cases/CaseDefinition.ts` with the minimal, immutable typed record needed by the AC: stable `id`, title/display name, creator or originating context, source type, provenance category/reference, rights status, and relevant case relationship. Use a constrained category union covering at least primary material, reconstruction, later interpretation, and deliberate fiction.
  - [ ] Extend `src/schemas/CaseDefinitionSchema.ts` with strict Zod 4 schemas for every source field. Preserve the current exact-two, stable unique contextual-artifact requirement and all existing strict Young/asset validation. Reject blank fields, unsupported categories or rights status, malformed provenance/relationship fields, duplicate IDs, and unknown fields before domain logic.
  - [ ] Update `public/cases/young-interference/case.json` and matching unit fixtures together. Keep it immutable authored content and keep the declared asset manifest unchanged unless a reviewed source asset is explicitly added and declared there.
  - [ ] Reuse `src/adapters/content/loadCaseDefinition.ts` as the **only** fetch/JSON/Zod boundary. Its existing `safeParse → Result → recursive freeze` path must validate source records automatically. Do not fetch, parse, or validate case JSON from a UI component, store reducer, or domain module.
  - [ ] Model incomplete rights safely: the schema may represent an explicit non-verified/incomplete status only when the UI can block it from inspection as verified and provide recovery. Never silently coerce missing rights metadata to “reviewed.”

- [ ] Add inspected-source state to the authoritative immutable store (AC: 4, 5)
  - [ ] Extend `src/core/store/AppAction.ts` with a typed `source.inspected` action carrying only a source ID. Keep action names `noun.verb`; do not use a scene/UI visibility event as evidence authority.
  - [ ] Extend `AppState` and `freezeState` in `src/core/store/AppState.ts` with frozen `inspectedSourceIds`. Initialize it empty; preserve case definition, live controls, runs, and comparison state on every transition.
  - [ ] Add a pure reducer branch that accepts only IDs declared by the loaded case definition and only sources eligible for verified inspection. Define the duplicate policy explicitly and test it; recommended behavior is a recoverable idempotent failure for an already inspected ID so rejected dispatches do not notify subscribers.
  - [ ] Unknown, duplicate, unavailable, or rights-incomplete source inspections must return the existing typed `Result` failure, retain all valid state, and cause no `createStore` subscriber notification. Reducers must never throw or expose raw error text.
  - [ ] Add public selectors in `src/core/store/selectors.ts` for source records, inspected IDs/state, and readable source labels. UI must render selectors and dispatch actions; it must not own a copied inspected-ID list.

- [ ] Build the semantic Curated Record surface and compose it with the existing shell (AC: 2, 3, 4, 5)
  - [ ] Add `src/ui/sources/CuratedRecord.ts` (or equivalently focused PascalCase component under `src/ui/sources/`) using the Story 1.4 vanilla-DOM render/subscription/focus-restoration pattern. Mount it in `src/main.ts` from the same store, and add a dedicated mount in `index.html` without removing `#boot-shell`, `#boot-status`, `#apparatus-controls`, `#measurement-notebook`, `#game-container`, or cached-launch behavior.
  - [ ] Render a labelled semantic region with a heading, short calm context prompt, and source cards using native buttons. Each card must expose title, creator/origin context, source type, provenance, rights status, and case relationship as visible/readable text. A source can never be meaningful only in Phaser, colour, icon/pattern, sound, hover, or the mockup.
  - [ ] Render provenance category as a named text label plus a non-colour cue (for example, a category-specific icon/pattern with accessible text). Treat `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/mockups/curated-record.html` as composition inspiration only; `EXPERIENCE.md` and `DESIGN.md` control behavior and accessibility.
  - [ ] On valid inspection, dispatch `source.inspected`, announce a factual, calm status, preserve logical focus after rerender, and make the inspected state perceivable without colour alone. Do not imply the player found a “correct” answer.
  - [ ] For incomplete rights or an unavailable source, keep the case context and existing inspected evidence visible; explain the limitation neutrally, offer a safe next step such as another linked item/retry where applicable, and never fabricate an excerpt or label it verified.
  - [ ] Extend `public/style.css` with the source-card token intent: notebook reading surface, structural border, named provenance treatment, 4.5:1+ text contrast, visible 2px+ keyboard focus, and 44×44 CSS-px interactive targets. Preserve readable desktop layout, sequential tablet layout, phone reading-only laboratory controls, and `prefers-reduced-motion` behavior.

- [ ] Preserve historical evidence linking and current public behavior (AC: 4, 6)
  - [ ] Update `src/main.ts` so `createCalculatedRunRecord` receives the current `store.getState().inspectedSourceIds` as `linkedEvidenceIds` for a **new** record. The factory remains pure; ID/time remain composed outside `src/domain/`.
  - [ ] Update `src/ui/notebook/NotebookPanel.ts` only as necessary to resolve displayed linked-evidence IDs through source selectors. Keep its current semantic record/comparison UI, public labels, status/recovery copy, focus restoration, and historical snapshot semantics. Do not recalculate a saved run or reattach newly inspected sources to it.
  - [ ] Do not alter the shared DOM/Phaser apparatus-control intent path, origin semantics, phase model, renderer lifecycle, or `src/adapters/phaser/`. Phaser may mirror context visually but must not own sources, inspected state, rights decisions, or announcements.

- [ ] Verify source boundaries, semantic flow, and regressions (AC: 1–6)
  - [ ] Extend `tests/unit/CaseDefinition.test.ts` with accepted focused source records plus rejected missing/blank fields, invalid categories/statuses, unknown source fields, and duplicate IDs. Retain loader tests proving the single Vite-base-aware boundary returns a recoverable `Result` for invalid content and recursively freezes authored source records.
  - [ ] Add focused unit coverage (new source/provenance spec if it prevents clutter) for provenance/rights eligibility and store transitions: declared source success, unknown/duplicate/ineligible rejection, deep immutability, preserved evidence, and no subscriber notification after a rejected action.
  - [ ] Add `tests/integration/CuratedRecord.test.ts` to exercise public actions/selectors: semantic source data is represented from the validated definition, inspected IDs become authoritative evidence, and a later run captures the current source snapshot while an earlier run remains unchanged.
  - [ ] Add `tests/e2e/curated-record.spec.ts` using `getByRole`/`getByLabel` to inspect both Young contextual sources, assert all required source metadata and category labels/non-colour text, receive a polite neutral status, and retain keyboard focus. Do not assert Phaser fields, canvas pixels, or incidental DOM structure.
  - [ ] Extend `tests/e2e/accessibility.spec.ts` to run axe after the Curated Record is exposed, plus the existing notebook comparison scan. Manually verify keyboard-only inspection, focus recovery, screen-reader announcements, non-colour/non-audio category understanding, zoom/text scaling, and responsive touch targets; axe is necessary but insufficient.
  - [ ] Run and retain the current Vitest suite, production build, boot-shell/cache/offline regression tests, accessible control DOM/Phaser parity, notebook comparison tests, and Playwright Chromium/Firefox/WebKit coverage. Do not loosen prior public assertions to accommodate this story.

## Dev Notes

### Required data flow

```text
immutable authored case.json source records
  → loadCaseDefinition (Zod safeParse + Result + recursive freeze)
  → typed source.inspected action
  → immutable AppState.inspectedSourceIds + selectors
  → semantic Curated Record and future run linkedEvidenceIds snapshot
  → later theory / consultation / review / persistence consumers
```

- The store is the sole mutable authority. Semantic HTML and Phaser may read selectors and dispatch typed actions only; neither directly mutates state or the other layer.
- `src/domain/` remains pure TypeScript: no Phaser, DOM, `fetch`, IndexedDB, `Date`, `crypto`, or browser APIs. Repositories alone load/validate case JSON; current `loadCaseDefinition` already supplies that boundary.
- Use Zod `safeParse` at content boundaries and map expected failures to the existing `Result` convention. Do not introduce exception-driven validation or Zod v3 APIs. Project pins are Phaser `4.2.1`, Vite `8.1.5`, TypeScript `~5.7.2`, Zod `4.4.3`, `idb` `8.0.3`, Vitest `4.1.10`, Playwright `1.61.1`, and `@axe-core/playwright` `4.12.1`; do not upgrade packages. `idb` remains unused until Story 1.8.
- Essential source inspection lives in semantic HTML. A `role="status"` region with polite updates is appropriate for ordinary inspection/recovery feedback; do not use disruptive assertive announcements for routine actions.
- Do not add accounts, telemetry, remote configuration, backend calls, learner-data logging, a freeform historical archive, physics, canvas-only interaction, scoring, speed pressure, hard fail, irreversible choice, or unreviewed historical claims/assets.

### Existing files to read and update deliberately

| Path | Current responsibility and required preservation |
| --- | --- |
| `src/adapters/content/loadCaseDefinition.ts` | The one Vite-base-aware content boundary: fetches `case.json`, Zod-validates it, checks the declared asset manifest, maps errors to `Result`, recursively freezes. Extend the contract, not this architecture. |
| `src/domain/cases/CaseDefinition.ts` | Strict minimal Young type; currently contextual artifacts only have ID/display name/provenance reference. Evolve it in tandem with schema and JSON. |
| `src/schemas/CaseDefinitionSchema.ts` | Strict Zod boundary schema. Preserve exact two, unique artifacts; add source/provenance/rights rules here—not in UI. |
| `public/cases/young-interference/case.json` | Immutable shipped authored case content. Add only reviewed, AC-required record metadata; never store player inspection progress here. |
| `src/core/store/AppAction.ts`, `AppState.ts`, `selectors.ts`, `createStore.ts` | Typed immutable authority and successful-transition notifications. Add inspected-source state/action/selectors without creating a second evidence store or notifying on rejection. |
| `src/main.ts` | Existing composition creates new run records with empty `linkedEvidenceIds`. Snapshot current inspected IDs only for new runs. |
| `src/ui/notebook/NotebookPanel.ts` | Semantic, store-driven notebook with focus restoration. Preserve historic records and resolve source display names through selectors if changed. |
| `index.html`, `public/style.css` | Extend the semantic shell while retaining boot IDs, controlled lab behavior, responsive notebook, and reduced-motion rules. |
| `src/adapters/phaser/*`, `src/ui/apparatus/ApparatusControls.ts` | No source authority belongs here. Preserve Story 1.3's shared intents, semantic announcements, phone read-only state, and lifecycle cleanup. |

### Expected file changes

- **New:** `src/ui/sources/CuratedRecord.ts`, `tests/integration/CuratedRecord.test.ts`, `tests/e2e/curated-record.spec.ts`; add a focused unit source/provenance spec only if it improves clarity.
- **Update:** `src/domain/cases/CaseDefinition.ts`, `src/schemas/CaseDefinitionSchema.ts`, `public/cases/young-interference/case.json`, `src/core/store/AppAction.ts`, `src/core/store/AppState.ts`, `src/core/store/selectors.ts`, `src/main.ts`, `index.html`, `public/style.css`, and focused existing unit/integration/E2E tests.
- **Potential update:** `src/ui/notebook/NotebookPanel.ts` solely to render linked source labels. No Phaser, persistence, export/import, or generic future-case framework changes are expected.

### Previous-story and Git intelligence

- Story 1.2 established the Vite-base-aware, manifest-checked, recursively frozen Young definition and pure phase reducer. Reuse its only content boundary; do not create an alternate source fetch path.
- Story 1.3 established the shared immutable store, semantic numeric inputs, and Phaser projection. Its review fixes are regression-sensitive: phone lab controls stay read-only, Phaser-originated changes announce semantically, exponent-form authored values normalize deterministically, and duplicate commits/announcements are avoided.
- Story 1.4 established immutable historical run snapshots, public evidence selectors, comparison state, semantic notebook, neutral recovery, and rerender focus restoration. Its review fixed malformed record handling, source/case preservation, pair-key collisions, notebook focus, button focus contrast, and Axe/browser coverage. Build on these patterns.
- Recent commits: `f283c66 Review 1.4`, `61e1185 Dev 1.4`, `1081944 Story 1.4`, `83faa95 Review 1.3`, `5444378 Dev 1.3`. Preserve their tested public contracts rather than rewriting foundations.

### Project Context Rules

- Phaser is visual-only; semantic HTML owns source inspection, labels, rights status, focus, and announcements. Domain code never imports Phaser/browser APIs; adapters own effects and dependencies point inward.
- Use PascalCase for component files/types, camelCase for functions/properties, `UPPER_SNAKE_CASE` for constants, camelCase JSON fields, kebab-case case IDs/assets, and `noun.verb` actions/events.
- Keep source categories explicit in text plus a non-colour cue. Meet 4.5:1+ text contrast, keyboard order, visible focus, 44×44 targets where applicable, WCAG 2.2 AA keyboard behavior, and reduced-motion-safe rendering.
- Target current desktop Chrome, Firefox, Safari, and Edge; retain equivalent pointer/touch/keyboard outcomes for tablet. Phones remain laboratory-read-only, but source records must remain readable.
- Static offline-first constraints remain: no account, analytics, cloud save, remote configuration, backend, or critical-play network dependency. Case definitions and assets stay immutable; player progress is local only.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.5; FR5, FR27; NFR6–NFR13; Stories 1.2, 1.4, 1.6–1.9, 3.3]
- [Source: `_bmad-output/game-architecture.md` — Content Model, User Interface and Rendering Boundary, Error Handling, Project Structure, Data Patterns, Test and Release Readiness]
- [Source: `_bmad-output/project-context.md` — Technology Stack & Versions; Engine-Specific, Code Organization, Testing, Platform, and Critical Don’t-Miss Rules]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` — Core Gameplay, Measurement Notebook, Level Structure, Art and Audio Direction, Asset Requirements]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md` — Information Architecture, Component and State Patterns, Accessibility Floor, Key Flows]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/DESIGN.md` — Source Card, Colors, Typography, Components, Do’s and Don’ts]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/mockups/curated-record.html` — composition inspiration only; behavioral spines prevail]
- [Source: `_bmad-output/implementation-artifacts/1-4-measurement-notebook-and-run-comparison.md` — completed immutable evidence, store, UI, review fixes, and regression contracts]
- [Zod 4 package documentation](https://zod.dev/packages/zod) — retain `safeParse` at content boundaries.
- [WAI-ARIA live-region guidance](https://www.w3.org/TR/wai-aria-1.0/states_and_properties) — routine status updates should remain polite rather than interruptive.
- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) — axe scans exposed UI state but does not replace manual accessibility assessment.

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Ultimate context engine analysis completed: full planning/GDD/architecture/project-context/UX review; source mockup and current code inspection; prior-story/Git intelligence; parallel artifact and source/code research; official Zod/ARIA/Playwright documentation review.
- Validation checklist applied: this context prevents a parallel content path or evidence store, unreviewed-source presentation, historic-run mutation, Phaser-owned accessibility behavior, and regression of previous semantic controls.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status set to `ready-for-dev`.
- The story is intentionally incremental: it provides a minimal validated source contract and inspected evidence state now while reserving reusable ledger, persistence, theory, review, and release sign-off work for their dedicated stories.

### File List

- `_bmad-output/implementation-artifacts/1-5-curated-record-and-source-labels.md` (new story context)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status update)

## Change Log

- 2026-08-04: Ultimate context engine analysis completed - comprehensive developer guide created; status set to ready-for-dev.
