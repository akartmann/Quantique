import type { Scene } from 'phaser';

import { decimalPlaces, formatMeasurement, formatRecordedValue } from '../../../core/i18n/formatNumber';
import { createTranslator, type Translator } from '../../../core/i18n/translate';
import { resolveLocalizedText } from '../../../core/i18n/resolveLocalizedText';
import type { AppState } from '../../../core/store/AppState';
import {
    selectCasePhase,
    selectContextualArtifacts,
    selectInspectedSourceIds,
    selectLocale,
    selectLocalizedConclusionReadiness,
    selectLocalizedError,
    selectLocalizedPeerReview,
    selectNotebookObservations,
    selectPrimaryControl
} from '../../../core/store/selectors';
import type { ContextualArtifact } from '../../../domain/cases/CaseDefinition';
import type { RunRecord } from '../../../domain/evidence/RunRecord';
import type { PhaserStoreAdapter } from '../PhaserStoreAdapter';
import { uiTextStyle } from '../textStyles';
import {
    CASE_FILE_ACTION_HEIGHT,
    CASE_FILE_ACTION_WIDTH,
    CASE_FILE_CONTROL_FONT_SIZE,
    CASE_FILE_DEPTH,
    CASE_FILE_HEADING_FONT_SIZE,
    CASE_FILE_META_FONT_SIZE,
    CASE_FILE_MIN_FONT_SIZE,
    CASE_FILE_PAGE_CONTROL_HEIGHT,
    CASE_FILE_PAGE_CONTROL_WIDTH,
    CASE_FILE_PIN_HEIGHT,
    CASE_FILE_PIN_WIDTH,
    CASE_FILE_READINESS_ROWS,
    CASE_FILE_READINESS_ROW_HEIGHT,
    CASE_FILE_ROWS_PER_PAGE,
    CASE_FILE_ROW_FONT_SIZE,
    CASE_FILE_SECTION_FONT_SIZE,
    CASE_FILE_SECTION_HEIGHT,
    CASE_FILE_SOURCE_ROWS,
    caseFileActionLabelWrap,
    caseFileCloseControlBand,
    caseFileGuideBand,
    caseFileGuideTextWrap,
    caseFileHeadingBand,
    caseFileIssuesBand,
    caseFileObservationRowBand,
    caseFileObservationsBand,
    caseFilePageControlBand,
    caseFilePageControlLabelWrap,
    caseFilePanelBand,
    caseFilePeerReviewBand,
    caseFilePinLabelWrap,
    caseFileReadinessBand,
    caseFileReadinessRowBand,
    caseFileRequestControlBand,
    caseFileRowPinBand,
    caseFileRowTextWrap,
    caseFileSaveControlBand,
    caseFileSourceRowBand,
    caseFileSourcesBand,
    caseFileStatusBand,
    type CaseFileRect
} from './caseFileGeometry';
import { TransientMessageSlot } from './transientMessage';

/**
 * The case file: the player's own record, open over the theory board (Story 2.11, AC5 and AC7).
 *
 * It closes the last four gating intents that had no canvas dispatcher —
 * `theory.supportRunSelected` / `theory.supportRunUnselected`,
 * `theory.supportSourceSelected` / `theory.supportSourceUnselected`, `peerReview.requested` and
 * `revision.saved` — whose only dispatchers were the retired `src/ui/theory/TheoryBoard.ts` and
 * `src/ui/review/ConclusionReviewPanel.ts` (ADR-011). It also carries AC7's readiness list, which is
 * the surface `error.conclusion-not-ready`'s copy has been pointing at since Story 2.7.
 *
 * ## An overlay the scene owns
 *
 * `caseFileGeometry`'s header has the measurement that forced it. The **scene** owns this presenter
 * and suppresses its own board input while it is up, because a click meant for the overlay that fell
 * through would choose a conclusion. `NotebookRenderer` and `ReferenceBookPresenter` are the two
 * established instances of the shape, and there is no scene→scene reach-in anywhere in it.
 *
 * ## It never provokes a refusal the player did nothing to earn
 *
 * Every pin reads `state.theory.selectedRunIds` / `selectedSourceIds` **first** and dispatches only
 * the transition that changes something: the reducer answers a repeat with `duplicate-theory-run` /
 * `duplicate-theory-source` and an absent one with `theory-run-not-selected` /
 * `theory-source-not-selected`, all four correct answers to a genuinely duplicated dispatch and none
 * of them something a player's click should produce. Only inspected artifacts are offered at all, so
 * `uninspected-theory-source` is unreachable from here.
 *
 * **No `Result` is discarded.** Every dispatch either surfaces its refusal in the status slot or is
 * guarded so the refusal is unreachable — `report()` treating "dispatched" as "committed" desynced the
 * bench knob from the store for a whole session, and `NotebookRenderer.toggleSelection` had the same
 * shape.
 *
 * ## ADR-006
 *
 * The readiness list reports the player's **own record** and nothing else: `ConclusionReadiness`
 * carries `status` and `missing[]`, both derived from what they have inspected, recorded and written.
 * Which of the four claims the evidence would support is the evaluator's business and the rival lab's,
 * it lives in a different selector, and this file must never import that one.
 * `CharacterStageView.test.ts` sweeps at source level for the names that would carry it and the sweep
 * covers this file — which is why the terms themselves do not appear in this prose, the same trade
 * `characterStageView.ts` makes: a sweep that has to make exceptions is a sweep that will make one too
 * many.
 *
 * ## No animation
 *
 * The overlay appears and disappears. No fade, no tween, no update loop — the cheapest correct option,
 * and the one that costs nothing under `prefers-reduced-motion: reduce`. An overlay animation also
 * disables input for its duration, which is correct for a player and invisible to a spec clicking at
 * machine speed; not having one removes that trap rather than documenting it.
 */

