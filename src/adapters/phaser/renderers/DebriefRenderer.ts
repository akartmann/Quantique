import type { Scene } from 'phaser';

import { createTranslator, type Translator } from '../../../core/i18n/translate';
import type { AppState } from '../../../core/store/AppState';
import {
    selectCompletionSnapshot,
    selectLocale,
    selectLocalizedCritiqueHistory,
    selectLocalizedDebrief,
    selectLocalizedRecognition,
    selectReplayState,
    type LocalizedCritiqueHistoryEntry
} from '../../../core/store/selectors';
import { RECOGNITION_IDS } from '../../../domain/recognition/recognitionRules';
import type { PhaserStoreAdapter } from '../PhaserStoreAdapter';
import { uiTextStyle } from '../textStyles';
import {
    DEBRIEF_BAND_PADDING,
    DEBRIEF_TOGGLE_GAP,
    DEBRIEF_BODY_FONT_SIZE,
    DEBRIEF_CITED_SOURCE_ROWS,
    DEBRIEF_CRITIQUE_FONT_SIZE,
    DEBRIEF_HEADING_FONT_SIZE,
    DEBRIEF_META_FONT_SIZE,
    DEBRIEF_MIN_FONT_SIZE,
    DEBRIEF_PAGE_CONTROL_FONT_SIZE,
    DEBRIEF_PAGE_CONTROL_HEIGHT,
    DEBRIEF_PAGE_CONTROL_WIDTH,
    DEBRIEF_RECOGNITION_LABEL_FONT_SIZE,
    DEBRIEF_RECOGNITION_STATUS_WIDTH,
    DEBRIEF_ROW_GAP,
    DEBRIEF_SECTION_TITLE_FONT_SIZE,
    DEBRIEF_SUMMARY_FONT_SIZE,
    DEBRIEF_TITLE_GAP,
    DEBRIEF_TOGGLE_FONT_SIZE,
    DEBRIEF_TOGGLE_STATE_WIDTH,
    DEBRIEF_WARNING_FONT_SIZE,
    debriefComparisonBand,
    debriefCounterfactualBand,
    debriefDeeperTheoryToggleBand,
    debriefHeadingBand,
    debriefHeadingTextWrap,
    debriefLeftTextWrap,
    debriefLowerBand,
    debriefLowerBodyBand,
    debriefLowerHeadingWrap,
    debriefPageControlBand,
    debriefPageControlLabelWrap,
    debriefRecognitionBand,
    debriefRecognitionIntroBand,
    debriefRecognitionRowBand,
    debriefRightTextWrap,
    debriefSourceRowBand,
    debriefSourcesBand,
    debriefSummaryBand,
    debriefToggleLabelWrap,
    debriefToggleStateWrap,
    type DebriefRect
} from '../scenes/debriefGeometry';

/**
 * The debrief: the historical record, what the player recorded, where their claim was tested, and the
 * way back round (Story 2.11).
 *
 * `RivalLabRenderer` is the closest precedent — one scene, unbounded authored prose, a floor-anchored
 * control, no animation — and this follows it in all four.
 *
 * ## It reports the record; it does not rewrite it (AC2)
 *
 * Everything about the *investigation* comes from {@link selectCompletionSnapshot}: the recognition
 * account and the challenge history are read from `completion`, never from the live fields. The
 * reducer is what guarantees that — `reduceDebriefComplete` snapshots at first completion and keeps
 * the **original** snapshot across a counterfactual replay — so the historical record this room shows
 * is fixed at the moment the case closed and nothing the player does afterwards can move it. That is
 * held by the store, not by this renderer, and this renderer must not re-implement it.
 *
 * ## No animation, deliberately
 *
 * The cheapest correct option, and the one `AdvanceControl`'s docstring argues for. Anything added
 * here inherits the whole contract: subscribe to `prefers-reduced-motion`, register **no** update loop
 * under `reduce`, paint a static frame from `render()`, animate on elapsed time, and release every
 * tween in `destroy()` including tweens whose target is the renderer itself. Nothing here registers an
 * update handler, starts a tween, or reads a clock.
 *
 * ## Character staging is out of scope
 *
 * `CharacterStage` belongs to the boards and the rival lab. The debrief is a record being read, not a
 * conversation, and the `scenarioScript` authors **zero** dialogue beats for the `debrief` phase — so
 * there is no beat to stage and adding one would be a `case.json` content change nobody asked for.
 *
 * ## It never throws
 *
 * `create()` and `render()` run synchronously inside `dispatch() → notify()`, so a throw advances the
 * phase, skips every later subscriber and strands the router with no visible error (the 1.10 failure
 * mode, reproduced in 2.8's Debug Log). A restored record can carry the `debrief` phase with a
 * snapshot from IndexedDB and a `critiqueId` a cached `case.json` no longer authors; the authored
 * comparison and deeper theory render regardless, and a block with no data is omitted rather than
 * fatal.
 */

