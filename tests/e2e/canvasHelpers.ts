import { readFileSync } from 'node:fs';

import { expect, type Page } from '@playwright/test';

import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { decimalPlaces, formatMeasurement } from '../../src/core/i18n/formatNumber';
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
    boardDialogueAdvanceControlCentre,
    caseFileOpenControlCentre,
    colleagueFigureProbe,
    proposalDetailPanelProbe
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
 * The canvas's live box, having first put it on screen **only if it is not already there**.
 *
 * `project-context.md` states the rule in as many words — "browser tests scroll before exercising
 * in-canvas controls" — and until Story 2.12 no spec needed it, because at desktop widths the canvas
 * shares the fold with the boot frame. Below 720px the frame stacks *above* it, so a coordinate mapped
 * from a box below the fold lands nowhere and reads exactly like a dead control (AC7's narrow-viewport
 * walk).
 *
 * **The conditional is load-bearing, and an unconditional `scrollIntoViewIfNeeded` is not equivalent.**
 * The canvas is `position: sticky` and Phaser caches its bounds in *document* coordinates, refreshing
 * them from a passive scroll listener — so any scroll leaves the cached bounds stale for a frame, and a
 * click issued in that frame is hit-tested against where the canvas used to be. Firefox scrolls a few
 * pixels even when the element is already visible, which took out the reading room's reduced-motion
 * walk the first time this helper scrolled unconditionally. So: scroll only when the box is genuinely
 * off screen, then give the listener its frame and re-read the box it moved to.
 */
const scrolledCanvasBounds = async (page: Page) => {
    const surface = canvas(page);
    let bounds = await surface.boundingBox();
    if (!bounds) throw new Error('The routed Phaser surface did not render.');
    const viewport = page.viewportSize();
    // A pixel of tolerance, because "already on screen" is a sub-pixel question at the desktop layout:
    // `#game-container` is `height: 100vh` and the letterboxed canvas inside it fills that exactly, so a
    // bounding box reported as 720.0000001 tall in a 720px viewport reads as off-screen and triggers a
    // scroll on **every** click. Firefox does exactly that, and the scroll invalidates Phaser's cached
    // document-space bounds for a frame — which is how an unconditional scroll took out the reading
    // room's reduced-motion walk while every other browser stayed green.
    const TOLERANCE = 2;
    const offScreen = viewport !== null
        && (bounds.y < -TOLERANCE || bounds.y + bounds.height > viewport.height + TOLERANCE
            || bounds.x < -TOLERANCE || bounds.x + bounds.width > viewport.width + TOLERANCE);
    if (!offScreen) return bounds;
    await surface.scrollIntoViewIfNeeded();
    await waitForInputToSettle(page);
    bounds = await surface.boundingBox();
    if (!bounds) throw new Error('The routed Phaser surface did not render.');
    return bounds;
};

const dragBounds = scrolledCanvasBounds;

/**
 * Clicks a point in **design space**, mapped through the canvas's live bounding box.
 *
 * Mapped rather than assumed for two reasons: the surface is `Scale.FIT`, so it is letterboxed into
 * whatever the window is, and the canvas is sticky, so its document position moves with the scroll.
 */
