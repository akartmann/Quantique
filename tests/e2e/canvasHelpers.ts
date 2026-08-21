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
import { controlAffordance, type PrimaryControl } from '../../src/domain/cases/CaseDefinition';
import { YOUNG_CASE_ID } from '../../src/schemas/CaseDefinitionSchema';
import {
    advanceToSynthesisControlCentre,
    DIAL_RING_RADIUS,
    KNOB_TRAVEL_RADIUS,
    SLIDER_TRACK_WIDTH,
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
    BOARD_HEADING_FONT_SIZE,
    BOARD_HEADING_WRAP,
    DIALOGUE_PANEL_WIDTH,
    DIALOGUE_TOP,
    HEADING_GAP,
    HEADING_Y,
    PROPOSAL_SURFACE_LEFT,
    caseFileOpenControlCentre,
    colleagueFigureProbe,
    proposalDetailPanelProbe
} from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { presentColleagueIds } from '../../src/adapters/phaser/renderers/characterStageView';
import { dialogueAdvanceControlCentre } from '../../src/adapters/phaser/ui/DialogueBox';
import {
    dialAngleForFraction,
    knobAngleForFraction,
    sliderOffsetForValue
} from '../../src/adapters/phaser/renderers/instrumentView';
import { UI_FONT_STACK } from '../../src/adapters/phaser/textStyles';
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
type WalkableCase = Readonly<{
    contextualArtifacts: readonly unknown[];
    /**
     * The authored controls, typed as the domain's own {@link PrimaryControl} rather than as the subset
     * this file happens to read (Story 3.4).
     *
     * The narrowed shape was fine while nothing here passed a control *into* production code. It now
     * does — `controlAffordance` and `sliderOffsetForValue` both take a whole `PrimaryControl`, for the
     * reason `instrumentView.ts` records: narrowing at the boundary means a cast claiming a shape the
     * caller does not have.
     */
    apparatus: { primaryControls: PrimaryControl[] };
    /**
     * The authored conversation lengths and cast, which the conclusion walk reads instead of counting on
     * Young's (Story 4.3, Task 5).
     *
     * `chooseProposalThroughColleague` clicks `dialogueBeatCount + 1` times, and both numbers it needed
     * were Young's. The two literals actually replaced are in `chooseThePrediction` (**prediction**: 3
     * beats on Young, 1 here) and `pinTheSupport` (**synthesis**: 3 on Young, 1 here) — the phases named
     * here until Story 4.3's code review were `synthesis` and `review`, and the `review` figures belong to
     * no call site at all, so the number the first substitution has to reproduce went unstated. The
     * literals survived because the click loop sits inside a retrying `expect(...).toPass()`, so a wrong
     * count is absorbed rather than reported — over-clicking a 1-beat scene keeps pressing a control that
     * has already relabelled to the board's advance, and `ADVANCE_RELABEL_LOCKOUT_MS` swallows some of
     * *that*. `morley-miller-prototype.spec.ts` passes `0` against 1 authored beat and passes on the
     * retry. Timing-dependent green in both directions, which is the worst kind.
     */
    scenarioScript: {
        scenes: {
            phase: string;
            cast?: string[];
            dialogueBeats?: { speakerId: string }[];
        }[];
    };
    colleagues: { id: string }[];
    predictionProposals: { id: string; colleagueId: string }[];
    conclusionProposals: { id: string; colleagueId: string }[];
}>;

/**
 * A shipped case's authored content, read from `public/cases/` (Story 3.2).
 *
 * Parameterised by case ID rather than forked: every coordinate below is derived from authored content,
 * so the derivation carries to a second case for free and a second copy of it would be the thing that
 * drifts. The Young constants that follow are now *the Young instance* of these derivations.
 */
export const caseContent = (caseId: string): WalkableCase => JSON.parse(
    readFileSync(new URL(`../../public/cases/${caseId}/case.json`, import.meta.url), 'utf-8')
) as WalkableCase;

/**
 * Young's case ID, aliased from the exported constant rather than restated.
 *
 * The literal it used to hold was the same "never restate a case constant" shape the code review of 4.1
 * deleted `MORLEY_MILLER_CASE` for — a rename in `CaseDefinitionSchema` would have left this compiling
 * and producing a `?case=` value `resolveCaseId` rejects, so the spec would have asserted Young's
 * content against whatever booted instead.
 */
export const YOUNG_CASE: string = YOUNG_CASE_ID;

/**
 * The URL that opens a named case — **always naming it**, since Story 4.1 flipped the boot default.
 *
 * `/` used to mean Young, and about forty spec sites said `goto('/')` while asserting Young's content.
 * The campaign entry is now Morley–Miller, so those forty sites silently meant "whatever case boots
 * first" — a Young-shaped assumption baked into the suite, which is the project's top Don't-Miss rule.
 * Every spec that asserts a *case's* content now names the case; the specs that assert *boot* behaviour
 * (the boot frame, offline reload, subpath hosting, the moderated route) deliberately keep `goto('/')`,
 * because what they are checking is what happens at the root.
 *
 * This replaced the conditional `caseId === YOUNG_CASE ? '/' : ...` that `walkToTheBoard` carried: the
 * special case existed only to keep `/` meaning Young, and keeping it would reintroduce the assumption
 * this helper exists to remove.
 */
