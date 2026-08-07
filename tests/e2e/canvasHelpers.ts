import { readFileSync } from 'node:fs';

import { expect, type Page } from '@playwright/test';

import { en } from '../../src/core/i18n/locales/en';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/adapters/phaser/designSurface';
import { libraryArtifactCentre } from '../../src/adapters/phaser/scenes/libraryGeometry';
import { BOOK_CLOSE_FADE_MS, BOOK_OPEN_MS, BOOK_TURN_MS } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
// Importable in Node as of Story 2.10: `ApparatusRenderer` dropped its `BlendModes` **value** import
// for `setBlendMode('ADD')`, which resolves through the same table. Imported rather than restated for
// the reason every other duration here is — a literal silently stops covering the window the day the
// animation changes, and a click inside that window reaches a locked control and fails looking exactly
// like a dead one.
import { RUN_ANIMATION_MS } from '../../src/adapters/phaser/renderers/ApparatusRenderer';
import {
    advanceToSynthesisControlCentre,
    KNOB_TRAVEL_RADIUS,
    knobCentre,
    notebookCloseControlCentre,
    notebookControlCentre,
    notebookSaveControlCentre,
    notebookSelectionCentre,
    startTheLightControlCentre
} from '../../src/adapters/phaser/renderers/apparatusGeometry';
import {
    caseFileCloseControlCentre,
    caseFileObservationPinCentre,
    caseFileRequestControlCentre,
    caseFileSaveControlCentre,
    caseFileSourcePinCentre
} from '../../src/adapters/phaser/renderers/caseFileGeometry';
import {
    advanceControlCentreOnBoard,
    caseFileOpenControlCentre,
    lastProposalCardProbe
} from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { KNOB_ARC_END_RAD } from '../../src/adapters/phaser/renderers/instrumentView';
import { bookCloseControlCentre } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
import { libraryAdvanceControlCentre } from '../../src/adapters/phaser/scenes/libraryGeometry';

/**
 * Clicking and observing the routed Phaser surface, shared by every canvas spec (Story 2.8).
 *
 * These four helpers were `canvas-transitions.spec.ts`'s private ones. Story 2.8 gave a second and a
 * third spec real canvas walks, and copying them would have meant three copies of the design-space
 * mapping and three chances for one to drift — the shape of defect this whole file exists to avoid.
 * `youngExperimentHelpers.ts` is the precedent for sharing across specs this way.
 *
 * The design size is imported from `designSurface.ts` rather than restated: it is the same module the
 * Phaser config reads, so a spec cannot map against a surface the game does not use.
 */

export { DESIGN_HEIGHT, DESIGN_WIDTH };

/**
 * How many references the shipped case puts on the reading room's shelf.
 *
 * Read from the content rather than written down: object placement is total over the count, so a
 * coordinate derived for two would land in the gap between four.
 */
export const ARTIFACT_COUNT = (JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as { contextualArtifacts: unknown[] }).contextualArtifacts.length;

/**
 * The centre of one object on the reading room's shelf, at the count the room actually draws.
 *
 * Lives here rather than in a spec because two specs need it and this module exists so they do not
 * each keep a copy — which is what the 2.8 review found them doing, in the same commit that created
 * this file for that purpose.
 */
export const artifactAt = (index: number): Readonly<{ x: number; y: number }> => {
    const centre = libraryArtifactCentre(index, ARTIFACT_COUNT, DESIGN_WIDTH);
    if (!centre) throw new Error(`The reading room draws no object at index ${index}.`);
    return centre;
};

export const canvas = (page: Page) => page.locator('#game-container canvas');

/**
 * Clicks a point in **design space**, mapped through the canvas's live bounding box.
 *
 * Mapped rather than assumed for two reasons: the surface is `Scale.FIT`, so it is letterboxed into
 * whatever the window is, and the canvas is sticky, so its document position moves with the scroll.
 */
export const clickDesign = async (page: Page, point: Readonly<{ x: number; y: number }>): Promise<void> => {
    const bounds = await canvas(page).boundingBox();
    if (!bounds) throw new Error('The routed Phaser surface did not render.');
    await page.mouse.click(
        bounds.x + (point.x / DESIGN_WIDTH) * bounds.width,
        bounds.y + (point.y / DESIGN_HEIGHT) * bounds.height
    );
};

