---
title: 'Add story back navigation'
type: 'feature'
created: '2026-08-08'
status: 'in-review'
baseline_commit: '80e24e06926341baf372a8cb92bca7dd729590d4'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Once a player reaches the laboratory or theory board, the game only offers forward progression. They cannot revisit the first meeting from the laboratory or return to the laboratory from the theory board, so they can become stuck or unable to reconsider earlier work.

**Approach:** Add explicitly authored, in-canvas return affordances for those two backward hops. Route them through the authoritative store and SceneRouter while retaining the player's sources, prediction, apparatus settings, runs, notebook, and conclusion work.

## Boundaries & Constraints

**Always:** Phaser remains the sole interactive surface; the store remains authoritative and the router remains read-only. Backward movement is limited to `experiment → prediction` and `synthesis/review → experiment`; it must be available at every viewport width, localized in EN and FR, and must not clear or recompute historical evidence. Controls must respect existing in-scene overlay input suppression and must be accompanied by public-contract tests.

**Ask First:** Adding return paths beyond the three requested scenes, changing the case progression model, or discarding/reinitializing player work.

**Never:** Add DOM controls, scene-to-scene calls, a hard failure, an irreversible choice, or a route/phase name in player-facing copy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Revisit meeting | `experiment` + player clicks the laboratory return control | Store moves to `prediction`; router activates `Colleagues`; selected prediction remains revisable | N/A |
| Revisit bench | `synthesis` or `review` + player clicks the theory-board return control | Store moves to `experiment`; router activates `Laboratory`; recorded runs and settings remain intact | N/A |
| Standing critique | Rival-lab challenge displayed for a conclusion | Existing revision action remains the only exit; no back control bypasses the critique | Preserve current localized refusal/flow |
| Covered scene controls | Book, notebook, or case file overlay is open | Underlying forward and return controls cannot receive the overlay click | Existing scene-local input suppression applies |

</frozen-after-approval>

## Code Map

- `src/domain/cases/caseReducer.ts` -- pure adjacent forward transition rule; extend with an equally explicit, constrained reverse rule.
- `src/core/store/AppAction.ts` and `src/core/store/AppState.ts` -- typed intent and authoritative phase reducer boundary.
- `src/adapters/phaser/PhaserStoreAdapter.ts` -- canvas adapter that exposes only typed store dispatch.
- `src/adapters/phaser/renderers/ApparatusRenderer.ts` -- laboratory side-column control and overlay-aware input state.
- `src/adapters/phaser/renderers/ColleagueRenderer.ts` -- theory-board proposal/advance controls and case-file suppression.
- `src/adapters/phaser/renderers/advanceView.ts` -- shared transition copy/interaction mapping; keep route-neutral fiction labels.
- `src/core/i18n/locales/en.ts`, `src/core/i18n/locales/fr.ts` -- bilingual player-facing return labels.
- `tests/unit/CaseDefinition.test.ts`, `tests/unit/AdvanceView.test.ts`, `tests/unit/SceneRouter.test.ts`, `tests/e2e/canvas-transitions.spec.ts` -- domain, projection, routing, and canvas reachability coverage.

## Tasks & Acceptance

**Execution:**
- [ ] `src/domain/cases/caseReducer.ts`, `src/core/store/AppAction.ts`, `src/core/store/AppState.ts`, `src/adapters/phaser/PhaserStoreAdapter.ts` -- introduce a typed, authoritative request for the two permitted backwards phase changes; reject every other reverse/skip request without mutating state or notifying subscribers.
- [ ] `src/adapters/phaser/renderers/advanceView.ts`, `src/adapters/phaser/renderers/ApparatusRenderer.ts`, `src/adapters/phaser/renderers/ColleagueRenderer.ts`, `src/core/i18n/locales/en.ts`, `src/core/i18n/locales/fr.ts` -- render one return control in the laboratory and one on the theory board, dispatching only the allowed action; keep labels localized, fictional, and input-disabled beneath each scene-owned overlay.
- [ ] `tests/unit/CaseDefinition.test.ts`, `tests/unit/AdvanceView.test.ts`, `tests/unit/SceneRouter.test.ts`, `tests/e2e/canvas-transitions.spec.ts` -- prove the reverse rules, retained state, correct scenes, rejected invalid transitions, and real canvas hit targets without asserting canvas text.

**Acceptance Criteria:**
- Given a player in the laboratory, when they use its return affordance, then the first-meeting scene opens with their already selected prediction still available and revisable.
- Given a player on either theory-board phase, when they use its return affordance, then the laboratory opens with recorded observations, current apparatus state, and notebook comparison state unchanged.
- Given an unsupported backwards, skipped, or rival-challenge-bypassing phase request, when it is dispatched, then it returns a typed failure, preserves state, and does not notify store subscribers.
- Given an overlay is open in the laboratory or theory board, when the player clicks inside it, then neither the forward nor the new return control receives that click.
- Given EN or FR is active, when either return affordance renders, then its label is localized and does not encode a scene key, phase, or route.

## Spec Change Log

## Design Notes

Reverse movement deliberately has a narrower contract than forward progression: it is a player-initiated revisit of a preceding decision/workspace, not a rewind. The existing phase remains the authority and SceneRouter simply projects it, which makes reloading and test injection behave exactly as they do for forward navigation.

## Verification

**Commands:**
- `npm run typecheck` -- expected: TypeScript succeeds.
- `npm test -- --run tests/unit/CaseDefinition.test.ts tests/unit/AdvanceView.test.ts tests/unit/SceneRouter.test.ts` -- expected: reverse-rule and presentation tests pass.
- `npm run test:e2e -- canvas-transitions.spec.ts` -- expected: canvas controls reach the intended scenes and existing forward path remains green.
- `npm test` -- expected: full unit/integration suite succeeds.
