import { expect, test } from '@playwright/test';

import {
    apparatusNotesControlCentre,
    notesCloseControlCentre,
    resetControlCentre,
    startTheLightControlCentre
} from '../../src/adapters/phaser/renderers/apparatusGeometry';
import {
    caseFileObservationPinCentre,
    caseFileRequestControlCentre,
    caseFileSaveControlCentre,
    caseFileSourcePinCentre
} from '../../src/adapters/phaser/renderers/caseFileGeometry';
import { en } from '../../src/core/i18n/locales/en';
import { advanceControlCentreOnBoard, revisitControlCentreOnBoard } from '../../src/adapters/phaser/renderers/ColleagueRenderer';
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
    RUN_STEP_COST_MS,
    caseContent,
    recordedObservations,
    recordedSetting,
    recordedSources,
    startTheLightUntilRecorded,
    varyingInstrument,
    dialogueBeatCountFor,
    colleagueIndexForConclusion,
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

/**
 * The prototype's own distinguishing control, per its `significanceRule`.
 *
 * **90°, not the maximum.** The model is `cos(2θ)` and the authored travel is 0–180°, so the default
 * drag-to-maximum returned to the *same* displacement it started from: 0° and 180° both read 0,11 at
 * 22 °C, and this walk asserted it had recorded two distinguishing runs while recording one reading
 * twice (review 2026-08-19). 90° is the sign reversal — the pair the unit tests use.
 *
 * It is a **`dial`** as of Story 3.4, and the pair is unchanged by that: `varyingInstrument` derives
 * the drag target from the control's own affordance, so the mouse goes to the point the dial reads 90°
 * at rather than to a knob arc nothing paints. Re-deriving the pair from the authored range instead
 * would reintroduce the 0°/180° defect above — and on a dial it would be worse, because a closed
 * travel draws its two ends in the same place.
 */
const ROTATION = varyingInstrument('morley-miller', 'rotationDeg', 90);

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
    //
    // **Both arguments are now derived, and neither was before** (Story 4.3, Task 5). This read
    // `chooseProposalThroughColleague(page, 0)`, which was wrong twice over and passed anyway:
    //
    // - The **beat count** was `0` against the 1 beat this case's `synthesis` authors, and the helper
    //   clicks `count + 1` times, so it under-clicked by one and survived on the retry inside its own
    //   `expect(...).toPass()`. Timing-dependent green.
    // - The **seat** fell through to the default `colleagueIndex = 3`, which on this case's conclusion
    //   board is `harriet-lowe` → `conclude-instrument-broken`, not the conclusion anyone reading this
    //   would have assumed. The board is staged in *proposal* order, not `colleagues[]` order, and the two
    //   coincide on Young and not here — see `colleagueIndexForConclusion`.
    //
    // It keeps taking `conclude-instrument-broken`, which is what it has always taken: the point of this
    // test is that a case with no `modelInputs` can reach `review` at all, and an undefendable conclusion
    // exercises that as well as a defendable one. What changes is that the choice is now *named* rather
    // than arrived at, so a cast reorder moves the click instead of silently switching the conclusion.
    await chooseProposalThroughColleague(
        page,
        dialogueBeatCountFor('morley-miller', 'synthesis'),
        colleagueIndexForConclusion('morley-miller', 'conclude-instrument-broken')
    );
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

/**
 * The slider, driven through real Phaser input.
 *
 * Added by Story 3.4's code review, which found that **no e2e walk touched a slider at all**:
 * `varyingInstrument` was only ever called for `rotationDeg`, `accessibility.spec.ts` never loads the
 * prototype, and the unit harness discards a zone's constructor geometry — so the one affordance with a
 * genuinely new pointer→value conversion had its drag path exercised nowhere in the engine. A slider
 * built with the knob's hit area, or centred on the wrong slot, passed every test in the suite.
 *
 * `bathTempC` is 18–24 step 0.5 and is a member of the case's `criticalControlIds`, so varying it alone
 * still produces two distinct configurations and the walk reaches the board exactly as the rotation one
 * does. The assertion that matters is inside `walkToTheBoard`: `recordTwoObservations` waits for the
 * *readout* to reach the value the production conversion says the drag means, in either locale. A slider
 * whose hit area or conversion was wrong never gets there.
 */
