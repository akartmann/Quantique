---
title: 'PNG-backed Morley–Miller character designs'
type: 'feature'
created: '2026-08-21'
status: 'done'
baseline_commit: 'be202438394c66d7f368ed7532b717d88e4981c9'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Morley–Miller still stages Edith Vance, Tomás Reyes, Harriet Lowe, Nils Abrahamsen, and the Cleveland bench as code-drawn silhouettes, while Young already uses richer full-body pixel-art character PNGs. The supplied `characters_design.png` is visual direction only; its labels and identities are not case content.

**Approach:** Create one production-ready, label-free pixel-art portrait per Morley–Miller character, then author them through the existing case-asset and Phaser character-stage contract used by Young, keeping the current vectors as resilient fallbacks.

## Boundaries & Constraints

**Always:** Preserve the authored Morley–Miller identities, accent colours, figure fallbacks, speaker emphasis, in-canvas-only staging, EN+FR content, reduced-motion behavior, lifecycle cleanup, asset-manifest equality, warmed-offline restoration, and ADR-006 information boundary. Use transparent 512×768 RGBA PNGs with a common feet baseline and document the reference, derivative status, and technical validation. Treat every portrayed person as fictional, not a historical likeness.

**Ask First:** A material redesign beyond period pixel-art direction and the existing authored silhouette cues; replacing the built-in transparent-image workflow; or changing incomplete/pending asset-rights status to reviewed or publicly cleared.

**Never:** Ship the source sheet or its labels/black background; crop it into character art; alter cast membership, proposals, dialogue, scoring, scientific behavior, or the rival's non-colleague status; remove the vector fallback; add a DOM surface, a staging interaction, a render/update loop, or Young-specific assumptions.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Authored portrait | Morley case image is in the decoded texture cache | Matching full-body PNG stands on the established stage baseline, retaining plaque and speaker emphasis | N/A |
| Missing portrait | Manifested image cannot decode or is unavailable | Existing authored vector appearance renders in the same slot | No error tile, throw, or blocked route |
| Restored/offline session | Any Morley routed phase after a warmed successful load | Its complete character bundle is queued before scene creation and remains usable offline | Existing localized content-failure boundary applies before scene creation |
| Reduced motion | `prefers-reduced-motion: reduce` | Static PNG or static vector fallback uses the same emphasis state | No character tween or update loop |

</frozen-after-approval>

## Code Map

- `public/cases/morley-miller/assets/characters/*.png` -- five normalized transparent production portraits: four colleagues and the Cleveland-bench rival.
- `public/cases/morley-miller/{case.json,asset-manifest.json}` -- portrait IDs, authored vector fallbacks, provenance-aware rights rows, and matching asset bundles.
- `docs/validation/morley-miller-character-assets.md` -- supplied-reference provenance, built-in generation prompts, normalization measurements, and visual review status.
- `src/schemas/CaseRecordSchema.ts` -- case-scoped presentation-version compatibility for restored Morley records.
- `docs/{case-prototypes/morley-miller-prototype.md,source-rights/morley-miller-ledger.{en,fr}.md}` -- accurate prototype scope and generated asset-rights audit evidence.
- `tests/{integration/CharacterStaging.test.ts,unit/MorleyMillerPrototype.test.ts,unit/SourceRightsLedger.test.ts}` -- Morley asset projection, prior-version restoration, and the expected new rights-review blockers.

## Tasks & Acceptance

**Execution:**
- [x] `public/cases/morley-miller/assets/characters/{edith-vance,tomas-reyes,harriet-lowe,nils-abrahamsen,cleveland-bench}.png` -- generate and inspect separate transparent full-body Victorian pixel-art figures based on the supplied board's rendering language and each authored figure cue; normalize to the Young-compatible 512×768 canvas/baseline without text, watermark, or source-sheet residue.
- [x] `public/cases/morley-miller/{case.json,asset-manifest.json}` -- author five image entries with IDs and incomplete/pending derivative-rights blocks, switch each colleague to `kind: 'asset'`, link the rival through its existing `portraitAssetId` seam, retain every accent/figure fallback, keep the rival outside `colleagues[]`, bump the case/manifest versions, and assert byte-for-byte manifest equality.
- [x] `docs/validation/morley-miller-character-assets.md` -- record the user-supplied reference path, built-in-generation prompt set, fictional-character boundary, alpha/bounds/baseline/file validation, and visual inspection; state that neither reference nor derivatives are rights-reviewed or cleared.
- [x] `src/schemas/CaseRecordSchema.ts`, `tests/{integration/CharacterStaging.test.ts,unit/MorleyMillerPrototype.test.ts,unit/SourceRightsLedger.test.ts}` -- extend only Morley's presentation-version compatibility and add regression coverage for namespaced preload/projection, correct image-only asset references, vector fallback, rival separation, reduced motion, cleanup, and five unresolved asset-rights blockers.
- [x] `docs/case-prototypes/morley-miller-prototype.md` and generated `docs/source-rights/morley-miller-ledger.{en,fr}.md` -- replace stale no-art assertions with the actual asset state; regenerate the ledgers through `npm run audit:ledger morley-miller`, never by hand.