/**
 * Drags in **design space**, through the same live mapping {@link clickDesign} uses.
 *
 * ## Why it waits a frame twice
 *
 * Phaser processes pointer input **once per frame**, and the bench's instruments arm the drag on
 * `pointerdown` and then track it on `scene.input.on('pointermove')`. A `down` and a `move` issued in
 * the same tick are therefore handled against the state as it was *before* the press: the drag is
 * never armed, the moves reach nothing, and the knob does not turn. A `move` and an `up` in one tick
 * lose the last position the same way.
 *
 * It is load-dependent, which is what makes it worth a helper rather than a note. Run alone this
 * passed every time; at `--workers=5` the whole sequence landed inside one frame and the walk failed
 * three steps later, at a scene transition, with a routing error pointing nowhere near the cause —
 * because two observations had been recorded at the *same* setting and the significant-measure gate
 * correctly stayed shut.
 *
 * This is the same reasoning {@link waitForInputToSettle} exists for, applied inside a gesture.
 */
export const dragDesign = async (
    page: Page,
    from: Readonly<{ x: number; y: number }>,
    to: Readonly<{ x: number; y: number }>
): Promise<void> => {
    const bounds = await canvas(page).boundingBox();
    if (!bounds) throw new Error('The routed Phaser surface did not render.');
    const at = (point: Readonly<{ x: number; y: number }>) => ({
        x: bounds.x + (point.x / DESIGN_WIDTH) * bounds.width,
        y: bounds.y + (point.y / DESIGN_HEIGHT) * bounds.height
    });
    const start = at(from);
    const end = at(to);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await waitForInputToSettle(page);
    // Several intermediate positions rather than one jump: this is what a hand does, and it is also
    // what gives the tracking handler something to follow.
    await page.mouse.move(start.x + ((end.x - start.x) / 2), start.y + ((end.y - start.y) / 2), { steps: 4 });
    await page.mouse.move(end.x, end.y, { steps: 4 });
    await waitForInputToSettle(page);
    await page.mouse.up();
};

/**
 * Drags an instrument until the setting it drives has actually moved.
 *
 * **Bounded retry rather than a longer wait**, for the reason {@link clickUntilScene} gives about the
 * click after the book closes: the thing being waited for is a Phaser *frame*, and frames stretch
 * with the number of browsers on the machine. Every fixed wait tuned at five workers was wrong at
 * nine — the drag arrived at a knob whose hit area had not been handed back after the run, armed
 * nothing, and the walk recorded its second observation at the same setting as the first.
 *
 * This is not a way to make a dead control pass. The loop is bounded, `settled` is the caller's own
 * assertion about the value the knob drives, and a knob that never turns still fails — with the
 * failure landing on the drag rather than three steps later at a scene transition.
 */
export const dragDesignUntil = async (
    page: Page,
    from: Readonly<{ x: number; y: number }>,
    to: Readonly<{ x: number; y: number }>,
    settled: () => Promise<void>
): Promise<void> => {
    await expect(async () => {
        await dragDesign(page, from, to);
        await settled();
    }).toPass({ timeout: 15_000, intervals: [150, 300, 600, 900] });
};

/** The stable hook `src/main.ts` stamps, so the active scene is observable without Phaser internals. */
export const activeScene = (page: Page): Promise<string | null> =>
    page.locator('#game-container').getAttribute('data-active-scene');

export const expectActiveScene = async (page: Page, sceneKey: string): Promise<void> => {
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', sceneKey);
};

/** Slack over the renderer's own animation constants, so a slow CI machine is not a flake. */
const ANIMATION_MARGIN_MS = 120;
/** Two frames at 60 FPS, rounded up: the window in which Phaser applies a hit-area change. */
const INPUT_SETTLE_MS = 34;
/**
 * Waits out one of the reference book's three animations, so the next canvas click is not lost.
 *
 * **Each of the three disables input for its whole duration.** The open and page-turn tweens disable
 * the book's own interaction surface; the close fade keeps the scene underneath suppressed until the
 * overlay is destroyed. A click inside any of those windows reaches nothing at all — correct for a
 * player, invisible to a spec, and it fails looking exactly like a dead control.
 *
 * Every duration is imported from the renderer that runs the tween, never restated: a literal here
 * would silently stop covering the animation the day that number changed. The margin is for the frame
 * the tween's `onComplete` lands on.
 *
 * A fixed wait rather than a poll because there is genuinely nothing to poll: the overlay is a canvas
 * object with no DOM presence. Where a *scene change* is expected instead, {@link clickUntilScene} is
 * the better tool — it has a signal to wait on.
 */
