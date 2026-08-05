---
baseline_commit: 83ea7e3
---

# Story 2.4: Young learning and educator validation gate

Status: in-progress

## Story

As a release owner,
I want a moderated Young validation gate before later-case production,
so that later cases build on demonstrated learning, accessibility, and educator value rather than an untested slice.

## Acceptance Criteria

1. **Given** a Young release candidate, **when** validation is scheduled before any Morley, Hafele–Keating, or Delft production work, **then** 15–30 moderated learner sessions are run with no product telemetry, **and** a facilitator-owned observation rubric records only consented, de-identified session evidence outside player progress.
2. **Given** the completed moderated sessions, **when** the gate is evaluated, **then** at least 60% of participants cite a recorded observation or setting when explaining their conclusion in their own words, **and** at least 60% voluntarily test at least one variable beyond the minimum path.
3. **Given** educator review of the Young candidate, **when** the gate is evaluated, **then** at least five educators state they would share or use the case, **and** the evidence artifacts name the session owner, rubric, de-identified aggregate, educator responses, accessibility findings, and release decision.
4. **Given** a learner needs validation access, **when** the candidate is launched for a moderated session, **then** a non-campaign validation route grants Young access without changing campaign locks or player progression, **and** it does not unlock, relock, or expose later cases.
5. **Given** any target, scholarly source/rights review, accessibility acceptance, low-end-laptop 60-FPS 10-minute lab-loop check, or offline-reload check is unmet, **when** the Young gate is reviewed, **then** later-case production and Young public validation are blocked with no waiver, **and** the recorded release decision identifies the owner and required remediation.

## Tasks / Subtasks

- [x] Create facilitator-owned validation evidence materials outside the product and outside `public/` (AC: 1–3, 5)
  - [x] Add `docs/validation/young-validation-plan.md`: scope, 15–30-session sampling target, session owner, consent/de-identification protocol, no-product-telemetry rule, facilitator workflow, and evidence-retention boundary. Do not put participant names, identifiers, raw conclusions, exports, or progress records in the app or repository fixtures.
  - [x] Add `docs/validation/young-observation-rubric.md` with explicit, human-observed binary fields and definitions for: (a) participant cites a recorded observation or apparatus setting in their own words, and (b) participant voluntarily tests at least one beyond-minimum variable. Define the numerator, denominator, exclusions, and the >=60% calculation; do not infer either metric from application state, events, IndexedDB, or Playwright.
  - [x] Add de-identified aggregate and educator-response templates. The aggregate must record only totals/percentages, denominator, calculation date, owner, and links/locations for consented facilitator evidence; educator responses must record whether each reviewer would share/use the case without adding product accounts or a survey integration.
  - [x] Add templates/checklists for scholarly source-and-rights review, manual accessibility findings, low-end-laptop performance, cached offline reload, and a final release decision. Each unmet gate must have a named remediation owner, evidence reference, and follow-up date; the decision is `blocked` unless every required gate passes—there is no waiver field or override path.

- [x] Add a narrow validation-only Young entry mode without creating campaign functionality (AC: 1, 4)
  - [x] In `src/main.ts`, parse one explicit validation entry convention (for example `?mode=validation`) before creating state. The current product contains only Young and has no campaign-lock system; do not invent campaign state, later-case routes, generic routing, or a future-case framework in this story.
  - [x] Validation mode must load the same immutable, Zod-validated `young-interference` definition and the same semantic/typed-action investigation loop, but must create a fresh in-memory `AppState`. It must not call `CaseRecordRepository.load`, save a record, restore progress, import/export/print progress, or write any session evidence to IndexedDB, `CaseRecord`, local storage, network, console, analytics, or error telemetry.
  - [x] In validation mode, do not mount `mountCaseProgressPanel`; its subscription automatically projects and persists each state transition. Preserve that panel and its normal-route autosave/import/export/print behavior unchanged outside validation mode.
  - [x] Add a small semantic validation-session disclosure near the existing boot shell: it must identify the Young validation session, state that observations are facilitator-held and de-identified, state that the application does not collect session responses, and avoid score/right-wrong/speed language. Keep the existing `Enter laboratory` button, `data-testid="enter-laboratory"`, and `#boot-status` contract intact.
  - [x] Validation mode must never expose navigation, links, IDs, or content for Morley, Hafele–Keating, Delft, or another later case. It must not alter the current normal route’s persisted completion archive, counterfactual replay, recognition, case definition, or historical debrief.