/** The room's own ground, one shade under the scene's background so the bands read as objects on it. */
const BAND_FILL = 0x16323b;
const BAND_RIM = 0x2f5b66;
const STRIP_FILL = 0x1d4451;
const PAGE_CONTROL_FILL = 0x1d4451;
const PAGE_CONTROL_FILL_OFF = 0x14262d;

const HEADING_COLOR = '#f7f4ef';
const BODY_COLOR = '#e4ecec';
const META_COLOR = '#9fc6bb';
const SECTION_COLOR = '#d8c6a6';
/** The counterfactual warning, in the same amber every refusal and caution in this game uses. */
const WARNING_COLOR = '#f4d35e';
const RECOGNITION_ON_COLOR = '#9fd8b4';

/** Everything this room draws is one of these two. */
type DebriefObject = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text;

type SourceRow = Readonly<{ name: Phaser.GameObjects.Text; meta: Phaser.GameObjects.Text }>;
type RecognitionRow = Readonly<{
    label: Phaser.GameObjects.Text;
    status: Phaser.GameObjects.Text;
    description: Phaser.GameObjects.Text;
}>;

export class DebriefRenderer {
    private readonly objects: DebriefObject[] = [];
    private readonly sourceRows: SourceRow[] = [];
    private readonly recognitionRows: RecognitionRow[] = [];

    private heading?: Phaser.GameObjects.Text;
    private summary?: Phaser.GameObjects.Text;
    private comparisonTitle?: Phaser.GameObjects.Text;
    private comparisonText?: Phaser.GameObjects.Text;
    private sourcesHeading?: Phaser.GameObjects.Text;
    private recognitionHeading?: Phaser.GameObjects.Text;
    private recognitionIntro?: Phaser.GameObjects.Text;
    private toggleSurface?: Phaser.GameObjects.Rectangle;
    private toggleTitle?: Phaser.GameObjects.Text;
    private toggleState?: Phaser.GameObjects.Text;
    private lowerHeading?: Phaser.GameObjects.Text;
    private earlierSurface?: Phaser.GameObjects.Rectangle;
    private earlierLabel?: Phaser.GameObjects.Text;
    private laterSurface?: Phaser.GameObjects.Rectangle;
    private laterLabel?: Phaser.GameObjects.Text;
    private lowerSpeaker?: Phaser.GameObjects.Text;
    private lowerBody?: Phaser.GameObjects.Text;
    private counterfactual?: Phaser.GameObjects.Text;

    /**
     * Whether the optional deeper-theory layer is open, and which challenge is on show.
     *
     * Both **ephemeral and widget-local**, exactly as `DialogueBox`'s beat index and
     * `LectureBookRenderer`'s summary toggle are, and for the reason those docstrings give: a value
     * that means nothing five seconds later must not become a persisted, exported, re-validated,
     * replay-reset store field. The 2.8 review ratified this reading (Decision 4), and AC1 calls the
     * layer optional rather than recorded.
     */
    private deeperTheoryOpen = false;
    private critiqueIndex = 0;

