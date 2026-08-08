---
title: 'Stage characters at their final position'
type: 'bugfix'
created: '2026-08-08'
status: 'done'
baseline_commit: 'b66833093745f5989a4f3411c7aa0fdbcb36ec97'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When a character stage is first drawn with normal motion enabled, newly created figure visuals begin at Phaser's default coordinate and are tweened to their staged position. The resulting movement enters from the canvas's upper-right area and is visually distracting rather than conveying a meaningful state change.

**Approach:** Establish each new visual at its resolved final stage position before applying any optional emphasis tween. Preserve the short tween only for a figure that has already been staged and subsequently changes emphasis, so first render never travels across the scene.

## Boundaries & Constraints

**Always:** Keep the renderer's existing responsive geometry, portrait and vector fallback parity, reduced-motion behaviour, tween cleanup, and the cast/speaker-only staging contract. The first rendered frame must use the same position, scale, and alpha as the final resolved target. Existing figures may still tween when their resolved emphasis changes.

**Ask First:** Expanding the change to introduce a new entrance animation, alter the 180 ms emphasis timing/easing, or affect non-character canvas elements.

**Never:** Do not change store state, scene routing, case content, or character placement calculations. Do not add a per-frame update loop, a DOM presentation surface, or an animation that obscures the character's authored final placement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Initial normal-motion render | A newly built portrait or vector figure with a non-zero emphasis transition | Visual is placed at its resolved x/y, scale, and alpha before any tween can render; no motion enters from an origin/default coordinate | N/A |
| Later emphasis update | An already staged figure receives a new speaker/selection target | The existing short emphasis tween moves only from the prior staged target to the new target | Kill any existing visual tween first, as today |
| Reduced motion | A newly built or existing figure has transition duration 0 | Target values are applied directly and no tween is started | N/A |
</frozen-after-approval>

## Code Map

- `src/adapters/phaser/renderers/CharacterStage.ts` -- owns Phaser figure creation, resolved target application, and emphasis tweens.
- `src/adapters/phaser/renderers/characterStageView.ts` -- pure source of final stage coordinates, scale, alpha, and transition duration; no geometry change is expected.
- `tests/unit/CharacterStage.test.ts` -- existing fake-Phaser renderer test seam; extend it to prove newly created visuals start at their final resolved values and that later emphasis changes still tween.
- `tests/unit/CharacterStageView.test.ts` -- existing pure geometry/emphasis coverage; remains the oracle for expected stage targets.

## Tasks & Acceptance

**Execution:**

- [x] `tests/unit/CharacterStage.test.ts` -- update the normal-motion initial-render expectations and add a regression case for a subsequent speaker/selection update, covering direct initial target placement and the retained later tween -- prevents default-coordinate entry from returning unnoticed.
- [x] `src/adapters/phaser/renderers/CharacterStage.ts` -- distinguish a newly staged visual from an already positioned one; immediately apply the resolved target to a new visual before normal-motion tween logic, while retaining the existing reduced-motion and tween-killing contracts -- removes the distracting first-render trajectory without changing final layout.

**Acceptance Criteria:**

- Given a newly created character stage with normal motion enabled, when it first renders, then every portrait and vector figure is already at its resolved final x/y, scale, and alpha before the renderer creates an emphasis tween.
- Given an existing staged figure whose speaker or selected state changes with normal motion enabled, when it renders again, then it uses the existing 180 ms cubic ease-out tween between staged targets.
- Given reduced motion is enabled, when a character stage is first rendered or re-emphasized, then it applies its final target directly and registers no tween.
- Given the cast changes and the renderer rebuilds its figures, when the rebuilt figures render, then they are treated as newly staged and never animate in from default coordinates.

## Spec Change Log

## Design Notes

Use the renderer's stored per-figure lifecycle rather than inferring freshness from coordinate values: a legitimate target can be `(0, 0)`, and a portrait/vector visual can be rebuilt without changing its final geometry. The view resolver remains the single source of all placement targets; this bug fix only changes when the renderer writes those values relative to tween creation.

## Verification

**Commands:**

- `npm test -- tests/unit/CharacterStage.test.ts` -- expected: the regression test fails before the renderer change and passes after it.
- `npm run typecheck` -- expected: no TypeScript errors.
- `npm test` -- expected: the complete Vitest suite passes.

## Suggested Review Order

**Character lifecycle**

- Marks visuals as staged only after their final target has been written.
  [`CharacterStage.ts:147`](../../src/adapters/phaser/renderers/CharacterStage.ts#L147)

- Applies first/rebuilt placement directly; preserves tweens for later emphasis changes.
  [`CharacterStage.ts:435`](../../src/adapters/phaser/renderers/CharacterStage.ts#L435)

**Regression coverage**

- Proves vector figures start final and later speaker changes still animate.
  [`CharacterStage.test.ts:242`](../../tests/unit/CharacterStage.test.ts#L242)

- Verifies a portrait and the rival reviewer share the no-entrance contract.
  [`CharacterStage.test.ts:343`](../../tests/unit/CharacterStage.test.ts#L343)
  [`CharacterStage.test.ts:553`](../../tests/unit/CharacterStage.test.ts#L553)