- [x] Preserve architecture and accessibility boundaries for the validation route (AC: 1, 4)
  - [x] Keep semantic HTML authoritative: validation disclosure and all essential Young interactions remain keyboard, pointer, and touch operable with labels, logical reading order, visible focus, polite non-urgent status, non-colour meaning, 44px touch targets, zoom/text scaling, and reduced-motion support. Phaser remains a visual mirror and cannot own validation state, consent, session observation, progression, or accessibility UI.
  - [x] Do not add dependencies, backend calls, accounts, remote survey/form integrations, analytics, telemetry, a session database, generic services/managers/helpers, or browser APIs in `src/domain/`. Keep the pinned Phaser 4.2.1, TypeScript 5.7.2, Vite 8.1.5, idb 8.0.3, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1, and axe 4.12.1 stack.
  - [x] Keep case definitions and assets immutable. Reuse the existing typed store/actions and `CaseRecordRepository` validation boundary; do not add validation-session fields to `CaseDefinition`, `AppState`, `CaseRecordProjection`, `CaseRecordSchema`, exports, imports, persistence migrations, or the print view.

- [ ] Prove product isolation and release readiness with automated and human evidence (AC: 4, 5)
  - [x] Add a focused validation-route Playwright suite. Assert it opens the accessible Young route, retains the existing semantic boot contract, has no progress controls, does not touch a pre-seeded normal-route IndexedDB record, and has no later-case controls/content. Test the normal route separately to prove its restore, save, export/import, debrief, and replay behavior remain unchanged.
  - [ ] Extend `tests/e2e/accessibility.spec.ts` or add a focused validation accessibility test using semantic roles/labels and axe for the disclosure. Manually verify keyboard-only flow, focus recovery, screen-reader announcements, non-colour scientific encoding, zoom/text scaling, reduced motion, and tablet touch; do not claim axe alone proves acceptance.
  - [x] Extend boot/offline coverage so a cached validation route loads after a successful online cache warm-up and the normal offline-reload path still restores saved player progress. Preserve the no-network-critical-play requirement.
  - [x] Run `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run test:e2e:a11y`, `npm run test:e2e:offline`, and `npm run test:e2e:cross-browser` where the browsers are available. Record browser availability/results in the release evidence rather than fabricating a pass.
  - [ ] Perform and record, without application instrumentation, the 10-minute laboratory loop at 1280×720 on a representative low-end school laptop and verify a 60-FPS target; record manual source/rights review, accessibility acceptance, and offline result. Do not treat an automated test or a rendered FPS estimate as this human release gate.

## Dev Notes

### Scope, dependencies, and non-goals

- This is the hard release-governance gate that completes the Young validation slice. It fulfils FR25 and release-readiness conditions for FR26; it is the boundary before Epic 3 framework hardening and later Morley, Hafele–Keating, and Delft case production.
- Epic 2 is complete in product terms before this story: Story 2.1 owns inspected contextual artifacts and prediction; 2.2 owns deterministic, versioned physical Young runs with semantic/Phaser intent parity; 2.3 owns authoritative bounded conclusion, peer-review/revision, immutable completion, historical debrief, and counterfactual replay. Reuse all of them; do not rebuild or weaken their gates.
- This story does **not** implement player analytics, adaptive assessment, accounts, cloud save, a campaign system, later cases, a generic case framework, a hosted survey, or a release dashboard. Human-facilitated validation artifacts are deliberate project documentation, not game data.

### Current code intelligence — read before editing

| Path | Current behavior to preserve | Story 2.4 change boundary |
| --- | --- | --- |
| `src/main.ts` | Loads immutable Young content, restores normal IndexedDB progress, mounts every semantic panel, persistence panel, print view, and Phaser. | Select validation mode before repository load; use a fresh store and omit persistence controls only in that mode. |
| `src/ui/persistence/CaseProgressPanel.ts` | Subscribes to every store transition and saves it; also provides save/export/import/print. | Do not alter normal behavior. Do not mount it in validation mode. |
| `src/adapters/persistence/caseRecordRepository.ts`, `src/adapters/persistence/IndexedDbRepository.ts` | Own validated local progress persistence. | Validation mode must make no calls to either adapter. |
| `src/core/store/AppState.ts`, `CaseRecordProjection.ts`, `CaseRecordSchema.ts` | Authoritative immutable investigation, completion/replay state, and portable player-only record. | No validation metrics, consent, educator data, or facilitator evidence fields. |
| `src/ui/BootShell.ts`, `index.html`, `public/style.css` | Semantic entry button/status, responsive focus and motion baseline. | Add only a focused, semantic disclosure; retain test IDs, status ID, existing shell, focus, responsive, and reduced-motion behavior. |
| `public/cases/young-interference/case.json` | Immutable reviewed source data, deterministic model, historical debrief/replay labels. | Do not mutate it for session data or release process evidence. |

