import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { advanceControlCentreOnBoard, lastProposalCardProbe } from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { bookCloseControlCentre } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
// From `apparatusGeometry`, which imports Phaser not at all: every click target below is **derived**
// from the module that places the control, never restated as a literal. A spec that pins a coordinate
// of its own stops covering the control the day it moves, which is the rule the 1.12 review set and
// the defect class the 2.5 and 2.8 reviews closed three times.
import {
    KNOB_TRAVEL_RADIUS,
    advanceToSynthesisControlCentre,
    knobCentre,
    notebookCloseControlCentre,
    notebookControlCentre,
    notebookNoteFieldCentre,
    notebookSaveControlCentre,
    notebookSelectionCentre,
    startTheLightControlCentre,
    stepAffordanceCentre,
    wavelengthChoiceCentre
} from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { KNOB_ARC_END_RAD } from '../../src/adapters/phaser/renderers/instrumentView';
import { libraryAdvanceControlCentre } from '../../src/adapters/phaser/scenes/libraryGeometry';
import {
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    artifactAt,
    clickDesign,
    clickUntilScene,
    dragDesignUntil,
    expectActiveScene,
    waitForBookToClose,
    waitForBookToOpen,
    waitForInputToSettle,
    waitForRunToResolve
} from './canvasHelpers';

/**
 * AC10's last behavioural clause: **two significant Young measurements recorded from the canvas
 * alone**, and the significant-measure gate opened by them.
 *
 * What this reaches that no unit or integration test can: a knob with a live hit area at the
 * coordinate its geometry places it at, a drag that survives the pointer leaving the knob body, a run
 * that locks the bench for its own duration, and the router really activating the next scene. The
 * integration test proves the store answers; this proves a player can get there.
 *
 * ## Why the throw has to change between the two runs
 *
 * `significantMeasures.configurationKey` treats two runs at the same setting as a **replication**, not
 * as two significant measures — so a walk that pressed the start control twice would record two
 * observations and leave the gate shut. `YoungExperimentBench.test.ts` pins that rule directly; this
 * walk obeys it, and the transition at the end is what proves it obeyed it.
 *
 * ## Canvas text is not asserted here
 *
 * It cannot be read from the DOM. What *is* observable is the router's `data-active-scene` and the
 * still-mounted retired notebook panel's read-only projection of the store — used to observe, never to
 * dispatch. Story 2.12 deletes that panel, and when it does the scene transition below remains the
 * proof; the count assertions go with the panel.
 */

const BOOK_CLOSE = bookCloseControlCentre();
const LEAVE_THE_ROOM = libraryAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT);
const PREDICTION_ADVANCE = advanceControlCentreOnBoard('prediction');
const LABORATORY_ADVANCE = advanceToSynthesisControlCentre();
const CARD = lastProposalCardProbe(DESIGN_HEIGHT);

const caseDefinition = JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as {
    contextualArtifacts: unknown[];
    apparatus: { primaryControls: { id: string; max: number }[] };
};

/**
 * Which slot the screen-distance instrument stands in, read from the content.
 *
 * The bench gives one slot per authored control **in authored order**, so a case that listed the two
 * the other way round would put this walk's drag on the slit spacing — and the run would still record,
 * and the gate would still open, and the spec would pass having tested the wrong knob.
 */
const SCREEN_DISTANCE_SLOT = caseDefinition.apparatus.primaryControls.findIndex(({ id }) => id === 'screenDistanceM');
if (SCREEN_DISTANCE_SLOT < 0) throw new Error('The authored case must carry a screen-distance control.');
/** Where a drag to the far end of the travel lands, read from the authored bound rather than as 4. */
const FURTHEST_THROW = caseDefinition.apparatus.primaryControls[SCREEN_DISTANCE_SLOT]!.max;

const START = startTheLightControlCentre();
const NOTEBOOK = notebookControlCentre();

/**
 * The far end of the screen-distance knob's travel.
 *
 * Derived from the arc the conversion module exports, not from an angle written down here: the
 * indicator, the painter and this spec then read one set of numbers, which is what stops a knob whose
 * sweep changed from leaving this dragging into the dead zone.
 */
const knobTravelEnd = (slot: number): Readonly<{ x: number; y: number }> => {
    const centre = knobCentre(slot);
    return {
        x: centre.x + (Math.cos(KNOB_ARC_END_RAD) * (KNOB_TRAVEL_RADIUS - 6)),
        y: centre.y + (Math.sin(KNOB_ARC_END_RAD) * (KNOB_TRAVEL_RADIUS - 6))
    };
};

/** The canvas walk from the boot shell to the bench, which two of the tests below both need. */
const walkToTheBench = async (page: import('@playwright/test').Page): Promise<void> => {
    await page.goto('/');
    await expectActiveScene(page, 'Library');

    // Each reference is taken off the shelf, which records `source.inspected` and opens the book over
    // the room. The book has to be closed before the next click: it legitimately suppresses everything
    // underneath it while it is open.
    for (let index = 0; index < caseDefinition.contextualArtifacts.length; index += 1) {
        await clickDesign(page, artifactAt(index));
        await waitForBookToOpen(page);
        await clickDesign(page, BOOK_CLOSE);
        await waitForBookToClose(page);
    }
    await clickUntilScene(page, LEAVE_THE_ROOM, 'Colleagues');

    await clickDesign(page, CARD);
    await clickDesign(page, PREDICTION_ADVANCE);
    await expectActiveScene(page, 'Laboratory');
};

