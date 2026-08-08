---
title: 'PNG-backed Young character designs'
type: 'feature'
created: '2026-08-08'
status: 'done'
baseline_commit: '64fa54e2131957c4553faf740b918bc8f5bb32ba'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Young case stages Thea Young, Elias Wren, Marianne Cole, Samuel Hart, and Arthur Bell as coded figures, while the supplied `characters_design.png` establishes richer full-body pixel-art designs that are not used in the game.

**Approach:** Derive five production PNGs from that reference, load them as case-authored Phaser assets, and render them through the existing character stage while retaining its vector figures as a missing-texture fallback.

## Boundaries & Constraints

**Always:** Preserve each referenced identity, outfit, pose, period character, and full-body silhouette; produce separate label-free, watermark-free assets with transparent backgrounds, consistent padding, and a common feet baseline. Keep Arthur outside `colleagues[]`. Preserve proposal attribution, speaker lift/scale/badge, EN+FR plaques, reduced-motion static rendering, renderer cleanup, the ADR-006 information boundary, case-manifest equality, offline restoration, and compatible saved records. Record the user-supplied reference and generated-derivative status in an asset provenance note; do not present fictional characters as historical likenesses.

**Ask First:** Material redesigns beyond the supplied board; replacing the built-in image-generation/chroma-key path with true-native-transparency CLI generation; marking the assets rights-reviewed or publicly cleared beyond the documented user-supplied/generated status.

**Never:** Render or crop the complete sheet directly; retain its black rectangles or name labels; remove vector fallback; add DOM presentation; use orphaned `src/game/scenes/*`; stream character art after gameplay begins; add an update loop; make character staging interactive; expose or infer defensibility.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Authored portrait | Valid manifest image and decoded texture | Matching PNG stands on the existing baseline with unchanged plaque and emphasis behavior | N/A |
| Failed image | Missing, failed, or unavailable texture | Authored vector appearance renders in the same slot | No missing-texture tile, throw, or blocked route |
| Restored session | Any routable starting phase, online or warmed offline | Complete case image bundle is queued before scene `create()` | Existing localized content failure remains the boot boundary |
| Reduced motion | `prefers-reduced-motion: reduce` | Complete static PNG or fallback frame | No tween or update loop |

</frozen-after-approval>

## Code Map

- `public/cases/young-interference/assets/characters/*.png` -- five normalized production portraits.
- `public/cases/young-interference/{case.json,asset-manifest.json}` -- portrait authorship and exact asset bundle.
- `src/domain/cases/{ColleagueCast,CaseDefinition}.ts` and `src/schemas/CaseDefinitionSchema.ts` -- strict asset-plus-fallback contract for colleagues and rival.
- `src/adapters/phaser/preloadCaseAssets.ts` and `src/adapters/phaser/scenes/*.ts` -- manifest-driven complete-bundle preload for every possible restored entry scene.
- `src/adapters/phaser/renderers/{characterStageView,CharacterStage,ColleagueRenderer,RivalLabRenderer}.ts` -- asset projection, rendering, fallback, emphasis, and lifecycle.
- `src/schemas/CaseRecordSchema.ts` and `public/sw.js` -- visual-only version compatibility and cache retirement.
- `docs/validation/young-character-assets.md` -- generation source, transformation, and review status.

## Tasks & Acceptance

**Execution:**

### Task 1: Generate and document the character assets

- [x] `public/cases/young-interference/assets/characters/*.png` and `docs/validation/young-character-assets.md` -- generate Thea, Elias, Marianne, Samuel, and Arthur from the supplied board using the built-in image tool, remove the flat key, normalize transparent bounds/baselines, optimize files, visually validate them, and document provenance.

### Task 2: Author and validate the case asset contract

- [x] `tests/unit/{CaseDefinition,CaseRecordSchema}.test.ts`, `tests/integration/CharacterStaging.test.ts`, `src/domain/cases/{ColleagueCast,CaseDefinition}.ts`, `src/schemas/{CaseDefinitionSchema,CaseRecordSchema}.ts`, and `public/cases/young-interference/{case.json,asset-manifest.json}` -- test first, then author image IDs with accent/figure fallbacks, require referenced entries to be images, add Arthur's separate asset hook, bump manifest/case versions, keep both manifests identical, preserve 1.2.0–1.15.0 saved records, and update the shipped-cast contract assertion from silhouettes to asset-backed portraits with preserved fallbacks.

### Task 3: Preload the complete case asset bundle

- [x] `tests/unit/PreloadCaseAssets.test.ts`, `src/adapters/phaser/preloadCaseAssets.ts`, and all real routed scene files -- test first, then queue namespaced manifest images before any possible restored scene creates, skipping cached textures.