    public constructor(
        private readonly scene: Scene,
        private readonly storeAdapter: PhaserStoreAdapter
    ) {}

    /** Whether the optional layer is open. Read by the scene's test harness and by nothing in play. */
    public get isDeeperTheoryOpen(): boolean {
        return this.deeperTheoryOpen;
    }

    public create(): void {
        const { width, height } = this.scene.scale;

        // Every string below is created **empty** and written in `render`: `create()` runs once and the
        // locale can change at any time, so no player-facing copy is authored here.
        this.heading = this.text(
            debriefHeadingBand(width).x, debriefHeadingBand(width).y,
            DEBRIEF_HEADING_FONT_SIZE, HEADING_COLOR, debriefHeadingTextWrap(width)
        );

        this.panel(debriefSummaryBand(width));
        this.summary = this.textInBand(debriefSummaryBand(width), DEBRIEF_SUMMARY_FONT_SIZE, BODY_COLOR, debriefLeftTextWrap(width));

        const comparison = debriefComparisonBand(width);
        this.panel(comparison);
        this.comparisonTitle = this.textInBand(comparison, DEBRIEF_SECTION_TITLE_FONT_SIZE, SECTION_COLOR, debriefLeftTextWrap(width));
        // Placed against the title's **measured** bottom in `render`, never against a constant: the
        // title is authored `LocalizedText` with no `.max()` and French runs 15–25% longer.
        this.comparisonText = this.textInBand(comparison, DEBRIEF_BODY_FONT_SIZE, BODY_COLOR, debriefLeftTextWrap(width));

        const sources = debriefSourcesBand(width);
        this.panel(sources);
        this.sourcesHeading = this.textInBand(sources, DEBRIEF_SECTION_TITLE_FONT_SIZE, SECTION_COLOR, debriefLeftTextWrap(width));
        for (let index = 0; index < DEBRIEF_CITED_SOURCE_ROWS; index += 1) {
            const row = debriefSourceRowBand(index, width);
            this.sourceRows.push({
                name: this.text(row.x, row.y, DEBRIEF_BODY_FONT_SIZE, BODY_COLOR, row.width),
                meta: this.text(row.x, row.y + Math.ceil(DEBRIEF_BODY_FONT_SIZE * 1.35), DEBRIEF_META_FONT_SIZE, META_COLOR, row.width)
            });
        }

        const recognition = debriefRecognitionBand(width);
        this.panel(recognition);
        this.recognitionHeading = this.textInBand(recognition, DEBRIEF_SECTION_TITLE_FONT_SIZE, SECTION_COLOR, debriefRightTextWrap());
        const intro = debriefRecognitionIntroBand(width);
        this.recognitionIntro = this.text(intro.x, intro.y, DEBRIEF_META_FONT_SIZE, META_COLOR, intro.width);
        RECOGNITION_IDS.forEach((_id, index) => {
            const row = debriefRecognitionRowBand(index, width);
            this.recognitionRows.push({
                // The label and the status share the row, so the label wraps against what is left
                // **after** the status's reserve and the gutter between them — without the gutter the
                // two run together into one unreadable word, which is what the 1280×720 pass caught.
                label: this.text(row.x, row.y, DEBRIEF_RECOGNITION_LABEL_FONT_SIZE, BODY_COLOR,
                    row.width - DEBRIEF_RECOGNITION_STATUS_WIDTH - DEBRIEF_TOGGLE_GAP),
                status: this.text(row.x + row.width - DEBRIEF_RECOGNITION_STATUS_WIDTH, row.y,
                    DEBRIEF_META_FONT_SIZE, META_COLOR, DEBRIEF_RECOGNITION_STATUS_WIDTH).setOrigin(0, 0),
                description: this.text(
                    row.x, row.y + Math.ceil(DEBRIEF_RECOGNITION_LABEL_FONT_SIZE * 1.35),
                    DEBRIEF_META_FONT_SIZE, META_COLOR, row.width
                )
            });
        });

        // --- The controls, in the order a test presses them ---------------------------------------
        // `sceneSlice.pressable()` returns objects carrying a `pointerup` handler in **creation
        // order**, so this order is part of this renderer's contract with its test: the deeper-theory
        // strip, then the earlier challenge, then the later one.
        const strip = debriefDeeperTheoryToggleBand(width);
        this.toggleSurface = this.scene.add
            .rectangle(strip.x, strip.y, strip.width, strip.height, STRIP_FILL)
            .setOrigin(0, 0)
            .setStrokeStyle(1, BAND_RIM);
        this.toggleSurface.setInteractive({ useHandCursor: true });
        this.toggleSurface.on('pointerup', () => this.toggleDeeperTheory());
        this.objects.push(this.toggleSurface);
        this.toggleTitle = this.text(
            strip.x + DEBRIEF_BAND_PADDING, strip.y + ((strip.height - Math.ceil(DEBRIEF_TOGGLE_FONT_SIZE * 1.35)) / 2),
            DEBRIEF_TOGGLE_FONT_SIZE, HEADING_COLOR, debriefToggleLabelWrap(width)
        );
        this.toggleState = this.text(
            strip.x + strip.width - DEBRIEF_BAND_PADDING - DEBRIEF_TOGGLE_STATE_WIDTH,
            strip.y + ((strip.height - Math.ceil(DEBRIEF_TOGGLE_FONT_SIZE * 1.35)) / 2),
            DEBRIEF_TOGGLE_FONT_SIZE, WARNING_COLOR, debriefToggleStateWrap()
        );

        const lower = debriefLowerBand(width, height);
        this.panel(lower);
        this.lowerHeading = this.textInBand(lower, DEBRIEF_SECTION_TITLE_FONT_SIZE, SECTION_COLOR, debriefLowerHeadingWrap(width));
        this.earlierSurface = this.pageControl(-1, width, height);
        this.earlierLabel = this.pageControlLabel(-1, width, height);
        this.laterSurface = this.pageControl(1, width, height);
        this.laterLabel = this.pageControlLabel(1, width, height);

        const body = debriefLowerBodyBand(width, height);
        this.lowerSpeaker = this.text(body.x, body.y, DEBRIEF_META_FONT_SIZE, META_COLOR, body.width);
        this.lowerBody = this.text(body.x, body.y, DEBRIEF_CRITIQUE_FONT_SIZE, BODY_COLOR, body.width);

        const warning = debriefCounterfactualBand(width, height);
        this.counterfactual = this.text(
            warning.x + DEBRIEF_BAND_PADDING, warning.y + DEBRIEF_BAND_PADDING,
            DEBRIEF_WARNING_FONT_SIZE, WARNING_COLOR, warning.width - (2 * DEBRIEF_BAND_PADDING)
        );
    }

