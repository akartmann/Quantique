import type { Scene } from 'phaser';

import type { PhaserStoreAdapter } from '../PhaserStoreAdapter';
import { uiTextStyle } from '../textStyles';
import type { AppState } from '../../../core/store/AppState';
import { decimalPlaces, formatMeasurement, formatRecordedValue } from '../../../core/i18n/formatNumber';
import { createTranslator, type Translator } from '../../../core/i18n/translate';
import {
    selectComparisonNote,
    selectLocale,
    selectLocalizedError,
    selectNotebookObservations,
    findPrimaryControl
} from '../../../core/store/selectors';
import type { RunRecord } from '../../../domain/evidence/RunRecord';
import {
    NOTEBOOK_ACTION_FONT_SIZE,
    NOTEBOOK_ACTION_HEIGHT,
    NOTEBOOK_ACTION_LABEL_WRAP,
    NOTEBOOK_ACTION_ROW_Y,
    NOTEBOOK_ACTION_WIDTH,
    NOTEBOOK_CLOSE_LEFT,
    NOTEBOOK_GUIDE_FONT_SIZE,
    NOTEBOOK_GUIDE_Y,
    NOTEBOOK_HEADING_FONT_SIZE,
    NOTEBOOK_HEADING_Y,
    NOTEBOOK_NOTE_FIELD_HEIGHT,
    NOTEBOOK_NOTE_FIELD_WIDTH,
    NOTEBOOK_NOTE_FIELD_Y,
    NOTEBOOK_NOTE_FONT_SIZE,
    NOTEBOOK_NOTE_LABEL_Y,
    NOTEBOOK_NOTE_MAX_LENGTH,
    NOTEBOOK_NOTE_PADDING,
    NOTEBOOK_NOTE_TEXT_WRAP,
    NOTEBOOK_PADDING,
    NOTEBOOK_PAGE_CONTROL_HEIGHT,
    NOTEBOOK_PAGE_CONTROL_WIDTH,
    NOTEBOOK_PAGE_ROW_Y,
    NOTEBOOK_PANEL_HEIGHT,
    NOTEBOOK_PANEL_WIDTH,
    NOTEBOOK_PANEL_X,
    NOTEBOOK_PANEL_Y,
    NOTEBOOK_ROWS_PER_PAGE,
    NOTEBOOK_ROW_FONT_SIZE,
    NOTEBOOK_ROW_LEFT,
    NOTEBOOK_ROW_META_FONT_SIZE,
    NOTEBOOK_ROW_TEXT_WRAP,
    NOTEBOOK_ROW_WIDTH,
    NOTEBOOK_SAVE_LEFT,
    NOTEBOOK_STATUS_TEXT_WRAP,
    NOTEBOOK_SELECT_HEIGHT,
    NOTEBOOK_SELECT_WIDTH,
    notebookPageControlCentre,
    notebookRowBand,
    notebookSelectionCentre
} from './apparatusGeometry';
import { SingleKeyDelivery } from './singleKeyDelivery';
import { TransientMessageSlot } from './transientMessage';
import { resolveExperimentModel, resolveResultUnit } from '../../../domain/apparatus/experimentModels';

/**
 * The bench notebook (Story 2.10, AC8): every saved observation, readable in-scene, with any two
 * comparable and a note saved against the pair.
 *
 * It closes the last three of the four intents `canvas-transitions.spec.ts` listed as canvas-
 * unreachable — `comparison.runSelected`, `comparison.runUnselected` and `comparison.noteSaved`, whose
 * only dispatcher was the retired `src/ui/notebook/NotebookPanel.ts` (ADR-011).
 *
 * ## An overlay the player opens, not a permanent panel (D3)
 *
 * Measured, not preferred. After the tableau, the readouts, the instruments, the chooser and the side
 * column, the bench has no band left for a run list with two selections and a note field, and the
 * surface is a fixed 1024×768 that does not scroll. `ReferenceBookPresenter` is the established shape
 * for "a second surface in the same room": the **scene** owns it and suppresses its own apparatus
 * input while it is up, because a click meant for the overlay that fell through would move a slit.
 * There is no scene→scene reach-in anywhere in it.
 *
 * ## No saved run is ever recalculated
 *
 * Every field comes out of the stored {@link RunRecord} — `record.result`, `record.controls`,
 * `record.modelInputs`, `record.experimentModelVersion` — exactly as it was written. There is no call
 * to `calculateYoungFringeSpacing` here and there must never be one; `NotebookRenderer.test.ts` and
 * the model-derivation sweep in `YoungRunRecord.test.ts` pin that at source level, because a comment
 * is not an assertion. The authored `label` on a result is canonical and is interpolated into a
 * localized template, which is the same rule `print.observations.item` follows.
 *
 * ## The note is typed into the canvas (D5)
 *
 * `comparison.noteSaved` takes free text, the reducer rejects a blank one, and the note reaches the
 * exported record and the print view — so it cannot become a choice from a list without a store and
 * content change this story does not own. A DOM `<input>` over the canvas is the other option and it
 * is the one §Engine forbids. So: a Phaser `Text` fed by `scene.input.keyboard`, accepting a
 * single-character key plus `Backspace` and `Enter` (save), with a drawn caret and a length bound.
 * `Escape` closes the notebook.
 *
 * It takes keys **from the moment a pair is selected**, rather than from a click into it. There is one
 * text field in this overlay and no cursor on a canvas to invite a click into it, so a field that sat
 * inert until clicked would be a discoverability trap with nothing on screen to say so — and the only
 * moment the note can be saved at all is the moment a pair exists.
 *
 * **The limitation, stated rather than discovered later:** a dead-key accent (typing `´` then `e` on a
 * US-International layout) arrives as a `Dead` keydown followed by the base letter, so it inserts `e`
 * rather than `é`. An AZERTY keyboard — the realistic French player's — carries `é è à ç ù` as
 * dedicated keys and is unaffected. If it turns out to matter it is a follow-up with a named cost, not
 * a gap papered over with a DOM element.
 */