/**
 * Lets Phaser apply an input-state change before the next click.
 *
 * **Not an animation wait.** Suppression is applied synchronously when the book opens, but Phaser
 * processes pointer input once per frame, so a click issued in the same tick can be handled against the
 * hit areas as they were *before* the change. Two frames of slack is enough, and it is needed even
 * under `prefers-reduced-motion`, where there is no tween to wait out at all — which is why this is
 * separate from the three animation helpers below rather than folded into them.
 */
export const waitForInputToSettle = async (page: Page): Promise<void> => {
    await page.waitForTimeout(INPUT_SETTLE_MS);
};

export const waitForBookToOpen = async (page: Page): Promise<void> => {
    await page.waitForTimeout(BOOK_OPEN_MS + ANIMATION_MARGIN_MS);
};

export const waitForPageTurn = async (page: Page): Promise<void> => {
    await page.waitForTimeout(BOOK_TURN_MS + ANIMATION_MARGIN_MS);
};

export const waitForBookToClose = async (page: Page): Promise<void> => {
    await page.waitForTimeout(BOOK_CLOSE_FADE_MS + ANIMATION_MARGIN_MS);
};

/**
 * What one start-the-light step costs a walk, in wall-clock milliseconds.
 *
 * Exported so a spec that takes two of them can raise **its own** budget by what it actually spends,
 * rather than by a round number somebody picks and nobody revisits. See
 * `canvas-transitions.spec.ts`'s own note on the decision.
 *
 * The run's *length* is deterministic — it is driven by elapsed time, not by frames. What is not
 * deterministic is the update frame on which it notices it has finished and the frame on which Phaser
 * applies the hit-area change that unlocks the instruments, so the budget carries a retry's worth of
 * slack rather than a hand-tuned settle constant: correctness lives in
 * {@link startTheLightUntilRecorded}, and this is only how long to allow for it.
 */
export const RUN_STEP_COST_MS = RUN_ANIMATION_MS + (2 * INPUT_SETTLE_MS);

/**
 * Waits out the light crossing the bench (Story 2.10).
 *
 * The bench locks its instruments, its wavelength chooser and its start control for the whole run —
 * a control change mid-flight would contradict AC6's stale rule against a run already recorded — so a
 * click issued inside this window correctly reaches nothing at all, and one issued a frame too early
 * afterwards reaches a control that has not been handed back yet.
 *
 * The animation's own duration is imported from the renderer that runs it; the frames afterwards are
 * {@link waitForInputToSettle}'s, which is this file's tool for exactly that window rather than a second
 * hand-tuned constant beside it.
 */
export const waitForRunToResolve = async (page: Page): Promise<void> => {
    await page.waitForTimeout(RUN_ANIMATION_MS);
    await waitForInputToSettle(page);
};

/** Every observation the still-mounted DOM notebook is projecting — the record, observed. */
export const recordedObservations = (page: Page) =>
    page.getByRole('region', { name: 'Measurement notebook' }).locator('.notebook-observation');

/**
 * Starts the light and waits until the run it produced is actually recorded, retrying the press.
 *
 * **A bounded retry rather than a longer sleep** (review 2026-08-07). Waiting a fixed
 * `RUN_ANIMATION_MS + 400` was the flake class this file argues against three paragraphs up: the 400 ms
 * was measured at five workers, Phaser processes pointer input once per rendered frame, and nine
 * concurrent browsers stretch that frame. A press landing a frame early reaches a start control that has
 * not been handed back, records nothing, and the walk fails several steps later at a scene transition
 * with a routing error pointing nowhere near the cause — which is precisely how the missing second
 * observation was diagnosed the first time.
 *
 * So this waits on the record instead of on the clock, and says so when it cannot get one.
 * `dragDesignUntil` is the same shape for the drag, and `clickUntilScene` for a transition.
 */
export const startTheLightUntilRecorded = async (
    page: Page,
    point: Readonly<{ x: number; y: number }>,
    expectedObservations: number
): Promise<void> => {
    await expect(async () => {
        await clickDesign(page, point);
        await waitForRunToResolve(page);
        await expect(recordedObservations(page)).toHaveCount(expectedObservations);
    }).toPass({ timeout: 20_000, intervals: [200, 400, 800, 1_200] });
};