    public render(state: AppState): void {
        const { width, height } = this.scene.scale;
        const t = createTranslator(selectLocale(state));
        const debrief = selectLocalizedDebrief(state);
        const completion = selectCompletionSnapshot(state);

        this.heading?.setText(t('debrief.heading'));

        if (this.summary) {
            this.summary.setText(debrief.summary);
            this.clamp(this.summary, DEBRIEF_SUMMARY_FONT_SIZE, this.roomFor(debriefSummaryBand(width), this.summary));
        }

        this.renderComparison(debrief, width);
        this.renderSources(t, debrief, width);
        this.renderRecognition(t, state, completion, width);
        this.renderLowerBand(t, state, debrief, completion, width, height);
        this.renderCounterfactual(state, debrief);
    }

    public destroy(): void {
        this.sourceRows.forEach(({ name, meta }) => [name, meta].forEach((object) => object.destroy()));
        this.sourceRows.length = 0;
        this.recognitionRows.forEach(({ label, status, description }) =>
            [label, status, description].forEach((object) => object.destroy()));
        this.recognitionRows.length = 0;
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.heading = undefined; this.summary = undefined;
        this.comparisonTitle = undefined; this.comparisonText = undefined;
        this.sourcesHeading = undefined;
        this.recognitionHeading = undefined; this.recognitionIntro = undefined;
        this.toggleSurface = undefined; this.toggleTitle = undefined; this.toggleState = undefined;
        this.lowerHeading = undefined;
        this.earlierSurface = undefined; this.earlierLabel = undefined;
        this.laterSurface = undefined; this.laterLabel = undefined;
        this.lowerSpeaker = undefined; this.lowerBody = undefined;
        this.counterfactual = undefined;
        this.deeperTheoryOpen = false;
        this.critiqueIndex = 0;
    }