/**
 * Above the bench, below the reference book.
 *
 * Depth rather than creation order, because creation order is a fact about one `create()` that a later
 * story can reorder without noticing — and the 2.9 review found a whole room painted over everything
 * for exactly that reason. `LectureBookRenderer` sits at 10 000, and the two overlays cannot be up at
 * once anyway (the bench's notebook control is suppressed while the book is open), so the ordering
 * between them is stated rather than left to chance.
 */
const NOTEBOOK_DEPTH = 9_000;

const BACKDROP = 0x061319;
const PANEL_FILL = 0x10252c;
const PANEL_RIM = 0x4d7f8c;
const ROW_FILL = 0x16323b;
const ROW_FILL_SELECTED = 0x1f4a45;
const SELECT_FILL = 0x1d4451;
const SELECT_FILL_ON = 0x276b55;
const ACTION_FILL = 0x1d4451;
const NOTE_FILL = 0x0b1a20;
const NOTE_RIM_FOCUSED = 0xf4d35e;

/**
 * The keys the note field claims from the page while it is open.
 *
 * A mutable array because `addCapture` / `removeCapture` take one; module-private and never written to,
 * the same shape `ARROW_KEY_CAPTURE` has in `ApparatusRenderer`. See {@link NotebookRenderer.syncKeyCapture}
 * for why consuming a key is not enough on its own.
 */
const NOTE_KEY_CAPTURE: string[] = ['SPACE', 'BACKSPACE', 'ENTER', 'ESC'];

/** Everything this overlay draws is one of these two. See {@link NotebookRenderer.objects}. */
type NotebookObject = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text;

type ObservationRow = Readonly<{
    background: Phaser.GameObjects.Rectangle;
    title: Phaser.GameObjects.Text;
    settings: Phaser.GameObjects.Text;
    meta: Phaser.GameObjects.Text;
    selectSurface: Phaser.GameObjects.Rectangle;
    selectLabel: Phaser.GameObjects.Text;
}>;

export type NotebookRendererOptions = Readonly<{
    /**
     * Fired when the notebook appears and when it is dismissed. The **owning scene** suppresses its
     * own apparatus input from this — an intra-scene call, never a reach into another scene.
     */
    onVisibilityChange: (visible: boolean) => void;
}>;

export class NotebookRenderer {
    /**
     * Only rectangles and text, which is what lets one list drive depth, visibility and teardown:
     * both carry `setDepth` and `setVisible`, and the bare `GameObject` base type carries neither.
     */
    private readonly objects: NotebookObject[] = [];
    private readonly rows: ObservationRow[] = [];
    private backdrop?: Phaser.GameObjects.Rectangle;
    private heading?: Phaser.GameObjects.Text;
    private guide?: Phaser.GameObjects.Text;
    private pageCounter?: Phaser.GameObjects.Text;
    private earlierSurface?: Phaser.GameObjects.Rectangle;
    private earlierLabel?: Phaser.GameObjects.Text;
    private laterSurface?: Phaser.GameObjects.Rectangle;
    private laterLabel?: Phaser.GameObjects.Text;
    private noteHeading?: Phaser.GameObjects.Text;
    private noteField?: Phaser.GameObjects.Rectangle;
    private noteText?: Phaser.GameObjects.Text;
    private noteCaret?: Phaser.GameObjects.Rectangle;
    private saveSurface?: Phaser.GameObjects.Rectangle;
    private saveLabel?: Phaser.GameObjects.Text;
    private closeSurface?: Phaser.GameObjects.Rectangle;
    private closeLabel?: Phaser.GameObjects.Text;
    private statusLine?: Phaser.GameObjects.Text;

    private visible = false;
    /**
     * Which page of observations is showing, and whether the note field has the keyboard.
     *
     * Both ephemeral and renderer-local, exactly as the reference book's spread index is and for the
     * reason that widget's docstring gives: they mean nothing five seconds later, and a store field
     * for either would be persisted, exported, re-validated and reset on replay.
     */
    private pageIndex = 0;
    /**
     * Whether the note field is taking keys.
     *
     * **Derived, not a click.** There is exactly one text field in this overlay, and on a canvas there
     * is no cursor to invite a click into it — a field that stayed inert until it was clicked would be
     * a discoverability trap with nothing on screen to say so. So it accepts keys from the moment the
     * player has a pair to write about, which is also the only moment the note can be saved at all.
     */
    private acceptsNoteKeys(state: AppState): boolean {
        return this.visible && state.comparison.selectedRunIds.length === 2;
    }
    private noteDraft = '';
    /** The pair the draft belongs to, so changing the selection does not carry a stale sentence over. */
    private noteDraftPairKey = '';
    private readonly status = new TransientMessageSlot<string>();
    /** One handling per physical key press — see {@link SingleKeyDelivery}. */
    private readonly keyDelivery = new SingleKeyDelivery();