### Privacy, data, and gate rules — non-negotiable

- Product telemetry is prohibited. Do not add `fetch`, beacons, analytics SDKs, event logging, web forms, cloud storage, local storage, IndexedDB tables, product metrics, or hidden instrumentation.
- Do not log, save, export, print, or show learner-entered conclusions outside the normal learner-owned record. In validation mode, do not create a portable record at all.
- The 60% metrics are facilitator observations, not derived product facts. A test may prove validation-mode isolation and the availability of the optional-variable interaction; it must never assert that a participant learned, cited evidence, or voluntarily explored.
- Required release evidence names: learning-validation lead/session owner, educator-review lead, scholarly/rights reviewer, accessibility reviewer, QA/release lead, release owner; plus rubric, de-identified aggregate, educator responses, accessibility findings, technical evidence, release decision, remediation owner, and evidence references.
- All gates are conjunctive and non-waivable: learner evidence target, educator target, scholarly source/rights review, manual accessibility acceptance, 60 FPS low-end-laptop loop, and cached offline reload. Any one failure blocks both Young public validation and later-case production.

### Architecture, UX, and project rules

- Data flow remains: semantic DOM or optional Phaser intent → typed action → pure immutable domain/store → selectors/subscriptions → DOM/Phaser projection. `origin` is diagnostics-only and must not affect results or progression.
- `src/domain/` remains pure TypeScript with no DOM, Phaser, `fetch`, IndexedDB, or browser APIs. Repositories alone read/validate case JSON; adapters own side effects. Do not introduce a generic `services/`, `managers/`, or `helpers/` layer.
- Semantic HTML owns all essential controls, content, values, instructions, focus, and announcements. Canvas cannot be a validation-only pathway. Keep the current phone reading-only behavior and verify desktop browser plus equivalent tablet keyboard/pointer/touch outcomes.
- Maintain calm, precise, invitational copy. Never imply a score, answer correctness, speed reward, hard fail, irreversible wrong choice, or that the product is grading a learner. Recovery guidance remains neutral and does not expose raw errors.
- Keep render/update paths free of persistence, JSON parsing, DOM work, logging, and per-frame scientific calculation. No new renderer performance strategy is justified before profiling.

### Testing requirements

- Unit tests are only needed for extracted pure validation-mode parsing/helpers, if introduced. Test the normal/validation entry decision without browser APIs in domain code.
- E2E tests must use public semantic roles/labels, not Phaser private fields, pixels, or internal store state. Verify validation mode has no progress-region controls and normal saved progress stays intact after visiting validation mode.
- Run axe, then complete manual accessibility acceptance. Validate Chromium/Firefox/WebKit where available; state unavailable browsers in the evidence artifact.
- Treat cached offline reload, 60 FPS at 1280×720 on a representative low-end school laptop, and 15–30 moderated sessions as manual release evidence. Automated tests cannot substitute for them.

### Previous story intelligence and Git history

- Story 2.3’s completion archive and counterfactual replay are authoritative: preserve the completed historical snapshot, fixed historical narrative, decision history, recognition, and label **“Counterfactual replay — not the recorded historical result.”** Validation mode must not overwrite any of them.
- Story 2.2 review closed phase, model-record, advanced-wavelength, reset, historical-rendering, and legacy-fixture gaps. Continue to use model-backed, phase-gated records rather than reviving prepared-observation seams.
- Recent commits `305ca17`/`83ea7e3` (Dev/Review 2.3) and `d7815db`/`d72c5ae` (Dev/Review 2.2) favor narrow semantic-first changes, pure state/schema invariants, and cross-layer tests. Expect review to scrutinize persistence and state-isolation regressions.

### Latest technical information