### Task 4: Render PNG figures with vector fallback

- [x] `tests/unit/CharacterStage.test.ts`, `tests/integration/CharacterStaging.test.ts`, and `src/adapters/phaser/renderers/{characterStageView,CharacterStage,ColleagueRenderer,RivalLabRenderer}.ts` -- test first, then render bottom-centred images when loaded and the current vector graphics otherwise; apply identical visibility, placement, tween/static emphasis, and destruction to both.

### Task 5: Preserve compatibility and verify the feature

- [x] `public/sw.js`, `tests/unit/{CaseDefinition,CaseRecordSchema}.test.ts`, and `tests/e2e/offline-reload.spec.ts` -- retire incompatible caches, close the recorded missing-ID/version-boundary tests, prove portrait responses survive a warmed offline reload, and complete integration, full-suite, and visual verification without duplicating the focused unit coverage owned by Tasks 2–4.

**Acceptance Criteria:**
- Given the supplied board, when the five Young characters appear in their authored scenes, then each uses a recognizable, transparent, label-free PNG matching its reference design and aligned consistently with the existing room and plaque geometry.
- Given a portrait request whose texture is unavailable, when the stage creates, then the authored vector fallback appears without blocking or leaking a missing-texture placeholder.
- Given speaker changes or reduced motion, when the stage renders, then PNG and fallback figures obey the same position, scale, alpha, badge, and zero-motion contracts.
- Given any saved Young phase after an online warm-up, when the app reloads offline, then its scene starts with the portrait bundle available and compatible progress intact.
- Given Arthur Bell is shown, when staging data is inspected, then he remains sourced only from `rivalLab`, never from `colleagues[]` or any defensibility projection.

## Spec Change Log

## Design Notes

Use the supplied sheet only as a visual reference. Generate one opaque pixel-art subject per flat magenta-key image, remove the key locally, then normalize all outputs to a shared portrait canvas with feet on the same baseline. Texture keys must be case-namespaced. Phaser `Image` objects anchor at that shared visible feet baseline (bottom-centre in stage space); fit with one uniform scale and no stretching. The existing `Graphics` painter remains the fallback and shares the same generic visual lifecycle.

## Verification

**Commands:**
- `npm run typecheck` -- TypeScript passes.
- `npm test` -- schema, preload, character-stage, integration, and compatibility suites pass.
- `npm run test:e2e` -- routed canvas flows remain green.
- `npx playwright test tests/e2e/offline-reload.spec.ts` -- warmed offline boot and restored progress pass with portraits requested successfully.

**Manual checks:**
- Inspect prediction, conclusion, and rival scenes at 1280×720 in EN, FR, and reduced motion; confirm recognizable art, clean alpha edges, consistent feet, readable plaques, speaker emphasis, and no card/control overlap.

## Suggested Review Order

**Asset and authored-content contract**

- The visual source is normalized into five case-owned, provenance-documented character portraits.
  [`young-character-assets.md:1`](../../docs/validation/young-character-assets.md#L1)

- The case owns image entries while keeping Arthur distinct from the colleague cast.
  [`case.json:1640`](../../public/cases/young-interference/case.json#L1640)

- Strict schemas keep manifest equality, image typing, and compatible saved records bounded.
  [`CaseDefinitionSchema.ts:406`](../../src/schemas/CaseDefinitionSchema.ts#L406)

**Runtime delivery and staging**

- Every routed scene queues its complete namespaced image bundle before creating.
  [`preloadCaseAssets.ts:25`](../../src/adapters/phaser/preloadCaseAssets.ts#L25)

- The stage swaps to a texture only when loaded, retaining the vector fallback.
  [`characterStageView.ts:53`](../../src/adapters/phaser/renderers/characterStageView.ts#L53)

- Colleague and rival adapters map the authored portrait metadata into shared stage members.
  [`RivalLabRenderer.ts:95`](../../src/adapters/phaser/renderers/RivalLabRenderer.ts#L95)

**Offline compatibility and proof**

- Cache retirement prevents a 1.16 asset bundle mixing with pre-portrait responses.
  [`sw.js:15`](../../public/sw.js#L15)

- The release gate observes Thea online, then from the service worker while offline.
  [`offline-reload.spec.ts:134`](../../tests/e2e/offline-reload.spec.ts#L134)

- Unit and integration tests cover contract, preload, placement, fallback, and compatibility boundaries.
  [`CharacterStage.test.ts:545`](../../tests/unit/CharacterStage.test.ts#L545)