export const caseRoute = (caseId: string): string => `/?case=${caseId}`;

/**
 * Opens a named case and waits for nothing — callers assert their own first frame.
 *
 * **`caseId` is required, and that is the point.** Story 4.1 gave it `= YOUNG_CASE`, and all seventeen
 * converted call sites then passed nothing — so the docstring above claiming "every spec that asserts a
 * case's content now names the case" was false at every one of them, and the implicit-Young binding the
 * flip was meant to remove had simply moved from `goto('/')` into a default argument (code review of
 * 4.1). A new spec copying the surrounding idiom would have silently asserted a second case's
 * expectations against Young. Naming the case costs one argument and removes the whole class.
 */
export const gotoCase = async (page: Page, caseId: string): Promise<void> => {
    await page.goto(caseRoute(caseId));
};

export const artifactCountFor = (caseId: string): number => caseContent(caseId).contextualArtifacts.length;

/**
 * How many dialogue beats a case authors for one phase — the count the walk must acknowledge.
 *
 * Read from `scenarioScript`, never written down: see {@link WalkableCase}'s note on why the two literals
 * this replaces could not fail loudly. A phase authoring no beats answers `0`, which is what Young's
 * `context` and `experiment` do and is a legitimate count rather than a missing one.
 *
 * Throws on a phase the case does not author at all, because that is a spec asking about the wrong case
 * and a silent `0` would send it into a click loop against a board with no conversation on it.
 */
export const dialogueBeatCountFor = (caseId: string, phase: 'prediction' | 'synthesis' | 'review'): number => {
    const scene = caseContent(caseId).scenarioScript.scenes.find((candidate) => candidate.phase === phase);
    if (!scene) throw new Error(`${caseId} authors no ${phase} scene.`);
    return scene.dialogueBeats?.length ?? 0;
};

/**
 * Which figure on the stage proposes a given conclusion, as a **stage slot index**.
 *
 * ## Why this cannot be an index into `colleagues[]`
 *
 * `chooseProposalThroughColleague` clicks a figure by position, and the stage is **not** laid out in
 * `colleagues[]` order. `presentColleagueIds` orders it by `proposerIds` — the proposal array's
 * `colleagueId`s, left to right, which is *"the reading order the two boards genuinely differ in"* — then
 * appends any beat speakers not already standing.
 *
 * On Young the two orderings coincide, entirely by accident: `conclusionProposals` runs
 * `[marianne-cole, elias-wren, thea-young, samuel-hart]` and `colleagues` runs
 * `[thea-young, elias-wren, marianne-cole, samuel-hart]`, so slot **3** is `samuel-hart` either way. On
 * Morley–Miller they do not: `conclusionProposals` runs
 * `[edith-vance, tomas-reyes, nils-abrahamsen, harriet-lowe]` against a cast of
 * `[edith-vance, tomas-reyes, harriet-lowe, nils-abrahamsen]`, so slot 3 is **`harriet-lowe`**
 * (`conclude-instrument-broken`) while `colleagues[3]` is `nils-abrahamsen`
 * (`conclude-ether-disproved`). Two different conclusions from one number, and the first version of this
 * helper had the wrong one — it went to a browser and the pane came back reporting no overreach, which is
 * how the error was caught rather than argued about.
 *
 * That also corrects the record for `morley-miller-prototype.spec.ts`, whose `chooseProposalThroughColleague(page, 0)`
 * takes the default slot 3 and so has been completing this case on `conclude-instrument-broken` — another
 * `never` predicate, so it worked, for a reason nothing had written down.
 *
 * ## So it reuses the production function rather than re-deriving the order
 *
 * `presentColleagueIds` is the layout authority and is imported here, not paraphrased — the same
 * discipline `conclusionReadiness` applies to `configurationKey`: two answers to *"who stands where?"*
 * would drift, and the drift would be a spec clicking a figure that proposes something else while
 * asserting against the conclusion it meant.
 *
 * `phase` decides which beats contribute speakers, because the conclusion board is hosted in
 * `synthesis` **and** `review` and a case may author different speakers for each.
 */