- Do not upgrade the pinned stack for this bounded story. Zod 4 continues to support `safeParse` as the non-throwing validation boundary; retain existing schema-boundary patterns. [Source: Zod documentation](https://zod.dev/basics)
- Playwright’s current accessibility guidance supports `@axe-core/playwright` scans but explicitly requires complementary manual accessibility assessment. Use axe for the new semantic disclosure and retain manual acceptance evidence. [Source: Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)
- If test mocks are necessary, note that Vitest 4 altered some mock behavior; restore/reset mocks deliberately and avoid changing existing test assumptions unnecessarily. [Source: Vitest migration guide](https://vitest.dev/guide/migration)

### Project Structure Notes

- Expected new documentation: `docs/validation/young-validation-plan.md`, `young-observation-rubric.md`, aggregate/educator/source-rights/accessibility/performance/offline/release-decision templates or clearly named equivalents in the same non-public folder.
- Expected focused updates: `src/main.ts`; a small focused validation disclosure component only if it cannot stay in the boot shell; `index.html` and `public/style.css` only as needed; relevant E2E suites. Do not create data models, migrations, public assets, backend integrations, or campaign modules.
- Naming remains PascalCase for classes/components and their files, camelCase for functions/properties/JSON fields, and `noun.verb` typed action names. Use exact semantic labels and stable selectors only where existing testing patterns need them.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.4; release-gate owners]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` — Development Epics, Success Metrics, Out of Scope]
- [Source: `_bmad-output/game-architecture.md` — static/offline architecture, dual-surface accessibility, performance, and release readiness]
- [Source: `_bmad-output/project-context.md` — pinned stack, domain/adapters boundaries, accessibility, performance, testing, and privacy rules]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md` — semantic interaction, accessibility floor, platform behavior]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/DESIGN.md` — calm feedback, focus, contrast, and non-colour rules]
- [Source: `_bmad-output/implementation-artifacts/2-1-young-contextual-record-and-prediction.md`, `2-2-young-double-slit-experiment.md`, `2-3-young-synthesis-debrief-and-replay.md` — existing Young gates and persistence/replay invariants]
- [Source: `src/main.ts`, `src/ui/persistence/CaseProgressPanel.ts`, `src/core/store/AppState.ts`, `src/core/store/CaseRecordProjection.ts`, `src/schemas/CaseRecordSchema.ts`, `public/cases/young-interference/case.json` — current isolation and persistence seams]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Ultimate context engine analysis completed: sprint status, Epic 2, GDD, architecture, UX, project context, Stories 2.1–2.3, current persistence/entry/test seams, Git history, and current official testing/validation documentation were analyzed.
- The story prevents the two principal failure modes: treating application state as research telemetry and allowing validation sessions to modify normal learner progress.
- Implemented `?mode=validation` before persistence setup. The route loads the same validated Young case into a fresh store, mounts a semantic facilitator-held disclosure, and bypasses `CaseRecordRepository` plus persistence/print surfaces.
- Automated evidence: `npm run typecheck`, `npm test` (22 files, 135 tests), `npm run build`, Chromium E2E/a11y/offline, and Chromium/Firefox/WebKit E2E all passed on 2026-08-05.

### Implementation Plan

- Keep validation state ephemeral by selecting the entry mode before any repository instance is created.
- Reuse existing Young semantic controls and typed actions; expose only a focused semantic disclosure in validation mode.
- Test route isolation through public roles and normal-route restoration; keep human release gates blocked until evidence is supplied.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Added facilitator-owned, non-public validation templates and a blocked-by-default release decision path with no waiver.
- Added an isolated `?mode=validation` Young route that retains the existing semantic boot contract and does not load, save, export, import, print, or expose normal player progress.
- Added focused validation route, accessibility, and offline cache coverage; automated browser coverage is recorded in `docs/validation/young-technical-evidence.md`.
- Human acceptance remains outstanding: moderated learner sessions, educator review, source/rights review, manual accessibility review, and representative low-end-laptop performance verification. Release remains blocked until the named owners supply evidence.

### File List

- `_bmad-output/implementation-artifacts/2-4-young-learning-and-educator-validation-gate.md` (created)
- `docs/validation/young-validation-plan.md` (new)
- `docs/validation/young-observation-rubric.md` (new)
- `docs/validation/young-validation-aggregate-template.md` (new)
- `docs/validation/young-educator-responses-template.md` (new)
- `docs/validation/young-source-rights-review-template.md` (new)
- `docs/validation/young-accessibility-findings-template.md` (new)
- `docs/validation/young-performance-template.md` (new)
- `docs/validation/young-offline-reload-template.md` (new)
- `docs/validation/young-release-decision-template.md` (new)
- `docs/validation/young-technical-evidence.md` (new)
- `index.html` (modified)
- `public/style.css` (modified)
- `src/main.ts` (modified)
- `src/ui/ValidationSessionDisclosure.ts` (new)
- `tests/e2e/accessibility.spec.ts` (modified)
- `tests/e2e/offline-reload.spec.ts` (modified)
- `tests/e2e/validation-route.spec.ts` (new)

## Change Log

- 2026-08-05: Added the isolated Young validation entry route, facilitator-owned validation evidence materials, automated release evidence, and focused validation accessibility/offline/isolation tests. Human release gates remain blocked pending external evidence.