    public constructor(
        private readonly scene: Scene,
        private readonly storeAdapter: PhaserStoreAdapter,
        private readonly options: NotebookRendererOptions
    ) {}

    public get isOpen(): boolean {
        return this.visible;
    }

    public create(): void {
        // Built once and hidden, rather than constructed on open: `create()` runs synchronously inside
        // `dispatch() → notify()`, and a throw there advances the phase, skips later subscribers and
        // breaks `dispatch`'s `Result` contract (1.10 review). Construction stays cheap and defensive.
        const { width, height } = this.scene.scale;
        this.backdrop = this.scene.add.rectangle(0, 0, width, height, BACKDROP, 0.88).setOrigin(0, 0);
        // Interactive so a click anywhere outside the panel is swallowed rather than falling through
        // to a slit underneath. The scene's suppression is the other half of the same rule.
        this.backdrop.setInteractive({ useHandCursor: false });
        const panel = this.scene.add
            .rectangle(NOTEBOOK_PANEL_X, NOTEBOOK_PANEL_Y, NOTEBOOK_PANEL_WIDTH, NOTEBOOK_PANEL_HEIGHT, PANEL_FILL)
            .setOrigin(0, 0)
            .setStrokeStyle(2, PANEL_RIM);

        // Every string below is authored empty here and written in `render`: `create()` runs once and
        // the locale can change at any time.
        this.heading = this.text(NOTEBOOK_ROW_LEFT, NOTEBOOK_HEADING_Y, NOTEBOOK_HEADING_FONT_SIZE, '#f7f4ef', NOTEBOOK_PANEL_WIDTH - (2 * NOTEBOOK_PADDING));
        this.guide = this.text(NOTEBOOK_ROW_LEFT, NOTEBOOK_GUIDE_Y, NOTEBOOK_GUIDE_FONT_SIZE, '#c7d7d9', NOTEBOOK_PANEL_WIDTH - (2 * NOTEBOOK_PADDING));

        for (let index = 0; index < NOTEBOOK_ROWS_PER_PAGE; index += 1) {
            this.rows.push(this.createRow(index));
        }

        this.earlierSurface = this.pageControl(-1);
        this.earlierLabel = this.pageControlLabel(-1);
        this.laterSurface = this.pageControl(1);
        this.laterLabel = this.pageControlLabel(1);
        this.pageCounter = this.text(
            notebookPageControlCentre(1).x + (NOTEBOOK_PAGE_CONTROL_WIDTH / 2) + 16,
            NOTEBOOK_PAGE_ROW_Y + (NOTEBOOK_PAGE_CONTROL_HEIGHT / 2),
            NOTEBOOK_ROW_META_FONT_SIZE, '#9fc6bb', 240
        ).setOrigin(0, 0.5);

        this.noteHeading = this.text(NOTEBOOK_ROW_LEFT, NOTEBOOK_NOTE_LABEL_Y, NOTEBOOK_GUIDE_FONT_SIZE, '#9fc6bb', NOTEBOOK_NOTE_TEXT_WRAP);
        this.noteField = this.scene.add
            .rectangle(NOTEBOOK_ROW_LEFT, NOTEBOOK_NOTE_FIELD_Y, NOTEBOOK_NOTE_FIELD_WIDTH, NOTEBOOK_NOTE_FIELD_HEIGHT, NOTE_FILL)
            .setOrigin(0, 0)
            .setStrokeStyle(2, PANEL_RIM);
        this.noteText = this.text(
            NOTEBOOK_ROW_LEFT + NOTEBOOK_NOTE_PADDING,
            NOTEBOOK_NOTE_FIELD_Y + NOTEBOOK_NOTE_PADDING,
            NOTEBOOK_NOTE_FONT_SIZE, '#f7f4ef', NOTEBOOK_NOTE_TEXT_WRAP
        );
        // A drawn caret rather than a blinking one: a blink is an animation, and an animation would
        // need an update loop that `prefers-reduced-motion: reduce` forbids for the sake of a cursor.
        this.noteCaret = this.scene.add
            .rectangle(0, 0, 2, NOTEBOOK_NOTE_FONT_SIZE + 4, NOTE_RIM_FOCUSED)
            .setOrigin(0, 0)
            .setVisible(false);

        this.saveSurface = this.actionControl(NOTEBOOK_SAVE_LEFT, () => this.saveNote());
        this.saveLabel = this.actionLabel(NOTEBOOK_SAVE_LEFT);
        this.closeSurface = this.actionControl(NOTEBOOK_CLOSE_LEFT, () => this.close());
        this.closeLabel = this.actionLabel(NOTEBOOK_CLOSE_LEFT);
        this.statusLine = this.text(
            NOTEBOOK_SAVE_LEFT + NOTEBOOK_ACTION_WIDTH + 16,
            NOTEBOOK_ACTION_ROW_Y + (NOTEBOOK_ACTION_HEIGHT / 2),
            NOTEBOOK_ROW_META_FONT_SIZE, '#f4d35e',
            NOTEBOOK_STATUS_TEXT_WRAP
        ).setOrigin(0, 0.5);

        this.objects.push(this.backdrop, panel, this.heading, this.guide, this.pageCounter,
            this.noteHeading, this.noteField, this.noteText, this.noteCaret, this.statusLine);
        // One depth for the whole overlay, applied in one place, so nothing can be added later and
        // left behind the bench — see {@link NOTEBOOK_DEPTH}.
        this.allObjects().forEach((object) => object.setDepth(NOTEBOOK_DEPTH));
        this.scene.input.keyboard?.on('keydown', this.onKeyDown, this);
        this.applyVisibility();
    }

