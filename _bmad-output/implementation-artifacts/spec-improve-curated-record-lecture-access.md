---
title: 'Improve curated record lecture access'
type: 'feature'
created: '2026-08-05'
baseline_commit: '6c4d5d49e7e560db0227a459dc3183b3e50f76ae'
status: 'done'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Curated Record currently provides only catalog metadata. Inspecting Thomas Young’s 1801 item records it as evidence but gives the player no way to see the real historical record, so the activity is not informative—especially when offline.

**Approach:** Create a local, structured text rendition of Young’s *Bakerian Lecture: On the theory of light and colours* from a reviewed public-domain primary source, and show it directly in the semantic context area. Give every section a stable content ID and language tag so translated content can be added now and selected later by browser locale; retain a clearly separate facsimile/archive citation for provenance.

## Boundaries & Constraints

**Always:** Keep the authored rendition and provenance citation in the immutable case definition and validate it at the existing loader boundary. Render the current English source sections as native semantic text in the context area, using stable section IDs and locale-tagged content that will not require a case-data migration when browser-locale selection is introduced later. Retain the exact-two source contract, current inspection action/status/focus behavior, source provenance labels, and all offline core-play behavior. Base the English rendition only on the Wellcome Collection Public Domain Mark scan of Young’s 1802 printing; identify it accurately as a printing of the 1801 Royal Society Bakerian Lecture, read 12 November 1801.

**Ask First:** Adding translations beyond the original English rendition; adding a new transcript, scan, quotation, image, historical claim, or source asset; changing source rights classifications; replacing the cited record or its Public Domain Mark; or making an external resource necessary to inspect evidence or advance progress.

**Never:** Fetch source content in UI/domain/store code; add a second case-data path, generic i18n framework, locale selector, browser-locale behavior, or machine translation in this change; package a scan without documented reuse rights; treat opening the local rendition as proof that a player has read it; claim the 1801 record was a Royal Institution lecture; remove or weaken neutral recovery for unavailable/ineligible sources; expose source details only through Phaser, colour, hover, or sound.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Young lecture record | Valid locale, stable section IDs, headings/paragraphs, page references, citation, and HTTPS archive URL | Card presents “Read the lecture record”; the semantic context area renders the local, structured English rendition and its source-page references | The reader works offline as soon as the case definition has loaded |
| Invalid local rendition | Blank/duplicate IDs, unsupported locale, empty section/text/page reference, malformed/non-HTTPS archive URL, or unknown fields | Case definition is rejected at the existing Zod boundary before domain/UI use | Existing typed recoverable loader failure; no partial source UI |
| Translation later added | Another rendition has the same stable section IDs and a supported locale | A future browser-locale feature can select it without migrating the source record or changing section markup | The current reader intentionally renders English until that feature is approved |

</frozen-after-approval>

## Code Map

- `src/domain/cases/CaseDefinition.ts` -- canonical immutable contextual-source types and eligibility rule.
- `src/schemas/CaseDefinitionSchema.ts` -- strict Zod validation for authored case content.
- `public/cases/young-interference/case.json` -- the two reviewed source records and their historical metadata.
- `src/ui/sources/CuratedRecord.ts` -- semantic source-card projection, inspection action, live status, and focus restoration.
- `src/ui/context/CaseContextAndPrediction.ts` -- semantic context-phase ownership and local record-reader placement.
- `src/main.ts` -- explicit UI-only coordination between source-card reader controls and the context reader.
- `public/style.css` -- source-card link/focus styling and non-colour readability.
- `tests/unit/CaseDefinition.test.ts` -- fixture and schema/loader validation coverage.
- `tests/integration/CuratedRecord.test.ts` -- source selector/public-flow coverage.
- `tests/e2e/curated-record.spec.ts` -- player-visible semantic access and inspection journey.

## Tasks & Acceptance

**Execution:**

- [x] `src/domain/cases/CaseDefinition.ts` and `src/schemas/CaseDefinitionSchema.ts` -- add a focused immutable textual-rendition descriptor for a reviewed contextual artifact: reader label, locale-tagged rendition, stable section IDs, heading/paragraph content, source-page references, reuse/citation text, and strict HTTPS archival URL. Reject blank, duplicate, malformed, unsupported, unknown, or non-reviewed-reader data; preserve equivalent ordered section IDs across any future locale rendition.
- [x] `public/cases/young-interference/case.json` and affected source fixtures -- transcribe and structure the full 1802 English printing of Young’s lecture from the Wellcome Collection Public Domain Mark source, preserving section/page mapping and attribution; correct the creator/origin wording without adding interpretation, a new claim, or a new rights classification.
- [x] `src/main.ts`, `src/ui/sources/CuratedRecord.ts`, `src/ui/context/CaseContextAndPrediction.ts`, and `public/style.css` -- coordinate the native “Read the lecture record” control through an explicit UI callback, not global browser events or store state. Render the structured English text in the semantic context area with headings, paragraphs, page references, a visible external facsimile/archive citation, and an explicit statement that reading is separate from evidence inspection; opening transfers focus to the reader and closing returns it to the triggering source-card control.
- [x] `tests/unit/CaseDefinition.test.ts`, `tests/integration/CuratedRecord.test.ts`, `tests/e2e/curated-record.spec.ts`, and `tests/e2e/offline-reload.spec.ts` -- cover textual-rendition validation, canonical projection, reviewed-rights rule, source-card-to-context-reader flow, every source-page section/order, citation semantics, repeated open/close focus behavior, preserved inspection state, and offline reader availability after case load.