    // --- Sections -----------------------------------------------------------------------------------

    private renderComparison(debrief: ReturnType<typeof selectLocalizedDebrief>, canvasWidth: number): void {
        const band = debriefComparisonBand(canvasWidth);
        this.comparisonTitle?.setText(debrief.historicalComparison.title);
        this.comparisonText?.setText(debrief.historicalComparison.text);
        if (!this.comparisonTitle || !this.comparisonText) return;
        // The title is clamped first so the prose below it is placed against a *measured* bottom.
        const titleRoom = band.height - (2 * DEBRIEF_BAND_PADDING) - DEBRIEF_TITLE_GAP
            - Math.ceil(DEBRIEF_BODY_FONT_SIZE * 1.35);
        this.clamp(this.comparisonTitle, DEBRIEF_SECTION_TITLE_FONT_SIZE, titleRoom);
        this.comparisonText.setY(this.comparisonTitle.y + this.comparisonTitle.height + DEBRIEF_TITLE_GAP);
        this.clamp(this.comparisonText, DEBRIEF_BODY_FONT_SIZE, this.roomFor(band, this.comparisonText));
    }

    private renderSources(t: Translator, debrief: ReturnType<typeof selectLocalizedDebrief>, canvasWidth: number): void {
        this.sourcesHeading?.setText(t('debrief.sources.heading'));
        this.sourceRows.forEach((row, index) => {
            const source = debrief.historicalComparison.sources[index];
            if (!source) {
                // A degraded cached `case.json` can cite an id no artifact matches. The row is omitted
                // rather than painted as an empty citation.
                [row.name, row.meta].forEach((object) => object.setVisible(false));
                return;
            }
            [row.name, row.meta].forEach((object) => object.setVisible(true));
            row.name.setText(source.name);
            // AC2's four provenance categories, said out loud beside every citation.
            row.meta.setText(t('debrief.sources.line', {
                provenance: source.provenance,
                type: source.sourceType,
                rights: source.rightsStatus
            }));
            const band = debriefSourceRowBand(index, canvasWidth);
            this.clamp(row.name, DEBRIEF_BODY_FONT_SIZE, Math.ceil(DEBRIEF_BODY_FONT_SIZE * 1.35));
            row.meta.setY(band.y + row.name.height);
            // Placed against the name's **measured** height, so a French display name that wraps
            // pushes its provenance line down rather than being painted over by it.
            this.clamp(row.meta, DEBRIEF_META_FONT_SIZE, band.y + band.height - row.meta.y);
        });
    }

