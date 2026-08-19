import type { Scene } from 'phaser';

import type { PhaserStoreAdapter } from '../PhaserStoreAdapter';
import { uiTextStyle } from '../textStyles';
import type { AppState } from '../../../core/store/AppState';
import { formatRecordedValue } from '../../../core/i18n/formatNumber';
import { createTranslator, type Translator } from '../../../core/i18n/translate';
import {
    selectAdvancedWavelengthUnlocked,
    selectCasePhase,
    selectControlLabel,
    selectFormattedControlValue,
    selectLocale,
    selectLocalizedColleagueHint,
    selectLocalizedError,
    selectContextualArtifacts,
    selectSignificantMeasureGate,
    selectWavelengthChoices
} from '../../../core/store/selectors';
import { resolveLocalizedText } from '../../../core/i18n/resolveLocalizedText';
import { isSourceEligibleForInspection, type ContextualArtifact, type PrimaryControl } from '../../../domain/cases/CaseDefinition';
import { interferenceIntensity, rgbToInt, wavelengthToRgb } from '../../../domain/apparatus/opticalVisualModel';
import { AdvanceControl } from '../ui/AdvanceControl';
import {
    ADVANCE_CONTROL_Y,
    REVISIT_CONTROL_Y,
    BENCH_CONTROL_FONT_SIZE,
    BENCH_CONTROL_HEIGHT,
    BENCH_CONTROL_ROW_Y,
    BENCH_LEFT,
    BENCH_MESSAGE_BOTTOM_Y,
    BENCH_MESSAGE_FONT_SIZE,
    BENCH_MESSAGE_GAP,
    RESULT_READOUT_CEILING_Y,
    RESULT_READOUT_GAP,
    BENCH_MESSAGE_WRAP,
    CENTRE_Y,
    HINT_BOTTOM_MARGIN,
    HINT_LINE_FONT_SIZE,
    HINT_PADDING,
    HINT_SPEAKER_FONT_SIZE,
    HINT_SPEAKER_GAP,
    HINT_TEXT_WRAP,
    BENCH_CONTROL_LABEL_WRAP,
    BENCH_CONTROL_WIDTH,
    NOTEBOOK_CONTROL_LEFT,
    RESET_CONTROL_LEFT,
    REFERENCE_CONTROL_FONT_SIZE,
    REFERENCE_CONTROL_GAP,
    REFERENCE_CONTROL_LABEL_WRAP,
    REFERENCE_CONTROL_PADDING,
    REFERENCE_HEADING_FONT_SIZE,
    REFERENCE_HEADING_GAP_BELOW,
    REFERENCE_HEADING_Y,
    SCREEN_HALF_HEIGHT,
    SCREEN_LABEL_Y,
    SIDE_COLUMN_LEFT,
    SIDE_COLUMN_WIDTH,
    START_CONTROL_LEFT,
    referenceShelfFloor,
    screenXForDistance
} from './apparatusGeometry';
import { ApparatusInstrument } from './ApparatusInstrument';
import { WavelengthChooser } from './WavelengthChooser';
import { advanceTransitionForPhase, revisitTransitionForPhase, resolveAdvanceRefusal, resolveAdvanceView } from './advanceView';
import { SingleKeyDelivery } from './singleKeyDelivery';
import { TransientMessageSlot } from './transientMessage';

const SOURCE_X = 92;
const BARRIER_X = 260;
const FRINGE_STRIP_HALF_WIDTH = 9;
const FRINGE_ROW_STEP = 2;
const WAVEFRONT_RINGS = 6;
const WAVEFRONT_PERIOD_MS = 2600;

const MAX_RESULT_FONT_SIZE = 19;
const MIN_RESULT_FONT_SIZE = 15;

/**
 * The run's three acts, in wall-clock milliseconds (Story 2.10, AC5).
 *
 * **Exported so the e2e spec waits the run out rather than guessing**, which is the rule
 * `BOOK_OPEN_MS` and its siblings set: a literal in a spec silently stops covering the window the day
 * the timing changes, and a click inside the window reaches a locked control and fails looking exactly
 * like a dead one.
 *
 * 2.4s against AC5's three-second bound. The propagation is the part worth the time — it is the scene's
 * one moment of real spectacle (`EXPERIENCE.md` §Feedback) — and the ignition and the resolve are short
 * because a player recording six observations pays this cost six times.
 *
 * Every frame of it is driven by elapsed time, never a frame counter, so it is the same length on a
 * school laptop as on a workstation.
 */
export const RUN_IGNITION_MS = 400;
export const RUN_PROPAGATION_MS = 1500;
export const RUN_RESOLVE_MS = 500;
export const RUN_ANIMATION_MS = RUN_IGNITION_MS + RUN_PROPAGATION_MS + RUN_RESOLVE_MS;

const START_FILL = 0xc2703a;
const START_FILL_RUNNING = 0x6b4326;
const BENCH_CONTROL_FILL = 0x1d4451;

/**
 * **Phaser is imported as a type only, as of Story 2.10.** The two additive `Graphics` used to need
 * `BlendModes` as a *value*, which made this the one renderer no Vitest run could reach — Phaser
 * touches `window` at import time and Vitest runs in Node — and is why `apparatusGeometry.ts` exists.
 * `setBlendMode` accepts the mode's name and resolves it through the same `BlendModes` table
 * internally, so `'ADD'` is the identical mode with no value import, and AC10's reduced-motion test on
 * this renderer becomes writable (`tests/unit/ApparatusRun.test.ts`).
 *
 * `apparatusGeometry.ts` stays where it is regardless: a Playwright spec deriving a click target must
 * not have to construct a renderer to get one, and the geometry / painting split is the same one
 * `libraryGeometry.ts` and `characterStageView.ts` draw.
 *
 * The right-hand column carrying the control that leaves the laboratory and the colleague hint that
 * answers a refusal (Story 2.6, generalized by Story 2.7). Its *placement* lives in
 * `apparatusGeometry.ts` and the control itself in `ui/AdvanceControl.ts`.
 *
 * The control had to exist at all because `src/ui/theory/TheoryBoard.ts` was the only dispatcher of
 * `nextPhase: 'synthesis'` in the codebase, and it is a retired-but-mounted DOM panel. Story 2.7 found
 * the same thing true of five further transitions and gave every phase's scene the same widget, so
 * what is special about the laboratory is now only its column and its authored hint — not the control.
 */

export type ApparatusRendererOptions = Readonly<{
    /**
     * Opens an artifact for **re-reading** at the bench (Story 2.8, AC6).
     *
     * The reference has to stay reachable during `experiment` — that is what the retired always-on
     * `LectureBookScene` was buying, and removing it without replacing the affordance would take the
     * reference away rather than move it. This opens the *scene's own* presenter: an intra-scene call,
     * never a reach into another scene.
     *
     * Reading here dispatches nothing. The record of having read a source is made once, in the reading
     * room; paging and closing at the bench stay ephemeral, as the archival-book rule requires.
     */
    openReference?: (artifact: ContextualArtifact) => boolean;
    /**
     * Opens the bench notebook over the bench (Story 2.10, AC8).
     *
     * The same shape and the same rule as {@link openReference}: the *scene* owns the overlay and
     * suppresses this renderer's own input while it is up, because a click meant for the overlay that
     * fell through would move a slit. Absent means the bench simply draws no notebook control — a
     * control that does nothing is worse than no control at all.
     */
    openNotebook?: () => void;
}>;

/**
 * One control on the bench's reference shelf. Sized to its own label, which is authored content.
 *
 * A `Zone` for input and a shared `Graphics` for the fill, rather than a `Rectangle` doing both.
 * `Zone.setSize(width, height, true)` is the one Phaser API that resizes a hit area along with the
 * object; `Shape.setSize` does not — it throws on a shape whose geometry was built at a different size,
 * and the throw lands inside the store's notify loop, where an escaping error breaks `dispatch`'s
 * `Result` contract and strands the router mid-transition. Found exactly that way.
 */
type ReferenceControl = Readonly<{
    artifactId: string;
    hitArea: Phaser.GameObjects.Zone;
    label: Phaser.GameObjects.Text;
}>;