export const clickDesign = async (page: Page, point: Readonly<{ x: number; y: number }>): Promise<void> => {
    const bounds = await scrolledCanvasBounds(page);
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
    const bounds = await dragBounds(page);
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

/**
 * Slack over the renderer's own animation constants, so a busy machine is not a flake.
 *
 * **Raised from 120 ms at Story 2.12.** These three are the only fixed waits left in the suite, and
 * they are the only ones that cannot be replaced by a bounded retry: the reference book is a canvas
 * overlay with no DOM signal for "it has gone". The tween's *duration* is deterministic — it is driven
 * by elapsed time — but the update frame its `onComplete` lands on is not, and `playwright.config.ts`
 * runs five browsers at once. A click issued a frame early is correctly swallowed by an overlay still
 * suppressing the room underneath, and the walk then fails several steps later at a transition with a
 * routing error pointing nowhere near the cause. 400 ms is roughly a doubling of the worst frame
 * observed under the release gate's concurrency; it costs ~1.1 s per walk and removes the last
 * fixed-wait flake in the suite.
 */
const ANIMATION_MARGIN_MS = 400;
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

/**
 * The retained printable record, which is the only DOM projection of the store that still exists.
 *
 * Story 2.12 deletes every presentation panel; ADR-007's `CaseRecordPrintView` is the sole non-Phaser
 * **surface** the architecture keeps, and it dispatches nothing. It is not an observability hook added
 * to make a spec pass — the 2.8 review's rule against those — it is a shipped feature (FR11) that has
 * projected the record since Story 1.8 and is mounted on every normal-route session.
 */
const printRecord = (page: Page) => page.getByRole('article', {
    name: new RegExp(`^(${escapeForRegExp(en['print.ariaLabel'])}|${escapeForRegExp(fr['print.ariaLabel'])})$`)
});

/**
 * A section of the printable record, found by its own heading rather than by position.
 *
 * By heading because the record's section order is a fact about one function, and an index would go on
 * passing while pointing at a different section — the "green suite that cannot see the thing it claims"
 * this epic keeps producing.
 */
const printSection = (page: Page, heading: string) => {
    const french = fr[Object.keys(en).find((key) => en[key as keyof typeof en] === heading) as keyof typeof fr];
    return printRecord(page).locator('section').filter({
        has: page.getByRole('heading', { name: new RegExp(`^(${escapeForRegExp(heading)}|${escapeForRegExp(french)})$`) })
    });
};

const escapeForRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Every observation the record carries — the record, observed.
 *
 * This used to read `.notebook-observation` out of the still-mounted DOM notebook, which is deleted.
 * The empty-state row is excluded rather than counted: the print view always renders one `li`, so a
 * bare count would report one observation before any exists and every "recorded a run" assertion in the
 * suite would start life already satisfied.
 */
export const recordedObservations = (page: Page) =>
    printSection(page, en['print.observations.heading']).locator('ol > li')
        // Both bundles, because three specs run under a French browser and the record is localized:
        // filtering only the English placeholder leaves the French one counted, and every "recorded one
        // observation" assertion in the suite would then be satisfied before anything was recorded.
        .filter({ hasNotText: en['print.observations.empty'] })
        .filter({ hasNotText: fr['print.observations.empty'] });

/**
 * Every reference the record says has been read — the same shape as {@link recordedObservations}, and
 * excluded from its empty state for the same reason: the print view always renders one row, so a bare
 * count would report a reading before any exists.
 */
export const recordedSources = (page: Page) =>
    printSection(page, en['print.sources.heading']).locator('ul > li')
        .filter({ hasNotText: en['print.sources.empty'] })
        .filter({ hasNotText: fr['print.sources.empty'] });

/**
 * The completion snapshot, present only once the case has actually been closed.
 *
 * `CaseRecordPrintView` renders this section **only** when `selectCompletionSnapshot` returns one, so
 * its presence is a real signal rather than a label that is always there — which is what lets a spec
 * tell "the case completed" from "the debrief scene happened to be reached".
 */
export const completionSnapshot = (page: Page) =>
    printSection(page, en['print.completion.heading']);

/** Every comparison note the record carries, for a spec that typed one into the canvas. */
export const recordedComparisonNotes = (page: Page) =>
    printSection(page, en['print.comparison.heading']).locator('ul > li')
        .filter({ hasNotText: en['print.comparison.empty'] })
        .filter({ hasNotText: fr['print.comparison.empty'] });

/**
 * What the record says the apparatus is set to, for one authored control.
 *
 * Replaces `getByLabel('Screen distance (m)')`, which read the deleted DOM slider. The print view lists
 * `selectControlLabel` against `selectFormattedControlValue` for every primary control, so this observes
 * the same store field the slider used to — and, unlike the slider, it is a surface that ships.
 */
export const recordedSetting = (page: Page, controlLabel: string | RegExp) =>
    printSection(page, en['print.settings.heading'])
        .locator('div')
        .filter({ has: page.getByRole('term').filter({ hasText: controlLabel }) })
        .getByRole('definition');

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
export const clickUntilScene = async (
    page: Page,
    point: Readonly<{ x: number; y: number }>,
    sceneKey: string,
    /**
     * How long to keep trying. Five seconds is right for a desktop viewport and is what every walk uses.
     *
     * The parameter exists for one caller: the narrow-viewport walk added in Story 2.12 runs under
     * Chromium's mobile emulation at 390×844, where the canvas is a quarter of the area, the page
     * scrolls, and every frame is longer — so the same four retries that are generous on a desktop
     * viewport are marginal there under the release gate's five workers. Raising the **bound** does not
     * weaken the check: a control that never dispatches still fails, just later.
     */
    timeoutMs = 5_000
): Promise<void> => {
    await expect(async () => {
        if (await activeScene(page) !== sceneKey) await clickDesign(page, point);
        expect(await activeScene(page)).toBe(sceneKey);
    }).toPass({ timeout: timeoutMs, intervals: [100, 200, 300, 500, 800, 1_200] });
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
) as { apparatus: { primaryControls: { id: string; max: number; step: number; unit: string; label: { en: string } }[] } };

/**
 * Which slot the screen-distance instrument stands in, read from the content rather than fixed at 1.
 *
 * The bench gives one slot per authored control in authored order, so a case that listed the two the
 * other way round would put the drag on the slit spacing — and the run would still record, and the
 * walk would still reach the theory board, and the spec would pass having varied the wrong thing.
 */
const SCREEN_DISTANCE_SLOT = WALK_CASE.apparatus.primaryControls.findIndex(({ id }) => id === 'screenDistanceM');
if (SCREEN_DISTANCE_SLOT < 0) throw new Error('The authored case must carry a screen-distance control.');
/**
 * Where a drag to the far end of the travel lands, and what the record says when it gets there.
 *
 * Both read from the authored content and formatted by the app's own formatter rather than written
 * down: the readout is `{value} {unit}` in English and `{value} {unit}` with a comma decimal in French,
 * and a literal here would be a number this file and the product agreed on by coincidence.
 */
const SCREEN_DISTANCE_CONTROL = WALK_CASE.apparatus.primaryControls[SCREEN_DISTANCE_SLOT]!;
/**
 * Both locales, because this walk runs under a French browser too.
 *
 * The authored control label and the formatted value both differ — `Distance à l'écran` and a comma
 * decimal — so a walk pinned to the English pair would report a knob that never turned rather than a
 * language it was not written for. That is the shape of failure the 2.11 review recorded twice.
 */
const throwReadout = (locale: 'en' | 'fr', value: number): string =>
    formatMeasurement(locale, value, decimalPlaces(SCREEN_DISTANCE_CONTROL.step), SCREEN_DISTANCE_CONTROL.unit);
const FURTHEST_THROW_READOUT = new RegExp(
    `^(${escapeForRegExp(throwReadout('en', SCREEN_DISTANCE_CONTROL.max))}`
    + `|${escapeForRegExp(throwReadout('fr', SCREEN_DISTANCE_CONTROL.max))})$`
);
const SCREEN_DISTANCE_LABEL = new RegExp(
    `^(${escapeForRegExp(SCREEN_DISTANCE_CONTROL.label.en)}|${escapeForRegExp(SCREEN_DISTANCE_CONTROL.label.fr)})$`
);
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
const WALK_INPUT_SETTLE_COUNT = 19;
/**
 * How long the whole walk takes when nothing else is running, measured rather than estimated.
 *
 * ~29 s at Story 2.12, against ~17.5 s when the previous derivation was written. Three things grew it:
 * the case file is opened three times rather than twice, the reading room is walked with real book
 * animations, and `clickUntilScene` now covers two more relabel-lockout windows.
 */
const WALK_MEASURED_MS = 29_000;
/**
 * The contention allowance, and why it is a doubling rather than a margin.
 *
 * `playwright.config.ts` runs five workers, and every pause in this walk is a Phaser **frame** — input
 * is processed once per rendered frame, so five concurrent browsers stretch all of them together. The
 * 2.11 review recorded exactly this and left the constant unmoved; the deferred item asks for it to be
 * re-derived so a timeout under load reads as a budget fact rather than a product defect.
 *
 * This is headroom, not a target. Nothing is waited on for this long: every step in the walk waits on
 * the thing the gesture was supposed to achieve, and a control that never dispatches still fails.
 */
const WALK_CONTENTION_ALLOWANCE = 2;
export const WALK_TO_DEBRIEF_COST_MS =
    ((WALK_MEASURED_MS + (2 * RUN_STEP_COST_MS) + (WALK_INPUT_SETTLE_COUNT * INPUT_SETTLE_MS))
        * WALK_CONTENTION_ALLOWANCE);

/**
 * Reads both references off the shelf and leaves the room. `context → prediction`.
 *
 * **Each reading is verified before the next is attempted**, and that is what makes this step
 * recoverable. It used to click each object once behind fixed-duration waits and check nothing: a click
 * dropped because Phaser had not yet processed the previous frame left the room with one reading, and
 * the failure surfaced at the advance below — as a room correctly refusing to be left, five seconds of
 * bounded retry that could never help, and a routing error pointing nowhere near the lost click. It is
 * the single most frequent flake in the suite under three-engine concurrency.
 *
 * Bounded, and not a way to make a dead shelf pass: the retry re-opens the same object, the condition is
 * the record's own count of readings, and an object that never records still fails here — where the
 * cause is.
 */
const readTheReferences = async (page: Page): Promise<void> => {
    await expectActiveScene(page, 'Library');
    for (let index = 0; index < ARTIFACT_COUNT; index += 1) {
        await expect(async () => {
            await clickDesign(page, artifactAt(index));
            await waitForBookToOpen(page);
            await clickDesign(page, bookCloseControlCentre());
            await waitForBookToClose(page);
            await expect(recordedSources(page)).toHaveCount(index + 1, { timeout: 1_000 });
        }).toPass({ timeout: 15_000, intervals: [150, 300, 600, 900] });
    }
    await clickUntilScene(page, libraryAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT), 'Colleagues');
};