const BACKDROP = 0x061319;
const PANEL_FILL = 0x10252c;
const PANEL_RIM = 0x4d7f8c;
const ROW_FILL = 0x16323b;
const ROW_FILL_PINNED = 0x1f4a45;
const PIN_FILL = 0x1d4451;
const PIN_FILL_ON = 0x276b55;
const ACTION_FILL = 0x1d4451;
const ACTION_FILL_OFF = 0x14262d;

const HEADING_COLOR = '#f7f4ef';
const BODY_COLOR = '#e4ecec';
const META_COLOR = '#9fc6bb';
const SECTION_COLOR = '#d8c6a6';
const STATUS_COLOR = '#f4d35e';

type CaseFileObject = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text;

type PinnableRow = Readonly<{
    background: Phaser.GameObjects.Rectangle;
    title: Phaser.GameObjects.Text;
    detail: Phaser.GameObjects.Text;
    pinSurface: Phaser.GameObjects.Rectangle;
    pinLabel: Phaser.GameObjects.Text;
}>;

export type CaseFilePresenterOptions = Readonly<{
    /**
     * Fired when the case file appears and when it is dismissed. The **owning scene** suppresses its
     * own board input from this — an intra-scene call, never a reach into another scene.
     */
    onVisibilityChange: (visible: boolean) => void;
}>;

export class CaseFilePresenter {
    private readonly objects: CaseFileObject[] = [];
    private readonly observationRows: PinnableRow[] = [];
    private readonly sourceRows: PinnableRow[] = [];
    private readonly readinessRows: Phaser.GameObjects.Text[] = [];

    private backdrop?: Phaser.GameObjects.Rectangle;
    private heading?: Phaser.GameObjects.Text;
    private guide?: Phaser.GameObjects.Text;
    private observationsHeading?: Phaser.GameObjects.Text;
    private sourcesHeading?: Phaser.GameObjects.Text;
    private readinessHeading?: Phaser.GameObjects.Text;
    private reviewHeading?: Phaser.GameObjects.Text;
    private earlierSurface?: Phaser.GameObjects.Rectangle;
    private earlierLabel?: Phaser.GameObjects.Text;
    private laterSurface?: Phaser.GameObjects.Rectangle;
    private laterLabel?: Phaser.GameObjects.Text;
    private pageCounter?: Phaser.GameObjects.Text;
    private requestSurface?: Phaser.GameObjects.Rectangle;
    private requestLabel?: Phaser.GameObjects.Text;
    private issues?: Phaser.GameObjects.Text;
    private saveSurface?: Phaser.GameObjects.Rectangle;
    private saveLabel?: Phaser.GameObjects.Text;
    private closeSurface?: Phaser.GameObjects.Rectangle;
    private closeLabel?: Phaser.GameObjects.Text;
    private statusLine?: Phaser.GameObjects.Text;

    private visible = false;
    /**
     * Which page of observations is showing.
     *
     * Ephemeral and widget-local, exactly as the notebook's page index and the reference book's spread
     * index are: it means nothing five seconds later, and a store field for it would be persisted,
     * exported, re-validated and reset on replay.
     */
    private pageIndex = 0;
    private readonly status = new TransientMessageSlot<string>();

