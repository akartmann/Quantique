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
    enterTheLaboratory,
    expectActiveScene,
    waitForBookToClose,
    waitForBookToOpen,
    waitForInputToSettle,
    recordedComparisonNotes,
    recordedObservations,
    recordedSetting,
    startTheLightUntilRecorded
} from './canvasHelpers';
import { en } from '../../src/core/i18n/locales/en';
import { decimalPlaces, formatMeasurement, formatRecordedValue } from '../../src/core/i18n/formatNumber';

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
    apparatus: {
        primaryControls: { id: string; max: number; defaultValue: number; step: number; unit: string; label: { en: string } }[];
    };
};

/**
 * What the printable record says a control reads, formatted by the app's own formatter.
 *
 * Derived rather than written down: the readout is `{value} {unit}` with locale-aware decimals, and a
 * literal here would be a string this spec and the product agreed on by coincidence — the exact rule
 * "never assert a magic number a test shares with source" states one layer up.
 */
const authoredControl = (id: string) => {
    const control = caseDefinition.apparatus.primaryControls.find((candidate) => candidate.id === id);
    if (!control) throw new Error(`The authored case must carry the ${id} control.`);
    return control;
};

/** What the **settings** section shows, which is `selectFormattedControlValue`'s own formatting. */
const settingReadoutFor = (id: string, pick: (control: { max: number; defaultValue: number }) => number): string => {
    const control = authoredControl(id);
    return formatMeasurement('en', pick(control), decimalPlaces(control.step), control.unit);
};

/**
 * What an **observation's** inputs line shows, which is a different formatter.
 *
 * `CaseRecordPrintView` prints a recorded model input through `formatRecordedValue` — a saved value is
 * shown as it was stored rather than re-formatted to a control's authored precision — so `2 m` there
 * against `2.00 m` in the settings above. Two formatters, both correct, and this spec reads whichever
 * the section it is asserting on actually uses.
 */
const recordedReadoutFor = (id: string, pick: (control: { max: number; defaultValue: number }) => number): string =>
    formatRecordedValue('en', pick(authoredControl(id)), authoredControl(id).unit);

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
const SCREEN_DISTANCE_LABEL = caseDefinition.apparatus.primaryControls[SCREEN_DISTANCE_SLOT]!.label.en;
const FURTHEST_THROW_READOUT = settingReadoutFor('screenDistanceM', ({ max }) => max);
const DEFAULT_THROW_READOUT = settingReadoutFor('screenDistanceM', ({ defaultValue }) => defaultValue);
const RECORDED_DEFAULT_THROW = recordedReadoutFor('screenDistanceM', ({ defaultValue }) => defaultValue);
const RECORDED_DEFAULT_SPACING = recordedReadoutFor('slitSpacingMm', ({ defaultValue }) => defaultValue);

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
const walkToTheBench = async (
    page: import('@playwright/test').Page,
    sceneTimeoutMs?: number
): Promise<void> => {
    await page.goto('/');
    // The boot frame covers the canvas until it is dismissed (Story 2.12), so every coordinate mapped
    // before this lands on the frame instead of the surface.
    await enterTheLaboratory(page);
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
    await clickUntilScene(page, LEAVE_THE_ROOM, 'Colleagues', sceneTimeoutMs);

    await clickDesign(page, CARD);
    // `clickUntilScene`, not a bare click: the board's advance control relabels the moment a proposal is
    // chosen, which starts `ADVANCE_RELABEL_LOCKOUT_MS` — a deliberate window in which the control
    // ignores clicks so a double-click cannot skip a phase. A spec clicking at machine speed lands
    // inside it and is correctly ignored, and the window is wider wherever frames are slower: it is what
    // took this walk out on firefox and on a 390px mobile viewport while passing on desktop chromium.
    // Bounded, so a control that never dispatches still fails.
    await clickUntilScene(page, PREDICTION_ADVANCE, 'Laboratory', sceneTimeoutMs);
};

/** Turns the screen-distance knob to the far end of its travel, and waits until it has got there. */
const turnTheThrowToTheFarEnd = (page: import('@playwright/test').Page): Promise<void> =>
    dragDesignUntil(
        page,
        knobCentre(SCREEN_DISTANCE_SLOT),
        knobTravelEnd(SCREEN_DISTANCE_SLOT),
        async () => {
            await expect(recordedSetting(page, SCREEN_DISTANCE_LABEL))
                .toHaveText(FURTHEST_THROW_READOUT, { timeout: 1_500 });
        }
    );