    /** Every display object this overlay owns, in one list, for depth, visibility and teardown. */
    private allObjects(): readonly NotebookObject[] {
        return [
            ...this.objects,
            this.earlierSurface, this.earlierLabel, this.laterSurface, this.laterLabel,
            this.saveSurface, this.saveLabel, this.closeSurface, this.closeLabel,
            ...this.rows.flatMap((row) => [row.background, row.title, row.settings, row.meta, row.selectSurface, row.selectLabel])
        ].filter((object): object is NotebookObject => object !== undefined);
    }

    /** Puts the notebook up. Dispatches nothing: reading the record is not an act on it. */
    public open(): void {
        if (this.visible) return;
        this.visible = true;
        this.pageIndex = this.lastPageIndex(this.storeAdapter.getState());
        this.syncKeyCapture();
        this.applyVisibility();
        this.render(this.storeAdapter.getState());
        this.options.onVisibilityChange(true);
    }

    public close(): void {
        if (!this.visible) return;
        this.visible = false;
        this.status.clear();
        this.syncKeyCapture();
        this.applyVisibility();
        this.options.onVisibilityChange(false);
    }

    /**
     * Captures the keys the note field consumes, for exactly as long as it is up.
     *
     * **Consuming a key is not the same as capturing it** (review 2026-08-07). Phaser calls
     * `preventDefault()` only for key codes in the manager's `captures` list
     * (`KeyboardManager.js`: `_this.captures.indexOf(event.keyCode) > -1`), and this field took none. So
     * every `SPACE` typed into a comparison note also scrolled the document under the canvas — the page is
     * scrollable, which is why `registerCanvasBoundsRefresh` exists — and `/` and `'` reached the browser
     * with their defaults intact. `event.key.length === 1` is a filter on what the field accepts, not a
     * claim on the key.
     *
     * `SPACE` and `BACKSPACE` are the two that actually misbehave: space scrolls, backspace is a history
     * step in some configurations. `ENTER` and `ESC` are claimed too, because the field acts on both and a
     * page that also acted on them would double-handle. Released on close, so the page gets its keys back
     * — the mistake the bench's arrow capture made in the other direction.
     */
    private syncKeyCapture(): void {
        const keyboard = this.scene.input.keyboard;
        if (!keyboard) return;
        if (this.visible) keyboard.addCapture(NOTE_KEY_CAPTURE);
        else keyboard.removeCapture(NOTE_KEY_CAPTURE);
    }

    /**
     * Repaints from the store.
     *
     * A no-op while closed, so the owning scene can call it unconditionally from its subscription
     * rather than guarding at the call site — the same shape `ReferenceBookPresenter.render` has.
     */
    public render(state: AppState): void {
        if (!this.visible) return;
        const locale = selectLocale(state);
        const t = createTranslator(locale);
        const observations = selectNotebookObservations(state);
        const pages = Math.max(1, Math.ceil(observations.length / NOTEBOOK_ROWS_PER_PAGE));
        this.pageIndex = Math.min(this.pageIndex, pages - 1);
        const from = this.pageIndex * NOTEBOOK_ROWS_PER_PAGE;

        this.heading?.setText(t('notebook.heading'));
        this.guide?.setText(observations.length === 0 ? t('notebook.empty') : t('notebook.guide'));

        this.rows.forEach((row, offset) => {
            const record = observations[from + offset];
            if (!record) {
                [row.background, row.title, row.settings, row.meta, row.selectSurface, row.selectLabel]
                    .forEach((object) => object.setVisible(false));
                row.selectSurface.disableInteractive();
                return;
            }
            const chosen = state.comparison.selectedRunIds.includes(record.id);
            [row.background, row.title, row.settings, row.meta, row.selectSurface, row.selectLabel]
                .forEach((object) => object.setVisible(true));
            row.background.setFillStyle(chosen ? ROW_FILL_SELECTED : ROW_FILL);
            row.title.setText(t('notebook.observation', { order: from + offset + 1 }));
            row.settings.setText(this.settingsLine(state, t, record));
            row.meta.setText(this.metaLine(state, t, record));
            row.selectSurface.setFillStyle(chosen ? SELECT_FILL_ON : SELECT_FILL).setInteractive({ useHandCursor: true });
            row.selectLabel.setText(chosen ? t('notebook.selected') : t('notebook.select'));
        });

        const showsPaging = observations.length > NOTEBOOK_ROWS_PER_PAGE;
        [this.earlierSurface, this.earlierLabel, this.laterSurface, this.laterLabel, this.pageCounter]
            .forEach((object) => object?.setVisible(showsPaging));
        this.earlierLabel?.setText(t('notebook.page.earlier'));
        this.laterLabel?.setText(t('notebook.page.later'));
        this.pageCounter?.setText(t('notebook.page.counter', {
            from: from + 1,
            to: Math.min(observations.length, from + NOTEBOOK_ROWS_PER_PAGE),
            total: observations.length
        }));

        this.renderNote(state, t);
        this.saveLabel?.setText(t('notebook.note.save'));
        this.closeLabel?.setText(t('notebook.close'));
        this.statusLine?.setText(this.status.read(state) ?? '');
    }

