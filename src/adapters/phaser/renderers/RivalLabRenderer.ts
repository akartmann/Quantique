import type { Scene } from 'phaser';

import type { PhaserStoreAdapter } from '../PhaserStoreAdapter';
import { uiTextStyle } from '../textStyles';
import { CharacterStage, RIVAL_FIGURE_MAX_HEIGHT, RIVAL_FIGURE_MAX_WIDTH } from './CharacterStage';
import { resolveFigureAppearance } from './figureAppearance';
import { LaboratoryDecor } from './LaboratoryDecor';
import type { AppState } from '../../../core/store/AppState';
import { createTranslator } from '../../../core/i18n/translate';
import { selectLocale, selectLocalizedError, selectLocalizedRivalLabCritique } from '../../../core/store/selectors';

/**
 * The rival lab's standing challenge: who is speaking, what they object to, and one way back.
 *
 * **Narrative dressing, never a fail state.** Nothing here scores, times, counts, or locks anything —
 * the only control it offers returns the player to the board with their choice intact.
 *
 * It reads exactly one projection, {@link selectLocalizedRivalLabCritique}, which carries the critique
 * for the proposal the player already submitted and no defensibility field at all. A surface able to
 * read the defensible set could mark the "right" answer, which ADR-006 forbids.
 *
 * No animation, deliberately — the same reasoning as `DialogueBox`. A later story that adds one
 * inherits the `prefers-reduced-motion` obligation in full.
 */

/**
 * Where the surface sits. Exported so the browser tests derive their wrap bounds and click targets
 * from the real values rather than restating literals that silently drift.
 */
export const RIVAL_LAB_SURFACE_LEFT = 40;
export const RIVAL_LAB_SURFACE_WIDTH = 944;

const ACCENT_WIDTH = 8;
const ACCENT_GAP = 18;
const TEXT_LEFT = RIVAL_LAB_SURFACE_LEFT + ACCENT_WIDTH + ACCENT_GAP;

const HEADING_Y = 30;
const SPEAKER_GAP = 14;
const BODY_GAP = 12;
const GUIDE_GAP = 20;
const CONTROL_GAP = 16;

const CONTROL_WIDTH = 260;
const CONTROL_HEIGHT = 34;
const CONTROL_LABEL_PADDING = 10;

const CANVAS_BOTTOM_MARGIN = 16;

const CONTROL_FILL = 0x1d4451;
const ACCENT_FALLBACK = 0x8c3b3b;

/**
 * The right-hand column Mr. Arthur Bell is staged in (Story 2.9).
 *
 * Width is what this surface can afford, and here there is some: the prose is a single unbounded body
 * with no card grid to fit, so narrowing the wrap costs height, and the height it costs is absorbed by
 * the clamp that already holds the guide above the floor-anchored revise control. That is the opposite
 * of the proposal boards, where vertical space is the scarce thing.
 *
 * He is anchored to the **canvas floor**, not to the prose's measured bottom, for the same reason the
 * revise control is: the objection is unbounded by design and truncating it is the one thing this
 * surface must not do, so anything measured from below it has no ceiling on a 1024×768 surface that
 * does not scroll. His column starts to the right of the narrowed prose and ends inside the surface, so
 * he cannot overlap either the body or the control — the control is floor-anchored at the *left*, 260px
 * wide from `TEXT_LEFT`, and stops well short of him.
 */
export const RIVAL_LAB_STAGE_COLUMN_WIDTH = 200;
/** Between the figure's feet and the canvas floor, matching the margin everything else respects. */
const STAGE_FLOOR_MARGIN = CANVAS_BOTTOM_MARGIN;
/** Below the heading row, so he stands in the room rather than in front of the title. */
const STAGE_TOP = 78;

/**
 * The id Bell is staged under.
 *
 * Deliberately **not** a `colleagues[].id`, and deliberately not resolvable through
 * `selectColleagueById`: AC4 requires that he is never rendered as a member of the cast, and the
 * cheapest way to guarantee it is that the identifier he is staged with does not exist in that
 * collection. Nothing iterating `colleagues[]` can reach him, and nothing here reads that collection.
 */
export const RIVAL_LAB_STAGE_FIGURE_ID = 'rival-lab';

