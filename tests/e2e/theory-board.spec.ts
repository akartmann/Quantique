import { expect, test } from '@playwright/test';

import {
    caseFileConsultControlCentre,
    caseFileObservationPinCentre,
    caseFileRequestControlCentre,
    caseFileSaveControlCentre,
    caseFileSourcePinCentre
} from '../../src/adapters/phaser/renderers/caseFileGeometry';
import { advanceControlCentreOnBoard } from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { en } from '../../src/core/i18n/locales/en';
import {
    ARTIFACT_COUNT,
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    WALK_TO_DEBRIEF_COST_MS,
    clickDesign,
    clickUntilScene,
    chooseProposalThroughColleague,
    expectActiveScene,
    inTheCaseFile,
    walkToTheBoard,
    waitForInputToSettle
} from './canvasHelpers';

/**
 * The theory board, rewritten against the case file and the consultation (Story 2.12, §Spec fallout).
 *
 * Every one of the twenty-nine locators this file used to carry drove
 * `src/ui/theory/TheoryBoard.ts` or `src/ui/review/ConsultationPanel.ts` — four support checkboxes, two
 * free-text fields, a status region, and a consultation panel with its own request button. All of them
 * are deleted, and the two free-text **actions** are removed from `AppAction` entirely (D5).
 *
 * What the file asserted that is still true, and where it is asserted now:
 *
 * - **Support pinning** — the four `theory.support*` intents — is the case file's pin rows, driven below.
 * - **The consultation**, with its three authored layers, is the case file's consult control (D4).
 * - **Peer review and the reviewed revision** are the case file's request and save controls.
 * - **The readiness guidance** is AC7's readiness list, which is canvas text. It is asserted where it
 *   can be read: `CaseFileRenderer.test.ts` drives the real presenter through `tests/unit/sceneSlice.ts`
 *   and reads the lines it wrote, and `french-typography.spec.ts` measures their French widths.
 * - **The keyboard path** went with the DOM. ADR-008 de-scoped a11y acceptance and the project rule
 *   that followed forbids new parity assertions; the canvas keyboard path that *does* exist — arrow
 *   stepping on the bench — is covered in `ApparatusRun.test.ts` and `young-canvas-experiment.spec.ts`.
 *
 * Nothing is asserted here that is true on every route: each step below either changes the routing or
 * changes the record, and both are observable.
 */

test.setTimeout(30_000 + WALK_TO_DEBRIEF_COST_MS);

test('pins support, asks a colleague, and takes the reviewed draft to the debrief from the case file', async ({ page }) => {
    await walkToTheBoard(page);
    await expectActiveScene(page, 'TheoryBoard');

    // --- the consultation, which had no canvas dispatcher at all before this story ------------------
    // Asked **before** the conclusion is chosen, which is when an authored rule genuinely applies:
    // `state-a-limit` fires while the draft carries no limitation. A refusal here would be
    // `consultation-unavailable`, and the surface would be answering with the localized error instead.
    await inTheCaseFile(page, async () => {
        await clickDesign(page, caseFileConsultControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT));
        await waitForInputToSettle(page);
    });

    // --- the conclusion, and the support it rests on ------------------------------------------------
    await chooseProposalThroughColleague(page, 3);
    await inTheCaseFile(page, async () => {
        for (let index = 0; index < 2; index += 1) {
            await clickDesign(page, caseFileObservationPinCentre(index, DESIGN_WIDTH));
            await waitForInputToSettle(page);
        }
        for (let index = 0; index < ARTIFACT_COUNT; index += 1) {
            await clickDesign(page, caseFileSourcePinCentre(index, DESIGN_WIDTH));
            await waitForInputToSettle(page);
        }
    });

    // The pins are what make the draft ready, so taking `synthesis → review` is the assertion that they
    // landed: `theory.reviewRequested` is refused with `conclusion-not-ready` without them, and the
    // board deliberately survives the transition — which is why the *next* step is the proof it moved.
    await clickDesign(page, advanceControlCentreOnBoard('conclusion'));
    await expectActiveScene(page, 'TheoryBoard');

    // --- peer review, which is refused outside `review` ---------------------------------------------
    await inTheCaseFile(page, async () => {
        await clickDesign(page, caseFileRequestControlCentre(DESIGN_WIDTH));
        await waitForInputToSettle(page);
        await clickDesign(page, caseFileSaveControlCentre(DESIGN_WIDTH));
        await waitForInputToSettle(page);
    });

    // `case.debriefCompleted` is refused unless a reviewed revision was saved in the `review` phase, so
    // arriving in the debrief is the one assertion that proves the whole chain above actually happened.
    // `clickUntilScene` rather than a single click: the board's control relabels under the cursor at the
    // previous advance, which starts `ADVANCE_RELABEL_LOCKOUT_MS` — a deliberate window a spec clicking
    // at machine speed lands inside and is correctly ignored in.
    await clickUntilScene(page, advanceControlCentreOnBoard('conclusion'), 'Debrief');

    // And the record the player takes away carries the conclusion they chose, not a blank one.
    await expect(page.getByRole('article', { name: en['print.ariaLabel'] }))
        .not.toContainText(en['print.conclusion.empty']);
});