export class ApparatusRenderer {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private resultReadout?: Phaser.GameObjects.Text;
    private resultReadoutBottomY = 0;
    private visualGuidance?: Phaser.GameObjects.Text;
    private sourceGlow?: Phaser.GameObjects.Arc;
    private sourceCore?: Phaser.GameObjects.Arc;
    private barrier?: Phaser.GameObjects.Rectangle;
    private slitTop?: Phaser.GameObjects.Rectangle;
    private slitBottom?: Phaser.GameObjects.Rectangle;
    private screen?: Phaser.GameObjects.Rectangle;
    private screenLabel?: Phaser.GameObjects.Text;
    private title?: Phaser.GameObjects.Text;
    private guide?: Phaser.GameObjects.Text;
    private sourceLabel?: Phaser.GameObjects.Text;
    private beamGraphics?: Phaser.GameObjects.Graphics;
    private wavefrontGraphics?: Phaser.GameObjects.Graphics;
    private fringeGraphics?: Phaser.GameObjects.Graphics;
    private lastRunId?: string;
    /** The hint panel's measured top from this render pass, so the reference shelf can yield to it. */
    private hintPanelTop?: number;
    private inputEnabled = true;
    /** Story 2.6: the way out of the laboratory, and the colleague who answers a refused attempt. */
    private advanceControl?: AdvanceControl;
    private revisitControl?: AdvanceControl;
    private hintBackground?: Phaser.GameObjects.Rectangle;
    private hintSpeaker?: Phaser.GameObjects.Text;
    private hintLine?: Phaser.GameObjects.Text;

    // --- The bench (Story 2.10) -----------------------------------------------------------------
    private readonly instruments = new Map<PrimaryControl['id'], ApparatusInstrument>();
    private wavelengthChooser?: WavelengthChooser;
    private startSurface?: Phaser.GameObjects.Rectangle;
    private startLabel?: Phaser.GameObjects.Text;
    private notebookSurface?: Phaser.GameObjects.Rectangle;
    private notebookLabel?: Phaser.GameObjects.Text;
    private resetSurface?: Phaser.GameObjects.Rectangle;
    private resetLabel?: Phaser.GameObjects.Text;
    private benchMessage?: Phaser.GameObjects.Text;
    /**
     * Which instrument the arrow keys reach (D4).
     *
     * Renderer-local, because there is no DOM focus on a canvas and this story must not introduce one
     * — §Engine forbids a semantic control mirroring a Phaser gesture. Set by clicking or dragging an
     * instrument, and drawn as a visible ring, which `EXPERIENCE.md` §Controls asks for and without
     * which AC3's "with the knob focused" is unsatisfiable.
     */
    private focusedControlId?: PrimaryControl['id'];
    /**
     * Whether the arrow-key capture is currently held.
     *
     * Tracked rather than inferred because `addCapture`/`removeCapture` are global and idempotent-looking
     * but not free, and because the capture must be released exactly as often as it is taken.
     */
    private arrowKeysCaptured = false;
    /** What `updateBenchInputState` last decided; the one fact `benchInteractive()` reads. */
    private benchInputEnabled = false;
    /**
     * Whether the light is crossing the bench right now.
     *
     * The single fact the animation loop, the input lock and the readout all read. It is ephemeral and
     * renderer-local for the same reason the dialogue reading position is: it means nothing five
     * seconds later, and a store field for it would be persisted, exported, re-validated and reset on
     * replay.
     */
    private runInFlight = false;
    private runElapsedMs = 0;
    /** The recorded spacing the resolved pattern is painted from, or `undefined` when the bench is dark. */
    private recordedSpacingMm?: number;
    /**
     * The localized answer to a refused start or a refused wavelength.
     *
     * Its own slot rather than the advance control's, because they answer different questions — and a
     * `TransientMessageSlot` rather than a bare field, which is the defect Story 2.7 fixed in both
     * renderers at once: a message cleared inside the render that drew it paints once and is erased by
     * the next unrelated repaint.
     */
    private readonly benchError = new TransientMessageSlot<string>();
    /** One handling per physical key press — see {@link SingleKeyDelivery}. */
    private readonly keyDelivery = new SingleKeyDelivery();
    /**
     * Shown beside the hint when a dispatch is refused for a reason the gate has nothing to do with.
     *
     * Held in a slot with an explicit lifetime rather than in a bare field (Story 2.7, AC5): the old
     * field was cleared inside the render that drew it, so the message painted once and any later
     * repaint — a control nudge, the export's own completion notify, the refusal's follow-up render —
     * erased it before the player could read it.
     */
    private readonly transientError = new TransientMessageSlot<string>();
    /**
     * Whether the player has actually asked to leave yet.
     *
     * The hint is drawn only after a refusal, not pre-emptively from the gate state. A colleague who
     * volunteers "you should vary the screen distance" before the player has tried anything is
     * supplying the next step rather than answering a question — which is the line the project rule
     * draws ("hints point at missing evidence… they never supply the answer"). It resets on any state
     * change that could clear the refusal.
     */
    private advanceRefused = false;

    // Live optical geometry, refreshed from store state and consumed by the animation loop.
    private slitTopY = CENTRE_Y - 30;
    private slitBottomY = CENTRE_Y + 30;
    private screenX = 605;
    private bandSpacingPx = 18;
    private currentWavelengthNm = 550;
    private wavelengthColor = rgbToInt(wavelengthToRgb(550));
    private fringeSignature = '';
    private updateBound?: (time: number, delta: number) => void;
    private readonly reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    private motionAllowed = !this.reducedMotionQuery.matches;

    /** The bench's reference shelf (Story 2.8): a heading and one control per authored artifact. */
    private referenceHeading?: Phaser.GameObjects.Text;
    private referenceShelfFills?: Phaser.GameObjects.Graphics;
    private readonly referenceControls: ReferenceControl[] = [];

    /**
     * @param options.openReference Opens an artifact in the *scene's own* reference book. Optional,
     * and absent means the bench simply draws no shelf — a scene that hosts no book must not be made
     * to look as though it does.
     */
    public constructor(
        private readonly scene: Scene,
        private readonly storeAdapter: PhaserStoreAdapter,
        private readonly options: ApparatusRendererOptions = {}
    ) {}

    // Reduced-motion can be toggled at runtime; keep the cached flag and the loop in sync when it changes.
    private readonly onReducedMotionChange = (): void => {
        this.motionAllowed = !this.reducedMotionQuery.matches;
        // Turning `reduce` on mid-run resolves the run immediately rather than stranding it: the
        // record is already made, and the frame the loop was travelling toward is the one to paint.
        if (!this.motionAllowed && this.runInFlight) {
            this.settleRun();
            // **Re-render, exactly as `onUpdate` does when the run resolves on its own**
            // (review 2026-08-07). `settleRun` writes `runInFlight` and detaches the loop; it does not
            // decide input state, the start label or the readout's visibility — `render` is the one place
            // that decides each of them, and this was the only settle path that skipped it. The bench
            // stayed fully locked with the start control reading "Light running…" and the result hidden,
            // and nothing on the bench could produce the dispatch that would have unlocked it.
            this.render(this.storeAdapter.getState());
            return;
        }
        this.syncAnimationLoop();
        this.paintLight();
    };

    /**
     * The light's update loop runs **only while a run is in flight** (ADR-012).
     *
     * It used to register from `create()` and run on `motionAllowed && inputEnabled`, which is the
     * thing §Engine's don't-miss table names in as many words: the apparatus animated unattended, for
     * nobody, against the NFR1 budget. It is not gated on `inputEnabled` either — a reference book
     * opened over a run must not freeze the run, because a recorded run is a fact and not an
     * interaction, and a frozen one would leave the bench locked with nothing to unlock it.
     */
    private syncAnimationLoop(): void {
        const shouldRun = this.motionAllowed && this.runInFlight;
        if (shouldRun && !this.updateBound) {
            this.updateBound = (_time, delta) => this.onUpdate(delta);
            this.scene.events.on('update', this.updateBound, this);
        } else if (!shouldRun && this.updateBound) {
            this.scene.events.off('update', this.updateBound, this);
            this.updateBound = undefined;
        }
    }