    public constructor(
        private readonly scene: Scene,
        private readonly storeAdapter: PhaserStoreAdapter,
        private readonly options: CaseFilePresenterOptions
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
        // Interactive so a click anywhere outside the panel is swallowed rather than falling through to
        // a proposal card underneath. The scene's suppression is the other half of the same rule.
        this.backdrop.setInteractive({ useHandCursor: false });
        this.objects.push(this.backdrop);

        const panel = caseFilePanelBand(width, height);
        this.objects.push(this.scene.add
            .rectangle(panel.x, panel.y, panel.width, panel.height, PANEL_FILL)
            .setOrigin(0, 0)
            .setStrokeStyle(2, PANEL_RIM));

        // Every string below is created **empty** and written in `render`: `create()` runs once and the
        // locale can change at any time.
        const headingBand = caseFileHeadingBand(width);
        this.heading = this.text(headingBand.x, headingBand.y, CASE_FILE_HEADING_FONT_SIZE, HEADING_COLOR, headingBand.width);
        const guideBand = caseFileGuideBand(width);
        this.guide = this.text(guideBand.x, guideBand.y, CASE_FILE_ROW_FONT_SIZE, META_COLOR, caseFileGuideTextWrap(width));

        const observations = caseFileObservationsBand(width);
        this.observationsHeading = this.text(observations.x, observations.y, CASE_FILE_SECTION_FONT_SIZE, SECTION_COLOR, observations.width);
        for (let index = 0; index < CASE_FILE_ROWS_PER_PAGE; index += 1) {
            this.observationRows.push(this.createRow(caseFileObservationRowBand(index, width), caseFileRowTextWrap(width),
                () => this.toggleObservation(index)));
        }
        this.earlierSurface = this.pageControl(-1, width);
        this.earlierLabel = this.pageControlLabel(-1, width);
        this.laterSurface = this.pageControl(1, width);
        this.laterLabel = this.pageControlLabel(1, width);
        const laterBand = caseFilePageControlBand(1, width);
        this.pageCounter = this.text(
            laterBand.x + laterBand.width + 12, laterBand.y + ((CASE_FILE_PAGE_CONTROL_HEIGHT - 16) / 2),
            CASE_FILE_META_FONT_SIZE, META_COLOR, 200
        );

        const sources = caseFileSourcesBand(width);
        this.sourcesHeading = this.text(sources.x, sources.y, CASE_FILE_SECTION_FONT_SIZE, SECTION_COLOR, sources.width);
        for (let index = 0; index < CASE_FILE_SOURCE_ROWS; index += 1) {
            // The left column's bound, not the right one: the references sit under the observations,
            // and each carries a pin that takes the same reserve theirs does.
            this.sourceRows.push(this.createRow(caseFileSourceRowBand(index, width), caseFileRowTextWrap(width),
                () => this.toggleSource(index)));
        }

        const readiness = caseFileReadinessBand(width);
        this.readinessHeading = this.text(readiness.x, readiness.y, CASE_FILE_SECTION_FONT_SIZE, SECTION_COLOR, readiness.width);
        for (let index = 0; index < CASE_FILE_READINESS_ROWS; index += 1) {
            const row = caseFileReadinessRowBand(index, width);
            this.readinessRows.push(this.text(row.x, row.y, CASE_FILE_META_FONT_SIZE, BODY_COLOR, row.width));
        }

        const review = caseFilePeerReviewBand(width);
        this.reviewHeading = this.text(review.x, review.y, CASE_FILE_SECTION_FONT_SIZE, SECTION_COLOR, review.width);
        this.requestSurface = this.actionControl(caseFileRequestControlBand(width), () => this.requestPeerReview());
        this.requestLabel = this.actionLabel(caseFileRequestControlBand(width));
        const issuesBand = caseFileIssuesBand(width);
        this.issues = this.text(issuesBand.x, issuesBand.y, CASE_FILE_META_FONT_SIZE, BODY_COLOR, issuesBand.width);
        this.saveSurface = this.actionControl(caseFileSaveControlBand(width), () => this.saveRevision());
        this.saveLabel = this.actionLabel(caseFileSaveControlBand(width));

        const close = caseFileCloseControlBand(width, height);
        this.closeSurface = this.actionControl(close, () => this.close());
        this.closeLabel = this.actionLabel(close);
        const statusBand = caseFileStatusBand(width, height);
        this.statusLine = this.text(
            statusBand.x, statusBand.y + ((statusBand.height - 18) / 2),
            CASE_FILE_META_FONT_SIZE, STATUS_COLOR, statusBand.width
        );

        // One depth for the whole overlay, applied in one place, so nothing can be added later and left
        // behind the board — see {@link CASE_FILE_DEPTH}.
        this.allObjects().forEach((object) => object.setDepth(CASE_FILE_DEPTH));
        this.applyVisibility();
    }