    public destroy(): void {
        this.scene.input.keyboard?.off('keydown', this.onKeyDown, this);
        // Captures are global in Phaser, so one left behind outlives this renderer and goes on swallowing
        // the page's own keys. Unconditional: cheaper than tracking whether it was held.
        this.scene.input.keyboard?.removeCapture(NOTE_KEY_CAPTURE);
        this.rows.forEach((row) => [row.background, row.title, row.settings, row.meta, row.selectSurface, row.selectLabel]
            .forEach((object) => object.destroy()));
        this.rows.length = 0;
        [this.earlierSurface, this.earlierLabel, this.laterSurface, this.laterLabel,
            this.saveSurface, this.saveLabel, this.closeSurface, this.closeLabel]
            .forEach((object) => object?.destroy());
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.backdrop = undefined; this.heading = undefined; this.guide = undefined; this.pageCounter = undefined;
        this.earlierSurface = undefined; this.earlierLabel = undefined;
        this.laterSurface = undefined; this.laterLabel = undefined;
        this.noteHeading = undefined; this.noteField = undefined; this.noteText = undefined; this.noteCaret = undefined;
        this.saveSurface = undefined; this.saveLabel = undefined;
        this.closeSurface = undefined; this.closeLabel = undefined; this.statusLine = undefined;
        this.visible = false; this.noteDraft = ''; this.noteDraftPairKey = '';
        this.pageIndex = 0;
        this.status.clear();
    }

    // --- The observation rows -------------------------------------------------------------------

    /**
     * The setup the observation was recorded at, read out of the record and never recomputed.
     *
     * Each control's label, unit and precision come from the authored definition, and the *value*
     * comes from `record.controls` — so a record saved before a content change still reads back the
     * numbers it was saved with.
     */
    private settingsLine(state: AppState, t: Translator, record: RunRecord): string {
        const locale = selectLocale(state);
        // **Composed from the case's own authored controls (Story 3.2).** The two ids were Young's,
        // written down here because `notebook.row.settings` had two authored slots — so the prototype's
        // notebook printed `slitSpacingMm —` beside `screenDistanceM —` for every observation it held.
        // Assigned to this story by the 3.1 review (`deferred-work.md`), and closed by making the row a
        // list over the apparatus rather than a sentence about two named quantities.
        //
        // `findPrimaryControl`, not `selectPrimaryControl`: the latter **throws** on an id the case does
        // not author, and this runs inside `render()` — inside `dispatch() → notify()`, where a throw
        // advances the phase, skips every later subscriber and strands the router with no visible error
        // (the 1.10 failure mode). A run restored against a changed `case.json` still degrades to the
        // canonical number rather than taking the scene down.
        const readout = (controlId: string): string => {
            const control = findPrimaryControl(state, controlId);
            const recorded = record.controls[controlId];
            if (!control || !Number.isFinite(recorded)) {
                return t('lab.control.readout', {
                    label: controlId,
                    value: Number.isFinite(recorded) ? String(recorded) : '—'
                });
            }
            return t('lab.control.readout', {
                label: control.label ? String(control.label[locale] ?? control.label.en) : controlId,
                value: formatMeasurement(locale, recorded, decimalPlaces(control.step), control.unit)
            });
        };
        return state.caseDefinition.apparatus.primaryControls
            .map(({ id }) => readout(id))
            .join(t('notebook.row.settingsSeparator'));
    }

    /**
     * The observed result and everything that qualifies it: when, at what wavelength and on which
     * path, and under which experiment model version.
     *
     * **The label is localized for a model-derived run and canonical for anything else**, which is
     * exactly what `CaseRecordPrintView` does with the same field and for the same reason: the Young
     * model's result has an authored name in both bundles (`experiment.result.fringeSpacing`), while a
     * pre-model observation carries a label this build cannot translate and must not invent one for.
     * Without the split a French player reads `"Fringe spacing : 4,4 mm"` — the project's
     * most-repeated defect, chrome localized and content not, in a single line.
     *
     * The *number* is localized for display only; the stored value is untouched.
     */
    private metaLine(state: AppState, t: Translator, record: RunRecord): string {
        const locale = selectLocale(state);
        // Localized by the *model's* declared key (Story 3.2), not by whether the run carries Young's
        // optical inputs: a case whose model records none still has a name for what it measured, and
        // reading `record.result.label` there put canonical English on a French row — the split this
        // docstring already describes, applied to the second case it was written before.
        const model = resolveExperimentModel(state.caseDefinition.experiment.modelId);
        const matchedModel = model && record.experimentModelVersion === state.caseDefinition.experiment.modelVersion
            ? model
            : undefined;
        const result = t('notebook.row.result', {
            label: matchedModel ? t(matchedModel.resultLabelKey) : record.result.label,
            // The unit is canonical English on the record too, so it takes the same route as the label.
            value: formatRecordedValue(locale, record.result.value, resolveResultUnit(matchedModel, record.result.unit, t))
        });
        if (!record.modelInputs) return result;
        return `${result}\n${t('notebook.row.meta', {
            timestamp: record.timestamp,
            wavelength: record.modelInputs.wavelengthNm,
            mode: t(`lab.wavelengthMode.${record.modelInputs.wavelengthMode}`),
            version: record.experimentModelVersion
        })}`;
    }