const BATH = varyingInstrument('morley-miller', 'bathTempC', 19);

test('records a prototype observation by dragging the bath-temperature slider', async ({ page }) => {
    test.slow();

    await walkToTheBoard(page, 'morley-miller', BATH);

    await expectActiveScene(page, 'TheoryBoard');
    await expect(recordedObservations(page)).toHaveCount(2);
});

/**
 * The bench's shared affordances, exercised on **this** case (Story 4.2, AC2 last clause).
 *
 * AC2 ends with a verification clause — *"reset, notebook, reference shelf, advance and revisit all work on
 * this case exactly as they do on Young, through the shared framework and with no second
 * implementation"* — and it is a verification clause on purpose. *"The framework is shared so it must
 * work"* is precisely the assumption Story 3.2's three walls each falsified: a completed record discarded
 * on every reload, a 2.4 s ignition onto a blank screen, and a theory board that could never unlock, all
 * green in 1293 tests because no second case had ever been walked through them.
 *
 * **Advance** is proven by the two walks above reaching `TheoryBoard`. What is left is the rest of the row,
 * and the new overlay this story adds — which is the one that could break the others, because it
 * suppresses the bench while it is up.
 *
 * Canvas text is unreadable from a spec, so nothing here asserts a rendered string. What it asserts are
 * **recorded consequences**: the printable record for the reset, `data-active-scene` for the revisit, and
 * for the notes overlay the only honest proof that it really suppressed the bench — that a click landing
 * where the start control is records **no** observation while it is open, and does once it is closed. A
 * screenshot could not tell a covered bench from a disabled one, and `project-context.md` says so in as
 * many words: covering the canvas does not disable it.
 */
test('opens the apparatus notes over the bench, suppresses it, and gives it back', async ({ page }) => {
    test.slow();

    await walkToTheBoard(page, 'morley-miller', ROTATION);
    await expectActiveScene(page, 'TheoryBoard');
    // Back to the bench, which is the revisit half of AC2's row: `synthesis → experiment` from the board.
    await clickUntilScene(page, revisitControlCentreOnBoard(), 'Laboratory');
    await expect(recordedObservations(page)).toHaveCount(2);

    // With the notes open, the bench is covered *and* disabled. A click at the start control must record
    // nothing — which is the recorded consequence, not the pixels.
    await clickDesign(page, apparatusNotesControlCentre());
    await waitForInputToSettle(page);
    await clickDesign(page, startTheLightControlCentre());
    await page.waitForTimeout(RUN_STEP_COST_MS);
    await expect(recordedObservations(page)).toHaveCount(2);

    // Closed, and the bench answers again. This is the half that fails if the overlay forgets to hand
    // input back — the "bench left permanently locked" shape the 2.10 review found twice.
    await clickDesign(page, notesCloseControlCentre());
    await waitForInputToSettle(page);
    await startTheLightUntilRecorded(page, startTheLightControlCentre(), 3);
    await expect(recordedObservations(page)).toHaveCount(3);
});

test('resets this case\'s bench to its authored setup without erasing the observations', async ({ page }) => {
    test.slow();

    await walkToTheBoard(page, 'morley-miller', ROTATION);
    await clickUntilScene(page, revisitControlCentreOnBoard(), 'Laboratory');

    await clickDesign(page, resetControlCentre());
    await waitForInputToSettle(page);

    // Story 2.2's shipped criterion, on the second case: *"reset is immediate and does not erase saved
    // observations."* Both halves, because a reset that cleared the notebook would satisfy the first.
    // The control's own authored English display label, read from `case.json` rather than written down —
    // the printable record lists `selectControlLabel` against `selectFormattedControlValue`, and a literal
    // here would drift from the content the day the label is re-worded.
    const rotation = caseContent('morley-miller').apparatus.primaryControls.find(({ id }) => id === 'rotationDeg')!;
    await expect(recordedSetting(page, rotation.label.en)).toHaveText(new RegExp(`^${rotation.defaultValue}\\u00b0`));
    await expect(recordedObservations(page)).toHaveCount(2);
});