    public create(): void {
        // Text is authored empty here and populated by render(): create() runs once, but the language
        // can change at any time, so every string has to come from the store subscription (AC2).
        this.title = this.scene.add.text(40, 28, '', uiTextStyle({ color: '#f7f4ef', fontSize: '24px', wordWrap: { width: 900 } }));
        this.guide = this.scene.add.text(40, 62, '', uiTextStyle({ color: '#c7d7d9', fontSize: '15px', wordWrap: { width: 900 } }));
        this.objects.push(this.title, this.guide);
        this.createRichPattern();
        this.createBench();
        // The readout is bottom-anchored above the bench message, which is itself bottom-anchored above
        // the control row — so a string that needs an extra line grows upward into empty space instead
        // of down over a control. French runs 15–25% longer than English.
        this.resultReadoutBottomY = BENCH_MESSAGE_BOTTOM_Y;
        this.resultReadout = this.scene.add.text(BENCH_LEFT, this.resultReadoutBottomY, '', uiTextStyle({ color: '#f7f4ef', fontSize: `${MAX_RESULT_FONT_SIZE}px`, wordWrap: { width: BENCH_MESSAGE_WRAP } }))
            .setOrigin(0, 1);
        this.objects.push(this.resultReadout);
        this.createSideColumn();
        this.createReferenceShelf();
        // No `resize` listener. It existed only to re-evaluate the sub-768px media query, which Story
        // 2.12 removed (see {@link updateBenchInputState}); input state now depends on nothing outside
        // this renderer, so re-running it on every resize would be work with no input to react to.
        this.updateBenchInputState();

        // No loop registers here. Under reduced motion none ever registers at all, and `render()`
        // paints the resolved frame directly (AC9).
        this.reducedMotionQuery.addEventListener('change', this.onReducedMotionChange);
        this.scene.input.keyboard?.on('keydown', this.onKeyDown, this);
        this.adoptRecordedHistory();
    }

    /**
     * Takes whatever is already recorded as history, so the first `render()` cannot mistake it for a press.
     *
     * The bench is built from a state that may already carry runs — `main.ts` boots through
     * `createAppStateFromCaseRecord`, which restores `runs` alongside the phase, and an import replaces
     * the whole record while the scene is live. Those runs are facts the player made earlier; only a run
     * that appears *after* this line is an ignition. Doing it here rather than with a "have I rendered
     * yet" flag keeps the rule in one place and keeps `render` free of a second kind of first-time state
     * (review 2026-08-07).
     */
    private adoptRecordedHistory(): void {
        const runs = this.storeAdapter.getState().runs;
        this.lastRunId = runs[runs.length - 1]?.id;
    }

    public render(state: AppState): void {
        const locale = selectLocale(state);
        const t = createTranslator(locale);
        this.title?.setText(t('lab.title'));
        this.guide?.setText(t('lab.guide'));
        this.sourceLabel?.setText(t('lab.source'));
        this.screenLabel?.setText(t('lab.screen'));

        const latest = state.runs[state.runs.length - 1];
        const latestMatchesActiveSetup = latest?.modelInputs
            && latest.modelInputs.slitSpacingMm === state.activeControlValues.slitSpacingMm
            && latest.modelInputs.screenDistanceM === state.activeControlValues.screenDistanceM
            && latest.modelInputs.wavelengthNm === state.selectedWavelengthNm
            && latest.modelInputs.wavelengthMode === state.selectedWavelengthMode;

        // AC5: the ignition is triggered by the recorded fact, never by the press — so the animation is
        // driven by what was saved rather than racing it, and a refusal has no spectacle to unwind.
        //
        // **`isNewRun` means "recorded since this bench was built"**, which `create()` establishes by
        // adopting whatever was already there — see {@link adoptRecordedHistory} (review 2026-08-07).
        // `lastRunId` used to start `undefined`, so the bare comparison also fired on the *first* render,
        // and `main.ts` boots from the persisted record, which restores `runs` along with the phase. A
        // player reloading mid-investigation arrived at a bench that ignited, propagated and locked every
        // control for 2.4 s for a run they had recorded in a previous session: ADR-012's loop gated on
        // scene lifecycle rather than on a player-initiated run, and AC4's dark idle broken on arrival.
        //
        // `modelInputs` is the second half. It is optional on `RunRecord` and a legacy or imported record
        // may carry none; `recordedSpacingMm` below already requires it, so a run without one animated a
        // full ignition that resolved onto a `fringeGraphics` nothing had filled — an empty screen at the
        // end of a locked 2.4 s. The two facts now derive from one condition instead of disagreeing.
        //
        const isNewRun = latest !== undefined && latest.id !== this.lastRunId && latest.modelInputs !== undefined;
        this.lastRunId = latest?.id;
        if (isNewRun) this.beginRun();

        // AC6: the recorded value only paints while it still describes the bench in front of the
        // player. `latestMatchesActiveSetup` is the same condition the stale readout uses — one rule.
        this.recordedSpacingMm = latestMatchesActiveSetup ? latest?.result.value : undefined;

        this.renderBench(state, t);
        this.renderApparatusGeometry(state);
        this.renderReadouts(state, t, latest, Boolean(latestMatchesActiveSetup));
        this.renderSideColumn(state, t);
        this.renderReferenceShelf(state, t);
        this.paintLight();
    }

    public destroy(): void {
        this.reducedMotionQuery.removeEventListener('change', this.onReducedMotionChange);
        // A `keydown` listener on `scene.input.keyboard` outlives this renderer if it is not removed,
        // and so does the arrow-key capture, which would go on swallowing page scrolling.
        this.scene.input.keyboard?.off('keydown', this.onKeyDown, this);
        this.scene.input.keyboard?.removeCapture(ARROW_KEY_CAPTURE);
        if (this.updateBound) this.scene.events.off('update', this.updateBound, this);
        this.updateBound = undefined;
        // Kill every tween this renderer can start — including any whose target is the renderer itself
        // — so nothing writes to torn-down objects after destroy.
        this.scene.tweens.killTweensOf(this);
        this.scene.tweens.killTweensOf([this.sourceGlow, this.sourceCore, this.resultReadout].filter(Boolean) as Phaser.GameObjects.GameObject[]);
        // Each widget owns its own objects and listeners, so it releases them itself.
        this.advanceControl?.destroy();
        this.revisitControl?.destroy();
        this.instruments.forEach((instrument) => instrument.destroy());
        this.instruments.clear();
        this.wavelengthChooser?.destroy();
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.title = undefined; this.guide = undefined; this.sourceLabel = undefined;
        this.resultReadout = undefined; this.visualGuidance = undefined; this.slitTop = undefined; this.slitBottom = undefined; this.screen = undefined; this.screenLabel = undefined;
        this.sourceGlow = undefined; this.sourceCore = undefined; this.barrier = undefined;
        this.beamGraphics = undefined; this.wavefrontGraphics = undefined; this.fringeGraphics = undefined;
        this.advanceControl = undefined; this.revisitControl = undefined; this.wavelengthChooser = undefined;
        this.startSurface = undefined; this.startLabel = undefined;
        this.notebookSurface = undefined; this.notebookLabel = undefined; this.benchMessage = undefined;
        this.resetSurface = undefined; this.resetLabel = undefined;
        this.hintBackground = undefined; this.hintSpeaker = undefined; this.hintLine = undefined;
        this.referenceHeading = undefined; this.referenceShelfFills = undefined; this.referenceControls.length = 0; this.hintPanelTop = undefined;
        this.advanceRefused = false; this.transientError.clear(); this.benchError.clear();
        this.focusedControlId = undefined; this.arrowKeysCaptured = false; this.benchInputEnabled = false;
        this.runInFlight = false; this.runElapsedMs = 0; this.recordedSpacingMm = undefined;
        this.lastRunId = undefined; this.fringeSignature = '';
    }

    /** An overlay temporarily owns pointer interaction without changing laboratory state. */
    public setInputEnabled(enabled: boolean): void {
        this.inputEnabled = enabled;
        this.updateBenchInputState();
    }

    // --- The bench ------------------------------------------------------------------------------

    private createBench(): void {
        const state = this.storeAdapter.getState();
        state.caseDefinition.apparatus.primaryControls.forEach((control, index) => {
            const instrument = new ApparatusInstrument(this.scene, {
                index,
                control,
                // The renderer never mutates state: the instrument reports, this dispatches (AC2).
                // The refusal goes back to the instrument so it can drop the value it optimistically
                // recorded, and to the player so a control that declined is not indistinguishable from
                // a dead one.
                onValueChange: (value) => {
                    const result = this.storeAdapter.setControlValue(control.id, value);
                    if (!result.ok) this.refuse(result.error);
                    return result.ok;
                },
                onFocus: () => this.focusInstrument(control.id)
            });
            instrument.create();
            this.instruments.set(control.id, instrument);
        });

        const choices = selectWavelengthChoices(state);
        if (choices.length > 0) {
            this.wavelengthChooser = new WavelengthChooser(this.scene, choices, {
                onChoose: (wavelengthNm) => this.chooseWavelength(wavelengthNm)
            });
            this.wavelengthChooser.create();
        }

        [this.startSurface, this.startLabel] = this.benchControl(START_CONTROL_LEFT, START_FILL, '#10252c',
            () => this.startTheLight());

        if (this.options.openNotebook) {
            [this.notebookSurface, this.notebookLabel] = this.benchControl(
                NOTEBOOK_CONTROL_LEFT, BENCH_CONTROL_FILL, '#f7f4ef', () => this.options.openNotebook?.());
        }

        // The way back to the authored setup (Story 2.12, D3). Unconditional, unlike the notebook: it
        // needs no host collaboration, and Story 2.2's "reset is immediate" acceptance criterion is
        // shipped and `done` — a bench without it leaves that criterion satisfied by nothing.
        [this.resetSurface, this.resetLabel] = this.benchControl(
            RESET_CONTROL_LEFT, BENCH_CONTROL_FILL, '#f7f4ef', () => this.resetApparatus());

        // Bottom-anchored for the same reason the colleague hint is: a localized refusal is a sentence,
        // French runs longer, and this surface does not scroll — so it grows upward into empty space.
        this.benchMessage = this.scene.add.text(BENCH_LEFT, BENCH_MESSAGE_BOTTOM_Y, '', uiTextStyle({
            color: '#f4d35e', fontSize: `${BENCH_MESSAGE_FONT_SIZE}px`, wordWrap: { width: BENCH_MESSAGE_WRAP }
        })).setOrigin(0, 1);
        this.objects.push(this.benchMessage);
    }