test('records two significant Young measurements from the canvas alone, and opens the gate with them', async ({ page }) => {
    // A full canvas walk, two timed observations, and a drag leave too little room for the default budget
    // on a serialized CI runner; the bounded record and transition assertions remain the pass condition.
    test.setTimeout(60_000);
    await walkToTheBench(page);
    await expect(recordedObservations(page)).toHaveCount(0);

    // --- the first observation, at the default setup ---------------------------------------------
    await startTheLightUntilRecorded(page, START, 1);

    // --- change the throw by **dragging** the knob ------------------------------------------------
    // The drag path, in a browser, is what nothing else in the suite reaches: the press arms on the
    // knob's hit area and the travel is tracked on the scene, so a pointer that leaves the body
    // mid-turn keeps turning it.
    // The setting is **observed**, never driven, and it is what the retry waits on. Without it a lost
    // drag surfaces three steps later as a routing error at the theory board, because two observations
    // at the *same* setting are a replication and the significant-measure gate correctly stays shut.
    await turnTheThrowToTheFarEnd(page);

    // --- the second observation, at a different throw ---------------------------------------------
    await startTheLightUntilRecorded(page, START, 2);

    // The gate only opens for two observations at **different** configurations, so taking the
    // transition is the assertion that the drag really moved the screen.
    await clickDesign(page, LABORATORY_ADVANCE);
    await expectActiveScene(page, 'TheoryBoard');
});

test('steps the instrument with its discrete affordance to the same effect as a drag', async ({ page }) => {
    await walkToTheBench(page);

    await startTheLightUntilRecorded(page, START, 1);

    // Four presses of the increase affordance, which is a different input path to the drag above and
    // must reach the same record. The count is arbitrary; what matters is that the setting moves.
    for (let press = 0; press < 4; press += 1) {
        await clickDesign(page, stepAffordanceCentre(SCREEN_DISTANCE_SLOT, 1));
        await waitForInputToSettle(page);
    }

    await startTheLightUntilRecorded(page, START, 2);

    await clickDesign(page, LABORATORY_ADVANCE);
    await expectActiveScene(page, 'TheoryBoard');
});

test('compares two observations and saves a note, all from the bench notebook', async ({ page }) => {
    // Two measured runs plus a canvas notebook interaction exceed the default budget on GitHub runners.
    test.setTimeout(45_000);
    await walkToTheBench(page);
    await startTheLightUntilRecorded(page, START, 1);
    await turnTheThrowToTheFarEnd(page);
    await startTheLightUntilRecorded(page, START, 2);

    await clickDesign(page, NOTEBOOK);
    await waitForInputToSettle(page);

    await clickDesign(page, notebookSelectionCentre(0));
    await waitForInputToSettle(page);
    await clickDesign(page, notebookSelectionCentre(1));
    await waitForInputToSettle(page);

    // **No click into the note field.** It is deliberately not interactive — `applyVisibility` states so
    // in as many words — because there is no cursor on a canvas to invite one, so the field takes keys
    // from the moment a pair is selected. The click here landed on the interactive backdrop, which
    // swallowed it: an inert step that asserted nothing and made the walk read as though a click were
    // required (review 2026-08-07).
    // Typed into the canvas: `comparison.noteSaved` takes free text and the reducer rejects a blank
    // one, so there is a real sentence to enter and no DOM input to enter it in (D5).
    await page.keyboard.type('The bands spread as the screen moves back.');
    await clickDesign(page, notebookSaveControlCentre());
    await waitForInputToSettle(page);

    // **Replaced, not dropped** (Story 2.10's Dev Notes asked for exactly this). The note used to be
    // read back out of the retired DOM notebook's `Comparison note` field. The retained printable record
    // projects the same store field — it is the only DOM projection left, it dispatches nothing, and it
    // is what a player takes away — so the text a canvas keystroke produced is still observed rather
    // than assumed from "the save control was clicked".
    await expect(recordedComparisonNotes(page))
        .toContainText('The bands spread as the screen moves back.');

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
    await startTheLightUntilRecorded(page, START, 1);

    // Still the minimum path, so this observation counts toward unlocking rather than being refused.
    // Read from the printable record rather than the deleted notebook panel, and against the app's own
    // interpolation rather than a hand-written string: `print.observations.inputs` is what puts the
    // wavelength and its mode into the record, and restating it here would be a sentence this spec and
    // the product agreed on by coincidence.
    await expect(recordedObservations(page).first()).toContainText(
        en['print.observations.inputs']
            .replace('{wavelength}', '550')
            .replace('{mode}', en['lab.wavelengthMode.minimum'])
            .replace('{screenDistance}', RECORDED_DEFAULT_THROW)
            .replace('{slitSpacing}', RECORDED_DEFAULT_SPACING)
    );
});