    /**
     * Puts an observation into the comparison, or takes it out.
     *
     * `state.comparison.selectedRunIds` is checked **before** dispatching, the same rule
     * `inspectSource`'s docstring states: the reducer refuses a third with `too-many-comparison-runs`
     * and that is the correct answer to a genuinely duplicated dispatch — but the player clicking a
     * third row did nothing wrong, and the surface answers that itself rather than provoking a refusal.
     */
    private toggleSelection(runId: string): void {
        const state = this.storeAdapter.getState();
        const selected = state.comparison.selectedRunIds;
        if (selected.includes(runId)) {
            const result = this.storeAdapter.unselectComparisonRun(runId);
            if (!result.ok) {
                this.status.set(selectLocalizedError(state, result.error), state);
                this.repaint();
            }
            return;
        }
        if (selected.length >= 2) {
            const t = createTranslator(selectLocale(state));
            // Its **own** string, not `notebook.pairRequired` (review 2026-08-07). A player holding two
            // and reaching for a third was being told "Choose two saved observations to compare." — an
            // instruction to do the thing they had already done, with nothing to say which one to release
            // and a row that did not change when clicked, so the control read as dead.
            this.status.set(t('notebook.releaseOneFirst'), state);
            this.repaint();
            return;
        }
        const result = this.storeAdapter.selectComparisonRun(runId);
        // A refused selection is answered rather than dropped: `createStore` refuses every action with
        // `progress-operation-active` while an export or import holds the lock, and a silent no-op there
        // is indistinguishable from a dead control. `saveNote` already answers its refusals this way.
        if (!result.ok) {
            this.status.set(selectLocalizedError(state, result.error), state);
            this.repaint();
        }
    }

    private turnPage(direction: -1 | 1): void {
        const next = Math.max(0, Math.min(this.lastPageIndex(this.storeAdapter.getState()), this.pageIndex + direction));
        if (next === this.pageIndex) return;
        this.pageIndex = next;
        this.repaint();
    }

    private lastPageIndex(state: AppState): number {
        return Math.max(0, Math.ceil(selectNotebookObservations(state).length / NOTEBOOK_ROWS_PER_PAGE) - 1);
    }

    // --- The comparison note --------------------------------------------------------------------

    /**
     * Points the draft at the pair currently selected, loading whatever note that pair already has.
     *
     * **Called before a keystroke is applied as well as before a paint**, which is the whole point.
     * It used to live inside `renderNote` alone, and the ordering swallowed the first character typed
     * after a selection: the key handler appended to the old draft, called `repaint()`, and the paint
     * then noticed the pair had changed and reset the draft — losing the character. It only worked in
     * the browser because the store's own subscription happened to repaint after each selection first,
     * which is correctness resting on somebody else's schedule.
     */
    private syncNoteDraft(state: AppState): void {
        const pairKey = [...state.comparison.selectedRunIds].sort().join('|');
        if (pairKey === this.noteDraftPairKey) return;
        // A draft belongs to the pair it was typed against. Changing the selection starts a new one
        // rather than carrying a sentence about two other observations over to these.
        this.noteDraftPairKey = pairKey;
        // **Bounded on the way in, not only on the way in from the keyboard** (review 2026-08-07). The
        // insert branch of `onKeyDown` enforces `NOTEBOOK_NOTE_MAX_LENGTH`; nothing bounded a note arriving
        // from the record. `CaseRecordSchema` puts no `.max()` on note text, the reducer applies none, and
        // the still-mounted DOM `NotebookPanel` writes it from a `<textarea>` with no `maxlength` and no
        // newline restriction — so an imported or DOM-authored note of any length loaded straight into a
        // 62 px field with no clipping, running through its rim and over the save and close controls to the
        // panel floor. The player could not type but could backspace, so the field's own bound was
        // unreachable from there. Newlines go too: this field cannot produce one, and the caret's line
        // arithmetic multiplies by the count.
        const stored = selectComparisonNote(state)?.text ?? '';
        this.noteDraft = stored.replace(/\s*\n+\s*/g, ' ').slice(0, NOTEBOOK_NOTE_MAX_LENGTH);
    }