    /**
     * One surface-and-label pair in the bench's control row.
     *
     * Extracted when the row went from two controls to three (Story 2.12): three inline copies of the
     * same eight lines is three places for a wrap bound or a row `y` to drift, and the row is now
     * divided from one width by {@link benchControlLeft} rather than from three literals.
     */
    private benchControl(
        left: number,
        fill: number,
        labelColor: string,
        onPress: () => void
    ): [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Text] {
        const surface = this.scene.add
            .rectangle(left, BENCH_CONTROL_ROW_Y, BENCH_CONTROL_WIDTH, BENCH_CONTROL_HEIGHT, fill)
            .setOrigin(0, 0);
        // Authored empty and written in `render`: `create()` runs once and the locale can change.
        const label = this.scene.add.text(
            left + (BENCH_CONTROL_WIDTH / 2),
            BENCH_CONTROL_ROW_Y + (BENCH_CONTROL_HEIGHT / 2),
            '',
            uiTextStyle({
                color: labelColor,
                fontSize: `${BENCH_CONTROL_FONT_SIZE}px`,
                align: 'center',
                wordWrap: { width: BENCH_CONTROL_LABEL_WRAP }
            })
        ).setOrigin(0.5, 0.5);
        surface.on('pointerup', onPress);
        this.objects.push(surface, label);
        return [surface, label];
    }

    private renderBench(state: AppState, t: Translator): void {
        state.caseDefinition.apparatus.primaryControls.forEach((control) => {
            this.instruments.get(control.id)?.render({
                value: state.activeControlValues[control.id],
                readout: t('lab.control.readout', {
                    label: selectControlLabel(state, control.id),
                    value: selectFormattedControlValue(state, control.id)
                }),
                decreaseLabel: t('lab.control.decrease'),
                increaseLabel: t('lab.control.increase'),
                focused: this.focusedControlId === control.id
            });
        });

        const unlocked = selectAdvancedWavelengthUnlocked(state);
        this.wavelengthChooser?.render({
            heading: t('lab.wavelength.heading'),
            choices: selectWavelengthChoices(state).map(({ wavelengthNm, mode }) => {
                const locked = mode === 'advanced' && !unlocked;
                return {
                    wavelengthNm,
                    label: t(mode === 'minimum'
                        ? 'lab.wavelength.fixed'
                        : locked ? 'lab.wavelength.comparisonLocked' : 'lab.wavelength.comparison',
                    { value: wavelengthNm }),
                    selected: state.selectedWavelengthNm === wavelengthNm,
                    locked
                };
            })
        });

        this.startLabel?.setText(this.runInFlight ? t('lab.start.running') : t('lab.start'));
        this.startSurface?.setFillStyle(this.runInFlight ? START_FILL_RUNNING : START_FILL);
        this.notebookLabel?.setText(t('lab.notebook.open'));
        this.resetLabel?.setText(t('lab.reset'));
        this.updateBenchInputState();
    }

    /**
     * Asks for the light, and answers a refusal.
     *
     * **One register, and that is stated rather than assumed.** `resolveAdvanceRefusal` splits a
     * refusal between the authored colleague line and the localized error, and the two codes a
     * colleague speaks for — `significant-measures-required` and `missing-contextual-sources` — gate
     * the way *out* of the laboratory, not the light. Everything `experiment.run` can refuse with
     * (`experiment-phase-required`, `advanced-wavelength-locked`, `invalid-young-model-input`,
     * `progress-operation-active`) is a fact about the apparatus, and a colleague appearing to have
     * explained one would be attributing a sentence to somebody who did not say it.
     */
    private startTheLight(): void {
        if (!this.benchInteractive()) return;
        const result = this.storeAdapter.runExperiment();
        if (result.ok) return;
        this.refuse(result.error);
    }

    /**
     * Chooses an authored wavelength, and does nothing at all for the one already selected.
     *
     * **The equality guard is load-bearing, not an optimization** (review 2026-08-07).
     * `reduceWavelengthSet` short-circuits 550 nm to an unconditional success that mints a new frozen
     * state and clears `consultation`, `peerReview` and `rivalLabCritique` — so a click on the chip that
     * is *already* selected discarded a live colleague consultation and, because `transientMessage.ts`
     * anchors on state object identity, expired both message slots. The player lost the hint or the
     * refusal they were reading to a click that changed nothing. `NotebookRenderer.toggleSelection`
     * checks the same way before touching the comparison; this is that rule applied here.
     */
    private chooseWavelength(wavelengthNm: 450 | 550 | 650): void {
        if (!this.benchInteractive()) return;
        if (this.storeAdapter.getState().selectedWavelengthNm === wavelengthNm) return;
        const result = this.storeAdapter.setWavelength(wavelengthNm);
        if (result.ok) return;
        this.refuse(result.error);
    }

    /**
     * Puts the apparatus back to its authored setup (Story 2.12, D3 — `apparatus.reset`).
     *
     * **The no-op guard is load-bearing, and it is `chooseWavelength`'s** (review 2026-08-07).
     * `reduceApparatusReset` cannot fail: it mints a new frozen state unconditionally. Because
     * `transientMessage.ts` anchors on state object identity, a press that changes nothing would still
     * expire the bench refusal or the colleague hint the player was reading — the exact defect the
     * already-selected wavelength chip caused for a whole session in 2.10.
     *
     * What it deliberately does **not** do is clear `consultation`, `peerReview` or `rivalLabCritique`,
     * because the reducer does not: Story 2.2's shipped criterion is "reset is immediate and does not
     * erase saved observations", and 2.10 recorded the cost of a control that quietly discarded standing
     * colleague state. The reducer touches control values and the wavelength; this dispatches it and
     * asserts nothing further.
     */
    private resetApparatus(): void {
        if (!this.benchInteractive()) return;
        const state = this.storeAdapter.getState();
        const atDefaults = state.caseDefinition.apparatus.primaryControls
            .every((control) => state.activeControlValues[control.id] === control.defaultValue);
        if (atDefaults && state.selectedWavelengthNm === 550 && state.selectedWavelengthMode === 'minimum') return;
        // `reduceApparatusReset` has no failure branch today, and the refusal is surfaced anyway rather
        // than the `Result` discarded: `createStore` refuses *every* action with
        // `progress-operation-active` while an export or import holds the lock, so this is reachable now
        // that the case file can export and import (Task 2).
        const result = this.storeAdapter.resetApparatus();
        if (!result.ok) this.refuse(result.error);
    }

    private refuse(error: Readonly<{ code: string; message: string }>): void {
        const current = this.storeAdapter.getState();
        // Anchored to the state the refusal happened against: a refused dispatch leaves the state
        // object untouched, so the message survives every repaint until something really changes.
        this.benchError.set(selectLocalizedError(current, error), current);
        this.render(current);
    }

    private focusInstrument(controlId: PrimaryControl['id']): void {
        if (this.focusedControlId === controlId) return;
        this.focusedControlId = controlId;
        this.syncArrowCapture();
        this.render(this.storeAdapter.getState());
    }

    /**
     * Gives up the focus, and with it the arrow keys.
     *
     * Called whenever the bench stops owning the keyboard — the notebook overlay or the reference book
     * opening, a run starting, the phone gate closing the bench. Without it the focus ring stayed lit on
     * an instrument the player had left and the arrow keys kept stepping it from anywhere on the surface.
     */
    private blurInstrument(): void {
        if (this.focusedControlId === undefined) return;
        this.focusedControlId = undefined;
        this.syncArrowCapture();
    }

