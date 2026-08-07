import type { Scene } from 'phaser';

import { createTranslator, type Translator } from '../../../core/i18n/translate';
import { resolveLocalizedText } from '../../../core/i18n/resolveLocalizedText';
import type { AppState } from '../../../core/store/AppState';
import {
    selectCasePhase,
    selectContextualArtifacts,
    selectContextualReadiness,
    selectIsSourceInspected,
    selectLocale,
    selectLocalizedError,
    selectLocalizedReadingGateHint
} from '../../../core/store/selectors';
import { isSourceEligibleForInspection, type ContextualArtifact } from '../../../domain/cases/CaseDefinition';
import type { PhaserStoreAdapter } from '../PhaserStoreAdapter';
import {
    DETAIL_PADDING,
    GATE_LINE_FONT_SIZE,
    GATE_LINE_MIN_FONT_SIZE,
    GATE_PADDING,
    GATE_SPEAKER_FONT_SIZE,
    GATE_SPEAKER_GAP,
    detailTextWrap,
    gateLineTextWrap,
    libraryAdvanceControlBounds,
    ARTIFACT_LABEL_PADDING,
    ARTIFACT_SPINE_WIDTH,
    libraryArtifactLabelBand,
    libraryArtifactPlacements,
    libraryDetailPanelBand,
    libraryGateLineBand,
    libraryShelfBand,
    type LibraryRect
} from '../scenes/libraryGeometry';
import { advanceTransitionForPhase, resolveAdvanceRefusal, resolveAdvanceView } from './advanceView';
import { GILT, GILT_BRIGHT, ReadingRoomDecor } from './ReadingRoomDecor';
import { TransientMessageSlot } from './transientMessage';
import { AdvanceControl } from '../ui/AdvanceControl';
import { uiTextStyle } from '../textStyles';

/**
 * The reading room: shelving, a reading surface, one object per contextual artifact, and the way out
 * (Story 2.8).
 *
 * ## What it draws, and what it deliberately does not
 *
 * Everything is `Graphics` and `Rectangle` — no image asset, no loader entry, no rights-ledger entry.
 * A room built from coded geometry is the same constraint Story 2.9 works under for the cast, and it
 * keeps the offline gate free of another asset for something the shapes already say.
 *
 * **The scenery is not here.** The wall bays, the case, the floor, the desk and the lamplight belong to
 * {@link ReadingRoomDecor}, which is built once and never repainted. This class keeps only what changes
 * with state: which reference is focused, which has been read, and what the gate is saying. That split
 * is why the three load-bearing guards in {@link LibraryRenderer.pickUp} are still readable.
 *
 * **No motion at all**, which is the cheapest correct answer to the reduced-motion contract rather than
 * an omission: this renderer registers no update loop, starts no tween, and owns no timer, so it has
 * nothing to gate on `prefers-reduced-motion` and nothing to release beyond its display objects. The
 * book's own open/close animation already honours the media query and is untouched.
 *
 * ## Where the decisions live
 *
 * Layout is in `scenes/libraryGeometry.ts`, which imports no Phaser and is unit-tested. Which register
 * answers a refusal is in `renderers/advanceView.ts`, which is shared with every other host — **one
 * rule, not two**: this renderer passes `colleagueAnswers` and paints the answer, and it does not
 * re-implement precedence, the transient override, or the hint's self-withdrawal.
 *
 * ## The one gate it reads itself
 *
 * `isGateMet` is `selectContextualReadiness(state).status === 'ready'`. That is honest here in a way it
 * is not on the theory board: it is a fact about the player's own record of what they have read, not a
 * judgement about whether a conclusion is defensible. ADR-006 bars only the latter.
 */

/**
 * Room fills.
 *
 * The room originally took the laboratory's teals so the two would look related. That was the wrong
 * relationship — it made the library read as an annexe of the lab — so the palette is now warm walnut
 * and lamplight, and the scenery that carries it lives in {@link ReadingRoomDecor}. What is left here
 * is only what changes with state: a reference's binding, its read marker, and the gate card.
 */
const ROOM_BACKGROUND = 0x1a120b;

/**
 * Two bindings, alternating down the shelf, so the references are told apart at a glance before any
 * text is read. Ordinary period leather, in the same range as the filler books behind them.
 */
const BINDING_COVERS: readonly number[] = [0x5c2621, 0x25382c];
const BINDING_UNAVAILABLE = 0x3c3831;
/** The spine, and the darker edge of the boards. Derived by eye, not by arithmetic on the cover. */
const BINDING_SPINE: readonly number[] = [0x431a15, 0x1a2a20];
const BINDING_SPINE_UNAVAILABLE = 0x2b2823;

/** The plaque carrying a reference's title. Cream, because the title has to be the legible thing. */
const PLAQUE_FILL = 0xe6d9bb;
const PLAQUE_EDGE = 0x8a6b33;
/** The ribbon that marks a reference already read. Carried alongside the marker text, never alone. */
const RIBBON_READ = 0xc4923a;

const GATE_FILL = 0x150e07;
/** The gate's rule reads as the same brass as the shelf's gilt, so re-toning one re-tones both. */
const GATE_ACCENT = GILT;

/** Walnut and bottle green, in place of the shared widget's laboratory teals. */
const ADVANCE_PALETTE = { fill: 0x3f2e1d, fillReady: 0x2f5138 } as const;

const HEADING_Y = 26;
export const HEADING_FONT_SIZE = 22;
const GUIDE_Y = 58;
export const GUIDE_FONT_SIZE = 15;