const observations = (page: import('@playwright/test').Page) =>
    page.getByRole('region', { name: 'Measurement notebook' }).locator('.notebook-observation');

/** Turns the screen-distance knob to the far end of its travel, and waits until it has got there. */
const turnTheThrowToTheFarEnd = (page: import('@playwright/test').Page): Promise<void> =>
    dragDesignUntil(
        page,
        knobCentre(SCREEN_DISTANCE_SLOT),
        knobTravelEnd(SCREEN_DISTANCE_SLOT),
        async () => {
            await expect(page.getByLabel('Screen distance (m)')).toHaveValue(String(FURTHEST_THROW), { timeout: 1_500 });
        }
    );

test('records two significant Young measurements from the canvas alone, and opens the gate with them', async ({ page }) => {
    await walkToTheBench(page);
    await expect(observations(page)).toHaveCount(0);

    // --- the first observation, at the default setup ---------------------------------------------
    await clickDesign(page, START);
    await waitForRunToResolve(page);
    await expect(observations(page)).toHaveCount(1);

    // --- change the throw by **dragging** the knob ------------------------------------------------
    // The drag path, in a browser, is what nothing else in the suite reaches: the press arms on the
    // knob's hit area and the travel is tracked on the scene, so a pointer that leaves the body
    // mid-turn keeps turning it.
    // The setting is **observed**, never driven, and it is what the retry waits on. Without it a lost
    // drag surfaces three steps later as a routing error at the theory board, because two observations
    // at the *same* setting are a replication and the significant-measure gate correctly stays shut.
    await turnTheThrowToTheFarEnd(page);

    // --- the second observation, at a different throw ---------------------------------------------
    await clickDesign(page, START);
    await waitForRunToResolve(page);
    await expect(observations(page)).toHaveCount(2);

    // The gate only opens for two observations at **different** configurations, so taking the
    // transition is the assertion that the drag really moved the screen.
    await clickDesign(page, LABORATORY_ADVANCE);
    await expectActiveScene(page, 'TheoryBoard');
});

test('steps the instrument with its discrete affordance to the same effect as a drag', async ({ page }) => {
    await walkToTheBench(page);

    await clickDesign(page, START);
    await waitForRunToResolve(page);

    // Four presses of the increase affordance, which is a different input path to the drag above and
    // must reach the same record. The count is arbitrary; what matters is that the setting moves.
    for (let press = 0; press < 4; press += 1) {
        await clickDesign(page, stepAffordanceCentre(SCREEN_DISTANCE_SLOT, 1));
        await waitForInputToSettle(page);
    }

    await clickDesign(page, START);
    await waitForRunToResolve(page);
    await expect(observations(page)).toHaveCount(2);

    await clickDesign(page, LABORATORY_ADVANCE);
    await expectActiveScene(page, 'TheoryBoard');
});

test('compares two observations and saves a note, all from the bench notebook', async ({ page }) => {
    await walkToTheBench(page);
    await clickDesign(page, START);
    await waitForRunToResolve(page);
    await turnTheThrowToTheFarEnd(page);
    await clickDesign(page, START);
    await waitForRunToResolve(page);

    await clickDesign(page, NOTEBOOK);
    await waitForInputToSettle(page);

    await clickDesign(page, notebookSelectionCentre(0));
    await waitForInputToSettle(page);
    await clickDesign(page, notebookSelectionCentre(1));
    await waitForInputToSettle(page);

    await clickDesign(page, notebookNoteFieldCentre());
    await waitForInputToSettle(page);
    // Typed into the canvas: `comparison.noteSaved` takes free text and the reducer rejects a blank
    // one, so there is a real sentence to enter and no DOM input to enter it in (D5).
    await page.keyboard.type('The bands spread as the screen moves back.');
    await clickDesign(page, notebookSaveControlCentre());
    await waitForInputToSettle(page);

    // Observed through the retired panel's read-only projection of the store, which is the only way to
    // read canvas-entered text from the DOM. It dispatches nothing here.
    await expect(page.getByLabel('Comparison note')).toHaveValue('The bands spread as the screen moves back.');

    await clickDesign(page, notebookCloseControlCentre());
    await waitForInputToSettle(page);
    // The bench is live again the moment the overlay is down: a control that stayed suppressed would
    // leave the player at a bench they cannot operate.
    await clickDesign(page, LABORATORY_ADVANCE);
    await expectActiveScene(page, 'TheoryBoard');
});

test('keeps the optional wavelength comparison shut until the minimum path has been walked', async ({ page }) => {
    await walkToTheBench(page);

    // Index 0 is the fixed minimum path and is always permitted; index 1 is the first authored
    // comparison, which is locked with no qualifying observations. Clicking it must change nothing —
    // the refusal is in-scene copy, which cannot be read from the DOM and is asserted at the store
    // layer in `YoungExperimentBench.test.ts`.
    await clickDesign(page, wavelengthChoiceCentre(1));
    await waitForInputToSettle(page);
    await clickDesign(page, START);
    await waitForRunToResolve(page);

    // Still the minimum path, so this observation counts toward unlocking rather than being refused.
    await expect(observations(page)).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Measurement notebook' })).toContainText('550 nm (minimum path)');
});