    /** Puts the case file up. Dispatches nothing: reading the record is not an act on it. */
    public open(): void {
        if (this.visible) return;
        this.visible = true;
        this.pageIndex = 0;
        this.applyVisibility();
        this.render(this.storeAdapter.getState());
        this.options.onVisibilityChange(true);
    }

    public close(): void {
        if (!this.visible) return;
        this.visible = false;
        this.status.clear();
        this.applyVisibility();
        this.options.onVisibilityChange(false);
    }

    /**
     * Repaints from the store.
     *
     * A no-op while closed, so the owning scene can call it unconditionally from its subscription
     * rather than guarding at the call site — the same shape `NotebookRenderer.render` has.
     */
    public render(state: AppState): void {
        if (!this.visible) return;
        const { width } = this.scene.scale;
        const t = createTranslator(selectLocale(state));

        this.heading?.setText(t('caseFile.heading'));
        this.guide?.setText(t('caseFile.guide'));
        this.closeLabel?.setText(t('caseFile.close'));
        this.statusLine?.setText(this.status.read(state) ?? '');

        this.renderObservations(state, t, width);
        this.renderSources(state, t, width);
        this.renderReadiness(state, t);
        this.renderPeerReview(state, t);
    }

    public destroy(): void {
        [...this.observationRows, ...this.sourceRows].forEach((row) =>
            [row.background, row.title, row.detail, row.pinSurface, row.pinLabel].forEach((object) => object.destroy()));
        this.observationRows.length = 0;
        this.sourceRows.length = 0;
        this.readinessRows.forEach((object) => object.destroy());
        this.readinessRows.length = 0;
        [this.earlierSurface, this.earlierLabel, this.laterSurface, this.laterLabel,
            this.requestSurface, this.requestLabel, this.saveSurface, this.saveLabel,
            this.closeSurface, this.closeLabel].forEach((object) => object?.destroy());
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.backdrop = undefined; this.heading = undefined; this.guide = undefined;
        this.observationsHeading = undefined; this.sourcesHeading = undefined;
        this.readinessHeading = undefined; this.reviewHeading = undefined;
        this.earlierSurface = undefined; this.earlierLabel = undefined;
        this.laterSurface = undefined; this.laterLabel = undefined; this.pageCounter = undefined;
        this.requestSurface = undefined; this.requestLabel = undefined; this.issues = undefined;
        this.saveSurface = undefined; this.saveLabel = undefined;
        this.closeSurface = undefined; this.closeLabel = undefined; this.statusLine = undefined;
        this.visible = false;
        this.pageIndex = 0;
        this.status.clear();
    }

    // --- Sections -------------------------------------------------------------------------------------

    private observationsOnPage(state: AppState): readonly RunRecord[] {
        const all = selectNotebookObservations(state);
        const from = this.pageIndex * CASE_FILE_ROWS_PER_PAGE;
        return all.slice(from, from + CASE_FILE_ROWS_PER_PAGE);
    }

    private renderObservations(state: AppState, t: Translator, canvasWidth: number): void {
        const all = selectNotebookObservations(state);
        const pages = Math.max(1, Math.ceil(all.length / CASE_FILE_ROWS_PER_PAGE));
        this.pageIndex = Math.min(this.pageIndex, pages - 1);
        const from = this.pageIndex * CASE_FILE_ROWS_PER_PAGE;
        this.observationsHeading?.setText(all.length === 0
            ? t('caseFile.observations.empty')
            : t('caseFile.observations.heading'));

        this.observationRows.forEach((row, offset) => {
            const record = all[from + offset];
            if (!record) {
                this.hideRow(row);
                return;
            }
            const pinned = state.theory.selectedRunIds.includes(record.id);
            this.showRow(row, pinned, t);
            row.title.setText(t('caseFile.observation', { order: from + offset + 1 }));
            row.detail.setText(this.observationDetail(state, t, record));
            this.stackRow(row, caseFileObservationRowBand(offset, canvasWidth));
        });

        const showsPaging = all.length > CASE_FILE_ROWS_PER_PAGE;
        [this.earlierSurface, this.earlierLabel, this.laterSurface, this.laterLabel, this.pageCounter]
            .forEach((object) => object?.setVisible(showsPaging));
        this.earlierLabel?.setText(t('caseFile.page.earlier'));
        this.laterLabel?.setText(t('caseFile.page.later'));
        this.pageCounter?.setText(t('caseFile.page.counter', {
            from: from + 1,
            to: Math.min(all.length, from + CASE_FILE_ROWS_PER_PAGE),
            total: all.length
        }));
        this.armControl(this.earlierSurface, showsPaging && this.pageIndex > 0);
        this.armControl(this.laterSurface, showsPaging && this.pageIndex < pages - 1);
    }