export const DETAIL_TITLE_FONT_SIZE = 18;
export const DETAIL_META_FONT_SIZE = 13;
export const DETAIL_RELATIONSHIP_FONT_SIZE = 14;
/** Between two stacked lines in the detail panel, measured from the previous line's *measured* bottom. */
const DETAIL_LINE_GAP = 6;
/** Between the metadata block and the case-relationship prose under it. */
const DETAIL_RELATIONSHIP_GAP = 14;
/**
 * The floor every shrink loop in the panel stops at. Below this the type is no longer scientific copy
 * a player can read at 1280×720, so the surface crops instead of shrinking further.
 */
const DETAIL_MIN_FONT_SIZE = 11;
/**
 * Two lines at {@link DETAIL_RELATIONSHIP_FONT_SIZE} plus its leading — the least the case relationship
 * can occupy and still say anything. The metadata above it shrinks rather than take this.
 */
const DETAIL_RELATIONSHIP_MIN_HEIGHT = 38;

export const ARTIFACT_LABEL_FONT_SIZE = 13;
/** The plaque is a fixed band, so a title that outgrows it shrinks rather than spilling onto the boards. */
export const ARTIFACT_LABEL_MIN_FONT_SIZE = 10;
export const ARTIFACT_READ_FONT_SIZE = 12;

export type LibraryRendererOptions = Readonly<{
    /**
     * Opens an artifact in the scene's own reference book.
     *
     * Returns nothing: this renderer has already established that the artifact is readable before it
     * calls, and it — not the presenter — owns every player-facing string. A boolean return would be a
     * second, unchecked authority on the same question.
     */
    openBook: (artifact: ContextualArtifact) => void;
}>;

/**
 * One bound volume on the shelf, and the display objects that make it up.
 *
 * `placement` is carried rather than recomputed on every repaint: the gilt work, the title plaque and
 * the read ribbon are painted onto a shared `Graphics` that is cleared and redrawn, and that pass needs
 * to know where each volume is. Recomputing it would mean the paint and the hit area deriving their
 * position separately — two answers to one question, which is the drift this codebase keeps finding.
 */
type ArtifactObject = Readonly<{
    artifactId: string;
    placement: LibraryRect;
    /** The cover, which is also the hit area. */
    surface: Phaser.GameObjects.Rectangle;
    spine: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    readMarker: Phaser.GameObjects.Text;
}>;

/** How far the gilt work is inset from the edge of the boards. */
const BINDING_GILT_INSET = 12;
/** How far the read ribbon stands proud of the head of the volume. */
const RIBBON_OVERHANG = 9;
const RIBBON_WIDTH = 12;

export class LibraryRenderer {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private readonly artifactObjects: ArtifactObject[] = [];
    private readonly decor: ReadingRoomDecor;
    /** Shadow under the volumes, painted once: it depends on where they stand, not on what state says. */
    private artifactShadow?: Phaser.GameObjects.Graphics;
    /** Gilt, plaques and ribbons — cleared and repainted whenever the read or focused state changes. */
    private artifactDetail?: Phaser.GameObjects.Graphics;
    private gateAccent?: Phaser.GameObjects.Rectangle;
    private heading?: Phaser.GameObjects.Text;
    private guide?: Phaser.GameObjects.Text;
    private detailTitle?: Phaser.GameObjects.Text;
    private detailCreator?: Phaser.GameObjects.Text;
    private detailClassification?: Phaser.GameObjects.Text;
    private detailRights?: Phaser.GameObjects.Text;
    private detailRelationship?: Phaser.GameObjects.Text;
    private gateBackground?: Phaser.GameObjects.Rectangle;
    private gateSpeaker?: Phaser.GameObjects.Text;
    private gateLine?: Phaser.GameObjects.Text;
    private advanceControl?: AdvanceControl;
    private inputEnabled = true;

    /**
     * Which object the detail panel describes. Ephemeral view state, like the book's spread index and
     * `DialogueBox`'s beat index: it is not evidence, it is not progress, and nothing persists it.
     * Defaults to the first artifact on the first render so the panel is never blank.
     */
    private focusedArtifactId?: string;

    /** Whether an advance has been refused by the reading gate since a line last applied. */
    private advanceRefused = false;

    /**
     * The one slot both refusals share: a pickup that could not be honoured, and an advance refused
     * for a reason the colleague does not answer.
     *
     * One slot rather than two because two would compete for the same band and the player would read
     * whichever won. `AppState`-identity lifetime (Story 2.7's rule), so a message survives every
     * repaint of the state it was set against — and is never cleared inside the render that draws it,
     * which is the defect that rule exists to prevent.
     */
    private readonly transientMessage = new TransientMessageSlot<string>();

    public constructor(
        private readonly scene: Scene,
        private readonly storeAdapter: PhaserStoreAdapter,
        private readonly options: LibraryRendererOptions
    ) {
        this.decor = new ReadingRoomDecor(scene);
    }