    private renderNote(state: AppState, t: Translator): void {
        this.syncNoteDraft(state);
        this.noteHeading?.setText(t('notebook.note.label'));
        const empty = this.noteDraft.length === 0;
        const live = this.acceptsNoteKeys(state);
        /**
         * Two different placeholders, because the field has two different empty states.
         *
         * With no pair chosen there is nothing to write about, so it says so. With a pair chosen and
         * nothing typed yet, `notebook.note.empty` — *"Type your comparison here, then save it."* — is
         * the invitation, and it was **authored in both locales and drawn by nothing**: this branch fell
         * through to `''`, so a player who had just selected two observations faced a blank rimmed box
         * with a caret and no statement of what it wanted. Meanwhile the typography sweep measured the
         * dead key and measured `notebook.pairRequired` at the wrong font size (review 2026-08-07).
         */
        const placeholder = live ? t('notebook.note.empty') : t('notebook.pairRequired');
        this.noteText?.setText(empty ? placeholder : this.noteDraft)
            .setColor(empty ? '#7d959c' : '#f7f4ef');
        this.noteField?.setStrokeStyle(2, live ? NOTE_RIM_FOCUSED : PANEL_RIM);
        const text = this.noteText;
        this.noteCaret?.setVisible(live);
        if (live && text) {
            const { x, y } = this.caretOffset(empty ? '' : this.noteDraft, text);
            this.noteCaret?.setPosition(text.x + x, text.y + y);
        }
    }

    /**
     * Where the caret sits for a draft, in the field's own coordinates.
     *
     * **Soft wraps count** (review 2026-08-07). This used to split the draft on `\n` and measure the last
     * piece — but the draft can never contain a `\n` (`Enter` saves and `event.key.length !== 1` rejects
     * one), so `lines.length` was always 1, `measureWidth` saturated at `NOTEBOOK_NOTE_TEXT_WRAP`, and the
     * caret parked at the right-hand edge of the first visual row while the text carried on two rows
     * below. Wrapping is the normal case here, not the exception: the wrap is 896 px at 14 px — roughly
     * 125 characters — against a 280-character bound.
     *
     * `Text.getWrappedText` is Phaser's own answer and gives the rows it will actually draw, so the caret
     * is placed against the same wrapping the player sees rather than against a guess about it.
     */
    private caretOffset(draft: string, text: Phaser.GameObjects.Text): Readonly<{ x: number; y: number }> {
        if (draft.length === 0) return { x: 0, y: 0 };
        const rows = text.getWrappedText(draft);
        // A field narrower than one character, or a Phaser build that declines to wrap, still gets a caret
        // rather than a `NaN` position.
        const lastRow = rows.length > 0 ? rows[rows.length - 1]! : draft;
        const rowIndex = Math.max(0, rows.length - 1);
        return {
            x: this.measureWidth(lastRow, text),
            y: rowIndex * (NOTEBOOK_NOTE_FONT_SIZE + 4)
        };
    }

    /**
     * How wide a run of text is, measured with the same object that will draw it.
     *
     * `Text.width` after a `setText` would be the whole wrapped block; this asks the text object's own
     * context for one line, which is what a caret needs. Called once per repaint, never per frame.
     */
    private measureWidth(line: string, text: Phaser.GameObjects.Text): number {
        if (line.length === 0) return 0;
        const metrics = text.context.measureText(line);
        return Math.min(metrics.width, NOTEBOOK_NOTE_TEXT_WRAP);
    }