export const RIVAL_LAB_HEADING_FONT_SIZE = 25;
export const RIVAL_LAB_SPEAKER_FONT_SIZE = 15;
/**
 * 16 design pixels for the body, and not lower — the bound `DialogueBox` sets out: at NFR1's 1280×720
 * viewport a 1024×768 `Scale.FIT` surface renders every design size at 93.75%, so 16 lands at ≈15 CSS
 * px and 15 would land below what counts as legible.
 */
export const RIVAL_LAB_BODY_FONT_SIZE = 16;
export const RIVAL_LAB_GUIDE_FONT_SIZE = 15;
export const RIVAL_LAB_CONTROL_FONT_SIZE = 15;

/**
 * The wrap bound the French typography check measures against, derived rather than restated.
 *
 * The default is the **staged** width, not the bare surface: Story 2.9 reserves a column on the right
 * and every text on this surface now wraps against what is left of it. Leaving the default at the full
 * surface would have left the spec measuring 918 while the renderer painted 718 — a rectangle nothing
 * draws, which is precisely how `SUBMIT_WIDTH` vs `ADVANCE_CONTROL_WIDTH` kept a check green through
 * the clipping it existed to catch.
 */
export const rivalLabTextWrapWidth = (
    width: number = RIVAL_LAB_SURFACE_WIDTH - RIVAL_LAB_STAGE_COLUMN_WIDTH
): number => width - ACCENT_WIDTH - ACCENT_GAP;

/** The strip Bell stands in: the right of the surface, clear of the narrowed prose. */
export const rivalLabStageColumn = (): Readonly<{ x: number; width: number }> => ({
    x: RIVAL_LAB_SURFACE_LEFT + RIVAL_LAB_SURFACE_WIDTH - RIVAL_LAB_STAGE_COLUMN_WIDTH,
    width: RIVAL_LAB_STAGE_COLUMN_WIDTH
});
export const RIVAL_LAB_CONTROL_LABEL_WRAP = CONTROL_WIDTH - (2 * CONTROL_LABEL_PADDING);

/** The revise control's top edge: a fixed home at the canvas floor. See {@link RivalLabRenderer.layout}. */
const reviseControlTop = (canvasHeight: number): number => canvasHeight - CANVAS_BOTTOM_MARGIN - CONTROL_HEIGHT;

/**
 * The design-space centre of the revise control, so a browser test can click it without restating the
 * layout as literals that would drift the moment it moved.
 */
export const rivalLabReviseControlCentre = (
    canvasHeight: number
): Readonly<{ x: number; y: number }> => ({
    x: TEXT_LEFT + (CONTROL_WIDTH / 2),
    y: reviseControlTop(canvasHeight) + (CONTROL_HEIGHT / 2)
});

export class RivalLabRenderer {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private accent?: Phaser.GameObjects.Rectangle;
    private heading?: Phaser.GameObjects.Text;
    private speaker?: Phaser.GameObjects.Text;
    private body?: Phaser.GameObjects.Text;
    private guide?: Phaser.GameObjects.Text;
    private control?: Phaser.GameObjects.Rectangle;
    private controlLabel?: Phaser.GameObjects.Text;
    /** Shown in place of the guide line until the next render, so a refused click is not silent. */
    private transientError?: string;
    /** Story 2.9: Mr. Arthur Bell, staged as a character rather than named in a speaker slot alone. */
    private characterStage?: CharacterStage;
    /** His laboratory. Painted once, reads nothing, never repaints. */
    private decor?: LaboratoryDecor;

    public constructor(
        private readonly scene: Scene,
        private readonly storeAdapter: PhaserStoreAdapter
    ) {}

