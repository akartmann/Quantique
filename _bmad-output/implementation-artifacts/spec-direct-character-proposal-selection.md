---
title: 'Direct character proposal selection'
type: 'feature'
created: '2026-08-18'
status: 'done'
baseline_commit: '9e0501591b541f5c3a2ab1d9c4a0cd58ad2871b3'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The colleague board devotes most of its canvas to four simultaneous proposal cards. This makes the laboratory a compressed decorative strip, and the characters appear detached from its floor rather than situated in the room.

**Approach:** Keep the authored dialogue at the top, then let the player select a colleague directly in the expanded laboratory. Selecting a colleague reveals only that colleague's proposal in one compact detail panel, where the player can adopt it or choose another colleague. The room must use the figures' actual shared baseline and a readable perspective floor.

## Boundaries & Constraints

**Always:** Keep the existing authoritative store actions, proposal IDs, free revisability, dialogue order, EN/FR localization, reduced-motion behavior, and canvas-only interaction. A proposal must never be presented as correct. The character stage remains reusable by the rival-lab scene; its direct-selection behavior is opt-in and fully released on destruction.

**Ask First:** Adding new authored dialogue or changing the case-data/schema contract; changing the four-proposal requirement; changing how conclusions are evaluated or submitted.

**Never:** Add DOM controls, duplicate proposal text, add a separate scene, suppress interaction on narrow viewports, or show all four proposal panels at once.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Browse | Dialogue completes; no colleague opened | Expanded room remains visible and invites the player to select a colleague | N/A |
| Inspect | Player activates a staged colleague | Exactly that colleague's localized proposal appears in the one detail panel | Missing/degraded attribution uses the existing fallback label |
| Adopt | Player activates the panel's choice action | Existing prediction/conclusion selection action records that proposal and the selected state is visible | Existing localized refusal remains visible until a real state change |
| Reconsider | Player opens another colleague after choosing | The new proposal replaces the prior panel; selection remains revisable | N/A |
| Overlays | Theory-board case file is open | Character and proposal-panel input are disabled with the rest of the board | N/A |

</frozen-after-approval>

## Code Map

- `src/adapters/phaser/renderers/ColleagueRenderer.ts` — owns colleague-board layout, one proposal detail panel, selection dispatch, and input suppression.
- `src/adapters/phaser/renderers/CharacterStage.ts` — owns optional pointer affordances for staged colleagues while retaining its existing rival use.
- `src/adapters/phaser/renderers/characterStageView.ts` — pure shared-baseline geometry and stage sizing.
- `src/adapters/phaser/renderers/LaboratoryDecor.ts` — paints the visual floor plane behind the cast.
- `src/adapters/phaser/ui/ProposalChoice.ts` — reusable single proposal presentation and choose control.
- `tests/unit/CharacterStage.test.ts`, `tests/unit/ColleagueGeometry.test.ts` — structural interaction and layout coverage.
- `tests/e2e/canvasHelpers.ts`, `tests/e2e/*` — canvas walks updated from card probes to character-and-panel probes.

## Tasks & Acceptance

**Execution:**

- [x] `CharacterStage.ts` and `characterStageView.ts` — add an opt-in colleague activation callback and hit areas that follow each visible figure; retain inert behavior for scenes that do not supply it, clear all handlers on destroy, and keep every active figure on the room baseline.
- [x] `ColleagueRenderer.ts` and `ProposalChoice.ts` — replace the four persistent cards with a single compact proposal detail panel driven by the currently opened colleague; reserve only its footprint, keep the room large, route choosing through the current adapter action, and suppress all board input consistently.
- [x] `LaboratoryDecor.ts` — finish the room revision with an aligned floor baseline and visible receding floorboards that ground the cast without obscuring labels or controls.
- [x] `tests/unit/CharacterStage.test.ts` and `tests/unit/ColleagueGeometry.test.ts` — prove opt-in character activation, teardown, one-panel behavior, baseline alignment, and the larger stage band.
- [x] `tests/e2e/canvasHelpers.ts` and affected board walks — select a proposal through a character then the one panel; preserve prediction, conclusion, library, rival, and end-to-end completion coverage.

**Acceptance Criteria:**

- Given the colleague or theory board opens, when the dialogue is read, then the laboratory occupies the reclaimed area and every visible figure stands on its painted floor.
- Given the player activates a colleague, when their proposal opens, then only that colleague's localized proposal and a clear choose action are shown.
- Given the player chooses a proposal and then inspects another colleague, when they choose again, then the stored selection changes through the existing action with no irreversible state.
- Given the conclusion case-file overlay is open, when the player attempts to activate a colleague or proposal action, then neither dispatches until the overlay closes.
- Given a rival-lab stage or a short, illegible board band, when it renders, then no new character-selection interaction appears and no stray hit areas remain.

## Spec Change Log

## Design Notes

The dialogue stays a reading surface; character selection begins once the conversation has ended. This preserves the authored sequence before the player compares claims. The opened proposal replaces, rather than stacks beside, the last one. Its panel uses the existing card vocabulary so the new gesture feels like an efficient recasting of the established decision, not a second decision system.

## Verification

**Commands:**

- `npm run typecheck` — expected: no TypeScript errors.
- `npm run test -- tests/unit/CharacterStage.test.ts tests/unit/CharacterStageView.test.ts tests/unit/ColleagueGeometry.test.ts` — expected: selection and geometry assertions pass.
- `npm run test:e2e` — expected: all canvas journeys choose proposals through the new direct interaction.
- `npm run build` — expected: production bundle completes.

## Suggested Review Order

**Direct colleague interaction**

- The stage owns opt-in, portrait-aware targets while remaining inert for rival scenes.
  [`CharacterStage.ts:98`](../../src/adapters/phaser/renderers/CharacterStage.ts#L98)

- The board resets panel state per conversation and opens one proposal per selected colleague.
  [`ColleagueRenderer.ts:558`](../../src/adapters/phaser/renderers/ColleagueRenderer.ts#L558)

- Input gating makes both characters and the panel unavailable until dialogue completion.
  [`ColleagueRenderer.ts:1165`](../../src/adapters/phaser/renderers/ColleagueRenderer.ts#L1165)

**Grounded laboratory composition**

- The decor floor ends at the actual character baseline, not below the labels.
  [`ColleagueRenderer.ts:895`](../../src/adapters/phaser/renderers/ColleagueRenderer.ts#L895)

- The compact room threshold preserves a readable floor whenever a figure can be shown.
  [`LaboratoryDecor.ts:84`](../../src/adapters/phaser/renderers/LaboratoryDecor.ts#L84)

**Canvas journey coverage**

- This journey proves dialogue gating, single-panel replacement, and revisable selection.
  [`dialogue-advance.spec.ts:144`](../../tests/e2e/dialogue-advance.spec.ts#L144)

- Portrait-sized target coverage prevents clicks missing visible character silhouettes.
  [`CharacterStage.test.ts:372`](../../tests/unit/CharacterStage.test.ts#L372)