    /**
     * The canvas text field.
     *
     * Guarded on {@link acceptsNoteKeys} so it cannot reach an instrument's arrow-key stepping and an
     * instrument's stepping cannot reach it — the apparatus renderer's own `keydown` is suppressed by
     * the scene while this overlay is up, so there is one guard on each side rather than three.
     *
     * `event.key.length === 1` is the printable-character test. A dead-key accent arrives as `Dead`
     * followed by the base letter and therefore inserts the unaccented one; see the class header for
     * why that is recorded rather than worked around.
     */
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        // Phaser can deliver one press twice — see the guard's header. Typing a sentence here is what
        // found it: one doubled character in forty-two, intermittent and timing-dependent.
        if (!this.keyDelivery.accepts(event)) return;
        if (!this.visible) return;
        if (event.key === 'Escape') {
            this.close();
            return;
        }
        const state = this.storeAdapter.getState();
        if (!this.acceptsNoteKeys(state)) return;
        // Before the keystroke is applied, never after — see {@link syncNoteDraft}.
        this.syncNoteDraft(state);
        if (event.key === 'Enter') { this.saveNote(); return; }
        if (event.key === 'Backspace') {
            this.noteDraft = this.noteDraft.slice(0, -1);
            this.repaint();
            return;
        }
        if (event.key.length !== 1 || this.noteDraft.length >= NOTEBOOK_NOTE_MAX_LENGTH) return;
        this.noteDraft += event.key;
        this.repaint();
    };

    /**
     * Saves what the player made of the pair.
     *
     * The reducer refuses a blank note (`invalid-comparison-note`) and a selection that is not exactly
     * two (`comparison-pair-required`); both are answered with the existing localized errors rather
     * than swallowed, because a control that refuses in silence is indistinguishable from a dead one.
     */
    private saveNote(): void {
        const before = this.storeAdapter.getState();
        const result = this.storeAdapter.saveComparisonNote(this.noteDraft);
        const t = createTranslator(selectLocale(before));
        if (!result.ok) {
            this.status.set(selectLocalizedError(before, result.error), before);
            this.repaint();
            return;
        }
        // Anchored to the state the save produced, so the confirmation survives until something else
        // really changes rather than being erased by this renderer's own follow-up paint.
        this.status.set(t('notebook.note.saved'), this.storeAdapter.getState());
        this.repaint();
    }

    private repaint(): void {
        this.render(this.storeAdapter.getState());
    }

    // --- Construction helpers -------------------------------------------------------------------

    private text(x: number, y: number, fontSize: number, color: string, wrapWidth: number): Phaser.GameObjects.Text {
        return this.scene.add.text(x, y, '', uiTextStyle({ color, fontSize: `${fontSize}px`, wordWrap: { width: wrapWidth } }));
    }

    private createRow(index: number): ObservationRow {
        const band = notebookRowBand(index);
        const background = this.scene.add.rectangle(band.x, band.y, band.width, band.height, ROW_FILL).setOrigin(0, 0);
        const title = this.text(band.x + 12, band.y + 8, NOTEBOOK_ROW_FONT_SIZE, '#f4d35e', NOTEBOOK_ROW_TEXT_WRAP);
        const settings = this.text(band.x + 12, band.y + 26, NOTEBOOK_ROW_FONT_SIZE, '#f7f4ef', NOTEBOOK_ROW_TEXT_WRAP);
        const meta = this.text(band.x + 12 + (NOTEBOOK_ROW_WIDTH / 2), band.y + 8, NOTEBOOK_ROW_META_FONT_SIZE, '#c7d7d9', (NOTEBOOK_ROW_WIDTH / 2) - 24);
        const centre = notebookSelectionCentre(index);
        const selectSurface = this.scene.add
            .rectangle(centre.x, centre.y, NOTEBOOK_SELECT_WIDTH, NOTEBOOK_SELECT_HEIGHT, SELECT_FILL)
            .setOrigin(0.5, 0.5);
        const selectLabel = this.scene.add.text(centre.x, centre.y, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${NOTEBOOK_ROW_FONT_SIZE}px`, align: 'center', wordWrap: { width: NOTEBOOK_SELECT_WIDTH - 16 }
        })).setOrigin(0.5, 0.5);
        // The row's own record is looked up at click time rather than captured: the list is paged, so
        // the record under a row changes and a captured id would compare the wrong observation.
        selectSurface.on('pointerup', () => {
            const record = selectNotebookObservations(this.storeAdapter.getState())[(this.pageIndex * NOTEBOOK_ROWS_PER_PAGE) + index];
            if (record) this.toggleSelection(record.id);
        });
        return { background, title, settings, meta, selectSurface, selectLabel };
    }

    private pageControl(direction: -1 | 1): Phaser.GameObjects.Rectangle {
        const centre = notebookPageControlCentre(direction);
        const surface = this.scene.add
            .rectangle(centre.x, centre.y, NOTEBOOK_PAGE_CONTROL_WIDTH, NOTEBOOK_PAGE_CONTROL_HEIGHT, ACTION_FILL)
            .setOrigin(0.5, 0.5);
        surface.on('pointerup', () => this.turnPage(direction));
        return surface;
    }

    private pageControlLabel(direction: -1 | 1): Phaser.GameObjects.Text {
        const centre = notebookPageControlCentre(direction);
        return this.scene.add.text(centre.x, centre.y, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${NOTEBOOK_ROW_FONT_SIZE}px`, align: 'center', wordWrap: { width: NOTEBOOK_PAGE_CONTROL_WIDTH - 16 }
        })).setOrigin(0.5, 0.5);
    }

    private actionControl(left: number, onPress: () => void): Phaser.GameObjects.Rectangle {
        const surface = this.scene.add
            .rectangle(left, NOTEBOOK_ACTION_ROW_Y, NOTEBOOK_ACTION_WIDTH, NOTEBOOK_ACTION_HEIGHT, ACTION_FILL)
            .setOrigin(0, 0);
        surface.on('pointerup', onPress);
        return surface;
    }

    private actionLabel(left: number): Phaser.GameObjects.Text {
        return this.scene.add.text(
            left + (NOTEBOOK_ACTION_WIDTH / 2),
            NOTEBOOK_ACTION_ROW_Y + (NOTEBOOK_ACTION_HEIGHT / 2),
            '',
            uiTextStyle({ color: '#f7f4ef', fontSize: `${NOTEBOOK_ACTION_FONT_SIZE}px`, align: 'center', wordWrap: { width: NOTEBOOK_ACTION_LABEL_WRAP } })
        ).setOrigin(0.5, 0.5);
    }

    /**
     * Shows or hides every object at once, and takes the input with it.
     *
     * Visibility alone is not suppression: a hidden `Rectangle` keeps its hit area, so an invisible
     * close control would still swallow a click meant for the bench underneath.
     */
    private applyVisibility(): void {
        this.allObjects().forEach((object) => object.setVisible(this.visible));
        // The note field is deliberately **not** here: it takes keys from the selection rather than
        // from a click, so an interactive rectangle over it would only swallow clicks the backdrop
        // already accounts for.
        const interactive = [this.backdrop, this.earlierSurface, this.laterSurface,
            this.saveSurface, this.closeSurface, ...this.rows.map((row) => row.selectSurface)];
        interactive.forEach((surface) => {
            if (!surface) return;
            if (this.visible) surface.setInteractive({ useHandCursor: surface !== this.backdrop });
            else surface.disableInteractive();
        });
        this.noteCaret?.setVisible(this.visible && this.acceptsNoteKeys(this.storeAdapter.getState()));
    }
}