    private renderRecognition(
        t: Translator,
        state: AppState,
        completion: ReturnType<typeof selectCompletionSnapshot>,
        canvasWidth: number
    ): void {
        this.recognitionHeading?.setText(t('debrief.recognition.heading'));
        // The framing that keeps four ticked lines from reading as a tally (AC3).
        this.recognitionIntro?.setText(completion ? t('debrief.recognition.intro') : t('debrief.record.unavailable'));
        this.clamp(this.recognitionIntro, DEBRIEF_META_FONT_SIZE, debriefRecognitionIntroBand(canvasWidth).height);

        // The **snapshot's** recognition, never `state.recognition`: the live field belongs to whatever
        // investigation is running now, and on a completed record that is the replay's (D2).
        const items = completion ? selectLocalizedRecognition(state, completion.recognition.items) : [];
        this.recognitionRows.forEach((row, index) => {
            const item = items[index];
            const objects = [row.label, row.status, row.description];
            if (!item) {
                objects.forEach((object) => object.setVisible(false));
                return;
            }
            objects.forEach((object) => object.setVisible(true));
            row.label.setText(item.label);
            row.status.setText(item.achieved ? t('debrief.recognition.achieved') : t('debrief.recognition.notRecorded'));
            row.status.setColor(item.achieved ? RECOGNITION_ON_COLOR : META_COLOR);
            row.description.setText(item.description);
            const band = debriefRecognitionRowBand(index, canvasWidth);
            this.clamp(row.label, DEBRIEF_RECOGNITION_LABEL_FONT_SIZE, Math.ceil(DEBRIEF_RECOGNITION_LABEL_FONT_SIZE * 1.35));
            row.description.setY(band.y + row.label.height);
            this.clamp(row.description, DEBRIEF_META_FONT_SIZE, band.y + band.height - row.description.y);
        });
    }

    /**
     * The shared lower band: the challenge on show, or the deeper theory the player has opened.
     *
     * One region with two tenants, for the reason `debriefLowerBand`'s docstring measures out. The
     * paging controls and the heading belong to the challenges and are hidden while the layer is open.
     */
    private renderLowerBand(
        t: Translator,
        state: AppState,
        debrief: ReturnType<typeof selectLocalizedDebrief>,
        completion: ReturnType<typeof selectCompletionSnapshot>,
        canvasWidth: number,
        canvasHeight: number
    ): void {
        const body = debriefLowerBodyBand(canvasWidth, canvasHeight);
        this.toggleTitle?.setText(debrief.deeperTheory.title);
        this.toggleState?.setText(t(this.deeperTheoryOpen ? 'debrief.deeperTheory.hide' : 'debrief.deeperTheory.show'));

        if (this.deeperTheoryOpen) {
            [this.lowerHeading, this.earlierSurface, this.earlierLabel, this.laterSurface, this.laterLabel, this.lowerSpeaker]
                .forEach((object) => object?.setVisible(false));
            this.earlierSurface?.disableInteractive();
            this.laterSurface?.disableInteractive();
            this.lowerBody?.setVisible(true).setY(body.y).setText(debrief.deeperTheory.text);
            this.clamp(this.lowerBody, DEBRIEF_BODY_FONT_SIZE, body.height);
            return;
        }

        const history = selectLocalizedCritiqueHistory(state);
        this.critiqueIndex = Math.min(this.critiqueIndex, Math.max(0, history.length - 1));
        const entry: LocalizedCritiqueHistoryEntry | undefined = history[this.critiqueIndex];

        this.lowerHeading?.setVisible(true).setText(history.length > 1
            ? t('debrief.critiques.headingCounted', { index: this.critiqueIndex + 1, total: history.length })
            : t('debrief.critiques.heading'));

        const pages = history.length > 1;
        [this.earlierSurface, this.earlierLabel, this.laterSurface, this.laterLabel]
            .forEach((object) => object?.setVisible(pages));
        this.earlierLabel?.setText(t('debrief.critiques.earlier'));
        this.laterLabel?.setText(t('debrief.critiques.later'));
        this.armPageControl(this.earlierSurface, pages && this.critiqueIndex > 0);
        this.armPageControl(this.laterSurface, pages && this.critiqueIndex < history.length - 1);

        if (!entry) {
            this.lowerSpeaker?.setVisible(false);
            // A completed case that drew no challenge, and a record with no completion at all, are two
            // different facts and get two different sentences.
            this.lowerBody?.setVisible(true).setY(body.y)
                .setText(completion ? t('debrief.critiques.empty') : t('debrief.record.unavailable'));
            this.clamp(this.lowerBody, DEBRIEF_CRITIQUE_FONT_SIZE, body.height);
            return;
        }

        this.lowerSpeaker?.setVisible(true).setY(body.y).setText(entry.speaker);
        this.clamp(this.lowerSpeaker, DEBRIEF_META_FONT_SIZE, Math.ceil(DEBRIEF_META_FONT_SIZE * 1.35));
        const proseTop = body.y + (this.lowerSpeaker?.height ?? 0) + DEBRIEF_ROW_GAP;
        this.lowerBody?.setVisible(true).setY(proseTop).setText(entry.line);
        this.clamp(this.lowerBody, DEBRIEF_CRITIQUE_FONT_SIZE, body.y + body.height - proseTop);
    }