**Acceptance Criteria:**

- Given the Young case is loaded, when a player chooses “Read the lecture record”, then they can identify it as the 1801 Royal Society Bakerian Lecture and read the complete locally rendered English text, organized into cited sections in the semantic context area.
- Given a future translation is authored with the same stable section IDs and locale tag, when browser-locale selection is introduced in a later feature, then it can be selected without migrating the source record, changing section markup, source ID, or evidence state; until then, the reader renders English.
- Given a rendition field is invalid, duplicated, empty, unsupported, or has a malformed archive URL, when the case loads, then the existing content loader returns a recoverable validation failure before a partially valid Curated Record renders.
- Given a source is incomplete or unavailable, when its authored record includes a textual rendition, then the case definition is rejected rather than exposing unreviewed content as verified contextual material.
- Given a player is offline after the case definition has loaded, when they read or inspect the reviewed Young source, then the locally rendered record, existing evidence-recording behavior, calm status, and focus restoration remain available and no progression is blocked by connectivity.

## Spec Change Log

## Design Notes

The rendition is authored content, not UI configuration, so source provenance, source-page mapping, and the player-visible text cannot drift apart. It is loaded with the existing immutable case definition—no runtime fetch or PDF plug-in is needed. Sections have stable IDs and locale tags rather than text-derived identifiers, so a later browser-locale feature can choose a translation without migrating case data; this implementation intentionally renders English only. “Read the lecture record” is separate from “Inspect …”, which remains the evidence action; the text reader belongs in the semantic context phase, never in Phaser. A UI-only callback links the two semantic components and owns focus handoff, avoiding a global event or persisted reader state.

## Verification

**Commands:**

- `rtk npm run typecheck` -- expected: TypeScript accepts the stricter source shape throughout the app and fixtures.
- `rtk npm test -- --run tests/unit/CaseDefinition.test.ts tests/integration/CuratedRecord.test.ts` -- expected: rendition/review-rights validation and public evidence flow pass.
- `rtk npm run test:e2e -- tests/e2e/curated-record.spec.ts` -- expected: Chromium verifies the local text reader, every page section/order, citation semantics, close/focus return, and preserved inspection behavior.
- `rtk npm run test:e2e:offline` -- expected: previously loaded core play still reloads offline.
- `rtk npm run build` -- expected: production bundle completes successfully.

## Suggested Review Order

**Reader entry and focus flow**

- Composition wires the two semantic panels through a narrow UI-only callback.
  [`main.ts:69`](../../src/main.ts#L69)

- The controller renders, closes, and restores focus without changing evidence state.
  [`CaseContextAndPrediction.ts:25`](../../src/ui/context/CaseContextAndPrediction.ts#L25)

- Source cards expose reading only for reviewed authored renditions.
  [`CuratedRecord.ts:35`](../../src/ui/sources/CuratedRecord.ts#L35)

**Authored historical content boundary**

- The complete local English record begins with its attribution and stable reader label.
  [`case.json:18`](../../public/cases/young-interference/case.json#L18)

- The restored page-39 source table preserves the archive’s scientific values.
  [`case.json:302`](../../public/cases/young-interference/case.json#L302)

- Schema permits local text only for reviewed sources and validates strict content structure.
  [`CaseDefinitionSchema.ts:189`](../../src/schemas/CaseDefinitionSchema.ts#L189)

**Future translation contract and regression proof**

- The English-only type preserves stable rendition structure for a later locale feature.
  [`CaseDefinition.ts:7`](../../src/domain/cases/CaseDefinition.ts#L7)

- Browser tests prove all source pages, focus return, and read-versus-inspect separation.
  [`curated-record.spec.ts:34`](../../tests/e2e/curated-record.spec.ts#L34)

- Offline reload verifies the locally loaded reader remains readable without network access.
  [`offline-reload.spec.ts:3`](../../tests/e2e/offline-reload.spec.ts#L3)