    /**
     * The setup the observation was recorded at and what it recorded, read out of the record and never
     * recomputed. There is no call to `calculateYoungFringeSpacing` here and there must never be one.
     *
     * The result's label is localized for a model-derived run and canonical for anything else — the
     * split `CaseRecordPrintView` and `NotebookRenderer` both make, because the Young model's result has
     * an authored name in both bundles while a pre-model observation carries a label this build cannot
     * translate and must not invent one for.
     */
    private observationDetail(state: AppState, t: Translator, record: RunRecord): string {
        const locale = selectLocale(state);
        const readout = (controlId: 'slitSpacingMm' | 'screenDistanceM'): string => {
            const control = selectPrimaryControl(state, controlId);
            return t('lab.control.readout', {
                label: resolveLocalizedText(control.label, locale),
                value: formatMeasurement(locale, record.controls[controlId], decimalPlaces(control.step), control.unit)
            });
        };
        return t('caseFile.observation.detail', {
            slitSpacing: readout('slitSpacingMm'),
            screenDistance: readout('screenDistanceM'),
            result: t('notebook.row.result', {
                label: record.modelInputs ? t('experiment.result.fringeSpacing') : record.result.label,
                value: formatRecordedValue(locale, record.result.value, record.result.unit)
            })
        });
    }

    /** Only inspected artifacts are offered, so `uninspected-theory-source` is unreachable from here. */
    private inspectedArtifacts(state: AppState): readonly ContextualArtifact[] {
        const inspected = new Set(selectInspectedSourceIds(state));
        return selectContextualArtifacts(state).filter(({ id }) => inspected.has(id));
    }

    private renderSources(state: AppState, t: Translator, canvasWidth: number): void {
        const artifacts = this.inspectedArtifacts(state);
        this.sourcesHeading?.setText(artifacts.length === 0
            ? t('caseFile.sources.empty')
            : t('caseFile.sources.heading'));

        this.sourceRows.forEach((row, index) => {
            const artifact = artifacts[index];
            if (!artifact) {
                this.hideRow(row);
                return;
            }
            const pinned = state.theory.selectedSourceIds.includes(artifact.id);
            this.showRow(row, pinned, t);
            row.title.setText(resolveLocalizedText(artifact.displayName, selectLocale(state)));
            row.detail.setText(t('caseFile.source.detail', {
                type: t(`source.type.${artifact.sourceType}`),
                provenance: t(`source.provenanceName.${artifact.provenance.category}`)
            }));
            this.stackRow(row, caseFileSourceRowBand(index, canvasWidth));
        });
    }

    /**
     * AC7: what the player's own record is still missing, localized by `code`.
     *
     * Never `missing[].message`, which is the dev-facing English the domain pre-formats — the selector
     * resolves the existing `conclusion.missing.*` keys and supplies the two interpolated counts.
     */
    private renderReadiness(state: AppState, t: Translator): void {
        this.readinessHeading?.setText(t('caseFile.readiness.heading'));
        const missing = selectLocalizedConclusionReadiness(state);
        this.readinessRows.forEach((row, index) => {
            if (index === 0 && missing.length === 0) {
                row.setVisible(true).setText(t('caseFile.readiness.complete'));
                this.clamp(row, CASE_FILE_META_FONT_SIZE, CASE_FILE_READINESS_ROW_HEIGHT);
                return;
            }
            const line = missing[index];
            row.setVisible(line !== undefined).setText(line ?? '');
            if (line !== undefined) this.clamp(row, CASE_FILE_META_FONT_SIZE, CASE_FILE_READINESS_ROW_HEIGHT);
        });
    }