/**
 * Clicks a canvas control until the router reports the expected scene.
 *
 * Needed for one click in a walk: the first one after the reference book closes.
 * `LectureBookRenderer.isOverlayVisible` stays true for the whole 180ms closing fade — **deliberately**,
 * so a click during the fade cannot fall through to the surface still painted underneath — and the
 * suppression lifts only when the overlay is destroyed. There is no DOM signal for that moment, so the
 * spec does what a player does and clicks again.
 *
 * This is not a way to make a dead control pass: the loop is bounded, and a control that never
 * dispatches still fails the timeout. The suppression itself is asserted directly, in the tests that
 * pin "a click during the book must do nothing" rather than tolerate it.
 *
 * **It re-reads the scene before every click, and stops the moment it has changed.** Wrapping click and
 * assertion together in a single retried block would fire a second click whenever the router took
 * longer than the inner timeout to stamp the attribute — landing it on the scene just navigated *to*,
 * whose surface the walk then goes on to use. A stray click on a live proposal board is exactly the
 * kind of timing-dependent side effect a retry is supposed to avoid introducing.
 */
export const clickUntilScene = async (page: Page, point: Readonly<{ x: number; y: number }>, sceneKey: string): Promise<void> => {
    await expect(async () => {
        if (await activeScene(page) !== sceneKey) await clickDesign(page, point);
        expect(await activeScene(page)).toBe(sceneKey);
    }).toPass({ timeout: 5_000, intervals: [100, 200, 300, 500] });
};

// --- The whole-case canvas walk (Story 2.11) --------------------------------------------------------

/**
 * The Young case, taken from the reading room to the debrief with **canvas clicks only**.
 *
 * Extracted here rather than copied, which is the rule this file was created to enforce: `artifactAt`
 * was copy-pasted between two specs in the very commit that created it, and became a 2.8 review patch.
 * Two specs need this walk — `canvas-transitions.spec.ts`, which is *about* the transitions, and
 * `debrief-replay.spec.ts`, which needs to be standing in the debrief before it can say anything — and
 * two copies are two chances for one to drift into passing while the other fails.
 *
 * `youngExperimentHelpers.ts` is the **DOM** walk and is deliberately not the answer: Story 2.12
 * deletes every control it drives.
 *
 * The transitions are asserted **inside** the walk. That is what keeps `canvas-transitions.spec.ts`
 * honest after the extraction: the property it claims — every forward transition is taken from the
 * scene the player is standing in — is checked at each step here, rather than reduced to "we ended up
 * in the debrief somehow".
 *
 * Every click target is derived from exported geometry. Nothing here restates a coordinate.
 */

const WALK_CASE = JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as { apparatus: { primaryControls: { id: string; max: number }[] } };

/**
 * Which slot the screen-distance instrument stands in, read from the content rather than fixed at 1.
 *
 * The bench gives one slot per authored control in authored order, so a case that listed the two the
 * other way round would put the drag on the slit spacing — and the run would still record, and the
 * walk would still reach the theory board, and the spec would pass having varied the wrong thing.
 */
const SCREEN_DISTANCE_SLOT = WALK_CASE.apparatus.primaryControls.findIndex(({ id }) => id === 'screenDistanceM');
if (SCREEN_DISTANCE_SLOT < 0) throw new Error('The authored case must carry a screen-distance control.');
/** Where a drag to the far end of the travel lands, read from the authored bound rather than as 4. */
const FURTHEST_THROW = WALK_CASE.apparatus.primaryControls[SCREEN_DISTANCE_SLOT]!.max;
const SCREEN_DISTANCE_TRAVEL_END = {
    x: knobCentre(SCREEN_DISTANCE_SLOT).x + (Math.cos(KNOB_ARC_END_RAD) * (KNOB_TRAVEL_RADIUS - 6)),
    y: knobCentre(SCREEN_DISTANCE_SLOT).y + (Math.sin(KNOB_ARC_END_RAD) * (KNOB_TRAVEL_RADIUS - 6))
};