**Acceptance Criteria:**
- Given the Morley–Miller prediction, synthesis, or review cast, when a portrait texture loads, then each corresponding fictional colleague or rival is rendered as a distinct label-free full-body pixel-art PNG with the existing plaque, accent, speaker lift, scale, and selection behavior unchanged.
- Given any Morley character texture fails or has not loaded, when the stage renders, then the authored silhouette fallback appears and all routes remain playable without exposing an error.
- Given a player restores a warmed Morley session offline, when the router creates any valid entry scene, then all five case-scoped portrait assets were queued before rendering and no Young texture key is used.
- Given reduced motion or renderer teardown, when the character stage updates or is destroyed, then it creates no prohibited animation loop and releases all portrait/tween resources.

## Design Notes

Match the reference's restrained late-19th-century pixel-art treatment—warm outlined faces, dense but readable period tailoring, and a single story-relevant prop/pose—rather than copying any reference-board name or person. The authored silhouette data remains the visual source of truth for identity cues: Edith’s raised instrument and dark upswept hair; Tomás’s brown complexion and reserved suited stance; Harriet’s auburn swept hair and papers; Nils’s fair hair, spectacles, and presenting gesture; and the grey-haired, moustached, folded-arm Cleveland rival.

## Verification

**Commands:**
- `npm run typecheck` -- expected: clean TypeScript program.
- `npm test -- --run tests/unit/CaseDefinition.test.ts tests/unit/PreloadCaseAssets.test.ts tests/unit/CharacterStage.test.ts tests/integration/CharacterStaging.test.ts` -- expected: all new portrait-contract and fallback tests pass.
- `npm test` -- expected: full suite green.
- `npm run audit:ledger morley-miller` -- expected: regenerated bilingual ledger records five incomplete derivative-asset rows; its blocker count matches the updated test.
- `npm run build` -- expected: production bundle includes the authored case assets.
- `npm run test:e2e -- --workers=1` -- expected: chromium flow remains green on an idle machine.

**Manual checks:**
- Inspect all five PNGs at native resolution and at the 1280×720 stage in both locales: shared baseline, uncropped shoes, transparent edges, no labels or magenta/fringe, legible differentiation, and unchanged fallback behavior after deliberately hiding one texture.

## Suggested Review Order

**Authored character contract**

- Portrait identities replace only the visual projection while retaining every vector fallback.
  [`case.json:369`](../../public/cases/morley-miller/case.json#L369)

- The rival uses its dedicated asset seam and remains outside the colleague roster.
  [`case.json:572`](../../public/cases/morley-miller/case.json#L572)

- Case and standalone manifest carry identical, provenance-aware image definitions.
  [`asset-manifest.json:19`](../../public/cases/morley-miller/asset-manifest.json#L19)

**Persistence and offline delivery**

- Presentation-only versioning retains all compatible saved Morley investigations.
  [`CaseRecordSchema.ts:627`](../../src/schemas/CaseRecordSchema.ts#L627)

- Cache v17 updates the case and manifest together before portraits preload.
  [`sw.js:127`](../../public/sw.js#L127)

- The offline walk proves every Morley portrait is service-worker-backed before entering the scene.
  [`offline-reload.spec.ts:199`](../../tests/e2e/offline-reload.spec.ts#L199)

**Provenance and bilingual audit trail**

- The validation record states derivative status, normalization, and the fictional-character boundary.
  [`morley-miller-character-assets.md:7`](../../docs/validation/morley-miller-character-assets.md#L7)

- Generated ledgers now localize blocker-to-row references in both supported languages.
  [`ledgerReport.ts:119`](../../src/domain/sources/ledgerReport.ts#L119)

**Regression protection**

- Shipped-content tests pin manifest parity, portrait availability, fallbacks, and rival separation.
  [`MorleyMillerPrototype.test.ts:116`](../../tests/unit/MorleyMillerPrototype.test.ts#L116)

- Staging tests assert Morley-scoped texture keys and proposal-order projection.
  [`CharacterStaging.test.ts:330`](../../tests/integration/CharacterStaging.test.ts#L330)
