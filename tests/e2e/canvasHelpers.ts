import { readFileSync } from 'node:fs';

import { expect, type Page } from '@playwright/test';

import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/adapters/phaser/designSurface';
import { libraryArtifactCentre } from '../../src/adapters/phaser/scenes/libraryGeometry';
import { BOOK_CLOSE_FADE_MS, BOOK_OPEN_MS, BOOK_TURN_MS } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
// Importable in Node as of Story 2.10: `ApparatusRenderer` dropped its `BlendModes` **value** import
// for `setBlendMode('ADD')`, which resolves through the same table. Imported rather than restated for
// the reason every other duration here is — a literal silently stops covering the window the day the
// animation changes, and a click inside that window reaches a locked control and fails looking exactly
// like a dead one.
import { RUN_ANIMATION_MS } from '../../src/adapters/phaser/renderers/ApparatusRenderer';

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
 * How long past the run's own duration to wait before the bench is operable again.
 *
 * Larger than {@link ANIMATION_MARGIN_MS}, and the difference is the point. The run's *length* is
 * deterministic — it is driven by elapsed time, not frames — but two things after it are not: the
 * update frame on which it notices it has finished, and the frame on which Phaser applies the
 * hit-area change that unlocks the instruments. Two frames is nothing at 60 FPS and about 400ms on a
 * machine running five browsers at once, which is exactly where this was measured: the drag after a
 * run arrived at a knob whose hit area was still disabled, the gesture never armed, and the walk went
 * on to record its second observation at the *same* setting.
 */
const RUN_SETTLE_MS = 400;

/**
 * What one start-the-light step costs a walk, in wall-clock milliseconds.
 *
 * Exported so a spec that takes two of them can raise **its own** budget by what it actually spends,
 * rather than by a round number somebody picks and nobody revisits. See
 * `canvas-transitions.spec.ts`'s own note on the decision.
 */
export const RUN_STEP_COST_MS = RUN_ANIMATION_MS + RUN_SETTLE_MS;

/**
 * Waits out the light crossing the bench (Story 2.10).
 *
 * The bench locks its instruments, its wavelength chooser and its start control for the whole run —
 * a control change mid-flight would contradict AC6's stale rule against a run already recorded — so a
 * click issued inside this window correctly reaches nothing at all, and one issued a frame too early
 * afterwards reaches a control that has not been handed back yet.
 */
export const waitForRunToResolve = async (page: Page): Promise<void> => {
    await page.waitForTimeout(RUN_ANIMATION_MS + RUN_SETTLE_MS);
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