/**
 * What the walk costs in wall-clock milliseconds beyond Playwright's default, so a spec can set its own
 * budget from what it actually spends rather than from a round number nobody revisits.
 *
 * **Re-derived for Story 2.11's walk, which is longer than the one this number was written for.** It
 * stayed at `4 * RUN_STEP_COST_MS` — byte-identical to the pre-2.11 value — while the header of
 * `canvas-transitions.spec.ts` claimed in the same commit that "Story 2.11 added a case file opened
 * twice. It does more, so it takes longer… Derived rather than rounded." Two halves of one change
 * disagreeing, and the failure mode is a timeout blamed on the product rather than on the budget
 * (2.11 review).
 *
 * The terms, each read from what the walk actually does:
 *
 * - **Two runs**, at `RUN_STEP_COST_MS` each, plus the same allowance again for the rest of the walk —
 *   the original four.
 * - **Every `waitForInputToSettle` in this module's walk**, counted rather than estimated. Phaser
 *   processes pointer input once per rendered frame, so these are the pauses that stretch under
 *   contention, which is precisely when the budget is the thing being asked.
 *
 * This is headroom, not a target: the walk completes in ~17.5s against Playwright's 30s default on an
 * idle machine. It is what keeps a busy machine from reporting a layout defect.
 */
const WALK_INPUT_SETTLE_COUNT = 15;
export const WALK_TO_DEBRIEF_COST_MS =
    (4 * RUN_STEP_COST_MS) + (WALK_INPUT_SETTLE_COUNT * INPUT_SETTLE_MS);

/** Reads both references off the shelf and leaves the room. `context → prediction`. */
const readTheReferences = async (page: Page): Promise<void> => {
    await expectActiveScene(page, 'Library');
    for (let index = 0; index < ARTIFACT_COUNT; index += 1) {
        await clickDesign(page, artifactAt(index));
        await waitForBookToOpen(page);
        await clickDesign(page, bookCloseControlCentre());
        await waitForBookToClose(page);
    }
    await clickUntilScene(page, libraryAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT), 'Colleagues');
};

/** Chooses an attributed prediction and moves to the bench. `prediction → experiment`. */
const chooseThePrediction = async (page: Page): Promise<void> => {
    await clickDesign(page, lastProposalCardProbe(DESIGN_HEIGHT));
    await clickDesign(page, advanceControlCentreOnBoard('prediction'));
    await expectActiveScene(page, 'Laboratory');
};

/**
 * Two observations at **different** screen distances, compared and noted. `experiment → synthesis`.
 *
 * Different settings because `configurationKey` reads a repeat at one setting as a replication, so
 * pressing start twice would record two observations and leave the significant-measure gate shut. The
 * setting is **observed**, never driven: a lost drag would otherwise surface at the transition as a
 * routing error rather than here.
 */
const recordTwoObservations = async (page: Page): Promise<void> => {
    await startTheLightUntilRecorded(page, startTheLightControlCentre(), 1);
    await dragDesignUntil(page, knobCentre(SCREEN_DISTANCE_SLOT), SCREEN_DISTANCE_TRAVEL_END, async () => {
        await expect(page.getByLabel('Screen distance (m)')).toHaveValue(String(FURTHEST_THROW), { timeout: 1_500 });
    });
    await startTheLightUntilRecorded(page, startTheLightControlCentre(), 2);

    await clickDesign(page, notebookControlCentre());
    await waitForInputToSettle(page);
    await clickDesign(page, notebookSelectionCentre(0));
    await waitForInputToSettle(page);
    await clickDesign(page, notebookSelectionCentre(1));
    await waitForInputToSettle(page);
    // **No click into the note field.** It is deliberately not interactive — there is no cursor on a
    // canvas to invite one — so it takes keys from the moment a pair is selected.
    await page.keyboard.type('Wider');
    await clickDesign(page, notebookSaveControlCentre());
    await waitForInputToSettle(page);
    await clickDesign(page, notebookCloseControlCentre());
    await waitForInputToSettle(page);

    await clickDesign(page, advanceToSynthesisControlCentre());
    await expectActiveScene(page, 'TheoryBoard');
};

/**
 * Opens the case file, does something in it, and closes it again.
 *
 * The overlay suppresses the board while it is up and hands it back on close, so every interaction
 * with it is bracketed rather than left open — a click meant for the board that landed on the backdrop
 * would be swallowed, and one meant for the overlay that fell through would choose a conclusion.
 */
const inTheCaseFile = async (page: Page, act: () => Promise<void>): Promise<void> => {
    await clickDesign(page, caseFileOpenControlCentre());
    await waitForInputToSettle(page);
    await act();
    await clickDesign(page, caseFileCloseControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT));
    await waitForInputToSettle(page);
};

/**
 * Chooses the conclusion and pins what it rests on, then asks the reviewers. `synthesis → review`.
 *
 * The four pins are `theory.supportRunSelected` and `theory.supportSourceSelected`, which had no canvas
 * dispatcher at all before Story 2.11 — this is the step that used to be four
 * `board.getByRole('checkbox').check()` calls into a DOM panel Story 2.12 deletes.
 */