    /**
     * Peer review, in the `review` phase only.
     *
     * `reducePeerReviewRequest` refuses outside `review` with `peer-review-unavailable` and
     * `reduceRevisionSave` refuses without reviewed feedback with `revision-review-required`; both are
     * surfaced localized rather than swallowed. The pane itself is hidden outside `review`, so the
     * first of those two is not something a player can reach by clicking — it stays surfaced anyway,
     * because a guard and an answer are two different things and the guard is the one that can rot.
     *
     * The issues are read through {@link selectLocalizedPeerReview}, which resolves `ruleId` against
     * the authored `LocalizedText` and **never** returns `PeerReviewIssue.feedback` — that field is
     * canonical `.en`, persisted, and recomputed-and-string-compared on load (D3).
     */
    private renderPeerReview(state: AppState, t: Translator): void {
        const inReview = selectCasePhase(state) === 'review';
        [this.reviewHeading, this.requestSurface, this.requestLabel, this.issues, this.saveSurface, this.saveLabel]
            .forEach((object) => object?.setVisible(inReview));
        if (!inReview) {
            this.requestSurface?.disableInteractive();
            this.saveSurface?.disableInteractive();
            return;
        }
        this.reviewHeading?.setText(t('caseFile.review.heading'));
        this.requestLabel?.setText(t('caseFile.review.request'));
        this.saveLabel?.setText(t('caseFile.review.save'));
        this.armControl(this.requestSurface, true);

        const review = selectLocalizedPeerReview(state);
        const reviewed = review?.status === 'reviewed';
        this.armControl(this.saveSurface, reviewed);
        if (!review) {
            this.issues?.setText(t('caseFile.review.notRequested'));
        } else if (review.status === 'unavailable') {
            this.issues?.setText(review.message);
        } else if (review.issues.length === 0) {
            this.issues?.setText(t('caseFile.review.none'));
        } else {
            this.issues?.setText(review.issues
                .map((issue) => t('caseFile.review.issue', { feedback: issue.feedback, revisionPath: issue.revisionPath }))
                .join('\n'));
        }
        this.clamp(this.issues, CASE_FILE_META_FONT_SIZE, caseFileIssuesBand(this.scene.scale.width).height);
    }

    // --- The intents ------------------------------------------------------------------------------------

    /**
     * Pins a recorded observation to the conclusion, or takes it off.
     *
     * `state.theory.selectedRunIds` is read **before** dispatching, so only the transition that changes
     * something is sent — see the class docstring. Every refused dispatch is answered rather than
     * dropped: `createStore` refuses every action with `progress-operation-active` while an export or
     * import holds the lock, and a silent no-op there is indistinguishable from a dead control.
     */
    private toggleObservation(offset: number): void {
        const state = this.storeAdapter.getState();
        const record = this.observationsOnPage(state)[offset];
        if (!record) return;
        const pinned = state.theory.selectedRunIds.includes(record.id);
        this.report(state, pinned
            ? this.storeAdapter.unselectSupportRun(record.id)
            : this.storeAdapter.selectSupportRun(record.id));
    }

    private toggleSource(index: number): void {
        const state = this.storeAdapter.getState();
        const artifact = this.inspectedArtifacts(state)[index];
        if (!artifact) return;
        const pinned = state.theory.selectedSourceIds.includes(artifact.id);
        this.report(state, pinned
            ? this.storeAdapter.unselectSupportSource(artifact.id)
            : this.storeAdapter.selectSupportSource(artifact.id));
    }

    private requestPeerReview(): void {
        const state = this.storeAdapter.getState();
        this.report(state, this.storeAdapter.requestPeerReview());
    }

    private saveRevision(): void {
        const state = this.storeAdapter.getState();
        const result = this.storeAdapter.saveRevision();
        if (result.ok) {
            const after = this.storeAdapter.getState();
            this.status.set(createTranslator(selectLocale(after))('caseFile.review.saved'), after);
            this.render(after);
            return;
        }
        this.report(state, result);
    }

    /**
     * Answers a refusal, or lets a success repaint.
     *
     * **No `Result` is discarded** — the rule the bench's `report()` broke by treating "dispatched" as
     * "committed". A successful dispatch repaints through the scene's own subscription, so nothing is
     * needed here for it; a refused one takes the status slot and forces the repaint that shows it.
     */
    private report(state: AppState, result: ReturnType<PhaserStoreAdapter['selectSupportRun']>): void {
        if (result.ok) return;
        this.status.set(selectLocalizedError(state, result.error), state);
        this.render(this.storeAdapter.getState());
    }

    private turnPage(direction: -1 | 1): void {
        const state = this.storeAdapter.getState();
        const pages = Math.max(1, Math.ceil(selectNotebookObservations(state).length / CASE_FILE_ROWS_PER_PAGE));
        const next = Math.max(0, Math.min(pages - 1, this.pageIndex + direction));
        if (next === this.pageIndex) return;
        this.pageIndex = next;
        this.render(state);
    }