export const colleagueIndexForConclusion = (
    caseId: string,
    proposalId: string,
    phase: 'synthesis' | 'review' = 'synthesis'
): number => {
    const content = caseContent(caseId);
    const proposal = content.conclusionProposals.find(({ id }) => id === proposalId);
    if (!proposal) throw new Error(`${caseId} authors no conclusion proposal ${proposalId}.`);
    const scene = content.scenarioScript.scenes.find((candidate) => candidate.phase === phase);
    if (!scene) throw new Error(`${caseId} authors no ${phase} scene.`);

    const staged = presentColleagueIds({
        proposerIds: content.conclusionProposals.map(({ colleagueId }) => colleagueId),
        speakerIds: (scene.dialogueBeats ?? []).map(({ speakerId }) => speakerId),
        castIds: content.colleagues.map(({ id }) => id),
        authoredCast: scene.cast
    });
    const index = staged.indexOf(proposal.colleagueId);
    if (index < 0) {
        throw new Error(`${caseId} does not stage ${proposal.colleagueId} in ${phase}, so ${proposalId} cannot be chosen there.`);
    }
    return index;
};

export const ARTIFACT_COUNT = artifactCountFor(YOUNG_CASE);

/**
 * The centre of one object on the reading room's shelf, at the count the room actually draws.
 *
 * Lives here rather than in a spec because two specs need it and this module exists so they do not
 * each keep a copy — which is what the 2.8 review found them doing, in the same commit that created
 * this file for that purpose.
 */