/** Chooses an attributed prediction and moves to the bench. `prediction → experiment`. */
export const chooseProposalThroughColleague = async (
    page: Page,
    dialogueBeatCount: number,
    colleagueIndex: number = 3
): Promise<void> => {
    // The last authored line needs one final acknowledgement click before `DialogueBox` marks the
    // conversation complete and the colleague stage receives input.
    for (let beat = 0; beat <= dialogueBeatCount; beat += 1) {
        await clickDesign(page, boardDialogueAdvanceControlCentre());
        await waitForInputToSettle(page);
    }
    await clickDesign(page, colleagueFigureProbe(colleagueIndex));
    await waitForInputToSettle(page);
    await clickDesign(page, proposalDetailPanelProbe(DESIGN_HEIGHT));
};

/** Chooses an attributed prediction and moves to the bench. `prediction → experiment`. */
const chooseThePrediction = async (page: Page): Promise<void> => {
    await chooseProposalThroughColleague(page, 3);
    // `clickUntilScene` for the reason {@link closeTheCase} gives about the *next* advance: choosing a
    // proposal relabels this control under the cursor, which starts `ADVANCE_RELABEL_LOCKOUT_MS`, and a
    // click at machine speed inside that window is correctly ignored. The window is wider wherever
    // frames are slower — firefox, and any narrow viewport — which is where a bare click failed.
    await clickUntilScene(page, advanceControlCentreOnBoard('prediction'), 'Laboratory');
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
        await expect(recordedSetting(page, SCREEN_DISTANCE_LABEL))
            .toHaveText(FURTHEST_THROW_READOUT, { timeout: 1_500 });
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
export const inTheCaseFile = async (page: Page, act: () => Promise<void>): Promise<void> => {
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
 * is the copy-paste this module exists to prevent.
 *
 * **Exported since Story 2.12**, when the case file gained export, import, print and the consultation:
 * `progress-portability.spec.ts` and `theory-board.spec.ts` both need to be standing at the board
 * rather than passing through it.
 */
/**
 * Waits for the app to boot, then passes the entry gate.
 *
 * **Required before any canvas click since Story 2.12's layout pass.** The boot frame is no longer a
 * column beside the canvas — it covers it, and is dismissed by this button. A spec that skips it
 * hit-tests against the frame and every click lands on nothing, which reads exactly like a dead control.
 *
 * Both halves matter and neither is redundant. The heading is the "the app booted" gate: it is populated
 * by `renderBootShellText` from the i18n layer, so seeing it proves hydration ran rather than that
 * `index.html`'s placeholder markup is on screen. The click is what uncovers the canvas.
 *
 * Matched against **both** bundles rather than the English one: this is a precondition, and pinning it
 * to `en` made the helper unusable under a French browser — which is why `rival-lab.spec.ts` kept a
 * second copy of the same walk. The specs that genuinely assert *which* language resolved do it against
 * `html[lang]` and the boot button, where it is the subject rather than a precondition.
 */
export const enterTheLaboratory = async (page: Page): Promise<void> => {
    const eitherBundle = (key: 'boot.title' | 'boot.enter') =>
        new RegExp(`^(${escapeForRegExp(en[key])}|${escapeForRegExp(fr[key])})$`);
    await expect(page.getByRole('heading', { name: eitherBundle('boot.title') })).toBeVisible();
    await page.getByRole('button', { name: eitherBundle('boot.enter') }).click();
    // The frame is out of the way before the first coordinate is mapped, not merely asked to go.
    await expect(page.locator('#boot-shell')).toBeHidden();
    /**
     * And Phaser has seen the input gate open before anything is clicked at it.
     *
     * Entry re-enables `game.input`, and Phaser processes pointer input **once per rendered frame** —
     * so a click issued in the same frame as the enable is hit-tested against an input manager that is
     * still disabled and is silently dropped. It is load-dependent, which is what makes it worth a wait
     * rather than a note: alone this never missed, and at `--workers=5` the first reference click was
     * swallowed and the walk failed three steps later in `readTheReferences`, refusing to leave a
     * reading room that correctly still had nothing on its record.
     *
     * The same reasoning as {@link dragDesign}'s two frame waits, applied to the gate.
     */
    await waitForInputToSettle(page);
};

export const walkToTheBoard = async (page: Page): Promise<void> => {
    await page.goto('/');
    // The app booted, and the gate is passed, before we start clicking. A precondition belongs where the
    // precondition is: this assertion used to sit *after* the whole walk in `canvas-transitions.spec.ts`,
    // where it checked an incidental fact about a still-mounted DOM shell and let a boot failure surface
    // several frames of noise later, at the first `expectActiveScene` (2.11 review).
    await enterTheLaboratory(page);
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