    // --- Construction -------------------------------------------------------------------------------------

    private allObjects(): readonly CaseFileObject[] {
        return [
            ...this.objects,
            this.earlierSurface, this.earlierLabel, this.laterSurface, this.laterLabel,
            this.requestSurface, this.requestLabel, this.saveSurface, this.saveLabel,
            this.closeSurface, this.closeLabel,
            ...[...this.observationRows, ...this.sourceRows].flatMap((row) =>
                [row.background, row.title, row.detail, row.pinSurface, row.pinLabel])
        ].filter((object): object is CaseFileObject => object !== undefined);
    }

    /**
     * Shows or hides the whole overlay.
     *
     * The backdrop's interactivity goes with it: an interactive rectangle over the board while the
     * overlay is closed would swallow every click on a proposal card.
     */
    private applyVisibility(): void {
        this.allObjects().forEach((object) => object.setVisible(this.visible));
        if (this.visible) this.backdrop?.setInteractive({ useHandCursor: false });
        else this.backdrop?.disableInteractive();
        if (!this.visible) {
            [...this.observationRows, ...this.sourceRows].forEach((row) => row.pinSurface.disableInteractive());
            [this.earlierSurface, this.laterSurface, this.requestSurface, this.saveSurface, this.closeSurface]
                .forEach((object) => object?.disableInteractive());
        } else {
            this.closeSurface?.setInteractive({ useHandCursor: true });
        }
    }

    private createRow(band: CaseFileRect, textWrap: number, onToggle: () => void): PinnableRow {
        const background = this.scene.add
            .rectangle(band.x, band.y, band.width, band.height, ROW_FILL)
            .setOrigin(0, 0);
        const title = this.text(band.x + 10, band.y + 8, CASE_FILE_ROW_FONT_SIZE, BODY_COLOR, textWrap);
        const detail = this.text(band.x + 10, band.y + 8 + Math.ceil(CASE_FILE_ROW_FONT_SIZE * 1.35),
            CASE_FILE_META_FONT_SIZE, META_COLOR, textWrap);
        const pin = caseFileRowPinBand(band);
        const pinSurface = this.scene.add
            .rectangle(pin.x, pin.y, CASE_FILE_PIN_WIDTH, CASE_FILE_PIN_HEIGHT, PIN_FILL)
            .setOrigin(0, 0);
        pinSurface.on('pointerup', onToggle);
        const pinLabel = this.scene.add.text(
            pin.x + (CASE_FILE_PIN_WIDTH / 2), pin.y + (CASE_FILE_PIN_HEIGHT / 2), '',
            uiTextStyle({
                color: BODY_COLOR, fontSize: `${CASE_FILE_CONTROL_FONT_SIZE}px`,
                align: 'center', wordWrap: { width: caseFilePinLabelWrap() }
            })
        ).setOrigin(0.5, 0.5);
        // Deliberately **not** pushed onto `this.objects`: the rows are released as a group in
        // `destroy` so a row rebuilt for a different record cannot leave a stale object behind.
        return { background, title, detail, pinSurface, pinLabel };
    }

    /**
     * Places a row's detail line against its title's **measured** bottom, and clamps both into the row.
     *
     * Not against a constant. `caseFile.observation` is short, but an authored `displayName` is
     * unbounded — the shipped French reference name is "Le compte rendu de la conférence de Thomas
     * Young de 1801", which wraps to two lines and, placed against a constant, painted its second line
     * straight through the provenance line beneath it. That is the "object placed against a constant
     * while the object above it grew with French copy" defect seven reviews have found in a different
     * scene each time, and the 1280×720 screenshot pass found it here.
     *
     * The title is clamped to a single line first, so the detail always has its own line to sit on:
     * shrinking a long name is better reading than pushing its provenance out of the row.
     */
    private stackRow(row: PinnableRow, band: CaseFileRect): void {
        const titleLine = Math.ceil(CASE_FILE_ROW_FONT_SIZE * 1.35);
        this.clamp(row.title, CASE_FILE_ROW_FONT_SIZE, titleLine);
        row.detail.setY(row.title.y + row.title.height);
        this.clamp(row.detail, CASE_FILE_META_FONT_SIZE, band.y + band.height - 8 - row.detail.y);
    }

    private hideRow(row: PinnableRow): void {
        [row.background, row.title, row.detail, row.pinSurface, row.pinLabel]
            .forEach((object) => object.setVisible(false));
        row.pinSurface.disableInteractive();
    }