    public create(): void {
        // First of everything: creation order is the only depth mechanism here, and the room has to sit
        // behind the prose, the control, and Bell alike.
        this.decor = new LaboratoryDecor(this.scene);
        this.decor.reserve();
        const band = this.stageBand();
        this.decor.create(this.scene.scale.width, band.top + band.height, band.top);

        const wrapWidth = rivalLabTextWrapWidth();
        this.accent = this.scene.add.rectangle(RIVAL_LAB_SURFACE_LEFT, HEADING_Y, ACCENT_WIDTH, CONTROL_HEIGHT, ACCENT_FALLBACK).setOrigin(0, 0);
        // Every string is created empty and written in `render`: `create()` runs once, and the locale
        // can change at any time.
        this.heading = this.scene.add.text(TEXT_LEFT, HEADING_Y, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${RIVAL_LAB_HEADING_FONT_SIZE}px`, wordWrap: { width: wrapWidth }
        }));
        this.speaker = this.scene.add.text(TEXT_LEFT, 0, '', uiTextStyle({
            color: '#f4d35e', fontSize: `${RIVAL_LAB_SPEAKER_FONT_SIZE}px`, wordWrap: { width: wrapWidth }
        }));
        // No `maxLines`: truncating the objection is the one thing this surface must never do, so the
        // body wraps freely and everything below it is placed against its *measured* height.
        this.body = this.scene.add.text(TEXT_LEFT, 0, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${RIVAL_LAB_BODY_FONT_SIZE}px`, wordWrap: { width: wrapWidth }
        }));
        this.guide = this.scene.add.text(TEXT_LEFT, 0, '', uiTextStyle({
            color: '#c7d7d9', fontSize: `${RIVAL_LAB_GUIDE_FONT_SIZE}px`, wordWrap: { width: wrapWidth }
        }));
        this.control = this.scene.add.rectangle(TEXT_LEFT, 0, CONTROL_WIDTH, CONTROL_HEIGHT, CONTROL_FILL).setOrigin(0, 0);
        this.controlLabel = this.scene.add.text(0, 0, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${RIVAL_LAB_CONTROL_FONT_SIZE}px`, align: 'center', wordWrap: { width: RIVAL_LAB_CONTROL_LABEL_WRAP }
        })).setOrigin(0.5, 0.5);

        // Built here, from the authored `rivalLab` record — **never** from `colleagues[]` and never
        // through `selectColleagueById` (AC4, D3). `rivalLab.accentColor` is the very field
        // `selectLocalizedRivalLabCritique` returns, so the figure and the critique cannot disagree
        // about his colour, and neither path carries anything about which conclusion the evidence
        // supports. It owns its own objects and releases them itself, so it is not pushed onto
        // `this.objects`.
        const { rivalLab } = this.storeAdapter.getState().caseDefinition;
        this.characterStage = new CharacterStage(this.scene, {
            build: 'rival',
            maxFigure: { width: RIVAL_FIGURE_MAX_WIDTH, height: RIVAL_FIGURE_MAX_HEIGHT },
            // His plaque is read at the same size as the speaker line it stands in for: it is most of a
            // surface away from the attribution at the far left, and his column is wide enough that
            // there is nothing to save by shrinking it.
            nameFontSize: RIVAL_LAB_SPEAKER_FONT_SIZE,
            roleFontSize: RIVAL_LAB_SPEAKER_FONT_SIZE - 2
        });
        this.characterStage.create([{
            colleagueId: RIVAL_LAB_STAGE_FIGURE_ID,
            accentColor: Number.parseInt(rivalLab.accentColor.slice(1), 16),
            name: rivalLab.name,
            // Resolved here rather than in the stage, exactly as a colleague's is — and through
            // `rivalLab.role`, never `colleague.role.*`, because he is not one of them (AC4).
            roleLabel: createTranslator(selectLocale(this.storeAdapter.getState()))('rivalLab.role'),
            // Resolved through `'rival'`, which is not a `ColleagueRole` and cannot be mistaken for
            // one: he holds no role on the team, and the default pose that falls out of it — arms
            // folded, waiting to be convinced — is his character note rather than a job.
            appearance: resolveFigureAppearance('rival', rivalLab.figure)
        }]);

        this.control.on('pointerup', () => this.requestRevision());
        this.objects.push(this.accent, this.heading, this.speaker, this.body, this.guide, this.control, this.controlLabel);
        // Made interactive here rather than at construction, so a scene starting underneath an open
        // reference book can suppress input before the first pointer event reaches the control.
        this.applyInputState();
    }

    public render(state: AppState): void {
        const t = createTranslator(selectLocale(state));
        const critique = selectLocalizedRivalLabCritique(state);

        this.heading?.setText(t('rivalLab.heading'));
        this.speaker?.setText(critique?.speaker ?? '');
        this.body?.setText(critique?.line ?? '');
        this.guide?.setText(this.transientError ?? t('rivalLab.guide'));
        this.guide?.setColor(this.transientError ? '#f4d35e' : '#c7d7d9');
        // Cleared after drawing, so a refused click stays legible until the next real state change
        // replaces it rather than vanishing on the same frame.
        this.transientError = undefined;
        this.controlLabel?.setText(t('rivalLab.revise'));
        if (critique) this.accent?.setFillStyle(Number.parseInt(critique.accentColor.slice(1), 16));

        this.layout();
        // He is the only figure on this surface, so he is always the one speaking: the emphasis pair
        // exists to separate a speaker from a receded cast, and with a cast of one the receded state
        // would just be a dimmer picture of the same person.
        this.characterStage?.render({
            band: this.stageBand(),
            area: rivalLabStageColumn(),
            speakerColleagueId: RIVAL_LAB_STAGE_FIGURE_ID
        });
    }

    /**
     * The band Bell stands in: the full height between the heading row and the canvas floor.
     *
     * Read from `scene.scale` rather than from a remembered `768`, and anchored to the floor rather
     * than to the prose above it — the objection is unbounded, so a figure measured from its bottom
     * would have no ceiling.
     */
    private stageBand(): Readonly<{ top: number; height: number }> {
        return { top: STAGE_TOP, height: this.scene.scale.height - STAGE_TOP - STAGE_FLOOR_MARGIN };
    }

    public destroy(): void {
        this.characterStage?.destroy();
        this.characterStage = undefined;
        this.decor?.destroy();
        this.decor = undefined;
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.accent = undefined;
        this.heading = undefined;
        this.speaker = undefined;
        this.body = undefined;
        this.guide = undefined;
        this.control = undefined;
        this.controlLabel = undefined;
        this.transientError = undefined;
    }

    /**
     * Stacks the prose against the **measured** height of whatever is above it, never against a fixed
     * offset. Both the 1.11 and the 1.12 review found the same defect one layer down: an object placed
     * at a constant while the object above it grew with French copy, producing overlap.
     *
     * The revise control is the one exception, and deliberately: it is anchored to the canvas floor
     * rather than trailing the prose. The objection is unbounded by design — `LocalizedTextSchema` sets
     * no maximum length and truncating it is the one thing this surface must not do — so a control
     * measured from below it has no ceiling, and on a fixed 1024×768 `Scale.FIT` surface with no scroll
     * a control past y=768 is not merely ugly, it is a player with no way back. That is the fail state
     * this whole story exists to avoid, so the way back gets a fixed home and the prose flows above it.
     *
     * The guide is then clamped to sit just above that control, because it doubles as the slot a refused
     * dispatch is reported in: a refusal has to be legible beside the control that refused it. An
     * objection long enough to reach the clamp overlaps the guide, which is a fault an author can see —
     * unlike a control drawn off-canvas, which they cannot.
     */
    private layout(): void {
        const speakerY = HEADING_Y + (this.heading?.height ?? 0) + SPEAKER_GAP;
        this.speaker?.setY(speakerY);

        const bodyY = speakerY + (this.speaker?.height ?? 0) + BODY_GAP;
        this.body?.setY(bodyY);

        const controlY = reviseControlTop(this.scene.scale.height);
        const guideY = Math.min(
            bodyY + (this.body?.height ?? 0) + GUIDE_GAP,
            controlY - (this.guide?.height ?? 0) - CONTROL_GAP
        );
        this.guide?.setY(guideY);

        this.control?.setPosition(TEXT_LEFT, controlY);
        this.controlLabel?.setPosition(TEXT_LEFT + (CONTROL_WIDTH / 2), controlY + (CONTROL_HEIGHT / 2));
        this.accent?.setPosition(RIVAL_LAB_SURFACE_LEFT, HEADING_Y)
            .setSize(ACCENT_WIDTH, controlY + CONTROL_HEIGHT - HEADING_Y);
    }

    private requestRevision(): void {
        const result = this.storeAdapter.requestRivalLabRevision();
        // Not unreachable: `createStore` short-circuits every dispatch while an exclusive progress
        // operation is in flight, so a click during an export or import legitimately fails. Swallowing
        // that would leave the only way off this surface silently inert.
        if (result.ok) return;
        const current = this.storeAdapter.getState();
        this.transientError = selectLocalizedError(current, result.error);
        this.render(current);
    }

    private applyInputState(): void {
        if (!this.control) return;
        this.control.setInteractive({ useHandCursor: true });
    }
}