    /**
     * The counterfactual warning (AC2, AC4).
     *
     * The **authored** `debrief.replayLabel`, which already reads as a warning in both locales. The
     * retired DOM panel used it as a *button* label and hard-coded a separate English-only warning line
     * beside it; the control's own label is the interface key `advance.replay`, and this is the prose.
     *
     * It is only visible on the second pass, and that is the honest reading of AC4:
     * `reduceReplayStart` sets `isCounterfactual` and moves the phase to `context`, so this room shuts
     * down immediately and the flag is next seen when the player completes the replay and comes back.
     * A session-wide marker across every scene would be new cross-scene chrome no AC asks for and no
     * scene owns — flagged as Open Question 6 rather than built.
     */
    private renderCounterfactual(state: AppState, debrief: ReturnType<typeof selectLocalizedDebrief>): void {
        const { isCounterfactual } = selectReplayState(state);
        this.counterfactual?.setVisible(isCounterfactual).setText(isCounterfactual ? debrief.replayLabel : '');
        if (!isCounterfactual || !this.counterfactual) return;
        const { width, height } = this.scene.scale;
        const band = debriefCounterfactualBand(width, height);
        this.clamp(this.counterfactual, DEBRIEF_WARNING_FONT_SIZE, band.height - (2 * DEBRIEF_BAND_PADDING));
    }

    // --- Construction and clamping --------------------------------------------------------------------

    private text(
        x: number,
        y: number,
        fontSize: number,
        color: string,
        wrapWidth: number
    ): Phaser.GameObjects.Text {
        const object = this.scene.add.text(x, y, '', uiTextStyle({
            color, fontSize: `${fontSize}px`, wordWrap: { width: Math.max(1, wrapWidth) }
        }));
        this.objects.push(object);
        return object;
    }

    /** A text inset in a band, under whatever heading the band already spends its top on. */
    private textInBand(band: DebriefRect, fontSize: number, color: string, wrapWidth: number): Phaser.GameObjects.Text {
        return this.text(band.x + DEBRIEF_BAND_PADDING, band.y + DEBRIEF_BAND_PADDING, fontSize, color, wrapWidth);
    }

    private panel(band: DebriefRect): Phaser.GameObjects.Rectangle {
        const surface = this.scene.add
            .rectangle(band.x, band.y, band.width, band.height, BAND_FILL)
            .setOrigin(0, 0)
            .setStrokeStyle(1, BAND_RIM);
        this.objects.push(surface);
        return surface;
    }

    private pageControl(direction: -1 | 1, canvasWidth: number, canvasHeight: number): Phaser.GameObjects.Rectangle {
        const band = debriefPageControlBand(direction, canvasWidth, canvasHeight);
        const surface = this.scene.add
            .rectangle(band.x, band.y, DEBRIEF_PAGE_CONTROL_WIDTH, DEBRIEF_PAGE_CONTROL_HEIGHT, PAGE_CONTROL_FILL)
            .setOrigin(0, 0);
        surface.on('pointerup', () => this.turnCritiquePage(direction));
        this.objects.push(surface);
        return surface;
    }

