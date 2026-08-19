import { expect, test } from '@playwright/test';

import {
    caseFileObservationPinCentre,
    caseFileRequestControlCentre,
    caseFileSaveControlCentre,
    caseFileSourcePinCentre
} from '../../src/adapters/phaser/renderers/caseFileGeometry';
import { en } from '../../src/core/i18n/locales/en';
import { advanceControlCentreOnBoard } from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import {
    DESIGN_WIDTH,
    WALK_TO_DEBRIEF_COST_MS,
    artifactCountFor,
    chooseProposalThroughColleague,
    clickDesign,
    clickUntilScene,
    expectActiveScene,
    inTheCaseFile,
    recordedAutoSummary,
    recordedObservations,
    recordedSources,
    varyingInstrument,
    waitForInputToSettle,
    walkToTheBoard
} from './canvasHelpers';

/**
 * **The prototype, played.** (Story 3.2, AC10.)
 *
 * The story's own §Previous story intelligence names the failure this file exists to prevent: nine of
 * fourteen player intents once shipped dispatchable only from retired DOM panels while every test
 * passed. Here the analogue is sharper still — all three walls this story removes were *green*, in a
 * suite of 1293 tests, because no second case existed to meet them. A unit test that drives the store
 * proves the reducers; only a walk proves the **framework carries a second case**, which is the second
 * clause of epic AC1 ("reuses the same store, evaluator, notebook, critique, persistence, **and
 * Phaser-scene behavior**").
 *
 * It reuses `canvasHelpers.ts` parameterised by case ID rather than forking it (Task 8): every
 * coordinate is derived from authored content, so the derivations carry over and a second copy of them
 * would be the thing that drifts.
 *
 * **Canvas text is unreadable from a spec**, so nothing here asserts a rendered string: the scene keys
 * come from `#game-container[data-active-scene]` and the evidence from the printable record. The bench
 * copy is asserted where it can be read — `tests/unit/ApparatusCaseVoice.test.ts`, through the real
 * renderer and the structural scene slice.
 */

/** The prototype's own distinguishing control, per its `significanceRule`. */
const ROTATION = varyingInstrument('morley-miller', 'rotationDeg');

test('carries the Morley–Miller prototype from the review route to the conclusion choice', async ({ page }) => {
    test.slow();

    // The review route: an allowlisted `?case=`, not a picker (AC4).
    await walkToTheBoard(page, 'morley-miller', ROTATION);

    // Reaching the board at all is the proof. Every step of the walk was refused before this story:
    // the bench refused the run outright, and the significant-measure gate that guards this transition
    // reads `configurationKey`, which the rotation drag is what moves.
    await expectActiveScene(page, 'TheoryBoard');
    await expect(recordedObservations(page)).toHaveCount(2);
    await expect(recordedSources(page)).toHaveCount(2);

    // The record describes what the player did, in the prototype's own terms — and never mentions the
    // 550 nm baseline the store initialises for every case (§The three walls, "also expect").
    await expect(recordedAutoSummary(page)).toContainText('Observations recorded: 2');
    await expect(recordedAutoSummary(page)).not.toContainText('550');

    // The conclusion the theory board could never have unlocked: pin the support and watch the
    // readiness list empty. `evaluateConclusionReadiness` is the sole completion authority (ADR-006),
    // and both of its Young-shaped rules were permanently unsatisfiable here before Task 3.
    await chooseProposalThroughColleague(page, 0);
    await inTheCaseFile(page, async () => {
        for (let index = 0; index < 2; index += 1) {
            await clickDesign(page, caseFileObservationPinCentre(index, DESIGN_WIDTH));
            await waitForInputToSettle(page);
        }
        for (let index = 0; index < artifactCountFor('morley-miller'); index += 1) {
            await clickDesign(page, caseFileSourcePinCentre(index, DESIGN_WIDTH));
            await waitForInputToSettle(page);
        }
    });

    // `theory.reviewRequested` is refused with `conclusion-not-ready` unless the readiness list is
    // empty — and **the board deliberately survives the transition**, since `synthesis` and `review`
    // both render `TheoryBoard`. So asserting the scene here would assert nothing at all: it reads
    // `TheoryBoard` whether the advance was taken or refused. The proof has to be a step that is only
    // possible on the far side of it, which is the shape `theory-board.spec.ts` uses for the same reason.
    await clickDesign(page, advanceControlCentreOnBoard('conclusion'));

    // Peer review is refused outside `review`, so a saved revision is the evidence the phase moved —
    // and it can only have moved if both re-expressed readiness rules cleared. Before Task 3 they were
    // permanently unsatisfiable for this case, so this line could never have passed.
    await inTheCaseFile(page, async () => {
        await clickDesign(page, caseFileRequestControlCentre(DESIGN_WIDTH));
        await waitForInputToSettle(page);
        await clickDesign(page, caseFileSaveControlCentre(DESIGN_WIDTH));
        await waitForInputToSettle(page);
    });

    // The record the reviewer takes away carries the conclusion that was chosen, not a blank one.
    await expect(page.getByRole('article', { name: en['print.ariaLabel'] }))
        .not.toContainText(en['print.conclusion.empty']);
    await expect(recordedAutoSummary(page)).toContainText('Conclusion versions recorded: 1');

    // And the whole chain ends where Young's does: the debrief, reached from the canvas.
    await clickUntilScene(page, advanceControlCentreOnBoard('conclusion'), 'Debrief');
});

test.describe.configure({ timeout: WALK_TO_DEBRIEF_COST_MS });
