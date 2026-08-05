---
title: 'Add the local Opticks archive book'
type: 'feature'
created: '2026-08-05'
status: 'done'
baseline_commit: '4f38d7d76d0005d1f71b318dc22d529cb7380f55'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-animated-phaser-lecture-book.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-correct-phaser-book-interaction-and-layout.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The reviewed Opticks card can be inspected as evidence but gives the player no local primary text to read or compare with Young’s lecture.

**Approach:** Add a locally stored, source-page faithful excerpt of Isaac Newton’s *Opticks*, fourth edition (1730), pages 371–376 (Queries 29–31), and open it through the existing semantic/Phaser archive book. The selected passage directly frames the corpuscular account used by the Young case.

## Boundaries & Constraints

**Always:** Preserve source spelling and page boundaries from the reviewed public-domain 1730 edition; cite the archive and identify the excerpt. Use the existing local immutable rendition contract, one printed source page per leaf, same semantic and Phaser book controls, current scroll-safe input handling, offline availability, and focus recovery. Reading must never inspect the source or change progress.

**Ask First:** Changing the selected edition/pages, adding a non-public-domain asset, translating or modernizing wording, extending the excerpt beyond pages 371–376, or changing evidence/progression semantics.

**Never:** Fetch the reading text at runtime; replace the inspected-evidence control; claim the excerpt is Young’s writing; make canvas the only reading path; duplicate book input/pagination code; persist a reading position.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Open Opticks | Player activates “Read the Opticks reference” | Semantic and Phaser book show printed pages 371–372 with source attribution | Reading leaves inspection/progress unchanged |
| Navigate excerpt | Player uses visual or semantic page controls | Both surfaces move across six source pages in three bounded spreads | First/last navigation is disabled or inert |
| Offline reload | Prior case is cached; network unavailable | Opticks text and navigation remain local and functional | Archive link is optional and does not block reading |
| Close book | Either surface closes the reference | Overlay cleans up and focus returns to the Opticks Read trigger | No orphaned Phaser interaction surface remains |

</frozen-after-approval>

## Code Map

- `public/cases/young-interference/case.json` -- immutable Opticks bibliographic metadata and local pages 371–376.
- `src/ui/sources/CuratedRecord.ts` -- already shows any reviewed textual rendition as a read trigger.
- `src/ui/context/CaseContextAndPrediction.ts` -- existing semantic reading authority and shared book projection.
- `src/ui/sources/lecturePagination.ts` -- existing one-source-page-per-leaf pagination.
- `tests/e2e/curated-record.spec.ts` -- public semantic, Phaser, scroll, close, and source-neutrality journey.
- `tests/e2e/offline-reload.spec.ts` -- cached local source reading regression.

## Tasks & Acceptance

**Execution:**

- [x] `public/cases/young-interference/case.json` -- add the reviewed public-domain 1730 *Opticks* citation and an immutable six-page English rendition of pages 371–376, centered on Queries 29–31.
- [x] `tests/unit/CaseDefinition.test.ts` -- validate the authored Opticks rendition structure and source-page references.
- [x] `tests/e2e/curated-record.spec.ts` -- open Opticks by its authored reader label, verify pages 371/372, scroll before visual navigation, close via Phaser, and confirm no inspection is recorded.
- [x] `tests/e2e/offline-reload.spec.ts` -- open and page the cached Opticks excerpt offline.
- [x] `_bmad-output/project-context.md` -- retain the reusable source-page archive-book and sticky-canvas input process for future references.

**Acceptance Criteria:**

- Given the player opens the Opticks reference, when the book opens, then its first spread contains locally stored printed pages 371 and 372 with clear Newton/1730 attribution.
- Given a player pages through Opticks on either surface, when they reach the bounds, then both surfaces agree on a valid spread and retain source-page labels.
- Given the player reads or closes Opticks, then inspected evidence, phase, and saved progress remain unchanged and focus returns to its Read trigger.
- Given an offline reload after warm-up, then the Opticks book opens and pages without a network request.

## Spec Change Log

## Design Notes

Pages 371–376 contain Query 29’s “very small Bodies” proposal and its immediately adjacent reasoning, followed by Queries 30–31. This is a bounded primary-source excerpt, not a claim that Newton’s treatment is reducible to a simple modern label.

## Verification

**Commands:**

- `rtk npm run typecheck` -- expected: case content and reader contract compile.
- `rtk npm test -- --run tests/unit/CaseDefinition.test.ts tests/unit/lecturePagination.test.ts` -- expected: valid immutable pages and source-page pagination.
- `rtk npm run test:e2e -- tests/e2e/curated-record.spec.ts` -- expected: local Opticks open/page/scroll/close behavior passes.
- `rtk npm run test:e2e:offline` -- expected: cached Opticks reading works without connection.
- `rtk npm run build` -- expected: production bundle succeeds.

## Suggested Review Order

**Local archival content**

- Six immutable source-page leaves make the reference readable offline without altering evidence semantics.
  [`case.json:419`](../../public/cases/young-interference/case.json#L419)

- The durable source-page and sticky-canvas rules guide every future archival reference.
  [`project-context.md:40`](../project-context.md#L40)

**Shared semantic presentation**

- Archive-neutral link copy supports both the Young and Opticks citations securely.
  [`CaseContextAndPrediction.ts:118`](../../src/ui/context/CaseContextAndPrediction.ts#L118)

**Player verification**

- Exercises source attribution, Phaser scroll input, bounded pagination, focus recovery, and evidence neutrality.
  [`curated-record.spec.ts:106`](../../tests/e2e/curated-record.spec.ts#L106)

- Confirms the local Opticks text remains readable and pageable after offline reload.
  [`offline-reload.spec.ts:60`](../../tests/e2e/offline-reload.spec.ts#L60)

- Locks the authored page IDs, source labels, citation archive, and source-boundary sentinels.
  [`CaseDefinition.test.ts:219`](../../tests/unit/CaseDefinition.test.ts#L219)