    private pageControlLabel(direction: -1 | 1, canvasWidth: number, canvasHeight: number): Phaser.GameObjects.Text {
        const band = debriefPageControlBand(direction, canvasWidth, canvasHeight);
        return this.text(
            band.x + (DEBRIEF_PAGE_CONTROL_WIDTH / 2),
            band.y + (DEBRIEF_PAGE_CONTROL_HEIGHT / 2),
            DEBRIEF_PAGE_CONTROL_FONT_SIZE, BODY_COLOR, debriefPageControlLabelWrap()
        ).setOrigin(0.5, 0.5);
    }

    /**
     * A paging control at either end of the history is drawn dead **and** made non-interactive.
     *
     * Both halves matter: the fill is what the player reads, and `disableInteractive` is what stops a
     * click on a control that cannot move being handled at all. The bench's lock/unlock behaviour was
     * indistinguishable from its usable state until `sceneSlice` started recording `interactive`
     * (2.10 review), so this is asserted rather than assumed.
     */
    private armPageControl(surface: Phaser.GameObjects.Rectangle | undefined, enabled: boolean): void {
        if (!surface) return;
        surface.setFillStyle(enabled ? PAGE_CONTROL_FILL : PAGE_CONTROL_FILL_OFF);
        if (enabled) surface.setInteractive({ useHandCursor: true });
        else surface.disableInteractive();
    }

    /**
     * Keeps a growable text inside the band it was given.
     *
     * **The font size is restored before anything is measured.** `LibraryRenderer.clampRelationship`
     * shipped without that and shrank permanently across artifacts and locales, because a shrink taken
     * for one long French string measured as "already fits" for the next and never came back (2.8
     * review patch). The crop is released for the same reason.
     *
     * Shrink to {@link DEBRIEF_MIN_FONT_SIZE}, then crop. The crop is what makes a band a guarantee
     * rather than an estimate: this canvas does not scroll, the content schema puts no `.max()` on any
     * of the prose in this room, and the alternative is authored text painted over the way out of it.
     */
    private clamp(text: Phaser.GameObjects.Text | undefined, authoredFontSize: number, available: number): void {
        if (!text) return;
        text.setFontSize(authoredFontSize).setCrop();
        if (available <= 0) {
            text.setVisible(false);
            return;
        }
        for (let fontSize = authoredFontSize; fontSize >= DEBRIEF_MIN_FONT_SIZE && text.height > available; fontSize -= 1) {
            text.setFontSize(fontSize);
        }
        if (text.height > available) text.setCrop(0, 0, text.width, available);
    }

    /** What a band has left under a text that has already been positioned inside it. */
    private roomFor(band: DebriefRect, text: Phaser.GameObjects.Text): number {
        return band.y + band.height - DEBRIEF_BAND_PADDING - text.y;
    }

    // --- The two ephemeral gestures ---------------------------------------------------------------------

    /**
     * Opens and closes the optional deeper-theory layer.
     *
     * **Dispatches nothing.** Reading is not an act on the record, and the flag is widget-local — see
     * {@link deeperTheoryOpen}. The scene repaints from its own store subscription on every dispatch,
     * so this repaints itself.
     */
    private toggleDeeperTheory(): void {
        this.deeperTheoryOpen = !this.deeperTheoryOpen;
        this.repaint();
    }

    private turnCritiquePage(direction: -1 | 1): void {
        const state = this.storeAdapter.getState();
        const total = selectLocalizedCritiqueHistory(state).length;
        const next = Math.max(0, Math.min(total - 1, this.critiqueIndex + direction));
        if (next === this.critiqueIndex) return;
        this.critiqueIndex = next;
        this.repaint();
    }

    /**
     * Repaints after a gesture that changed only widget-local presentation.
     *
     * The store is read rather than a cached state re-used, the same shape `NotebookRenderer.repaint`
     * has: the two flags this room owns are ephemeral, but everything around them is not, and a paint
     * from a stale snapshot would put the record back as it was several dispatches ago.
     */
    private repaint(): void {
        this.render(this.storeAdapter.getState());
    }
}