/**
 * A **touch** tap on the step affordance produces the authored stepped value, at a narrow viewport.
 *
 * Two things this is the only home for, both inherited from `accessible-control.spec.ts`, which drove
 * the deleted DOM slider and is retired with it:
 *
 * - **Touch.** Every other canvas gesture in this suite is a mouse click. A hit area that worked for one
 *   pointer type and not the other would pass everything else here.
 * - **AC7 / D7.** The bench used to suppress its step controls, its advance control and its reference
 *   shelf below 768px, while the library, the boards and the debrief suppressed nothing. Story 2.12
 *   drops the suppression in one direction everywhere: with no DOM fallback left, a narrow viewport
 *   that could not step an instrument or leave the room is a player stuck in a phase, which is the
 *   failure ADR-011 exists to prevent. `ApparatusRun.test.ts` proves the flag at the renderer; this
 *   proves it in a browser at a real phone width.
 */
test('steps an instrument by touch on a narrow viewport, and still leaves the room', async ({ browser }) => {
    // **Touch is enabled for the whole context; the viewport narrows only once the bench is reached.**
    //
    // Walking the reading room under Chromium's mobile emulation at 390×844 is not what is under test
    // and is the most expensive way to reach the subject: the canvas is a quarter of the area, every
    // frame is longer, and under the release gate's five workers the two book animations on the way in
    // stretched past what any bounded retry could absorb — a budget failure standing in front of the
    // assertion, which is the thing this suite's own rules keep telling it not to do.
    //
    // Narrowing at the bench exercises exactly the rule AC7 is about — the suppression was
    // `matchMedia`-driven and re-evaluated on every render, so it applies from the moment the viewport
    // changes — with none of the walk's cost paid at a mobile size.
    const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    try {
        await walkToTheBench(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await startTheLightUntilRecorded(page, START, 1);

        // **Bounded retry on the observable**, which is this suite's rule for every canvas gesture:
        // Phaser handles pointer input once per rendered frame, and a tap issued inside a stretched
        // frame reaches nothing. A fixed number of taps would report a suppressed hit area whenever the
        // machine was busy, which is the flake class `startTheLightUntilRecorded` and `dragDesignUntil`
        // were written to end. A hit area that is genuinely dead still fails, on the timeout.
        const step = stepAffordanceCentre(SCREEN_DISTANCE_SLOT, 1);
        await expect(async () => {
            const bounds = await page.locator('#game-container canvas').boundingBox();
            if (!bounds) throw new Error('The routed Phaser surface did not render.');
            await page.touchscreen.tap(
                bounds.x + (step.x / DESIGN_WIDTH) * bounds.width,
                bounds.y + (step.y / DESIGN_HEIGHT) * bounds.height
            );
            await waitForInputToSettle(page);
            // The setting moved, so the tap reached a live hit area rather than a suppressed one.
            await expect(recordedSetting(page, SCREEN_DISTANCE_LABEL))
                .not.toHaveText(DEFAULT_THROW_READOUT, { timeout: 1_000 });
        }).toPass({ timeout: 15_000, intervals: [150, 300, 600, 900] });
        await startTheLightUntilRecorded(page, START, 2);

        // And the way out is still there, which is the half the suppression used to take away.
        await clickUntilScene(page, LABORATORY_ADVANCE, 'TheoryBoard', 20_000);
    } finally {
        await context.close();
    }
});