export const artifactAt = (index: number, count: number = ARTIFACT_COUNT): Readonly<{ x: number; y: number }> => {
    const centre = libraryArtifactCentre(index, count, DESIGN_WIDTH);
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
 * **Raised from 120 ms at Story 2.12, and joined by a counted frame wait since.** These three helpers
 * wait their tween's own authored duration — honest, because a tween is driven by elapsed time and
 * finishes when it says it will — and then need slack for the update frame its `onComplete` actually
 * lands on. A click issued inside that window is correctly swallowed by an overlay still suppressing the
 * room underneath, and the walk then fails several steps later at a transition with a routing error
 * pointing nowhere near the cause.
 *
 * That slack is a **frame** quantity, and this constant is a millisecond estimate of one: 400 ms was
 * chosen as roughly a doubling of the worst frame observed under the release gate's five workers, which
 * is 24 frames on an idle desktop and less than two on a two-vCPU CI runner rendering this canvas in
 * software. So the helpers now wait this *and* {@link waitForInputToSettle} — the margin keeps covering
 * everything it has always covered, and the counted frames make the wait scale on a host slow enough for
 * the estimate to have stopped being true.
 *
 * Kept rather than replaced by the frame count, deliberately. A margin measured under real contention is
 * evidence about more than one frame's length, and the ~1.1 s per walk it costs is the cheapest line item
 * in this file.
 */
const ANIMATION_MARGIN_MS = 400;
/**
 * Two frames at 60 FPS, rounded up: what a settle costs a walk on a host that renders at full rate.
 *
 * A **budget** figure only, spent by {@link WALK_TO_DEBRIEF_COST_MS}. The wait itself counts frames
 * rather than milliseconds — see {@link waitForInputToSettle} — so this is the floor of what one costs,
 * not the wait's definition. A slow host spends more and is allowed to: the walk budgets that already
 * carry a retry's worth of slack per step.
 */
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
 *
 * ## Two frames, counted — not 34 ms of wall clock
 *
 * The thing being waited for is a **frame**, and a frame is only 17 ms on a host that renders at full
 * rate. `waitForTimeout(34)` states the intent in the units of a machine fast enough for the number to
 * be true, and stops covering even one frame below ~30 FPS: the next click is then issued before Phaser
 * has applied the change that click depends on, and is silently swallowed. Nothing between here and the
 * next transition can see that happen, so the walk goes on and fails at
 * the first assertion that *can* — the routing gate several steps later, reading exactly like a dead
 * control. That is the shape of the whole class this file keeps closing, and it is why
 * {@link dragDesignUntil}, {@link startTheLightUntilRecorded} and {@link clickUntilScene} exist.
 *
 * Measured against the throttled game loop that reproduces it — `requestAnimationFrame` clamped to a
 * fixed frame length, which is what a two-vCPU CI runner does to this canvas under a serialized suite:
 *
 * | Frame length | `waitForTimeout(34)` | Two counted frames |
 * | --- | --- | --- |
 * | 50 ms (20 FPS) | walk passes | walk passes |
 * | 70 ms (14 FPS) | **the CI failure verbatim** — `case.debriefCompleted` never lands, `Debrief` never routed | walk passes |
 * | 120 ms (8 FPS) | fails earlier still, in the colleague conversation | walk passes |
 *
 * Counting frames costs a fast host nothing — two frames at 60 FPS *is* the 34 ms this replaces — and
 * scales on a slow one instead of expiring on it.
 *
 * No ceiling on the wait, deliberately. A host whose frames have stopped is a host where Phaser has
 * stopped, and a fallback would hand that back a walk that fails somewhere else for the original
 * reason; the test timeout is the honest place for it to surface.
 */
export const waitForInputToSettle = async (page: Page): Promise<void> => {
    await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
};

export const waitForBookToOpen = async (page: Page): Promise<void> => {
    await page.waitForTimeout(BOOK_OPEN_MS + ANIMATION_MARGIN_MS);
    await waitForInputToSettle(page);
};

export const waitForPageTurn = async (page: Page): Promise<void> => {
    await page.waitForTimeout(BOOK_TURN_MS + ANIMATION_MARGIN_MS);
    await waitForInputToSettle(page);
};

export const waitForBookToClose = async (page: Page): Promise<void> => {
    await page.waitForTimeout(BOOK_CLOSE_FADE_MS + ANIMATION_MARGIN_MS);
    await waitForInputToSettle(page);
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
 * The neutral auto-summary (FR23, Story 3.1) — the one section whose text is **authored case content**
 * rather than a translation key, filled from the player's own evidence by `composeCaseSummary`.
 *
 * Asserted here rather than in a unit test because the section needs a DOM to exist, and the unit suite
 * has no DOM environment configured (adding jsdom would be a new dependency). The composer itself is
 * unit-tested directly in `CaseSummary.test.ts`; what this reaches is AC5's *reachable* clause — that the
 * authored field is not shipped-and-dead.
 */
export const recordedAutoSummary = (page: Page) =>
    printSection(page, en['print.summary.heading']).locator('p');

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
 * Every reviewed revision the record carries, with the peer feedback each one was given.
 *
 * `print.history.item` composes the feedback through `localizedFeedback`, which resolves each issue by
 * `ruleId`, so a revision's row is the record's own account of what the reviewers actually said. That
 * makes it the honest way to observe a peer-review answer from a spec: it reads a shipped surface
 * (FR11, mounted on every normal-route session) rather than a hook added to make a test pass.
 *
 * Added by Story 4.3's code review, which found four screenshot tests capturing the peer-review pane
 * with **nothing** asserting the pane had answered — a missed advance click leaves the phase at
 * `synthesis`, `peerReview.requested` is refused, the pane paints empty, and every capture still passed
 * green while writing a PNG named "two issues standing".
 */
export const recordedRevisions = (page: Page) =>
    printSection(page, en['print.history.heading']).locator('ol > li')
        .filter({ hasNotText: en['print.history.empty'] })
        .filter({ hasNotText: fr['print.history.empty'] });

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
 * What the record says the player has chosen — the prediction on the first board, the conclusion on the
 * theory board.
 *
 * The shape is {@link recordedSetting}'s: the section by its own heading, then the row by its `dt`, then
 * that row's `dd`. Filtered by the term rather than taken as the section's only definition, because the
 * conclusion section carries **two** rows — conclusion and stated limitation — and `getByRole` over the
 * section would resolve to both and match the wrong one the day their order changes.
 *
 * Both bundles, because three specs run under a French browser and the record is localized.
 */
const recordedChoice = (page: Page, kind: 'prediction' | 'conclusion') => {
    const bothBundles = (key: keyof typeof en & keyof typeof fr) =>
        new RegExp(`^(${escapeForRegExp(en[key])}|${escapeForRegExp(fr[key])})$`);
    return printSection(page, en[`print.${kind}.heading`])
        .locator('div')
        .filter({ has: page.getByRole('term').filter({ hasText: bothBundles(`print.${kind}.term`) }) })
        .getByRole('definition');
};

/** The placeholder that row holds until something has actually been chosen, in either bundle. */
const noChoiceRecorded = (kind: 'prediction' | 'conclusion') =>
    new RegExp(`^(${escapeForRegExp(en[`print.${kind}.empty`])}|${escapeForRegExp(fr[`print.${kind}.empty`])})$`);

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
     *
     * **Left at five deliberately, and measured rather than argued.** Widening it to 15 s looked like
     * the same fix as {@link waitForInputToSettle}'s and is not: every attempt in here now waits real
     * frames, so on a host slow enough to need more attempts the bound also buys fewer of them, and a
     * step that was going to fail spends the whole budget failing. Under a container throttled well
     * below the CI runner it turned near-misses into walks that overran their own `test.setTimeout`,
     * which is a worse failure than the one it was meant to fix. What made the slow host pass was
     * waiting on frames and asserting each step's effect, not a longer clock.
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

/**
 * The instrument a walk turns, and everything needed to drive and observe it — derived per case.
 *
 * Every value here used to be a Young constant. They are the *same derivations*, parameterised by case
 * ID and control ID (Story 3.2): the bench gives one slot per authored control in authored order, so a
 * case listing its controls the other way round would put the drag on the wrong instrument — and the run
 * would still record, and the walk would still reach the theory board, and the spec would pass having
 * varied the wrong thing. Deriving is what makes that impossible for *both* cases rather than for one.
 */
export const varyingInstrument = (caseId: string, controlId: string, targetValue?: number) => {
    const controls = caseContent(caseId).apparatus.primaryControls;
    const slot = controls.findIndex(({ id }) => id === controlId);
    if (slot < 0) throw new Error(`The authored case ${caseId} must carry a ${controlId} control.`);
    const control = controls[slot]!;
    /**
     * Where the drag lands, and what the readout must then say.
     *
     * Defaults to the control's maximum, which is the far end of the travel and the cheapest place to
     * drag to. **A caller must pass `targetValue` when the maximum is not a distinguishing setting.**
     * The prototype's `rotationDeg` runs 0–180 and its model is `cos(2θ)`, period 180°, so the default
     * dragged from 0° to 180° and recorded *the same displacement twice* — two runs the significance
     * gate counted as two configurations (it keys on the control value) while the readings were
     * identical to the last decimal. AC10 asks the walk to record two **distinguishing** runs; it
     * recorded two identical ones, and the unit test that picks a real pair uses 0°/90°
     * (review 2026-08-19).
     *
     * For a **dial** the rule is now enforced rather than written down. Story 3.4's code review found
     * that a caller omitting `targetValue` on a dial dragged to where the dial read its *minimum* — the
     * travel used to alias its ends — and the walk then failed at a readout mismatch pointing nowhere
     * near the cause. The travel is seamed now, so the maximum is genuinely reachable; the refusal
     * stays because the *model* reason above is unchanged, and a prose "a caller must" is not a guard.
     */
    const destination = targetValue ?? control.max;
    if (destination < control.min || destination > control.max) {
        throw new Error(`${controlId} cannot travel to ${destination}: authored range is ${control.min}–${control.max}.`);
    }
    if (targetValue === undefined && controlAffordance(control) === 'dial') {
        throw new Error(
            `${controlId} is drawn as a dial, whose ends sit one detent apart: pass an explicit targetValue `
            + 'so the walk records a distinguishing configuration rather than the far end of the travel.'
        );
    }
    /**
     * Where on the bench the drag has to end, **for the instrument this control is actually drawn as**
     * (Story 3.4).
     *
     * This used to be `knobAngleForFraction` at `KNOB_TRAVEL_RADIUS` unconditionally. The prototype now
     * authors `rotationDeg` as a `dial` and `bathTempC` as a `slider`, so a knob-shaped target would
     * drag to a point on a travel arc that is not painted — the walk would press, move somewhere
     * meaningless, and fail three steps later at a transition with an error pointing nowhere near the
     * cause. Same failure shape as `FIGURE_SLOT_WIDTH`, in a spec helper.
     *
     * Each arm reuses the production conversion rather than restating it, so the point the mouse goes
     * to is the point the instrument reads that value at, by construction.
     */
    const affordance = controlAffordance(control);
    const fraction = (destination - control.min) / (control.max - control.min);
    const centre = knobCentre(slot);
    const travelEnd = ((): Readonly<{ x: number; y: number }> => {
        if (affordance === 'slider') {
            return { x: centre.x + sliderOffsetForValue(control, destination, SLIDER_TRACK_WIDTH), y: centre.y };
        }
        const angle = affordance === 'dial' ? dialAngleForFraction(control, fraction) : knobAngleForFraction(fraction);
        const radius = (affordance === 'dial' ? DIAL_RING_RADIUS : KNOB_TRAVEL_RADIUS) - 6;
        return { x: centre.x + (Math.cos(angle) * radius), y: centre.y + (Math.sin(angle) * radius) };
    })();
    /**
     * Both locales, because these walks run under a French browser too. The authored label and the
     * formatted value both differ — a comma decimal, a translated name — so a walk pinned to the English
     * pair would report a knob that never turned rather than a language it was not written for. That is
     * the shape of failure the 2.11 review recorded twice.
     */
    const readout = (locale: 'en' | 'fr', value: number): string =>
        formatMeasurement(locale, value, decimalPlaces(control.step), control.unit);

    return {
        slot,
        control,
        affordance,
        centre,
        travelEnd,
        /** The reading at {@link destination} — the control's maximum unless the caller named a value. */
        maxReadout: new RegExp(`^(${escapeForRegExp(readout('en', destination))}|${escapeForRegExp(readout('fr', destination))})$`),
        label: new RegExp(`^(${escapeForRegExp(control.label.en)}|${escapeForRegExp(control.label.fr)})$`)
    };
};

const YOUNG_THROW = varyingInstrument(YOUNG_CASE, 'screenDistanceM');

/**
 * The control a case's walk varies, derived from the case's **own authored controls**.
 *
 * `walkToDebrief` took `instrument = YOUNG_THROW`, which its own docstring argued against two parameters
 * earlier: it made `caseId` and `conclusionProposalId` required precisely because "a default is where a
 * Young assumption survives a review". `walkToDebrief(page, someOtherCase, someConclusion)` therefore
 * compiled and dragged `screenDistanceM` — a control the other case does not author — failing several
 * steps later at a readout that never moved, which Story 4.3's debug log records losing time to.
 *
 * Derived from `primaryControls` rather than keyed by case id, because a case-id map would restate the
 * constants the code review of 4.1 deleted `MORLEY_MILLER_CASE` for. The order is the preference, not a
 * ranking of physics: a rotating interferometer's orientation is the control its walk must move, and a
 * double slit's throw is its equivalent. `rotationDeg` takes an explicit 90 because that parameter has
 * one usable setting and the derived default would land elsewhere; `screenDistanceM` derives its own,
 * which is why `YOUNG_THROW` passes no third argument.
 *
 * A case authoring neither throws at its first walk, which is a clear error rather than a silent drag on
 * a control it does not have.
 */
const varyingInstrumentFor = (caseId: string): ReturnType<typeof varyingInstrument> => {
    const authored = new Set(caseContent(caseId).apparatus.primaryControls.map(({ id }) => id));
    if (authored.has('rotationDeg')) return varyingInstrument(caseId, 'rotationDeg', 90);
    if (authored.has('screenDistanceM')) return varyingInstrument(caseId, 'screenDistanceM');
    throw new Error(`The case ${caseId} authors neither rotationDeg nor screenDistanceM to vary.`);
};
const SCREEN_DISTANCE_SLOT = YOUNG_THROW.slot;
const FURTHEST_THROW_READOUT = YOUNG_THROW.maxReadout;
const SCREEN_DISTANCE_LABEL = YOUNG_THROW.label;
const SCREEN_DISTANCE_TRAVEL_END = YOUNG_THROW.travelEnd;

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
const readTheReferences = async (page: Page, caseId: string = YOUNG_CASE): Promise<void> => {
    await expectActiveScene(page, 'Library');
    const count = artifactCountFor(caseId);
    for (let index = 0; index < count; index += 1) {
        await expect(async () => {
            await clickDesign(page, artifactAt(index, count));
            await waitForBookToOpen(page);
            await clickDesign(page, bookCloseControlCentre());
            await waitForBookToClose(page);
            await expect(recordedSources(page)).toHaveCount(index + 1, { timeout: 1_000 });
        }).toPass({ timeout: 15_000, intervals: [150, 300, 600, 900] });
    }
    await clickUntilScene(page, libraryAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT), 'Colleagues');
};

/**
 * Reads the colleague's conversation out, opens that colleague, and adopts what they propose.
 *
 * **Retried until the record carries the choice**, which is the rule the rest of this walk already
 * follows and the reason it is not six bare clicks any more. The sequence has no observable step of its
 * own: `ColleagueRenderer.openColleague` returns silently unless `DialogueBox.isComplete()`, so a single
 * swallowed acknowledgement click leaves the figure inert, the detail panel unopened and nothing chosen —
 * and the walk goes on to a board whose advance is then *correctly* refused. That is exactly how the six
 * specs that fail on a two-vCPU runner failed: every one of them at a transition **out of** the theory
 * board — five at `case.debriefCompleted`, one at the conclusion the rival lab answers — and none of them
 * anywhere near the click that was actually lost.
 *
 * Every click in it is idempotent, which is what makes retrying honest rather than a way to get a green:
 * acknowledgements past the last beat are no-ops, re-opening the same colleague re-draws the same panel,
 * and adopting the same proposal twice records it once. The condition is the record's own projection of
 * the store, the loop is bounded, and a stage that never accepts a choice still fails — here, where the
 * cause is, rather than three transitions later.
 *
 * Which board it is standing on decides which row of the record answers: the first meeting records a
 * prediction, the theory board a conclusion. Read from the router rather than passed in, so no caller
 * can hand it the wrong one.
 */
/**
 * Where the dialogue panel's acknowledgement control actually is, on **this host's** fonts.
 *
 * ## Why this cannot be a constant
 *
 * `ColleagueRenderer.dialogueTop()` is `max(DIALOGUE_TOP, HEADING_Y + heading.height + HEADING_GAP)` —
 * the panel is placed under the heading's **measured** bottom, which is what stops a heading that wraps
 * from being drawn over the conversation. So the panel's top, and with it the 26px control inside it, is
 * a function of how many lines the heading takes; and that is a **font** question, not a layout one.
 * `BOARD_HEADING_WRAP` is 504px and the English conclusion heading measures within a few percent of it,
 * so it is one line on one host's font stack and two on another's — the two boards differ only in that
 * one string, which is why the first meeting was never affected and the theory board always was.
 *
 * That is the defect behind the six specs that failed on CI while passing on every developer machine:
 * `ColleagueRenderer.boardDialogueAdvanceControlCentre` answers for a one-line heading, the runner drew
 * two, every
 * acknowledgement click landed on empty board above the panel, the conversation stayed unfinished,
 * `openColleague` correctly refused to hand over a stage whose conversation was still running, and no
 * conclusion was ever chosen. Retrying could not help: nothing about it was intermittent.
 *
 * ## What this does instead
 *
 * Measures the heading the way `french-typography.spec.ts` measures every other bound —
 * `CanvasRenderingContext2D.measureText` through the same font stack Phaser draws with, wrapped by the
 * same greedy rule — and derives the top from the line count that measurement gives. Every number comes
 * from the board: {@link HEADING_Y}, {@link HEADING_GAP}, {@link BOARD_HEADING_WRAP},
 * {@link BOARD_HEADING_FONT_SIZE} and {@link DIALOGUE_TOP} are the renderer's own, and the control's
 * offset inside the panel is {@link dialogueAdvanceControlCentre}, the widget's own.
 *
 * The one thing measurement cannot give is Phaser's per-line height, which comes from font metrics the
 * canvas API does not expose the same way. A nominal 1.2 × font size is used, and the tolerance is what
 * makes that safe rather than lucky: at 25px the candidate y is wrong by `2 × (real − nominal)`, and the
 * control is 26px tall, so any real line height from 27px to 36px still lands inside it. A host outside
 * that range fails loudly at the choice, in this helper, rather than three transitions later.
 */
const boardDialogueAdvanceControlAims = async (page: Page): Promise<readonly Readonly<{ x: number; y: number }>[]> => {
    // The heading of the board being stood on, in the bundle the browser actually resolved.
    const bundle = await page.locator('html').getAttribute('lang') === 'fr' ? fr : en;
    const heading = await activeScene(page) === 'Colleagues'
        ? bundle['colleagues.heading']
        : bundle['theoryBoard.heading'];
    const headingLines = await page.evaluate(({ text, font, fontSize, wrap }) => {
        const context = document.createElement('canvas').getContext('2d');
        if (!context) throw new Error('Canvas 2D is unavailable.');
        context.font = `${fontSize}px ${font}`;
        // Phaser's basic word wrap: greedy, break between words, never mid-word.
        let lines = 1;
        let current = '';
        for (const word of text.split(/\s+/).filter(Boolean)) {
            const candidate = current ? `${current} ${word}` : word;
            if (current && context.measureText(candidate).width > wrap) {
                lines += 1;
                current = word;
            } else {
                current = candidate;
            }
        }
        return lines;
    }, {
        text: heading,
        font: UI_FONT_STACK,
        fontSize: BOARD_HEADING_FONT_SIZE,
        wrap: BOARD_HEADING_WRAP
    });
    const nominalLineHeight = BOARD_HEADING_FONT_SIZE * 1.2;
    const aimFor = (lines: number) => dialogueAdvanceControlCentre({
        x: PROPOSAL_SURFACE_LEFT,
        y: Math.max(DIALOGUE_TOP, HEADING_Y + (lines * nominalLineHeight) + HEADING_GAP),
        width: DIALOGUE_PANEL_WIDTH
    });
    // The measurement's answer first, then the other line count the heading could have taken. The
    // fallback is what makes the nominal line height above a *tolerance* rather than a bet: the caller
    // retries, and the second attempt aims at the layout the first one ruled out. Aiming at the wrong
    // one is inert either way — a heading line above the control is empty board beside the heading, and
    // one below it is the panel's own body text; neither is interactive.
    return headingLines > 1 ? [aimFor(2), aimFor(1)] : [aimFor(1), aimFor(2)];
};

export const chooseProposalThroughColleague = async (
    page: Page,
    dialogueBeatCount: number,
    colleagueIndex: number = 3
): Promise<void> => {
    const kind = await activeScene(page) === 'Colleagues' ? 'prediction' : 'conclusion';
    const aims = await boardDialogueAdvanceControlAims(page);
    let attempt = 0;
    await expect(async () => {
        // The last authored line needs one final acknowledgement click before `DialogueBox` marks the
        // conversation complete and the colleague stage receives input.
        const acknowledge = aims[attempt % aims.length]!;
        attempt += 1;
        for (let beat = 0; beat <= dialogueBeatCount; beat += 1) {
            await clickDesign(page, acknowledge);
            await waitForInputToSettle(page);
        }
        await clickDesign(page, colleagueFigureProbe(colleagueIndex));
        await waitForInputToSettle(page);
        await clickDesign(page, proposalDetailPanelProbe(DESIGN_HEIGHT));
        await expect(recordedChoice(page, kind)).not.toHaveText(noChoiceRecorded(kind), { timeout: 1_000 });
    }).toPass({ timeout: 20_000, intervals: [200, 400, 800, 1_200] });
};

/**
 * Chooses an attributed prediction and moves to the bench. `prediction → experiment`.
 *
 * The beat count comes from the case (Story 4.3): it was `3`, which is Young's, and the prototype walk
 * survived the mismatch only on the retry inside `chooseProposalThroughColleague`.
 */
const chooseThePrediction = async (page: Page, caseId: string): Promise<void> => {
    await chooseProposalThroughColleague(page, dialogueBeatCountFor(caseId, 'prediction'));
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
const recordTwoObservations = async (
    page: Page,
    instrument: ReturnType<typeof varyingInstrument> = YOUNG_THROW
): Promise<void> => {
    await startTheLightUntilRecorded(page, startTheLightControlCentre(), 1);
    await dragDesignUntil(page, instrument.centre, instrument.travelEnd, async () => {
        await expect(recordedSetting(page, instrument.label))
            .toHaveText(instrument.maxReadout, { timeout: 1_500 });
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
export const pinTheSupport = async (
    page: Page,
    /** Which investigation is being walked — the beat count and the artifact count both come from it. */
    caseId: string,
    /**
     * Which conclusion to adopt, by authored id.
     *
     * **Required, and named rather than defaulted**, for the reason the code review of 4.1 gave when it
     * made `gotoCase`'s `caseId` required: a default is where a Young assumption survives a review. The
     * seat the figure sits in is resolved from the case by {@link colleagueIndexForConclusion}, so a spec
     * says *which conclusion* and never *which position*.
     */
    conclusionProposalId: string
): Promise<void> => {
    await chooseProposalThroughColleague(
        page,
        dialogueBeatCountFor(caseId, 'synthesis'),
        colleagueIndexForConclusion(caseId, conclusionProposalId)
    );
    await inTheCaseFile(page, async () => {
        for (let index = 0; index < 2; index += 1) {
            await clickDesign(page, caseFileObservationPinCentre(index, DESIGN_WIDTH));
            await waitForInputToSettle(page);
        }
        for (let index = 0; index < artifactCountFor(caseId); index += 1) {
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

export const walkToTheBoard = async (
    page: Page,
    /**
     * Which investigation to walk. Defaults to Young, so every existing caller is unchanged; the review
     * route (`?case=`) is what lets a second case be walked at all (Story 3.2, AC4).
     */
    caseId: string = YOUNG_CASE,
    /** Which instrument the second observation turns — the case's own distinguishing control. */
    instrument: ReturnType<typeof varyingInstrument> = YOUNG_THROW
): Promise<void> => {
    await gotoCase(page, caseId);
    // The app booted, and the gate is passed, before we start clicking. A precondition belongs where the
    // precondition is: this assertion used to sit *after* the whole walk in `canvas-transitions.spec.ts`,
    // where it checked an incidental fact about a still-mounted DOM shell and let a boot failure surface
    // several frames of noise later, at the first `expectActiveScene` (2.11 review).
    await enterTheLaboratory(page);
    await readTheReferences(page, caseId);
    await chooseThePrediction(page, caseId);
    await recordTwoObservations(page, instrument);
};

/**
 * The whole walk. Opens a named case and leaves the player standing in its debrief.
 *
 * Every step is a canvas click; **no DOM control is driven anywhere in it**, which is what Story 2.11
 * closes and what Story 2.12's completion check asks for.
 *
 * ## `caseId` and `conclusionProposalId` are required, and that is the point (Story 4.3, AC4)
 *
 * This was `walkToDebrief(page)` calling `walkToTheBoard(page)` with no case id, so it was Young, always
 * — while `walkToTheBoard` itself has been case-parameterised since Story 3.2. `pinTheSupport` and
 * `closeTheCase` were module-private besides, so **no spec could reach a second case's debrief through
 * this module at all**, which is why the code review of 4.1 verified that story's AC3/AC4 on the reading
 * room and the case file and left the debrief unphotographed.
 *
 * Both parameters are required for the reason that review gave when it made `gotoCase`'s `caseId`
 * required at seventeen sites: with a default, every caller passes nothing, and the implicit-Young
 * binding simply moves from the call site into the signature. Naming the conclusion also removes the
 * seat literal — `colleagueIndex = 3` meant `samuel-hart` on Young and `nils-abrahamsen` here, two
 * different conclusions from one number.
 *
 * `instrument` keeps its Young default because it is the *second observation's* control and
 * `walkToTheBoard` already defaults it the same way; a case whose bench differs passes its own, as
 * `morley-miller-prototype.spec.ts` does.
 *
 * **Note what this walk does on Young, unchanged and deliberately so.** Young's existing callers name
 * `conclusion-universal-optics`, whose `supportPredicate` is `never` — so the Young walk completes the
 * case on a conclusion the evidence does not defend, exactly as it has since Story 2.11. That is
 * out of scope here (it is Young content plus a version bump) and is recorded in `deferred-work.md`
 * rather than quietly changed under four specs that assert against today's behaviour.
 */
export const walkToDebrief = async (
    page: Page,
    caseId: string,
    conclusionProposalId: string,
    instrument: ReturnType<typeof varyingInstrument> = varyingInstrumentFor(caseId)
): Promise<void> => {
    await walkToTheBoard(page, caseId, instrument);
    await pinTheSupport(page, caseId, conclusionProposalId);
    await closeTheCase(page);
};