const pinTheSupport = async (page: Page): Promise<void> => {
    await clickDesign(page, lastProposalCardProbe(DESIGN_HEIGHT));
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

    await clickDesign(page, advanceControlCentreOnBoard('conclusion'));
    // The theory board hosts `synthesis` **and** `review`, so the scene deliberately does not change
    // here. That the phase did is proven by what follows: `peerReview.requested` is refused outside
    // `review`, and `case.debriefCompleted` is refused unless a reviewed revision was saved in it.
    await expectActiveScene(page, 'TheoryBoard');
};

/**
 * Asks for feedback, saves the reviewed revision, and closes the case. `review → debrief`.
 *
 * `clickUntilScene`, not a single click, and the reason is the *previous* advance rather than this one:
 * the board survives `synthesis → review` and its control relabels under the cursor, which starts
 * `ADVANCE_RELABEL_LOCKOUT_MS` — a deliberate window in which the control ignores clicks so a
 * double-click cannot skip `review` entirely. A spec clicking at machine speed lands inside it and is
 * correctly ignored. Retrying is what a player does without noticing, and the helper is bounded, so a
 * genuinely dead control still fails.
 */
const closeTheCase = async (page: Page): Promise<void> => {
    await inTheCaseFile(page, async () => {
        await clickDesign(page, caseFileRequestControlCentre(DESIGN_WIDTH));
        await waitForInputToSettle(page);
        await clickDesign(page, caseFileSaveControlCentre(DESIGN_WIDTH));
        await waitForInputToSettle(page);

        /**
         * A click aimed at the board while the overlay is up must reach nothing.
         *
         * The reviewed revision is saved, so the board's advance control would now complete the case
         * and route to `Debrief` — meaning "the click got through" and "it did not" produce different
         * routing, which is the technique the 2.8 review settled on after two library specs passed
         * with their feature deleted.
         *
         * **What this proves is the overlay's backdrop, not the scene's suppression.** The backdrop is
         * a full-canvas interactive rectangle at `CASE_FILE_DEPTH` and Phaser hit-tests topmost-first
         * among interactive objects, so at every coordinate the overlay covers it swallows the click
         * whichever way `ColleagueRenderer.setInputEnabled` is set. Verified by mutation: hard-coding
         * that flag back to `true` leaves this walk green. The suppression's own job — a card rebuilt
         * mid-overlay not coming back live — is asserted in `ColleagueGeometry.test.ts`, where it is
         * the only thing acting.
         */
        await clickDesign(page, advanceControlCentreOnBoard('conclusion'));
        await waitForInputToSettle(page);
        await expectActiveScene(page, 'TheoryBoard');
    });
    await clickUntilScene(page, advanceControlCentreOnBoard('conclusion'), 'Debrief');
};

/**
 * The walk as far as the theory board, with two observations recorded and compared.
 *
 * Its own seam because the board is where the case file lives: a caller that wants to *look at* the
 * overlay rather than pass through it stops here, and re-deriving the first three steps to get there
 * is the copy-paste this module exists to prevent. Story 2.11's manual verification pass used it and
 * was then deleted, so it is module-private until a spec needs it — an exported helper nothing calls
 * is the "open invitation" the 2.8 review deleted three dead methods over.
 */
const walkToTheBoard = async (page: Page): Promise<void> => {
    await page.goto('/');
    // The app booted before we start clicking. A precondition belongs where the precondition is: this
    // assertion used to sit *after* the whole walk in `canvas-transitions.spec.ts`, where it checked an
    // incidental fact about a still-mounted DOM shell and let a boot failure surface several frames of
    // noise later, at the first `expectActiveScene` (2.11 review).
    await expect(page.getByRole('heading', { name: en['boot.title'] })).toBeVisible();
    await readTheReferences(page);
    await chooseThePrediction(page);
    await recordTwoObservations(page);
};

/**
 * The whole walk. Starts at `/` and leaves the player standing in the debrief.
 *
 * Every step is a canvas click; **no DOM control is driven anywhere in it**, which is what Story 2.11
 * closes and what Story 2.12's completion check asks for.
 */
export const walkToDebrief = async (page: Page): Promise<void> => {
    await walkToTheBoard(page);
    await pinTheSupport(page);
    await closeTheCase(page);
};