    private showRow(row: PinnableRow, pinned: boolean, t: Translator): void {
        [row.background, row.title, row.detail, row.pinSurface, row.pinLabel]
            .forEach((object) => object.setVisible(true));
        row.background.setFillStyle(pinned ? ROW_FILL_PINNED : ROW_FILL);
        row.pinSurface.setFillStyle(pinned ? PIN_FILL_ON : PIN_FILL).setInteractive({ useHandCursor: true });
        row.pinLabel.setText(pinned ? t('caseFile.unpin') : t('caseFile.pin'));
    }

    private pageControl(direction: -1 | 1, canvasWidth: number): Phaser.GameObjects.Rectangle {
        const band = caseFilePageControlBand(direction, canvasWidth);
        const surface = this.scene.add
            .rectangle(band.x, band.y, CASE_FILE_PAGE_CONTROL_WIDTH, CASE_FILE_PAGE_CONTROL_HEIGHT, ACTION_FILL)
            .setOrigin(0, 0);
        surface.on('pointerup', () => this.turnPage(direction));
        return surface;
    }

    private pageControlLabel(direction: -1 | 1, canvasWidth: number): Phaser.GameObjects.Text {
        const band = caseFilePageControlBand(direction, canvasWidth);
        return this.scene.add.text(
            band.x + (CASE_FILE_PAGE_CONTROL_WIDTH / 2), band.y + (CASE_FILE_PAGE_CONTROL_HEIGHT / 2), '',
            uiTextStyle({
                color: BODY_COLOR, fontSize: `${CASE_FILE_CONTROL_FONT_SIZE}px`,
                align: 'center', wordWrap: { width: caseFilePageControlLabelWrap() }
            })
        ).setOrigin(0.5, 0.5);
    }

    private actionControl(band: CaseFileRect, onPress: () => void): Phaser.GameObjects.Rectangle {
        const surface = this.scene.add
            .rectangle(band.x, band.y, band.width, band.height, ACTION_FILL)
            .setOrigin(0, 0);
        surface.on('pointerup', onPress);
        return surface;
    }

    private actionLabel(band: CaseFileRect): Phaser.GameObjects.Text {
        return this.scene.add.text(
            band.x + (band.width / 2), band.y + (band.height / 2), '',
            uiTextStyle({
                color: BODY_COLOR, fontSize: `${CASE_FILE_CONTROL_FONT_SIZE}px`,
                align: 'center', wordWrap: { width: caseFileActionLabelWrap() }
            })
        ).setOrigin(0.5, 0.5);
    }

    /**
     * A control that cannot do anything is drawn dead **and** made non-interactive.
     *
     * Both halves matter: the fill is what the player reads, and `disableInteractive` is what stops a
     * click being handled at all. `sceneSlice` records `interactive` precisely because the two used to
     * be indistinguishable to every test in this suite (2.10 review).
     */
    private armControl(surface: Phaser.GameObjects.Rectangle | undefined, enabled: boolean): void {
        if (!surface || !this.visible) return;
        surface.setFillStyle(enabled ? ACTION_FILL : ACTION_FILL_OFF);
        if (enabled) surface.setInteractive({ useHandCursor: true });
        else surface.disableInteractive();
    }

    private text(x: number, y: number, fontSize: number, color: string, wrapWidth: number): Phaser.GameObjects.Text {
        const object = this.scene.add.text(x, y, '', uiTextStyle({
            color, fontSize: `${fontSize}px`, wordWrap: { width: Math.max(1, wrapWidth) }
        }));
        this.objects.push(object);
        return object;
    }

    /**
     * Keeps a growable text inside the rectangle it was given.
     *
     * The font size and the crop are **restored before anything is measured** — the 2.8 review patch:
     * a shrink taken for one long French string otherwise measures as "already fits" for the next and
     * never comes back, leaving every later row drawn at the minimum size.
     */
    private clamp(text: Phaser.GameObjects.Text | undefined, authoredFontSize: number, available: number): void {
        if (!text) return;
        text.setFontSize(authoredFontSize).setCrop();
        if (available <= 0) return;
        for (let fontSize = authoredFontSize; fontSize >= CASE_FILE_MIN_FONT_SIZE && text.height > available; fontSize -= 1) {
            text.setFontSize(fontSize);
        }
        if (text.height > available) text.setCrop(0, 0, text.width, available);
    }
}

/** Re-exported so a scene can size its own control against the overlay's action metrics. */
export { CASE_FILE_ACTION_HEIGHT, CASE_FILE_ACTION_WIDTH, CASE_FILE_SECTION_HEIGHT };