    /**
     * Builds the room, back to front.
     *
     * Phaser draws in creation order, so this sequence *is* the depth of the picture and the order is
     * load-bearing: the shell and its vignette go down first, then the case, then the volumes standing
     * in it, then the desk in front of them. Reordering two of these lines puts the vignette over the
     * furniture or the desk behind the shelf.
     */
    public create(): void {
        const { width, height } = this.scene.scale;
        this.scene.cameras.main.setBackgroundColor(ROOM_BACKGROUND);

        this.decor.createRoom(width, height);

        // Every string is authored empty here and written in `render()`: `create()` runs once and the
        // locale can change at any time, so player-facing copy only ever arrives through the store
        // subscription (ADR-010).
        this.heading = this.scene.add.text(LibraryRenderer.roomLeft(width), HEADING_Y, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${HEADING_FONT_SIZE}px`, wordWrap: { width: LibraryRenderer.roomWidth(width) }
        }));
        this.guide = this.scene.add.text(LibraryRenderer.roomLeft(width), GUIDE_Y, '', uiTextStyle({
            color: '#d8c6a6', fontSize: `${GUIDE_FONT_SIZE}px`, wordWrap: { width: LibraryRenderer.roomWidth(width) }
        }));
        this.objects.push(this.heading, this.guide);

        this.createArtifactObjects(width);
        this.decor.createDesk(width, height);
        this.createDetailPanel(width, height);
        this.createGateBand(width, height);
        this.createAdvanceControl(width, height);

        this.applyInputState();
    }

    public render(state: AppState): void {
        const locale = selectLocale(state);
        const t = createTranslator(locale);
        this.heading?.setText(t('library.heading'));
        this.guide?.setText(t('library.guide'));

        const artifacts = selectContextualArtifacts(state);
        // Settled before anything reads it, and re-settled if the focused artifact is no longer on the
        // shelf — a degraded cached `case.json` can carry a different set than the one this renderer
        // built objects for.
        if (!artifacts.some(({ id }) => id === this.focusedArtifactId)) {
            this.focusedArtifactId = artifacts[0]?.id;
        }

        this.renderArtifactObjects(state, t, artifacts);
        this.renderDetailPanel(state, t, artifacts.find(({ id }) => id === this.focusedArtifactId));
        this.renderGate(state, t);
    }

    /**
     * Lets the scene suppress the room while its own reference book is open.
     *
     * Intra-scene, driven by this scene's own presenter — never a callback from another scene. That
     * distinction is the whole of AC6: the retired arrangement had `LectureBookScene` calling
     * `laboratoryScene.setApparatusInputEnabled(...)` across a boundary.
     */
    public setInputEnabled(enabled: boolean): void {
        this.inputEnabled = enabled;
        this.applyInputState();
    }

    public destroy(): void {
        // The widget owns its own display objects, so it releases them itself rather than through the
        // shared list. Nothing here starts a tween or a timer, so there is nothing else to kill.
        this.advanceControl?.destroy();
        this.advanceControl = undefined;
        // The scenery owns its own `Graphics` layers, so it releases them itself rather than through
        // the shared list — the same arrangement the advance control has, and for the same reason.
        this.decor.destroy();
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.artifactObjects.length = 0;
        this.artifactShadow = undefined;
        this.artifactDetail = undefined;
        this.gateAccent = undefined;
        this.heading = undefined;
        this.guide = undefined;
        this.detailTitle = undefined;
        this.detailCreator = undefined;
        this.detailClassification = undefined;
        this.detailRights = undefined;
        this.detailRelationship = undefined;
        this.gateBackground = undefined;
        this.gateSpeaker = undefined;
        this.gateLine = undefined;
        this.focusedArtifactId = undefined;
        this.advanceRefused = false;
        this.transientMessage.clear();
    }

    // --- Construction -----------------------------------------------------------------------------

    private static roomLeft(canvasWidth: number): number {
        return libraryShelfBand(canvasWidth).x;
    }

    private static roomWidth(canvasWidth: number): number {
        return libraryShelfBand(canvasWidth).width;
    }

    private addRect(rect: LibraryRect, fill: number, stroke?: number): Phaser.GameObjects.Rectangle {
        const surface = this.scene.add
            .rectangle(rect.x, rect.y, rect.width, rect.height, fill)
            .setOrigin(0, 0);
        if (stroke !== undefined) surface.setStrokeStyle(2, stroke);
        this.objects.push(surface);
        return surface;
    }

    /**
     * The case, the volumes standing in it, and the three layers that make them read as books.
     *
     * Built in three passes rather than one loop per artifact, because the layers interleave: the
     * shadow has to be under every cover, the gilt work over every cover, and the titles over the gilt.
     * A single loop would stack one whole volume at a time and paint the second one's shadow across the
     * first one's title.
     */
    private createArtifactObjects(canvasWidth: number): void {
        // One volume per authored artifact. The count comes from the case, and the geometry is total
        // over it, so a later case with a different number is the same room with different furniture.
        const artifacts = selectContextualArtifacts(this.storeAdapter.getState());
        const placements = libraryArtifactPlacements(artifacts.length, canvasWidth);
        this.decor.createCase(canvasWidth, placements);

        // Pass 1 — the shadow each volume casts back onto the plank it stands on.
        this.artifactShadow = this.scene.add.graphics();
        this.objects.push(this.artifactShadow);
        placements.forEach((placement) => {
            this.artifactShadow?.fillStyle(0x000000, 0.45);
            this.artifactShadow?.fillRect(placement.x + 7, placement.y + 9, placement.width, placement.height - 6);
        });

        // Pass 2 — the boards and the spine. The cover doubles as the hit area, so the thing the player
        // sees and the thing they can click are one object and cannot drift apart.
        const covers = placements.map((placement, index) => {
            const artifact = artifacts[index];
            if (!artifact) return undefined;
            const surface = this.addRect(placement, BINDING_COVERS[index % BINDING_COVERS.length]!);
            const spine = this.addRect({
                x: placement.x, y: placement.y, width: ARTIFACT_SPINE_WIDTH, height: placement.height
            }, BINDING_SPINE[index % BINDING_SPINE.length]!);
            surface.on('pointerup', () => this.pickUp(artifact));
            // Hovering settles the detail panel without acting: the metadata for every artifact has to
            // be readable in-scene (AC3), and reading about one should not require picking it up.
            surface.on('pointerover', () => this.focus(artifact.id));
            return { artifact, placement, surface, spine };
        });

        // Pass 3 — gilt, title plaques and read ribbons, all repainted together on one surface.
        this.artifactDetail = this.scene.add.graphics();
        this.objects.push(this.artifactDetail);

        // Pass 4 — the readable text, over everything.
        covers.forEach((cover) => {
            if (!cover) return;
            const { artifact, placement, surface, spine } = cover;
            const labelBand = libraryArtifactLabelBand(placement);
            // Diegetic never means hidden (`EXPERIENCE.md` §HUD): every volume carries its readable
            // title, and scientific legibility outranks atmosphere. The plaque behind this text exists
            // so the title is dark-on-cream rather than fighting the leather.
            //
            // Centred on both axes, and origin-centred rather than positioned from the top-left: an
            // English title runs to one line and a French one to two, and a top-left anchor would leave
            // the shorter one sitting high on a plaque it is supposed to be *part of*. Measuring from
            // the middle is what makes it read as a label bound onto the book.
            const label = this.scene.add.text(
                labelBand.x + (labelBand.width / 2),
                labelBand.y + (labelBand.height / 2),
                '',
                uiTextStyle({
                    color: '#33240f',
                    fontSize: `${ARTIFACT_LABEL_FONT_SIZE}px`,
                    align: 'center',
                    wordWrap: { width: labelBand.width }
                })
            ).setOrigin(0.5, 0.5);
            const readMarker = this.scene.add.text(placement.x + placement.width - 14, placement.y + 14, '', uiTextStyle({
                color: '#f2d79a', fontSize: `${ARTIFACT_READ_FONT_SIZE}px`, fontStyle: 'bold'
            })).setOrigin(1, 0);
            this.objects.push(label, readMarker);
            this.artifactObjects.push({ artifactId: artifact.id, placement, surface, spine, label, readMarker });
        });
    }

    private createDetailPanel(canvasWidth: number, canvasHeight: number): void {
        const panel = libraryDetailPanelBand(canvasWidth, canvasHeight);
        const left = panel.x + DETAIL_PADDING;
        const wrap = detailTextWrap(canvasWidth, canvasHeight);
        const text = (fontSize: number, color: string): Phaser.GameObjects.Text => {
            const created = this.scene.add.text(left, panel.y + DETAIL_PADDING, '', uiTextStyle({
                color, fontSize: `${fontSize}px`, wordWrap: { width: wrap }
            }));
            this.objects.push(created);
            return created;
        };
        // Cream and warm grey on the desk's green leather. The metadata is deliberately quieter than
        // the title above it and the relationship below it, which is the reading order it wants.
        this.detailTitle = text(DETAIL_TITLE_FONT_SIZE, '#f7f0e2');
        this.detailCreator = text(DETAIL_META_FONT_SIZE, '#c9bda3');
        this.detailClassification = text(DETAIL_META_FONT_SIZE, '#c9bda3');
        this.detailRights = text(DETAIL_META_FONT_SIZE, '#c9bda3');
        this.detailRelationship = text(DETAIL_RELATIONSHIP_FONT_SIZE, '#eadfc9');
    }

    private createGateBand(canvasWidth: number, canvasHeight: number): void {
        const band = libraryGateLineBand(canvasWidth, canvasHeight);
        this.gateBackground = this.addRect(band, GATE_FILL);
        this.gateBackground.setVisible(false);
        // A brass rule down the speaking edge, so the colleague's line reads as someone talking rather
        // than as a system message that has appeared at the bottom of the room.
        this.gateAccent = this.addRect({ x: band.x, y: band.y, width: 4, height: band.height }, GATE_ACCENT);
        this.gateAccent.setVisible(false);
        const wrap = gateLineTextWrap(canvasWidth);
        this.gateSpeaker = this.scene.add.text(band.x + GATE_PADDING, band.y + GATE_PADDING, '', uiTextStyle({
            color: '#dcb670', fontSize: `${GATE_SPEAKER_FONT_SIZE}px`, fontStyle: 'bold', wordWrap: { width: wrap }
        }));
        this.gateLine = this.scene.add.text(band.x + GATE_PADDING, band.y + GATE_PADDING, '', uiTextStyle({
            color: '#f4d35e', fontSize: `${GATE_LINE_FONT_SIZE}px`, wordWrap: { width: wrap }
        }));
        this.objects.push(this.gateSpeaker, this.gateLine);
    }

    private createAdvanceControl(canvasWidth: number, canvasHeight: number): void {
        const bounds = libraryAdvanceControlBounds(canvasWidth, canvasHeight);

        // A brass surround behind the control, drawn here rather than inside the widget: the plaque is
        // this room's idea, and five other surfaces share that widget. Created before the control so it
        // sits behind it — the same creation-order rule the rest of the room is built on.
        const plate = this.scene.add.graphics();
        plate.fillStyle(0x000000, 0.4);
        plate.fillRect(bounds.x - 9, bounds.y - 7, bounds.width + 18, bounds.height + 16);
        plate.lineStyle(2, GILT, 0.55);
        plate.strokeRect(bounds.x - 9, bounds.y - 7, bounds.width + 18, bounds.height + 14);
        this.objects.push(plate);

        this.advanceControl = new AdvanceControl(this.scene, {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            palette: ADVANCE_PALETTE,
            onAdvance: () => this.requestAdvance()
        });
        this.advanceControl.create();
    }

    // --- Painting ---------------------------------------------------------------------------------

    /**
     * Repaints the volumes for the live state.
     *
     * Three things vary, and each is signalled by **more than one channel**, never by colour alone:
     *
     * - **Read** — a gilt ribbon over the head of the volume, *and* the word in
     *   `library.artifact.read` printed on the cover. A player who cannot separate the two golds still
     *   reads the marker.
     * - **Focused** — a bright gilt border, *and* the detail panel below already describing it.
     * - **Unreadable** — a grey binding, *and* the neutral line the pickup answers with. Nothing here
     *   presents it as evidence, which AC3 forbids outright.
     */
    private renderArtifactObjects(state: AppState, t: Translator, artifacts: readonly ContextualArtifact[]): void {
        const locale = selectLocale(state);
        const detail = this.artifactDetail;
        detail?.clear();

        this.artifactObjects.forEach(({ artifactId, placement, surface, spine, label, readMarker }, index) => {
            const artifact = artifacts.find(({ id }) => id === artifactId);
            if (!artifact) {
                // The premise stated above is that the set can change under us. A volume whose artifact
                // has gone must leave the room, not keep its last fill and its last title: its pointer
                // handler closed over the artifact this object was *built* from, so a click on a stale
                // object would dispatch `source.inspected` for an id the reducer answers with
                // `unknown-source-id`. `ApparatusRenderer.renderReferenceShelf` hides for the same reason.
                surface.setVisible(false).disableInteractive();
                spine.setVisible(false);
                label.setVisible(false);
                readMarker.setVisible(false);
                return;
            }
            const readable = isSourceEligibleForInspection(artifact) && Boolean(artifact.textualRendition);
            const inspected = selectIsSourceInspected(state, artifactId);
            const focused = artifactId === this.focusedArtifactId;

            surface.setVisible(true).setFillStyle(readable ? BINDING_COVERS[index % BINDING_COVERS.length]! : BINDING_UNAVAILABLE);
            spine.setVisible(true).setFillStyle(readable ? BINDING_SPINE[index % BINDING_SPINE.length]! : BINDING_SPINE_UNAVAILABLE);
            label.setVisible(true).setText(resolveLocalizedText(artifact.displayName, locale));
            readMarker.setVisible(true).setText(inspected ? t('library.artifact.read') : '');
            this.clampArtifactLabel(label, placement);

            if (!detail) return;
            this.paintBinding(detail, placement, { readable, inspected, focused });
        });
    }

    /**
     * Keeps a volume's title inside the plaque bound onto it.
     *
     * `displayName` has no maximum length in the content schema, and the label is origin-centred, so an
     * overflow spills symmetrically onto the leather above *and* below the plaque rather than running
     * off one edge where it might be noticed. The French typography sweep measures token widths, which
     * cannot see a line count, so nothing else catches this.
     */
    private clampArtifactLabel(label: Phaser.GameObjects.Text, placement: LibraryRect): void {
        const band = libraryArtifactLabelBand(placement);
        // Reset first, for the same reason the relationship does: this object is reused across locales.
        label.setFontSize(ARTIFACT_LABEL_FONT_SIZE);
        for (
            let fontSize = ARTIFACT_LABEL_FONT_SIZE;
            fontSize >= ARTIFACT_LABEL_MIN_FONT_SIZE && label.height > band.height;
            fontSize -= 1
        ) {
            label.setFontSize(fontSize);
        }
    }

    /** The gilt work, the title plaque and the read ribbon for one volume. */
    private paintBinding(
        graphics: Phaser.GameObjects.Graphics,
        placement: LibraryRect,
        state: Readonly<{ readable: boolean; inspected: boolean; focused: boolean }>
    ): void {
        const gilt = state.readable ? GILT : 0x6f6a60;
        const board = {
            x: placement.x + ARTIFACT_SPINE_WIDTH,
            width: placement.width - ARTIFACT_SPINE_WIDTH
        };

        // Leather is not a flat colour. A shallow vertical ramp across the boards, darkest at the foot,
        // is the difference between a bound volume and a coloured rectangle — and it costs eight fills.
        const SHADE_STEPS = 8;
        for (let step = 0; step < SHADE_STEPS; step += 1) {
            graphics.fillStyle(0x000000, 0.055 * (step / SHADE_STEPS));
            graphics.fillRect(
                board.x, placement.y + ((placement.height / SHADE_STEPS) * step),
                board.width, (placement.height / SHADE_STEPS) + 1
            );
        }
        // The fore-edge: the block of pages, showing at the far side from the spine.
        graphics.fillStyle(0xd8c9a6, state.readable ? 0.5 : 0.25);
        graphics.fillRect(placement.x + placement.width - 5, placement.y + 4, 5, placement.height - 8);
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillRect(placement.x + placement.width - 5, placement.y + 4, 1, placement.height - 8);

        // Raised bands across the spine, which is what a hand-bound volume actually has and the fastest
        // way to say "book" with three rectangles.
        [0.16, 0.42, 0.68, 0.88].forEach((fraction) => {
            graphics.fillStyle(0x000000, 0.28);
            graphics.fillRect(placement.x, placement.y + (placement.height * fraction), ARTIFACT_SPINE_WIDTH, 6);
            graphics.fillStyle(gilt, 0.45);
            graphics.fillRect(placement.x + 4, placement.y + (placement.height * fraction) + 1, ARTIFACT_SPINE_WIDTH - 8, 1);
        });
        // The hinge where the spine meets the boards.
        graphics.fillStyle(0x000000, 0.35);
        graphics.fillRect(placement.x + ARTIFACT_SPINE_WIDTH, placement.y, 3, placement.height);

        // A gilt double rule around the front board.
        const inset = BINDING_GILT_INSET;
        graphics.lineStyle(1, gilt, state.readable ? 0.75 : 0.4);
        graphics.strokeRect(
            placement.x + ARTIFACT_SPINE_WIDTH + inset, placement.y + inset,
            placement.width - ARTIFACT_SPINE_WIDTH - (2 * inset), placement.height - (2 * inset)
        );
        const inner = {
            x: placement.x + ARTIFACT_SPINE_WIDTH + inset + 4,
            y: placement.y + inset + 4,
            width: placement.width - ARTIFACT_SPINE_WIDTH - (2 * inset) - 8,
            height: placement.height - (2 * inset) - 8
        };
        graphics.lineStyle(1, gilt, state.readable ? 0.35 : 0.2);
        graphics.strokeRect(inner.x, inner.y, inner.width, inner.height);

        // Fleurons at the corners of the inner rule, which is where a real binding carries them. They
        // used to ring a blind-tooled centre device; the title plaque *is* the centre device now.
        graphics.fillStyle(gilt, state.readable ? 0.6 : 0.25);
        ([[0, 0], [1, 0], [0, 1], [1, 1]] as const).forEach(([alongX, alongY]) => {
            const cornerX = inner.x + (alongX * inner.width);
            const cornerY = inner.y + (alongY * inner.height);
            graphics.fillTriangle(cornerX, cornerY - 5, cornerX + 5, cornerY, cornerX, cornerY + 5);
            graphics.fillTriangle(cornerX, cornerY - 5, cornerX - 5, cornerY, cornerX, cornerY + 5);
        });

        // The plaque the title is printed on, sized from the same band the text is placed in.
        const plaque = libraryArtifactLabelBand(placement);
        const pad = ARTIFACT_LABEL_PADDING;
        // A shadow under the plaque, so it reads as laid onto the board rather than printed on it.
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillRect(plaque.x - pad + 3, plaque.y - pad + 3, plaque.width + (2 * pad), plaque.height + (2 * pad));
        graphics.fillStyle(PLAQUE_FILL, state.readable ? 1 : 0.72);
        graphics.fillRect(plaque.x - pad, plaque.y - pad, plaque.width + (2 * pad), plaque.height + (2 * pad));
        graphics.lineStyle(1, PLAQUE_EDGE, 0.9);
        graphics.strokeRect(plaque.x - pad, plaque.y - pad, plaque.width + (2 * pad), plaque.height + (2 * pad));

        if (state.inspected) {
            // The ribbon hangs out of the head of the volume, where a real place-marker sits, and stops
            // just above the plaque. It ran the length of the board until the plaque moved to the
            // centre, which pinched it into the strip between the hinge and the plaque's edge — present,
            // but too narrow to read as anything. Ending it above the plaque gives it clear board.
            const ribbonX = placement.x + ARTIFACT_SPINE_WIDTH + 16;
            const ribbonLength = (plaque.y - ARTIFACT_LABEL_PADDING - 8) - (placement.y - RIBBON_OVERHANG);
            graphics.fillStyle(RIBBON_READ, 1);
            graphics.fillRect(ribbonX, placement.y - RIBBON_OVERHANG, RIBBON_WIDTH, ribbonLength);
            graphics.fillStyle(0x000000, 0.28);
            graphics.fillRect(ribbonX, placement.y - RIBBON_OVERHANG, 3, ribbonLength);
            // A swallowtail foot, so it reads as ribbon rather than as a stripe painted on the cover.
            graphics.fillStyle(RIBBON_READ, 1);
            graphics.fillTriangle(
                ribbonX, placement.y - RIBBON_OVERHANG + ribbonLength,
                ribbonX + RIBBON_WIDTH, placement.y - RIBBON_OVERHANG + ribbonLength,
                ribbonX + (RIBBON_WIDTH / 2), placement.y - RIBBON_OVERHANG + ribbonLength + 8
            );
        }

        if (state.focused) {
            graphics.lineStyle(3, GILT_BRIGHT, 0.9);
            graphics.strokeRect(placement.x - 2, placement.y - 2, placement.width + 4, placement.height + 4);
        }
    }

    private renderDetailPanel(state: AppState, t: Translator, artifact: ContextualArtifact | undefined): void {
        const texts = [this.detailTitle, this.detailCreator, this.detailClassification, this.detailRights, this.detailRelationship];
        if (!artifact) {
            texts.forEach((text) => text?.setText('').setVisible(false));
            return;
        }
        const locale = selectLocale(state);
        this.detailTitle?.setText(resolveLocalizedText(artifact.displayName, locale));
        // `creatorOrOrigin` is canonical: an author or archive name is a proper noun, not translated
        // copy. Only the label around it resolves through the i18n layer.
        this.detailCreator?.setText(t('library.detail.creator', { value: artifact.creatorOrOrigin }));
        // Provenance and rights are rendered **as text, never as colour alone** (AC3). The stable enum
        // values resolve through the shared `source.*` families rather than through new keys.
        this.detailClassification?.setText(t('library.detail.classification', {
            type: t(`source.type.${artifact.sourceType}`),
            provenance: t(`source.provenanceName.${artifact.provenance.category}`)
        }));
        this.detailRights?.setText(t('library.detail.rights', { status: t(`source.rights.${artifact.rightsStatus}`) }));
        this.detailRelationship?.setText(resolveLocalizedText(artifact.caseRelationship, locale));

        // Stacked against measured neighbours, never against constants. Each of the five strings can
        // wrap to a different number of lines in French than in English, and placing the one below
        // against a fixed offset is the defect the 1.11, 1.12, 2.5, 2.6 and 2.7 reviews each found.
        const panel = libraryDetailPanelBand(this.scene.scale.width, this.scene.scale.height);
        const cursor = this.stackMetadata(panel);
        this.detailRelationship?.setVisible(true).setY(cursor + DETAIL_RELATIONSHIP_GAP - DETAIL_LINE_GAP);
        this.clampRelationship(panel);
    }

    /**
     * Stacks the four metadata lines from the top of the panel and returns the cursor under them.
     *
     * Shrunk as a block, not clamped individually, if the stack would leave the relationship below it
     * no room: `displayName` and `creatorOrOrigin` carry **no** maximum length in the content schema
     * (unlike an authored gate line, capped at 320), so "the metadata is short" is a property of the
     * shipped case rather than a guarantee. Every size is reset to its authored value first — measuring
     * a shrunken object and concluding it fits is how a temporary clamp becomes permanent.
     */
    private stackMetadata(panel: LibraryRect): number {
        const meta = [this.detailCreator, this.detailClassification, this.detailRights];
        const stacked = [this.detailTitle, ...meta];
        const floor = panel.y + panel.height - DETAIL_PADDING - DETAIL_RELATIONSHIP_MIN_HEIGHT;

        const restack = (shrinkBy: number): number => {
            this.detailTitle?.setFontSize(Math.max(DETAIL_TITLE_FONT_SIZE - shrinkBy, DETAIL_MIN_FONT_SIZE));
            meta.forEach((text) => text?.setFontSize(Math.max(DETAIL_META_FONT_SIZE - shrinkBy, DETAIL_MIN_FONT_SIZE)));
            let cursor = panel.y + DETAIL_PADDING;
            stacked.forEach((text) => {
                if (!text) return;
                text.setVisible(true).setY(cursor);
                cursor += text.height + DETAIL_LINE_GAP;
            });
            return cursor;
        };

        let cursor = restack(0);
        for (let shrinkBy = 1; shrinkBy <= DETAIL_META_FONT_SIZE - DETAIL_MIN_FONT_SIZE && cursor > floor; shrinkBy += 1) {
            cursor = restack(shrinkBy);
        }
        return cursor;
    }

    /**
     * Keeps the case relationship inside the panel it shares with the metadata above it.
     *
     * The relationship is unbounded authored prose and runs 15–25% longer in French. Where two objects
     * share a vertical budget, the one that can grow is the one that gets clamped — this canvas does not
     * scroll, so the alternative is prose running out of the bottom of the panel and over the way out of
     * the room.
     */
    private clampRelationship(panel: LibraryRect): void {
        const text = this.detailRelationship;
        if (!text) return;
        // Restored before measuring. The object is reused for every artifact and every locale, so a
        // shrink taken for a long French relationship would otherwise measure as "already fits" for the
        // next artifact and never come back — every later reference drawn at the minimum size.
        text.setFontSize(DETAIL_RELATIONSHIP_FONT_SIZE).setCrop();
        const available = (panel.y + panel.height - DETAIL_PADDING) - text.y;
        if (available <= 0) {
            text.setVisible(false);
            return;
        }
        for (let fontSize = DETAIL_RELATIONSHIP_FONT_SIZE; fontSize >= DETAIL_MIN_FONT_SIZE && text.height > available; fontSize -= 1) {
            text.setFontSize(fontSize);
        }
        // Defensive: an unusually long authored relationship is cropped rather than painted over the
        // advance control below.
        if (text.height > available) text.setCrop(0, 0, text.width, available);
    }

    /**
     * Draws the way out and, once an attempt has actually been refused, whatever answers it.
     *
     * Both the hint and the readiness are read from the store on every render rather than captured at
     * refusal time, so the moment the last required reading is recorded the line withdraws itself and
     * the control turns ready — the player answered the question, so it stops being asked.
     */
    private renderGate(state: AppState, t: Translator): void {
        const view = resolveAdvanceView({
            // Honest here in a way it is not on the theory board: this is a fact about the player's own
            // record of what they have read, not a judgement about a conclusion (ADR-006).
            isGateMet: selectContextualReadiness(state).status === 'ready',
            hint: selectLocalizedReadingGateHint(state),
            // Reading the slot is what spends it: it survives every repaint of the state it was set
            // against and clears on the first render that carries a new one.
            transientError: this.transientMessage.read(state),
            advanceRefused: this.advanceRefused
        });
        this.advanceRefused = view.advanceRefused;

        this.advanceControl?.render({
            label: t(advanceTransitionForPhase(selectCasePhase(state)).labelKey),
            isReady: view.isAdvanceReady
        });

        this.gateSpeaker?.setText(view.speakerText);
        this.gateLine?.setText(view.lineText);
        if (!view.lineText) {
            this.gateBackground?.setVisible(false);
            this.gateAccent?.setVisible(false);
            this.gateSpeaker?.setVisible(false);
            this.gateLine?.setVisible(false);
            return;
        }
        this.gateBackground?.setVisible(true);
        this.gateAccent?.setVisible(true);
        const band = libraryGateLineBand(this.scene.scale.width, this.scene.scale.height);
        const hasSpeaker = view.speakerText.length > 0;
        this.gateSpeaker?.setVisible(hasSpeaker).setY(band.y + GATE_PADDING);
        // Placed under the speaker's *measured* height, not under a constant one: the attributed line
        // wraps in French at names the English attribution fits on one line.
        this.gateLine
            ?.setVisible(true)
            .setY(hasSpeaker ? band.y + GATE_PADDING + (this.gateSpeaker?.height ?? 0) + GATE_SPEAKER_GAP : band.y + GATE_PADDING);
        this.clampGateLine(band);
    }

    /**
     * Keeps the colleague's line inside the gate band.
     *
     * The band reserves room for the longest line the content schema permits, but that reserve is
     * computed against the *wrap width* — the renderer additionally spends `GATE_PADDING` at the top,
     * the speaker's measured height, and `GATE_SPEAKER_GAP` before the line even starts, and the
     * attribution wraps to two lines at a long French colleague name. Shrinking to a floor and then
     * cropping is what makes this band's stated contract true rather than aspirational: this canvas does
     * not scroll, and the alternative is an authored line painting over the way out of the room.
     */
    private clampGateLine(band: LibraryRect): void {
        const text = this.gateLine;
        if (!text) return;
        text.setFontSize(GATE_LINE_FONT_SIZE).setCrop();
        const available = (band.y + band.height - GATE_PADDING) - text.y;
        if (available <= 0) {
            text.setVisible(false);
            return;
        }
        for (let fontSize = GATE_LINE_FONT_SIZE; fontSize >= GATE_LINE_MIN_FONT_SIZE && text.height > available; fontSize -= 1) {
            text.setFontSize(fontSize);
        }
        if (text.height > available) text.setCrop(0, 0, text.width, available);
    }

    // --- Acting -----------------------------------------------------------------------------------

    private focus(artifactId: string): void {
        if (this.focusedArtifactId === artifactId) return;
        this.focusedArtifactId = artifactId;
        this.render(this.storeAdapter.getState());
    }

    /**
     * Taking an artifact off the shelf.
     *
     * The order of the three guards is the whole of AC2 and AC3, and each is load-bearing:
     *
     * 1. **Unreadable artifacts never reach a dispatch.** An artifact whose rights are unreviewed, or
     *    which holds no local rendition, gets a neutral in-scene line and stays exactly as it was.
     *    Recording it as inspected would present it as verified evidence, which AC3 forbids outright.
     * 2. **An already-read artifact is opened without dispatching.** The reducer answers a second
     *    inspection with `duplicate-inspected-source` — correctly, it is a duplicated dispatch — and
     *    re-reading is a normal, expected act. Dispatching anyway would manufacture an error the
     *    surface then has to explain away for something the player did nothing wrong to reach.
     * 3. **Only a genuinely new reading dispatches**, and the book opens only if it succeeded.
     */
    private pickUp(artifact: ContextualArtifact): void {
        this.focusedArtifactId = artifact.id;
        const state = this.storeAdapter.getState();
        const t = createTranslator(selectLocale(state));

        if (!isSourceEligibleForInspection(artifact)) {
            this.refuse(t('library.artifact.unavailable'), state);
            return;
        }
        if (!artifact.textualRendition) {
            this.refuse(t('library.artifact.noRendition'), state);
            return;
        }
        if (selectIsSourceInspected(state, artifact.id)) {
            this.options.openBook(artifact);
            this.render(state);
            return;
        }

        const result = this.storeAdapter.inspectSource(artifact.id);
        const current = this.storeAdapter.getState();
        if (!result.ok) {
            // Never `error.message` — that is the dev-facing English string. `selectLocalizedError` is
            // the single presentation boundary for a `Result` failure.
            this.refuse(selectLocalizedError(current, result.error), current);
            return;
        }
        this.options.openBook(artifact);
        // A successful dispatch has already notified the store, so the scene's subscription has
        // repainted the room; only the newly-focused object needs the extra pass.
        this.render(current);
    }

    /**
     * Asks to make the move that leaves the live phase.
     *
     * Resolved from the **live** phase rather than hard-coded to `context → prediction`: a scene
     * mirrors the phase and never defines it (ADR-009), and this is the rule every host of the control
     * follows.
     */
    private requestAdvance(): void {
        const { transition } = advanceTransitionForPhase(selectCasePhase(this.storeAdapter.getState()));
        const result = this.storeAdapter.advanceCase(transition);
        if (result.ok) return;
        const current = this.storeAdapter.getState();
        const { register, message } = resolveAdvanceRefusal({
            code: result.error.code,
            localizedError: selectLocalizedError(current, result.error),
            // The reading room is the one host that can speak for `missing-contextual-sources` — and
            // only when an authored line actually applies. With none, the refusal falls back to the
            // localized error rather than to an empty band.
            colleagueAnswers: selectLocalizedReadingGateHint(current) !== undefined
        });
        if (register === 'gate') {
            this.advanceRefused = true;
            // The colleague answers this one, so any message still standing in the slot is superseded.
            this.transientMessage.clear();
            this.render(current);
            return;
        }
        this.refuse(message ?? '', current);
    }

    /**
     * Holds a message the player must be able to read, anchored to the state it was refused against.
     *
     * A refused dispatch leaves the state object untouched, so the message survives every repaint
     * until something really changes — and it is set *before* the render that draws it, never cleared
     * inside one.
     */
    private refuse(message: string, state: AppState): void {
        this.transientMessage.set(message, state);
        this.render(state);
    }

    private applyInputState(): void {
        this.artifactObjects.forEach(({ surface }) => {
            if (this.inputEnabled) surface.setInteractive({ useHandCursor: true });
            else surface.disableInteractive();
        });
        this.advanceControl?.setInputEnabled(this.inputEnabled);
    }
}