    /**
     * Holds the arrow-key capture exactly as long as an instrument is focused and can be stepped.
     *
     * **Phaser's captures are global** (`KeyboardManager`: *"keyboard captures are global"*), and
     * `preventDefault` is called only for key codes in that list — so this is the difference between the
     * page scrolling under the canvas and not. Taken on focus and released only in `destroy()`, it
     * swallowed the arrow keys for the rest of the scene's life after one knob click, including while
     * the notebook overlay owned the keyboard: the state Task 3 calls "wrong otherwise"
     * (review 2026-08-07). Driven from one place so the capture cannot outlive its reason.
     */
    private syncArrowCapture(): void {
        const wanted = this.focusedControlId !== undefined && this.benchInteractive();
        if (wanted === this.arrowKeysCaptured) return;
        this.arrowKeysCaptured = wanted;
        if (wanted) this.scene.input.keyboard?.addCapture(ARROW_KEY_CAPTURE);
        else this.scene.input.keyboard?.removeCapture(ARROW_KEY_CAPTURE);
    }

    /**
     * The arrow keys, and the one place that decides whether they reach an instrument.
     *
     * One check rather than three independent guards: the notebook overlay suppresses this renderer's
     * input while its own note field has the keyboard, and a run in flight locks the bench so a control
     * cannot change under a record already being made (AC6).
     */
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        // Phaser can deliver one press twice; a doubled arrow key would move the instrument two
        // authored steps, which is AC3's "exactly one step" broken invisibly. See the guard's header.
        if (!this.keyDelivery.accepts(event)) return;
        if (!this.benchInteractive() || this.focusedControlId === undefined) return;
        const direction = ARROW_STEPS[event.key];
        if (direction === undefined) return;
        this.instruments.get(this.focusedControlId)?.step(direction);
    };

    /**
     * Whether the bench accepts input at all: not suppressed by an overlay, and not mid-run.
     *
     * Reads the flag {@link updateBenchInputState} last computed rather than re-deriving the rule at each
     * call site (review 2026-08-07): two copies meant a change to one would not reach the other, and the
     * copy here read `matchMedia` on every keydown and every start or wavelength press, in a file
     * §Performance holds to no DOM work in a render path. The DOM read is gone with the sub-768px rule
     * itself (Story 2.12, D7); the single-flag discipline it motivated stays, because the run lock still
     * has to be answered the same way in four places. `updateBenchInputState` runs on `create()`, on
     * every `render()` and on `setInputEnabled`, which is every moment the answer can change.
     */
    private benchInteractive(): boolean {
        return this.benchInputEnabled;
    }

    // --- The run --------------------------------------------------------------------------------

    /**
     * The ignition, triggered by a run that has **already been recorded** (D2).
     *
     * Under `reduce` nothing animates and nothing registers: the resolved frame is painted from
     * `render()` and the record is byte-identical to the motion path's, because the record was made
     * before either path was chosen.
     */
    private beginRun(): void {
        this.runElapsedMs = 0;
        this.runInFlight = this.motionAllowed;
        this.syncAnimationLoop();
    }

    private settleRun(): void {
        this.runInFlight = false;
        this.runElapsedMs = RUN_ANIMATION_MS;
        this.syncAnimationLoop();
    }

    private onUpdate(delta: number): void {
        this.runElapsedMs += delta;
        if (this.runElapsedMs >= RUN_ANIMATION_MS) {
            this.settleRun();
            // Re-render rather than repaint: the readout, the start label and the input locks all
            // change when the run resolves, and `render` is the one place that decides each of them.
            this.render(this.storeAdapter.getState());
            return;
        }
        this.paintLight();
    }

    // --- Painting -------------------------------------------------------------------------------

    private createRichPattern(): void {
        // Painted layers, back to front: fringe pattern under a soft additive glow of light.
        this.fringeGraphics = this.scene.add.graphics();
        this.beamGraphics = this.scene.add.graphics().setBlendMode('ADD');
        this.wavefrontGraphics = this.scene.add.graphics().setBlendMode('ADD');

        this.sourceGlow = this.scene.add.circle(SOURCE_X, CENTRE_Y, 26, this.wavelengthColor, 0.35).setBlendMode('ADD');
        this.sourceCore = this.scene.add.circle(SOURCE_X, CENTRE_Y, 13, 0xfff4d0);
        this.sourceLabel = this.scene.add.text(55, 232, '', uiTextStyle({ color: '#f7f4ef', fontSize: '14px' }));
        this.barrier = this.scene.add.rectangle(BARRIER_X, CENTRE_Y, 16, 186, 0x8db7c2);
        this.slitTop = this.scene.add.rectangle(BARRIER_X, this.slitTopY, 22, 13, 0x10252c);
        this.slitBottom = this.scene.add.rectangle(BARRIER_X, this.slitBottomY, 22, 13, 0x10252c);
        this.screen = this.scene.add.rectangle(this.screenX, CENTRE_Y, 14, SCREEN_HALF_HEIGHT * 2, 0x0b1a20);
        this.screenLabel = this.scene.add.text(this.screenX - 31, 322, '', uiTextStyle({ color: '#f7f4ef', fontSize: '14px' }));
        this.visualGuidance = this.scene.add.text(40, 348, '', uiTextStyle({ color: '#c7d7d9', fontSize: '13px', wordWrap: { width: 620 } }));

        this.objects.push(
            this.fringeGraphics, this.beamGraphics, this.wavefrontGraphics,
            this.sourceGlow, this.sourceCore, this.sourceLabel, this.barrier, this.slitTop, this.slitBottom,
            this.screen, this.screenLabel, this.visualGuidance
        );
    }

    private renderReadouts(
        state: AppState,
        t: Translator,
        latest: AppState['runs'][number] | undefined,
        latestMatchesActiveSetup: boolean
    ): void {
        const locale = selectLocale(state);
        // **Nothing is announced while the light is still crossing the bench.** The record is made on
        // the press (D2), so the value is available two seconds before the pattern resolves on the
        // screen — and printing it early answers the question the animation is in the middle of
        // asking. The readout arrives with the pattern, which is what AC5 describes.
        this.resultReadout?.setVisible(!this.runInFlight);
        this.resultReadout?.setText(latest?.modelInputs
            ? latestMatchesActiveSetup
                ? t('lab.result.recorded', {
                    value: formatRecordedValue(locale, latest.result.value, latest.result.unit),
                    wavelength: latest.modelInputs.wavelengthNm,
                    mode: t(`lab.wavelengthMode.${latest.modelInputs.wavelengthMode}`)
                })
                : t('lab.result.stale', { value: formatRecordedValue(locale, latest.result.value, latest.result.unit) })
            : t('lab.result.emptyHint'));

        // AC4's in-scene invitation, and AC5's in-flight state. The painted fringe preview is gone —
        // a screen pattern with no run behind it is exactly what "dark until the player starts it"
        // forbids (D7) — so this line is the whole of what the bench says about an unrun setup.
        this.visualGuidance?.setText(this.runInFlight
            ? t('lab.running')
            : this.recordedSpacingMm === undefined
                ? t('lab.idle', {
                    slitSpacing: selectFormattedControlValue(state, 'slitSpacingMm'),
                    screenDistance: selectFormattedControlValue(state, 'screenDistanceM')
                })
                : t('lab.pattern.recorded', { spacing: formatRecordedValue(locale, this.recordedSpacingMm, 'mm') }));

        // Measured, floor-anchored stacking: the refusal grows up out of the gap above the control row,
        // and the readout stacks on the refusal's *measured* top rather than on a constant that a
        // longer French sentence could invalidate.
        const message = this.benchError.read(state) ?? '';
        this.benchMessage?.setText(message).setVisible(message.length > 0).setY(BENCH_MESSAGE_BOTTOM_Y);
        const messageHeight = message.length > 0 ? (this.benchMessage?.height ?? 0) + BENCH_MESSAGE_GAP : 0;
        this.resultReadoutBottomY = BENCH_MESSAGE_BOTTOM_Y - messageHeight - RESULT_READOUT_GAP;
        this.fitResultReadout();
    }

    /**
     * Keeps the readout inside the gap above the bench message. Bottom-anchored, so the common case
     * costs one measurement and no reflow; the shrink loop only runs for a string long enough to reach
     * the instruments above, which is the same mechanism {@link LectureBookRenderer} uses for its
     * authored leaves. Called on state change, never per frame.
     *
     * **The headroom is measured from where the readout's bottom actually landed**, not against a
     * constant (review 2026-08-07). The bottom moves with the refusal beneath it — `BENCH_MESSAGE_BOTTOM_Y`
     * minus a *measured* message — so a fixed maximum height meant the permitted top moved up with it,
     * to 582 with no message against instrument readouts ending at 584, and to roughly 538 behind a
     * two-line French refusal. {@link RESULT_READOUT_CEILING_Y} is where the instruments genuinely end,
     * so the two now derive from one number and the geometry test's non-overlap sweep covers the pair.
     */
    private fitResultReadout(): void {
        const readout = this.resultReadout;
        if (!readout) return;
        const headroom = this.resultReadoutBottomY - RESULT_READOUT_CEILING_Y;
        readout.setFontSize(MAX_RESULT_FONT_SIZE);
        for (let fontSize = MAX_RESULT_FONT_SIZE; fontSize > MIN_RESULT_FONT_SIZE && readout.height > headroom; fontSize -= 1) {
            readout.setFontSize(fontSize - 1);
        }
        readout.setY(this.resultReadoutBottomY);
    }

    private renderApparatusGeometry(state: AppState): void {
        const slitSpacing = state.activeControlValues.slitSpacingMm;
        const screenDistance = state.activeControlValues.screenDistanceM;
        // Young's two control ids, written down. Until Story 3.1 the schema guaranteed they exist; the
        // control set is now authored, so a case without them reads `undefined` here — and unlike the
        // readouts this path does not throw, it computes `NaN` and calls `setY(NaN)` on the slits and the
        // screen, which paints nothing and reports nothing. Leave the last good geometry standing instead;
        // a bench for a second case is Story 3.2's work, and a silently blank apparatus would be a worse
        // way to discover that than an unmoved one.
        if (!Number.isFinite(slitSpacing) || !Number.isFinite(screenDistance)) return;
        const slitGapPx = 28 + ((slitSpacing - 0.1) / 0.4) * 92;
        this.screenX = screenXForDistance(screenDistance);
        this.slitTopY = CENTRE_Y - (slitGapPx / 2);
        this.slitBottomY = CENTRE_Y + (slitGapPx / 2);
        this.slitTop?.setY(this.slitTopY);
        this.slitBottom?.setY(this.slitBottomY);
        this.screen?.setX(this.screenX);
        this.screenLabel?.setPosition(this.screenX - 31, SCREEN_LABEL_Y);
        this.currentWavelengthNm = state.selectedWavelengthNm;
        this.wavelengthColor = rgbToInt(wavelengthToRgb(state.selectedWavelengthNm));
        this.sourceGlow?.setFillStyle(this.wavelengthColor, 0.35);
        // **The pattern is painted from the recorded value and from nothing else.** There is no preview
        // branch here any more: an unrecorded setup has no spacing, and the screen stays unlit.
        if (this.recordedSpacingMm !== undefined) {
            this.bandSpacingPx = Math.max(8, Math.min(31, this.recordedSpacingMm * 4.6));
            this.paintFringes();
        }
    }

    /**
     * Paints the interference pattern as a smooth vertical stack of intensity-shaded rows on the
     * screen, sampling the pure {@link interferenceIntensity} model. Redrawn only when the geometry,
     * spacing, or wavelength changes — never per animation frame. The *reveal* is an alpha on the whole
     * object, so a run resolving does not regenerate the geometry.
     */
    private paintFringes(): void {
        const signature = `${this.screenX.toFixed(1)}|${this.bandSpacingPx.toFixed(2)}|${this.wavelengthColor}`;
        if (signature === this.fringeSignature || !this.fringeGraphics) return;
        this.fringeSignature = signature;
        const envelopePx = this.bandSpacingPx * 3.2;
        const { r, g, b } = wavelengthToRgb(this.currentWavelengthNm);
        const g0 = this.fringeGraphics;
        g0.clear();
        for (let offset = -SCREEN_HALF_HEIGHT; offset <= SCREEN_HALF_HEIGHT; offset += FRINGE_ROW_STEP) {
            const intensity = interferenceIntensity(offset, this.bandSpacingPx, envelopePx);
            if (intensity <= 0.01) continue;
            const color = (Math.round(r * intensity) << 16) | (Math.round(g * intensity) << 8) | Math.round(b * intensity);
            g0.fillStyle(color, Math.min(1, 0.25 + intensity));
            g0.fillRect(this.screenX - FRINGE_STRIP_HALF_WIDTH, CENTRE_Y + offset - FRINGE_ROW_STEP / 2, FRINGE_STRIP_HALF_WIDTH * 2, FRINGE_ROW_STEP);
        }
    }

    /**
     * The whole of what the light looks like, in one place, for the three states the bench has.
     *
     * **Dark** — no run, or the setup has moved on from the one that was run (AC4, AC6): the source is
     * out, no wavefronts propagate, and the screen carries nothing beyond its own unlit bar.
     * **Running** — the source ignites, the beam reaches the slits, wavefronts travel to the screen and
     * the pattern resolves on it (AC5). **Resolved** — a still frame of the recorded pattern, with no
     * loop registered and nothing moving.
     *
     * Called from the update loop while a run is in flight and from `render()` otherwise, so the
     * reduced-motion path and the motion path end on the same picture rather than on two that agree by
     * coincidence.
     */
    private paintLight(): void {
        const beam = this.beamGraphics;
        const rings = this.wavefrontGraphics;
        const fringes = this.fringeGraphics;
        if (!beam || !rings || !fringes) return;

        const dark = this.recordedSpacingMm === undefined && !this.runInFlight;
        if (dark) {
            beam.clear();
            rings.clear();
            fringes.setVisible(false);
            this.sourceGlow?.setAlpha(0).setScale(1);
            this.sourceCore?.setAlpha(0.18).setScale(1);
            return;
        }

        const ignition = this.runInFlight ? Math.min(1, this.runElapsedMs / RUN_IGNITION_MS) : 1;
        this.sourceGlow?.setAlpha(ignition).setScale(1 + (0.9 * ignition));
        this.sourceCore?.setAlpha(0.18 + (0.82 * ignition)).setScale(1 + (0.35 * ignition));

        this.drawBeam(ignition);
        if (this.runInFlight) {
            const travelled = Math.max(0, this.runElapsedMs - RUN_IGNITION_MS);
            this.drawWavefronts((travelled % WAVEFRONT_PERIOD_MS) / WAVEFRONT_PERIOD_MS, ignition);
            // The pattern arrives over the last act, as an alpha on geometry that was painted once.
            const resolving = this.runElapsedMs - (RUN_IGNITION_MS + RUN_PROPAGATION_MS);
            const revealed = Math.min(1, Math.max(0, resolving / RUN_RESOLVE_MS));
            fringes.setVisible(revealed > 0).setAlpha(revealed);
            return;
        }
        // Resolved: the light stands still. No loop is registered and nothing here moves.
        rings.clear();
        fringes.setVisible(true).setAlpha(1);
    }

    /** Incident light: a soft beam wedge plus two crisp converging rays onto the slits. */
    private drawBeam(intensity: number): void {
        const beam = this.beamGraphics;
        if (!beam) return;
        beam.clear();
        if (intensity <= 0) return;
        beam.fillStyle(this.wavelengthColor, 0.14 * intensity);
        beam.fillTriangle(SOURCE_X, CENTRE_Y, BARRIER_X, this.slitTopY, BARRIER_X, this.slitBottomY);
        beam.lineStyle(2, 0xfff4d0, Math.min(1, 0.6 * intensity));
        beam.lineBetween(SOURCE_X, CENTRE_Y, BARRIER_X, this.slitTopY);
        beam.lineBetween(SOURCE_X, CENTRE_Y, BARRIER_X, this.slitBottomY);
    }

    /**
     * Expanding Huygens wavefronts from each slit, whose additive overlap between the slits and the
     * screen renders the interference visually. `basePhase01` in [0,1) advances them.
     *
     * The two slit positions are iterated without allocating an array per frame, which is the
     * discipline §Performance asks for in a render path and which this method has always kept.
     */
    private drawWavefronts(basePhase01: number, intensity: number): void {
        const rings = this.wavefrontGraphics;
        if (!rings) return;
        rings.clear();
        const maxRadius = Math.max(60, this.screenX - BARRIER_X + 24);
        const arcHalfAngleRad = (72 * Math.PI) / 180;
        for (let s = 0; s < 2; s += 1) {
            const slitY = s === 0 ? this.slitTopY : this.slitBottomY;
            for (let i = 0; i < WAVEFRONT_RINGS; i += 1) {
                const p = (basePhase01 + i / WAVEFRONT_RINGS) % 1;
                const radius = p * maxRadius;
                if (radius < 4) continue;
                // Fade in at birth, fade out as the wavefront expands (clamped ≤1).
                const alpha = Math.min(1, Math.min(1, p * 6) * (1 - p) * 0.6 * intensity);
                if (alpha <= 0.01) continue;
                rings.lineStyle(2, this.wavelengthColor, alpha);
                rings.beginPath();
                rings.arc(BARRIER_X, slitY, radius, -arcHalfAngleRad, arcHalfAngleRad, false);
                rings.strokePath();
            }
        }
    }

    // --- The side column (Story 2.6 / 2.7) ------------------------------------------------------

    /**
     * The control that leaves the laboratory, and the hint slot beneath it.
     *
     * Both are created empty and populated by {@link renderSideColumn}: `create()` runs once and the
     * locale can change at any time.
     */
    private createSideColumn(): void {
        // The widget owns its own display objects and releases them in its own `destroy()`, so it is
        // deliberately not pushed onto `this.objects`.
        this.advanceControl = new AdvanceControl(this.scene, {
            x: SIDE_COLUMN_LEFT,
            y: ADVANCE_CONTROL_Y,
            width: SIDE_COLUMN_WIDTH,
            onAdvance: () => this.requestAdvance()
        });
        this.advanceControl.create();
        this.revisitControl = new AdvanceControl(this.scene, {
            x: SIDE_COLUMN_LEFT,
            y: REVISIT_CONTROL_Y,
            width: SIDE_COLUMN_WIDTH,
            onAdvance: () => this.requestRevisit()
        });
        this.revisitControl.create();

        // Bottom-anchored, for the same reason `resultReadout` is: an authored hint is prose of
        // unbounded-by-layout length and French runs 15–25% longer, so it has to grow *upward* into
        // the empty column rather than downward off a fixed 1024×768 `Scale.FIT` surface that does
        // not scroll. The backing rectangle is sized from the measured text, never the reverse.
        this.hintBackground = this.scene.add.rectangle(SIDE_COLUMN_LEFT, 0, SIDE_COLUMN_WIDTH, 0, 0x0b1a20, 0.85).setOrigin(0, 1);
        this.hintLine = this.scene.add.text(SIDE_COLUMN_LEFT + HINT_PADDING, 0, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${HINT_LINE_FONT_SIZE}px`, wordWrap: { width: HINT_TEXT_WRAP }
        })).setOrigin(0, 1);
        this.hintSpeaker = this.scene.add.text(SIDE_COLUMN_LEFT + HINT_PADDING, 0, '', uiTextStyle({
            color: '#f4d35e', fontSize: `${HINT_SPEAKER_FONT_SIZE}px`, wordWrap: { width: HINT_TEXT_WRAP }
        })).setOrigin(0, 1);

        this.objects.push(this.hintBackground, this.hintLine, this.hintSpeaker);
    }

    /**
     * Asks to make the move that leaves this phase.
     *
     * It decides nothing itself, and it does not know that the laboratory is the `experiment` phase:
     * the transition is resolved from the **live** phase every time, which is the rule every host of
     * this control follows (ADR-009 — a scene mirrors the phase and never defines it).
     *
     * A refusal may come from the significant-measure gate or from `createStore` short-circuiting
     * during an exclusive progress operation, and the two need different answers: the gate's refusal
     * is answered by the authored colleague hint, and anything else by the localized error —
     * swallowing either would leave the control looking inert with no way to tell "refused" from
     * "not clickable" (1.11 review).
     */
    private requestAdvance(): void {
        const { transition } = advanceTransitionForPhase(selectCasePhase(this.storeAdapter.getState()));
        const result = this.storeAdapter.advanceCase(transition);
        if (result.ok) return;
        const current = this.storeAdapter.getState();
        const { register, message } = resolveAdvanceRefusal({
            code: result.error.code,
            localizedError: selectLocalizedError(current, result.error),
            // The laboratory is the one host that can speak the colleague's line — and only when one
            // actually applies to this evidence. With none, the refusal falls back to the localized
            // error rather than to an empty slot.
            colleagueAnswers: selectLocalizedColleagueHint(current) !== undefined
        });
        if (register === 'gate') {
            this.advanceRefused = true;
            // The colleague answers this one, so any error still standing in the slot is superseded.
            this.transientError.clear();
        } else {
            this.transientError.set(message ?? '', current);
        }
        this.render(current);
    }

    private requestRevisit(): void {
        const revisit = revisitTransitionForPhase(selectCasePhase(this.storeAdapter.getState()));
        if (!revisit) return;
        const result = this.storeAdapter.revisitCase(revisit.transition);
        if (result.ok) return;
        const current = this.storeAdapter.getState();
        this.transientError.set(selectLocalizedError(current, result.error), current);
        this.render(current);
    }

    /**
     * Draws the control and, once an attempt has actually been refused, the colleague answering it.
     *
     * The hint is read from the store on every render rather than captured at refusal time, so the
     * moment the player records a distinguishing measurement it withdraws itself — the selector
     * returns `undefined` as soon as the gate is met.
     */
    private renderSideColumn(state: AppState, t: Translator): void {
        // What to show is decided in `advanceView`, which is Phaser-free and therefore testable; this
        // method only paints the answer. See that module for why the split exists.
        const view = resolveAdvanceView({
            isGateMet: selectSignificantMeasureGate(state).isMet,
            hint: selectLocalizedColleagueHint(state),
            // Reading the slot is what spends it: it survives every repaint of the state it was set
            // against and clears on the first render that carries a new one (AC5).
            transientError: this.transientError.read(state),
            advanceRefused: this.advanceRefused
        });
        this.advanceRefused = view.advanceRefused;
        const { lineText, speakerText } = view;

        // The one thing the control says about the evidence is whether the way on is open, which is a
        // fact about the player's own notebook rather than a judgement about a conclusion. It never
        // marks a proposal, and nothing here can reach the defensible set.
        this.advanceControl?.render({
            label: t(advanceTransitionForPhase(selectCasePhase(state)).labelKey),
            isReady: view.isAdvanceReady
        });
        const revisit = revisitTransitionForPhase(selectCasePhase(state));
        this.revisitControl?.render({ label: revisit ? t(revisit.labelKey) : '', isReady: revisit !== undefined });

        this.hintLine?.setText(lineText);
        this.hintSpeaker?.setText(speakerText);

        if (!lineText) {
            this.hintBackground?.setSize(SIDE_COLUMN_WIDTH, 0).setVisible(false);
            this.hintLine?.setVisible(false);
            this.hintSpeaker?.setVisible(false);
            this.hintPanelTop = undefined;
            return;
        }

        // Measured, floor-anchored stacking: the line sits above the margin, the speaker above the
        // line's *measured* top. Nothing is placed against a constant that a longer French sentence
        // could invalidate.
        const floor = this.scene.scale.height - HINT_BOTTOM_MARGIN;
        const lineBottom = floor;
        const speakerBottom = lineBottom - (this.hintLine?.height ?? 0) - HINT_SPEAKER_GAP;
        this.hintLine?.setY(lineBottom).setVisible(true);
        this.hintSpeaker?.setY(speakerBottom).setVisible(speakerText.length > 0);

        const panelTop = (speakerText ? speakerBottom - (this.hintSpeaker?.height ?? 0) : lineBottom - (this.hintLine?.height ?? 0)) - HINT_PADDING;
        this.hintBackground
            ?.setSize(SIDE_COLUMN_WIDTH, Math.max(0, floor + HINT_PADDING - panelTop))
            .setY(floor + HINT_PADDING)
            .setVisible(true);
        // Handed to the shelf pass below, which runs after this one and must yield to a measured hint
        // rather than to a constant guess at how tall one can get.
        this.hintPanelTop = panelTop;
    }

    /**
     * The bench's reference shelf: one control per authored artifact, under the way out.
     *
     * Built only when the scene actually hosts a book. A shelf drawn by a scene with no presenter
     * would be a control that does nothing, which is worse than no control at all.
     */
    private createReferenceShelf(): void {
        if (!this.options.openReference) return;
        this.referenceHeading = this.scene.add.text(SIDE_COLUMN_LEFT, REFERENCE_HEADING_Y, '', uiTextStyle({
            color: '#9fc6bb', fontSize: `${REFERENCE_HEADING_FONT_SIZE}px`, fontStyle: 'bold', wordWrap: { width: SIDE_COLUMN_WIDTH }
        }));
        this.objects.push(this.referenceHeading);

        // One `Graphics` for every control's fill, redrawn as a whole each render. Cheaper than a
        // rectangle per control and, more to the point, it keeps the painted shape and the hit area as
        // two things sized from one measurement rather than one object fighting its own geometry.
        this.referenceShelfFills = this.scene.add.graphics();
        this.objects.push(this.referenceShelfFills);

        selectContextualArtifacts(this.storeAdapter.getState()).forEach((artifact) => {
            // An artifact with no local rendition has nothing to re-read, and one whose rights are
            // unreviewed must not be reachable as a reading at all. Neither gets a control here; the
            // reading room is where both are explained, which is where the player met them.
            if (!isSourceEligibleForInspection(artifact) || !artifact.textualRendition) return;
            const hitArea = this.scene.add.zone(SIDE_COLUMN_LEFT, 0, SIDE_COLUMN_WIDTH, 1).setOrigin(0, 0);
            // Empty here, written in `render`: an artifact's display name is authored `LocalizedText`
            // and the locale can change at any time.
            const label = this.scene.add.text(0, 0, '', uiTextStyle({
                color: '#dfeaea', fontSize: `${REFERENCE_CONTROL_FONT_SIZE}px`, wordWrap: { width: REFERENCE_CONTROL_LABEL_WRAP }
            }));
            hitArea.on('pointerup', () => this.options.openReference?.(artifact));
            this.objects.push(hitArea, label);
            this.referenceControls.push({ artifactId: artifact.id, hitArea, label });
        });
    }

    /**
     * Paints the shelf, sizing each control to its own measured label and stacking the next under it.
     *
     * Measured rather than laid out against constants, because the labels are authored artifact names
     * and French runs 15–25% longer: "Le compte rendu de la conférence de Thomas Young de 1801" wraps
     * to two lines at this column width where its English counterpart fits on one. A fixed height here
     * would clip it.
     *
     * A control that would reach {@link referenceShelfFloor} is hidden rather than drawn. The
     * colleague's hint grows upward from the canvas floor into the same column, and this surface does
     * not scroll — so the shelf yields, because the hint is the thing the player is being asked to act
     * on and the reference is still reachable from the reading room.
     */
    private renderReferenceShelf(state: AppState, t: Translator): void {
        const fills = this.referenceShelfFills;
        if (!this.referenceHeading || !fills) return;
        const locale = selectLocale(state);
        this.referenceHeading.setText(t('lab.reference.heading'));
        const artifacts = selectContextualArtifacts(state);
        const floor = referenceShelfFloor(this.scene.scale.height, this.hintPanelTop);
        let cursor = REFERENCE_HEADING_Y + this.referenceHeading.height + REFERENCE_HEADING_GAP_BELOW;
        let shown = 0;
        // Once one control does not fit, none below it does either: the shelf is truncated from the
        // bottom rather than sieved. Skipping the tall one and drawing the next in its place would put
        // the second reference where the first should be, with nothing to say the first exists.
        let truncated = false;

        fills.clear();
        fills.fillStyle(0x1d4451, 1);
        this.referenceControls.forEach(({ artifactId, hitArea, label }) => {
            const artifact = artifacts.find(({ id }) => id === artifactId);
            const hide = (): void => {
                hitArea.setVisible(false).disableInteractive();
                label.setVisible(false);
            };
            if (!artifact) {
                hide();
                return;
            }
            label.setText(resolveLocalizedText(artifact.displayName, locale));
            const height = label.height + (2 * REFERENCE_CONTROL_PADDING);
            // The hint grows upward from the canvas floor into this same column. Where the two would
            // meet, the shelf yields: the hint is what the player is being asked to act on, and the
            // reference is still reachable from the reading room.
            if (truncated || cursor + height > floor) {
                truncated = true;
                hide();
                return;
            }
            fills.fillRect(SIDE_COLUMN_LEFT, cursor, SIDE_COLUMN_WIDTH, height);
            // The third argument is the whole point: `Zone.setSize` resizes the input hit area with the
            // object. Nothing else in Phaser does — `setInteractive` a second time only re-enables an
            // existing area, and `Shape.setSize` throws outright on a shape built at another size. That
            // throw lands inside the store's notify loop, where an escaping error breaks `dispatch`'s
            // `Result` contract and strands the router mid-transition. Found exactly that way.
            hitArea.setVisible(true).setPosition(SIDE_COLUMN_LEFT, cursor).setSize(SIDE_COLUMN_WIDTH, height, true);
            label.setVisible(true).setPosition(SIDE_COLUMN_LEFT + REFERENCE_CONTROL_PADDING, cursor + REFERENCE_CONTROL_PADDING);
            cursor += height + REFERENCE_CONTROL_GAP;
            shown += 1;
        });
        // A labelled shelf with nothing on it is what the constructor docstring says this must never
        // be. The heading is only true while at least one reference is actually reachable.
        this.referenceHeading.setVisible(shown > 0);
        // Re-applied because visibility just changed: a control this pass hid must not stay clickable,
        // and one it revealed must not stay inert. One rule for input state, re-run, rather than a
        // second copy of it inline here.
        this.updateBenchInputState();
    }

    /**
     * The one place input state is decided, for every control on this surface.
     *
     * ## The sub-768px suppression is gone (Story 2.12, AC7 / D7)
     *
     * This used to `&& !window.matchMedia('(max-width: 767px)').matches`, which is why it was called
     * `updateBenchInputState`. Four `deferred-work.md` entries — 2.6, 2.7, 2.8 and 2.11's scope
     * boundary — deferred the decision here, and each preserved an inconsistency rather than extend it:
     * this renderer suppressed the step controls, the advance control **and** the reference shelf from
     * one flag, while `LibraryRenderer`, the boards and the debrief suppressed nothing at all.
     *
     * It is decided in one direction and applied everywhere: **the affordances stay available.** The
     * flag's stated purpose was preventing accidental *mutation* on a phone, and it had grown to block
     * *reading* — the reference shelf, whose own docstring says reading here dispatches nothing and
     * changes no progression. NFR4 makes phones reading-only, so blocking reading inverts it. And with
     * the DOM panels retired there is no fallback surface, so suppressing the advance control left a
     * player on a narrow viewport in a phase they could not leave, which is the precise failure ADR-011
     * exists to prevent. No "unsupported viewport" message is authored either, because nothing is
     * suppressed for one to explain.
     *
     * What survives is the run lock, so the bench is consistent with itself rather than carrying a
     * second, competing gate (2.10, AC6). The advance control and the reference shelf are deliberately
     * **not** locked during a run: neither can change the setup a run was recorded against, and taking
     * the way out away mid-animation would be a new restriction nothing asked for.
     */
    private readonly updateBenchInputState = (): void => {
        const enabled = this.inputEnabled;
        const benchEnabled = enabled && !this.runInFlight;
        // The single fact every other guard on this surface reads, so the rule is decided once here
        // rather than re-derived wherever it is needed.
        this.benchInputEnabled = benchEnabled;
        // A bench that has stopped accepting input has no business holding the focus ring or the global
        // arrow-key capture. Ordered after the flag because it reads it.
        if (!benchEnabled) this.blurInstrument();
        else this.syncArrowCapture();
        this.instruments.forEach((instrument) => instrument.setInputEnabled(benchEnabled));
        this.wavelengthChooser?.setInputEnabled(benchEnabled);
        [this.startSurface, this.notebookSurface, this.resetSurface].forEach((surface) => {
            if (benchEnabled) surface?.setInteractive({ useHandCursor: true });
            else surface?.disableInteractive();
        });
        // The advance control follows the overlay suppression. Without it, a click meant for the
        // reference book's page controls falls through to it and moves the player out of the
        // laboratory — the same defect the book overlay caused on the proposal cards (1.12 review).
        this.advanceControl?.setInputEnabled(enabled);
        this.revisitControl?.setInputEnabled(enabled);
        // And the reference shelf, which is directly under the book's own control row: a page turn
        // falling through here would re-open the book the player was closing.
        this.referenceControls.forEach(({ hitArea }) => {
            if (enabled && hitArea.visible) hitArea.setInteractive({ useHandCursor: true });
            else hitArea.disableInteractive();
        });
    };
}

/** One authored step per press, in either direction. Both axes, because a knob has no single axis. */
const ARROW_STEPS: Readonly<Record<string, -1 | 1 | undefined>> = {
    ArrowLeft: -1,
    ArrowDown: -1,
    ArrowRight: 1,
    ArrowUp: 1
};

/**
 * Captured only while an instrument is focused, so the page still scrolls the rest of the time.
 *
 * A mutable array because `addCapture` / `removeCapture` take one; it is module-private and never
 * written to.
 */
const ARROW_KEY_CAPTURE: string[] = ['LEFT', 'RIGHT', 'UP', 'DOWN'];
